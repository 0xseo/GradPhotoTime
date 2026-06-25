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
import { TimeSelectionGrid } from "@/components/calendar/time-selection-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getEventDays,
  toLocalIsoDateTime,
} from "@/lib/time/event-days";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/store/use-selection-store";
import type { SelectedTimeRange } from "@/types/domain";

const FULL_DAY_START = "00:00";
const FULL_DAY_END = "24:00";
const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "18:00";
const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50"];

export function EventCreateForm() {
  const router = useRouter();
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [dailyEndTime, setDailyEndTime] = useState(DEFAULT_END_TIME);
  const [dailyStartTime, setDailyStartTime] = useState(DEFAULT_START_TIME);
  const [dateEnd, setDateEnd] = useState(today);
  const [dateStart, setDateStart] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const setSelectedRanges = useSelectionStore((state) => state.setSelectedRanges);
  const canShowGrid =
    dateStart !== "" &&
    dateEnd !== "" &&
    dailyStartTime !== "" &&
    dailyEndTime !== "" &&
    dateStart <= dateEnd &&
    dailyStartTime < dailyEndTime;

  useEffect(() => {
    if (!canShowGrid) {
      clearSelection();
      return;
    }

    setSelectedRanges(
      buildDefaultAvailableRanges(dateStart, dateEnd, dailyStartTime, dailyEndTime),
    );
  }, [
    canShowGrid,
    clearSelection,
    dailyEndTime,
    dailyStartTime,
    dateEnd,
    dateStart,
    setSelectedRanges,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (selectedRanges.length === 0) {
      setError("촬영 가능한 시간을 하나 이상 선택해 주세요.");
      return;
    }

    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await createEvent({
      bufferTimeMinutes: Number(formData.get("bufferTimeMinutes") ?? 30),
      dailyEndTime: FULL_DAY_END,
      dailyStartTime: FULL_DAY_START,
      dateEnd,
      dateStart,
      description: String(formData.get("description") ?? ""),
      initialAvailableBlocks: selectedRanges.map((range) => ({
        endAt: range.endAt,
        startAt: range.startAt,
      })),
      isBufferActive: formData.get("isBufferActive") === "on",
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

      <DateRangePicker
        dateEnd={dateEnd}
        dateStart={dateStart}
        onChange={(nextStart, nextEnd) => {
          setDateStart(nextStart);
          setDateEnd(nextEnd);
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="시작일"
          name="dateStart"
          onChange={(eventChange) => setDateStart(eventChange.target.value)}
          required
          type="date"
          value={dateStart}
        />
        <Input
          label="종료일"
          name="dateEnd"
          onChange={(eventChange) => setDateEnd(eventChange.target.value)}
          required
          type="date"
          value={dateEnd}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MeridiemTimeInput
          label="시작 시간"
          onChange={setDailyStartTime}
          value={dailyStartTime}
        />
        <MeridiemTimeInput
          label="종료 시간"
          onChange={setDailyEndTime}
          value={dailyEndTime}
        />
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Input
          defaultValue={30}
          label="버퍼 타임"
          max={180}
          min={0}
          name="bufferTimeMinutes"
          step={10}
          type="number"
        />
        <label className="flex h-12 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground">
          <input className="size-4 accent-primary" name="isBufferActive" type="checkbox" />
          사용
        </label>
      </div>

      {canShowGrid ? (
        <div className="space-y-4 border-t border-border pt-5">
          <div className="flex items-center gap-2 text-primary">
            <CalendarRange className="size-5" aria-hidden="true" />
            <h2 className="font-serif text-2xl font-semibold">
              촬영 가능 시간
            </h2>
          </div>
          <TimeSelectionGrid
            dailyEndTime={FULL_DAY_END}
            dailyStartTime={FULL_DAY_START}
            dateEnd={dateEnd}
            dateStart={dateStart}
            mode="host-availability"
            selectedRanges={selectedRanges}
            slotMinutes={10}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              선택 {selectedRanges.length}개
            </p>
            <Button
              disabled={selectedRanges.length === 0}
              onClick={clearSelection}
              variant="outline"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              선택 초기화
            </Button>
          </div>
        </div>
      ) : null}

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

function DateRangePicker({
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

  function handlePointerMove(clientX: number, clientY: number) {
    if (!anchorDate) {
      return;
    }

    const element = document.elementFromPoint(clientX, clientY);
    const nextDate = element
      ?.closest<HTMLButtonElement>("[data-calendar-date]")
      ?.dataset.calendarDate;

    if (nextDate) {
      updateRange(nextDate);
    }
  }

  return (
    <div className="border border-border bg-muted p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          aria-label="이전 달"
          className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-primary"
          onClick={() => moveMonth(-1)}
          type="button"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <p className="font-serif text-xl font-semibold text-primary">
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
        onPointerMove={(event) => handlePointerMove(event.clientX, event.clientY)}
        onPointerUp={() => setAnchorDate(null)}
      >
        {days.map((day, index) =>
          day ? (
            <button
              className={cn(
                "h-10 rounded-md border text-sm font-medium",
                dateStart <= day && day <= dateEnd
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground",
              )}
              data-calendar-date={day}
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

function MeridiemTimeInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const parts = parseMeridiemTime(value);

  function update(next: Partial<typeof parts>) {
    onChange(formatMeridiemTime({ ...parts, ...next }));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="grid grid-cols-[5.5rem_1fr_5rem] gap-2">
        <select
          className="h-12 rounded-md border border-border bg-background px-2 text-base text-foreground outline-none focus:border-primary"
          onChange={(event) =>
            update({ period: event.target.value as "AM" | "PM" })
          }
          value={parts.period}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
        <Input
          aria-label={`${label} 시`}
          max={12}
          min={1}
          onChange={(event) =>
            update({ hour: clampHour(Number(event.target.value)) })
          }
          type="number"
          value={parts.hour}
        />
        <select
          aria-label={`${label} 분`}
          className="h-12 rounded-md border border-border bg-background px-2 text-base text-foreground outline-none focus:border-primary"
          onChange={(event) => update({ minute: event.target.value })}
          value={parts.minute}
        >
          {MINUTE_OPTIONS.map((minute) => (
            <option key={minute} value={minute}>
              {minute}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function buildDefaultAvailableRanges(
  dateStart: string,
  dateEnd: string,
  dailyStartTime: string,
  dailyEndTime: string,
) {
  return getEventDays(dateStart, dateEnd).map<SelectedTimeRange>((day) => {
    const startAt = toLocalIsoDateTime(day.date, dailyStartTime);
    const endAt = toLocalIsoDateTime(day.date, dailyEndTime);

    return {
      availability: "available",
      endAt,
      id: `available:${startAt}:${endAt}`,
      startAt,
    };
  });
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

function parseMeridiemTime(value: string) {
  const [hourText, minuteText = "00"] = value.split(":");
  const hour24 = Number(hourText);
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return {
    hour,
    minute: MINUTE_OPTIONS.includes(minuteText) ? minuteText : "00",
    period,
  };
}

function formatMeridiemTime({
  hour,
  minute,
  period,
}: {
  hour: number;
  minute: string;
  period: "AM" | "PM";
}) {
  const normalizedHour = clampHour(hour);
  const hour24 =
    period === "AM"
      ? normalizedHour === 12
        ? 0
        : normalizedHour
      : normalizedHour === 12
        ? 12
        : normalizedHour + 12;

  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

function clampHour(value: number) {
  if (Number.isNaN(value)) {
    return 1;
  }

  return Math.min(Math.max(value, 1), 12);
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
