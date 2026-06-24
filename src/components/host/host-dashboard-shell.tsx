"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { updateEventBufferSettings } from "@/app/actions/events";
import {
  reviewReservation,
  type HostReservationGroup,
} from "@/app/actions/reservations";
import { saveTimeBlocks } from "@/app/actions/time-blocks";
import type { PublicEvent } from "@/app/actions/events";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import { TimeSelectionGrid } from "@/components/calendar/time-selection-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTimeRange } from "@/lib/time/event-days";
import { buildBufferTimeRanges } from "@/lib/time/ranges";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/store/use-selection-store";
import type { Tables } from "@/lib/supabase/database.types";
import type { ReservationStatus, TimeBlockType, TimeRange } from "@/types/domain";

type HostDashboardShellProps = {
  event: PublicEvent;
  reservations: HostReservationGroup[];
  reservationSlots: EventScheduleSlot[];
  timeBlocks: Tables<"time_blocks">[];
};

export function HostDashboardShell({
  event,
  reservations,
  reservationSlots,
  timeBlocks,
}: HostDashboardShellProps) {
  const router = useRouter();
  const [blockType, setBlockType] = useState<TimeBlockType>("AVAILABLE");
  const [bufferMinutes, setBufferMinutes] = useState(event.buffer_time_minutes);
  const [error, setError] = useState<string | null>(null);
  const [isBufferActive, setIsBufferActive] = useState(event.is_buffer_active);
  const [isBufferPending, setIsBufferPending] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const confirmedRanges = useMemo<TimeRange[]>(
    () =>
      reservationSlots
        .filter((slot) => slot.is_confirmed)
        .map((slot) => ({
          endAt: slot.end_at,
          startAt: slot.start_at,
        })),
    [reservationSlots],
  );
  const bufferRanges = useMemo<TimeRange[]>(
    () =>
      event.is_buffer_active
        ? buildBufferTimeRanges(confirmedRanges, event.buffer_time_minutes)
        : [],
    [confirmedRanges, event.buffer_time_minutes, event.is_buffer_active],
  );
  const blockedRanges = useMemo<TimeRange[]>(
    () => [
      ...timeBlocks
        .filter((block) => block.type === "BLOCKED")
        .map((block) => ({
          endAt: block.end_at,
          startAt: block.start_at,
        })),
      ...bufferRanges,
    ],
    [bufferRanges, timeBlocks],
  );
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

  async function handleBufferSave() {
    setError(null);
    setNotice(null);
    setIsBufferPending(true);

    const result = await updateEventBufferSettings({
      bufferTimeMinutes: bufferMinutes,
      eventId: event.id,
      isBufferActive,
    });

    setIsBufferPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("버퍼 설정을 저장했습니다.");
    router.refresh();
  }

  async function handleReviewReservation(input: {
    confirmedSlotId?: string | null;
    reservationId: string;
    status: Extract<ReservationStatus, "APPROVED" | "REJECTED">;
  }) {
    const actionKey =
      input.status === "APPROVED"
        ? `${input.reservationId}:${input.confirmedSlotId}:APPROVED`
        : `${input.reservationId}:REJECTED`;

    setError(null);
    setNotice(null);
    setReviewingKey(actionKey);

    const result = await reviewReservation({
      ...input,
      eventId: event.id,
    });

    setReviewingKey(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice(
      input.status === "APPROVED" ? "예약을 승인했습니다." : "예약을 거절했습니다.",
    );
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-h-96 bg-background">
        <div className="flex items-center gap-2 text-primary">
          <Clock className="size-5" aria-hidden="true" />
          <h2 className="font-serif text-2xl font-semibold">가능 시간</h2>
        </div>
        <div className="mt-4">
          <TimeSelectionGrid
            blockedRanges={blockedRanges}
            bufferRanges={bufferRanges}
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

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">
              버퍼 타임
            </span>
            <button
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
              onClick={() => setIsBufferActive((active) => !active)}
              type="button"
            >
              {isBufferActive ? (
                <ToggleRight className="size-6" aria-hidden="true" />
              ) : (
                <ToggleLeft className="size-6" aria-hidden="true" />
              )}
              {isBufferActive ? "사용" : "미사용"}
            </button>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <Input
              label="분"
              max={180}
              min={0}
              onChange={(eventChange) =>
                setBufferMinutes(Number(eventChange.target.value))
              }
              type="number"
              value={bufferMinutes}
            />
            <Button
              disabled={isBufferPending}
              onClick={handleBufferSave}
              size="sm"
              variant="outline"
            >
              {isBufferPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              저장
            </Button>
          </div>
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

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-primary">
            <Users className="size-5" aria-hidden="true" />
            <h2 className="font-serif text-xl font-semibold">
              신청 {reservations.length}건
            </h2>
          </div>
          <div className="max-h-[32rem] overflow-auto">
            {reservations.length > 0 ? (
              <div className="divide-y divide-border">
                {reservations.map((reservation) => (
                  <ReservationReviewItem
                    key={reservation.id}
                    onReview={handleReviewReservation}
                    reservation={reservation}
                    reviewingKey={reviewingKey}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
                아직 들어온 예약 신청이 없습니다.
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ReservationReviewItem({
  onReview,
  reservation,
  reviewingKey,
}: {
  onReview: (input: {
    confirmedSlotId?: string | null;
    reservationId: string;
    status: Extract<ReservationStatus, "APPROVED" | "REJECTED">;
  }) => void;
  reservation: HostReservationGroup;
  reviewingKey: string | null;
}) {
  const status = getStatusMeta(reservation.status);
  const rejectKey = `${reservation.id}:REJECTED`;
  const participantNames = reservation.participants
    .map((participant) => participant.guest_name)
    .join(", ");

  return (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium",
                status.className,
              )}
            >
              {status.label}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {reservation.reservation_access_code}
            </span>
          </div>
          <p className="mt-2 truncate text-sm font-medium text-foreground">
            {participantNames || "이름 없음"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            총 {reservation.headcount}명
          </p>
        </div>
        <Button
          disabled={reservation.status === "REJECTED" || reviewingKey !== null}
          onClick={() =>
            onReview({
              reservationId: reservation.id,
              status: "REJECTED",
            })
          }
          size="sm"
          variant="ghost"
        >
          {reviewingKey === rejectKey ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <X className="size-4" aria-hidden="true" />
          )}
          거절
        </Button>
      </div>

      <div className="space-y-2">
        {reservation.slots.map((slot) => {
          const approveKey = `${reservation.id}:${slot.id}:APPROVED`;

          return (
            <div
              className="grid grid-cols-[1fr_auto] items-center gap-2"
              key={slot.id}
            >
              <span className="min-w-0 truncate rounded-md border border-border bg-background px-2 py-2 font-mono text-xs text-foreground">
                {formatTimeRange({
                  endAt: slot.end_at,
                  startAt: slot.start_at,
                })}
              </span>
              <Button
                disabled={reviewingKey !== null}
                onClick={() =>
                  onReview({
                    confirmedSlotId: slot.id,
                    reservationId: reservation.id,
                    status: "APPROVED",
                  })
                }
                size="sm"
                variant={slot.is_confirmed ? "primary" : "outline"}
              >
                {reviewingKey === approveKey ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="size-4" aria-hidden="true" />
                )}
                {slot.is_confirmed ? "확정" : "승인"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStatusMeta(status: ReservationStatus) {
  if (status === "APPROVED") {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      label: "승인",
    };
  }

  if (status === "REJECTED") {
    return {
      className: "border-zinc-200 bg-zinc-100 text-zinc-600",
      label: "거절",
    };
  }

  if (status === "CANCELLED") {
    return {
      className: "border-red-200 bg-red-50 text-danger",
      label: "취소",
    };
  }

  return {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    label: "대기",
  };
}
