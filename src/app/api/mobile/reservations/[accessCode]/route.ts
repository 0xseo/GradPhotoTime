import { getReservationManagementView } from "@/app/actions/reservations";
import { mobileError, mobileOk } from "@/lib/mobile/api-response";

type ReservationRouteProps = {
  params: Promise<{
    accessCode: string;
  }>;
};

export async function GET(_request: Request, { params }: ReservationRouteProps) {
  try {
    const { accessCode } = await params;
    const result = await getReservationManagementView({
      reservationAccessCode: accessCode,
    });

    if (!result.ok) {
      return mobileError(result.error, 404);
    }

    return mobileOk(result.data);
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "예약 정보를 불러오지 못했습니다.",
      500,
    );
  }
}
