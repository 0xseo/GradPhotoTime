import Link from "next/link";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Clock,
  Users,
} from "lucide-react";
import {
  EventCodeEntry,
  ReservationCodeEntry,
} from "@/components/guest/event-code-entry";
import { AppHeader } from "@/components/layout/app-header";
import { buttonVariants } from "@/components/ui/button";
import { getHomeDashboard } from "@/app/actions/dashboard";
import type {
  DashboardGuestReservation,
  DashboardHostedEvent,
  DashboardSlot,
} from "@/app/actions/dashboard";
import { formatTimeRange } from "@/lib/time/event-days";

export default async function Home() {
  const dashboardResult = await getHomeDashboard();
  const dashboard = dashboardResult.ok ? dashboardResult.data : null;

  return (
    <main className="min-h-dvh bg-background">
      <section className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
        <AppHeader />

        <div className="space-y-6 py-8">
          <div className="grid gap-4 lg:grid-cols-3">
            <EventCodeEntry />
            <ReservationCodeEntry />
            <CreateEventCard isSignedIn={Boolean(dashboard?.user)} />
          </div>

          {dashboard?.user ? (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <HostedEventsPanel hostedEvents={dashboard.hostedEvents} />
              <GuestReservationsPanel reservations={dashboard.reservations} />
            </div>
          ) : (
            <div className="border border-border bg-muted p-5 text-sm leading-6 text-muted-foreground">
              로그인하면 내가 만든 이벤트와 내가 신청한 예약이 첫 화면에 표시됩니다.
            </div>
          )}

          {!dashboardResult.ok ? (
            <p className="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
              {dashboardResult.error}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function CreateEventCard({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <div className="border border-border bg-muted p-5 shadow-sm sm:p-6">
      <div className="mb-5 space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <CalendarPlus className="size-5" aria-hidden="true" />
          <h2 className="font-serif text-2xl font-semibold">이벤트 생성</h2>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          로그인 후 졸업사진 촬영 가능 시간을 엽니다.
        </p>
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
    <section className="border border-border bg-background p-5">
      <div className="mb-4 flex items-center gap-2 text-primary">
        <CalendarClock className="size-5" aria-hidden="true" />
        <h2 className="font-serif text-2xl font-semibold">내 이벤트</h2>
      </div>
      {hostedEvents.length > 0 ? (
        <div className="divide-y divide-border">
          {hostedEvents.map((event) => (
            <HostedEventItem event={event} key={event.id} />
          ))}
        </div>
      ) : (
        <EmptyState text="아직 Host로 만든 이벤트가 없습니다." />
      )}
    </section>
  );
}

function HostedEventItem({ event }: { event: DashboardHostedEvent }) {
  return (
    <div className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <Link
          className="font-serif text-xl font-semibold text-primary hover:underline"
          href={`/host/events/${event.id}`}
        >
          {event.title}
        </Link>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {event.event_code} · {event.date_start} - {event.date_end}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <SlotPreview
            emptyText="확정 일정 없음"
            icon={<CalendarCheck className="size-4" aria-hidden="true" />}
            label={`확정 ${event.approvedCount}건`}
            slots={event.confirmedSlots}
          />
          <SlotPreview
            emptyText="대기 일정 없음"
            icon={<Clock className="size-4" aria-hidden="true" />}
            label={`대기 ${event.pendingCount}건`}
            slots={event.pendingSlots}
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
    <section className="border border-border bg-background p-5">
      <div className="mb-4 flex items-center gap-2 text-primary">
        <Users className="size-5" aria-hidden="true" />
        <h2 className="font-serif text-2xl font-semibold">내 예약</h2>
      </div>
      {reservations.length > 0 ? (
        <div className="divide-y divide-border">
          {reservations.map((reservation) => (
            <ReservationItem
              key={reservation.id}
              reservation={reservation}
            />
          ))}
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
  return (
    <div className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={reservation.status} />
          <span className="font-mono text-xs text-muted-foreground">
            {reservation.reservation_access_code}
          </span>
        </div>
        <p className="mt-2 truncate font-serif text-xl font-semibold text-primary">
          {reservation.event?.title ?? "이벤트"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          총 {reservation.headcount}명
        </p>
        <SlotList slots={reservation.slots} />
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

function SlotPreview({
  emptyText,
  icon,
  label,
  slots,
}: {
  emptyText: string;
  icon: React.ReactNode;
  label: string;
  slots: DashboardSlot[];
}) {
  return (
    <div className="rounded-md border border-border bg-muted px-3 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {label}
      </div>
      <SlotList emptyText={emptyText} limit={2} slots={slots} />
    </div>
  );
}

function SlotList({
  emptyText = "일정 없음",
  limit = 3,
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
          {formatTimeRange({ endAt: slot.end_at, startAt: slot.start_at })}
        </p>
      ))}
      {slots.length > limit ? (
        <p className="text-xs text-muted-foreground">+{slots.length - limit}개</p>
      ) : null}
    </div>
  );
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
    <p className="rounded-md border border-border bg-muted px-3 py-3 text-sm text-muted-foreground">
      {text}
    </p>
  );
}
