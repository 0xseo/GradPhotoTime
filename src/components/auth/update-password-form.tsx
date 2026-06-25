"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { updatePassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const hasMinLength = password.length >= 8;
  const isPasswordConfirmMet =
    passwordConfirm.length > 0 && password === passwordConfirm;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsPending(true);

    const result = await updatePassword({
      password,
      passwordConfirm,
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice(result.data.message);
    router.refresh();
  }

  return (
    <form className="space-y-4 border border-border bg-muted p-5 sm:p-6" onSubmit={handleSubmit}>
      <Input
        autoComplete="new-password"
        label="새 비밀번호"
        minLength={8}
        name="password"
        onChange={(event) => setPassword(event.target.value)}
        placeholder="8자 이상"
        required
        type="password"
        value={password}
      />
      <div className="rounded-md border border-border bg-background px-3 py-3">
        <PasswordCheck label="8자 이상" met={hasMinLength} />
      </div>
      <Input
        autoComplete="new-password"
        label="새 비밀번호 확인"
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

      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <KeyRound className="size-4" aria-hidden="true" />
        )}
        비밀번호 변경
      </Button>
    </form>
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
