"use client";

import {
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useTimeSelection } from "@/hooks/use-time-selection";
import {
  formatTimeRange,
  getDayGridRange,
  getEventDays,
  getRangeLayout,
  getTimeLabels,
} from "@/lib/time/event-days";
import { cn } from "@/lib/utils";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import type { Tables } from "@/lib/supabase/database.types";
import type { SelectedTimeRange, TimeRange, TimeSelectionMode } from "@/types/domain";

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
  blockedRanges?: TimeRange[];
  bufferRanges?: TimeRange[];
  dailyEndTime: string;
  dailyStartTime: string;
  dateEnd: string;
  dateStart: string;
  mode: TimeSelectionMode;
  occupiedRanges?: TimeRange[];
  onAddBuffer?: (slot: EventScheduleSlot, side: "BEFORE" | "AFTER") => void;
  onApproveSlot?: (slot: EventScheduleSlot) => void;
  onCancelSlot?: (slot: EventScheduleSlot) => void;
  onPinReservationPending?: (reservationId: string) => void;
  onPreviewReservationPending?: (reservationId: string | null) => void;
  onRejectReservation?: (reservationId: string) => void;
  onRemoveBuffer?: (bufferItem: CalendarBufferItem) => void;
  onResizeBuffer?: (bufferItem: CalendarBufferItem, range: TimeRange) => void;
  onResizeSlot?: (slot: EventScheduleSlot, range: TimeRange) => void;
  onResizeTimeBlock?: (
    block: Tables<"time_blocks">,
    range: TimeRange,
  ) => void;
  readOnly?: boolean;
  reservationSlots?: EventScheduleSlot[];
  selectedRanges: SelectedTimeRange[];
  slotMinutes?: number;
  timeBlocks?: Tables<"time_blocks">[];
};

