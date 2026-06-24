import { CalendarShell } from "@/components/calendar/calendar-shell";
import { ReservationManagementShell } from "@/components/guest/reservation-management-shell";
import { getReservationManagementView } from "@/app/actions/reservations";

type ReservationPageProps = {
  params: Promise<{
    accessCode: string;
  }>;
};

export default async function ReservationPage({ params }: ReservationPageProps) {
  const { accessCode } = await params;
  const result = await getReservationManagementView({
    reservationAccessCode: accessCode,
  });

  if (!result.ok) {
    return (
      <CalendarShell
        eyebrow="Reservation"
        title={`예약 관리 코드 ${accessCode.toUpperCase()}`}
      >
        <p className="rounded-md border border-danger/30 bg-red-50 p-4 text-sm text-danger">
          {result.error}
        </p>
      </CalendarShell>
    );
  }

  return (
    <CalendarShell
      eyebrow="Reservation"
      title={result.data.event.title}
    >
      {result.data.event.description ? (
        <p className="mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">
          {result.data.event.description}
        </p>
      ) : null}
      <ReservationManagementShell {...result.data} />
    </CalendarShell>
  );
}
