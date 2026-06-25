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
import {
  optionalText,
  requireInteger,
  requireParticipants,
  requireReservationAccessCode,
  requireTimeRanges,
  requireUuid,
} from "@/lib/validators/action-inputs";
import type { PublicEvent } from "@/app/actions/events";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import type { ParticipantDraft, ReservationStatus, TimeRange } from "@/types/domain";

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export type ReservationParticipant = Pick<
  Tables<"reservation_participants">,
  "guest_name" | "id" | "is_creator" | "user_id"
>;

export type ReservationSlot = Pick<
  Tables<"reservation_slots">,
  "end_at" | "id" | "is_confirmed" | "start_at"
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
    const [reservationGroup, event, timeBlocks, reservationSlots] =
      await Promise.all([
        getReservationGroupById(reservation.id),
        getPublicEventById(supabase, reservation.event_id),
        getTimeBlocksForEvent(supabase, reservation.event_id),
        getEventScheduleSlotsForEvent(supabase, reservation.event_id),
      ]);

    return actionOk({
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
  status: Extract<ReservationStatus, "APPROVED" | "REJECTED">;
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
      const { error: slotsError } = await admin
        .from("reservation_slots")
        .update({ is_confirmed: false })
        .eq("reservation_id", reservation.id);

      if (slotsError) {
        return actionError(slotsError.message);
      }

      const { error: reservationError } = await admin
        .from("reservations")
        .update({ status: "REJECTED" })
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

      const { error: clearError } = await admin
        .from("reservation_slots")
        .update({ is_confirmed: false })
        .eq("reservation_id", reservation.id);

      if (clearError) {
        return actionError(clearError.message);
      }

      const { error: slotError } = await admin
        .from("reservation_slots")
        .update({ is_confirmed: true })
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
    const slots = payload.requestedSlots.map((slot) => ({
      end_at: slot.endAt,
      event_id: event.id,
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

    if (reservation.status === "APPROVED" && payload.requestedSlots) {
      return actionError("승인된 예약의 시간 후보는 변경할 수 없습니다.");
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
      const { error: deleteError } = await supabase
        .from("reservation_slots")
        .delete()
        .eq("reservation_id", reservation.id);

      if (deleteError) {
        return actionError(deleteError.message);
      }

      const { error: insertError } = await supabase
        .from("reservation_slots")
        .insert(
          payload.requestedSlots.map((slot) => ({
            end_at: slot.endAt,
            event_id: reservation.event_id,
            reservation_id: reservation.id,
            start_at: slot.startAt,
          })),
        );

      if (insertError) {
        return actionError(insertError.message);
      }
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
      .update({ is_confirmed: false })
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

  if (requestedSlots && (requestedSlots.length === 0 || requestedSlots.length > 20)) {
    throw new Error("requestedSlots must include 1-20 time ranges.");
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

  if (input.status !== "APPROVED" && input.status !== "REJECTED") {
    throw new Error("status must be APPROVED or REJECTED.");
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
    .select("id,reservation_id,start_at,end_at,is_confirmed")
    .in("reservation_id", reservationIds)
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
          end_at: slot.end_at,
          id: slot.id,
          is_confirmed: slot.is_confirmed,
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
      "id,event_code,title,description,date_start,date_end,daily_start_time,daily_end_time,timezone,buffer_time_minutes,is_buffer_active",
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
    .select("id,reservation_id,start_at,end_at,is_confirmed")
    .eq("event_id", eventId)
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
    .select("id,status")
    .in("id", reservationIds);

  if (reservationsError) {
    throw new Error(reservationsError.message);
  }

  const statusByReservationId = new Map(
    reservations?.map((reservation) => [reservation.id, reservation.status]) ?? [],
  );

  return slots.flatMap<EventScheduleSlot>((slot) => {
    const reservationStatus =
      statusByReservationId.get(slot.reservation_id) ?? "PENDING";

    if (reservationStatus === "REJECTED" || reservationStatus === "CANCELLED") {
      return [];
    }

    return [
      {
        end_at: slot.end_at,
        id: slot.id,
        is_confirmed: slot.is_confirmed,
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
    .select("id,start_at,end_at,is_confirmed")
    .eq("reservation_id", reservation.id)
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
      "id,event_code,host_id,buffer_time_minutes,is_buffer_active",
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
    "buffer_time_minutes" | "id" | "is_buffer_active"
  >,
  slot: Tables<"reservation_slots">,
  reservationId: string,
) {
  const slotRange = {
    endAt: slot.end_at,
    startAt: slot.start_at,
  };
  const { data: timeBlocks, error: timeBlocksError } = await supabase
    .from("time_blocks")
    .select("start_at,end_at,type")
    .eq("event_id", event.id);

  if (timeBlocksError) {
    throw new Error(timeBlocksError.message);
  }

  const { data: confirmedSlots, error: confirmedSlotsError } = await supabase
    .from("reservation_slots")
    .select("id,reservation_id,start_at,end_at")
    .eq("event_id", event.id)
    .eq("is_confirmed", true)
    .neq("reservation_id", reservationId);

  if (confirmedSlotsError) {
    throw new Error(confirmedSlotsError.message);
  }

  const bufferMinutes = event.is_buffer_active ? event.buffer_time_minutes : 0;
  const blockReason = getCandidateSlotBlockReason({
    bufferMinutes,
    candidate: slotRange,
    confirmedRanges:
      confirmedSlots?.map((confirmedSlot) => ({
        endAt: confirmedSlot.end_at,
        startAt: confirmedSlot.start_at,
      })) ?? [],
    timeBlocks:
      timeBlocks?.map((block) => ({
        endAt: block.end_at,
        startAt: block.start_at,
        type: block.type,
      })) ?? [],
  });

  if (blockReason) {
    throw new Error(getCandidateSlotBlockMessage(blockReason));
  }
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
