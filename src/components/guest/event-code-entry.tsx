"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeEventCode } from "@/lib/validators/event-code";

type CodeEntryProps = {
  className?: string;
  variant?: "compact" | "default";
};

export function EventCodeEntry({
  className,
  variant = "default",
}: CodeEntryProps) {
  const router = useRouter();
  const [eventCode, setEventCode] = useState("");
  const isCompact = variant === "compact";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = normalizeEventCode(eventCode);

    if (normalizedCode) {
      router.push(`/event/${normalizedCode}`);
    }
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
          <CalendarDays className="size-5" aria-hidden="true" />
          <h2 className={cn("font-serif font-semibold", isCompact ? "text-xl" : "text-2xl")}>
            이벤트 코드
          </h2>
        </div>
        <p className={cn("text-sm leading-6 text-muted-foreground", isCompact && "sr-only")}>
          공유받은 코드를 입력하면 예약 화면으로 이동합니다.
        </p>
      </div>
      <div className="space-y-3">
        <Input
          aria-label="이벤트 코드"
          autoCapitalize="characters"
          inputMode="text"
          maxLength={10}
          name="eventCode"
          onChange={(event) => setEventCode(event.target.value)}
          placeholder="예: A1B2C3"
          value={eventCode}
        />
        <Button type="submit" className="w-full">
          입장
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}

export function ReservationCodeEntry({
  className,
  variant = "default",
}: CodeEntryProps) {
  const router = useRouter();
  const [reservationCode, setReservationCode] = useState("");
  const isCompact = variant === "compact";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = normalizeReservationCode(reservationCode);

    if (normalizedCode) {
      router.push(`/reservations/${normalizedCode}`);
    }
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
            예약 관리 코드
          </h2>
        </div>
        <p className={cn("text-sm leading-6 text-muted-foreground", isCompact && "sr-only")}>
          예약자가 받은 관리 코드로 예약 정보를 수정합니다.
        </p>
      </div>
      <div className="space-y-3">
        <Input
          aria-label="예약 관리 코드"
          autoCapitalize="characters"
          inputMode="text"
          maxLength={32}
          name="reservationCode"
          onChange={(event) => setReservationCode(event.target.value)}
          placeholder="예: R7K9M2Q4"
          value={reservationCode}
        />
        <Button type="submit" className="w-full">
          열기
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}

function normalizeReservationCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}
