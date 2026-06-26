"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { resolveAccessCode } from "@/app/actions/access-codes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AccessCodeEntryProps = {
  className?: string;
  variant?: "compact" | "default";
};

export function AccessCodeEntry({
  className,
  variant = "default",
}: AccessCodeEntryProps) {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const isCompact = variant === "compact";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const result = await resolveAccessCode(accessCode);

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(result.data.href);
  }

  return (
    <form
      className={cn(
        "border border-border bg-muted",
        isCompact ? "p-4" : "p-5 shadow-sm sm:p-6",
        className,
      )}
      onSubmit={handleSubmit}
    >
      <div className={cn("space-y-2", isCompact ? "mb-3" : "mb-5")}>
        <div className="flex items-center gap-2 text-primary">
          <KeyRound className="size-5" aria-hidden="true" />
          <h2 className={cn("font-serif font-semibold", isCompact ? "text-xl" : "text-2xl")}>
            코드 입력
          </h2>
        </div>
        <p className={cn("text-sm leading-6 text-muted-foreground", isCompact && "sr-only")}>
          이벤트 코드나 예약 관리 코드를 입력하면 알맞은 화면으로 이동합니다.
        </p>
      </div>
      <div className="space-y-3">
        <Input
          aria-label="이벤트 또는 예약 관리 코드"
          autoCapitalize="characters"
          inputMode="text"
          maxLength={32}
          name="accessCode"
          onChange={(event) => setAccessCode(event.target.value)}
          placeholder="이벤트 / 예약 코드"
          value={accessCode}
        />
        {error ? (
          <p className="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button className="w-full" disabled={isPending} type="submit">
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-4" aria-hidden="true" />
          )}
          이동
        </Button>
      </div>
    </form>
  );
}
