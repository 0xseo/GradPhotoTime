"use server";

import { actionError, actionOk, type ActionResult } from "@/lib/actions/result";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResolveAccessCodeData = {
  href: string;
  kind: "event" | "reservation";
};

export async function resolveAccessCode(
  input: string,
): Promise<ActionResult<ResolveAccessCodeData>> {
  try {
    const code = normalizeAccessCode(input);

    if (code.length < 6 || code.length > 32) {
      return actionError("코드 형식이 올바르지 않습니다.");
    }

    const admin = createSupabaseAdminClient();
    const [reservationResult, eventResult, serverSupabase] = await Promise.all([
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
      createSupabaseServerClient(),
    ]);

    if (reservationResult.error) {
      return actionError(reservationResult.error.message);
    }

    if (eventResult.error) {
      return actionError(eventResult.error.message);
    }

    const reservation = reservationResult.data;
    const event = eventResult.data;

    if (reservation && event) {
      return actionError("이벤트 코드와 예약 관리 코드가 중복되었습니다.");
    }

    if (reservation) {
      return actionOk({
        href: `/reservations/${reservation.reservation_access_code}`,
        kind: "reservation",
      });
    }

    if (event) {
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      const isHost = Boolean(user && event.host_id === user.id);

      return actionOk({
        href: isHost ? `/host/events/${event.id}` : `/event/${event.event_code}`,
        kind: "event",
      });
    }

    return actionError("해당 코드로 이동할 곳을 찾지 못했습니다.");
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "코드를 확인하지 못했습니다.",
    );
  }
}

function normalizeAccessCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}
