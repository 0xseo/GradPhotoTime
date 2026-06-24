"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { sendEmailSignInLink } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await sendEmailSignInLink({
      email: String(formData.get("email") ?? ""),
      redirectTo,
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice(result.data.message);
  }

  return (
    <div className="border border-border bg-muted p-5 sm:p-6">
      <form className="space-y-4" onSubmit={handleEmailSubmit}>
        <Input
          autoComplete="email"
          inputMode="email"
          label="이메일"
          name="email"
          placeholder="name@example.com"
          required
          type="email"
        />
        <Button className="w-full" disabled={isPending} type="submit">
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Mail className="size-4" aria-hidden="true" />
          )}
          로그인 링크 받기
        </Button>
      </form>

      {notice ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
