import { revalidatePath } from "next/cache";
import {
  mobileError,
  mobileOk,
  readJsonBody,
} from "@/lib/mobile/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile/auth";
import { verifyReservationPassword } from "@/lib/security/passwords";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import {
  optionalText,
  requireInteger,
  requireParticipants,
  requireReservationAccessCode,
  requireTimeRanges,
} from "@/lib/validators/action-inputs";
import type { ParticipantDraft, TimeRange } from "@/types/domain";

type ReservationRouteProps = {
  params: Promise<{
    accessCode: string;
  }>;
};

type UpdateMobileReservationBody = {
  headcount?: number;
  participants?: ParticipantDraft[];
  password?: string | null;
  requestedSlots?: TimeRange[];
};

type CancelMobileReservationBody = {
  password?: string | null;
};

type MobileReservationRecord = Tables<"reservations">;

export async function GET(request: Request, { params }: ReservationRouteProps) {
  try {
    const { accessCode } = await params;
    const user = await getMobileUserFromRequest(request);

    return mobileOk(await buildReservationManagementView(accessCode, user?.id));
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "예약 정보를 불러오지 못했습니다.",
      500,
    );
  }
}

export async function PUT(request: Request, { params }: ReservationRouteProps) {
  try {
    const { accessCode } = await params;
    const user = await getMobileUserFromRequest(request);
    const body = await readJsonBody<UpdateMobileReservationBody>(request);
    const admin = createSupabaseAdminClient();
    const reservation = await getReservationByAccessCode(accessCode);
    const payload = parseUpdateBody(body);

    assertReservationEditable(reservation);
    assertReservationPassword(reservation, user?.id, payload.password);

    const effectiveHeadcount = payload.headcount ?? reservation.headcount;

    if (
      payload.participants &&
      payload.participants.length > effectiveHeadcount
    ) {
      return mobileError("참여자 수는 총 인원수를 초과할 수 없습니다.");
    }

    if (payload.headcount !== undefined) {
      const { error } = await admin
        .from("reservations")
        .update({ headcount: payload.headcount })
        .eq("id", reservation.id);

      if (error) {
        return mobileError(error.message);
      }
    }

    if (payload.participants) {
      const { error: deleteError } = await admin
        .from("reservation_participants")
        .delete()
        .eq("reservation_id", reservation.id);

      if (deleteError) {
        return mobileError(deleteError.message);
      }

      const { error: insertError } = await admin
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

      if (insertError) {
        return mobileError(insertError.message);
      }
    }

    if (payload.requestedSlots) {
      await replaceReservationSlots(admin, reservation, payload.requestedSlots);
    }

    await revalidateReservation(reservation);

    return mobileOk(
      await buildReservationManagementView(
        reservation.reservation_access_code,
        user?.id,
      ),
    );
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "예약 정보를 저장하지 못했습니다.",
      500,
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: ReservationRouteProps,
) {
  try {
    const { accessCode } = await params;
    const user = await getMobileUserFromRequest(request);
    const body = await readJsonBody<CancelMobileReservationBody>(request);
    const admin = createSupabaseAdminClient();
    const reservation = await getReservationByAccessCode(accessCode);

    if (reservation.status === "CANCELLED") {
      return mobileError("이미 취소된 예약입니다.");
    }

    if (reservation.status === "REJECTED") {
      return mobileError("거절된 예약은 취소할 수 없습니다.");
    }

    assertReservationPassword(
      reservation,
      user?.id,
      optionalText(body.password, 100),
    );

    const { error: slotsError } = await admin
      .from("reservation_slots")
      .update({
        confirmed_end_at: null,
        confirmed_start_at: null,
        is_confirmed: false,
      })
      .eq("reservation_id", reservation.id);

    if (slotsError) {
      return mobileError(slotsError.message);
    }

    const { error: reservationError } = await admin
      .from("reservations")
      .update({ status: "CANCELLED" })
      .eq("id", reservation.id);

    if (reservationError) {
      return mobileError(reservationError.message);
    }

    await revalidateReservation(reservation);

    return mobileOk(
      await buildReservationManagementView(
        reservation.reservation_access_code,
        user?.id,
      ),
    );
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "예약을 취소하지 못했습니다.",
      500,
    );
  }
}

async function buildReservationManagementView(
  accessCode: string,
  userId?: string,
) {
  const reservationAccessCode = requireReservationAccessCode(accessCode);
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
    getPublicEventById(reservation.event_id),
    listTimeBlocksForEvent(reservation.event_id),
    listReservationSlotsForEvent(reservation.event_id),
    listActiveDates(reservation.event_id),
    listBufferOverrides(reservation.event_id),
  ]);

  return {
    activeDates,
    bufferOverrides,
    event,
    passwordRequired:
      Boolean(reservation.password_hash) && reservation.creator_id !== userId,
    reservation: reservationGroup,
    reservationSlots,
    timeBlocks,
  };
}

