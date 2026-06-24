import type { TimeRange } from "@/types/domain";

export type EventDraft = {
  title: string;
  description?: string;
  dateStart: string;
  dateEnd: string;
  dailyRange: TimeRange;
  bufferTimeMinutes: number;
  isBufferActive: boolean;
};
