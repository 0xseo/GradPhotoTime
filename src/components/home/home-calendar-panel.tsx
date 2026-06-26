"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  DashboardGuestReservation,
  DashboardHostedEvent,
  DashboardParticipant,
  DashboardSlot,
} from "@/app/actions/dashboard";
import { MonthJumpDialog } from "@/components/calendar/month-jump-dialog";
import { getSlotDisplayRange } from "@/lib/reservations/slots";
import {
  getWeekdaySurfaceClass,
  getWeekdayTextClass,
} from "@/lib/time/calendar-style";
import { formatTimeRange } from "@/lib/time/event-days";
import { cn } from "@/lib/utils";

type HomeCalendarItem = {
  href: string;
  id: string;
  participantNames?: string;
  sortAt: string;
  status: "APPROVED" | "PENDING";
  time: string;
  title: string;
};

type HomeCalendarPanelProps = {
  hostedEvents: DashboardHostedEvent[];
  reservations: DashboardGuestReservation[];
};

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

export function HomeCalendarPanel({
  hostedEvents,
  reservations,
}: HomeCalendarPanelProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = toDateOnly(today);
  const [monthDate, setMonthDate] = useState(() =>
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [isMonthDialogOpen, setIsMonthDialogOpen] = useState(false);
  const monthDays = useMemo(() => buildMonthDays(monthDate), [monthDate]);
  const itemsByDate = useMemo(
    () => buildHomeCalendarItems(hostedEvents, reservations),
    [hostedEvents, reservations],
  );

  function moveMonth(offset: number) {
    setMonthDate((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + offset);
      return next;
    });
  }

  function goToday() {
    setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <section className="border border-border bg-background p-4">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-2 text-primary">
          <button
            aria-label="이전 달"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-primary transition-colors hover:border-primary"
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
            {formatMonth(monthDate)}
          </button>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            aria-label="오늘로 이동"
            className="px-1 text-xs font-medium text-primary underline underline-offset-4 outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-primary"
            onClick={goToday}
            type="button"
          >
            오늘
          </button>
          <button
            aria-label="다음 달"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-primary transition-colors hover:border-primary"
            onClick={() => moveMonth(1)}
            type="button"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-y border-border bg-muted text-center text-xs font-medium text-muted-foreground">
        {weekdayLabels.map((weekday, index) => (
          <div
            className={cn(
              "border-r border-border py-2 last:border-r-0",
              getWeekdayTextClass(index),
            )}
            key={weekday}
          >
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-l border-border">
        {monthDays.map((day) => {
          const dayKey = toDateOnly(day);
          const items = itemsByDate.get(dayKey) ?? [];
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
          const isToday = dayKey === todayKey;

          return (
            <div
              className={cn(
                "group relative h-[clamp(3.75rem,8.5dvh,5.5rem)] border-b border-r border-border bg-background p-2",
                getWeekdaySurfaceClass(day),
                !isCurrentMonth && "bg-muted/40 text-muted-foreground",
                isToday && "bg-[#f6fbff]",
              )}
              key={dayKey}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "relative inline-flex size-7 items-center justify-center rounded-md text-sm font-medium",
                    getWeekdayTextClass(day)
                  )}
                >
                  <span>{day.getDate()}</span>
                  {isToday ? (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-primary"
                    />
                  ) : null}
                </span>
                {items.length > 0 ? (
                  <div className="mt-2 flex gap-1">
                    {items.slice(0, 3).map((item) => (
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          item.status === "APPROVED"
                            ? "bg-primary"
                            : "bg-amber-500",
                        )}
                        key={item.id}
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              {items.length > 0 ? (
                <div
                  className={cn(
                    "absolute top-10 z-40 hidden w-80 max-w-[calc(100vw-2rem)] pt-3 text-left text-sm group-hover:block",
                    getPreviewPositionClass(day),
                  )}
                >
                  <div className="max-h-80 overflow-auto rounded-md border border-border bg-background p-4 shadow-xl">
                    <p className="mb-3 font-serif text-xl font-semibold text-primary">
                      {formatShortDate(day)}
                    </p>
                    <div className="space-y-2.5">
                      {items.map((item) => (
                        <Link
                          className="block rounded-md border border-border bg-muted px-3 py-3 hover:border-primary"
                          href={item.href}
                          key={item.id}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium text-foreground">
                              {item.title}
                            </span>
                            {!item.participantNames ? (
                              <StatusPill status={item.status} />
                            ) : null}
                          </span>
                          {item.participantNames ? (
                            <span className="mt-1 flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm text-foreground">
                                {item.participantNames}
                              </span>
                              <StatusPill status={item.status} />
                            </span>
                          ) : null}
                          <span className="mt-1 block font-mono text-xs text-muted-foreground">
                            {item.time}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
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
    </section>
  );
}

function StatusPill({ status }: { status: "APPROVED" | "PENDING" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
        status === "APPROVED"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {status === "APPROVED" ? "확정" : "대기"}
    </span>
  );
}

function buildHomeCalendarItems(
  hostedEvents: DashboardHostedEvent[],
  reservations: DashboardGuestReservation[],
) {
  const itemsByDate = new Map<string, HomeCalendarItem[]>();

  for (const event of hostedEvents) {
    for (const slot of event.confirmedSlots) {
      pushCalendarItem(itemsByDate, slot, {
        href: `/host/events/${event.id}`,
        participantNames: getParticipantNames(
          event.participants,
          slot.reservation_id,
        ),
        status: "APPROVED",
        title: `${event.title} · Host`,
      });
    }

    for (const slot of event.pendingSlots) {
      pushCalendarItem(itemsByDate, slot, {
        href: `/host/events/${event.id}`,
        participantNames: getParticipantNames(
          event.participants,
          slot.reservation_id,
        ),
        status: "PENDING",
        title: `${event.title} · Host`,
      });
    }
  }

  for (const reservation of reservations) {
    if (reservation.status !== "APPROVED" && reservation.status !== "PENDING") {
      continue;
    }

    const visibleSlots =
      reservation.status === "APPROVED"
        ? reservation.slots.filter((slot) => slot.is_confirmed)
        : reservation.slots.filter((slot) => !slot.is_confirmed);

    for (const slot of visibleSlots) {
      pushCalendarItem(itemsByDate, slot, {
        href: `/reservations/${reservation.reservation_access_code}`,
        participantNames: getParticipantNames(reservation.participants),
        status: reservation.status,
        title: reservation.event?.title ?? "예약",
      });
    }
  }

  for (const [date, items] of itemsByDate) {
    itemsByDate.set(
      date,
      items.sort(
        (left, right) =>
          new Date(left.sortAt).getTime() - new Date(right.sortAt).getTime(),
      ),
    );
  }

  return itemsByDate;
}

function getParticipantNames(
  participants: DashboardParticipant[],
  reservationId?: string,
) {
  const names = participants
    .filter((participant) =>
      reservationId ? participant.reservation_id === reservationId : true,
    )
    .map((participant) => participant.guest_name.trim())
    .filter(Boolean);

  return names.length > 0 ? names.join(", ") : undefined;
}

function pushCalendarItem(
  itemsByDate: Map<string, HomeCalendarItem[]>,
  slot: DashboardSlot,
  item: Omit<HomeCalendarItem, "id" | "sortAt" | "time">,
) {
  const slotRange = getSlotDisplayRange(slot);
  const date = toDateOnly(new Date(slotRange.startAt));
  const nextItem: HomeCalendarItem = {
    ...item,
    id: `${item.href}:${slot.id}:${item.status}`,
    sortAt: slotRange.startAt,
    time: formatTimeRange(slotRange),
  };

  itemsByDate.set(date, [...(itemsByDate.get(date) ?? []), nextItem]);
}

function buildMonthDays(monthDate: Date) {
  const firstDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(firstDate);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(gridStart);
    next.setDate(next.getDate() + index);
    return next;
  });
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(date);
}

function getPreviewPositionClass(date: Date) {
  const weekday = date.getDay();

  if (weekday >= 5) {
    return "right-2";
  }

  if (weekday <= 1) {
    return "left-2";
  }

  return "left-1/2 -translate-x-1/2";
}

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}