async function getReservationByAccessCode(accessCode: string) {
  const reservationAccessCode = requireReservationAccessCode(accessCode);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
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
  const admin = createSupabaseAdminClient();
  const { data: reservation, error: reservationError } = await admin
    .from("reservations")
    .select(
      "id,event_id,creator_id,reservation_access_code,headcount,status,created_at,updated_at",
    )
    .eq("id", reservationId)
    .single();

  if (reservationError || !reservation) {
    throw new Error("예약 정보를 불러오지 못했습니다.");
  }

  const { data: participants, error: participantsError } = await admin
    .from("reservation_participants")
    .select("id,user_id,guest_name,is_creator")
    .eq("reservation_id", reservation.id)
    .order("created_at", { ascending: true });

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  const { data: slots, error: slotsError } = await admin
    .from("reservation_slots")
    .select(
      "id,reservation_id,start_at,end_at,confirmed_start_at,confirmed_end_at,is_confirmed,priority_order",
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

async function getPublicEventById(eventId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
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

async function listTimeBlocksForEvent(eventId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("time_blocks")
    .select("id,event_id,start_at,end_at,type,note")
    .eq("event_id", eventId)
    .order("start_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listReservationSlotsForEvent(eventId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("reservation_slots")
    .select(
      "id,reservation_id,start_at,end_at,confirmed_start_at,confirmed_end_at,is_confirmed,priority_order",
    )
    .eq("event_id", eventId)
    .order("priority_order", { ascending: true })
    .order("start_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listActiveDates(eventId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("event_active_dates")
    .select("active_date")
    .eq("event_id", eventId)
    .order("active_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data?.map((row) => row.active_date) ?? [];
}

async function listBufferOverrides(eventId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("event_buffer_overrides")
    .select(
      "reservation_slot_id,side,is_active,custom_start_at,custom_end_at",
    )
    .eq("event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

function parseUpdateBody(body: UpdateMobileReservationBody) {
  const headcount =
    body.headcount === undefined
      ? undefined
      : requireInteger(body.headcount, "headcount", 1, 30);
  const participants =
    body.participants === undefined
      ? undefined
      : requireParticipants(body.participants);
  const requestedSlots =
    body.requestedSlots === undefined
      ? undefined
      : requireTimeRanges(body.requestedSlots, "requestedSlots");
  const password = optionalText(body.password, 100);

  if (requestedSlots && requestedSlots.length > 20) {
    throw new Error("예약 후보는 20개까지 선택할 수 있습니다.");
  }

  return {
    headcount,
    participants,
    password,
    requestedSlots,
  };
}

function assertReservationEditable(reservation: MobileReservationRecord) {
  if (reservation.status === "REJECTED" || reservation.status === "CANCELLED") {
    throw new Error("수정할 수 없는 예약 상태입니다.");
  }
}

function assertReservationPassword(
  reservation: MobileReservationRecord,
  userId: string | undefined,
  password?: string | null,
) {
  if (
    reservation.password_hash &&
    reservation.creator_id !== userId &&
    !verifyReservationPassword(password ?? "", reservation.password_hash)
  ) {
    throw new Error("예약 비밀번호가 일치하지 않습니다.");
  }
}

async function replaceReservationSlots(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  reservation: MobileReservationRecord,
  requestedSlots: TimeRange[],
) {
  const confirmedSlots =
    reservation.status === "APPROVED"
      ? await listConfirmedSlots(admin, reservation.id)
      : [];
  const deleteQuery = admin
    .from("reservation_slots")
    .delete()
    .eq("reservation_id", reservation.id);
  const { error: deleteError } =
    reservation.status === "APPROVED"
      ? await deleteQuery.eq("is_confirmed", false)
      : await deleteQuery;

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const nextSlots = requestedSlots.filter(
    (slot) =>
      !confirmedSlots.some((confirmedSlot) =>
        areSameRange(getSlotDisplayRange(confirmedSlot), slot),
      ),
  );

  if (nextSlots.length === 0) {
    return;
  }

  const { error: insertError } = await admin.from("reservation_slots").insert(
    nextSlots.map((slot, index) => ({
      end_at: slot.endAt,
      event_id: reservation.event_id,
      priority_order: confirmedSlots.length + index + 1,
      reservation_id: reservation.id,
      start_at: slot.startAt,
    })),
  );

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function listConfirmedSlots(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  reservationId: string,
) {
  const { data, error } = await admin
    .from("reservation_slots")
    .select(
      "id,start_at,end_at,confirmed_start_at,confirmed_end_at,is_confirmed",
    )
    .eq("reservation_id", reservationId)
    .eq("is_confirmed", true);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

function getSlotDisplayRange(
  slot: Pick<
    Tables<"reservation_slots">,
    "confirmed_end_at" | "confirmed_start_at" | "end_at" | "start_at"
  >,
) {
  return {
    endAt: slot.confirmed_end_at ?? slot.end_at,
    startAt: slot.confirmed_start_at ?? slot.start_at,
  };
}

function areSameRange(left: TimeRange, right: TimeRange) {
  return (
    new Date(left.startAt).getTime() === new Date(right.startAt).getTime() &&
    new Date(left.endAt).getTime() === new Date(right.endAt).getTime()
  );
}

async function revalidateReservation(reservation: MobileReservationRecord) {
  const event = await getPublicEventById(reservation.event_id);

  revalidatePath(`/event/${event.event_code}`);
  revalidatePath(`/reservations/${reservation.reservation_access_code}`);
}
