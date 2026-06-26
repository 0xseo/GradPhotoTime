import {
  mobileError,
  mobileOk,
  readJsonBody,
} from "@/lib/mobile/api-response";
import { signUpMobileUser } from "@/lib/mobile/auth";
import {
  requireEmail,
  requirePassword,
} from "@/lib/validators/action-inputs";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      email?: string;
      password?: string;
      passwordConfirm?: string;
    }>(request);
    const email = requireEmail(body.email);
    const password = requirePassword(body.password);
    const passwordConfirm = requirePassword(body.passwordConfirm);

    if (password !== passwordConfirm) {
      return mobileError("비밀번호 확인이 일치하지 않습니다.");
    }

    return mobileOk(
      await signUpMobileUser({
        email,
        emailRedirectTo: buildEmailRedirectTo(request),
        password,
      }),
    );
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "가입에 실패했습니다.",
      400,
    );
  }
}

function buildEmailRedirectTo(request: Request) {
  const url = new URL(request.url);

  return `${url.origin}/auth/callback?next=/`;
}
