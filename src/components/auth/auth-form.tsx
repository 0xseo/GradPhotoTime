"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, LogIn, UserPlus } from "lucide-react";
import { signInWithPassword, signUpWithPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    if (mode === "sign-up") {
      const result = await signUpWithPassword({
        email,
        password,
        passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
        redirectTo,
      });

      setIsPending(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setNotice(result.data.message);
      return;
    }

    const result = await signInWithPassword({
      email,
      password,
      redirectTo,
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice(result.data.message);
    router.push(result.data.redirectTo);
    router.refresh();
  }

  return (
    <div className="border border-border bg-muted p-5 sm:p-6">
      <div className="mb-5 grid grid-cols-2 gap-2">
        <ModeButton
          active={mode === "sign-in"}
          icon={<LogIn className="size-4" aria-hidden="true" />}
          label="로그인"
          onClick={() => {
            setMode("sign-in");
            setError(null);
            setNotice(null);
          }}
        />
        <ModeButton
          active={mode === "sign-up"}
          icon={<UserPlus className="size-4" aria-hidden="true" />}
          label="가입"
          onClick={() => {
            setMode("sign-up");
            setError(null);
            setNotice(null);
          }}
        />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          autoComplete="email"
          inputMode="email"
          label="이메일"
          name="email"
          placeholder="name@example.com"
          required
          type="email"
        />
        <Input
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          label="비밀번호"
          minLength={8}
          name="password"
          placeholder="8자 이상"
          required
          type="password"
        />
        {mode === "sign-up" ? (
          <Input
            autoComplete="new-password"
            label="비밀번호 확인"
            minLength={8}
            name="passwordConfirm"
            placeholder="다시 입력"
            required
            type="password"
          />
        ) : null}
        <Button className="w-full" disabled={isPending} type="submit">
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound className="size-4" aria-hidden="true" />
          )}
          {mode === "sign-up" ? "가입 확인 메일 받기" : "로그인"}
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

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-10 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-primary",
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}
