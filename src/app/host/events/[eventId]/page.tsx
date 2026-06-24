import { CalendarShell } from "@/components/calendar/calendar-shell";
import { HostDashboardShell } from "@/components/host/host-dashboard-shell";
import { listEventReservations } from "@/app/actions/reservations";
import { listTimeBlocks } from "@/app/actions/time-blocks";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HostEventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function HostEventPage({ params }: HostEventPageProps) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: event, error } = await supabase
    .from("events")
    .select(
      "id,event_code,title,description,date_start,date_end,daily_start_time,daily_end_time,timezone,buffer_time_minutes,is_buffer_active",
    )
    .eq("id", eventId)
    .single();

  if (error || !event) {
    return (
      <CalendarShell eyebrow="Host" title="이벤트를 열 수 없습니다">
        <p className="rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
          로그인한 Host만 이벤트를 관리할 수 있습니다.
        </p>
      </CalendarShell>
    );
  }

  const scheduleResult = await listTimeBlocks({ eventId });
  const reservationsResult = await listEventReservations({ eventId });

  if (!scheduleResult.ok || !reservationsResult.ok) {
    const errorMessage = !scheduleResult.ok
      ? scheduleResult.error
      : !reservationsResult.ok
        ? reservationsResult.error
        : "일정 정보를 불러오지 못했습니다.";

    return (
      <CalendarShell eyebrow="Host" title={event.title}>
        {event.description ? (
          <p className="mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {event.description}
          </p>
        ) : null}
        <p className="rounded-md border border-danger/30 bg-red-50 p-4 text-sm text-danger">
          {errorMessage}
        </p>
      </CalendarShell>
    );
  }

  return (
    <CalendarShell eyebrow="Host" title={event.title}>
      {event.description ? (
        <p className="mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">
          {event.description}
        </p>
      ) : null}
      <HostDashboardShell
        event={event}
        reservations={reservationsResult.data.reservations}
        reservationSlots={scheduleResult.data.reservationSlots}
        timeBlocks={scheduleResult.data.timeBlocks}
      />
    </CalendarShell>
  );
}
