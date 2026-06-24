import type { TimeRange } from "@/types/domain";

export function isValidTimeRange(range: TimeRange) {
  return new Date(range.startAt).getTime() < new Date(range.endAt).getTime();
}

export function sortTimeRanges(ranges: TimeRange[]) {
  return [...ranges].sort(
    (left, right) =>
      new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
  );
}
