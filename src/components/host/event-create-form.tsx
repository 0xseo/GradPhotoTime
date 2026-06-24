"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { createEvent } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EventCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await createEvent({
      bufferTimeMinutes: Number(formData.get("bufferTimeMinutes") ?? 30),
      dailyEndTime: String(formData.get("dailyEndTime") ?? ""),
      dailyStartTime: String(formData.get("dailyStartTime") ?? ""),
      dateEnd: String(formData.get("dateEnd") ?? ""),
      dateStart: String(formData.get("dateStart") ?? ""),
      description: String(formData.get("description") ?? ""),
      isBufferActive: formData.get("isBufferActive") === "on",
      title: String(formData.get("title") ?? ""),
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(`/host/events/${result.data.event.id}`);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Input label="이벤트명" name="title" placeholder="졸업사진 촬영" required />
      <label className="block space-y-2">
        <span className="text-sm font-medium text-foreground">설명</span>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          name="description"
          placeholder="친구들이 알아야 할 촬영 장소나 준비물을 적어두세요."
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Input label="시작일" name="dateStart" required type="date" />
        <Input label="종료일" name="dateEnd" required type="date" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="시작 시간" name="dailyStartTime" required type="time" />
        <Input label="종료 시간" name="dailyEndTime" required type="time" />
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Input
          defaultValue={30}
          label="버퍼 타임"
          max={180}
          min={0}
          name="bufferTimeMinutes"
          type="number"
        />
        <label className="flex h-12 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground">
          <input className="size-4 accent-primary" name="isBufferActive" type="checkbox" />
          사용
        </label>
      </div>

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
        이벤트 만들기
      </Button>
    </form>
  );
}
