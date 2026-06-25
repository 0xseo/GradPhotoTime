"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  toggleEventBufferOverride,
  updateEventBufferSettings,
  updateEventDateRange,
  type EventBufferOverride,
  type EventBufferSide,
} from "@/app/actions/events";
import {
  reviewReservation,
  type HostReservationGroup,
} from "@/app/actions/reservations";
import { saveTimeBlocks } from "@/app/actions/time-blocks";
import type { PublicEvent } from "@/app/actions/events";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import { TimeSelectionGrid } from "@/components/calendar/time-selection-grid";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { formatTimeRange } from "@/lib/time/event-days";
import { applyTimeBlockSelection } from "@/lib/time/range-set";
import {
  buildBufferTimeRangeItems,
  getBufferOverrideKey,
  type BufferTimeRangeItem,
} from "@/lib/time/ranges";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/store/use-selection-store";
import type { Tables } from "@/lib/supabase/database.types";
import type { ReservationStatus, TimeBlockType, TimeRange } from "@/types/domain";

type HostDashboardShellProps = {
  bufferOverrides: EventBufferOverride[];
  event: PublicEvent;
  reservations: HostReservationGroup[];
  reservationSlots: EventScheduleSlot[];
  timeBlocks: Tables<"time_blocks">[];
};

