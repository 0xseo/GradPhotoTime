"use client";

import { useCallback, useMemo, type PointerEvent, type RefObject } from "react";
import {
  buildTimeRangeFromTimestamps,
  getRangeAvailability,
  getTimestampAtGridOffset,
  type TimeGridConfig,
} from "@/lib/time/ranges";
import { useSelectionStore } from "@/store/use-selection-store";
import type {
  TimeRange,
  TimeRangeAvailability,
  TimeSelectionMode,
} from "@/types/domain";

type SelectionBehavior = "append" | "replace";

type UseTimeSelectionOptions = TimeGridConfig & {
  allowWaitlist?: boolean;
  blockedRanges?: TimeRange[];
  gridRef: RefObject<HTMLElement | null>;
  mode?: TimeSelectionMode;
  occupiedRanges?: TimeRange[];
  selectionBehavior?: SelectionBehavior;
};

export function useTimeSelection({
  allowWaitlist = false,
  blockedRanges = [],
  gridEndAt,
  gridRef,
  gridStartAt,
  minDurationMinutes,
  mode,
  occupiedRanges = [],
  selectionBehavior = "append",
  slotMinutes,
}: UseTimeSelectionOptions) {
  const activePointerId = useSelectionStore((state) => state.activePointerId);
  const anchorTimestamp = useSelectionStore((state) => state.anchorTimestamp);
  const beginSelection = useSelectionStore((state) => state.beginSelection);
  const cancelSelection = useSelectionStore((state) => state.cancelSelection);
  const commitDraftRange = useSelectionStore((state) => state.commitDraftRange);
  const draftAvailability = useSelectionStore((state) => state.draftAvailability);
  const draftRange = useSelectionStore((state) => state.draftRange);
  const isDragging = useSelectionStore((state) => state.isDragging);
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const setMode = useSelectionStore((state) => state.setMode);
  const updateDraftRange = useSelectionStore((state) => state.updateDraftRange);

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
      const availability = getRangeAvailability(range, {
        allowWaitlist,
        blockedRanges,
        occupiedRanges,
      });

      return { availability, range };
    },
    [allowWaitlist, blockedRanges, config, gridRef, occupiedRanges],
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
      const draft = getDraftFromPointer(event.clientY, timestamp);

      if (!draft) {
        return;
      }

      if (mode) {
        setMode(mode);
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();

      beginSelection({
        anchorTimestamp: timestamp,
        draftAvailability: draft.availability,
        draftRange: draft.range,
        pointerId: event.pointerId,
      });
    },
    [beginSelection, config, getDraftFromPointer, gridRef, mode, setMode],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!isDragging || activePointerId !== event.pointerId) {
        return;
      }

      if (anchorTimestamp === null) {
        return;
      }

      const draft = getDraftFromPointer(event.clientY, anchorTimestamp);

      if (!draft) {
        return;
      }

      event.preventDefault();
      updateDraftRange(draft.range, draft.availability);
    },
    [
      activePointerId,
      anchorTimestamp,
      getDraftFromPointer,
      isDragging,
      updateDraftRange,
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
    draftRange,
    gridProps: {
      onPointerCancel: handlePointerCancel,
      onPointerDown: handlePointerDown,
      onPointerLeave: handlePointerMove,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      style: {
        touchAction: "none",
        userSelect: "none",
      },
    },
    isDragging,
    selectedRanges,
  };
}
