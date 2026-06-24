import { CalendarShell } from "@/components/calendar/calendar-shell";

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
      <div className="border border-border bg-muted p-5">
        <p className="text-sm leading-6 text-muted-foreground">
          예약 관리 화면은 예약 코드와 선택 비밀번호 검증 후 참여자와 후보
          시간을 수정하는 흐름으로 연결됩니다.
        </p>
      </div>
    </CalendarShell>
  );
}