export function TimeSelectionGrid({
  activeDates,
  allowWaitlist = false,
  bufferItems = [],
  blockedRanges = [],
  bufferRanges = [],
  dailyEndTime,
  dailyStartTime,
  dateEnd,
  dateStart,
  mode,
  occupiedRanges = [],
  onAddBuffer,
  onApproveSlot,
  onCancelSlot,
  onPinReservationPending,
  onPreviewReservationPending,
  onRejectReservation,
  onRemoveBuffer,
  onResizeBuffer,
  onResizeSlot,
  onResizeTimeBlock,
  readOnly = false,
  reservationSlots = [],
  selectedRanges,
  slotMinutes = 10,
  timeBlocks = [],
}: TimeSelectionGridProps) {
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const days =
    activeDates && activeDates.length > 0
      ? getEventDaysFromDates(activeDates)
      : getEventDays(dateStart, dateEnd);
  const dayDates = days.map((day) => day.date);

  return (
    <div className="overflow-x-auto border border-border bg-background">
      <div
        className="grid min-w-[44rem]"
        ref={calendarGridRef}
        style={{
          gridTemplateColumns: `4rem repeat(${days.length}, minmax(8rem, 1fr))`,
        }}
      >
        <div className="border-b border-r border-border bg-muted px-2 py-3 text-xs font-medium text-muted-foreground">
          시간
        </div>
        {days.map((day) => (
          <div
            className="border-b border-r border-border bg-muted px-3 py-3 last:border-r-0"
            key={day.date}
          >
            <p className="font-serif text-lg font-semibold text-primary">
              {day.label}
            </p>
            <p className="text-xs text-muted-foreground">{day.weekday}</p>
          </div>
        ))}

        <TimeAxis
          date={days[0]?.date ?? dateStart}
          dailyEndTime={dailyEndTime}
          dailyStartTime={dailyStartTime}
          slotMinutes={slotMinutes}
        />
        {days.map((day, dayIndex) => (
          <DaySelectionGrid
            allowWaitlist={allowWaitlist}
            activeDates={activeDates}
            bufferItems={bufferItems}
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
            onAddBuffer={onAddBuffer}
            onApproveSlot={onApproveSlot}
            onCancelSlot={onCancelSlot}
            onPinReservationPending={onPinReservationPending}
            onPreviewReservationPending={onPreviewReservationPending}
            onRejectReservation={onRejectReservation}
            onRemoveBuffer={onRemoveBuffer}
            onResizeBuffer={onResizeBuffer}
            onResizeSlot={onResizeSlot}
            onResizeTimeBlock={onResizeTimeBlock}
            readOnly={readOnly}
            reservationSlots={reservationSlots}
            selectedRanges={selectedRanges}
            slotMinutes={slotMinutes}
            timeBlocks={timeBlocks}
          />
        ))}
      </div>
    </div>
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

function TimeAxis({
  dailyEndTime,
  dailyStartTime,
  date,
  slotMinutes,
}: {
  dailyEndTime: string;
  dailyStartTime: string;
  date: string;
  slotMinutes: number;
}) {
  const { gridEndAt, gridStartAt } = getDayGridRange(
    date,
    dailyStartTime,
    dailyEndTime,
  );
  const labels = getTimeLabels(gridStartAt, gridEndAt);
  const rowCount = Math.max(
    (new Date(gridEndAt).getTime() - new Date(gridStartAt).getTime()) /
      (slotMinutes * 60_000),
    1,
  );
  const height = `${Math.max(34, rowCount * 0.34)}rem`;

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
  onAddBuffer,
  onApproveSlot,
  onCancelSlot,
  onPinReservationPending,
  onPreviewReservationPending,
  onRejectReservation,
  onRemoveBuffer,
  onResizeBuffer,
  onResizeSlot,
  onResizeTimeBlock,
  readOnly = false,
  reservationSlots = [],
  selectedRanges,
  slotMinutes = 30,
  timeBlocks = [],
}: Omit<TimeSelectionGridProps, "dateEnd" | "dateStart"> & {
  calendarGridRef: RefObject<HTMLDivElement | null>;
  date: string;
  dates: string[];
  dayIndex: number;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { gridEndAt, gridStartAt } = getDayGridRange(
    date,
    dailyStartTime,
    dailyEndTime,
  );
  const { draftRanges, gridProps, isDragging } =
    useTimeSelection({
      allowWaitlist,
      blockedRanges: blockedRanges.filter((range) =>
        overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt),
      ),
      calendarGridRef,
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
        overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt),
      ),
      slotMinutes,
    });
  const dayBlocks = timeBlocks.filter((block) =>
    overlapsGrid(block.start_at, block.end_at, gridStartAt, gridEndAt),
  );
  const dayBufferRanges = bufferRanges.filter((range) =>
    overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt),
  );
  const dayBufferItems = bufferItems.filter((range) =>
    overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt),
  );
  const daySlots = reservationSlots.filter((slot) =>
    overlapsGrid(slot.start_at, slot.end_at, gridStartAt, gridEndAt),
  );
  const daySelections = selectedRanges.filter((range) =>
    overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt),
  );
  const rowCount = Math.max(
    (new Date(gridEndAt).getTime() - new Date(gridStartAt).getTime()) /
      (slotMinutes * 60_000),
    1,
  );
  const hourCount = Math.max(
    (new Date(gridEndAt).getTime() - new Date(gridStartAt).getTime()) /
      3_600_000,
    1,
  );
  const height = `${Math.max(34, rowCount * 0.34)}rem`;
  const interactiveProps = readOnly ? undefined : gridProps;

  return (
    <div
      className="relative overflow-visible border-r border-border bg-white last:border-r-0"
      data-day-grid-index={dayIndex}
      ref={gridRef}
      {...(interactiveProps ?? {})}
      style={{
        height,
        ...(interactiveProps?.style ?? {}),
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(217,222,232,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,38,75,0.2) 2px, transparent 2px)",
          backgroundSize: `100% ${100 / rowCount}%, 100% ${100 / hourCount}%`,
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
          resizeEnabled={block.type === "AVAILABLE" && Boolean(onResizeTimeBlock)}
          slotMinutes={slotMinutes}
          tone={block.type === "AVAILABLE" ? "available-soft" : "blocked"}
        />
      ))}

      {(dayBufferItems.length > 0
        ? dayBufferItems
        : dayBufferRanges.map((range, index) => ({
            ...range,
            id: `buffer:${range.startAt}:${range.endAt}:${index}`,
            isActive: true,
            reservationSlotId: "",
            side: "BEFORE" as const,
          }))
      ).map((range) => (
        <RangeBlock
          gridEndAt={gridEndAt}
          gridStartAt={gridStartAt}
          key={range.id}
          details={formatTimeRange(range)}
          label="버퍼"
          popover={
            onRemoveBuffer && range.reservationSlotId ? (
              <BufferPopover
                bufferItem={range}
                onRemoveBuffer={onRemoveBuffer}
              />
            ) : undefined
          }
          onResize={
            onResizeBuffer && range.reservationSlotId
              ? (nextRange) => onResizeBuffer(range, nextRange)
              : undefined
          }
          range={range}
          resizeEnabled={Boolean(onResizeBuffer && range.reservationSlotId)}
          slotMinutes={slotMinutes}
          tone="buffer"
        />
      ))}

      {daySlots.map((slot) => (
        <RangeBlock
          gridEndAt={gridEndAt}
          gridStartAt={gridStartAt}
          details={formatSlotDetails(slot)}
          floatingControls={
            slot.is_confirmed && onAddBuffer ? (
              <ConfirmedSlotBufferControls
                onAddBuffer={onAddBuffer}
                slot={slot}
              />
            ) : undefined
          }
          key={slot.id}
          label={formatSlotLabel(slot)}
          popover={
            slot.is_confirmed ? (
              <ConfirmedSlotPopover
                focused={false}
                onCancelSlot={onCancelSlot}
                onPinReservationPending={onPinReservationPending}
                onPreviewReservationPending={onPreviewReservationPending}
                slot={slot}
              />
            ) : (
              <PendingSlotPopover
                onApproveSlot={onApproveSlot}
                onRejectReservation={onRejectReservation}
                slot={slot}
              />
            )
          }
          onResize={
            slot.is_confirmed && onResizeSlot
              ? (range) => onResizeSlot(slot, range)
              : undefined
          }
          range={{ endAt: slot.end_at, startAt: slot.start_at }}
          resizeEnabled={slot.is_confirmed && Boolean(onResizeSlot)}
          slotMinutes={slotMinutes}
          tone={slot.is_confirmed ? "confirmed" : "waitlist"}
        />
      ))}

      {daySelections.map((range) => (
        <RangeBlock
          gridEndAt={gridEndAt}
          gridStartAt={gridStartAt}
          details={formatTimeRange(range)}
          key={range.id}
          label={range.availability === "waitlist" ? "대기 신청" : "선택"}
          range={range}
          tone={range.availability === "waitlist" ? "waitlist" : "selected"}
        />
      ))}

      {!readOnly
        ? draftRanges
            .filter((range) =>
              overlapsGrid(range.startAt, range.endAt, gridStartAt, gridEndAt),
            )
            .map((range) => (
              <RangeBlock
                gridEndAt={gridEndAt}
                gridStartAt={gridStartAt}
                details={formatTimeRange(range)}
                key={`draft:${range.startAt}:${range.endAt}`}
                label={range.availability === "blocked" ? "불가" : "선택 중"}
                range={range}
                tone={range.availability === "blocked" ? "blocked" : "draft"}
              />
            ))
        : null}

      {!readOnly && isDragging ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md border border-primary bg-white/95 px-2 py-1 text-center text-xs font-medium text-primary shadow-sm">
          드래그 중
        </div>
      ) : null}
    </div>
  );
}

