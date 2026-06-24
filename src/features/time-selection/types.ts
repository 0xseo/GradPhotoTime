import type { TimeRange } from "@/types/domain";

export type SelectionMode = "host-availability" | "guest-reservation";

export type TimeSelectionDraft = {
  mode: SelectionMode;
  ranges: TimeRange[];
};
