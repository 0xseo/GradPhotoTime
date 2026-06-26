"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";

const MINUTE_OPTIONS = ["00", "30"];

export function MeridiemTimeInput({
  disabled = false,
  label,
  labelAccessory,
  onChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  labelAccessory?: ReactNode;
  onChange: (value: string) => void;
  value: string;
}) {
  const parts = parseMeridiemTime(value);

  function update(next: Partial<typeof parts>) {
    onChange(formatMeridiemTime({ ...parts, ...next }));
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-5 items-center gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {labelAccessory}
      </div>
      <div className="grid grid-cols-[5.5rem_1fr_5rem] gap-2">
        <select
          className="h-12 rounded-md border border-border bg-background px-2 text-base text-foreground outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          disabled={disabled}
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
          disabled={disabled}
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
          className="h-12 rounded-md border border-border bg-background px-2 text-base text-foreground outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          disabled={disabled}
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

function parseMeridiemTime(value: string) {
  const [hourText, minuteText = "00"] = value.split(":");
  const hour24 = Number(hourText);
  const period: "AM" | "PM" = hour24 >= 12 && hour24 < 24 ? "PM" : "AM";
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
