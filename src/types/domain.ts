export type TimeBlockType = "AVAILABLE" | "BLOCKED";

export type ReservationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type TimeRange = {
  startAt: string;
  endAt: string;
};

export type ParticipantDraft = {
  userId?: string;
  guestName: string;
};
