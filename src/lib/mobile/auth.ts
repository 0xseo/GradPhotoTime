import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type MobileAuthSession = {
  accessToken: string;
  expiresAt: number | null;
  refreshToken: string;
  user: {
    email: string | null;
    id: string;
  };
};

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice("bearer ".length).trim() || null;
}

export async function getMobileUserFromRequest(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  return getMobileUserFromToken(token);
}

export async function getMobileUserFromToken(token: string): Promise<User | null> {
  const client = createMobileSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

export async function signInMobileUser(
  email: string,
  password: string,
): Promise<MobileAuthSession> {
  const client = createMobileSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    throw new Error(error?.message ?? "로그인에 실패했습니다.");
  }

  return {
    accessToken: data.session.access_token,
    expiresAt: data.session.expires_at ?? null,
    refreshToken: data.session.refresh_token,
    user: {
      email: data.user.email ?? null,
      id: data.user.id,
    },
  };
}

export async function refreshMobileSession(
  refreshToken: string,
): Promise<MobileAuthSession> {
  const client = createMobileSupabaseClient();
  const { data, error } = await client.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session || !data.user) {
    throw new Error(error?.message ?? "세션 갱신에 실패했습니다.");
  }

  return {
    accessToken: data.session.access_token,
    expiresAt: data.session.expires_at ?? null,
    refreshToken: data.session.refresh_token,
    user: {
      email: data.user.email ?? null,
      id: data.user.id,
    },
  };
}

function createMobileSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Missing Supabase mobile auth environment variables.");
  }

  return createClient<Database>(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
