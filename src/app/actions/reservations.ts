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
  optionalText,
  requireInteger,
  requireParticipants,
  requireReservationAccessCode,
  requireTimeRanges,
  requireUuid,
} from "@/lib/validators/action-inputs";
import type { ParticipantDraft, TimeRange } from "@/types/domain";

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

    revalidateReservationPaths(reservation.reservation_access_code, eventCode);

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

function revalidateReservationPaths(reservationAccessCode: string, eventCode: string) {
  revalidatePath(`/reservations/${reservationAccessCode}`);
  revalidatePath(`/event/${eventCode}`);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server action error.";
}
