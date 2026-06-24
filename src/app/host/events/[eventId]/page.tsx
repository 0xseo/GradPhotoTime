import { CalendarShell } from "@/components/calendar/calendar-shell";
import { HostDashboardShell } from "@/components/host/host-dashboard-shell";

type HostEventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function HostEventPage({ params }: HostEventPageProps) {
  const { eventId } = await params;

  return (
    <CalendarShell eyebrow="Host" title={`이벤트 ${eventId}`}>
      <HostDashboardShell />
    </CalendarShell>
  );
}
