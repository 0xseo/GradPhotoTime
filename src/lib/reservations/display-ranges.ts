import type { EventBufferOverride, PublicEvent } from "@/app/actions/events";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import { getSlotDisplayRange } from "@/lib/reservations/slots";
import { buildEffectiveBufferTimeRanges } from "@/lib/time/ranges";
import type { TimeRange } from "@/types/domain";

type BufferEventSettings = Pick<
  PublicEvent,
  | "buffer_time_minutes"
  | "is_buffer_active"
  | "is_buffer_after_active"
  | "is_buffer_before_active"
>;

export function getConfirmedDisplaySlots(
  reservationSlots: EventScheduleSlot[],
  excludeReservationId?: string,
) {
  return reservationSlots.filter(
    (slot) =>
      slot.is_confirmed &&
      (!excludeReservationId || slot.reservation_id !== excludeReservationId),
  );
}

export function getConfirmedBufferRanges({
  bufferOverrides,
  event,
  excludeReservationId,
  reservationSlots,
}: {
  bufferOverrides: EventBufferOverride[];
  event: BufferEventSettings;
  excludeReservationId?: string;
  reservationSlots: EventScheduleSlot[];
}): TimeRange[] {
  const confirmedRanges = getConfirmedDisplaySlots(
    reservationSlots,
    excludeReservationId,
  ).map((slot) => ({
    ...getSlotDisplayRange(slot),
    id: slot.id,
  }));

  return buildEffectiveBufferTimeRanges({
    afterActive: event.is_buffer_after_active,
    beforeActive: event.is_buffer_before_active,
    bufferMinutes: event.buffer_time_minutes,
    isBufferActive: event.is_buffer_active,
    overrides: bufferOverrides,
    ranges: confirmedRanges,
  });
}
