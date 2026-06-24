"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeEventCode } from "@/lib/validators/event-code";

export function EventCodeEntry() {
  const router = useRouter();
  const [eventCode, setEventCode] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = normalizeEventCode(eventCode);

    if (normalizedCode) {
      router.push(`/event/${normalizedCode}`);
    }
  }

  return (
    <form
      className="border border-border bg-muted p-5 shadow-sm sm:p-6"
      onSubmit={handleSubmit}
    >
      <div className="mb-5 space-y-2">
        <h2 className="font-serif text-2xl font-semibold text-primary">
          이벤트 코드
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
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
