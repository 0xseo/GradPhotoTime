"use client";

import { create } from "zustand";
import type { TimeRange } from "@/types/domain";

type SelectionState = {
  selectedRanges: TimeRange[];
  setSelectedRanges: (ranges: TimeRange[]) => void;
  clearSelection: () => void;
};

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedRanges: [],
  setSelectedRanges: (selectedRanges) => set({ selectedRanges }),
  clearSelection: () => set({ selectedRanges: [] }),
}));
