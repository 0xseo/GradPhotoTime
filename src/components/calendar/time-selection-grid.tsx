"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useTimeSelection } from "@/hooks/use-time-selection";
import {
  getSlotCandidateRange,
  getSlotDisplayRange,
} from "@/lib/reservations/slots";
import {
  formatCompactDateWithWeekday,
  getWeekdaySurfaceClass,
  getWeekdayTextClass,
} from "@/lib/time/calendar-style";
import {
  formatTimeRange,
  getDayGridRange,
  getEventDays,
  getRangeLayout,
} from "@/lib/time/event-days";
import {
  applyAvailabilityToggleSelection,
  applySelectedTimeRange,
} from "@/lib/time/range-set";
import { cn } from "@/lib/utils";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import type { Tables } from "@/lib/supabase/database.types";
import type {
  SelectedTimeRange,
  TimeRange,
  TimeRangeAvailability,
  TimeSelectionMode,
} from "@/types/domain";

export type CalendarBufferItem = TimeRange & {
  id: string;
  isActive: boolean;
  reservationSlotId: string;
  side: "BEFORE" | "AFTER";
};

type TimeSelectionGridProps = {
  activeDates?: string[];
  allowWaitlist?: boolean;
  bufferItems?: CalendarBufferItem[];
  bufferTimeMinutes?: number;
  blockedRanges?: TimeRange[];
  bufferRanges?: TimeRange[];
  dailyEndTime: string;
  dailyStartTime: string;
  dateEnd: string;
  dateStart: string;
  mode: TimeSelectionMode;
  occupiedRanges?: TimeRange[];
  unavailableRanges?: TimeRange[];
  onAddBuffer?: (slot: EventScheduleSlot, side: "BEFORE" | "AFTER") => void;
  onApproveSlot?: (slot: EventScheduleSlot) => void;
  onCancelSlot?: (slot: EventScheduleSlot) => void;
  onPinReservationPending?: (reservationId: string) => void;
  onPreviewReservationPending?: (reservationId: string | null) => void;
  onRemoveBuffer?: (bufferItem: CalendarBufferItem) => void;
  onResizeBuffer?: (bufferItem: CalendarBufferItem, range: TimeRange) => void;
  onResizeSelectedRange?: (
    selectedRange: SelectedTimeRange,
    range: TimeRange
  ) => void;
  onResizeSlot?: (slot: EventScheduleSlot, range: TimeRange) => void;
  onResizeTimeBlock?: (block: Tables<"time_blocks">, range: TimeRange) => void;
  readOnly?: boolean;
  reservationSlots?: EventScheduleSlot[];
  selectedRanges: SelectedTimeRange[];
  slotDisplayMode?: "host" | "public";
  slotHeightRem?: number;
  slotMinutes?: number;
  timeBlocks?: Tables<"time_blocks">[];
  visibleWeekStart?: string | null;
  onVisibleWeekStartChange?: (weekStartDate: string) => void;
  pendingBufferActionKey?: string | null;
  previewApprovalSlotId?: string | null;
};

