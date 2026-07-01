import {
  listEventActiveDates,
  listEventBufferOverrides,
  verifyEventCode,
} from "@/app/actions/events";
import { listTimeBlocks } from "@/app/actions/time-blocks";
import { deleteEventCascade } from "@/lib/events/delete-event";
import { mobileError, mobileOk } from "@/lib/mobile/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type EventRouteProps = {
  params: Promise<{
    eventCode: string;
  }>;
};

export async function GET(_request: Request, { params }: EventRouteProps) {
  try {
    const { eventCode } = await params;
    const eventResult = await verifyEventCode(eventCode);

    if (!eventResult.ok) {
      return mobileError(eventResult.error, 404);
    }

    const event = eventResult.data.event;
    const [scheduleResult, activeDatesResult, bufferOverridesResult] =
      await Promise.all([
        listTimeBlocks({ eventCode: event.event_code }),
        listEventActiveDates({ eventCode: event.event_code }),
        listEventBufferOverrides({ eventCode: event.event_code }),
      ]);

    if (!scheduleResult.ok) {
      return mobileError(scheduleResult.error);
    }

    if (!activeDatesResult.ok) {
      return mobileError(activeDatesResult.error);
    }

    if (!bufferOverridesResult.ok) {
      return mobileError(bufferOverridesResult.error);
    }

    return mobileOk({
      activeDates: activeDatesResult.data.activeDates,
      bufferOverrides: bufferOverridesResult.data.bufferOverrides,
      event,
      reservationSlots: scheduleResult.data.reservationSlots,
      timeBlocks: scheduleResult.data.timeBlocks,
    });
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "이벤트 정보를 불러오지 못했습니다.",
      500,
    );
  }
}

export async function DELETE(request: Request, { params }: EventRouteProps) {
  try {
    const user = await getMobileUserFromRequest(request);

    if (!user) {
      return mobileError("로그인이 필요합니다.", 401);
    }

    const { eventCode } = await params;
    const admin = createSupabaseAdminClient();
    const event = await findEditableEvent(admin, eventCode, user.id);

    await deleteEventCascade(admin, event.id);

    return mobileOk({
      eventCode: event.event_code,
      eventId: event.id,
    });
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "이벤트를 삭제하지 못했습니다.",
      500,
    );
  }
}

async function findEditableEvent(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  eventCodeOrId: string,
  userId: string,
) {
  const normalizedValue = eventCodeOrId.trim();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedValue,
    );
  const firstQuery = isUuid
    ? admin
        .from("events")
        .select("id,event_code,host_id")
        .eq("id", normalizedValue)
        .maybeSingle()
    : admin
        .from("events")
        .select("id,event_code,host_id")
        .eq("event_code", normalizedValue.toUpperCase())
        .maybeSingle();
  const { data, error } = await firstQuery;

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.host_id !== userId) {
    throw new Error("삭제할 이벤트를 찾을 수 없습니다.");
  }

  return data;
}
