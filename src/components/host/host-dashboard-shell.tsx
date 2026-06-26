"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import {
  toggleEventBufferOverride,
  updateEventBufferSettings,
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
import { Input } from "@/components/ui/input";
import { getSlotDisplayRange } from "@/lib/reservations/slots";
import {
  formatCompactDateWithWeekday,
  getWeekdayTextClass,
} from "@/lib/time/calendar-style";
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
  const autoSaveInFlightRef = useRef(false);
  const autoSaveSelectionKeyRef = useRef<string | null>(null);
  const [bufferMinutes, setBufferMinutes] = useState(event.buffer_time_minutes);
  const [bufferToggleKey, setBufferToggleKey] = useState<string | null>(null);
  const [optimisticTimeBlocks, setOptimisticTimeBlocks] = useState<
    Tables<"time_blocks">[] | null
  >(null);
  const effectiveTimeBlocks = optimisticTimeBlocks ?? timeBlocks;
  const defaultVisibleWeekStart = useMemo(
    () => getWeekStartDate(activeDates[0] ?? event.date_start),
    [activeDates, event.date_start]
  );
  const [collapsedReservationIds, setCollapsedReservationIds] = useState<
    Set<string>
  >(() => new Set());
  const [hiddenPendingReservationIds, setHiddenPendingReservationIds] =
    useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [focusedReservationId, setFocusedReservationId] = useState<
    string | null
  >(null);
  const [hoveredReservationId, setHoveredReservationId] = useState<
    string | null
  >(null);
  const [isBufferAfterActive, setIsBufferAfterActive] = useState(
    event.is_buffer_after_active
  );
  const [isBufferBeforeActive, setIsBufferBeforeActive] = useState(
    event.is_buffer_before_active
  );
  const [isBufferDialogOpen, setIsBufferDialogOpen] = useState(false);
  const [isBufferSectionOpen, setIsBufferSectionOpen] = useState(false);
  const [isBufferPending, setIsBufferPending] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewApprovalSlotId, setPreviewApprovalSlotId] = useState<
    string | null
  >(null);
  const [previewApprovalReservationId, setPreviewApprovalReservationId] =
    useState<string | null>(null);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const [visibleWeekStart, setVisibleWeekStart] = useState<string | null>(
    defaultVisibleWeekStart
  );
  const effectiveVisibleWeekStart =
    visibleWeekStart &&
    activeDates.some(
      (activeDate) => getWeekStartDate(activeDate) === visibleWeekStart
    )
      ? visibleWeekStart
      : defaultVisibleWeekStart;
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const confirmedSlots = useMemo(
    () => reservationSlots.filter((slot) => slot.is_confirmed),
    [reservationSlots]
  );
  const bufferOverrideByKey = useMemo(
    () =>
      new Map(
        bufferOverrides.map((override) => [
          getBufferOverrideKey(
            override.reservation_slot_id,
            override.side as EventBufferSide
          ),
          override,
        ])
      ),
    [bufferOverrides]
  );

  const configuredBufferItems = useMemo(
    () =>
      buildBufferTimeRangeItems(
        confirmedSlots.map((slot) => ({
          ...getSlotDisplayRange(slot),
          id: slot.id,
        })),
        event.buffer_time_minutes,
        {
          afterActive: true,
          beforeActive: true,
        }
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
            (confirmedSlot) => confirmedSlot.id === item.reservationSlotId
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
    ]
  );
  const bufferItems = useMemo(
    () => configuredBufferItems.filter((item) => item.isActive),
    [configuredBufferItems]
  );
  const bufferRanges = useMemo<TimeRange[]>(
    () => bufferItems.map(({ endAt, startAt }) => ({ endAt, startAt })),
    [bufferItems]
  );
  const confirmedReservationIds = useMemo(
    () =>
      new Set(
        reservationSlots
          .filter((slot) => slot.is_confirmed)
          .map((slot) => slot.reservation_id)
      ),
    [reservationSlots]
  );
  const activeFocusedReservationId =
    focusedReservationId ?? hoveredReservationId ?? previewApprovalReservationId;
  const visibleReservationSlots = useMemo(() => {
    if (activeFocusedReservationId) {
      const confirmedSlotsToDisplay = reservationSlots.filter(
        (slot) => slot.is_confirmed
      );
      const focusedCandidateSlots = reservationSlots
        .filter((slot) => slot.reservation_id === activeFocusedReservationId)
        .map((slot) =>
          slot.is_confirmed
            ? {
                ...slot,
                id: `${slot.id}:pending-overlay`,
                is_confirmed: false,
              }
            : slot
        );

      return [...confirmedSlotsToDisplay, ...focusedCandidateSlots];
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
  }, [
    activeFocusedReservationId,
    confirmedReservationIds,
    hiddenPendingReservationIds,
    reservationSlots,
  ]);
  const occupiedRanges = useMemo<TimeRange[]>(
    () => reservationSlots.map((slot) => getSlotDisplayRange(slot)),
    [reservationSlots]
  );

  useEffect(() => {
    clearSelection();
  }, [clearSelection, event.id]);

  useEffect(() => {
    if (selectedRanges.length === 0) {
      autoSaveSelectionKeyRef.current = null;
      return;
    }

    const selectionKey = selectedRanges
      .map((range) => `${range.startAt}:${range.endAt}`)
      .join("|");

    if (
      autoSaveInFlightRef.current ||
      autoSaveSelectionKeyRef.current === selectionKey
    ) {
      return;
    }

    let isCancelled = false;
    autoSaveInFlightRef.current = true;
    autoSaveSelectionKeyRef.current = selectionKey;

    async function saveSelection() {
      setError(null);
      setNotice("변경 사항을 저장하고 있습니다.");
      setIsPending(true);

      const result = await saveTimeBlocks({
        blocks: applyAvailabilityToggleSelection(
          effectiveTimeBlocks.map((block) => ({
            endAt: block.end_at,
            note: block.note,
            startAt: block.start_at,
            type: block.type,
          })),
          selectedRanges.map((range) => ({
            endAt: range.endAt,
            startAt: range.startAt,
          }))
        ),
        eventId: event.id,
      });

      if (isCancelled) {
        return;
      }

      autoSaveInFlightRef.current = false;

      if (!result.ok) {
        setError(result.error);
        setNotice(null);
        setIsPending(false);
        return;
      }

      setOptimisticTimeBlocks(result.data.timeBlocks);
      clearSelection();
      autoSaveSelectionKeyRef.current = null;
      setNotice("가능 시간을 저장했습니다.");
      setIsPending(false);
      router.refresh();
    }

    void saveSelection();

    return () => {
      isCancelled = true;
      autoSaveInFlightRef.current = false;
    };
  }, [clearSelection, effectiveTimeBlocks, event.id, router, selectedRanges]);

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

  async function handleAddBuffer(
    slot: EventScheduleSlot,
    side: EventBufferSide
  ) {
    const item = configuredBufferItems.find(
      (bufferItem) =>
        bufferItem.reservationSlotId === slot.id && bufferItem.side === side
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

  async function handleResizeBuffer(
    item: CalendarBufferItem,
    range: TimeRange
  ) {
    const confirmedSlot = confirmedSlots.find(
      (slot) => slot.id === item.reservationSlotId
    );
    const safeRange = confirmedSlot
      ? clampBufferRangeToConfirmedSlot(
          range,
          getSlotDisplayRange(confirmedSlot),
          item.side
        )
      : range;

    setError(null);
    setNotice(null);
    setBufferToggleKey(item.id);

    const result = await toggleEventBufferOverride({
      customEndAt: safeRange.endAt,
      customStartAt: safeRange.startAt,
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
    range: TimeRange
  ) {
    const candidateStart = new Date(slot.start_at).getTime();
    const candidateEnd = new Date(slot.end_at).getTime();
    const nextStart = new Date(range.startAt).getTime();
    const nextEnd = new Date(range.endAt).getTime();

    if (
      (nextStart < candidateStart || nextEnd > candidateEnd) &&
      !window.confirm("기존 후보 시간보다 크게 확정됩니다. 계속할까요?")
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
    range: TimeRange
  ) {
    setError(null);
    setNotice(null);
    setIsPending(true);

    const result = await saveTimeBlocks({
      blocks: applyTimeBlockSelection(
        effectiveTimeBlocks
          .filter((timeBlock) => timeBlock.id !== block.id)
          .map((timeBlock) => ({
            endAt: timeBlock.end_at,
            note: timeBlock.note,
            startAt: timeBlock.start_at,
            type: timeBlock.type,
          })),
        [range],
        "AVAILABLE"
      ),
      eventId: event.id,
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOptimisticTimeBlocks(result.data.timeBlocks);
    setNotice("가능 시간 크기를 조정했습니다.");
    router.refresh();
  }

  async function handleReviewReservation(input: {
    confirmedSlotId?: string | null;
    reservationId: string;
    status: Extract<ReservationStatus, "APPROVED" | "PENDING">;
  }) {
    const actionKey =
      input.status === "APPROVED"
        ? `${input.reservationId}:${input.confirmedSlotId}:APPROVED`
        : `${input.reservationId}:${input.confirmedSlotId}:PENDING`;

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
      setPreviewApprovalReservationId(null);
      setPreviewApprovalSlotId(null);
      setHiddenPendingReservationIds((current) => {
        const next = new Set(current);
        next.delete(input.reservationId);
        return next;
      });
    } else if (input.status === "PENDING") {
      setNotice("확정을 취소하고 대기 상태로 돌렸습니다.");
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
              current === reservationId ? null : reservationId
            );
            setHoveredReservationId(null);
          }}
          onPreviewReservationPending={setHoveredReservationId}
          onRemoveBuffer={handleRemoveBuffer}
          onResizeBuffer={handleResizeBuffer}
          onResizeSlot={handleResizeConfirmedSlot}
          onResizeTimeBlock={handleResizeTimeBlock}
          occupiedRanges={occupiedRanges}
          readOnly={isPending}
          reservationSlots={visibleReservationSlots}
          selectedRanges={selectedRanges}
          timeBlocks={effectiveTimeBlocks}
          bufferTimeMinutes={event.buffer_time_minutes}
          pendingBufferActionKey={bufferToggleKey}
          previewApprovalSlotId={previewApprovalSlotId}
          visibleWeekStart={effectiveVisibleWeekStart}
          onVisibleWeekStartChange={setVisibleWeekStart}
        />
      </div>
      <aside className="space-y-4 border border-border bg-muted p-4">
        <EventWeekMiniCalendar
          activeDates={activeDates}
          key={effectiveVisibleWeekStart}
          selectedWeekStart={effectiveVisibleWeekStart}
          onWeekStartChange={setVisibleWeekStart}
        />

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
              <Button
                className="w-full"
                onClick={openBufferDialog}
                variant="outline"
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                설정 수정
              </Button>
            </div>
          ) : null}
        </div>

        {isPending ? (
          <p className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            <Loader2
              className="size-4 animate-spin text-primary"
              aria-hidden="true"
            />
            드래그 변경사항 저장 중
          </p>
        ) : null}

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
              <div className="space-y-2">
                {reservations.map((reservation) => (
                  <ReservationReviewItem
                    collapsed={collapsedReservationIds.has(reservation.id)}
                    focused={focusedReservationId === reservation.id}
                    hasConfirmed={confirmedReservationIds.has(reservation.id)}
                    hiddenPending={hiddenPendingReservationIds.has(
                      reservation.id
                    )}
                    key={reservation.id}
                    onCollapseToggle={() =>
                      toggleReservationCollapsed(reservation.id)
                    }
                    onFocus={() => {
                      setFocusedReservationId((current) =>
                        current === reservation.id ? null : reservation.id
                      );
                      setHoveredReservationId(null);
                    }}
                    onHideToggle={() => togglePendingHidden(reservation.id)}
                    onReview={handleReviewReservation}
                    onSlotHover={(slotId, reservationId) => {
                      setPreviewApprovalSlotId(slotId);
                      setPreviewApprovalReservationId(reservationId ?? null);
                    }}
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

function EventWeekMiniCalendar({
  activeDates,
  selectedWeekStart,
  onWeekStartChange,
}: {
  activeDates: string[];
  selectedWeekStart: string;
  onWeekStartChange: (weekStartDate: string) => void;
}) {
  const [monthDate, setMonthDate] = useState(() =>
    parseDateOnly(selectedWeekStart)
  );
  const activeDateSet = useMemo(() => new Set(activeDates), [activeDates]);
  const selectedWeekDateSet = useMemo(
    () =>
      new Set(buildDateList(selectedWeekStart, addDays(selectedWeekStart, 6))),
    [selectedWeekStart]
  );
  const days = useMemo(() => buildMonthDays(monthDate), [monthDate]);
  const monthLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    year: "numeric",
  }).format(monthDate);
  const today = toDateInputValue(new Date());

  function moveMonth(offset: number) {
    setMonthDate((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + offset);
      return next;
    });
  }

  return (
    <section className="rounded-md border border-border bg-background p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          aria-label="이전 달"
          className="inline-flex size-7 items-center justify-center rounded-md text-primary hover:bg-muted"
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
          className="inline-flex size-7 items-center justify-center rounded-md text-primary hover:bg-muted"
          onClick={() => moveMonth(1)}
          type="button"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {["일", "월", "화", "수", "목", "금", "토"].map((weekday, index) => (
          <div className={cn("py-1", getWeekdayTextClass(index))} key={weekday}>
            {weekday}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`blank-${monthLabel}-${index}`} />;
          }

          const isActive = activeDateSet.has(day);
          const isSelectedWeek = selectedWeekDateSet.has(day);
          const isToday = day === today;

          return (
            <button
              aria-label={formatCompactDateWithWeekday(day)}
              className={cn(
                "relative flex h-7 items-center justify-center rounded-md text-xs font-medium outline-none transition-colors",
                getWeekdayTextClass(day),
                isActive
                  ? "hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
                  : "cursor-not-allowed text-muted-foreground/45 opacity-60",
                isActive &&
                  isSelectedWeek &&
                  "bg-primary/10 ring-1 ring-primary hover:bg-primary/15"
              )}
              disabled={!isActive}
              key={day}
              onClick={() => onWeekStartChange(getWeekStartDate(day))}
              type="button"
            >
              <span>{Number(day.slice(-2))}</span>
              {isToday ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full",
                    isSelectedWeek && isActive ? "bg-primary" : "bg-primary/70"
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
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
  onSlotHover,
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
    status: Extract<ReservationStatus, "APPROVED" | "PENDING">;
  }) => void;
  onSlotHover: (slotId: string | null, reservationId?: string | null) => void;
  reservation: HostReservationGroup;
  reviewingKey: string | null;
}) {
  const status = getStatusMeta(reservation.status);
  const participantNames = reservation.participants
    .map((participant) => participant.guest_name)
    .join(", ");

  return (
    <div
      className={cn(
        "rounded-md border bg-background transition-colors",
        collapsed ? "border-border" : "border-primary/25 shadow-sm"
      )}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={onCollapseToggle}
        type="button"
      >
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
            status.className
          )}
        >
          {status.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {participantNames || "이름 없음"}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {reservation.headcount}명
        </span>
        {collapsed ? (
          <ChevronDown
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
        ) : (
          <ChevronUp
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
        )}
      </button>

      {!collapsed ? (
        <div className="border-t border-border px-3 pb-3 pt-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
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
                후보 시간
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
          </div>

          <div className="space-y-2">
            {reservation.slots.map((slot) => {
              const approveKey = `${reservation.id}:${slot.id}:APPROVED`;
              const pendingKey = `${reservation.id}:${slot.id}:PENDING`;
              const nextStatus = slot.is_confirmed ? "PENDING" : "APPROVED";

              return (
                <div
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-2"
                  key={slot.id}
                >
                  <span className="rounded-full border border-border bg-background px-2 py-1 font-mono text-[11px] text-primary">
                    후보 {slot.priority_order}
                  </span>
                  <span className="min-w-0 truncate rounded-md border border-border bg-muted px-2 py-2 font-mono text-xs text-foreground">
                    {formatTimeRange({
                      endAt: slot.end_at,
                      startAt: slot.start_at,
                    })}
                  </span>
                  <Button
                    disabled={reviewingKey !== null}
                    onBlur={() => onSlotHover(null, null)}
                    onFocus={() => onSlotHover(slot.id, reservation.id)}
                    onMouseEnter={() => onSlotHover(slot.id, reservation.id)}
                    onMouseLeave={() => onSlotHover(null, null)}
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
                    {reviewingKey === approveKey ||
                    reviewingKey === pendingKey ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
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
      <div className="w-full max-w-3xl border border-border bg-background p-4 shadow-xl">
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

function buildMonthDays(monthDate: Date) {
  const firstDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDate = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  );
  const days: Array<string | null> = Array.from(
    { length: firstDate.getDay() },
    () => null
  );

  for (let day = 1; day <= lastDate.getDate(); day += 1) {
    days.push(
      toDateInputValue(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
      )
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

function addDays(date: string, days: number) {
  const value = parseDateOnly(date);
  value.setDate(value.getDate() + days);
  return toDateInputValue(value);
}

function clampBufferRangeToConfirmedSlot(
  range: TimeRange,
  slotRange: TimeRange,
  side: EventBufferSide
) {
  const minimumMs = 60_000;
  const slotStart = new Date(slotRange.startAt).getTime();
  const slotEnd = new Date(slotRange.endAt).getTime();
  const rangeStart = new Date(range.startAt).getTime();
  const rangeEnd = new Date(range.endAt).getTime();

  if (side === "BEFORE") {
    const nextEnd = Math.min(rangeEnd, slotStart);
    const nextStart = Math.min(rangeStart, nextEnd - minimumMs);

    return {
      endAt: new Date(nextEnd).toISOString(),
      startAt: new Date(nextStart).toISOString(),
    };
  }

  const nextStart = Math.max(rangeStart, slotEnd);
  const nextEnd = Math.max(rangeEnd, nextStart + minimumMs);

  return {
    endAt: new Date(nextEnd).toISOString(),
    startAt: new Date(nextStart).toISOString(),
  };
}

function getWeekStartDate(date: string) {
  const value = parseDateOnly(date);
  value.setDate(value.getDate() - value.getDay());
  return toDateInputValue(value);
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