export function TimeSelectionGrid({
  activeDates,
  allowWaitlist = false,
  bufferItems = [],
  bufferTimeMinutes = 0,
  blockedRanges = [],
  bufferRanges = [],
  dailyEndTime,
  dailyStartTime,
  dateEnd,
  dateStart,
  mode,
  occupiedRanges = [],
  unavailableRanges = [],
  onAddBuffer,
  onApproveSlot,
  onCancelSlot,
  onPinReservationPending,
  onPreviewReservationPending,
  onRemoveBuffer,
  onResizeBuffer,
  onResizeSelectedRange,
  onResizeSlot,
  onResizeTimeBlock,
  readOnly = false,
  reservationSlots = [],
  selectedRanges,
  slotDisplayMode = "host",
  slotHeightRem = 1.65,
  slotMinutes = 30,
  timeBlocks = [],
  visibleWeekStart,
  onVisibleWeekStartChange,
  pendingBufferActionKey,
  previewApprovalSlotId,
}: TimeSelectionGridProps) {
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const [dayPageIndex, setDayPageIndex] = useState(0);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [weekIndex, setWeekIndex] = useState(0);
  const allDays =
    activeDates && activeDates.length > 0
      ? getEventDaysFromDates(activeDates)
      : getEventDays(dateStart, dateEnd);
  const weekStarts = getWeekStarts(allDays.map((day) => day.date));
  const controlledWeekIndex = visibleWeekStart
    ? weekStarts.indexOf(visibleWeekStart)
    : -1;
  const activeWeekIndex =
    controlledWeekIndex >= 0
      ? controlledWeekIndex
      : Math.min(weekIndex, Math.max(weekStarts.length - 1, 0));
  const activeWeekStart = weekStarts[activeWeekIndex] ?? null;
  const weekDays = activeWeekStart
    ? allDays.filter((day) => getWeekStartDate(day.date) === activeWeekStart)
    : allDays;
  const isDayPaged = isNarrowViewport && weekDays.length > 1;
  const activeDayPageIndex = Math.min(
    dayPageIndex,
    Math.max(weekDays.length - 1, 0)
  );
  const days = isDayPaged
    ? [weekDays[activeDayPageIndex] ?? weekDays[0]].filter(Boolean)
    : weekDays;
  const dayDates = days.map((day) => day.date);
  const isWeekPaged = weekStarts.length > 1;

  function selectWeekIndex(nextWeekIndex: number) {
    const boundedIndex = Math.min(
      Math.max(nextWeekIndex, 0),
      Math.max(weekStarts.length - 1, 0)
    );
    const nextWeekStart = weekStarts[boundedIndex];

    setDayPageIndex(0);
    setWeekIndex(boundedIndex);

    if (nextWeekStart) {
      onVisibleWeekStartChange?.(nextWeekStart);
    }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    function updateViewportMode() {
      setIsNarrowViewport(mediaQuery.matches);
    }

    updateViewportMode();
    mediaQuery.addEventListener("change", updateViewportMode);

    return () => mediaQuery.removeEventListener("change", updateViewportMode);
  }, []);

  return (
    <div className="border border-border bg-background">
      {isDayPaged ? (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-3 py-2">
          <button
            aria-label="이전 날짜"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-muted text-primary disabled:opacity-40"
            disabled={activeDayPageIndex === 0}
            onClick={() =>
              setDayPageIndex((current) => Math.max(current - 1, 0))
            }
            type="button"
          >
            &lt;
          </button>
          <p className="font-serif text-lg font-semibold text-primary">
            {days[0] ? formatCompactDateWithWeekday(days[0].date) : "일정"}
          </p>
          <button
            aria-label="다음 날짜"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-muted text-primary disabled:opacity-40"
            disabled={activeDayPageIndex >= weekDays.length - 1}
            onClick={() =>
              setDayPageIndex((current) =>
                Math.min(current + 1, weekDays.length - 1)
              )
            }
            type="button"
          >
            &gt;
          </button>
        </div>
      ) : null}
      <div className="w-full">
        <div
          className="grid w-full"
          data-calendar-grid
          ref={calendarGridRef}
          style={{
            gridTemplateColumns: isWeekPaged
              ? `3.75rem 2.25rem repeat(${days.length}, minmax(0, 1fr)) 2.25rem`
              : `3.75rem repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="flex min-h-16 items-center justify-center border-b border-r border-border bg-muted px-2 py-3 text-xs font-medium text-muted-foreground">
            시간
          </div>
          {isWeekPaged ? <WeekNavigationHeaderCell side="left" /> : null}
          {days.map((day) => (
            <div
              className={cn(
                "relative flex min-h-16 items-center justify-center border-b border-r border-border bg-muted px-4 py-3",
                getWeekdaySurfaceClass(day.date)
              )}
              key={day.date}
            >
              <p
                className={cn(
                  "font-serif text-lg font-semibold text-primary",
                  getWeekdayTextClass(day.date)
                )}
              >
                {formatCompactDateWithWeekday(day.date)}
              </p>
            </div>
          ))}
          {isWeekPaged ? <WeekNavigationHeaderCell side="right" /> : null}

          <TimeAxis
            date={days[0]?.date ?? dateStart}
            dailyEndTime={dailyEndTime}
            dailyStartTime={dailyStartTime}
            slotHeightRem={slotHeightRem}
            slotMinutes={slotMinutes}
          />
          {isWeekPaged ? (
            <WeekNavigationRailCell
              ariaLabel="이전 주"
              direction="previous"
              disabled={activeWeekIndex === 0}
              onClick={() => selectWeekIndex(activeWeekIndex - 1)}
              side="left"
            />
          ) : null}
          {days.map((day, dayIndex) => (
            <DaySelectionGrid
              allowWaitlist={allowWaitlist}
              bufferItems={bufferItems}
              bufferTimeMinutes={bufferTimeMinutes}
              blockedRanges={blockedRanges}
              calendarGridRef={calendarGridRef}
              bufferRanges={bufferRanges}
              dailyEndTime={dailyEndTime}
              dailyStartTime={dailyStartTime}
              date={day.date}
              dates={dayDates}
              dayIndex={dayIndex}
              key={day.date}
              mode={mode}
              occupiedRanges={occupiedRanges}
              unavailableRanges={unavailableRanges}
              onAddBuffer={onAddBuffer}
              onApproveSlot={onApproveSlot}
              onCancelSlot={onCancelSlot}
              onPinReservationPending={onPinReservationPending}
              onPreviewReservationPending={onPreviewReservationPending}
              onRemoveBuffer={onRemoveBuffer}
              onResizeBuffer={onResizeBuffer}
              onResizeSelectedRange={onResizeSelectedRange}
              onResizeSlot={onResizeSlot}
              onResizeTimeBlock={onResizeTimeBlock}
              readOnly={readOnly}
              reservationSlots={reservationSlots}
              selectedRanges={selectedRanges}
              slotDisplayMode={slotDisplayMode}
              slotHeightRem={slotHeightRem}
              slotMinutes={slotMinutes}
              timeBlocks={timeBlocks}
              pendingBufferActionKey={pendingBufferActionKey}
              previewApprovalSlotId={previewApprovalSlotId}
            />
          ))}
          {isWeekPaged ? (
            <WeekNavigationRailCell
              ariaLabel="다음 주"
              direction="next"
              disabled={activeWeekIndex >= weekStarts.length - 1}
              onClick={() => selectWeekIndex(activeWeekIndex + 1)}
              side="right"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WeekNavigationHeaderCell({ side }: { side: "left" | "right" }) {
  return (
    <div
      className={cn(
        "min-h-16 border-b border-border bg-muted",
        side === "left" && "border-r"
      )}
    />
  );
}

function WeekNavigationRailCell({
  ariaLabel,
  direction,
  disabled,
  onClick,
  side,
}: {
  ariaLabel: string;
  direction: "next" | "previous";
  disabled: boolean;
  onClick: () => void;
  side: "left" | "right";
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;

  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        "flex h-full items-center justify-center bg-background/85 text-primary transition-colors hover:bg-muted disabled:pointer-events-none disabled:text-muted-foreground/35 disabled:hover:bg-background/85",
        side === "left" && "border-r border-border"
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function getEventDaysFromDates(dates: string[]) {
  return [...new Set(dates)].sort().map((date) => {
    const value = new Date(`${date}T00:00:00`);

    return {
      date,
      label: new Intl.DateTimeFormat("ko-KR", {
        day: "numeric",
        month: "short",
      }).format(value),
      weekday: new Intl.DateTimeFormat("ko-KR", {
        weekday: "short",
      }).format(value),
    };
  });
}

function getWeekStarts(dates: string[]) {
  return [...new Set(dates.map((date) => getWeekStartDate(date)))].sort();
}

function getWeekStartDate(date: string) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() - value.getDay());
  return toDateOnly(value);
}

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function TimeAxis({
  dailyEndTime,
  dailyStartTime,
  date,
  slotMinutes,
  slotHeightRem,
}: {
  dailyEndTime: string;
  dailyStartTime: string;
  date: string;
  slotHeightRem: number;
  slotMinutes: number;
}) {
  const { gridEndAt, gridStartAt } = getDayGridRange(
    date,
    dailyStartTime,
    dailyEndTime
  );
  const labels = getAxisTimeLabels(gridStartAt, gridEndAt);
  const rowCount = Math.max(
    (new Date(gridEndAt).getTime() - new Date(gridStartAt).getTime()) /
      (slotMinutes * 60_000),
    1
  );
  const height = getGridHeight(rowCount, slotHeightRem);

  return (
    <div
      className="relative border-r border-border bg-muted/70"
      style={{ height }}
    >
      {labels.map((label, index) => (
        <div
          className="absolute left-0 w-full -translate-y-1/2 px-2 text-xs text-muted-foreground"
          key={`${label}-${index}`}
          style={{ top: `${(index / Math.max(labels.length - 1, 1)) * 100}%` }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function DaySelectionGrid({
  allowWaitlist,
  bufferItems = [],
  bufferTimeMinutes = 0,
  blockedRanges = [],
  calendarGridRef,
  bufferRanges = [],
  dailyEndTime,
  dailyStartTime,
  date,
  dates,
  dayIndex,
  mode,
  occupiedRanges = [],
  unavailableRanges = [],
  onAddBuffer,
  onApproveSlot,
  onCancelSlot,
  onPinReservationPending,
  onPreviewReservationPending,
  onRemoveBuffer,
  onResizeBuffer,
  onResizeSelectedRange,
  onResizeSlot,
  onResizeTimeBlock,
  readOnly = false,
  reservationSlots = [],
  selectedRanges,
  slotDisplayMode = "host",
  slotHeightRem = 0.54,
  slotMinutes = 30,
  timeBlocks = [],
  pendingBufferActionKey,
  previewApprovalSlotId,
}: Omit<TimeSelectionGridProps, "activeDates" | "dateEnd" | "dateStart"> & {
  calendarGridRef: RefObject<HTMLDivElement | null>;
  date: string;
  dates: string[];
  dayIndex: number;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [bufferPreviewTarget, setBufferPreviewTarget] = useState<{
    side: "AFTER" | "BEFORE";
    slotId: string;
  } | null>(null);
  const { gridEndAt, gridStartAt } = getDayGridRange(
    date,
    dailyStartTime,
    dailyEndTime
  );
  const { draftOperation, draftRanges, gridProps } = useTimeSelection({
    allowWaitlist,
    blockedRanges: blockedRanges.filter((range) =>
      overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt)
    ),
    calendarGridRef,
    commitOperation:
      mode === "host-availability" && hasAvailableTimeBlocks(timeBlocks)
        ? "add"
        : undefined,
    dailyEndTime,
    dailyStartTime,
    dates,
    dayIndex,
    gridEndAt,
    gridRef,
    gridStartAt,
    minDurationMinutes: slotMinutes,
    mode,
    occupiedRanges: occupiedRanges.filter((range) =>
      overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt)
    ),
    operationReferenceRanges:
      mode === "host-availability"
        ? getHostAvailabilityReferenceRanges(timeBlocks, selectedRanges)
        : undefined,
    slotMinutes,
  });
  const hostBlockPreviewRanges =
    mode === "host-availability" && hasAvailableTimeBlocks(timeBlocks)
      ? [...selectedRanges, ...draftRanges]
      : [];
  const displayTimeBlocks =
    hostBlockPreviewRanges.length > 0
      ? getPreviewTimeBlocks(timeBlocks, hostBlockPreviewRanges)
      : timeBlocks;
  const displaySelectedRanges =
    mode === "host-availability" && hasAvailableTimeBlocks(timeBlocks)
      ? []
      : mode === "host-availability" && !readOnly && draftRanges.length > 0
      ? getPreviewSelectedRanges(selectedRanges, draftRanges, draftOperation)
      : selectedRanges;
  const dayBlocks = displayTimeBlocks.filter((block) =>
    overlapsGrid(block.start_at, block.end_at, gridStartAt, gridEndAt)
  );
  const dayUnavailableRanges = unavailableRanges.filter((range) =>
    overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt)
  );
  const dayBufferRanges = bufferRanges.filter((range) =>
    overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt)
  );
  const dayBufferItems = bufferItems.filter((range) =>
    overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt)
  );
  const daySlots = reservationSlots.filter((slot) =>
    overlapsGrid(
      getSlotDisplayRange(slot).startAt,
      getSlotDisplayRange(slot).endAt,
      gridStartAt,
      gridEndAt
    )
  );
  const daySelections = displaySelectedRanges.filter((range) =>
    overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt)
  );
  const rowCount = Math.max(
    (new Date(gridEndAt).getTime() - new Date(gridStartAt).getTime()) /
      (slotMinutes * 60_000),
    1
  );
  const hourCount = Math.max(
    (new Date(gridEndAt).getTime() - new Date(gridStartAt).getTime()) /
      3_600_000,
    1
  );
  const height = getGridHeight(rowCount, slotHeightRem);
  const interactiveProps = readOnly ? undefined : gridProps;
  const activeBufferSidesBySlotId = new Map<string, Set<"AFTER" | "BEFORE">>();
  const confirmedSlotRangeById = new Map(
    reservationSlots
      .filter((slot) => slot.is_confirmed)
      .map((slot) => [slot.id, getSlotDisplayRange(slot)])
  );

  for (const bufferItem of bufferItems) {
    if (!bufferItem.isActive) {
      continue;
    }

    const sides =
      activeBufferSidesBySlotId.get(bufferItem.reservationSlotId) ?? new Set();
    sides.add(bufferItem.side);
    activeBufferSidesBySlotId.set(bufferItem.reservationSlotId, sides);
  }
  const popoverSide =
    dates.length <= 1
      ? "below"
      : dayIndex >= dates.length - 1
      ? "left"
      : "right";

  return (
    <div
      className={cn(
        "relative overflow-visible border-r border-border bg-white last:border-r-0",
        getWeekdaySurfaceClass(date)
      )}
      data-day-grid-index={dayIndex}
      ref={gridRef}
      {...(interactiveProps ?? {})}
      style={{
        height,
        ...(interactiveProps?.style ?? {}),
      }}
      onPointerLeave={() => setBufferPreviewTarget(null)}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(0,38,75,0.22) 1px, transparent 1px)",
          backgroundSize: `100% ${100 / hourCount}%`,
        }}
      />

      {dayBlocks.map((block) => (
        <RangeBlock
          gridEndAt={gridEndAt}
          gridStartAt={gridStartAt}
          key={block.id}
          details={formatTimeRange({
            endAt: block.end_at,
            startAt: block.start_at,
          })}
          label={block.type === "AVAILABLE" ? "가능" : "불가"}
          onResize={
            block.type === "AVAILABLE" && onResizeTimeBlock
              ? (range) => onResizeTimeBlock(block, range)
              : undefined
          }
          range={{ endAt: block.end_at, startAt: block.start_at }}
          resizeEnabled={
            block.type === "AVAILABLE" && Boolean(onResizeTimeBlock)
          }
          slotMinutes={slotMinutes}
          tone={block.type === "AVAILABLE" ? "available-soft" : "blocked"}
        />
      ))}

      {dayUnavailableRanges.map((range, index) => (
        <RangeBlock
          gridEndAt={gridEndAt}
          gridStartAt={gridStartAt}
          key={`unavailable:${range.startAt}:${range.endAt}:${index}`}
          details={formatTimeRange(range)}
          label="불가"
          range={range}
          slotMinutes={slotMinutes}
          tone="blocked"
        />
      ))}

      {(slotDisplayMode === "host"
        ? dayBufferItems.length > 0
          ? dayBufferItems
          : dayBufferRanges.map((range, index) => ({
              ...range,
              id: `buffer:${range.startAt}:${range.endAt}:${index}`,
              isActive: true,
              reservationSlotId: "",
              side: "BEFORE" as const,
            }))
        : []
      ).map((range) => {
        const confirmedSlotRange = confirmedSlotRangeById.get(
          range.reservationSlotId
        );
        const displayRange = confirmedSlotRange
          ? clampBufferRangeToSlotBoundary(
              range,
              confirmedSlotRange,
              range.side,
              slotMinutes
            )
          : range;

        return (
          <RangeBlock
            clampResizeRange={
              confirmedSlotRange
                ? (nextRange) =>
                    clampBufferRangeToSlotBoundary(
                      nextRange,
                      confirmedSlotRange,
                      range.side,
                      slotMinutes
                    )
                : undefined
            }
            disabledResizeEdges={
              range.side === "BEFORE" ? ["end"] : ["start"]
            }
            gridEndAt={gridEndAt}
            gridStartAt={gridStartAt}
            key={range.id}
            details={formatTimeRange(displayRange)}
            label={slotDisplayMode === "host" ? "버퍼" : "불가"}
            onResize={
              onResizeBuffer && range.reservationSlotId
                ? (nextRange) => onResizeBuffer(range, nextRange)
                : undefined
            }
            quickAction={
              onRemoveBuffer && range.reservationSlotId ? (
                <button
                  aria-label="버퍼 삭제"
                  className="inline-flex size-8 items-center justify-center rounded-full text-slate-600 transition-all hover:scale-110 hover:text-danger hover:drop-shadow-md"
                  disabled={pendingBufferActionKey === range.id}
                  onClick={() => onRemoveBuffer(range)}
                  type="button"
                >
                  {pendingBufferActionKey === range.id ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2
                      className="size-4"
                      strokeWidth={2.75}
                      aria-hidden="true"
                    />
                  )}
                </button>
              ) : undefined
            }
            range={displayRange}
            resizeEnabled={Boolean(onResizeBuffer && range.reservationSlotId)}
            slotMinutes={slotMinutes}
            tone="buffer"
          />
        );
      })}

      {daySlots.map((slot) => {
        const slotRange = getSlotDisplayRange(slot);
        const isHostDisplay = slotDisplayMode === "host";
        const activeBufferSides =
          activeBufferSidesBySlotId.get(slot.id) ?? new Set();
        const canAddBefore =
          isHostDisplay &&
          slot.is_confirmed &&
          Boolean(onAddBuffer) &&
          !activeBufferSides.has("BEFORE");
        const canAddAfter =
          isHostDisplay &&
          slot.is_confirmed &&
          Boolean(onAddBuffer) &&
          !activeBufferSides.has("AFTER");
        const previewSide =
          bufferPreviewTarget?.slotId === slot.id
            ? bufferPreviewTarget.side
            : null;
        const previewRange =
          previewSide === "BEFORE" && canAddBefore
            ? buildBufferPreviewRange(
                slotRange,
                "BEFORE",
                bufferTimeMinutes,
                gridStartAt,
                gridEndAt
              )
            : previewSide === "AFTER" && canAddAfter
            ? buildBufferPreviewRange(
                slotRange,
                "AFTER",
                bufferTimeMinutes,
                gridStartAt,
                gridEndAt
              )
            : null;
        const previewActionKey = previewSide
          ? `${slot.id}:${previewSide}`
          : null;

        return (
          <Fragment key={slot.id}>
            {previewRange && previewSide && onAddBuffer ? (
              <RangeBlock
                gridEndAt={gridEndAt}
                gridStartAt={gridStartAt}
                details="버퍼 추가"
                label="버퍼"
                quickAction={
                  <BufferEdgeButton
                    isPending={pendingBufferActionKey === previewActionKey}
                    label="버퍼 추가"
                    onClick={() => onAddBuffer(slot, previewSide)}
                  />
                }
                range={previewRange}
                slotMinutes={slotMinutes}
                tone="buffer-preview"
              />
            ) : null}
            <RangeBlock
              gridEndAt={gridEndAt}
              gridStartAt={gridStartAt}
              isPreviewTarget={previewApprovalSlotId === slot.id}
              details={
                isHostDisplay
                  ? formatSlotDetails(slot)
                  : formatPublicSlotDetails(slot)
              }
              label={
                isHostDisplay
                  ? formatSlotLabel(slot)
                  : formatPublicSlotLabel(slot)
              }
              onHoverSideChange={
                canAddBefore || canAddAfter
                  ? (side) => {
                      if (
                        side &&
                        ((side === "BEFORE" && canAddBefore) ||
                          (side === "AFTER" && canAddAfter))
                      ) {
                        setBufferPreviewTarget({ side, slotId: slot.id });
                      } else if (
                        bufferPreviewTarget?.slotId === slot.id
                      ) {
                        setBufferPreviewTarget(null);
                      }
                    }
                  : undefined
              }
              popover={
                isHostDisplay &&
                isPendingOverlaySlot(slot) ? undefined : isHostDisplay &&
                  slot.is_confirmed ? (
                  <ConfirmedSlotPopover
                    focused={false}
                    onCancelSlot={onCancelSlot}
                    onPinReservationPending={onPinReservationPending}
                    onPreviewReservationPending={onPreviewReservationPending}
                    slot={slot}
                  />
                ) : isHostDisplay ? (
                  <PendingSlotPopover
                    onApproveSlot={onApproveSlot}
                    slot={slot}
                  />
                ) : undefined
              }
              popoverSide={popoverSide}
              onResize={
              slot.is_confirmed && onResizeSlot
                ? (range) => onResizeSlot(slot, range)
                : undefined
            }
            range={slotRange}
            resizeEnabled={slot.is_confirmed && Boolean(onResizeSlot)}
            slotMinutes={slotMinutes}
            tone={
              slot.is_confirmed
                ? "confirmed"
                : previewApprovalSlotId && previewApprovalSlotId !== slot.id
                ? "waitlist-muted"
                : "waitlist"
            }
          />
          </Fragment>
        );
      })}

      {daySelections.map((range) => (
        <RangeBlock
          gridEndAt={gridEndAt}
          gridStartAt={gridStartAt}
          details={formatTimeRange(range)}
          key={range.id}
          label={
            mode === "host-availability"
              ? "가능"
              : formatCandidateLabel(selectedRanges, range)
          }
          onResize={
            onResizeSelectedRange && !range.isConfirmed
              ? (nextRange) => onResizeSelectedRange(range, nextRange)
              : undefined
          }
          range={range}
          resizeEnabled={Boolean(onResizeSelectedRange && !range.isConfirmed)}
          slotMinutes={slotMinutes}
          tone={
            mode === "host-availability"
              ? "available-soft"
              : range.isConfirmedCandidate
              ? "confirmed-candidate"
              : range.availability === "waitlist"
              ? "waitlist"
              : "selected"
          }
        />
      ))}

      {!readOnly
        ? draftRanges
            .filter((range) =>
              overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt)
            )
            .map((range) => (
              <RangeBlock
                gridEndAt={gridEndAt}
                gridStartAt={gridStartAt}
                details={formatTimeRange(range)}
                key={`draft:${range.startAt}:${range.endAt}`}
                label={getDraftLabel(mode, draftOperation)}
                range={range}
                tone={getDraftTone(mode, draftOperation, range.availability)}
              />
            ))
        : null}
    </div>
  );
}

function overlapsGrid(
  startAt: string,
  endAt: string,
  gridStartAt: string,
  gridEndAt: string
) {
  return (
    new Date(startAt).getTime() < new Date(gridEndAt).getTime() &&
    new Date(gridStartAt).getTime() < new Date(endAt).getTime()
  );
}

function hasAvailableTimeBlocks(timeBlocks: Tables<"time_blocks">[]) {
  return timeBlocks.some((block) => block.type === "AVAILABLE");
}

function getHostAvailabilityReferenceRanges(
  timeBlocks: Tables<"time_blocks">[],
  selectedRanges: SelectedTimeRange[]
) {
  return [
    ...timeBlocks
      .filter((block) => block.type === "AVAILABLE")
      .map((block) => ({
        endAt: block.end_at,
        startAt: block.start_at,
      })),
    ...selectedRanges.map((range) => ({
      endAt: range.endAt,
      startAt: range.startAt,
    })),
  ];
}

function getPreviewTimeBlocks(
  timeBlocks: Tables<"time_blocks">[],
  draftRanges: TimeRange[]
) {
  if (timeBlocks.length === 0) {
    return timeBlocks;
  }

  const previewBlocks = applyAvailabilityToggleSelection(
    timeBlocks.map((block) => ({
      endAt: block.end_at,
      note: block.note,
      startAt: block.start_at,
      type: block.type,
    })),
    draftRanges.map((range) => ({
      endAt: range.endAt,
      startAt: range.startAt,
    }))
  );

  return previewBlocks.map((block, index) => ({
    created_at: "",
    end_at: block.endAt,
    event_id: "",
    id: `preview:${block.type}:${block.startAt}:${block.endAt}:${index}`,
    note: block.note ?? null,
    start_at: block.startAt,
    type: block.type,
  }));
}

function getPreviewSelectedRanges(
  selectedRanges: SelectedTimeRange[],
  draftRanges: TimeRange[],
  operation: "add" | "remove"
) {
  return draftRanges.reduce(
    (currentRanges, range) =>
      applySelectedTimeRange(currentRanges, range, "available", operation),
    selectedRanges
  );
}

function getAxisTimeLabels(startAt: string, endAt: string) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const labels: string[] = [];

  for (let timestamp = start; timestamp <= end; timestamp += 60 * 60_000) {
    labels.push(formatAxisTime(timestamp));
  }

  return labels;
}

function getGridHeight(rowCount: number, slotHeightRem: number) {
  return `${Math.max(40, rowCount * slotHeightRem)}rem`;
}

function getDraftLabel(mode: TimeSelectionMode, operation: "add" | "remove") {
  if (mode === "host-availability") {
    return operation === "remove" ? "불가능하게 변경" : "가능하게 변경";
  }

  return "후보";
}

function getDraftTone(
  mode: TimeSelectionMode,
  operation: "add" | "remove",
  availability: TimeRangeAvailability
): RangeTone {
  if (mode === "host-availability") {
    return operation === "remove" ? "blocked" : "available-soft";
  }

  return availability === "waitlist" ? "waitlist" : "selected";
}

function buildBufferPreviewRange(
  slotRange: TimeRange,
  side: "AFTER" | "BEFORE",
  bufferMinutes: number,
  gridStartAt: string,
  gridEndAt: string
) {
  if (bufferMinutes <= 0) {
    return null;
  }

  const bufferMs = bufferMinutes * 60_000;
  const gridStart = new Date(gridStartAt).getTime();
  const gridEnd = new Date(gridEndAt).getTime();
  const slotStart = new Date(slotRange.startAt).getTime();
  const slotEnd = new Date(slotRange.endAt).getTime();
  const range =
    side === "BEFORE"
      ? {
          startAt: new Date(
            Math.max(slotStart - bufferMs, gridStart)
          ).toISOString(),
          endAt: slotRange.startAt,
        }
      : {
          startAt: slotRange.endAt,
          endAt: new Date(Math.min(slotEnd + bufferMs, gridEnd)).toISOString(),
        };

  return new Date(range.startAt).getTime() < new Date(range.endAt).getTime()
    ? range
    : null;
}

function clampBufferRangeToSlotBoundary(
  range: TimeRange,
  slotRange: TimeRange,
  side: "AFTER" | "BEFORE",
  slotMinutes = 30
) {
  const minimumMs = Math.max(slotMinutes, 1) * 60_000;
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

function rangesEqual(left: TimeRange, right: TimeRange) {
  return (
    new Date(left.startAt).getTime() === new Date(right.startAt).getTime() &&
    new Date(left.endAt).getTime() === new Date(right.endAt).getTime()
  );
}

function hasAdjustedConfirmedRange(slot: EventScheduleSlot) {
  return (
    slot.is_confirmed &&
    !rangesEqual(getSlotDisplayRange(slot), getSlotCandidateRange(slot))
  );
}

function formatCandidateLabel(
  selectedRanges: SelectedTimeRange[],
  range: SelectedTimeRange
) {
  if (range.priorityOrder) {
    return `후보 ${range.priorityOrder}`;
  }

  const priority = selectedRanges.findIndex((item) => item.id === range.id) + 1;

  return priority > 0 ? `후보 ${priority}` : "후보";
}

function isPendingOverlaySlot(slot: EventScheduleSlot) {
  return slot.id.includes(":pending-overlay");
}

function formatAxisTime(timestamp: number) {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  if (minute === 0) {
    return `${hour12}${period}`;
  }

  return `${hour12}:${String(minute).padStart(2, "0")}${period}`;
}

function getPopoverAlignClass(top: string | number | undefined) {
  const topPercent =
    typeof top === "string" ? Number(top.replace("%", "")) : Number(top);

  if (Number.isFinite(topPercent) && topPercent > 55) {
    return "bottom-0";
  }

  return "top-0";
}

type RangeTone =
  | "available-soft"
  | "blocked"
  | "buffer"
  | "buffer-preview"
  | "confirmed"
  | "confirmed-candidate"
  | "draft"
  | "selected"
  | "waitlist"
  | "waitlist-muted";

function RangeBlock({
  bottomControl,
  clampResizeRange,
  details,
  disabledResizeEdges = [],
  gridEndAt,
  gridStartAt,
  isPreviewTarget = false,
  label,
  onHoverSideChange,
  onResize,
  popover,
  popoverSide = "right",
  quickAction,
  range,
  resizeEnabled = false,
  slotMinutes,
  tone,
  topControl,
}: {
  bottomControl?: ReactNode;
  clampResizeRange?: (range: TimeRange) => TimeRange;
  details?: string;
  disabledResizeEdges?: Array<"end" | "start">;
  gridEndAt: string;
  gridStartAt: string;
  isPreviewTarget?: boolean;
  label: string;
  onHoverSideChange?: (side: "AFTER" | "BEFORE" | null) => void;
  onResize?: (range: TimeRange) => void;
  popover?: ReactNode;
  popoverSide?: "below" | "inside" | "left" | "right";
  quickAction?: ReactNode;
  range: TimeRange;
  resizeEnabled?: boolean;
  slotMinutes?: number;
  tone: RangeTone;
  topControl?: ReactNode;
}) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [resolvedPopoverSide, setResolvedPopoverSide] = useState(popoverSide);
  const [resizeDraft, setResizeDraft] = useState<TimeRange | null>(null);
  const [resizeEdge, setResizeEdge] = useState<"end" | "start" | null>(null);
  const displayRange = resizeDraft ?? range;
  const layout = getRangeLayout(displayRange, gridStartAt, gridEndAt);
  const isStartResizeEnabled =
    resizeEnabled && !disabledResizeEdges.includes("start");
  const isEndResizeEnabled =
    resizeEnabled && !disabledResizeEdges.includes("end");

  if (!layout) {
    return null;
  }

  function buildResizeDraft(clientY: number, edge: "end" | "start") {
    const gridElement = blockRef.current?.parentElement;

    if (!gridElement || !slotMinutes) {
      return range;
    }

    const gridBounds = gridElement.getBoundingClientRect();
    const gridStart = new Date(gridStartAt).getTime();
    const gridEnd = new Date(gridEndAt).getTime();
    const rawTimestamp =
      gridStart +
      ((clientY - gridBounds.top) / Math.max(gridBounds.height, 1)) *
        (gridEnd - gridStart);
    const slotMs = slotMinutes * 60_000;
    const snappedTimestamp =
      gridStart + Math.round((rawTimestamp - gridStart) / slotMs) * slotMs;
    const minDuration = slotMs;
    const currentStart = new Date(range.startAt).getTime();
    const currentEnd = new Date(range.endAt).getTime();

    if (edge === "start") {
      const nextStart = Math.min(
        Math.max(snappedTimestamp, gridStart),
        currentEnd - minDuration
      );

      const nextRange = {
        endAt: range.endAt,
        startAt: new Date(nextStart).toISOString(),
      };

      return clampResizeRange ? clampResizeRange(nextRange) : nextRange;
    }

    const nextEnd = Math.max(
      Math.min(snappedTimestamp, gridEnd),
      currentStart + minDuration
    );

    const nextRange = {
      endAt: new Date(nextEnd).toISOString(),
      startAt: range.startAt,
    };

    return clampResizeRange ? clampResizeRange(nextRange) : nextRange;
  }

  function handleResizePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    edge: "end" | "start"
  ) {
    event.preventDefault();
    event.stopPropagation();
    setResizeEdge(edge);
    setResizeDraft(buildResizeDraft(event.clientY, edge));
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleResizePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeEdge) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setResizeDraft(buildResizeDraft(event.clientY, resizeEdge));
  }

  function handleResizePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeEdge) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (resizeDraft) {
      onResize?.(resizeDraft);
    }

    setResizeDraft(null);
    setResizeEdge(null);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!onHoverSideChange) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const side =
      event.clientY - bounds.top < bounds.height / 2 ? "BEFORE" : "AFTER";

    onHoverSideChange(side);
  }

  function updateResolvedPopoverSide() {
    if (!popover || popoverSide === "inside" || popoverSide === "below") {
      setResolvedPopoverSide(popoverSide);
      return;
    }

    const blockElement = blockRef.current;
    const calendarElement = blockElement?.closest(
      "[data-calendar-grid]"
    ) as HTMLElement | null;

    if (!blockElement || !calendarElement) {
      setResolvedPopoverSide(popoverSide);
      return;
    }

    const blockBounds = blockElement.getBoundingClientRect();
    const calendarBounds = calendarElement.getBoundingClientRect();
    const popoverWidth = 256;
    const gap = 8;
    const hasRightRoom =
      blockBounds.right + gap + popoverWidth <= calendarBounds.right;
    const hasLeftRoom =
      calendarBounds.left <= blockBounds.left - gap - popoverWidth;

    if (popoverSide === "right" && hasRightRoom) {
      setResolvedPopoverSide("right");
      return;
    }

    if (popoverSide === "left" && hasLeftRoom) {
      setResolvedPopoverSide("left");
      return;
    }

    if (hasRightRoom) {
      setResolvedPopoverSide("right");
      return;
    }

    if (hasLeftRoom) {
      setResolvedPopoverSide("left");
      return;
    }

    setResolvedPopoverSide("below");
  }

  return (
    <div
      aria-label={details ?? label}
      ref={blockRef}
      tabIndex={popover ? 0 : undefined}
      onFocus={updateResolvedPopoverSide}
      onPointerDown={popover ? (event) => event.stopPropagation() : undefined}
      onPointerEnter={updateResolvedPopoverSide}
      onPointerMove={handlePointerMove}
      className={cn(
        "group absolute inset-x-1 rounded-md border px-2 py-1 text-[11px] font-medium shadow-sm outline-none",
        tone === "available-soft" &&
          "z-0 border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "blocked" &&
          "z-10 border-zinc-300 bg-zinc-100 text-zinc-600 opacity-90",
        tone === "buffer" &&
          "z-10 border-slate-200 bg-[repeating-linear-gradient(135deg,#f1f5f9_0,#f1f5f9_5px,#e2e8f0_5px,#e2e8f0_10px)] text-slate-600",
        tone === "buffer-preview" &&
          "z-[25] border-primary/25 bg-primary/10 text-primary/70 ring-1 ring-primary/10 backdrop-blur-[1px]",
        tone === "confirmed" &&
          "z-20 border-primary bg-primary text-primary-foreground",
        tone === "confirmed-candidate" &&
          "z-[35] border-primary/30 bg-primary/15 text-primary ring-1 ring-primary/10",
        tone === "draft" && "z-50 border-accent bg-accent-soft text-accent",
        tone === "selected" &&
          "z-40 border-accent bg-[#fff9ec] text-foreground ring-1 ring-accent",
        tone === "waitlist" &&
          "z-30 border-amber-300 bg-[repeating-linear-gradient(135deg,#fef3c7_0,#fef3c7_6px,#fde68a_6px,#fde68a_12px)] text-amber-900",
        tone === "waitlist-muted" &&
          "z-30 border-slate-300 bg-[repeating-linear-gradient(135deg,#f8fafc_0,#f8fafc_6px,#e2e8f0_6px,#e2e8f0_12px)] text-slate-500",
        isPreviewTarget &&
          "ring-2 ring-accent ring-offset-2 ring-offset-background"
      )}
      style={layout}
    >
      <div className="truncate">{label}</div>
      {isStartResizeEnabled || isEndResizeEnabled ? (
        <>
          {isStartResizeEnabled ? (
            <button
              aria-label="시작 시간 조절"
              className="absolute inset-x-0 top-0 z-40 h-2 cursor-ns-resize rounded-t-md opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              onPointerCancel={() => {
                setResizeDraft(null);
                setResizeEdge(null);
              }}
              onPointerDown={(event) => handleResizePointerDown(event, "start")}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              type="button"
            />
          ) : null}
          {isEndResizeEnabled ? (
            <button
              aria-label="종료 시간 조절"
              className="absolute inset-x-0 bottom-0 z-40 h-2 cursor-ns-resize rounded-b-md opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              onPointerCancel={() => {
                setResizeDraft(null);
                setResizeEdge(null);
              }}
              onPointerDown={(event) => handleResizePointerDown(event, "end")}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              type="button"
            />
          ) : null}
        </>
      ) : null}
      {quickAction ? (
        <div
          className={cn(
            "absolute inset-0 z-30 items-center justify-center",
            tone === "buffer-preview"
              ? "flex"
              : "hidden group-hover:flex group-focus-within:flex"
          )}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {quickAction}
        </div>
      ) : null}
      {topControl ? (
        <div className="pointer-events-none absolute inset-x-0 -top-10 z-30 flex h-10 items-end justify-center pb-1 opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <div
            className="pointer-events-auto"
            onPointerDown={(event) => event.stopPropagation()}
          >
            {topControl}
          </div>
        </div>
      ) : null}
      {bottomControl ? (
        <div className="pointer-events-none absolute inset-x-0 -bottom-10 z-30 flex h-10 items-start justify-center pt-1 opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <div
            className="pointer-events-auto"
            onPointerDown={(event) => event.stopPropagation()}
          >
            {bottomControl}
          </div>
        </div>
      ) : null}
      {popover ? (
        <div
          className={cn(
            "absolute z-40 hidden group-hover:block group-focus-within:block",
            resolvedPopoverSide === "below"
              ? "left-1 right-1 top-full w-auto pt-2"
              : resolvedPopoverSide === "inside"
              ? "left-1 right-1 w-auto"
              : resolvedPopoverSide === "right"
              ? "left-[calc(100%+0.35rem)] w-64"
              : "right-[calc(100%+0.35rem)] w-64",
            resolvedPopoverSide === "below"
              ? null
              : getPopoverAlignClass(layout.top)
          )}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {popover}
        </div>
      ) : null}
    </div>
  );
}

function PendingSlotPopover({
  onApproveSlot,
  slot,
}: {
  onApproveSlot?: (slot: EventScheduleSlot) => void;
  slot: EventScheduleSlot;
}) {
  return (
    <SchedulePopover>
      <SlotDetails slot={slot} />
      <div className="mt-3">
        <PopoverButton onClick={() => onApproveSlot?.(slot)}>
          승인
        </PopoverButton>
      </div>
    </SchedulePopover>
  );
}

function ConfirmedSlotPopover({
  onCancelSlot,
  onPinReservationPending,
  onPreviewReservationPending,
  slot,
}: {
  focused: boolean;
  onCancelSlot?: (slot: EventScheduleSlot) => void;
  onPinReservationPending?: (reservationId: string) => void;
  onPreviewReservationPending?: (reservationId: string | null) => void;
  slot: EventScheduleSlot;
}) {
  return (
    <SchedulePopover>
      <SlotDetails slot={slot} />
      <div className="mt-3 space-y-2">
        <PopoverButton onClick={() => onCancelSlot?.(slot)}>
          확정 취소
        </PopoverButton>
        <PopoverButton
          onClick={() => onPinReservationPending?.(slot.reservation_id)}
          onMouseEnter={() =>
            onPreviewReservationPending?.(slot.reservation_id)
          }
          onMouseLeave={() => onPreviewReservationPending?.(null)}
        >
          이 그룹 후보 시간대 보기
        </PopoverButton>
      </div>
    </SchedulePopover>
  );
}

function BufferEdgeButton({
  isPending = false,
  label,
  onClick,
}: {
  isPending?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-full text-primary transition-all hover:scale-110 hover:drop-shadow-md"
      disabled={isPending}
      onClick={onClick}
      type="button"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="size-4" strokeWidth={2.75} aria-hidden="true" />
      )}
    </button>
  );
}

function SchedulePopover({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background p-3 text-left text-xs text-foreground shadow-xl">
      {children}
    </div>
  );
}

function PopoverButton({
  children,
  className,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <button
      className={cn(
        "w-full rounded-md border border-border bg-muted px-2 py-2 text-xs font-medium text-primary hover:border-primary",
        className
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      type="button"
    >
      {children}
    </button>
  );
}

function SlotDetails({ slot }: { slot: EventScheduleSlot }) {
  const names = slot.participantNames.filter(Boolean);

  return (
    <div>
      <p className="text-sm font-semibold text-primary">
        {names.length > 0 ? names.join(", ") : "이름 없음"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        총 {slot.headcount}명 · {slot.is_confirmed ? "확정" : "대기"} ·{" "}
        {getSlotPriorityLabel(slot)}
      </p>
      <p className="mt-2 font-mono text-xs text-foreground">
        {formatTimeRange(getSlotDisplayRange(slot))}
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        {slot.reservationAccessCode}
      </p>
    </div>
  );
}

function formatSlotLabel(slot: EventScheduleSlot) {
  const names = slot.participantNames.filter(Boolean);
  const priorityLabel = getSlotPriorityLabel(slot);

  if (names.length === 0) {
    return `${priorityLabel} · ${
      slot.is_confirmed ? "확정" : "대기"
    } (${slot.headcount}명)`;
  }

  return `${priorityLabel} · ${names[0]} (${slot.headcount}명)`;
}

function formatSlotDetails(slot: EventScheduleSlot) {
  const names = slot.participantNames.filter(Boolean);
  const participants = names.length > 0 ? names.join(", ") : "이름 없음";
  const status = slot.is_confirmed ? "확정" : "대기";
  const time = formatTimeRange(getSlotDisplayRange(slot));

  return `${status} | ${getSlotPriorityLabel(slot)} | ${participants} | 총 ${slot.headcount}명 | ${time} | 관리 코드 ${slot.reservationAccessCode}`;
}

function formatPublicSlotLabel(slot: EventScheduleSlot) {
  if (!slot.is_confirmed) {
    return "불가";
  }

  if (hasAdjustedConfirmedRange(slot)) {
    return "확정";
  }

  return `확정(후보 ${slot.priority_order})`;
}

function formatPublicSlotDetails(slot: EventScheduleSlot) {
  const status = slot.is_confirmed ? "확정된 예약" : "불가 시간";
  const candidateRange = getSlotCandidateRange(slot);
  const confirmedRange = getSlotDisplayRange(slot);

  if (slot.is_confirmed && !rangesEqual(candidateRange, confirmedRange)) {
    return `${status} | 확정 ${formatTimeRange(confirmedRange)} | 후보 ${slot.priority_order} ${formatTimeRange(candidateRange)}`;
  }

  return `${status} | ${formatTimeRange(confirmedRange)}`;
}

function getSlotPriorityLabel(slot: EventScheduleSlot) {
  return `후보 ${slot.priority_order}`;
}
