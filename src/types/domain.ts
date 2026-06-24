export type TimeBlockType = "AVAILABLE" | "BLOCKED";

export type ReservationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type TimeSelectionMode = "host-availability" | "guest-reservation";

export type TimeRangeAvailability = "available" | "waitlist" | "blocked";

export type TimeRange = {
  startAt: string;
  endAt: string;
};

export type SelectedTimeRange = TimeRange & {
  id: string;
  availability: TimeRangeAvailability;
};

export type ParticipantDraft = {
  userId?: string;
  guestName: string;
};
