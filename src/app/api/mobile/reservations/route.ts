import { revalidatePath } from "next/cache";
import {
  mobileError,
  mobileOk,
  readJsonBody,
} from "@/lib/mobile/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile/auth";
import { hashReservationPassword } from "@/lib/security/passwords";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  optionalText,
  requireInteger,
  requireParticipants,
  requireTimeRanges,
  requireUuid,
} from "@/lib/validators/action-inputs";
import type { ParticipantDraft, TimeRange } from "@/types/domain";

type CreateMobileReservationBody = {
  eventId?: string;
  headcount?: number;
  participants?: ParticipantDraft[];
  password?: string | null;
  requestedSlots?: TimeRange[];
};

export async function POST(request: Request) {
  let reservationId: string | null = null;

  try {
    const user = await getMobileUserFromRequest(request);
    const body = await readJsonBody<CreateMobileReservationBody>(request);
    const payload = parseCreateMobileReservationBody(body);
    const admin = createSupabaseAdminClient();
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id,event_code")
      .eq("id", payload.eventId)
      .single();

    if (eventError || !event) {
      return mobileError("예약할 이벤트를 찾을 수 없습니다.", 404);
    }

    const { data: reservation, error: reservationError } = await admin
      .from("reservations")
      .insert({
        creator_id: user?.id ?? null,
        event_id: event.id,
        headcount: payload.headcount,
        password_hash: hashReservationPassword(payload.password ?? ""),
      })
      .select(
        "id,event_id,creator_id,reservation_access_code,headcount,status,created_at,updated_at",
      )
      .single();

    if (reservationError || !reservation) {
      return mobileError(
        reservationError?.message ?? "예약 생성에 실패했습니다.",
      );
    }

    reservationId = reservation.id;

    const { error: participantsError } = await admin
      .from("reservation_participants")
      .insert(
        payload.participants.map((participant, index) => ({
          guest_name: participant.guestName,
          is_creator: index === 0,
          reservation_id: reservation.id,
          user_id:
            user && (index === 0 || participant.userId === user.id)
              ? user.id
              : null,
        })),
      );

    if (participantsError) {
      throw new Error(participantsError.message);
    }

    const { data: slots, error: slotsError } = await admin
      .from("reservation_slots")
      .insert(
        payload.requestedSlots.map((slot, index) => ({
          end_at: slot.endAt,
          event_id: event.id,
          priority_order: index + 1,
          reservation_id: reservation.id,
          start_at: slot.startAt,
        })),
      )
      .select(
        "id,reservation_id,start_at,end_at,confirmed_start_at,confirmed_end_at,is_confirmed,priority_order",
      )
      .order("priority_order", { ascending: true });

    if (slotsError) {
      throw new Error(slotsError.message);
    }

    revalidatePath(`/event/${event.event_code}`);
    revalidatePath(`/reservations/${reservation.reservation_access_code}`);

    return mobileOk(
      {
        eventCode: event.event_code,
        reservation: {
          ...reservation,
          participants: payload.participants.map((participant, index) => ({
            guest_name: participant.guestName,
            id: `${reservation.id}:${index}`,
            is_creator: index === 0,
            user_id:
              user && (index === 0 || participant.userId === user.id)
                ? user.id
                : null,
          })),
          slots: slots ?? [],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (reservationId) {
      await createSupabaseAdminClient()
        .from("reservations")
        .delete()
        .eq("id", reservationId);
    }

    return mobileError(
      error instanceof Error ? error.message : "예약 생성에 실패했습니다.",
      500,
    );
  }
}

function parseCreateMobileReservationBody(body: CreateMobileReservationBody) {
  const eventId = requireUuid(body.eventId, "eventId");
  const headcount = requireInteger(body.headcount ?? 1, "headcount", 1, 30);
  const participants = requireParticipants(body.participants ?? []);
  const requestedSlots = requireTimeRanges(
    body.requestedSlots ?? [],
    "requestedSlots",
  );
  const password = optionalText(body.password, 100);

  if (participants.length > headcount) {
    throw new Error("참여자 수는 총 인원수를 초과할 수 없습니다.");
  }

  if (requestedSlots.length === 0 || requestedSlots.length > 20) {
    throw new Error("예약 후보는 1-20개까지 선택할 수 있습니다.");
  }

  return {
    eventId,
    headcount,
    participants,
    password,
    requestedSlots,
  };
}
