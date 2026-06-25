"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  LogIn,
  UserPlus,
} from "lucide-react";
import {
  sendPasswordResetEmail,
  signInWithPassword,
  signUpWithPassword,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const passwordChecks = [
    {
      label: "8자 이상",
      met: password.length >= 8,
    },
  ];
  const isPasswordConfirmMet =
    passwordConfirm.length > 0 && password === passwordConfirm;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
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

  async function handlePasswordReset() {
    setError(null);
    setNotice(null);
    if (!email) {
      setError("비밀번호를 재설정할 이메일을 입력해 주세요.");
      return;
    }

    setIsPending(true);
    const result = await sendPasswordResetEmail({ email });
    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice(result.data.message);
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
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          required
          type="email"
          value={email}
        />
        <Input
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          label="비밀번호"
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="8자 이상"
          required
          type="password"
          value={password}
        />
        {mode === "sign-up" ? (
          <div className="space-y-2 rounded-md border border-border bg-background px-3 py-3">
            {passwordChecks.map((check) => (
              <PasswordCheck
                key={check.label}
                label={check.label}
                met={check.met}
              />
            ))}
          </div>
        ) : null}
        {mode === "sign-up" ? (
          <>
            <Input
              autoComplete="new-password"
              label="비밀번호 확인"
              minLength={8}
              name="passwordConfirm"
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder="다시 입력"
              required
              type="password"
              value={passwordConfirm}
            />
            <div className="rounded-md border border-border bg-background px-3 py-3">
              <PasswordCheck
                label="비밀번호가 일치합니다"
                met={isPasswordConfirmMet}
              />
            </div>
          </>
        ) : null}
        <Button className="w-full" disabled={isPending} type="submit">
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound className="size-4" aria-hidden="true" />
          )}
          {mode === "sign-up" ? "가입 확인 메일 받기" : "로그인"}
        </Button>
        {mode === "sign-in" ? (
          <Button
            className="w-full"
            disabled={isPending}
            onClick={handlePasswordReset}
            variant="ghost"
          >
            비밀번호 재설정 메일 받기
          </Button>
        ) : null}
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

function PasswordCheck({ label, met }: { label: string; met: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm",
        met ? "text-emerald-700" : "text-muted-foreground",
      )}
    >
      <CheckCircle2
        className={cn("size-4", met ? "opacity-100" : "opacity-35")}
        aria-hidden="true"
      />
      <span>{label}</span>
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
