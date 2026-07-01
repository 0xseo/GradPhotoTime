import { getSlotDisplayRange } from "@/lib/reservations/slots";
import { normalizeReservationSlotPriorities } from "@/lib/reservations/priority";
import { getCandidateSlotBlockReason } from "@/lib/reservations/rules";
import { mobileError, mobileOk, readJsonBody } from "@/lib/mobile/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { buildEffectiveBufferTimeRanges } from "@/lib/time/ranges";
import { requireUuid } from "@/lib/validators/action-inputs";

type ReviewMobileReservationBody = {
  confirmedSlotId?: string;
  eventId?: string;
  reservationId?: string;
  status?: "APPROVED" | "PENDING";
};

type MobileReviewEvent = Pick<
  Tables<"events">,
  | "buffer_time_minutes"
  | "event_code"
  | "host_id"
  | "id"
  | "is_buffer_active"
  | "is_buffer_after_active"
  | "is_buffer_before_active"
>;

type MobileReviewSlot = Tables<"reservation_slots">;

export async function POST(request: Request) {
  try {
    const user = await getMobileUserFromRequest(request);

    if (!user) {
      return mobileError("로그인이 필요합니다.", 401);
    }

    const body = await readJsonBody<ReviewMobileReservationBody>(request);
    const eventId = requireUuid(body.eventId, "eventId");
    const reservationId = requireUuid(body.reservationId, "reservationId");
    const confirmedSlotId = requireUuid(
      body.confirmedSlotId,
      "confirmedSlotId",
    );
    const status = body.status;

    if (status !== "APPROVED" && status !== "PENDING") {
      return mobileError("처리할 상태가 올바르지 않습니다.");
    }

    const admin = createSupabaseAdminClient();
    const event = await getHostEvent(admin, eventId, user.id);
    const reservation = await getReservation(admin, event.id, reservationId);

    if (reservation.status === "CANCELLED" || reservation.status === "REJECTED") {
      return mobileError("처리할 수 없는 예약 상태입니다.");
    }

    const slot = await getReservationSlot(
      admin,
      event.id,
      reservation.id,
      confirmedSlotId,
    );

    if (status === "APPROVED") {
      const blockMessage = await getConfirmationBlockMessage(
        admin,
        event,
        slot,
        reservation.id,
      );

      if (blockMessage) {
        return mobileError(blockMessage);
      }

      const { error: slotError } = await admin
        .from("reservation_slots")
        .update({
          confirmed_end_at: null,
          confirmed_start_at: null,
          is_confirmed: true,
        })
        .eq("id", slot.id);

      if (slotError) {
        return mobileError(slotError.message);
      }

      const { error: reservationError } = await admin
        .from("reservations")
        .update({ status: "APPROVED" })
        .eq("id", reservation.id);

      if (reservationError) {
        return mobileError(reservationError.message);
      }

      await normalizeReservationSlotPriorities(admin, reservation.id);

      return mobileOk({ eventCode: event.event_code, reservationId });
    }

    const { error: slotError } = await admin
      .from("reservation_slots")
      .update({
        confirmed_end_at: null,
        confirmed_start_at: null,
        is_confirmed: false,
      })
      .eq("id", slot.id);

    if (slotError) {
      return mobileError(slotError.message);
    }

    const { count, error: countError } = await admin
      .from("reservation_slots")
      .select("id", { count: "exact", head: true })
      .eq("reservation_id", reservation.id)
      .eq("is_confirmed", true);

    if (countError) {
      return mobileError(countError.message);
    }

    const { error: reservationError } = await admin
      .from("reservations")
      .update({ status: (count ?? 0) > 0 ? "APPROVED" : "PENDING" })
      .eq("id", reservation.id);

    if (reservationError) {
      return mobileError(reservationError.message);
    }

    await normalizeReservationSlotPriorities(admin, reservation.id);

    return mobileOk({ eventCode: event.event_code, reservationId });
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "예약을 처리하지 못했습니다.",
      500,
    );
  }
}

