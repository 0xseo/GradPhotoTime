import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type MobileDashboardEvent = Pick<
  Tables<"events">,
  | "buffer_time_minutes"
  | "daily_end_time"
  | "daily_start_time"
  | "date_end"
  | "date_start"
  | "event_code"
  | "id"
  | "is_buffer_active"
  | "is_buffer_after_active"
  | "is_buffer_before_active"
  | "title"
>;

type MobileDashboardReservation = Pick<
  Tables<"reservations">,
  | "created_at"
  | "event_id"
  | "headcount"
  | "id"
  | "reservation_access_code"
  | "status"
>;

export type MobileDashboardSlot = Pick<
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

export type MobileDashboardParticipant = Pick<
  Tables<"reservation_participants">,
  "created_at" | "guest_name" | "id" | "is_creator" | "reservation_id" | "user_id"
>;

export type MobileHostedEvent = MobileDashboardEvent & {
  approvedCount: number;
  confirmedSlots: MobileDashboardSlot[];
  participants: MobileDashboardParticipant[];
  pendingCount: number;
  pendingSlots: MobileDashboardSlot[];
};

export type MobileGuestReservation = MobileDashboardReservation & {
  event: MobileDashboardEvent | null;
  participants: MobileDashboardParticipant[];
  slots: MobileDashboardSlot[];
};

export type MobileDashboardData = {
  hostedEvents: MobileHostedEvent[];
  reservations: MobileGuestReservation[];
  user: {
    email: string | null;
    id: string;
  };
};

export async function getMobileDashboardForUser(
  user: Pick<User, "email" | "id">,
): Promise<MobileDashboardData> {
  const admin = createSupabaseAdminClient();
  const [hostedEvents, participantReservationIds] = await Promise.all([
    listHostedEvents(admin, user.id),
    listParticipantReservationIds(admin, user.id),
  ]);
  const [hostedReservations, guestReservations] = await Promise.all([
    listReservationsForEventIds(
      admin,
      hostedEvents.map((event) => event.id),
    ),
    listGuestReservations(admin, user.id, participantReservationIds),
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

  return {
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
  };
}

function buildHostedEventSummary(
  event: MobileDashboardEvent,
  reservations: MobileDashboardReservation[],
  slots: MobileDashboardSlot[],
  participants: MobileDashboardParticipant[],
): MobileHostedEvent {
  const eventReservations = reservations.filter(
    (reservation) => reservation.event_id === event.id,
  );
  const reservationById = new Map(
    eventReservations.map((reservation) => [reservation.id, reservation]),
  );
  const eventSlots = slots.filter((slot) =>
    reservationById.has(slot.reservation_id),
  );

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
  admin: AdminClient,
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

async function listHostedEvents(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("events")
    .select(
      "id,event_code,title,date_start,date_end,daily_start_time,daily_end_time,buffer_time_minutes,is_buffer_active,is_buffer_before_active,is_buffer_after_active",
    )
    .eq("host_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listParticipantReservationIds(
  admin: AdminClient,
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
  admin: AdminClient,
  userId: string,
  participantReservationIds: string[],
) {
  const { data: createdReservations, error: createdError } = await admin
    .from("reservations")
    .select("id,event_id,reservation_access_code,headcount,status,created_at")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });

  if (createdError) {
    throw new Error(createdError.message);
  }

  const { data: participantReservations, error: participantError } =
    participantReservationIds.length > 0
      ? await admin
          .from("reservations")
          .select("id,event_id,reservation_access_code,headcount,status,created_at")
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
  admin: AdminClient,
  eventIds: string[],
) {
  if (eventIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("reservations")
    .select("id,event_id,reservation_access_code,headcount,status,created_at")
    .in("event_id", eventIds)
    .in("status", ["PENDING", "APPROVED"]);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listSlotsForReservationIds(
  admin: AdminClient,
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

async function listEventsByIds(admin: AdminClient, eventIds: string[]) {
  const uniqueEventIds = [...new Set(eventIds)];

  if (uniqueEventIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("events")
    .select(
      "id,event_code,title,date_start,date_end,daily_start_time,daily_end_time,buffer_time_minutes,is_buffer_active,is_buffer_before_active,is_buffer_after_active",
    )
    .in("id", uniqueEventIds);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

function dedupeReservations(reservations: MobileDashboardReservation[]) {
  return [
    ...new Map(
      reservations.map((reservation) => [reservation.id, reservation]),
    ).values(),
  ].sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
  );
}
