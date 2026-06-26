import { NextResponse } from "next/server";

export type MobileApiResult<T> =
  | {
      data: T;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export function mobileOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<MobileApiResult<T>>(
    {
      data,
      ok: true,
    },
    init,
  );
}

export function mobileError(error: string, status = 400) {
  return NextResponse.json<MobileApiResult<never>>(
    {
      error,
      ok: false,
    },
    { status },
  );
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("요청 본문이 올바른 JSON이 아닙니다.");
  }
}
