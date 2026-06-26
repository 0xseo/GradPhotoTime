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

export type DraftTimeRange = TimeRange & {
  availability: TimeRangeAvailability;
};

type BeginSelectionInput = {
  anchorTimestamp: number;
  draftAvailability: TimeRangeAvailability;
  draftPreviewOperation?: SelectionOperation;
  draftRange: TimeRange;
  draftRanges?: DraftTimeRange[];
  operation: SelectionOperation;
  pointerId: number;
};

type SelectionState = {
  activePointerId: number | null;
  anchorTimestamp: number | null;
  draftAvailability: TimeRangeAvailability | null;
  draftOperation: SelectionOperation;
  draftPreviewOperation: SelectionOperation;
  draftRange: TimeRange | null;
  draftRanges: DraftTimeRange[];
  isDragging: boolean;
  mode: TimeSelectionMode;
  selectedRanges: SelectedTimeRange[];
  beginSelection: (input: BeginSelectionInput) => void;
  cancelSelection: () => void;
  clearSelection: () => void;
  commitDraftRange: (behavior?: CommitBehavior) => void;
  moveSelectedRange: (rangeId: string, direction: "down" | "up") => void;
  removeSelectedRange: (rangeId: string) => void;
  setMode: (mode: TimeSelectionMode) => void;
  setSelectedRanges: (ranges: SelectedTimeRange[]) => void;
  updateSelectedRange: (
    rangeId: string,
    range: TimeRange,
    availability: TimeRangeAvailability,
  ) => void;
  updateDraftRange: (
    range: TimeRange,
    availability: TimeRangeAvailability,
  ) => void;
  updateDraftRanges: (ranges: DraftTimeRange[]) => void;
};

export const useSelectionStore = create<SelectionState>((set) => ({
  activePointerId: null,
  anchorTimestamp: null,
  draftAvailability: null,
  draftOperation: "add",
  draftPreviewOperation: "add",
  draftRange: null,
  draftRanges: [],
  isDragging: false,
  mode: "guest-reservation",
  selectedRanges: [],
  beginSelection: ({
    anchorTimestamp,
    draftAvailability,
    draftPreviewOperation,
    draftRange,
    draftRanges,
    operation,
    pointerId,
  }) =>
    set({
      activePointerId: pointerId,
      anchorTimestamp,
      draftAvailability,
      draftOperation: operation,
      draftPreviewOperation: draftPreviewOperation ?? operation,
      draftRange,
      draftRanges: draftRanges ?? [{ ...draftRange, availability: draftAvailability }],
      isDragging: true,
    }),
  cancelSelection: () =>
    set({
      activePointerId: null,
      anchorTimestamp: null,
      draftAvailability: null,
      draftOperation: "add",
      draftPreviewOperation: "add",
      draftRange: null,
      draftRanges: [],
      isDragging: false,
    }),
  clearSelection: () =>
    set({
      activePointerId: null,
      anchorTimestamp: null,
      draftAvailability: null,
      draftOperation: "add",
      draftPreviewOperation: "add",
      draftRange: null,
      draftRanges: [],
      isDragging: false,
      selectedRanges: [],
    }),
  commitDraftRange: (behavior = "append") =>
    set((state) => {
      const draftRanges =
        state.draftRanges.length > 0
          ? state.draftRanges
          : state.draftRange && state.draftAvailability
            ? [{ ...state.draftRange, availability: state.draftAvailability }]
            : [];
      const committableRanges = draftRanges.filter(
        (range) => range.availability !== "blocked",
      );

      if (committableRanges.length === 0) {
        return {
          activePointerId: null,
          anchorTimestamp: null,
          draftAvailability: null,
          draftOperation: "add",
          draftPreviewOperation: "add",
          draftRange: null,
          draftRanges: [],
          isDragging: false,
        };
      }

      const nextRanges =
        behavior === "replace"
          ? committableRanges.map((range) =>
              createSelectedTimeRange(range, range.availability),
            )
          : applySelectionToEditableRanges(
              state.selectedRanges,
              committableRanges,
              state.draftOperation,
            );

      return {
        activePointerId: null,
        anchorTimestamp: null,
        draftAvailability: null,
        draftOperation: "add",
        draftPreviewOperation: "add",
        draftRange: null,
        draftRanges: [],
        isDragging: false,
        selectedRanges: nextRanges,
      };
    }),
  removeSelectedRange: (rangeId) =>
    set((state) => ({
      selectedRanges: state.selectedRanges.filter((range) => range.id !== rangeId),
    })),
  moveSelectedRange: (rangeId, direction) =>
    set((state) => {
      const index = state.selectedRanges.findIndex((range) => range.id === rangeId);

      if (index === -1) {
        return state;
      }

      const nextIndex = direction === "up" ? index - 1 : index + 1;

      if (nextIndex < 0 || nextIndex >= state.selectedRanges.length) {
        return state;
      }

      const selectedRanges = [...state.selectedRanges];
      const [range] = selectedRanges.splice(index, 1);
      selectedRanges.splice(nextIndex, 0, range);

      return { selectedRanges };
    }),
  setMode: (mode) => set({ mode }),
  setSelectedRanges: (selectedRanges) => set({ selectedRanges }),
  updateSelectedRange: (rangeId, range, availability) =>
    set((state) => ({
      selectedRanges: state.selectedRanges.map((selectedRange) =>
        selectedRange.id === rangeId
          ? {
              ...selectedRange,
              availability,
              endAt: range.endAt,
              startAt: range.startAt,
            }
          : selectedRange,
      ),
    })),
  updateDraftRange: (draftRange, draftAvailability) =>
    set({
      draftAvailability,
      draftRange,
      draftRanges: [{ ...draftRange, availability: draftAvailability }],
    }),
  updateDraftRanges: (draftRanges) =>
    set({
      draftAvailability: draftRanges[0]?.availability ?? null,
      draftRange: draftRanges[0]
        ? {
            endAt: draftRanges[0].endAt,
            startAt: draftRanges[0].startAt,
          }
        : null,
      draftRanges,
    }),
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

function applySelectionToEditableRanges(
  selectedRanges: SelectedTimeRange[],
  committableRanges: DraftTimeRange[],
  operation: SelectionOperation,
) {
  const lockedRanges = selectedRanges.filter((range) => range.isConfirmed);
  const editableRanges = selectedRanges.filter((range) => !range.isConfirmed);
  const nextEditableRanges = committableRanges.reduce(
    (currentRanges, range) =>
      applySelectedTimeRange(
        currentRanges,
        range,
        range.availability,
        operation,
      ),
    editableRanges,
  );

  return [...lockedRanges, ...nextEditableRanges];
}
