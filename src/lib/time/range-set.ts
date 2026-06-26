import type {
  SelectedTimeRange,
  TimeBlockType,
  TimeRange,
  TimeRangeAvailability,
} from "@/types/domain";
import {
  isValidTimeRange,
  mergeTimeRanges,
  rangesOverlap,
} from "@/lib/time/ranges";

type SelectionOperation = "add" | "remove";

export type TimeBlockRangeDraft = TimeRange & {
  note?: string | null;
  type: TimeBlockType;
};

export function isTimestampInRanges(
  timestamp: number,
  ranges: Pick<TimeRange, "endAt" | "startAt">[],
) {
  return ranges.some((range) => {
    const start = new Date(range.startAt).getTime();
    const end = new Date(range.endAt).getTime();

    return start <= timestamp && timestamp < end;
  });
}

export function applySelectedTimeRange(
  selectedRanges: SelectedTimeRange[],
  range: TimeRange,
  availability: TimeRangeAvailability,
  operation: SelectionOperation,
) {
  if (operation === "remove") {
    return removeTimeRangeFromSelections(selectedRanges, range);
  }

  const nextRange = createSelectedTimeRange(range, availability);
  const retainedRanges = selectedRanges.flatMap((selectedRange) =>
    subtractTimeRange(selectedRange, range).map((piece) =>
      createSelectedTimeRange(piece, selectedRange.availability),
    ),
  );

  return mergeSelectedTimeRanges([...retainedRanges, nextRange]);
}

export function removeTimeRangeFromSelections(
  selectedRanges: SelectedTimeRange[],
  range: TimeRange,
) {
  return selectedRanges.flatMap((selectedRange) =>
    subtractTimeRange(selectedRange, range).map((piece) =>
      createSelectedTimeRange(piece, selectedRange.availability),
    ),
  );
}

export function applyTimeBlockSelection(
  existingBlocks: TimeBlockRangeDraft[],
  selectedRanges: TimeRange[],
  selectedType: TimeBlockType,
) {
  const normalizedSelections = mergeTimeRanges(selectedRanges);
  const retainedBlocks = existingBlocks.flatMap((block) =>
    subtractTimeRanges(block, normalizedSelections).map((piece) => ({
      ...piece,
      note: block.note ?? null,
      type: block.type,
    })),
  );
  const addedBlocks = normalizedSelections.map((range) => ({
    ...range,
    note: null,
    type: selectedType,
  }));

  return mergeTimeBlockRanges([...retainedBlocks, ...addedBlocks]);
}

export function applyAvailabilityToggleSelection(
  existingBlocks: TimeBlockRangeDraft[],
  selectedRanges: TimeRange[],
) {
  return selectedRanges.reduce<TimeBlockRangeDraft[]>(
    (currentBlocks, selectedRange) => {
      const startsInAvailable = isTimestampInRanges(
        new Date(selectedRange.startAt).getTime(),
        currentBlocks.filter((block) => block.type === "AVAILABLE"),
      );
      const retainedBlocks = currentBlocks.flatMap((block) =>
        subtractTimeRange(block, selectedRange).map((piece) => ({
          ...piece,
          note: block.note ?? null,
          type: block.type,
        })),
      );

      if (startsInAvailable) {
        return mergeTimeBlockRanges(retainedBlocks);
      }

      return mergeTimeBlockRanges([
        ...retainedBlocks,
        {
          ...selectedRange,
          note: null,
          type: "AVAILABLE",
        },
      ]);
    },
    existingBlocks,
  );
}

export function subtractTimeRanges(range: TimeRange, removals: TimeRange[]) {
  return removals.reduce<TimeRange[]>(
    (pieces, removal) =>
      pieces.flatMap((piece) => subtractTimeRange(piece, removal)),
    [range],
  );
}

export function subtractTimeRange(range: TimeRange, removal: TimeRange) {
  if (!rangesOverlap(range, removal)) {
    return [range];
  }

  const rangeStart = new Date(range.startAt).getTime();
  const rangeEnd = new Date(range.endAt).getTime();
  const removalStart = new Date(removal.startAt).getTime();
  const removalEnd = new Date(removal.endAt).getTime();
  const pieces: TimeRange[] = [];

  if (rangeStart < removalStart) {
    pieces.push({
      startAt: range.startAt,
      endAt: new Date(Math.min(removalStart, rangeEnd)).toISOString(),
    });
  }

  if (removalEnd < rangeEnd) {
    pieces.push({
      startAt: new Date(Math.max(removalEnd, rangeStart)).toISOString(),
      endAt: range.endAt,
    });
  }

  return pieces.filter(isValidTimeRange);
}

function mergeSelectedTimeRanges(ranges: SelectedTimeRange[]) {
  return ranges.reduce<SelectedTimeRange[]>((mergedRanges, range) => {
    const mergeIndex = mergedRanges.findIndex(
      (mergedRange) =>
        mergedRange.availability === range.availability &&
        rangesTouchOrOverlap(mergedRange, range),
    );

    if (mergeIndex === -1) {
      return [...mergedRanges, range];
    }

    return mergedRanges.map((mergedRange, index) => {
      if (index !== mergeIndex) {
        return mergedRange;
      }

      const startAt =
        new Date(range.startAt).getTime() <
        new Date(mergedRange.startAt).getTime()
          ? range.startAt
          : mergedRange.startAt;
      const endAt =
        new Date(range.endAt).getTime() >
        new Date(mergedRange.endAt).getTime()
          ? range.endAt
          : mergedRange.endAt;

      return createSelectedTimeRange(
        {
          endAt,
          startAt,
        },
        mergedRange.availability,
      );
    });
  }, []);
}

function rangesTouchOrOverlap(left: TimeRange, right: TimeRange) {
  return (
    new Date(left.startAt).getTime() <= new Date(right.endAt).getTime() &&
    new Date(right.startAt).getTime() <= new Date(left.endAt).getTime()
  );
}

function mergeTimeBlockRanges(blocks: TimeBlockRangeDraft[]) {
  return (["AVAILABLE", "BLOCKED"] as TimeBlockType[]).flatMap((type) =>
    mergeTimeRanges(
      blocks
        .filter((block) => block.type === type)
        .map((block) => ({
          endAt: block.endAt,
          startAt: block.startAt,
        })),
    ).map((range) => ({
      ...range,
      note: null,
      type,
    })),
  );
}

function createSelectedTimeRange(
  range: TimeRange,
  availability: TimeRangeAvailability,
): SelectedTimeRange {
  return {
    ...range,
    availability,
    id: `${availability}:${range.startAt}:${range.endAt}`,
  };
}
