"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
} from "lucide-react";
import { createEvent } from "@/app/actions/events";
import { MeridiemTimeInput } from "@/components/calendar/meridiem-time-input";
import { MonthJumpDialog } from "@/components/calendar/month-jump-dialog";
import { TimeSelectionGrid } from "@/components/calendar/time-selection-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getWeekdayTextClass } from "@/lib/time/calendar-style";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/store/use-selection-store";

const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "18:00";
type SetupPanel = "availability" | "schedule";

export function EventCreateForm() {
  const router = useRouter();
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [activeSetupPanel, setActiveSetupPanel] =
    useState<SetupPanel>("schedule");
  const [dailyEndTime, setDailyEndTime] = useState(DEFAULT_END_TIME);
  const [dailyStartTime, setDailyStartTime] = useState(DEFAULT_START_TIME);
  const [activeDates, setActiveDates] = useState<string[]>([today]);
  const [dateEnd, setDateEnd] = useState(today);
  const [dateStart, setDateStart] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [isBufferAfterActive, setIsBufferAfterActive] = useState(true);
  const [isBufferBeforeActive, setIsBufferBeforeActive] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const canShowGrid =
    dateStart !== "" &&
    dateEnd !== "" &&
    dailyStartTime !== "" &&
    dailyEndTime !== "" &&
    dateStart <= dateEnd &&
    activeDates.length > 0 &&
    dailyStartTime < dailyEndTime;
  const isStartAtZero = isZeroHour(dailyStartTime);
  const isEndAtMidnight = isEndMidnight(dailyEndTime);

  useEffect(() => {
    if (!canShowGrid) {
      clearSelection();
    }
  }, [canShowGrid, clearSelection]);

  function updateActiveDates(nextActiveDates: string[]) {
    const sortedDates = [...new Set(nextActiveDates)].sort();

    setActiveDates(sortedDates);
    clearSelection();

    if (sortedDates.length > 0) {
      setDateStart(sortedDates[0]);
      setDateEnd(sortedDates.at(-1) ?? sortedDates[0]);
    }
  }

  function updateDateInputs(nextStart: string, nextEnd: string) {
    setDateStart(nextStart);
    setDateEnd(nextEnd);
    clearSelection();

    if (nextStart !== "" && nextEnd !== "" && nextStart <= nextEnd) {
      setActiveDates(buildDateList(nextStart, nextEnd));
    } else {
      setActiveDates([]);
    }
  }

  function updateDailyStartTime(value: string) {
    setDailyStartTime(value);
    clearSelection();
  }

  function updateDailyEndTime(value: string) {
    setDailyEndTime(normalizeDailyEndTime(value));
    clearSelection();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await createEvent({
      bufferTimeMinutes: Number(formData.get("bufferTimeMinutes") ?? 30),
      activeDates,
      dailyEndTime,
      dailyStartTime,
      dateEnd,
      dateStart,
      description: String(formData.get("description") ?? ""),
      initialAvailableBlocks: selectedRanges.map((range) => ({
        endAt: range.endAt,
        startAt: range.startAt,
      })),
      isBufferActive: isBufferBeforeActive || isBufferAfterActive,
      isBufferAfterActive,
      isBufferBeforeActive,
      title: String(formData.get("title") ?? ""),
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    clearSelection();
    router.push(`/host/events/${result.data.event.id}`);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Input label="이벤트명" name="title" placeholder="졸업사진 촬영" />
      <label className="block space-y-2">
        <span className="text-sm font-medium text-foreground">설명</span>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          name="description"
          placeholder="친구들이 알아야 할 촬영 장소나 준비물을 적어두세요."
        />
      </label>

      <div className="border border-border bg-background">
        <div className="grid grid-cols-2 border-b border-border">
          <button
            aria-selected={activeSetupPanel === "schedule"}
            className={cn(
              "h-11 border-b-2 text-sm font-medium transition-colors",
              activeSetupPanel === "schedule"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary",
            )}
            onClick={() => setActiveSetupPanel("schedule")}
            role="tab"
            type="button"
          >
            일정 / 버퍼
          </button>
          <button
            aria-selected={activeSetupPanel === "availability"}
            className={cn(
              "h-11 border-b-2 text-sm font-medium transition-colors",
              activeSetupPanel === "availability"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary",
            )}
            onClick={() => setActiveSetupPanel("availability")}
            role="tab"
            type="button"
          >
            가능 시간
          </button>
        </div>

        {activeSetupPanel === "schedule" ? (
          <div className="space-y-4 p-4">
            <ActiveDatePicker
              activeDates={activeDates}
              initialDateStart={dateStart || today}
              onChange={updateActiveDates}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="시작일"
                name="dateStart"
                onChange={(eventChange) =>
                  updateDateInputs(eventChange.target.value, dateEnd)
                }
                required
                type="date"
                value={dateStart}
              />
              <Input
                label="종료일"
                name="dateEnd"
                onChange={(eventChange) =>
                  updateDateInputs(dateStart, eventChange.target.value)
                }
                required
                type="date"
                value={dateEnd}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MeridiemTimeInput
                disabled={isStartAtZero}
                label="시작 시간"
                labelAccessory={
                  <TimePresetCheckbox
                    checked={isStartAtZero}
                    label="0시"
                    onChange={(checked) =>
                      updateDailyStartTime(
                        checked ? "00:00" : DEFAULT_START_TIME
                      )
                    }
                  />
                }
                onChange={updateDailyStartTime}
                value={dailyStartTime}
              />
              <MeridiemTimeInput
                disabled={isEndAtMidnight}
                label="종료 시간"
                labelAccessory={
                  <TimePresetCheckbox
                    checked={isEndAtMidnight}
                    label="자정"
                    onChange={(checked) =>
                      updateDailyEndTime(checked ? "24:00" : DEFAULT_END_TIME)
                    }
                  />
                }
                onChange={updateDailyEndTime}
                value={dailyEndTime}
              />
            </div>
            <div className="space-y-3">
              <Input
                defaultValue={30}
                label="버퍼 타임(분)"
                max={180}
                min={0}
                name="bufferTimeMinutes"
                step={10}
                type="number"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-background text-sm text-foreground">
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
                <label className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-background text-sm text-foreground">
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
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-primary">
                <CalendarRange className="size-5" aria-hidden="true" />
                <h2 className="font-serif text-2xl font-semibold">
                  촬영 가능 시간
                </h2>
              </div>
              <Button
                disabled={selectedRanges.length === 0}
                onClick={clearSelection}
                size="sm"
                variant="outline"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                초기화
              </Button>
            </div>
            {canShowGrid ? (
              <TimeSelectionGrid
                activeDates={activeDates}
                dailyEndTime={dailyEndTime}
                dailyStartTime={dailyStartTime}
                dateEnd={dateEnd}
                dateStart={dateStart}
                mode="host-availability"
                selectedRanges={selectedRanges}
                slotHeightRem={1.65}
              />
            ) : (
              <p className="border border-border bg-muted p-4 text-sm text-muted-foreground">
                일정과 기본 시간대를 먼저 정하면 여기에서 드래그로 가능 시간을
                추가할 수 있습니다.
              </p>
            )}
          </div>
        )}
      </div>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="size-4" aria-hidden="true" />
        )}
        이벤트 만들기
      </Button>
    </form>
  );
}

