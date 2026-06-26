import {
  listEventActiveDates,
  listEventBufferOverrides,
  verifyEventCode,
} from "@/app/actions/events";
import { listTimeBlocks } from "@/app/actions/time-blocks";
import { mobileError, mobileOk } from "@/lib/mobile/api-response";

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
