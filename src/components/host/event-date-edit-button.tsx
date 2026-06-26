"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import {
  updateEventDateRange,
  type PublicEvent,
} from "@/app/actions/events";
import { MeridiemTimeInput } from "@/components/calendar/meridiem-time-input";
import { MonthJumpDialog } from "@/components/calendar/month-jump-dialog";
import { Button } from "@/components/ui/button";
import { getWeekdayTextClass } from "@/lib/time/calendar-style";
import { cn } from "@/lib/utils";

type EventDateEditButtonProps = {
  activeDates: string[];
  event: PublicEvent;
};

export function EventDateEditButton({
  activeDates,
  event,
}: EventDateEditButtonProps) {
  const router = useRouter();
  const [activeDateDrafts, setActiveDateDrafts] = useState(activeDates);
  const [dailyEndTimeDraft, setDailyEndTimeDraft] = useState(
    event.daily_end_time,
  );
  const [dailyStartTimeDraft, setDailyStartTimeDraft] = useState(
    event.daily_start_time,
  );
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  function openDialog() {
    setActiveDateDrafts(activeDates);
    setDailyEndTimeDraft(event.daily_end_time);
    setDailyStartTimeDraft(event.daily_start_time);
    setError(null);
    setIsOpen(true);
  }

  function closeDialog() {
    setActiveDateDrafts(activeDates);
    setDailyEndTimeDraft(event.daily_end_time);
    setDailyStartTimeDraft(event.daily_start_time);
    setError(null);
    setIsOpen(false);
  }

  async function handleSave() {
    setError(null);
    setIsPending(true);

    const result = await updateEventDateRange({
      activeDates: activeDateDrafts,
      dailyEndTime: dailyEndTimeDraft,
      dailyStartTime: dailyStartTimeDraft,
      eventId: event.id,
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setIsOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        aria-label="날짜 수정"
        onClick={openDialog}
        size="sm"
        title="날짜 수정"
        variant="ghost"
      >
        <CalendarDays className="size-4" aria-hidden="true" />
      </Button>
      {isOpen ? (
        <DateRangeDialog
          activeDates={activeDateDrafts}
          dailyEndTime={dailyEndTimeDraft}
          dailyStartTime={dailyStartTimeDraft}
          dateStart={event.date_start}
          error={error}
          isPending={isPending}
          onChange={setActiveDateDrafts}
          onClose={closeDialog}
          onDailyEndTimeChange={setDailyEndTimeDraft}
          onDailyStartTimeChange={setDailyStartTimeDraft}
          onSave={handleSave}
        />
      ) : null}
    </>
  );
}

function DateRangeDialog({
  activeDates,
  dailyEndTime,
  dailyStartTime,
  dateStart,
  error,
  isPending,
  onChange,
  onClose,
  onDailyEndTimeChange,
  onDailyStartTimeChange,
  onSave,
}: {
  activeDates: string[];
  dailyEndTime: string;
  dailyStartTime: string;
  dateStart: string;
  error: string | null;
  isPending: boolean;
  onChange: (activeDates: string[]) => void;
  onClose: () => void;
  onDailyEndTimeChange: (value: string) => void;
  onDailyStartTimeChange: (value: string) => void;
  onSave: () => void;
}) {
  const [isMonthDialogOpen, setIsMonthDialogOpen] = useState(false);
  const isStartAtZero = isZeroHour(dailyStartTime);
  const isEndAtMidnight = isEndMidnight(dailyEndTime);

  useEffect(() => {
    if (isMonthDialogOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMonthDialogOpen, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/30 p-4 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl border border-border bg-background p-4 shadow-xl">
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

        <div className="space-y-4">
          <MiniDateRangePicker
            activeDates={activeDates}
            initialDateStart={dateStart}
            isMonthDialogOpen={isMonthDialogOpen}
            onChange={onChange}
            onMonthDialogOpenChange={setIsMonthDialogOpen}
          />
          <div className="grid gap-3 rounded-md border border-border bg-muted p-3 sm:grid-cols-2">
            <MeridiemTimeInput
              disabled={isStartAtZero}
              label="기본 시작 시간"
              labelAccessory={
                <TimePresetCheckbox
                  checked={isStartAtZero}
                  label="0시"
                  onChange={(checked) =>
                    onDailyStartTimeChange(checked ? "00:00" : "09:00")
                  }
                />
              }
              onChange={onDailyStartTimeChange}
              value={dailyStartTime}
            />
            <MeridiemTimeInput
              disabled={isEndAtMidnight}
              label="기본 종료 시간"
              labelAccessory={
                <TimePresetCheckbox
                  checked={isEndAtMidnight}
                  label="자정"
                  onChange={(checked) =>
                    onDailyEndTimeChange(checked ? "24:00" : "18:00")
                  }
                />
              }
              onChange={(value) =>
                onDailyEndTimeChange(normalizeDailyEndTime(value))
              }
              value={dailyEndTime}
            />
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          활성 날짜를 클릭하거나 드래그해서 켜고 끌 수 있습니다.
        </p>
        {error ? (
          <p className="mt-3 border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
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
  isMonthDialogOpen,
  onChange,
  onMonthDialogOpenChange,
}: {
  activeDates: string[];
  initialDateStart: string;
  isMonthDialogOpen: boolean;
  onChange: (activeDates: string[]) => void;
  onMonthDialogOpenChange: (isOpen: boolean) => void;
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
  const today = toDateInputValue(new Date());

  function moveMonth(offset: number) {
    setMonthDate((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + offset);
      return next;
    });
  }

  function goToday() {
    setMonthDate(parseDateOnly(toDateInputValue(new Date())));
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
        <div className="flex items-center justify-center gap-2">
          <button
            aria-label="연월 선택"
            className="h-9 rounded-md border border-border bg-background px-3 font-serif text-lg font-semibold text-primary shadow-sm outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => onMonthDialogOpenChange(true)}
            type="button"
          >
            {monthLabel}
          </button>
          <button
            className="px-1 text-xs font-medium text-primary underline underline-offset-4 outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-primary"
            onClick={goToday}
            type="button"
          >
            오늘
          </button>
        </div>
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
        {["일", "월", "화", "수", "목", "금", "토"].map((weekday, index) => (
          <div className={cn("py-1", getWeekdayTextClass(index))} key={weekday}>
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
                "relative h-9 rounded-md border text-sm font-medium transition-colors",
                getDateButtonActiveState(
                  day,
                  activeDateSet,
                  previewDateSet,
                  dragMode,
                )
                  ? "border-primary bg-primary text-primary-foreground"
                  : cn("border-border bg-background", getWeekdayTextClass(day)),
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
              <span>{Number(day.slice(-2))}</span>
              {day === today ? (
                <TodayMarker
                  isActive={getDateButtonActiveState(
                    day,
                    activeDateSet,
                    previewDateSet,
                    dragMode
                  )}
                />
              ) : null}
            </button>
          ) : (
            <div key={`blank-${monthLabel}-${index}`} />
          ),
        )}
      </div>
      {isMonthDialogOpen ? (
        <MonthJumpDialog
          monthDate={monthDate}
          onClose={() => onMonthDialogOpenChange(false)}
          onSave={(nextMonthDate) => {
            setMonthDate(nextMonthDate);
            onMonthDialogOpenChange(false);
          }}
        />
      ) : null}
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

function TimePresetCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-primary">
      <input
        checked={checked}
        className="size-3.5 accent-primary"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function TodayMarker({ isActive }: { isActive: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full",
        isActive ? "bg-primary-foreground" : "bg-primary"
      )}
    />
  );
}

function isZeroHour(value: string) {
  return value.startsWith("00:00");
}

function isEndMidnight(value: string) {
  return value.startsWith("24:00");
}

function normalizeDailyEndTime(value: string) {
  return value.startsWith("00:00") ? "24:00" : value;
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
      toDateInputValue(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), day),
      ),
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