export function HostDashboardShell({
  bufferOverrides,
  event,
  reservations,
  reservationSlots,
  timeBlocks,
}: HostDashboardShellProps) {
  const router = useRouter();
  const [blockType, setBlockType] = useState<TimeBlockType>("AVAILABLE");
  const [bufferMinutes, setBufferMinutes] = useState(event.buffer_time_minutes);
  const [bufferToggleKey, setBufferToggleKey] = useState<string | null>(null);
  const [dateEndDraft, setDateEndDraft] = useState(event.date_end);
  const [dateStartDraft, setDateStartDraft] = useState(event.date_start);
  const [error, setError] = useState<string | null>(null);
  const [focusedReservationId, setFocusedReservationId] = useState<string | null>(
    null,
  );
  const [isBufferAfterActive, setIsBufferAfterActive] = useState(
    event.is_buffer_after_active,
  );
  const [isBufferBeforeActive, setIsBufferBeforeActive] = useState(
    event.is_buffer_before_active,
  );
  const [isBufferPending, setIsBufferPending] = useState(false);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [isDatePending, setIsDatePending] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const confirmedSlots = useMemo(
    () => reservationSlots.filter((slot) => slot.is_confirmed),
    [reservationSlots],
  );
  const inactiveBufferKeys = useMemo(
    () =>
      new Set(
        bufferOverrides
          .filter((override) => !override.is_active)
          .map((override) =>
            getBufferOverrideKey(
              override.reservation_slot_id,
              override.side as EventBufferSide,
            ),
          ),
      ),
    [bufferOverrides],
  );
  const configuredBufferItems = useMemo(
    () =>
      event.is_buffer_active
        ? buildBufferTimeRangeItems(
            confirmedSlots.map((slot) => ({
              endAt: slot.end_at,
              id: slot.id,
              startAt: slot.start_at,
            })),
            event.buffer_time_minutes,
            {
              afterActive: event.is_buffer_after_active,
              beforeActive: event.is_buffer_before_active,
            },
          ).map((item) => ({
            ...item,
            isActive: !inactiveBufferKeys.has(item.id),
            slot: confirmedSlots.find(
              (confirmedSlot) => confirmedSlot.id === item.reservationSlotId,
            ),
          }))
        : [],
    [
      confirmedSlots,
      event.buffer_time_minutes,
      event.is_buffer_active,
      event.is_buffer_after_active,
      event.is_buffer_before_active,
      inactiveBufferKeys,
    ],
  );
  const bufferItems = useMemo(
    () => configuredBufferItems.filter((item) => item.isActive),
    [configuredBufferItems],
  );
  const bufferRanges = useMemo<TimeRange[]>(
    () => bufferItems.map(({ endAt, startAt }) => ({ endAt, startAt })),
    [bufferItems],
  );
  const visibleReservationSlots = useMemo(
    () =>
      focusedReservationId
        ? reservationSlots.filter(
            (slot) =>
              slot.is_confirmed || slot.reservation_id === focusedReservationId,
          )
        : reservationSlots,
    [focusedReservationId, reservationSlots],
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
      blocks: applyTimeBlockSelection(
        timeBlocks.map((block) => ({
          endAt: block.end_at,
          note: block.note,
          startAt: block.start_at,
          type: block.type,
        })),
        selectedRanges.map((range) => ({
          endAt: range.endAt,
          startAt: range.startAt,
        })),
        blockType,
      ),
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
      isBufferActive: isBufferBeforeActive || isBufferAfterActive,
      isBufferAfterActive,
      isBufferBeforeActive,
    });

    setIsBufferPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("버퍼 설정을 저장했습니다.");
    router.refresh();
  }

  async function handleDateSave() {
    setError(null);
    setNotice(null);
    setIsDatePending(true);

    const result = await updateEventDateRange({
      dateEnd: dateEndDraft,
      dateStart: dateStartDraft,
      eventId: event.id,
    });

    setIsDatePending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("날짜 범위를 저장했습니다.");
    setIsDateDialogOpen(false);
    router.refresh();
  }

  async function handleBufferOverrideToggle(
    item: BufferTimeRangeItem & { isActive: boolean },
  ) {
    setError(null);
    setNotice(null);
    setBufferToggleKey(item.id);

    const result = await toggleEventBufferOverride({
      eventId: event.id,
      isActive: !item.isActive,
      reservationSlotId: item.reservationSlotId,
      side: item.side,
    });

    setBufferToggleKey(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice(item.isActive ? "버퍼를 껐습니다." : "버퍼를 켰습니다.");
    router.refresh();
  }

  async function handleReviewReservation(input: {
    confirmedSlotId?: string | null;
    reservationId: string;
    status: Extract<ReservationStatus, "APPROVED" | "PENDING" | "REJECTED">;
  }) {
    const actionKey =
      input.status === "APPROVED"
        ? `${input.reservationId}:${input.confirmedSlotId}:APPROVED`
        : input.status === "PENDING"
          ? `${input.reservationId}:${input.confirmedSlotId}:PENDING`
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

    if (input.status === "APPROVED") {
      setNotice("예약을 승인했습니다.");
      if (
        window.confirm(
          "이 그룹의 후보 시간과 확정 시간만 달력에 보이게 할까요?",
        )
      ) {
        setFocusedReservationId(input.reservationId);
      }
    } else if (input.status === "PENDING") {
      setNotice("확정을 취소하고 대기 상태로 돌렸습니다.");
    } else {
      setNotice("예약을 거절했습니다.");
    }
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-h-96 bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Clock className="size-5" aria-hidden="true" />
            <h2 className="font-serif text-2xl font-semibold">가능 시간</h2>
          </div>
          <Button
            onClick={() => setIsDateDialogOpen(true)}
            size="sm"
            variant="outline"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            날짜 수정
          </Button>
        </div>
        <div className="mt-4">
          <TimeSelectionGrid
            blockedRanges={bufferRanges}
            bufferRanges={bufferRanges}
            dailyEndTime={event.daily_end_time}
            dailyStartTime={event.daily_start_time}
            dateEnd={event.date_end}
            dateStart={event.date_start}
            mode="host-availability"
            occupiedRanges={occupiedRanges}
            reservationSlots={visibleReservationSlots}
            selectedRanges={selectedRanges}
            timeBlocks={timeBlocks}
          />
        </div>
      </div>
      <aside className="space-y-4 border border-border bg-muted p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">공유 코드</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="font-mono text-2xl font-semibold text-primary">
              {event.event_code}
            </p>
            <div className="flex items-center gap-1">
              <CopyButton
                aria-label="이벤트 코드 복사"
                value={event.event_code}
              />
              <CopyButton
                aria-label="이벤트 URL 복사"
                getValue={() =>
                  `${window.location.origin}/event/${event.event_code}`
                }
                icon="share"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">
              버퍼 타임
            </span>
            <span className="text-xs text-muted-foreground">
              {bufferMinutes}분
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <Input
              label="버퍼 시간(분)"
              max={180}
              min={0}
              onChange={(eventChange) =>
                setBufferMinutes(Number(eventChange.target.value))
              }
              step={10}
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
          <div className="grid grid-cols-2 gap-2">
            <label className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background text-sm text-foreground">
              <input
                checked={isBufferBeforeActive}
                className="size-4 accent-primary"
                onChange={(eventChange) =>
                  setIsBufferBeforeActive(eventChange.target.checked)
                }
                type="checkbox"
              />
              약속 전
            </label>
            <label className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background text-sm text-foreground">
              <input
                checked={isBufferAfterActive}
                className="size-4 accent-primary"
                onChange={(eventChange) =>
                  setIsBufferAfterActive(eventChange.target.checked)
                }
                type="checkbox"
              />
              약속 후
            </label>
          </div>
          {configuredBufferItems.length > 0 ? (
            <div className="max-h-40 space-y-2 overflow-auto">
              {configuredBufferItems.map((item) => (
                <div
                  className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-border bg-background px-2 py-2"
                  key={item.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {summarizeSlotName(item.slot)} {item.side === "BEFORE" ? "전" : "후"}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {formatTimeRange(item)}
                    </p>
                  </div>
                  <Button
                    disabled={bufferToggleKey !== null}
                    onClick={() => handleBufferOverrideToggle(item)}
                    size="sm"
                    variant={item.isActive ? "outline" : "ghost"}
                  >
                    {bufferToggleKey === item.id ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : item.isActive ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                    {item.isActive ? "끄기" : "켜기"}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
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
          <div className="flex items-center justify-between gap-3 text-primary">
            <div className="flex items-center gap-2">
              <Users className="size-5" aria-hidden="true" />
              <h2 className="font-serif text-xl font-semibold">
                신청 {reservations.length}건
              </h2>
            </div>
            {focusedReservationId ? (
              <Button
                onClick={() => setFocusedReservationId(null)}
                size="sm"
                variant="ghost"
              >
                <Eye className="size-4" aria-hidden="true" />
                전체
              </Button>
            ) : null}
          </div>
          <div className="max-h-[32rem] overflow-auto">
            {reservations.length > 0 ? (
              <div className="divide-y divide-border">
                {reservations.map((reservation) => (
                  <ReservationReviewItem
                    focused={focusedReservationId === reservation.id}
                    key={reservation.id}
                    onFocus={() =>
                      setFocusedReservationId((current) =>
                        current === reservation.id ? null : reservation.id,
                      )
                    }
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
      {isDateDialogOpen ? (
        <DateRangeDialog
          dateEnd={dateEndDraft}
          dateStart={dateStartDraft}
          isPending={isDatePending}
          onChange={(nextStart, nextEnd) => {
            setDateStartDraft(nextStart);
            setDateEndDraft(nextEnd);
          }}
          onClose={() => setIsDateDialogOpen(false)}
          onSave={handleDateSave}
        />
      ) : null}
    </div>
  );
}

function ReservationReviewItem({
  focused,
  onFocus,
  onReview,
  reservation,
  reviewingKey,
}: {
  focused: boolean;
  onFocus: () => void;
  onReview: (input: {
    confirmedSlotId?: string | null;
    reservationId: string;
    status: Extract<ReservationStatus, "APPROVED" | "PENDING" | "REJECTED">;
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
        <div className="flex shrink-0 items-center gap-1">
          <Button onClick={onFocus} size="sm" variant={focused ? "primary" : "ghost"}>
            {focused ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
            보기
          </Button>
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
      </div>

      <div className="space-y-2">
        {reservation.slots.map((slot) => {
          const approveKey = `${reservation.id}:${slot.id}:APPROVED`;
          const pendingKey = `${reservation.id}:${slot.id}:PENDING`;
          const nextStatus = slot.is_confirmed ? "PENDING" : "APPROVED";

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
                    status: nextStatus,
                  })
                }
                size="sm"
                variant={slot.is_confirmed ? "primary" : "outline"}
              >
                {reviewingKey === approveKey || reviewingKey === pendingKey ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : slot.is_confirmed ? (
                  <X className="size-4" aria-hidden="true" />
                ) : (
                  <Check className="size-4" aria-hidden="true" />
                )}
                {slot.is_confirmed ? "취소" : "승인"}
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

function DateRangeDialog({
  dateEnd,
  dateStart,
  isPending,
  onChange,
  onClose,
  onSave,
}: {
  dateEnd: string;
  dateStart: string;
  isPending: boolean;
  onChange: (dateStart: string, dateEnd: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md border border-border bg-background p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-accent">Event dates</p>
            <h3 className="font-serif text-2xl font-semibold text-primary">
              날짜 수정
            </h3>
          </div>
          <Button onClick={onClose} size="sm" variant="ghost">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <MiniDateRangePicker
          dateEnd={dateEnd}
          dateStart={dateStart}
          onChange={onChange}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Input
            label="시작일"
            onChange={(event) => onChange(event.target.value, dateEnd)}
            type="date"
            value={dateStart}
          />
          <Input
            label="종료일"
            onChange={(event) => onChange(dateStart, event.target.value)}
            type="date"
            value={dateEnd}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button disabled={isPending} onClick={onClose} variant="outline">
            닫기
          </Button>
          <Button disabled={isPending} onClick={onSave}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}

function MiniDateRangePicker({
  dateEnd,
  dateStart,
  onChange,
}: {
  dateEnd: string;
  dateStart: string;
  onChange: (dateStart: string, dateEnd: string) => void;
}) {
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const [monthDate, setMonthDate] = useState(() => parseDateOnly(dateStart));
  const days = useMemo(() => buildMonthDays(monthDate), [monthDate]);
  const monthLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    year: "numeric",
  }).format(monthDate);

  function moveMonth(offset: number) {
    setMonthDate((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + offset);
      return next;
    });
  }

  function updateRange(nextDate: string) {
    const start = anchorDate ?? nextDate;

    if (nextDate < start) {
      onChange(nextDate, start);
      return;
    }

    onChange(start, nextDate);
  }

  return (
    <div className="border border-border bg-muted p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          aria-label="이전 달"
          className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-primary"
          onClick={() => moveMonth(-1)}
          type="button"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <p className="font-serif text-lg font-semibold text-primary">
          {monthLabel}
        </p>
        <button
          aria-label="다음 달"
          className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-primary"
          onClick={() => moveMonth(1)}
          type="button"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => (
          <div className="py-1" key={weekday}>
            {weekday}
          </div>
        ))}
      </div>
      <div
        className="mt-1 grid grid-cols-7 gap-1"
        onPointerCancel={() => setAnchorDate(null)}
        onPointerUp={() => setAnchorDate(null)}
      >
        {days.map((day, index) =>
          day ? (
            <button
              className={cn(
                "h-9 rounded-md border text-sm font-medium",
                dateStart <= day && day <= dateEnd
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground",
              )}
              key={day}
              onPointerDown={(event) => {
                event.preventDefault();
                setAnchorDate(day);
                onChange(day, day);
              }}
              onPointerEnter={() => {
                if (anchorDate) {
                  updateRange(day);
                }
              }}
              type="button"
            >
              {Number(day.slice(-2))}
            </button>
          ) : (
            <div key={`blank-${monthLabel}-${index}`} />
          ),
        )}
      </div>
    </div>
  );
}

function summarizeSlotName(slot?: EventScheduleSlot) {
  if (!slot || slot.participantNames.length === 0) {
    return "예약";
  }

  if (slot.participantNames.length === 1) {
    return `${slot.participantNames[0]} (${slot.headcount}명)`;
  }

  return `${slot.participantNames[0]} 외 ${slot.participantNames.length - 1}명 (${slot.headcount}명)`;
}

function buildMonthDays(monthDate: Date) {
  const firstDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const days: Array<string | null> = Array.from(
    { length: firstDate.getDay() },
    () => null,
  );

  for (let day = 1; day <= lastDate.getDate(); day += 1) {
    days.push(
      toDateInputValue(new Date(monthDate.getFullYear(), monthDate.getMonth(), day)),
    );
  }

  return days;
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}
