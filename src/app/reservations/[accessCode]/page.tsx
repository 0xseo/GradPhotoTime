import { CalendarShell } from "@/components/calendar/calendar-shell";
import { GuestReservationShell } from "@/components/guest/guest-reservation-shell";

type ReservationPageProps = {
  params: Promise<{
    accessCode: string;
  }>;
};

export default async function ReservationPage({ params }: ReservationPageProps) {
  const { accessCode } = await params;

  return (
    <CalendarShell
      eyebrow="Reservation"
      title={`예약 관리 코드 ${accessCode.toUpperCase()}`}
    >
      <GuestReservationShell />
    </CalendarShell>
  );
}
