import { createReservation } from "@/app/actions/reservations";
import {
  mobileError,
  mobileOk,
  readJsonBody,
} from "@/lib/mobile/api-response";
import type { ParticipantDraft, TimeRange } from "@/types/domain";

type CreateMobileReservationBody = {
  eventId?: string;
  headcount?: number;
  participants?: ParticipantDraft[];
  password?: string | null;
  requestedSlots?: TimeRange[];
};

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<CreateMobileReservationBody>(request);
    const result = await createReservation({
      eventId: body.eventId ?? "",
      headcount: body.headcount ?? 1,
      participants: body.participants ?? [],
      password: body.password ?? null,
      requestedSlots: body.requestedSlots ?? [],
    });

    if (!result.ok) {
      return mobileError(result.error);
    }

    return mobileOk(result.data, { status: 201 });
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "예약 생성에 실패했습니다.",
      500,
    );
  }
}
