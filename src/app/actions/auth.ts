"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { actionError, actionOk, type ActionResult } from "@/lib/actions/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  optionalText,
  requireEmail,
  requirePassword,
} from "@/lib/validators/action-inputs";

type AuthNoticeData = {
  message: string;
};

type AuthSessionData = AuthNoticeData & {
  redirectTo: string;
};

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  passwordConfirm: string;
  redirectTo?: string | null;
}): Promise<ActionResult<AuthNoticeData>> {
  try {
    const email = requireEmail(input.email);
    const password = requirePassword(input.password);
    const passwordConfirm = requirePassword(input.passwordConfirm);
    const redirectTo = getRedirectPath(input.redirectTo);

    if (password !== passwordConfirm) {
      return actionError("비밀번호 확인이 일치하지 않습니다.");
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: await buildAuthRedirectUrl(redirectTo),
      },
    });

    if (error) {
      return actionError(getAuthErrorMessage(error.message));
    }

    if (data.user?.identities?.length === 0) {
      return actionOk({
        message:
          "이미 가입된 이메일일 수 있습니다. 로그인하거나 비밀번호 재설정을 이용해 주세요.",
      });
    }

    return actionOk({
      message:
        "가입 확인 메일을 보냈습니다. 메일 인증 후 이메일과 비밀번호로 로그인해 주세요.",
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
  redirectTo?: string | null;
}): Promise<ActionResult<AuthSessionData>> {
  try {
    const email = requireEmail(input.email);
    const password = requirePassword(input.password);
    const redirectTo = getRedirectPath(input.redirectTo);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return actionError(getAuthErrorMessage(error.message));
    }

    revalidatePath("/");
    revalidatePath(redirectTo);

    return actionOk({
      message: "로그인되었습니다.",
      redirectTo,
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function sendPasswordResetEmail(input: {
  email: string;
  redirectTo?: string | null;
}): Promise<ActionResult<AuthNoticeData>> {
  try {
    const email = requireEmail(input.email);
    const redirectTo = getRedirectPath(input.redirectTo);
    const resetPath = `/auth/update-password?next=${encodeURIComponent(redirectTo)}`;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: await buildAuthRedirectUrl(resetPath),
    });

    if (error) {
      return actionError(getAuthErrorMessage(error.message));
    }

    return actionOk({
      message:
        "비밀번호 재설정 메일을 보냈습니다. 메일 링크를 열어 새 비밀번호를 설정해 주세요.",
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function updatePassword(input: {
  password: string;
  passwordConfirm: string;
}): Promise<ActionResult<AuthNoticeData>> {
  try {
    const password = requirePassword(input.password);
    const passwordConfirm = requirePassword(input.passwordConfirm);

    if (password !== passwordConfirm) {
      return actionError("비밀번호 확인이 일치하지 않습니다.");
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return actionError(getAuthErrorMessage(error.message));
    }

    revalidatePath("/");

    return actionOk({ message: "비밀번호를 변경했습니다." });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function signOut(redirectTo = "/") {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect(getRedirectPath(redirectTo));
}

async function buildAuthRedirectUrl(redirectTo: string) {
  const requestHeaders = await headers();
  const siteUrl =
    requestHeaders.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";
  const url = new URL("/auth/callback", normalizeSiteUrl(siteUrl));

  url.searchParams.set("next", redirectTo);

  return url.toString();
}

function getRedirectPath(value: unknown) {
  const redirectTo = optionalText(value, 200) ?? "/";

  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "/";
  }

  return redirectTo;
}

function normalizeSiteUrl(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

function getAuthErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("invalid login credentials") ||
    normalizedMessage.includes("invalid credentials")
  ) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "이메일 인증을 먼저 완료해 주세요.";
  }

  if (normalizedMessage.includes("already registered")) {
    return "이미 가입된 이메일입니다. 로그인하거나 비밀번호 재설정을 이용해 주세요.";
  }

  return message;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown auth action error.";
}
