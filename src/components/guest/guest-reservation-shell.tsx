"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  Loader2,
  ListChecks,
  Trash2,
  Users,
} from "lucide-react";
import { createReservation } from "@/app/actions/reservations";
import type { EventBufferOverride, PublicEvent } from "@/app/actions/events";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import { ReservationPriorityList } from "@/components/guest/reservation-priority-list";
import { TimeSelectionGrid } from "@/components/calendar/time-selection-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getConfirmedBufferRanges,
  getConfirmedDisplaySlots,
} from "@/lib/reservations/display-ranges";
import { getSlotDisplayRange } from "@/lib/reservations/slots";
import { splitAvailableBlocksByUnavailable } from "@/lib/time/availability";
import { useSelectionStore } from "@/store/use-selection-store";
import type { Tables } from "@/lib/supabase/database.types";
import type { SelectedTimeRange, TimeRange } from "@/types/domain";

type GuestReservationShellProps = {
  activeDates: string[];
  bufferOverrides: EventBufferOverride[];
  event: PublicEvent;
  reservationSlots: EventScheduleSlot[];
  timeBlocks: Tables<"time_blocks">[];
};

export function GuestReservationShell({
  activeDates,
  bufferOverrides,
  event,
  reservationSlots,
  timeBlocks,
}: GuestReservationShellProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPriorityListOpen, setIsPriorityListOpen] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const removeSelectedRange = useSelectionStore(
    (state) => state.removeSelectedRange,
  );
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const setSelectedRanges = useSelectionStore((state) => state.setSelectedRanges);
  const updateSelectedRange = useSelectionStore(
    (state) => state.updateSelectedRange,
  );
  const publicTimeBlocks = useMemo(
    () => timeBlocks.filter((block) => block.type === "AVAILABLE"),
    [timeBlocks],
  );
  const confirmedDisplaySlots = useMemo(
    () => getConfirmedDisplaySlots(reservationSlots),
    [reservationSlots],
  );
  const confirmedRanges = useMemo(
    () => confirmedDisplaySlots.map((slot) => getSlotDisplayRange(slot)),
    [confirmedDisplaySlots],
  );
  const bufferRanges = useMemo(
    () =>
      getConfirmedBufferRanges({
        bufferOverrides,
        event,
        reservationSlots,
      }),
    [bufferOverrides, event, reservationSlots],
  );
  const displayedTimeBlocks = useMemo(
    () =>
      splitAvailableBlocksByUnavailable(publicTimeBlocks, [
        ...confirmedRanges,
        ...bufferRanges,
      ]),
    [bufferRanges, confirmedRanges, publicTimeBlocks],
  );

  useEffect(() => {
    clearSelection();
  }, [clearSelection, event.id]);

  async function handleSubmit(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setError(null);

    if (selectedRanges.length === 0) {
      setError("예약 후보 시간을 하나 이상 선택해 주세요.");
      return;
    }

    const formData = new FormData(eventSubmit.currentTarget);
    const headcount = Number(formData.get("headcount") ?? 1);
    const names = String(formData.get("participants") ?? "")
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length === 0) {
      setError("참여자 이름을 하나 이상 입력해 주세요.");
      return;
    }

    setIsPending(true);

    const result = await createReservation({
      eventId: event.id,
      headcount,
      participants: names.map((guestName) => ({ guestName })),
      password: String(formData.get("password") ?? ""),
      requestedSlots: selectedRanges.map((range) => ({
        endAt: range.endAt,
        startAt: range.startAt,
      })),
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    clearSelection();
    router.push(
      `/reservations/${result.data.reservation.reservation_access_code}`,
    );
  }

  function handleResizeSelectedRange(
    selectedRange: SelectedTimeRange,
    range: TimeRange,
  ) {
    setError(null);
    updateSelectedRange(selectedRange.id, range, "available");
  }

  function reorderSelectedRange(draggedRangeId: string, targetRangeId: string) {
    setSelectedRanges(reorderRanges(selectedRanges, draggedRangeId, targetRangeId));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="min-h-96 bg-background">
        <div className="flex items-center gap-2 text-primary">
          <ListChecks className="size-5" aria-hidden="true" />
          <h2 className="font-serif text-2xl font-semibold">예약 후보</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          이미 신청된 시간도 선택할 수 있으며, 이 경우 대기 후보로 접수됩니다.
        </p>
        <div className="mt-4">
          <TimeSelectionGrid
            activeDates={activeDates}
            dailyEndTime={event.daily_end_time}
            dailyStartTime={event.daily_start_time}
            dateEnd={event.date_end}
            dateStart={event.date_start}
            mode="guest-reservation"
            onResizeSelectedRange={handleResizeSelectedRange}
            reservationSlots={confirmedDisplaySlots}
            selectedRanges={selectedRanges}
            slotDisplayMode="public"
            timeBlocks={displayedTimeBlocks}
          />
        </div>
      </div>
      <aside className="space-y-4 border border-border bg-muted p-4">
        <div className="flex items-center gap-2 text-primary">
          <Users className="size-5" aria-hidden="true" />
          <h2 className="font-serif text-xl font-semibold">참여자</h2>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            defaultValue={1}
            label="총 인원"
            max={30}
            min={1}
            name="headcount"
            required
            type="number"
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">
              참여자 이름
            </span>
            <textarea
              className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              name="participants"
              placeholder={"김민지\n이서준"}
              required
            />
          </label>
          <Input
            label="관리 비밀번호"
            name="password"
            placeholder="선택"
            type="password"
          />

          {error ? (
            <p className="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button
            className="w-full"
            disabled={isPending || selectedRanges.length === 0}
            type="submit"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            예약 신청
          </Button>
        </form>

        <Button
          className="w-full"
          disabled={selectedRanges.length === 0}
          onClick={clearSelection}
          variant="outline"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          선택 초기화
        </Button>

        <ReservationPriorityList
          isOpen={isPriorityListOpen}
          onOpenChange={setIsPriorityListOpen}
          onRemove={removeSelectedRange}
          onReorder={reorderSelectedRange}
          ranges={selectedRanges}
          title="우선순위"
        />
      </aside>
    </div>
  );
}

function reorderRanges(
  ranges: SelectedTimeRange[],
  draggedRangeId: string,
  targetRangeId: string,
) {
  const draggedIndex = ranges.findIndex((range) => range.id === draggedRangeId);
  const targetIndex = ranges.findIndex((range) => range.id === targetRangeId);

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return ranges;
  }

  const nextRanges = [...ranges];
  const [draggedRange] = nextRanges.splice(draggedIndex, 1);
  nextRanges.splice(targetIndex, 0, draggedRange);

  return nextRanges;
}
