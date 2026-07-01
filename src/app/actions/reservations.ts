"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/actions/result";
import {
  hashReservationPassword,
  verifyReservationPassword,
} from "@/lib/security/passwords";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCandidateSlotBlockReason,
  type CandidateSlotBlockReason,
} from "@/lib/reservations/rules";
import { getSlotDisplayRange } from "@/lib/reservations/slots";
import { normalizeReservationSlotPriorities } from "@/lib/reservations/priority";
import {
  buildBufferTimeRangeItems,
  getBufferOverrideKey,
} from "@/lib/time/ranges";
import {
  optionalText,
  requireInteger,
  requireParticipants,
  requireReservationAccessCode,
  requireTimeRange,
  requireTimeRanges,
  requireUuid,
} from "@/lib/validators/action-inputs";
import type { EventBufferOverride, PublicEvent } from "@/app/actions/events";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import type { ParticipantDraft, ReservationStatus, TimeRange } from "@/types/domain";

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export type ReservationParticipant = Pick<
  Tables<"reservation_participants">,
  "guest_name" | "id" | "is_creator" | "user_id"
>;

export type ReservationSlot = Pick<
  Tables<"reservation_slots">,
  | "confirmed_end_at"
  | "confirmed_start_at"
  | "end_at"
  | "id"
  | "is_confirmed"
  | "priority_order"
  | "start_at"
>;

export type PublicReservationGroup = Pick<
  Tables<"reservations">,
  | "created_at"
  | "creator_id"
  | "event_id"
  | "headcount"
  | "id"
  | "reservation_access_code"
  | "status"
  | "updated_at"
> & {
  participants: ReservationParticipant[];
  slots: ReservationSlot[];
};

export type CreateReservationInput = {
  eventId: string;
  headcount: number;
  participants: ParticipantDraft[];
  password?: string | null;
  requestedSlots: TimeRange[];
};

export type CreateReservationData = {
  reservation: PublicReservationGroup;
};

export type HostReservationGroup = PublicReservationGroup;

export type ReservationManagementView = {
  activeDates: string[];
  bufferOverrides: EventBufferOverride[];
  event: PublicEvent;
  passwordRequired: boolean;
  reservation: PublicReservationGroup;
  reservationSlots: EventScheduleSlot[];
  timeBlocks: Tables<"time_blocks">[];
};

export type GetReservationManagementInput = {
  reservationAccessCode: string;
};

export type GetReservationManagementData = ReservationManagementView;