function ActiveDatePicker({
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
  const [isMonthDialogOpen, setIsMonthDialogOpen] = useState(false);
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

  function handlePointerMove(clientX: number, clientY: number) {
    if (!anchorDate) {
      return;
    }

    const element = document.elementFromPoint(clientX, clientY);
    const nextDate = element
      ?.closest<HTMLButtonElement>("[data-calendar-date]")
      ?.dataset.calendarDate;

    if (nextDate) {
      updatePreview(nextDate);
    }
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

  function cancelPreview() {
    setAnchorDate(null);
    setDragMode(null);
    setDragPreviewDates([]);
  }

  return (
    <div className="border border-border bg-muted p-4">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex justify-start">
          <button
            aria-label="이전 달"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-primary"
            onClick={() => moveMonth(-1)}
            type="button"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex justify-center">
          <button
            aria-label="연월 선택"
            className="h-9 rounded-md border border-border bg-background px-3 font-serif text-lg font-semibold text-primary shadow-sm outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setIsMonthDialogOpen(true)}
            type="button"
          >
            {monthLabel}
          </button>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            className="px-1 text-xs font-medium text-primary underline underline-offset-4 outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-primary"
            onClick={goToday}
            type="button"
          >
            오늘
          </button>
          <button
            aria-label="다음 달"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-primary"
            onClick={() => moveMonth(1)}
            type="button"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
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
        onPointerCancel={cancelPreview}
        onPointerMove={(event) => handlePointerMove(event.clientX, event.clientY)}
        onPointerUp={commitPreview}
      >
        {days.map((day, index) =>
          day ? (
            <button
              className={cn(
                "relative h-10 rounded-md border text-sm font-medium transition-colors",
                getDateButtonActiveState(
                  day,
                  activeDateSet,
                  previewDateSet,
                  dragMode,
                )
                  ? "border-primary bg-primary text-primary-foreground"
                  : cn("border-border bg-background", getWeekdayTextClass(day)),
              )}
              data-calendar-date={day}
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
          onClose={() => setIsMonthDialogOpen(false)}
          onSave={(nextMonthDate) => {
            setMonthDate(nextMonthDate);
            setIsMonthDialogOpen(false);
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
        "absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full",
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
