import { CalendarShell } from "@/components/calendar/calendar-shell";
import { GuestReservationShell } from "@/components/guest/guest-reservation-shell";

type EventPageProps = {
  params: Promise<{
    eventCode: string;
  }>;
};

export default async function EventPage({ params }: EventPageProps) {
  const { eventCode } = await params;

  return (
    <CalendarShell
      eyebrow="Guest"
      title={`이벤트 코드 ${eventCode.toUpperCase()}`}
    >
      <GuestReservationShell />
    </CalendarShell>
  );
}
