import type { TimeRange } from "@/types/domain";

type SlotTimeShape = {
  confirmed_end_at?: string | null;
  confirmed_start_at?: string | null;
  end_at: string;
  is_confirmed?: boolean | null;
  start_at: string;
};

export function getSlotDisplayRange(slot: SlotTimeShape): TimeRange {
  if (slot.is_confirmed && slot.confirmed_start_at && slot.confirmed_end_at) {
    return {
      endAt: slot.confirmed_end_at,
      startAt: slot.confirmed_start_at,
    };
  }

  return getSlotCandidateRange(slot);
}

export function getSlotCandidateRange(slot: SlotTimeShape): TimeRange {
  return {
    endAt: slot.end_at,
    startAt: slot.start_at,
  };
}

export function getSlotDisplayStartAt(slot: SlotTimeShape) {
  return getSlotDisplayRange(slot).startAt;
}

export function getSlotDisplayEndAt(slot: SlotTimeShape) {
  return getSlotDisplayRange(slot).endAt;
}
