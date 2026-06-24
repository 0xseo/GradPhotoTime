"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2, Mail, MessageSquareText } from "lucide-react";
import {
  sendEmailSignInLink,
  sendPhoneSignInCode,
  verifyPhoneSignInCode,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthMode = "email" | "phone";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") ?? "/";
  const [mode, setMode] = useState<AuthMode>("email");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [sentPhoneCode, setSentPhoneCode] = useState(false);

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

  async function handlePhoneCodeRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const nextPhone = String(formData.get("phone") ?? "");
    const result = await sendPhoneSignInCode({ phone: nextPhone });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPhone(nextPhone);
    setSentPhoneCode(true);
    setNotice(result.data.message);
  }

  async function handlePhoneVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await verifyPhoneSignInCode({
      phone,
      redirectTo,
      token: String(formData.get("token") ?? ""),
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="border border-border bg-muted p-5 sm:p-6">
      <div className="mb-5 grid grid-cols-2 gap-2">
        <ModeButton
          active={mode === "email"}
          icon={<Mail className="size-4" aria-hidden="true" />}
          label="이메일"
          onClick={() => setMode("email")}
        />
        <ModeButton
          active={mode === "phone"}
          icon={<MessageSquareText className="size-4" aria-hidden="true" />}
          label="전화번호"
          onClick={() => setMode("phone")}
        />
      </div>

      {mode === "email" ? (
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
      ) : null}

      {mode === "phone" && !sentPhoneCode ? (
        <form className="space-y-4" onSubmit={handlePhoneCodeRequest}>
          <Input
            autoComplete="tel"
            inputMode="tel"
            label="전화번호"
            name="phone"
            placeholder="+821012345678"
            required
            type="tel"
          />
          <Button className="w-full" disabled={isPending} type="submit">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <MessageSquareText className="size-4" aria-hidden="true" />
            )}
            인증번호 받기
          </Button>
        </form>
      ) : null}

      {mode === "phone" && sentPhoneCode ? (
        <form className="space-y-4" onSubmit={handlePhoneVerify}>
          <Input
            inputMode="numeric"
            label="인증번호"
            name="token"
            placeholder="123456"
            required
          />
          <Button className="w-full" disabled={isPending} type="submit">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <MessageSquareText className="size-4" aria-hidden="true" />
            )}
            인증하고 로그인
          </Button>
          <Button
            className="w-full"
            onClick={() => {
              setSentPhoneCode(false);
              setNotice(null);
              setError(null);
            }}
            type="button"
            variant="outline"
          >
            번호 다시 입력
          </Button>
        </form>
      ) : null}

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
