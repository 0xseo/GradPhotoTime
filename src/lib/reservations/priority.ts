import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export async function normalizeReservationSlotPriorities(
  admin: AdminSupabaseClient,
  reservationId: string,
) {
  const { data: slots, error } = await admin
    .from("reservation_slots")
    .select("id,end_at,is_confirmed,priority_order,start_at")
    .eq("reservation_id", reservationId)
    .order("is_confirmed", { ascending: true })
    .order("priority_order", { ascending: true })
    .order("start_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const orderedSlots = slots ?? [];

  await Promise.all(
    orderedSlots.map((slot, index) => {
      const nextPriority = index + 1;

      if (slot.priority_order === nextPriority) {
        return Promise.resolve({ error: null });
      }

      return admin
        .from("reservation_slots")
        .update({ priority_order: nextPriority })
        .eq("id", slot.id);
    }),
  ).then((results) => {
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      throw new Error(failed.error.message);
    }
  });
}
