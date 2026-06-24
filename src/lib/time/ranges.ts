import type { TimeRange, TimeRangeAvailability } from "@/types/domain";

const MINUTE_IN_MS = 60_000;

type RangeAvailabilityInput = {
  blockedRanges?: TimeRange[];
  occupiedRanges?: TimeRange[];
  allowWaitlist?: boolean;
};

export type TimeGridConfig = {
  gridStartAt: string;
  gridEndAt: string;
  slotMinutes: number;
  minDurationMinutes?: number;
};

type SnapMode = "floor" | "ceil" | "round";

export function isValidTimeRange(range: TimeRange) {
  return new Date(range.startAt).getTime() < new Date(range.endAt).getTime();
}

export function sortTimeRanges(ranges: TimeRange[]) {
  return [...ranges].sort(
    (left, right) =>
      new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
  );
}

export function rangesOverlap(left: TimeRange, right: TimeRange) {
  return (
    new Date(left.startAt).getTime() < new Date(right.endAt).getTime() &&
    new Date(right.startAt).getTime() < new Date(left.endAt).getTime()
  );
}

export function rangeContains(container: TimeRange, candidate: TimeRange) {
  return (
    new Date(container.startAt).getTime() <=
      new Date(candidate.startAt).getTime() &&
    new Date(candidate.endAt).getTime() <=
      new Date(container.endAt).getTime()
  );
}

export function mergeTimeRanges(ranges: TimeRange[]) {
  return sortTimeRanges(ranges).reduce<TimeRange[]>((mergedRanges, range) => {
    if (!isValidTimeRange(range)) {
      return mergedRanges;
    }

    const nextRange = { ...range };
    const previousRange = mergedRanges.at(-1);

    if (!previousRange) {
      return [nextRange];
    }

    const previousEnd = new Date(previousRange.endAt).getTime();
    const nextStart = new Date(range.startAt).getTime();
    const nextEnd = new Date(range.endAt).getTime();

    if (nextStart <= previousEnd) {
      previousRange.endAt = new Date(
        Math.max(previousEnd, nextEnd),
      ).toISOString();
      return mergedRanges;
    }

    return [...mergedRanges, nextRange];
  }, []);
}

export function expandRangeByMinutes(
  range: TimeRange,
  minutesBefore: number,
  minutesAfter = minutesBefore,
) {
  const start = new Date(range.startAt).getTime() - minutesBefore * MINUTE_IN_MS;
  const end = new Date(range.endAt).getTime() + minutesAfter * MINUTE_IN_MS;

  return {
    startAt: new Date(start).toISOString(),
    endAt: new Date(end).toISOString(),
  };
}

export function clampRangeToGrid(range: TimeRange, config: TimeGridConfig) {
  const gridStart = getGridStart(config);
  const gridEnd = getGridEnd(config);
  const start = clampTimestamp(new Date(range.startAt).getTime(), gridStart, gridEnd);
  const end = clampTimestamp(new Date(range.endAt).getTime(), gridStart, gridEnd);

  return {
    startAt: new Date(start).toISOString(),
    endAt: new Date(end).toISOString(),
  };
}

export function getRangeAvailability(
  range: TimeRange,
  {
    allowWaitlist = false,
    blockedRanges = [],
    occupiedRanges = [],
  }: RangeAvailabilityInput = {},
): TimeRangeAvailability {
  if (!isValidTimeRange(range)) {
    return "blocked";
  }

  if (blockedRanges.some((blockedRange) => rangesOverlap(range, blockedRange))) {
    return "blocked";
  }

  if (occupiedRanges.some((occupiedRange) => rangesOverlap(range, occupiedRange))) {
    return allowWaitlist ? "waitlist" : "blocked";
  }

  return "available";
}

export function buildTimeRangeFromTimestamps(
  anchorTimestamp: number,
  currentTimestamp: number,
  config: TimeGridConfig,
): TimeRange {
  const gridStart = getGridStart(config);
  const gridEnd = getGridEnd(config);
  const slotMs = getSlotMs(config);
  const minDurationMs = Math.min(
    (config.minDurationMinutes ?? config.slotMinutes) * MINUTE_IN_MS,
    gridEnd - gridStart,
  );
  const isForwardSelection = currentTimestamp >= anchorTimestamp;

  let start = isForwardSelection
    ? snapTimestamp(anchorTimestamp, gridStart, slotMs, "floor")
    : snapTimestamp(currentTimestamp, gridStart, slotMs, "floor");
  let end = isForwardSelection
    ? snapTimestamp(currentTimestamp, gridStart, slotMs, "ceil")
    : snapTimestamp(anchorTimestamp, gridStart, slotMs, "ceil");

  start = clampTimestamp(start, gridStart, gridEnd);
  end = clampTimestamp(end, gridStart, gridEnd);

  if (end - start < minDurationMs) {
    if (isForwardSelection) {
      end = Math.min(gridEnd, start + minDurationMs);
    } else {
      start = Math.max(gridStart, end - minDurationMs);
    }
  }

  return {
    startAt: new Date(start).toISOString(),
    endAt: new Date(end).toISOString(),
  };
}

export function getTimestampAtGridOffset(
  clientY: number,
  bounds: Pick<DOMRect, "height" | "top">,
  config: TimeGridConfig,
) {
  const gridStart = getGridStart(config);
  const gridEnd = getGridEnd(config);

  if (bounds.height <= 0) {
    return gridStart;
  }

  const progress = clampNumber((clientY - bounds.top) / bounds.height, 0, 1);

  return gridStart + (gridEnd - gridStart) * progress;
}

function snapTimestamp(
  timestamp: number,
  gridStart: number,
  slotMs: number,
  mode: SnapMode,
) {
  const offset = timestamp - gridStart;
  const ratio = offset / slotMs;

  if (mode === "ceil") {
    return gridStart + Math.ceil(ratio) * slotMs;
  }

  if (mode === "round") {
    return gridStart + Math.round(ratio) * slotMs;
  }

  return gridStart + Math.floor(ratio) * slotMs;
}

function getGridStart(config: TimeGridConfig) {
  return getValidTimestamp(config.gridStartAt, "gridStartAt");
}

function getGridEnd(config: TimeGridConfig) {
  const gridStart = getGridStart(config);
  const gridEnd = getValidTimestamp(config.gridEndAt, "gridEndAt");

  if (gridStart >= gridEnd) {
    throw new Error("gridStartAt must be earlier than gridEndAt.");
  }

  return gridEnd;
}

function getSlotMs(config: TimeGridConfig) {
  if (config.slotMinutes <= 0) {
    throw new Error("slotMinutes must be greater than 0.");
  }

  return config.slotMinutes * MINUTE_IN_MS;
}

function getValidTimestamp(value: string, fieldName: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    throw new Error(`${fieldName} must be a valid date string.`);
  }

  return timestamp;
}

function clampTimestamp(timestamp: number, min: number, max: number) {
  return Math.min(Math.max(timestamp, min), max);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
