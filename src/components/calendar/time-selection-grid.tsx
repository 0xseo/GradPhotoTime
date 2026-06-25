"use client";

import { useRef } from "react";
import { useTimeSelection } from "@/hooks/use-time-selection";
import {
  formatTimeRange,
  getDayGridRange,
  getEventDays,
  getRangeLayout,
  getTimeLabels,
  isSameDate,
} from "@/lib/time/event-days";
import { cn } from "@/lib/utils";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import type { Tables } from "@/lib/supabase/database.types";
import type { SelectedTimeRange, TimeRange, TimeSelectionMode } from "@/types/domain";

type TimeSelectionGridProps = {
  allowWaitlist?: boolean;
  blockedRanges?: TimeRange[];
  bufferRanges?: TimeRange[];
  dailyEndTime: string;
  dailyStartTime: string;
  dateEnd: string;
  dateStart: string;
  mode: TimeSelectionMode;
  occupiedRanges?: TimeRange[];
  readOnly?: boolean;
  reservationSlots?: EventScheduleSlot[];
  selectedRanges: SelectedTimeRange[];
  slotMinutes?: number;
  timeBlocks?: Tables<"time_blocks">[];
};

export function TimeSelectionGrid({
  allowWaitlist = false,
  blockedRanges = [],
  bufferRanges = [],
  dailyEndTime,
  dailyStartTime,
  dateEnd,
  dateStart,
  mode,
  occupiedRanges = [],
  readOnly = false,
  reservationSlots = [],
  selectedRanges,
  slotMinutes = 10,
  timeBlocks = [],
}: TimeSelectionGridProps) {
  const days = getEventDays(dateStart, dateEnd);

  return (
    <div className="overflow-x-auto border border-border bg-background">
      <div
        className="grid min-w-[44rem]"
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
        {days.map((day) => (
          <DaySelectionGrid
            allowWaitlist={allowWaitlist}
            blockedRanges={blockedRanges}
            bufferRanges={bufferRanges}
            dailyEndTime={dailyEndTime}
            dailyStartTime={dailyStartTime}
            date={day.date}
            key={day.date}
            mode={mode}
            occupiedRanges={occupiedRanges}
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
  blockedRanges = [],
  bufferRanges = [],
  dailyEndTime,
  dailyStartTime,
  date,
  mode,
  occupiedRanges = [],
  readOnly = false,
  reservationSlots = [],
  selectedRanges,
  slotMinutes = 30,
  timeBlocks = [],
}: Omit<TimeSelectionGridProps, "dateEnd" | "dateStart"> & {
  date: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { gridEndAt, gridStartAt } = getDayGridRange(
    date,
    dailyStartTime,
    dailyEndTime,
  );
  const { draftAvailability, draftRange, gridProps, isDragging } =
    useTimeSelection({
      allowWaitlist,
      blockedRanges: blockedRanges.filter((range) => isSameDate(range.startAt, date)),
      gridEndAt,
      gridRef,
      gridStartAt,
      minDurationMinutes: slotMinutes,
      mode,
      occupiedRanges: occupiedRanges.filter((range) =>
        isSameDate(range.startAt, date),
      ),
      slotMinutes,
    });
  const dayBlocks = timeBlocks.filter((block) => isSameDate(block.start_at, date));
  const dayBufferRanges = bufferRanges.filter((range) =>
    isSameDate(range.startAt, date),
  );
  const daySlots = reservationSlots.filter((slot) => isSameDate(slot.start_at, date));
  const daySelections = selectedRanges.filter((range) =>
    isSameDate(range.startAt, date),
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
      className="relative overflow-hidden border-r border-border bg-white last:border-r-0"
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
          range={{ endAt: block.end_at, startAt: block.start_at }}
          tone={block.type === "AVAILABLE" ? "available-soft" : "blocked"}
        />
      ))}

      {dayBufferRanges.map((range) => (
        <RangeBlock
          gridEndAt={gridEndAt}
          gridStartAt={gridStartAt}
          key={`${range.startAt}-${range.endAt}`}
          details={formatTimeRange(range)}
          label="버퍼"
          range={range}
          tone="buffer"
        />
      ))}

      {daySlots.map((slot) => (
        <RangeBlock
          gridEndAt={gridEndAt}
          gridStartAt={gridStartAt}
          details={formatSlotDetails(slot)}
          key={slot.id}
          label={formatSlotLabel(slot)}
          range={{ endAt: slot.end_at, startAt: slot.start_at }}
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

      {!readOnly && draftRange && isSameDate(draftRange.startAt, date) ? (
        <RangeBlock
          gridEndAt={gridEndAt}
          gridStartAt={gridStartAt}
          details={formatTimeRange(draftRange)}
          label={draftAvailability === "blocked" ? "불가" : "선택 중"}
          range={draftRange}
          tone={draftAvailability === "blocked" ? "blocked" : "draft"}
        />
      ) : null}

      {!readOnly && isDragging ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md border border-primary bg-white/95 px-2 py-1 text-center text-xs font-medium text-primary shadow-sm">
          드래그 중
        </div>
      ) : null}
    </div>
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
  gridEndAt,
  gridStartAt,
  label,
  range,
  tone,
}: {
  details?: string;
  gridEndAt: string;
  gridStartAt: string;
  label: string;
  range: TimeRange;
  tone: RangeTone;
}) {
  const layout = getRangeLayout(range, gridStartAt, gridEndAt);

  if (!layout) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-x-1 rounded-md border px-2 py-1 text-[11px] font-medium shadow-sm",
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
