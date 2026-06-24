import {
  expandRangeByMinutes,
  mergeTimeRanges,
  rangeContains,
  rangesOverlap,
} from "@/lib/time/ranges";
import type { ReservationStatus, TimeBlockType, TimeRange } from "@/types/domain";

export type ReviewableTimeBlock = TimeRange & {
  type: TimeBlockType;
};

export type CandidateSlotBlockReason =
  | "BLOCKED_TIME"
  | "CONFIRMED_OR_BUFFER"
  | "OUTSIDE_AVAILABLE";

export function getReservationEditCapabilities(status: ReservationStatus) {
  return {
    canCancel: status === "PENDING" || status === "APPROVED",
    canEditPeople: status === "PENDING" || status === "APPROVED",
    canEditSlots: status === "PENDING",
  };
}

export function getCandidateSlotBlockReason({
  bufferMinutes,
  candidate,
  confirmedRanges,
  timeBlocks,
}: {
  bufferMinutes: number;
  candidate: TimeRange;
  confirmedRanges: TimeRange[];
  timeBlocks: ReviewableTimeBlock[];
}): CandidateSlotBlockReason | null {
  const blockedRanges = timeBlocks.filter((block) => block.type === "BLOCKED");

  if (blockedRanges.some((blockedRange) => rangesOverlap(candidate, blockedRange))) {
    return "BLOCKED_TIME";
  }

  const availableRanges = mergeTimeRanges(
    timeBlocks.filter((block) => block.type === "AVAILABLE"),
  );

  if (
    availableRanges.length > 0 &&
    !availableRanges.some((availableRange) =>
      rangeContains(availableRange, candidate),
    )
  ) {
    return "OUTSIDE_AVAILABLE";
  }

  const normalizedBufferMinutes = Math.max(bufferMinutes, 0);
  const overlapsConfirmedOrBuffer = confirmedRanges.some((confirmedRange) =>
    rangesOverlap(
      candidate,
      expandRangeByMinutes(confirmedRange, normalizedBufferMinutes),
    ),
  );

  return overlapsConfirmedOrBuffer ? "CONFIRMED_OR_BUFFER" : null;
}
