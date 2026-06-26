import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  mobileError,
  mobileOk,
  readJsonBody,
} from "@/lib/mobile/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile/auth";

type ResolveAccessCodeData = {
  code: string;
  isHost?: boolean;
  kind: "event" | "reservation";
  targetId: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ code?: string }>(request);
    const code = normalizeAccessCode(body.code ?? "");

    if (code.length < 6 || code.length > 32) {
      return mobileError("코드 형식이 올바르지 않습니다.");
    }

    const admin = createSupabaseAdminClient();
    const [reservationResult, eventResult, user] = await Promise.all([
      code.length >= 8
        ? admin
            .from("reservations")
            .select("id,reservation_access_code")
            .eq("reservation_access_code", code)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      code.length <= 10
        ? admin
            .from("events")
            .select("id,event_code,host_id")
            .eq("event_code", code)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      getMobileUserFromRequest(request),
    ]);

    if (reservationResult.error) {
      return mobileError(reservationResult.error.message);
    }

    if (eventResult.error) {
      return mobileError(eventResult.error.message);
    }

    if (reservationResult.data && eventResult.data) {
      return mobileError("이벤트 코드와 예약 관리 코드가 중복되었습니다.");
    }

    if (reservationResult.data) {
      return mobileOk<ResolveAccessCodeData>({
        code: reservationResult.data.reservation_access_code,
        isHost: false,
        kind: "reservation",
        targetId: reservationResult.data.id,
      });
    }

    if (eventResult.data) {
      return mobileOk<ResolveAccessCodeData>({
        code: eventResult.data.event_code,
        isHost: Boolean(user && eventResult.data.host_id === user.id),
        kind: "event",
        targetId: eventResult.data.id,
      });
    }

    return mobileError("해당 코드로 이동할 곳을 찾지 못했습니다.", 404);
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "코드를 확인하지 못했습니다.",
      500,
    );
  }
}

function normalizeAccessCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}