export async function getReservationManagementView(
  input: GetReservationManagementInput,
): Promise<ActionResult<GetReservationManagementData>> {
  try {
    const reservationAccessCode = requireReservationAccessCode(
      input.reservationAccessCode,
    );
    const supabase = createSupabaseAdminClient();
    const currentUserId = await getCurrentUserId();
    const reservation = await getReservationByAccessCode(reservationAccessCode);
    const [
      reservationGroup,
      event,
      timeBlocks,
      reservationSlots,
      activeDates,
      bufferOverrides,
    ] = await Promise.all([
        getReservationGroupById(reservation.id),
        getPublicEventById(supabase, reservation.event_id),
        getTimeBlocksForEvent(supabase, reservation.event_id),
        getEventScheduleSlotsForEvent(supabase, reservation.event_id),
        getEventActiveDates(supabase, reservation.event_id),
        getEventBufferOverrides(supabase, reservation.event_id),
      ]);

    return actionOk({
      activeDates,
      bufferOverrides,
      event,
      passwordRequired:
        Boolean(reservation.password_hash) &&
        !canManageReservationAsCreator(reservation, currentUserId),
      reservation: reservationGroup,
      reservationSlots,
      timeBlocks,
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

async function getEventActiveDates(
  supabase: AdminSupabaseClient,
  eventId: string,
) {
  const { data, error } = await supabase
    .from("event_active_dates")
    .select("active_date")
    .eq("event_id", eventId)
    .order("active_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data?.map((row) => row.active_date) ?? [];
}

async function getEventBufferOverrides(
  supabase: AdminSupabaseClient,
  eventId: string,
) {
  const { data, error } = await supabase
    .from("event_buffer_overrides")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export type ListEventReservationsInput = {
  eventId: string;
};

export type ListEventReservationsData = {
  reservations: HostReservationGroup[];
};

export async function listEventReservations(
  input: ListEventReservationsInput,
): Promise<ActionResult<ListEventReservationsData>> {
  try {
    const eventId = requireUuid(input.eventId, "eventId");
    const { admin, event } = await getHostEventContext(eventId);
    const reservations = await getReservationGroupsForEvent(admin, event.id);

    return actionOk({ reservations });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type ReviewReservationInput = {
  confirmedSlotId?: string | null;
  eventId: string;
  reservationId: string;
  status: Extract<ReservationStatus, "APPROVED" | "PENDING" | "REJECTED">;
};

export type ReviewReservationData = {
  reservation: PublicReservationGroup;
};

export async function reviewReservation(
  input: ReviewReservationInput,
): Promise<ActionResult<ReviewReservationData>> {
  try {
    const payload = parseReviewReservationInput(input);
    const { admin, event } = await getHostEventContext(payload.eventId);
    const reservation = await getReservationById(admin, payload.reservationId);

    if (reservation.event_id !== event.id) {
      return actionError("이 이벤트의 예약만 처리할 수 있습니다.");
    }

    if (reservation.status === "CANCELLED") {
      return actionError("취소된 예약은 처리할 수 없습니다.");
    }

    if (payload.status === "REJECTED") {
      await clearReservationConfirmedSlots(admin, reservation.id);

      const { error: reservationError } = await admin
        .from("reservations")
        .update({ status: payload.status })
        .eq("id", reservation.id);

      if (reservationError) {
        return actionError(reservationError.message);
      }
    } else if (payload.status === "PENDING") {
      if (payload.confirmedSlotId) {
        const { error: slotError } = await admin
          .from("reservation_slots")
          .update({
            confirmed_end_at: null,
            confirmed_start_at: null,
            is_confirmed: false,
          })
          .eq("id", payload.confirmedSlotId)
          .eq("reservation_id", reservation.id);

        if (slotError) {
          return actionError(slotError.message);
        }
      } else {
        await clearReservationConfirmedSlots(admin, reservation.id);
      }

      const confirmedSlots = await getConfirmedReservationSlots(
        admin,
        reservation.id,
      );
      const { error: reservationError } = await admin
        .from("reservations")
        .update({ status: confirmedSlots.length > 0 ? "APPROVED" : "PENDING" })
        .eq("id", reservation.id);

      if (reservationError) {
        return actionError(reservationError.message);
      }
    } else {
      if (!payload.confirmedSlotId) {
        return actionError("승인할 후보 시간을 선택해 주세요.");
      }

      const slot = await getReservationSlot(
        admin,
        reservation.id,
        payload.confirmedSlotId,
      );

      await assertSlotCanBeConfirmed(admin, event, slot, reservation.id);

      const { error: slotError } = await admin
        .from("reservation_slots")
        .update({
          confirmed_end_at: null,
          confirmed_start_at: null,
          is_confirmed: true,
        })
        .eq("id", slot.id)
        .eq("reservation_id", reservation.id);

      if (slotError) {
        return actionError(slotError.message);
      }

      const { error: reservationError } = await admin
        .from("reservations")
        .update({ status: "APPROVED" })
        .eq("id", reservation.id);

      if (reservationError) {
        return actionError(reservationError.message);
      }
    }

    await normalizeReservationSlotPriorities(admin, reservation.id);

    const reservationGroup = await getReservationGroupById(reservation.id);

    revalidateReservationPaths(
      reservation.reservation_access_code,
      event.event_code,
      event.id,
    );

    return actionOk({ reservation: reservationGroup });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type UpdateConfirmedReservationSlotTimeInput = {
  eventId: string;
  slotId: string;
  timeRange: TimeRange;
};

export type UpdateConfirmedReservationSlotTimeData = {
  slot: ReservationSlot;
};

export async function updateConfirmedReservationSlotTime(
  input: UpdateConfirmedReservationSlotTimeInput,
): Promise<ActionResult<UpdateConfirmedReservationSlotTimeData>> {
  try {
    const eventId = requireUuid(input.eventId, "eventId");
    const slotId = requireUuid(input.slotId, "slotId");
    const timeRange = requireTimeRange(input.timeRange, "timeRange");
    const { admin, event } = await getHostEventContext(eventId);
    const { data: slot, error: slotError } = await admin
      .from("reservation_slots")
      .select("*")
      .eq("id", slotId)
      .eq("event_id", event.id)
      .single();

    if (slotError || !slot) {
      return actionError("수정할 확정 일정을 찾을 수 없습니다.");
    }

    if (!slot.is_confirmed) {
      return actionError("확정된 일정만 크기를 조절할 수 있습니다.");
    }

    await assertSlotCanBeConfirmed(
      admin,
      event,
      slot,
      slot.reservation_id,
      timeRange,
    );

    const { data, error } = await admin
      .from("reservation_slots")
      .update({
        confirmed_end_at: timeRange.endAt,
        confirmed_start_at: timeRange.startAt,
      })
      .eq("id", slot.id)
      .select(
        "id,start_at,end_at,confirmed_start_at,confirmed_end_at,is_confirmed,priority_order",
      )
      .single();

    if (error || !data) {
      return actionError("확정 일정을 저장할 수 없습니다.");
    }

    await moveCustomBufferOverridesForSlot(admin, event, slot, timeRange);

    revalidatePath(`/host/events/${event.id}`);
    revalidatePath(`/event/${event.event_code}`);

    return actionOk({ slot: data });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<ActionResult<CreateReservationData>> {
  let supabase: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let reservationId: string | null = null;

  try {
    supabase = createSupabaseAdminClient();
    const currentUserId = await getCurrentUserId();
    const payload = parseCreateReservationInput(input);
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id,event_code")
      .eq("id", payload.eventId)
      .single();

    if (eventError || !event) {
      return actionError("예약할 이벤트를 찾을 수 없습니다.");
    }

    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .insert({
        creator_id: currentUserId,
        event_id: event.id,
        headcount: payload.headcount,
        password_hash: hashReservationPassword(payload.password ?? ""),
      })
      .select("*")
      .single();

    if (reservationError || !reservation) {
      return actionError(reservationError?.message ?? "예약 생성에 실패했습니다.");
    }

    reservationId = reservation.id;

    const participants = buildParticipantRows(
      payload.participants,
      reservation.id,
      currentUserId,
    );
    const slots = payload.requestedSlots.map((slot, index) => ({
      end_at: slot.endAt,
      event_id: event.id,
      priority_order: index + 1,
      reservation_id: reservation.id,
      start_at: slot.startAt,
    }));

    const { error: participantsError } = await supabase
      .from("reservation_participants")
      .insert(participants);

    if (participantsError) {
      throw new Error(participantsError.message);
    }

    const { error: slotsError } = await supabase
      .from("reservation_slots")
      .insert(slots);

    if (slotsError) {
      throw new Error(slotsError.message);
    }

    const reservationGroup = await getReservationGroupById(reservation.id);

    revalidateReservationPaths(
      reservation.reservation_access_code,
      event.event_code,
      event.id,
    );

    return actionOk({ reservation: reservationGroup });
  } catch (error) {
    if (reservationId && supabase) {
      await supabase.from("reservations").delete().eq("id", reservationId);
    }

    return actionError(getErrorMessage(error));
  }
}

export type UpdateReservationGroupInput = {
  headcount?: number;
  participants?: ParticipantDraft[];
  password?: string | null;
  requestedSlots?: TimeRange[];
  reservationAccessCode: string;
};

export type UpdateReservationGroupData = {
  reservation: PublicReservationGroup;
};

export async function updateReservationGroup(
  input: UpdateReservationGroupInput,
): Promise<ActionResult<UpdateReservationGroupData>> {
  try {
    const supabase = createSupabaseAdminClient();
    const currentUserId = await getCurrentUserId();
    const payload = parseUpdateReservationGroupInput(input);
    const reservation = await getReservationByAccessCode(
      payload.reservationAccessCode,
    );

    if (reservation.status === "REJECTED" || reservation.status === "CANCELLED") {
      return actionError("수정할 수 없는 예약 상태입니다.");
    }

    if (
      reservation.password_hash &&
      !canManageReservationAsCreator(reservation, currentUserId) &&
      !verifyReservationPassword(payload.password ?? "", reservation.password_hash)
    ) {
      return actionError("예약 비밀번호가 일치하지 않습니다.");
    }

    const effectiveHeadcount = payload.headcount ?? reservation.headcount;

    if (
      payload.participants &&
      payload.participants.length > effectiveHeadcount
    ) {
      return actionError("참여자 수는 총 인원수를 초과할 수 없습니다.");
    }

    if (payload.headcount !== undefined && !payload.participants) {
      const participantCount = await countReservationParticipants(reservation.id);

      if (participantCount > payload.headcount) {
        return actionError("총 인원수가 현재 참여자 수보다 작을 수 없습니다.");
      }
    }

    if (payload.headcount !== undefined) {
      const { error } = await supabase
        .from("reservations")
        .update({ headcount: payload.headcount })
        .eq("id", reservation.id);

      if (error) {
        return actionError(error.message);
      }
    }

    if (payload.participants) {
      const { error: deleteError } = await supabase
        .from("reservation_participants")
        .delete()
        .eq("reservation_id", reservation.id);

      if (deleteError) {
        return actionError(deleteError.message);
      }

      const { error: insertError } = await supabase
        .from("reservation_participants")
        .insert(
          buildParticipantRows(
            payload.participants,
            reservation.id,
            currentUserId,
          ),
        );

      if (insertError) {
        return actionError(insertError.message);
      }
    }

    if (payload.requestedSlots) {
      const confirmedSlots =
        reservation.status === "APPROVED"
          ? await getConfirmedReservationSlots(supabase, reservation.id)
          : [];
      const { error: deleteError } =
        reservation.status === "APPROVED"
          ? await supabase
              .from("reservation_slots")
              .delete()
              .eq("reservation_id", reservation.id)
              .eq("is_confirmed", false)
          : await supabase
              .from("reservation_slots")
              .delete()
              .eq("reservation_id", reservation.id);

      if (deleteError) {
        return actionError(deleteError.message);
      }

      const requestedSlots = payload.requestedSlots.filter(
        (slot) => !confirmedSlots.some((confirmedSlot) =>
          isSameSlotCandidateRange(confirmedSlot, slot),
        ),
      );

      if (requestedSlots.length === 0) {
        await normalizeReservationSlotPriorities(supabase, reservation.id);

        const reservationGroup = await getReservationGroupById(reservation.id);
        const eventCode = await getEventCodeById(reservation.event_id);

        revalidateReservationPaths(
          reservation.reservation_access_code,
          eventCode,
          reservation.event_id,
        );

        return actionOk({ reservation: reservationGroup });
      }

      const { error: insertError } = await supabase
        .from("reservation_slots")
        .insert(
          requestedSlots.map((slot, index) => ({
            end_at: slot.endAt,
            event_id: reservation.event_id,
            priority_order: confirmedSlots.length + index + 1,
            reservation_id: reservation.id,
            start_at: slot.startAt,
          })),
        );

      if (insertError) {
        return actionError(insertError.message);
      }

      await normalizeReservationSlotPriorities(supabase, reservation.id);
    }

    const reservationGroup = await getReservationGroupById(reservation.id);
    const eventCode = await getEventCodeById(reservation.event_id);

    revalidateReservationPaths(
      reservation.reservation_access_code,
      eventCode,
      reservation.event_id,
    );

    return actionOk({ reservation: reservationGroup });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type CancelReservationGroupInput = {
  password?: string | null;
  reservationAccessCode: string;
};

export type CancelReservationGroupData = {
  reservation: PublicReservationGroup;
};

export async function cancelReservationGroup(
  input: CancelReservationGroupInput,
): Promise<ActionResult<CancelReservationGroupData>> {
  try {
    const supabase = createSupabaseAdminClient();
    const reservationAccessCode = requireReservationAccessCode(
      input.reservationAccessCode,
    );
    const password = optionalText(input.password, 100);
    const currentUserId = await getCurrentUserId();
    const reservation = await getReservationByAccessCode(reservationAccessCode);

    if (reservation.status === "CANCELLED") {
      return actionError("이미 취소된 예약입니다.");
    }

    if (reservation.status === "REJECTED") {
      return actionError("거절된 예약은 취소할 수 없습니다.");
    }

    if (
      reservation.password_hash &&
      !canManageReservationAsCreator(reservation, currentUserId) &&
      !verifyReservationPassword(password ?? "", reservation.password_hash)
    ) {
      return actionError("예약 비밀번호가 일치하지 않습니다.");
    }

    const { error: slotsError } = await supabase
      .from("reservation_slots")
      .update({
        confirmed_end_at: null,
        confirmed_start_at: null,
        is_confirmed: false,
      })
      .eq("reservation_id", reservation.id);

    if (slotsError) {
      return actionError(slotsError.message);
    }

    const { error: reservationError } = await supabase
      .from("reservations")
      .update({ status: "CANCELLED" })
      .eq("id", reservation.id);

    if (reservationError) {
      return actionError(reservationError.message);
    }

    const reservationGroup = await getReservationGroupById(reservation.id);
    const eventCode = await getEventCodeById(reservation.event_id);

    revalidateReservationPaths(
      reservation.reservation_access_code,
      eventCode,
      reservation.event_id,
    );

    return actionOk({ reservation: reservationGroup });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

function parseCreateReservationInput(input: CreateReservationInput) {
  const eventId = requireUuid(input.eventId, "eventId");
  const headcount = requireInteger(input.headcount, "headcount", 1, 30);
  const participants = requireParticipants(input.participants);
  const requestedSlots = requireTimeRanges(input.requestedSlots, "requestedSlots");
  const password = optionalText(input.password, 100);

  if (participants.length > headcount) {
    throw new Error("participants cannot exceed headcount.");
  }

  if (requestedSlots.length === 0 || requestedSlots.length > 20) {
    throw new Error("requestedSlots must include 1-20 time ranges.");
  }

  return {
    eventId,
    headcount,
    participants,
    password,
    requestedSlots,
  };
}

function parseUpdateReservationGroupInput(input: UpdateReservationGroupInput) {
  const reservationAccessCode = requireReservationAccessCode(
    input.reservationAccessCode,
  );
  const headcount =
    input.headcount === undefined
      ? undefined
      : requireInteger(input.headcount, "headcount", 1, 30);
  const participants =
    input.participants === undefined
      ? undefined
      : requireParticipants(input.participants);
  const requestedSlots =
    input.requestedSlots === undefined
      ? undefined
      : requireTimeRanges(input.requestedSlots, "requestedSlots");
  const password = optionalText(input.password, 100);

  if (headcount !== undefined && participants && participants.length > headcount) {
    throw new Error("participants cannot exceed headcount.");
  }

  if (requestedSlots && requestedSlots.length > 20) {
    throw new Error("requestedSlots can include up to 20 time ranges.");
  }

  return {
    headcount,
    participants,
    password,
    requestedSlots,
    reservationAccessCode,
  };
}

function parseReviewReservationInput(input: ReviewReservationInput) {
  const eventId = requireUuid(input.eventId, "eventId");
  const reservationId = requireUuid(input.reservationId, "reservationId");
  const confirmedSlotId =
    input.confirmedSlotId === null || input.confirmedSlotId === undefined
      ? null
      : requireUuid(input.confirmedSlotId, "confirmedSlotId");

  if (
    input.status !== "APPROVED" &&
    input.status !== "PENDING" &&
    input.status !== "REJECTED"
  ) {
    throw new Error("status must be APPROVED, PENDING, or REJECTED.");
  }

  return {
    confirmedSlotId,
    eventId,
    reservationId,
    status: input.status,
  };
}

function buildParticipantRows(
  participants: ParticipantDraft[],
  reservationId: string,
  currentUserId: string | null,
) {
  return participants.map((participant, index) => ({
    guest_name: participant.guestName,
    is_creator: index === 0,
    reservation_id: reservationId,
    user_id:
      currentUserId && (index === 0 || participant.userId === currentUserId)
        ? currentUserId
        : null,
  }));
}

function canManageReservationAsCreator(
  reservation: Pick<Tables<"reservations">, "creator_id">,
  currentUserId: string | null,
) {
  return Boolean(currentUserId && reservation.creator_id === currentUserId);
}

async function getCurrentUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

async function getReservationByAccessCode(reservationAccessCode: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("reservation_access_code", reservationAccessCode)
    .single();

  if (error || !data) {
    throw new Error("예약을 찾을 수 없습니다.");
  }

  return data;
}

async function getReservationById(
  supabase: AdminSupabaseClient,
  reservationId: string,
) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .single();

  if (error || !data) {
    throw new Error("예약을 찾을 수 없습니다.");
  }

  return data;
}

async function getReservationGroupsForEvent(
  supabase: AdminSupabaseClient,
  eventId: string,
) {
  const { data: reservations, error: reservationsError } = await supabase
    .from("reservations")
    .select(
      "id,event_id,creator_id,reservation_access_code,headcount,status,created_at,updated_at",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (reservationsError) {
    throw new Error(reservationsError.message);
  }

  if (!reservations?.length) {
    return [];
  }

  const reservationIds = reservations.map((reservation) => reservation.id);
  const { data: participants, error: participantsError } = await supabase
    .from("reservation_participants")
    .select("id,reservation_id,user_id,guest_name,is_creator")
    .in("reservation_id", reservationIds)
    .order("created_at", { ascending: true });

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  const { data: slots, error: slotsError } = await supabase
    .from("reservation_slots")
    .select(
      "id,reservation_id,start_at,end_at,confirmed_start_at,confirmed_end_at,is_confirmed,priority_order",
    )
    .in("reservation_id", reservationIds)
    .order("priority_order", { ascending: true })
    .order("start_at", { ascending: true });

  if (slotsError) {
    throw new Error(slotsError.message);
  }

  return reservations.map<HostReservationGroup>((reservation) => ({
    ...reservation,
    participants:
      participants
        ?.filter((participant) => participant.reservation_id === reservation.id)
        .map((participant) => ({
          guest_name: participant.guest_name,
          id: participant.id,
          is_creator: participant.is_creator,
          user_id: participant.user_id,
        })) ??
      [],
    slots:
      slots
        ?.filter((slot) => slot.reservation_id === reservation.id)
        .map((slot) => ({
          confirmed_end_at: slot.confirmed_end_at,
          confirmed_start_at: slot.confirmed_start_at,
          end_at: slot.end_at,
          id: slot.id,
          is_confirmed: slot.is_confirmed,
          priority_order: slot.priority_order,
          start_at: slot.start_at,
        })) ?? [],
  }));
}

async function getPublicEventById(
  supabase: AdminSupabaseClient,
  eventId: string,
): Promise<PublicEvent> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id,event_code,title,description,date_start,date_end,daily_start_time,daily_end_time,timezone,buffer_time_minutes,is_buffer_active,is_buffer_before_active,is_buffer_after_active",
    )
    .eq("id", eventId)
    .single();

  if (error || !data) {
    throw new Error("이벤트 정보를 불러오지 못했습니다.");
  }

  return data;
}

async function getTimeBlocksForEvent(
  supabase: AdminSupabaseClient,
  eventId: string,
) {
  const { data, error } = await supabase
    .from("time_blocks")
    .select("*")
    .eq("event_id", eventId)
    .order("start_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function getEventScheduleSlotsForEvent(
  supabase: AdminSupabaseClient,
  eventId: string,
) {
  const { data: slots, error: slotsError } = await supabase
    .from("reservation_slots")
    .select(
      "id,reservation_id,start_at,end_at,confirmed_start_at,confirmed_end_at,is_confirmed,priority_order",
    )
    .eq("event_id", eventId)
    .order("priority_order", { ascending: true })
    .order("start_at", { ascending: true });

  if (slotsError) {
    throw new Error(slotsError.message);
  }

  if (!slots?.length) {
    return [];
  }

  const reservationIds = [
    ...new Set(slots.map((slot) => slot.reservation_id)),
  ];
  const { data: reservations, error: reservationsError } = await supabase
    .from("reservations")
    .select("id,status,headcount,reservation_access_code")
    .in("id", reservationIds);

  if (reservationsError) {
    throw new Error(reservationsError.message);
  }

  const statusByReservationId = new Map(
    reservations?.map((reservation) => [reservation.id, reservation.status]) ?? [],
  );
  const reservationById = new Map(
    reservations?.map((reservation) => [reservation.id, reservation]) ?? [],
  );
  const { data: participants, error: participantsError } = await supabase
    .from("reservation_participants")
    .select("reservation_id,guest_name")
    .in("reservation_id", reservationIds)
    .order("created_at", { ascending: true });

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  return slots.flatMap<EventScheduleSlot>((slot) => {
    const reservationStatus =
      statusByReservationId.get(slot.reservation_id) ?? "PENDING";
    const reservation = reservationById.get(slot.reservation_id);

    if (reservationStatus === "REJECTED" || reservationStatus === "CANCELLED") {
      return [];
    }

    return [
      {
        confirmed_end_at: slot.confirmed_end_at,
        confirmed_start_at: slot.confirmed_start_at,
        end_at: slot.end_at,
        headcount: reservation?.headcount ?? 1,
        id: slot.id,
        is_confirmed: slot.is_confirmed,
        priority_order: slot.priority_order,
        participantNames:
          participants
            ?.filter(
              (participant) =>
                participant.reservation_id === slot.reservation_id,
            )
            .map((participant) => participant.guest_name) ?? [],
        reservationAccessCode: reservation?.reservation_access_code ?? "",
        reservation_id: slot.reservation_id,
        reservationStatus,
        start_at: slot.start_at,
      },
    ];
  });
}

async function getReservationGroupById(reservationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select(
      "id,event_id,creator_id,reservation_access_code,headcount,status,created_at,updated_at",
    )
    .eq("id", reservationId)
    .single();

  if (reservationError || !reservation) {
    throw new Error("예약 정보를 불러오지 못했습니다.");
  }

  const { data: participants, error: participantsError } = await supabase
    .from("reservation_participants")
    .select("id,user_id,guest_name,is_creator")
    .eq("reservation_id", reservation.id)
    .order("created_at", { ascending: true });

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  const { data: slots, error: slotsError } = await supabase
    .from("reservation_slots")
    .select(
      "id,start_at,end_at,confirmed_start_at,confirmed_end_at,is_confirmed,priority_order",
    )
    .eq("reservation_id", reservation.id)
    .order("priority_order", { ascending: true })
    .order("start_at", { ascending: true });

  if (slotsError) {
    throw new Error(slotsError.message);
  }

  return {
    ...reservation,
    participants: participants ?? [],
    slots: slots ?? [],
  };
}

async function getReservationSlot(
  supabase: AdminSupabaseClient,
  reservationId: string,
  slotId: string,
) {
  const { data, error } = await supabase
    .from("reservation_slots")
    .select("*")
    .eq("id", slotId)
    .eq("reservation_id", reservationId)
    .single();

  if (error || !data) {
    throw new Error("승인할 후보 시간을 찾을 수 없습니다.");
  }

  return data;
}

async function getConfirmedReservationSlots(
  supabase: AdminSupabaseClient,
  reservationId: string,
) {
  const { data, error } = await supabase
    .from("reservation_slots")
    .select("*")
    .eq("reservation_id", reservationId)
    .eq("is_confirmed", true);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function clearReservationConfirmedSlots(
  supabase: AdminSupabaseClient,
  reservationId: string,
) {
  const { error } = await supabase
    .from("reservation_slots")
    .update({
      confirmed_end_at: null,
      confirmed_start_at: null,
      is_confirmed: false,
    })
    .eq("reservation_id", reservationId);

  if (error) {
    throw new Error(error.message);
  }
}

function isSameSlotCandidateRange(
  slot: Pick<Tables<"reservation_slots">, "end_at" | "start_at">,
  range: TimeRange,
) {
  return slot.start_at === range.startAt && slot.end_at === range.endAt;
}

async function getHostEventContext(eventId: string) {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await serverSupabase.auth.getUser();

  if (userError || !user) {
    throw new Error("로그인한 Host만 예약을 처리할 수 있습니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data: event, error: eventError } = await admin
    .from("events")
    .select(
      "id,event_code,host_id,buffer_time_minutes,is_buffer_active,is_buffer_before_active,is_buffer_after_active",
    )
    .eq("id", eventId)
    .single();

  if (eventError || !event || event.host_id !== user.id) {
    throw new Error("이 이벤트의 Host만 예약을 처리할 수 있습니다.");
  }

  return { admin, event };
}

async function assertSlotCanBeConfirmed(
  supabase: AdminSupabaseClient,
  event: Pick<
    Tables<"events">,
    | "buffer_time_minutes"
    | "id"
    | "is_buffer_active"
    | "is_buffer_after_active"
    | "is_buffer_before_active"
  >,
  slot: Tables<"reservation_slots">,
  reservationId: string,
  overrideRange?: TimeRange,
) {
  const slotRange = overrideRange ?? getSlotDisplayRange(slot);
  const { data: timeBlocks, error: timeBlocksError } = await supabase
    .from("time_blocks")
    .select("start_at,end_at,type")
    .eq("event_id", event.id);

  if (timeBlocksError) {
    throw new Error(timeBlocksError.message);
  }

  const { data: confirmedSlots, error: confirmedSlotsError } = await supabase
    .from("reservation_slots")
    .select(
      "id,reservation_id,start_at,end_at,confirmed_start_at,confirmed_end_at,is_confirmed",
    )
    .eq("event_id", event.id)
    .eq("is_confirmed", true)
    .neq("reservation_id", reservationId);

  if (confirmedSlotsError) {
    throw new Error(confirmedSlotsError.message);
  }

  const { data: bufferOverrides, error: bufferOverridesError } = await supabase
    .from("event_buffer_overrides")
    .select(
      "reservation_slot_id,side,is_active,custom_start_at,custom_end_at",
    )
    .eq("event_id", event.id);

  if (bufferOverridesError) {
    throw new Error(bufferOverridesError.message);
  }

  const bufferOverrideByKey = new Map(
    bufferOverrides?.map((override) => [
      getBufferOverrideKey(
        override.reservation_slot_id,
        override.side as "AFTER" | "BEFORE",
      ),
      override,
    ]) ?? [],
  );
  const confirmedSlotRanges =
    confirmedSlots?.map((confirmedSlot) => ({
      ...getSlotDisplayRange(confirmedSlot),
      id: confirmedSlot.id,
    })) ?? [];
  const confirmedOrBufferRanges: TimeRange[] = [
    ...confirmedSlotRanges.map(({ endAt, startAt }) => ({ endAt, startAt })),
    ...buildBufferTimeRangeItems(
      confirmedSlotRanges,
      event.buffer_time_minutes,
      {
        afterActive: true,
        beforeActive: true,
      },
    ).flatMap((bufferItem) => {
      const override = bufferOverrideByKey.get(bufferItem.id);
      const globallyActive =
        event.is_buffer_active &&
        (bufferItem.side === "BEFORE"
          ? event.is_buffer_before_active
          : event.is_buffer_after_active);
      const isActive = override ? override.is_active : globallyActive;

      if (!isActive) {
        return [];
      }

      return [
        {
          endAt: override?.custom_end_at ?? bufferItem.endAt,
          startAt: override?.custom_start_at ?? bufferItem.startAt,
        },
      ];
    }),
  ];
  const blockReason = getCandidateSlotBlockReason({
    candidate: slotRange,
    confirmedOrBufferRanges,
    confirmedRanges:
      confirmedSlotRanges.map(({ endAt, startAt }) => ({ endAt, startAt })),
    timeBlocks:
      timeBlocks?.map((block) => ({
        endAt: block.end_at,
        startAt: block.start_at,
        type: block.type,
      })) ?? [],
  });

  if (blockReason && blockReason !== "OUTSIDE_AVAILABLE") {
    throw new Error(getCandidateSlotBlockMessage(blockReason));
  }
}

async function moveCustomBufferOverridesForSlot(
  supabase: AdminSupabaseClient,
  event: Pick<Tables<"events">, "buffer_time_minutes" | "id">,
  slot: Tables<"reservation_slots">,
  nextRange: TimeRange,
) {
  const defaultDuration = event.buffer_time_minutes * 60_000;

  if (defaultDuration <= 0) {
    return;
  }

  const { data: overrides, error } = await supabase
    .from("event_buffer_overrides")
    .select("id,side,is_active,custom_start_at,custom_end_at")
    .eq("event_id", event.id)
    .eq("reservation_slot_id", slot.id);

  if (error) {
    throw new Error(error.message);
  }

  const updates =
    overrides
      ?.filter((override) => override.is_active)
      .map((override) => {
        const customDuration =
          override.custom_start_at && override.custom_end_at
            ? new Date(override.custom_end_at).getTime() -
              new Date(override.custom_start_at).getTime()
            : defaultDuration;
        const duration =
          customDuration > 0
            ? Math.min(customDuration, defaultDuration)
            : defaultDuration;

        if (override.side === "BEFORE") {
          const customEndAt = nextRange.startAt;

          return supabase
            .from("event_buffer_overrides")
            .update({
              custom_end_at: customEndAt,
              custom_start_at: new Date(
                new Date(customEndAt).getTime() - duration,
              ).toISOString(),
            })
            .eq("id", override.id);
        }

        const customStartAt = nextRange.endAt;

        return supabase
          .from("event_buffer_overrides")
          .update({
            custom_end_at: new Date(
              new Date(customStartAt).getTime() + duration,
            ).toISOString(),
            custom_start_at: customStartAt,
          })
          .eq("id", override.id);
      })
      .filter(Boolean) ?? [];

  await Promise.all(updates);
}

function getCandidateSlotBlockMessage(reason: CandidateSlotBlockReason) {
  if (reason === "BLOCKED_TIME") {
    return "Host가 막아둔 시간은 승인할 수 없습니다.";
  }

  if (reason === "OUTSIDE_AVAILABLE") {
    return "Host 가능 시간 안에 있는 후보만 승인할 수 있습니다.";
  }

  return "이미 확정된 예약 또는 버퍼 타임과 겹칩니다.";
}

async function countReservationParticipants(reservationId: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("reservation_participants")
    .select("id", { count: "exact", head: true })
    .eq("reservation_id", reservationId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function getEventCodeById(eventId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select("event_code")
    .eq("id", eventId)
    .single();

  if (error || !data) {
    throw new Error("이벤트 정보를 불러오지 못했습니다.");
  }

  return data.event_code;
}

function revalidateReservationPaths(
  reservationAccessCode: string,
  eventCode: string,
  eventId?: string,
) {
  revalidatePath(`/reservations/${reservationAccessCode}`);
  revalidatePath(`/event/${eventCode}`);
  if (eventId) {
    revalidatePath(`/host/events/${eventId}`);
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server action error.";
}
