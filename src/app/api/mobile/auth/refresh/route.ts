import {
  mobileError,
  mobileOk,
  readJsonBody,
} from "@/lib/mobile/api-response";
import { refreshMobileSession } from "@/lib/mobile/auth";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      refreshToken?: string;
    }>(request);

    if (!body.refreshToken) {
      return mobileError("저장된 세션이 없습니다.", 401);
    }

    return mobileOk(await refreshMobileSession(body.refreshToken));
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "세션 갱신에 실패했습니다.",
      401,
    );
  }
}