function overlapsGrid(
  startAt: string,
  endAt: string,
  gridStartAt: string,
  gridEndAt: string,
) {
  return (
    new Date(startAt).getTime() < new Date(gridEndAt).getTime() &&
    new Date(gridStartAt).getTime() < new Date(endAt).getTime()
  );
}

type RangeTone =
  | "available-soft"
  | "blocked"
  | "buffer"
  | "confirmed"
  | "draft"
  | "selected"
  | "waitlist";

function RangeBlock({
  details,
  floatingControls,
  gridEndAt,
  gridStartAt,
  label,
  onResize,
  popover,
  range,
  resizeEnabled = false,
  slotMinutes,
  tone,
}: {
  details?: string;
  floatingControls?: ReactNode;
  gridEndAt: string;
  gridStartAt: string;
  label: string;
  onResize?: (range: TimeRange) => void;
  popover?: ReactNode;
  range: TimeRange;
  resizeEnabled?: boolean;
  slotMinutes?: number;
  tone: RangeTone;
}) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [resizeDraft, setResizeDraft] = useState<TimeRange | null>(null);
  const [resizeEdge, setResizeEdge] = useState<"end" | "start" | null>(null);
  const displayRange = resizeDraft ?? range;
  const layout = getRangeLayout(displayRange, gridStartAt, gridEndAt);

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
        currentEnd - minDuration,
      );

      return {
        endAt: range.endAt,
        startAt: new Date(nextStart).toISOString(),
      };
    }

    const nextEnd = Math.max(
      Math.min(snappedTimestamp, gridEnd),
      currentStart + minDuration,
    );

    return {
      endAt: new Date(nextEnd).toISOString(),
      startAt: range.startAt,
    };
  }

  function handleResizePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    edge: "end" | "start",
  ) {
    event.preventDefault();
    event.stopPropagation();
    setResizeEdge(edge);
    setResizeDraft(buildResizeDraft(event.clientY, edge));
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleResizePointerMove(
    event: PointerEvent<HTMLButtonElement>,
  ) {
    if (!resizeEdge) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setResizeDraft(buildResizeDraft(event.clientY, resizeEdge));
  }

  function handleResizePointerUp(
    event: PointerEvent<HTMLButtonElement>,
  ) {
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

  return (
    <div
      ref={blockRef}
      tabIndex={popover ? 0 : undefined}
      onPointerDown={
        popover ? (event) => event.stopPropagation() : undefined
      }
      className={cn(
        "group absolute inset-x-1 rounded-md border px-2 py-1 text-[11px] font-medium shadow-sm outline-none",
        tone === "available-soft" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "blocked" &&
          "border-zinc-300 bg-zinc-100 text-zinc-600 opacity-90",
        tone === "buffer" &&
          "border-slate-200 bg-[repeating-linear-gradient(135deg,#f1f5f9_0,#f1f5f9_5px,#e2e8f0_5px,#e2e8f0_10px)] text-slate-600",
        tone === "confirmed" &&
          "border-primary bg-primary text-primary-foreground",
        tone === "draft" && "border-accent bg-accent-soft text-accent",
        tone === "selected" &&
          "border-accent bg-[#fff9ec] text-foreground ring-1 ring-accent",
        tone === "waitlist" &&
          "border-amber-300 bg-[repeating-linear-gradient(135deg,#fef3c7_0,#fef3c7_6px,#fde68a_6px,#fde68a_12px)] text-amber-900",
      )}
      style={layout}
      title={details ?? formatTimeRange(range)}
    >
      <div className="truncate">{label}</div>
      {resizeEnabled ? (
        <>
          <button
            aria-label="시작 시간 조절"
            className="absolute inset-x-0 top-0 h-2 cursor-ns-resize rounded-t-md opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            onPointerCancel={() => {
              setResizeDraft(null);
              setResizeEdge(null);
            }}
            onPointerDown={(event) => handleResizePointerDown(event, "start")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            type="button"
          />
          <button
            aria-label="종료 시간 조절"
            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize rounded-b-md opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            onPointerCancel={() => {
              setResizeDraft(null);
              setResizeEdge(null);
            }}
            onPointerDown={(event) => handleResizePointerDown(event, "end")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            type="button"
          />
        </>
      ) : null}
      {floatingControls ? (
        <div className="pointer-events-none absolute inset-x-0 -top-8 hidden justify-center group-hover:flex group-focus-within:flex">
          <div
            className="pointer-events-auto"
            onPointerDown={(event) => event.stopPropagation()}
          >
            {floatingControls}
          </div>
        </div>
      ) : null}
      {popover ? (
        <div
          className="absolute left-[calc(100%+0.35rem)] top-0 z-40 hidden w-64 group-hover:block group-focus-within:block"
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
  onRejectReservation,
  slot,
}: {
  onApproveSlot?: (slot: EventScheduleSlot) => void;
  onRejectReservation?: (reservationId: string) => void;
  slot: EventScheduleSlot;
}) {
  return (
    <SchedulePopover>
      <SlotDetails slot={slot} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <PopoverButton onClick={() => onApproveSlot?.(slot)}>
          승인
        </PopoverButton>
        <PopoverButton onClick={() => onRejectReservation?.(slot.reservation_id)}>
          거절
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
          onMouseEnter={() => onPreviewReservationPending?.(slot.reservation_id)}
          onMouseLeave={() => onPreviewReservationPending?.(null)}
        >
          이 그룹 펜딩 보기
        </PopoverButton>
      </div>
    </SchedulePopover>
  );
}

function BufferPopover({
  bufferItem,
  onRemoveBuffer,
}: {
  bufferItem: CalendarBufferItem;
  onRemoveBuffer: (bufferItem: CalendarBufferItem) => void;
}) {
  return (
    <SchedulePopover>
      <p className="text-sm font-semibold text-primary">
        {bufferItem.side === "BEFORE" ? "약속 전 버퍼" : "약속 후 버퍼"}
      </p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {formatTimeRange(bufferItem)}
      </p>
      <PopoverButton className="mt-3" onClick={() => onRemoveBuffer(bufferItem)}>
        버퍼 삭제
      </PopoverButton>
    </SchedulePopover>
  );
}

function ConfirmedSlotBufferControls({
  onAddBuffer,
  slot,
}: {
  onAddBuffer: (slot: EventScheduleSlot, side: "BEFORE" | "AFTER") => void;
  slot: EventScheduleSlot;
}) {
  return (
    <div className="flex gap-1">
      <button
        className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-primary shadow-sm"
        onClick={() => onAddBuffer(slot, "BEFORE")}
        type="button"
      >
        + 앞
      </button>
      <button
        className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-primary shadow-sm"
        onClick={() => onAddBuffer(slot, "AFTER")}
        type="button"
      >
        + 뒤
      </button>
    </div>
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
        className,
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
        총 {slot.headcount}명 · {slot.is_confirmed ? "확정" : "대기"}
      </p>
      <p className="mt-2 font-mono text-xs text-foreground">
        {formatTimeRange({ endAt: slot.end_at, startAt: slot.start_at })}
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        {slot.reservationAccessCode}
      </p>
    </div>
  );
}

function formatSlotLabel(slot: EventScheduleSlot) {
  const names = slot.participantNames.filter(Boolean);

  if (names.length === 0) {
    return slot.is_confirmed ? `확정 (${slot.headcount}명)` : `대기 (${slot.headcount}명)`;
  }

  return `${names[0]} (${slot.headcount}명)`;
}

function formatSlotDetails(slot: EventScheduleSlot) {
  const names = slot.participantNames.filter(Boolean);
  const participants = names.length > 0 ? names.join(", ") : "이름 없음";
  const status = slot.is_confirmed ? "확정" : "대기";
  const time = formatTimeRange({
    endAt: slot.end_at,
    startAt: slot.start_at,
  });

  return `${status} | ${participants} | 총 ${slot.headcount}명 | ${time} | 관리 코드 ${slot.reservationAccessCode}`;
}
