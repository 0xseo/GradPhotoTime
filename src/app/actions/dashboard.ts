"use server";

import { actionError, actionOk, type ActionResult } from "@/lib/actions/result";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DashboardEventBase = Pick<
  Tables<"events">,
  | "date_end"
  | "date_start"
  | "event_code"
  | "id"
  | "title"
>;

type DashboardReservationBase = Pick<
  Tables<"reservations">,
  | "created_at"
  | "event_id"
  | "headcount"
  | "id"
  | "reservation_access_code"
  | "status"
>;

export type DashboardSlot = Pick<
  Tables<"reservation_slots">,
  | "confirmed_end_at"
  | "confirmed_start_at"
  | "end_at"
  | "id"
  | "is_confirmed"
  | "priority_order"
  | "reservation_id"
  | "start_at"
>;

export type DashboardParticipant = Pick<
  Tables<"reservation_participants">,
  | "created_at"
  | "guest_name"
  | "id"
  | "is_creator"
  | "reservation_id"
  | "user_id"
>;

export type DashboardHostedEvent = DashboardEventBase & {
  approvedCount: number;
  confirmedSlots: DashboardSlot[];
  participants: DashboardParticipant[];
  pendingCount: number;
  pendingSlots: DashboardSlot[];
};

export type DashboardGuestReservation = DashboardReservationBase & {
  event: DashboardEventBase | null;
  participants: DashboardParticipant[];
  slots: DashboardSlot[];
};

export type HomeDashboardData = {
  hostedEvents: DashboardHostedEvent[];
  reservations: DashboardGuestReservation[];
  user: {
    email: string | null;
    id: string;
  } | null;
};

export async function getHomeDashboard(): Promise<
  ActionResult<HomeDashboardData>
> {
  try {
    const serverSupabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return actionOk({
        hostedEvents: [],
        reservations: [],
        user: null,
      });
    }

    const admin = createSupabaseAdminClient();
    const [hostedEvents, reservationIdsFromParticipants] = await Promise.all([
      listHostedEvents(admin, user.id),
      listParticipantReservationIds(admin, user.id),
    ]);
    const [hostedReservations, guestReservations] = await Promise.all([
      listReservationsForEventIds(
        admin,
        hostedEvents.map((event) => event.id),
      ),
      listGuestReservations(admin, user.id, reservationIdsFromParticipants),
    ]);
    const hostedSlots = await listSlotsForReservationIds(
      admin,
      hostedReservations.map((reservation) => reservation.id),
    );
    const guestEvents = await listEventsByIds(
      admin,
      guestReservations.map((reservation) => reservation.event_id),
    );
    const guestSlots = await listSlotsForReservationIds(
      admin,
      guestReservations.map((reservation) => reservation.id),
    );
    const participants = await listParticipantsForReservationIds(admin, [
      ...hostedReservations.map((reservation) => reservation.id),
      ...guestReservations.map((reservation) => reservation.id),
    ]);

    return actionOk({
      hostedEvents: hostedEvents.map((event) =>
        buildHostedEventSummary(
          event,
          hostedReservations,
          hostedSlots,
          participants,
        ),
      ),
      reservations: guestReservations.map((reservation) => ({
        ...reservation,
        event:
          guestEvents.find((event) => event.id === reservation.event_id) ?? null,
        participants: participants.filter(
          (participant) => participant.reservation_id === reservation.id,
        ),
        slots: guestSlots.filter(
          (slot) => slot.reservation_id === reservation.id,
        ),
      })),
      user: {
        email: user.email ?? null,
        id: user.id,
      },
    });
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "홈 정보를 불러오지 못했습니다.",
    );
  }
}

function buildHostedEventSummary(
  event: DashboardEventBase,
  reservations: DashboardReservationBase[],
  slots: DashboardSlot[],
  participants: DashboardParticipant[],
): DashboardHostedEvent {
  const eventReservations = reservations.filter(
    (reservation) => reservation.event_id === event.id,
  );
  const reservationById = new Map(
    eventReservations.map((reservation) => [reservation.id, reservation]),
  );
  const eventSlots = slots.filter((slot) => reservationById.has(slot.reservation_id));

  return {
    ...event,
    approvedCount: eventReservations.filter(
      (reservation) => reservation.status === "APPROVED",
    ).length,
    confirmedSlots: eventSlots.filter((slot) => slot.is_confirmed),
    participants: participants.filter((participant) =>
      reservationById.has(participant.reservation_id),
    ),
    pendingCount: eventReservations.filter(
      (reservation) => reservation.status === "PENDING",
    ).length,
    pendingSlots: eventSlots.filter(
      (slot) => reservationById.get(slot.reservation_id)?.status === "PENDING",
    ),
  };
}

async function listParticipantsForReservationIds(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  reservationIds: string[],
) {
  const uniqueReservationIds = [...new Set(reservationIds)];

  if (uniqueReservationIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("reservation_participants")
    .select("id,reservation_id,user_id,guest_name,is_creator,created_at")
    .in("reservation_id", uniqueReservationIds)
    .order("is_creator", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listHostedEvents(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  const { data, error } = await admin
    .from("events")
    .select("id,event_code,title,date_start,date_end")
    .eq("host_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listParticipantReservationIds(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  const { data, error } = await admin
    .from("reservation_participants")
    .select("reservation_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return data?.map((participant) => participant.reservation_id) ?? [];
}

async function listGuestReservations(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  participantReservationIds: string[],
) {
  const { data: createdReservations, error: createdError } = await admin
    .from("reservations")
    .select(
      "id,event_id,reservation_access_code,headcount,status,created_at",
    )
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });

  if (createdError) {
    throw new Error(createdError.message);
  }

  const { data: participantReservations, error: participantError } =
    participantReservationIds.length > 0
      ? await admin
          .from("reservations")
          .select(
            "id,event_id,reservation_access_code,headcount,status,created_at",
          )
          .in("id", participantReservationIds)
      : { data: [], error: null };

  if (participantError) {
    throw new Error(participantError.message);
  }

  return dedupeReservations([
    ...(createdReservations ?? []),
    ...(participantReservations ?? []),
  ]);
}

async function listReservationsForEventIds(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  eventIds: string[],
) {
  if (eventIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("reservations")
    .select(
      "id,event_id,reservation_access_code,headcount,status,created_at",
    )
    .in("event_id", eventIds)
    .in("status", ["PENDING", "APPROVED"]);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listSlotsForReservationIds(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  reservationIds: string[],
) {
  if (reservationIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("reservation_slots")
    .select(
      "id,reservation_id,start_at,end_at,confirmed_start_at,confirmed_end_at,is_confirmed,priority_order",
    )
    .in("reservation_id", reservationIds)
    .order("priority_order", { ascending: true })
    .order("start_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listEventsByIds(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  eventIds: string[],
) {
  const uniqueEventIds = [...new Set(eventIds)];

  if (uniqueEventIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("events")
    .select("id,event_code,title,date_start,date_end")
    .in("id", uniqueEventIds);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

function dedupeReservations(reservations: DashboardReservationBase[]) {
  return [...new Map(reservations.map((reservation) => [reservation.id, reservation])).values()]
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    );
}
