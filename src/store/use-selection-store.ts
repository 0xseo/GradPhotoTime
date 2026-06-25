"use client";

import { create } from "zustand";
import { applySelectedTimeRange } from "@/lib/time/range-set";
import type {
  SelectedTimeRange,
  TimeRange,
  TimeRangeAvailability,
  TimeSelectionMode,
} from "@/types/domain";

type CommitBehavior = "append" | "replace";
type SelectionOperation = "add" | "remove";

type BeginSelectionInput = {
  anchorTimestamp: number;
  draftAvailability: TimeRangeAvailability;
  draftRange: TimeRange;
  operation: SelectionOperation;
  pointerId: number;
};

type SelectionState = {
  activePointerId: number | null;
  anchorTimestamp: number | null;
  draftAvailability: TimeRangeAvailability | null;
  draftOperation: SelectionOperation;
  draftRange: TimeRange | null;
  isDragging: boolean;
  mode: TimeSelectionMode;
  selectedRanges: SelectedTimeRange[];
  beginSelection: (input: BeginSelectionInput) => void;
  cancelSelection: () => void;
  clearSelection: () => void;
  commitDraftRange: (behavior?: CommitBehavior) => void;
  removeSelectedRange: (rangeId: string) => void;
  setMode: (mode: TimeSelectionMode) => void;
  setSelectedRanges: (ranges: SelectedTimeRange[]) => void;
  updateDraftRange: (
    range: TimeRange,
    availability: TimeRangeAvailability,
  ) => void;
};

export const useSelectionStore = create<SelectionState>((set) => ({
  activePointerId: null,
  anchorTimestamp: null,
  draftAvailability: null,
  draftOperation: "add",
  draftRange: null,
  isDragging: false,
  mode: "guest-reservation",
  selectedRanges: [],
  beginSelection: ({
    anchorTimestamp,
    draftAvailability,
    draftRange,
    operation,
    pointerId,
  }) =>
    set({
      activePointerId: pointerId,
      anchorTimestamp,
      draftAvailability,
      draftOperation: operation,
      draftRange,
      isDragging: true,
    }),
  cancelSelection: () =>
    set({
      activePointerId: null,
      anchorTimestamp: null,
      draftAvailability: null,
      draftOperation: "add",
      draftRange: null,
      isDragging: false,
    }),
  clearSelection: () =>
    set({
      activePointerId: null,
      anchorTimestamp: null,
      draftAvailability: null,
      draftOperation: "add",
      draftRange: null,
      isDragging: false,
      selectedRanges: [],
    }),
  commitDraftRange: (behavior = "append") =>
    set((state) => {
      if (!state.draftRange || state.draftAvailability === "blocked") {
        return {
          activePointerId: null,
          anchorTimestamp: null,
          draftAvailability: null,
          draftOperation: "add",
          draftRange: null,
          isDragging: false,
        };
      }

      const nextRanges =
        behavior === "replace"
          ? [
              createSelectedTimeRange(
                state.draftRange,
                state.draftAvailability ?? "available",
              ),
            ]
          : applySelectedTimeRange(
              state.selectedRanges,
              state.draftRange,
              state.draftAvailability ?? "available",
              state.draftOperation,
            );

      return {
        activePointerId: null,
        anchorTimestamp: null,
        draftAvailability: null,
        draftOperation: "add",
        draftRange: null,
        isDragging: false,
        selectedRanges: nextRanges,
      };
    }),
  removeSelectedRange: (rangeId) =>
    set((state) => ({
      selectedRanges: state.selectedRanges.filter((range) => range.id !== rangeId),
    })),
  setMode: (mode) => set({ mode }),
  setSelectedRanges: (selectedRanges) => set({ selectedRanges }),
  updateDraftRange: (draftRange, draftAvailability) =>
    set({ draftAvailability, draftRange }),
}));

function createSelectedTimeRange(
  range: TimeRange,
  availability: TimeRangeAvailability,
): SelectedTimeRange {
  return {
    ...range,
    availability,
    id: createSelectionId(range),
  };
}

function createSelectionId(range: TimeRange) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${range.startAt}-${range.endAt}-${Date.now()}-${Math.random()}`;
}