async function getHostEvent(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  eventId: string,
  userId: string,
) {
  const { data, error } = await admin
    .from("events")
    .select(
      "id,event_code,host_id,buffer_time_minutes,is_buffer_active,is_buffer_before_active,is_buffer_after_active",
    )
    .eq("id", eventId)
    .single();

  if (error || !data || data.host_id !== userId) {
    throw new Error("이 이벤트의 Host만 예약을 처리할 수 있습니다.");
  }

  return data;
}

async function getReservation(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  eventId: string,
  reservationId: string,
) {
  const { data, error } = await admin
    .from("reservations")
    .select("id,event_id,status")
    .eq("id", reservationId)
    .eq("event_id", eventId)
    .single();

  if (error || !data) {
    throw new Error("예약을 찾지 못했습니다.");
  }

  return data;
}

async function getReservationSlot(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  eventId: string,
  reservationId: string,
  slotId: string,
) {
  const { data, error } = await admin
    .from("reservation_slots")
    .select("*")
    .eq("id", slotId)
    .eq("event_id", eventId)
    .eq("reservation_id", reservationId)
    .single();

  if (error || !data) {
    throw new Error("후보 시간을 찾지 못했습니다.");
  }

  return data;
}

async function getConfirmationBlockMessage(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  event: MobileReviewEvent,
  slot: MobileReviewSlot,
  reservationId: string,
) {
  const [timeBlocksResult, confirmedSlotsResult, bufferOverridesResult] =
    await Promise.all([
      admin
        .from("time_blocks")
        .select("start_at,end_at,type")
        .eq("event_id", event.id),
      admin
        .from("reservation_slots")
        .select(
          "id,reservation_id,start_at,end_at,confirmed_start_at,confirmed_end_at,is_confirmed",
        )
        .eq("event_id", event.id)
        .eq("is_confirmed", true)
        .neq("reservation_id", reservationId),
      admin
        .from("event_buffer_overrides")
        .select(
          "reservation_slot_id,side,is_active,custom_start_at,custom_end_at",
        )
        .eq("event_id", event.id),
    ]);

  if (timeBlocksResult.error) {
    throw new Error(timeBlocksResult.error.message);
  }

  if (confirmedSlotsResult.error) {
    throw new Error(confirmedSlotsResult.error.message);
  }

  if (bufferOverridesResult.error) {
    throw new Error(bufferOverridesResult.error.message);
  }

  const confirmedRanges =
    confirmedSlotsResult.data?.map((confirmedSlot) => ({
      ...getSlotDisplayRange(confirmedSlot),
      id: confirmedSlot.id,
    })) ?? [];
  const confirmedOrBufferRanges = [
    ...confirmedRanges.map(({ endAt, startAt }) => ({ endAt, startAt })),
    ...buildEffectiveBufferTimeRanges({
      afterActive: event.is_buffer_after_active,
      beforeActive: event.is_buffer_before_active,
      bufferMinutes: event.buffer_time_minutes,
      isBufferActive: event.is_buffer_active,
      overrides: bufferOverridesResult.data ?? [],
      ranges: confirmedRanges,
    }),
  ];
  const blockReason = getCandidateSlotBlockReason({
    candidate: getSlotDisplayRange(slot),
    confirmedOrBufferRanges,
    confirmedRanges,
    timeBlocks:
      timeBlocksResult.data?.map((block) => ({
        endAt: block.end_at,
        startAt: block.start_at,
        type: block.type,
      })) ?? [],
  });

  if (blockReason === "BLOCKED_TIME") {
    return "Host가 막아둔 시간과 겹칩니다.";
  }

  if (blockReason === "CONFIRMED_OR_BUFFER") {
    return "이미 확정된 일정 또는 버퍼와 겹칩니다.";
  }

  return null;
}
