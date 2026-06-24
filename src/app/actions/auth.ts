"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { actionError, actionOk, type ActionResult } from "@/lib/actions/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  optionalText,
  requireEmail,
  requireOtp,
  requirePhone,
} from "@/lib/validators/action-inputs";

type AuthNoticeData = {
  message: string;
};

export async function sendEmailSignInLink(input: {
  email: string;
  redirectTo?: string | null;
}): Promise<ActionResult<AuthNoticeData>> {
  try {
    const email = requireEmail(input.email);
    const redirectTo = getRedirectPath(input.redirectTo);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: await buildAuthRedirectUrl(redirectTo),
        shouldCreateUser: true,
      },
    });

    if (error) {
      return actionError(error.message);
    }

    return actionOk({
      message: "이메일로 로그인 링크를 보냈습니다.",
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function sendPhoneSignInCode(input: {
  phone: string;
}): Promise<ActionResult<AuthNoticeData>> {
  try {
    const phone = requirePhone(input.phone);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return actionError(error.message);
    }

    return actionOk({
      message: "휴대폰으로 인증번호를 보냈습니다.",
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function verifyPhoneSignInCode(input: {
  phone: string;
  redirectTo?: string | null;
  token: string;
}): Promise<ActionResult<AuthNoticeData>> {
  try {
    const phone = requirePhone(input.phone);
    const token = requireOtp(input.token);
    const redirectTo = getRedirectPath(input.redirectTo);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });

    if (error) {
      return actionError(error.message);
    }

    revalidatePath("/");
    revalidatePath(redirectTo);

    return actionOk({
      message: "로그인되었습니다.",
    });
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown auth action error.";
}
