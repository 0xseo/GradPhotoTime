import { getDayGridRange, getEventDays } from "@/lib/time/event-days";
import { subtractTimeRanges } from "@/lib/time/range-set";
import { mergeTimeRanges } from "@/lib/time/ranges";
import type { TimeRange } from "@/types/domain";

type AvailabilityBlock = {
  end_at: string;
  start_at: string;
  type: string;
};

export function buildOutsideAvailableTimeRanges({
  activeDates,
  dailyEndTime,
  dailyStartTime,
  dateEnd,
  dateStart,
  timeBlocks,
}: {
  activeDates: string[];
  dailyEndTime: string;
  dailyStartTime: string;
  dateEnd: string;
  dateStart: string;
  timeBlocks: AvailabilityBlock[];
}) {
  const availableRanges = timeBlocks
    .filter((block) => block.type === "AVAILABLE")
    .map((block) => ({
      endAt: block.end_at,
      startAt: block.start_at,
    }));

  if (availableRanges.length === 0) {
    return [];
  }

  const dates =
    activeDates.length > 0
      ? activeDates
      : getEventDays(dateStart, dateEnd).map((day) => day.date);

  return dates.flatMap((date) => {
    const { gridEndAt, gridStartAt } = getDayGridRange(
      date,
      dailyStartTime,
      dailyEndTime,
    );

    return subtractTimeRanges(
      {
        endAt: gridEndAt,
        startAt: gridStartAt,
      },
      availableRanges,
    );
  });
}

export function splitAvailableBlocksByUnavailable<
  T extends AvailabilityBlock & { id?: string },
>(timeBlocks: T[], unavailableRanges: TimeRange[]) {
  const removals = mergeTimeRanges(unavailableRanges);

  if (removals.length === 0) {
    return timeBlocks;
  }

  return timeBlocks.flatMap((block) => {
    if (block.type !== "AVAILABLE") {
      return [block];
    }

    return subtractTimeRanges(
      {
        endAt: block.end_at,
        startAt: block.start_at,
      },
      removals,
    ).map((range, index) => ({
      ...block,
      end_at: range.endAt,
      id: block.id
        ? `${block.id}:split:${range.startAt}:${range.endAt}:${index}`
        : undefined,
      start_at: range.startAt,
    }) as T);
  });
}
