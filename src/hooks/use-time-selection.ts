"use client";

import { useCallback, useMemo, type PointerEvent, type RefObject } from "react";
import {
  buildTimeRangeFromTimestamps,
  getRangeAvailability,
  getTimestampAtGridOffset,
  type TimeGridConfig,
} from "@/lib/time/ranges";
import { getDayGridRange } from "@/lib/time/event-days";
import { isTimestampInRanges } from "@/lib/time/range-set";
import {
  useSelectionStore,
  type DraftTimeRange,
} from "@/store/use-selection-store";
import type {
  TimeRange,
  TimeRangeAvailability,
  TimeSelectionMode,
} from "@/types/domain";

type SelectionBehavior = "append" | "replace";

type UseTimeSelectionOptions = TimeGridConfig & {
  allowWaitlist?: boolean;
  blockedRanges?: TimeRange[];
  calendarGridRef?: RefObject<HTMLElement | null>;
  commitOperation?: "add" | "remove";
  dailyEndTime?: string;
  dailyStartTime?: string;
  dates?: string[];
  dayIndex?: number;
  gridRef: RefObject<HTMLElement | null>;
  mode?: TimeSelectionMode;
  occupiedRanges?: TimeRange[];
  operationReferenceRanges?: TimeRange[];
  selectionBehavior?: SelectionBehavior;
};

