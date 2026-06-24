import type {
  SelectedTimeRange,
  TimeRange,
  TimeSelectionMode,
} from "@/types/domain";

export type SelectionMode = TimeSelectionMode;

export type TimeSelectionDraft = {
  mode: SelectionMode;
  ranges: TimeRange[];
};

export type TimeSelectionStateSnapshot = {
  mode: SelectionMode;
  draftRange: TimeRange | null;
  selectedRanges: SelectedTimeRange[];
};
