const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

export function getDateWeekdayIndex(value: Date | string) {
  return parseCalendarDate(value).getDay();
}

export function getWeekdayTextClass(value: Date | number | string) {
  const weekdayIndex = typeof value === "number" ? value : getDateWeekdayIndex(value);

  if (weekdayIndex === 0) {
    return "text-red-600";
  }

  if (weekdayIndex === 6) {
    return "text-sky-600";
  }

  return "";
}

export function getWeekdaySurfaceClass(value: Date | number | string) {
  const weekdayIndex = typeof value === "number" ? value : getDateWeekdayIndex(value);

  if (weekdayIndex === 0) {
    return "bg-red-50/35";
  }

  if (weekdayIndex === 6) {
    return "bg-sky-50/35";
  }

  return "";
}

export function formatCompactDateWithWeekday(value: Date | string) {
  const date = parseCalendarDate(value);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${month}/${day} (${weekdayLabels[date.getDay()]})`;
}

function parseCalendarDate(value: Date | string) {
  if (value instanceof Date) {
    return value;
  }

  return new Date(`${value}T00:00:00`);
}