export function useTimeSelection({
  allowWaitlist = false,
  blockedRanges = [],
  calendarGridRef,
  commitOperation,
  dailyEndTime,
  dailyStartTime,
  dates,
  dayIndex,
  gridEndAt,
  gridRef,
  gridStartAt,
  minDurationMinutes,
  mode,
  occupiedRanges = [],
  operationReferenceRanges,
  selectionBehavior = "append",
  slotMinutes,
}: UseTimeSelectionOptions) {
  const activePointerId = useSelectionStore((state) => state.activePointerId);
  const anchorTimestamp = useSelectionStore((state) => state.anchorTimestamp);
  const beginSelection = useSelectionStore((state) => state.beginSelection);
  const cancelSelection = useSelectionStore((state) => state.cancelSelection);
  const commitDraftRange = useSelectionStore((state) => state.commitDraftRange);
  const draftAvailability = useSelectionStore((state) => state.draftAvailability);
  const draftPreviewOperation = useSelectionStore(
    (state) => state.draftPreviewOperation,
  );
  const draftRange = useSelectionStore((state) => state.draftRange);
  const draftRanges = useSelectionStore((state) => state.draftRanges);
  const isDragging = useSelectionStore((state) => state.isDragging);
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const setMode = useSelectionStore((state) => state.setMode);
  const updateDraftRange = useSelectionStore((state) => state.updateDraftRange);
  const updateDraftRanges = useSelectionStore((state) => state.updateDraftRanges);

  const config = useMemo<TimeGridConfig>(
    () => ({
      gridEndAt,
      gridStartAt,
      minDurationMinutes,
      slotMinutes,
    }),
    [gridEndAt, gridStartAt, minDurationMinutes, slotMinutes],
  );

  const getDraftFromPointer = useCallback(
    (clientY: number, initialTimestamp: number) => {
      const gridElement = gridRef.current;

      if (!gridElement) {
        return null;
      }

      const timestamp = getTimestampAtGridOffset(
        clientY,
        gridElement.getBoundingClientRect(),
        config,
      );
      const range = buildTimeRangeFromTimestamps(
        initialTimestamp,
        timestamp,
        config,
      );
      const availability =
        mode === "host-availability"
          ? "available"
          : getRangeAvailability(range, {
              allowWaitlist,
              blockedRanges,
              occupiedRanges,
            });

      return { availability, range };
    },
    [allowWaitlist, blockedRanges, config, gridRef, mode, occupiedRanges],
  );

  const getDraftRangesFromPointer = useCallback(
    (
      clientX: number,
      clientY: number,
      initialTimestamp: number,
    ): DraftTimeRange[] | null => {
      const draft = getDraftFromPointer(clientY, initialTimestamp);

      if (!draft) {
        return null;
      }

      if (
        !calendarGridRef?.current ||
        !dailyEndTime ||
        !dailyStartTime ||
        !dates?.length ||
        dayIndex === undefined
      ) {
        return [{ ...draft.range, availability: draft.availability }];
      }

      const currentDayIndex = getDayIndexAtClientX(
        clientX,
        calendarGridRef.current,
        dates.length,
      );
      const [startDayIndex, endDayIndex] =
        currentDayIndex < dayIndex
          ? [currentDayIndex, dayIndex]
          : [dayIndex, currentDayIndex];
      const baseGridStart = new Date(gridStartAt).getTime();
      const startOffset =
        new Date(draft.range.startAt).getTime() - baseGridStart;
      const endOffset = new Date(draft.range.endAt).getTime() - baseGridStart;

      return dates
        .slice(startDayIndex, endDayIndex + 1)
        .map<DraftTimeRange>((date) => {
          const { gridStartAt: dayGridStartAt } = getDayGridRange(
            date,
            dailyStartTime,
            dailyEndTime,
          );
          const dayGridStart = new Date(dayGridStartAt).getTime();
          const range = {
            endAt: new Date(dayGridStart + endOffset).toISOString(),
            startAt: new Date(dayGridStart + startOffset).toISOString(),
          };

          return {
            ...range,
            availability:
              mode === "host-availability"
                ? "available"
                : getRangeAvailability(range, {
                    allowWaitlist,
                    blockedRanges,
                    occupiedRanges,
                  }),
          };
        });
    },
    [
      allowWaitlist,
      blockedRanges,
      calendarGridRef,
      dailyEndTime,
      dailyStartTime,
      dates,
      dayIndex,
      getDraftFromPointer,
      gridStartAt,
      mode,
      occupiedRanges,
    ],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const gridElement = gridRef.current;

      if (!gridElement) {
        return;
      }

      const timestamp = getTimestampAtGridOffset(
        event.clientY,
        gridElement.getBoundingClientRect(),
        config,
      );
      const draftRangesFromPointer = getDraftRangesFromPointer(
        event.clientX,
        event.clientY,
        timestamp,
      );
      const draft = draftRangesFromPointer?.[0];

      if (!draft) {
        return;
      }

      if (mode) {
        setMode(mode);
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();

      const previewOperation = isTimestampInRanges(
        timestamp,
        operationReferenceRanges ?? selectedRanges,
      )
        ? "remove"
        : "add";

      beginSelection({
        anchorTimestamp: timestamp,
        draftAvailability: draft.availability,
        draftPreviewOperation: previewOperation,
        draftRange: {
          endAt: draft.endAt,
          startAt: draft.startAt,
        },
        draftRanges: draftRangesFromPointer,
        operation: commitOperation ?? previewOperation,
        pointerId: event.pointerId,
      });
    },
    [
      beginSelection,
      commitOperation,
      config,
      getDraftRangesFromPointer,
      gridRef,
      mode,
      operationReferenceRanges,
      selectedRanges,
      setMode,
    ],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!isDragging || activePointerId !== event.pointerId) {
        return;
      }

      if (anchorTimestamp === null) {
        return;
      }

      const draftRangesFromPointer = getDraftRangesFromPointer(
        event.clientX,
        event.clientY,
        anchorTimestamp,
      );

      if (!draftRangesFromPointer) {
        return;
      }

      event.preventDefault();
      if (draftRangesFromPointer.length === 1) {
        updateDraftRange(
          {
            endAt: draftRangesFromPointer[0].endAt,
            startAt: draftRangesFromPointer[0].startAt,
          },
          draftRangesFromPointer[0].availability,
        );
      } else {
        updateDraftRanges(draftRangesFromPointer);
      }
    },
    [
      activePointerId,
      anchorTimestamp,
      getDraftRangesFromPointer,
      isDragging,
      updateDraftRange,
      updateDraftRanges,
    ],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!isDragging || activePointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      commitDraftRange(selectionBehavior);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [activePointerId, commitDraftRange, isDragging, selectionBehavior],
  );

  const handlePointerCancel = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      cancelSelection();

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [activePointerId, cancelSelection],
  );

  return {
    draftAvailability: draftAvailability ?? ("available" as TimeRangeAvailability),
    draftOperation: draftPreviewOperation,
    draftRange,
    draftRanges,
    gridProps: {
      onPointerCancel: handlePointerCancel,
      onPointerDown: handlePointerDown,
      onPointerLeave: handlePointerMove,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      style: {
        touchAction: "none" as const,
        userSelect: "none" as const,
      },
    },
    isDragging,
    selectedRanges,
  };
}

function getDayIndexAtClientX(
  clientX: number,
  calendarGridElement: HTMLElement,
  dayCount: number,
) {
  const dayElements = Array.from(
    calendarGridElement.querySelectorAll<HTMLElement>("[data-day-grid-index]"),
  );

  if (dayElements.length === 0) {
    return 0;
  }

  for (const dayElement of dayElements) {
    const bounds = dayElement.getBoundingClientRect();

    if (bounds.left <= clientX && clientX <= bounds.right) {
      return Number(dayElement.dataset.dayGridIndex ?? 0);
    }
  }

  const firstBounds = dayElements[0].getBoundingClientRect();

  if (clientX < firstBounds.left) {
    return 0;
  }

  return Math.min(dayElements.length - 1, dayCount - 1);
}
