import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export async function deleteEventCascade(
  admin: AdminSupabaseClient,
  eventId: string,
) {
  const { data: reservations, error: reservationsError } = await admin
    .from("reservations")
    .select("id")
    .eq("event_id", eventId);

  if (reservationsError) {
    throw new Error(reservationsError.message);
  }

  const reservationIds = reservations?.map((reservation) => reservation.id) ?? [];

  await deleteByEventId(admin, "event_buffer_overrides", eventId);

  if (reservationIds.length > 0) {
    const { error } = await admin
      .from("reservation_participants")
      .delete()
      .in("reservation_id", reservationIds);

    if (error) {
      throw new Error(error.message);
    }
  }

  await deleteByEventId(admin, "reservation_slots", eventId);
  await deleteByEventId(admin, "reservations", eventId);
  await deleteByEventId(admin, "time_blocks", eventId);
  await deleteByEventId(admin, "event_active_dates", eventId);

  const { error: eventError } = await admin
    .from("events")
    .delete()
    .eq("id", eventId);

  if (eventError) {
    throw new Error(eventError.message);
  }
}

async function deleteByEventId(
  admin: AdminSupabaseClient,
  table:
    | "event_active_dates"
    | "event_buffer_overrides"
    | "reservation_slots"
    | "reservations"
    | "time_blocks",
  eventId: string,
) {
  const { error } = await admin.from(table).delete().eq("event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }
}
