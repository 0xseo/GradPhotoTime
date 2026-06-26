import {
  mobileError,
  mobileOk,
  readJsonBody,
} from "@/lib/mobile/api-response";
import { signInMobileUser } from "@/lib/mobile/auth";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      email?: string;
      password?: string;
    }>(request);
    const email = body.email?.trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return mobileError("이메일과 비밀번호를 입력해 주세요.");
    }

    return mobileOk(await signInMobileUser(email, password));
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "로그인에 실패했습니다.",
      401,
    );
  }
}
