import { mobileError, mobileOk } from "@/lib/mobile/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile/auth";
import { getMobileDashboardForUser } from "@/lib/mobile/dashboard";

export async function GET(request: Request) {
  try {
    const user = await getMobileUserFromRequest(request);

    if (!user) {
      return mobileError("로그인이 필요합니다.", 401);
    }

    return mobileOk(await getMobileDashboardForUser(user));
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "대시보드를 불러오지 못했습니다.",
      500,
    );
  }
}
