"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Link2, Loader2, Mail } from "lucide-react";
import { sendEmailSignInLink } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsPending(true);

    const result = await sendEmailSignInLink({
      email,
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
    <form className="space-y-4 border border-border bg-muted p-5 sm:p-6" onSubmit={handleSubmit}>
      <Input
        autoComplete="email"
        inputMode="email"
        label="이메일"
        name="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="name@example.com"
        required
        type="email"
        value={email}
      />

      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-800">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm leading-6 text-danger">
          {error}
        </p>
      ) : null}

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : notice ? (
          <Link2 className="size-4" aria-hidden="true" />
        ) : (
          <Mail className="size-4" aria-hidden="true" />
        )}
        {isPending ? "전송 중" : notice ? "링크 다시 보내기" : "로그인 링크 받기"}
      </Button>
    </form>
  );
}
