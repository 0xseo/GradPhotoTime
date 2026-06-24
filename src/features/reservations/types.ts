import type { ParticipantDraft, TimeRange } from "@/types/domain";

export type ReservationDraft = {
  eventId: string;
  headcount: number;
  participants: ParticipantDraft[];
  requestedSlots: TimeRange[];
  password?: string;
};
