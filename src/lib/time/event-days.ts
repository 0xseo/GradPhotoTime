import type { TimeRange } from "@/types/domain";

const MINUTE_IN_MS = 60_000;
const DAY_IN_MS = 24 * 60 * MINUTE_IN_MS;

export type EventDay = {
  date: string;
  label: string;
  weekday: string;
};

export function getEventDays(dateStart: string, dateEnd: string) {
  const start = parseDateOnly(dateStart);
  const end = parseDateOnly(dateEnd);
  const days: EventDay[] = [];

  for (
    let timestamp = start.getTime();
    timestamp <= end.getTime();
    timestamp += DAY_IN_MS
  ) {
    const date = new Date(timestamp);
    const isoDate = toDateOnly(date);

    days.push({
      date: isoDate,
      label: new Intl.DateTimeFormat("ko-KR", {
        day: "numeric",
        month: "short",
      }).format(date),
      weekday: new Intl.DateTimeFormat("ko-KR", {
        weekday: "short",
      }).format(date),
    });
  }

  return days;
}

export function getDayGridRange(date: string, startTime: string, endTime: string) {
  return {
    gridEndAt: toLocalIsoDateTime(date, endTime),
    gridStartAt: toLocalIsoDateTime(date, startTime),
  };
}

export function toLocalIsoDateTime(date: string, time: string) {
  if (time.startsWith("24:")) {
    const nextDate = new Date(`${date}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);

    return new Date(
      `${toDateOnly(nextDate)}T${normalizeTime("00:00")}`,
    ).toISOString();
  }

  return new Date(`${date}T${normalizeTime(time)}`).toISOString();
}

export function getTimeLabels(startAt: string, endAt: string, intervalMinutes = 60) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const labels: string[] = [];

  for (
    let timestamp = start;
    timestamp <= end;
    timestamp += intervalMinutes * MINUTE_IN_MS
  ) {
    labels.push(formatTime(new Date(timestamp).toISOString()));
  }

  return labels;
}

export function getRangeLayout(
  range: TimeRange,
  gridStartAt: string,
  gridEndAt: string,
) {
  const gridStart = new Date(gridStartAt).getTime();
  const gridEnd = new Date(gridEndAt).getTime();
  const rangeStart = new Date(range.startAt).getTime();
  const rangeEnd = new Date(range.endAt).getTime();
  const total = gridEnd - gridStart;

  if (total <= 0 || rangeEnd <= gridStart || rangeStart >= gridEnd) {
    return null;
  }

  const top = ((Math.max(rangeStart, gridStart) - gridStart) / total) * 100;
  const height =
    ((Math.min(rangeEnd, gridEnd) - Math.max(rangeStart, gridStart)) / total) *
    100;

  return {
    height: `${Math.max(height, 1)}%`,
    top: `${top}%`,
  };
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatTimeRange(range: TimeRange) {
  return `${formatTime(range.startAt)} - ${formatTime(range.endAt)}`;
}

export function isSameDate(value: string, date: string) {
  return toDateOnly(new Date(value)) === date;
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeTime(time: string) {
  return time.length === 5 ? `${time}:00` : time;
}
