"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Clock,
  Users,
} from "lucide-react";
import {
  AccessCodeEntry,
} from "@/components/guest/access-code-entry";
import { HomeCalendarPanel } from "@/components/home/home-calendar-panel";
import { buttonVariants } from "@/components/ui/button";
import { getSlotDisplayRange } from "@/lib/reservations/slots";
import { formatCompactDateWithWeekday } from "@/lib/time/calendar-style";
import { formatTimeRange } from "@/lib/time/event-days";
import { cn } from "@/lib/utils";
import type {
  DashboardGuestReservation,
  DashboardHostedEvent,
  DashboardSlot,
} from "@/app/actions/dashboard";

type HomeDashboardShellProps = {
  hostedEvents: DashboardHostedEvent[];
  isSignedIn: boolean;
  mobileView?: "calendar" | "guest" | "host" | null;
  reservations: DashboardGuestReservation[];
};

type HomeRole = "guest" | "host";

export function HomeDashboardShell({
  hostedEvents,
  isSignedIn,
  mobileView = null,
  reservations,
}: HomeDashboardShellProps) {
  const [activeRole, setActiveRole] = useState<HomeRole>("host");

  if (mobileView) {
    return (
      <div className="min-h-dvh py-2">
        {mobileView === "calendar" ? (
          <HomeCalendarPanel
            hostedEvents={hostedEvents}
            reservations={reservations}
          />
        ) : null}
        {mobileView === "host" ? (
          <div className="space-y-4">
            <CreateEventCard isSignedIn={isSignedIn} />
            <HostedEventsPanel hostedEvents={hostedEvents} />
          </div>
        ) : null}
        {mobileView === "guest" ? (
          <div className="space-y-4">
            <AccessCodeEntry variant="compact" />
            <GuestReservationsPanel reservations={reservations} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100dvh-7rem)] gap-5 py-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
      <HomeCalendarPanel
        hostedEvents={hostedEvents}
        reservations={reservations}
      />

      <section className="border border-border bg-background p-4">
        <div
          aria-label="역할 선택"
          className="grid grid-cols-2 border-b border-border"
          role="tablist"
        >
          <button
            aria-selected={activeRole === "host"}
            className={cn(
              "h-11 border-b-2 text-sm font-medium transition-colors",
              activeRole === "host"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary",
            )}
            onClick={() => setActiveRole("host")}
            role="tab"
            type="button"
          >
            Host
          </button>
          <button
            aria-selected={activeRole === "guest"}
            className={cn(
              "h-11 border-b-2 text-sm font-medium transition-colors",
              activeRole === "guest"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary",
            )}
            onClick={() => setActiveRole("guest")}
            role="tab"
            type="button"
          >
            Guest
          </button>
        </div>

        <div className="mt-4">
          {activeRole === "host" ? (
            <div className="space-y-4">
              <CreateEventCard isSignedIn={isSignedIn} />
              <HostedEventsPanel hostedEvents={hostedEvents} />
            </div>
          ) : (
            <div className="space-y-4">
              <AccessCodeEntry variant="compact" />
              <GuestReservationsPanel reservations={reservations} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CreateEventCard({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <div className="border border-border bg-muted p-4">
      <div className="mb-4 flex items-center gap-2 text-primary">
        <CalendarPlus className="size-5" aria-hidden="true" />
        <h2 className="font-serif text-xl font-semibold">이벤트 생성</h2>
      </div>
      <Link
        className={buttonVariants({ className: "w-full" })}
        href={isSignedIn ? "/host/events/new" : "/auth?next=/host/events/new"}
      >
        만들기
      </Link>
    </div>
  );
}

function HostedEventsPanel({
  hostedEvents,
}: {
  hostedEvents: DashboardHostedEvent[];
}) {
  return (
    <section className="border border-border bg-background p-4">
      <div className="mb-3 flex items-center gap-2 text-primary">
        <CalendarClock className="size-5" aria-hidden="true" />
        <h2 className="font-serif text-xl font-semibold">내 이벤트</h2>
      </div>
      {hostedEvents.length > 0 ? (
        <div className="divide-y divide-border">
          {hostedEvents.slice(0, 4).map((event) => (
            <HostedEventItem event={event} key={event.id} />
          ))}
          {hostedEvents.length > 4 ? (
            <p className="pt-3 text-xs text-muted-foreground">
              +{hostedEvents.length - 4}개 이벤트
            </p>
          ) : null}
        </div>
      ) : (
        <EmptyState text="아직 Host로 만든 이벤트가 없습니다." />
      )}
    </section>
  );
}

function HostedEventItem({ event }: { event: DashboardHostedEvent }) {
  return (
    <div className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <Link
            className="truncate font-serif text-lg font-semibold text-primary hover:underline"
            href={`/host/events/${event.id}`}
          >
            {event.title}
          </Link>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {event.event_code}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <SummaryChip
            icon={<CalendarCheck className="size-3.5" aria-hidden="true" />}
            label={`확정 ${event.approvedCount}`}
          />
          <SummaryChip
            icon={<Clock className="size-3.5" aria-hidden="true" />}
            label={`대기 ${event.pendingCount}`}
          />
        </div>
      </div>
      <Link
        className={buttonVariants({ variant: "outline", size: "sm" })}
        href={`/host/events/${event.id}`}
      >
        관리
      </Link>
    </div>
  );
}

function GuestReservationsPanel({
  reservations,
}: {
  reservations: DashboardGuestReservation[];
}) {
  return (
    <section className="border border-border bg-background p-4">
      <div className="mb-3 flex items-center gap-2 text-primary">
        <Users className="size-5" aria-hidden="true" />
        <h2 className="font-serif text-xl font-semibold">내 예약</h2>
      </div>
      {reservations.length > 0 ? (
        <div className="divide-y divide-border">
          {reservations.slice(0, 4).map((reservation) => (
            <ReservationItem
              key={reservation.id}
              reservation={reservation}
            />
          ))}
          {reservations.length > 4 ? (
            <p className="pt-3 text-xs text-muted-foreground">
              +{reservations.length - 4}개 예약
            </p>
          ) : null}
        </div>
      ) : (
        <EmptyState text="내 계정으로 생성한 예약이 없습니다." />
      )}
    </section>
  );
}

function ReservationItem({
  reservation,
}: {
  reservation: DashboardGuestReservation;
}) {
  const confirmedSlots = reservation.slots.filter((slot) => slot.is_confirmed);

  return (
    <div className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={reservation.status} />
          <span className="truncate text-sm font-medium text-foreground">
            {reservation.event?.title ?? "이벤트"}
          </span>
        </div>
        <ConfirmedSlotList slots={confirmedSlots} />
      </div>
      <Link
        className={buttonVariants({ variant: "outline", size: "sm" })}
        href={`/reservations/${reservation.reservation_access_code}`}
      >
        관리
      </Link>
    </div>
  );
}

function ConfirmedSlotList({
  emptyText = "확정 일정 없음",
  limit = 2,
  slots,
}: {
  emptyText?: string;
  limit?: number;
  slots: DashboardSlot[];
}) {
  const visibleSlots = slots.slice(0, limit);

  if (visibleSlots.length === 0) {
    return <p className="mt-2 text-xs text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="mt-2 space-y-1">
      {visibleSlots.map((slot) => (
        <p className="font-mono text-xs text-foreground" key={slot.id}>
          {formatDatedTimeRange(slot)}
        </p>
      ))}
      {slots.length > limit ? (
        <p className="text-xs text-muted-foreground">+{slots.length - limit}개</p>
      ) : null}
    </div>
  );
}

function SummaryChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

function formatDatedTimeRange(slot: DashboardSlot) {
  const range = getSlotDisplayRange(slot);
  const dateKey = toDateInputValue(new Date(range.startAt));

  return `${formatCompactDateWithWeekday(dateKey)} ${formatTimeRange(range)}`;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function StatusBadge({ status }: { status: string }) {
  const meta =
    status === "APPROVED"
      ? { className: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "확정" }
      : status === "REJECTED"
        ? { className: "border-zinc-200 bg-zinc-100 text-zinc-600", label: "거절" }
        : status === "CANCELLED"
          ? { className: "border-red-200 bg-red-50 text-danger", label: "취소" }
          : { className: "border-amber-200 bg-amber-50 text-amber-800", label: "대기" };

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="border border-border bg-muted px-3 py-3 text-sm text-muted-foreground">
      {text}
    </p>
  );
}
