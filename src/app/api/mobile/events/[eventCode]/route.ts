import { revalidatePath } from "next/cache";
import {
  listEventActiveDates,
  listEventBufferOverrides,
  verifyEventCode,
} from "@/app/actions/events";
import { listTimeBlocks } from "@/app/actions/time-blocks";
import { deleteEventCascade } from "@/lib/events/delete-event";
import { mobileError, mobileOk, readJsonBody } from "@/lib/mobile/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireDate, requireTime } from "@/lib/validators/action-inputs";

type EventRouteProps = {
  params: Promise<{
    eventCode: string;
  }>;
};

type UpdateMobileEventDateBody = {
  activeDates?: string[];
  dailyEndTime?: string;
  dailyStartTime?: string;
  dateEnd?: string;
  dateStart?: string;
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

export async function PATCH(request: Request, { params }: EventRouteProps) {
  try {
    const user = await getMobileUserFromRequest(request);

    if (!user) {
      return mobileError("로그인이 필요합니다.", 401);
    }

    const { eventCode } = await params;
    const body = await readJsonBody<UpdateMobileEventDateBody>(request);
    const dateStart = requireDate(body.dateStart, "dateStart");
    const dateEnd = requireDate(body.dateEnd, "dateEnd");
    const dailyStartTime = requireTime(body.dailyStartTime, "dailyStartTime");
    const dailyEndTime = requireTime(body.dailyEndTime, "dailyEndTime");
    const admin = createSupabaseAdminClient();
    const event = await findEditableEvent(admin, eventCode, user.id);
    const activeDates = normalizeActiveDates(
      body.activeDates,
      dateStart,
      dateEnd,
    );

    if (dateStart > dateEnd) {
      return mobileError("시작일은 종료일보다 늦을 수 없습니다.");
    }

    if (dailyStartTime >= dailyEndTime) {
      return mobileError("시작 시간은 종료 시간보다 빨라야 합니다.");
    }

    const { data, error } = await admin
      .from("events")
      .update({
        daily_end_time: dailyEndTime,
        daily_start_time: dailyStartTime,
        date_end: dateEnd,
        date_start: dateStart,
      })
      .eq("id", event.id)
      .select(
        "id,event_code,title,date_start,date_end,daily_start_time,daily_end_time",
      )
      .single();

    if (error || !data) {
      return mobileError(error?.message ?? "날짜와 기본 시간을 저장하지 못했습니다.");
    }

    const { error: deleteDatesError } = await admin
      .from("event_active_dates")
      .delete()
      .eq("event_id", event.id);

    if (deleteDatesError) {
      return mobileError(deleteDatesError.message);
    }

    const { error: insertDatesError } = await admin
      .from("event_active_dates")
      .insert(
        activeDates.map((activeDate) => ({
          active_date: activeDate,
          event_id: event.id,
        })),
      );

    if (insertDatesError) {
      return mobileError(insertDatesError.message);
    }

    revalidatePath(`/host/events/${event.id}`);
    revalidatePath(`/event/${event.event_code}`);

    return mobileOk({ event: data });
  } catch (error) {
    return mobileError(
      error instanceof Error
        ? error.message
        : "날짜와 기본 시간을 저장하지 못했습니다.",
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

function normalizeActiveDates(
  value: string[] | undefined,
  dateStart: string,
  dateEnd: string,
) {
  const source = value && value.length > 0 ? value : buildDateList(dateStart, dateEnd);
  const activeDates = [
    ...new Set(source.map((date) => requireDate(date, "activeDate"))),
  ]
    .filter((date) => date >= dateStart && date <= dateEnd)
    .sort();

  if (activeDates.length === 0 || activeDates.length > 120) {
    throw new Error("활성 날짜는 1개 이상 120개 이하로 선택해 주세요.");
  }

  return activeDates;
}

function buildDateList(dateStart: string, dateEnd: string) {
  const dates: string[] = [];
  const current = new Date(`${dateStart}T00:00:00`);
  const end = new Date(`${dateEnd}T00:00:00`);

  while (current.getTime() <= end.getTime()) {
    dates.push(toDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}
