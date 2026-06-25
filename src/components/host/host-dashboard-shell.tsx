"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  SlidersHorizontal,
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
  updateConfirmedReservationSlotTime,
  type HostReservationGroup,
} from "@/app/actions/reservations";
import { saveTimeBlocks } from "@/app/actions/time-blocks";
import type { PublicEvent } from "@/app/actions/events";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import {
  TimeSelectionGrid,
  type CalendarBufferItem,
} from "@/components/calendar/time-selection-grid";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { formatTimeRange } from "@/lib/time/event-days";
import {
  applyAvailabilityToggleSelection,
  applyTimeBlockSelection,
} from "@/lib/time/range-set";
import {
  buildBufferTimeRangeItems,
  getBufferOverrideKey,
} from "@/lib/time/ranges";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/store/use-selection-store";
import type { Tables } from "@/lib/supabase/database.types";
import type { ReservationStatus, TimeRange } from "@/types/domain";

type HostDashboardShellProps = {
  activeDates: string[];
  bufferOverrides: EventBufferOverride[];
  event: PublicEvent;
  reservations: HostReservationGroup[];
  reservationSlots: EventScheduleSlot[];
  timeBlocks: Tables<"time_blocks">[];
};

export function HostDashboardShell({
  activeDates,
  bufferOverrides,
  event,
  reservations,
  reservationSlots,
  timeBlocks,
}: HostDashboardShellProps) {
  const router = useRouter();
  const [bufferMinutes, setBufferMinutes] = useState(event.buffer_time_minutes);
  const [, setBufferToggleKey] = useState<string | null>(null);
  const [activeDateDrafts, setActiveDateDrafts] = useState(activeDates);
  const [collapsedReservationIds, setCollapsedReservationIds] = useState<
    Set<string>
  >(() => new Set());
  const [hiddenPendingReservationIds, setHiddenPendingReservationIds] =
    useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [focusedReservationId, setFocusedReservationId] = useState<string | null>(
    null,
  );
  const [hoveredReservationId, setHoveredReservationId] = useState<string | null>(
    null,
  );
  const [isBufferAfterActive, setIsBufferAfterActive] = useState(
    event.is_buffer_after_active,
  );
  const [isBufferBeforeActive, setIsBufferBeforeActive] = useState(
    event.is_buffer_before_active,
  );
  const [isBufferDialogOpen, setIsBufferDialogOpen] = useState(false);
  const [isBufferSectionOpen, setIsBufferSectionOpen] = useState(false);
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
  const bufferOverrideByKey = useMemo(
    () =>
      new Map(
        bufferOverrides.map((override) => [
          getBufferOverrideKey(
            override.reservation_slot_id,
            override.side as EventBufferSide,
          ),
          override,
        ]),
      ),
    [bufferOverrides],
  );
  const configuredBufferItems = useMemo(
    () =>
      buildBufferTimeRangeItems(
        confirmedSlots.map((slot) => ({
          endAt: slot.end_at,
          id: slot.id,
          startAt: slot.start_at,
        })),
        event.buffer_time_minutes,
        {
          afterActive: true,
          beforeActive: true,
        },
      ).map((item) => {
        const override = bufferOverrideByKey.get(item.id);
        const globallyActive =
          event.is_buffer_active &&
          (item.side === "BEFORE"
            ? event.is_buffer_before_active
            : event.is_buffer_after_active);
        const isActive = override ? override.is_active : globallyActive;

        return {
          ...item,
          endAt: override?.custom_end_at ?? item.endAt,
          isActive,
          override,
          slot: confirmedSlots.find(
            (confirmedSlot) => confirmedSlot.id === item.reservationSlotId,
          ),
          startAt: override?.custom_start_at ?? item.startAt,
        };
      }),
    [
      bufferOverrideByKey,
      confirmedSlots,
      event.buffer_time_minutes,
      event.is_buffer_active,
      event.is_buffer_after_active,
      event.is_buffer_before_active,
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
  const confirmedReservationIds = useMemo(
    () =>
      new Set(
        reservationSlots
          .filter((slot) => slot.is_confirmed)
          .map((slot) => slot.reservation_id),
      ),
    [reservationSlots],
  );
  const activeFocusedReservationId = focusedReservationId ?? hoveredReservationId;
  const visibleReservationSlots = useMemo(
    () => {
      if (activeFocusedReservationId) {
        return reservationSlots.filter(
          (slot) =>
            slot.is_confirmed ||
            slot.reservation_id === activeFocusedReservationId,
        );
      }

      return reservationSlots.filter((slot) => {
        if (slot.is_confirmed) {
          return true;
        }

        if (confirmedReservationIds.has(slot.reservation_id)) {
          return false;
        }

        return !hiddenPendingReservationIds.has(slot.reservation_id);
      });
    },
    [
      activeFocusedReservationId,
      confirmedReservationIds,
      hiddenPendingReservationIds,
      reservationSlots,
    ],
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
      blocks: applyAvailabilityToggleSelection(
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
    setIsBufferDialogOpen(false);
    router.refresh();
  }

  async function handleDateSave() {
    setError(null);
    setNotice(null);
    setIsDatePending(true);

    const result = await updateEventDateRange({
      activeDates: activeDateDrafts,
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

  async function handleAddBuffer(
    slot: EventScheduleSlot,
    side: EventBufferSide,
  ) {
    const item = configuredBufferItems.find(
      (bufferItem) =>
        bufferItem.reservationSlotId === slot.id && bufferItem.side === side,
    );

    if (!item) {
      return;
    }

    setError(null);
    setNotice(null);
    setBufferToggleKey(item.id);

    const result = await toggleEventBufferOverride({
      customEndAt: item.endAt,
      customStartAt: item.startAt,
      eventId: event.id,
      isActive: true,
      reservationSlotId: item.reservationSlotId,
      side: item.side,
    });

    setBufferToggleKey(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("버퍼를 추가했습니다.");
    router.refresh();
  }

  async function handleRemoveBuffer(item: CalendarBufferItem) {
    setError(null);
    setNotice(null);
    setBufferToggleKey(item.id);

    const result = await toggleEventBufferOverride({
      eventId: event.id,
      isActive: false,
      reservationSlotId: item.reservationSlotId,
      side: item.side,
    });

    setBufferToggleKey(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("버퍼를 삭제했습니다.");
    router.refresh();
  }

  async function handleResizeBuffer(item: CalendarBufferItem, range: TimeRange) {
    setError(null);
    setNotice(null);
    setBufferToggleKey(item.id);

    const result = await toggleEventBufferOverride({
      customEndAt: range.endAt,
      customStartAt: range.startAt,
      eventId: event.id,
      isActive: true,
      reservationSlotId: item.reservationSlotId,
      side: item.side,
    });

    setBufferToggleKey(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("버퍼 시간을 조정했습니다.");
    router.refresh();
  }

  async function handleResizeConfirmedSlot(
    slot: EventScheduleSlot,
    range: TimeRange,
  ) {
    const currentStart = new Date(slot.start_at).getTime();
    const currentEnd = new Date(slot.end_at).getTime();
    const nextStart = new Date(range.startAt).getTime();
    const nextEnd = new Date(range.endAt).getTime();

    if (
      (nextStart < currentStart || nextEnd > currentEnd) &&
      !window.confirm("기존 펜딩 시간대보다 크게 확정됩니다. 계속할까요?")
    ) {
      return;
    }

    setError(null);
    setNotice(null);

    const result = await updateConfirmedReservationSlotTime({
      eventId: event.id,
      slotId: slot.id,
      timeRange: range,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("확정 일정 시간을 조정했습니다.");
    router.refresh();
  }

  async function handleResizeTimeBlock(
    block: Tables<"time_blocks">,
    range: TimeRange,
  ) {
    setError(null);
    setNotice(null);
    setIsPending(true);

    const result = await saveTimeBlocks({
      blocks: applyTimeBlockSelection(
        timeBlocks
          .filter((timeBlock) => timeBlock.id !== block.id)
          .map((timeBlock) => ({
            endAt: timeBlock.end_at,
            note: timeBlock.note,
            startAt: timeBlock.start_at,
            type: timeBlock.type,
          })),
        [range],
        "AVAILABLE",
      ),
      eventId: event.id,
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("가능 시간 크기를 조정했습니다.");
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
      setFocusedReservationId(null);
      setHoveredReservationId(null);
      setHiddenPendingReservationIds((current) => {
        const next = new Set(current);
        next.delete(input.reservationId);
        return next;
      });
    } else if (input.status === "PENDING") {
      setNotice("확정을 취소하고 대기 상태로 돌렸습니다.");
    } else {
      setNotice("예약을 거절했습니다.");
    }
    router.refresh();
  }

  function openBufferDialog() {
    setBufferMinutes(event.buffer_time_minutes);
    setIsBufferAfterActive(event.is_buffer_after_active);
    setIsBufferBeforeActive(event.is_buffer_before_active);
    setIsBufferDialogOpen(true);
  }

  function closeBufferDialog() {
    setBufferMinutes(event.buffer_time_minutes);
    setIsBufferAfterActive(event.is_buffer_after_active);
    setIsBufferBeforeActive(event.is_buffer_before_active);
    setIsBufferDialogOpen(false);
  }

  function openDateDialog() {
    setActiveDateDrafts(activeDates);
    setIsDateDialogOpen(true);
  }

  function closeDateDialog() {
    setActiveDateDrafts(activeDates);
    setIsDateDialogOpen(false);
  }

  function togglePendingHidden(reservationId: string) {
    setHiddenPendingReservationIds((current) => {
      const next = new Set(current);

      if (next.has(reservationId)) {
        next.delete(reservationId);
      } else {
        next.add(reservationId);
      }

      return next;
    });
  }

  function toggleReservationCollapsed(reservationId: string) {
    setCollapsedReservationIds((current) => {
      const next = new Set(current);

      if (next.has(reservationId)) {
        next.delete(reservationId);
      } else {
        next.add(reservationId);
      }

      return next;
    });
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
            onClick={openDateDialog}
            size="sm"
            variant="outline"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            날짜 수정
          </Button>
        </div>
        <div className="mt-4">
          <TimeSelectionGrid
            activeDates={activeDates}
            bufferItems={bufferItems}
            blockedRanges={bufferRanges}
            bufferRanges={bufferRanges}
            dailyEndTime={event.daily_end_time}
            dailyStartTime={event.daily_start_time}
            dateEnd={event.date_end}
            dateStart={event.date_start}
            mode="host-availability"
            onAddBuffer={handleAddBuffer}
            onApproveSlot={(slot) =>
              handleReviewReservation({
                confirmedSlotId: slot.id,
                reservationId: slot.reservation_id,
                status: "APPROVED",
              })
            }
            onCancelSlot={(slot) =>
              handleReviewReservation({
                confirmedSlotId: slot.id,
                reservationId: slot.reservation_id,
                status: "PENDING",
              })
            }
            onPinReservationPending={(reservationId) => {
              setFocusedReservationId((current) =>
                current === reservationId ? null : reservationId,
              );
              setHoveredReservationId(null);
            }}
            onPreviewReservationPending={setHoveredReservationId}
            onRejectReservation={(reservationId) =>
              handleReviewReservation({
                reservationId,
                status: "REJECTED",
              })
            }
            onRemoveBuffer={handleRemoveBuffer}
            onResizeBuffer={handleResizeBuffer}
            onResizeSlot={handleResizeConfirmedSlot}
            onResizeTimeBlock={handleResizeTimeBlock}
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
          <button
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setIsBufferSectionOpen((open) => !open)}
            type="button"
          >
            <span className="text-sm font-medium text-foreground">
              버퍼 설정
            </span>
            {isBufferSectionOpen ? (
              <ChevronUp className="size-4 text-primary" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4 text-primary" aria-hidden="true" />
            )}
          </button>
          {isBufferSectionOpen ? (
            <div className="space-y-3 rounded-md border border-border bg-background px-3 py-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-muted-foreground">시간</p>
                  <p className="mt-1 font-mono font-semibold text-primary">
                    {event.buffer_time_minutes}분
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">약속 전</p>
                  <p className="mt-1 font-semibold text-primary">
                    {event.is_buffer_active && event.is_buffer_before_active
                      ? "생성"
                      : "없음"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">약속 후</p>
                  <p className="mt-1 font-semibold text-primary">
                    {event.is_buffer_active && event.is_buffer_after_active
                      ? "생성"
                      : "없음"}
                  </p>
                </div>
              </div>
              <Button className="w-full" onClick={openBufferDialog} variant="outline">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                설정 수정
              </Button>
            </div>
          ) : null}
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
          선택 적용
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
                    collapsed={collapsedReservationIds.has(reservation.id)}
                    focused={focusedReservationId === reservation.id}
                    hasConfirmed={confirmedReservationIds.has(reservation.id)}
                    hiddenPending={hiddenPendingReservationIds.has(reservation.id)}
                    key={reservation.id}
                    onCollapseToggle={() =>
                      toggleReservationCollapsed(reservation.id)
                    }
                    onFocus={() => {
                      setFocusedReservationId((current) =>
                        current === reservation.id ? null : reservation.id,
                      );
                      setHoveredReservationId(null);
                    }}
                    onHideToggle={() => togglePendingHidden(reservation.id)}
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
          activeDates={activeDateDrafts}
          dateStart={event.date_start}
          isPending={isDatePending}
          onChange={setActiveDateDrafts}
          onClose={closeDateDialog}
          onSave={handleDateSave}
        />
      ) : null}
      {isBufferDialogOpen ? (
        <BufferSettingsDialog
          bufferMinutes={bufferMinutes}
          isBufferAfterActive={isBufferAfterActive}
          isBufferBeforeActive={isBufferBeforeActive}
          isPending={isBufferPending}
          onBufferMinutesChange={setBufferMinutes}
          onClose={closeBufferDialog}
          onIsBufferAfterActiveChange={setIsBufferAfterActive}
          onIsBufferBeforeActiveChange={setIsBufferBeforeActive}
          onSave={handleBufferSave}
        />
      ) : null}
    </div>
  );
}

function ReservationReviewItem({
  collapsed,
  focused,
  hasConfirmed,
  hiddenPending,
  onCollapseToggle,
  onFocus,
  onHideToggle,
  onReview,
  reservation,
  reviewingKey,
}: {
  collapsed: boolean;
  focused: boolean;
  hasConfirmed: boolean;
  hiddenPending: boolean;
  onCollapseToggle: () => void;
  onFocus: () => void;
  onHideToggle: () => void;
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
          {hasConfirmed ? (
            <Button
              onClick={onFocus}
              size="sm"
              variant={focused ? "primary" : "ghost"}
            >
              {focused ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
              펜딩
            </Button>
          ) : (
            <Button
              onClick={onHideToggle}
              size="sm"
              variant={hiddenPending ? "primary" : "ghost"}
            >
              {hiddenPending ? (
                <Eye className="size-4" aria-hidden="true" />
              ) : (
                <EyeOff className="size-4" aria-hidden="true" />
              )}
              {hiddenPending ? "보기" : "안 보기"}
            </Button>
          )}
          <Button onClick={onCollapseToggle} size="sm" variant="ghost">
            {collapsed ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronUp className="size-4" aria-hidden="true" />
            )}
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

      {!collapsed ? (
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
      ) : null}
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

function BufferSettingsDialog({
  bufferMinutes,
  isBufferAfterActive,
  isBufferBeforeActive,
  isPending,
  onBufferMinutesChange,
  onClose,
  onIsBufferAfterActiveChange,
  onIsBufferBeforeActiveChange,
  onSave,
}: {
  bufferMinutes: number;
  isBufferAfterActive: boolean;
  isBufferBeforeActive: boolean;
  isPending: boolean;
  onBufferMinutesChange: (value: number) => void;
  onClose: () => void;
  onIsBufferAfterActiveChange: (value: boolean) => void;
  onIsBufferBeforeActiveChange: (value: boolean) => void;
  onSave: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/30 p-4 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md border border-border bg-background p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-accent">Buffer</p>
            <h3 className="font-serif text-2xl font-semibold text-primary">
              버퍼 설정 수정
            </h3>
          </div>
          <Button onClick={onClose} size="sm" variant="ghost">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-4">
          <Input
            label="일괄 버퍼 시간(분)"
            max={180}
            min={0}
            onChange={(event) =>
              onBufferMinutesChange(Number(event.target.value))
            }
            step={10}
            type="number"
            value={bufferMinutes}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-muted text-sm text-foreground">
              <input
                checked={isBufferBeforeActive}
                className="size-4 accent-primary"
                onChange={(event) =>
                  onIsBufferBeforeActiveChange(event.target.checked)
                }
                type="checkbox"
              />
              확정 전 생성
            </label>
            <label className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-muted text-sm text-foreground">
              <input
                checked={isBufferAfterActive}
                className="size-4 accent-primary"
                onChange={(event) =>
                  onIsBufferAfterActiveChange(event.target.checked)
                }
                type="checkbox"
              />
              확정 후 생성
            </label>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              onIsBufferBeforeActiveChange(false);
              onIsBufferAfterActiveChange(false);
            }}
            variant="outline"
          >
            <EyeOff className="size-4" aria-hidden="true" />
            버퍼 일괄 제외
          </Button>
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

function DateRangeDialog({
  activeDates,
  dateStart,
  isPending,
  onChange,
  onClose,
  onSave,
}: {
  activeDates: string[];
  dateStart: string;
  isPending: boolean;
  onChange: (activeDates: string[]) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/30 p-4 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
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
          activeDates={activeDates}
          initialDateStart={dateStart}
          onChange={onChange}
        />
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          활성 날짜를 클릭하거나 드래그해서 켜고 끌 수 있습니다.
        </p>
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
  activeDates,
  initialDateStart,
  onChange,
}: {
  activeDates: string[];
  initialDateStart: string;
  onChange: (activeDates: string[]) => void;
}) {
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const [dragPreviewDates, setDragPreviewDates] = useState<string[]>([]);
  const [dragMode, setDragMode] = useState<"activate" | "deactivate" | null>(
    null,
  );
  const [monthDate, setMonthDate] = useState(() =>
    parseDateOnly(initialDateStart),
  );
  const days = useMemo(() => buildMonthDays(monthDate), [monthDate]);
  const activeDateSet = useMemo(() => new Set(activeDates), [activeDates]);
  const previewDateSet = useMemo(
    () => new Set(dragPreviewDates),
    [dragPreviewDates],
  );
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

  function getRangeDates(nextDate: string) {
    const start = anchorDate ?? nextDate;
    const [from, to] = nextDate < start ? [nextDate, start] : [start, nextDate];

    return buildDateList(from, to);
  }

  function updatePreview(nextDate: string) {
    setDragPreviewDates(getRangeDates(nextDate));
  }

  function commitPreview() {
    if (!dragMode) {
      return;
    }

    const nextActiveDates = new Set(activeDates);

    for (const date of dragPreviewDates) {
      if (dragMode === "activate") {
        nextActiveDates.add(date);
      } else {
        nextActiveDates.delete(date);
      }
    }

    onChange([...nextActiveDates].sort());
    setAnchorDate(null);
    setDragMode(null);
    setDragPreviewDates([]);
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
        onPointerCancel={() => {
          setAnchorDate(null);
          setDragMode(null);
          setDragPreviewDates([]);
        }}
        onPointerUp={commitPreview}
      >
        {days.map((day, index) =>
          day ? (
            <button
              className={cn(
                "h-9 rounded-md border text-sm font-medium",
                getDateButtonActiveState(day, activeDateSet, previewDateSet, dragMode)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground",
              )}
              key={day}
              onPointerDown={(event) => {
                event.preventDefault();
                setAnchorDate(day);
                setDragMode(activeDateSet.has(day) ? "deactivate" : "activate");
                setDragPreviewDates([day]);
              }}
              onPointerEnter={() => {
                if (anchorDate) {
                  updatePreview(day);
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

function getDateButtonActiveState(
  date: string,
  activeDateSet: Set<string>,
  previewDateSet: Set<string>,
  dragMode: "activate" | "deactivate" | null,
) {
  if (!previewDateSet.has(date) || !dragMode) {
    return activeDateSet.has(date);
  }

  return dragMode === "activate";
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

function buildDateList(dateStart: string, dateEnd: string) {
  const dates: string[] = [];
  const current = new Date(`${dateStart}T00:00:00`);
  const end = new Date(`${dateEnd}T00:00:00`);

  while (current.getTime() <= end.getTime()) {
    dates.push(toDateInputValue(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
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
