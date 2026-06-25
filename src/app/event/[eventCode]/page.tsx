import { redirect } from "next/navigation";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { ReservationCodeEntry } from "@/components/guest/event-code-entry";
import { GuestReservationShell } from "@/components/guest/guest-reservation-shell";
import {
  listEventActiveDates,
  listEventBufferOverrides,
  verifyEventCode,
} from "@/app/actions/events";
import { listTimeBlocks } from "@/app/actions/time-blocks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EventPageProps = {
  params: Promise<{
    eventCode: string;
  }>;
};

export default async function EventPage({ params }: EventPageProps) {
  const { eventCode } = await params;
  const eventResult = await verifyEventCode(eventCode);

  if (!eventResult.ok) {
    return (
      <CalendarShell eyebrow="Guest" title="이벤트를 찾을 수 없습니다">
        <p className="rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
          {eventResult.error}
        </p>
      </CalendarShell>
    );
  }

  const event = eventResult.data.event;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createSupabaseAdminClient();
    const { data: hostEvent } = await admin
      .from("events")
      .select("id")
      .eq("id", event.id)
      .eq("host_id", user.id)
      .maybeSingle();

    if (hostEvent) {
      redirect(`/host/events/${event.id}`);
    }
  }

  const scheduleResult = await listTimeBlocks({ eventCode: event.event_code });
  const activeDatesResult = await listEventActiveDates({
    eventCode: event.event_code,
  });
  const bufferOverridesResult = await listEventBufferOverrides({
    eventCode: event.event_code,
  });

  return (
    <CalendarShell eyebrow="Guest" title={event.title}>
      {event.description ? (
        <p className="mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">
          {event.description}
        </p>
      ) : null}
      <div className="mb-5 max-w-xl">
        <ReservationCodeEntry />
      </div>
      {scheduleResult.ok && activeDatesResult.ok && bufferOverridesResult.ok ? (
        <GuestReservationShell
          activeDates={activeDatesResult.data.activeDates}
          bufferOverrides={bufferOverridesResult.data.bufferOverrides}
          event={event}
          reservationSlots={scheduleResult.data.reservationSlots}
          timeBlocks={scheduleResult.data.timeBlocks}
        />
      ) : (
        <p className="rounded-md border border-danger/30 bg-red-50 p-4 text-sm text-danger">
          {!scheduleResult.ok
            ? scheduleResult.error
            : !activeDatesResult.ok
              ? activeDatesResult.error
              : !bufferOverridesResult.ok
                ? bufferOverridesResult.error
              : "일정 정보를 불러오지 못했습니다."}
        </p>
      )}
    </CalendarShell>
  );
}
