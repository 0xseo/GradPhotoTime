"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Loader2, ToggleRight, Trash2 } from "lucide-react";
import { saveTimeBlocks } from "@/app/actions/time-blocks";
import type { PublicEvent } from "@/app/actions/events";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import { TimeSelectionGrid } from "@/components/calendar/time-selection-grid";
import { Button } from "@/components/ui/button";
import { formatTimeRange } from "@/lib/time/event-days";
import { useSelectionStore } from "@/store/use-selection-store";
import type { Tables } from "@/lib/supabase/database.types";
import type { TimeBlockType, TimeRange } from "@/types/domain";

type HostDashboardShellProps = {
  event: PublicEvent;
  reservationSlots: EventScheduleSlot[];
  timeBlocks: Tables<"time_blocks">[];
};

export function HostDashboardShell({
  event,
  reservationSlots,
  timeBlocks,
}: HostDashboardShellProps) {
  const router = useRouter();
  const [blockType, setBlockType] = useState<TimeBlockType>("AVAILABLE");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const occupiedRanges = useMemo<TimeRange[]>(
    () =>
      reservationSlots.map((slot) => ({
        endAt: slot.end_at,
        startAt: slot.start_at,
      })),
    [reservationSlots],
  );

  useEffect(() => {
    clearSelection();
  }, [clearSelection, event.id]);

  async function handleSave() {
    setError(null);
    setNotice(null);
    setIsPending(true);

    const result = await saveTimeBlocks({
      blocks: [
        ...timeBlocks.map((block) => ({
          endAt: block.end_at,
          note: block.note,
          startAt: block.start_at,
          type: block.type,
        })),
        ...selectedRanges.map((range) => ({
          endAt: range.endAt,
          note: null,
          startAt: range.startAt,
          type: blockType,
        })),
      ],
      eventId: event.id,
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    clearSelection();
    setNotice("시간 블록을 저장했습니다.");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="min-h-96 bg-background">
        <div className="flex items-center gap-2 text-primary">
          <Clock className="size-5" aria-hidden="true" />
          <h2 className="font-serif text-2xl font-semibold">가능 시간</h2>
        </div>
        <div className="mt-4">
          <TimeSelectionGrid
            blockedRanges={timeBlocks
              .filter((block) => block.type === "BLOCKED")
              .map((block) => ({
                endAt: block.end_at,
                startAt: block.start_at,
              }))}
            dailyEndTime={event.daily_end_time}
            dailyStartTime={event.daily_start_time}
            dateEnd={event.date_end}
            dateStart={event.date_start}
            mode="host-availability"
            occupiedRanges={occupiedRanges}
            reservationSlots={reservationSlots}
            selectedRanges={selectedRanges}
            timeBlocks={timeBlocks}
          />
        </div>
      </div>
      <aside className="space-y-4 border border-border bg-muted p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">공유 코드</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-primary">
            {event.event_code}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">
            버퍼 타임
          </span>
          <ToggleRight className="size-6 text-primary" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            className={blockType === "AVAILABLE" ? "" : "bg-background"}
            onClick={() => setBlockType("AVAILABLE")}
            variant={blockType === "AVAILABLE" ? "primary" : "outline"}
          >
            가능
          </Button>
          <Button
            onClick={() => setBlockType("BLOCKED")}
            variant={blockType === "BLOCKED" ? "primary" : "outline"}
          >
            불가
          </Button>
        </div>

        <Button
          className="w-full"
          disabled={isPending || selectedRanges.length === 0}
          onClick={handleSave}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          선택 저장
        </Button>

        <Button
          className="w-full"
          disabled={selectedRanges.length === 0}
          onClick={clearSelection}
          variant="outline"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          선택 초기화
        </Button>

        {notice ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            새 선택 {selectedRanges.length}개
          </p>
          <div className="max-h-40 space-y-2 overflow-auto">
            {selectedRanges.map((range) => (
              <div
                className="rounded-md border border-border bg-background px-3 py-2 text-xs"
                key={range.id}
              >
                {formatTimeRange(range)}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
