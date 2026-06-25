"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CalendarRange, Loader2, Trash2 } from "lucide-react";
import { createEvent } from "@/app/actions/events";
import { TimeSelectionGrid } from "@/components/calendar/time-selection-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTimeRange } from "@/lib/time/event-days";
import { useSelectionStore } from "@/store/use-selection-store";

export function EventCreateForm() {
  const router = useRouter();
  const [dailyEndTime, setDailyEndTime] = useState("");
  const [dailyStartTime, setDailyStartTime] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const canShowGrid =
    dateStart !== "" &&
    dateEnd !== "" &&
    dailyStartTime !== "" &&
    dailyEndTime !== "" &&
    dateStart <= dateEnd &&
    dailyStartTime < dailyEndTime;

  useEffect(() => {
    clearSelection();
  }, [clearSelection, dailyEndTime, dailyStartTime, dateEnd, dateStart]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (selectedRanges.length === 0) {
      setError("촬영 가능한 시간을 하나 이상 선택해 주세요.");
      return;
    }

    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await createEvent({
      bufferTimeMinutes: Number(formData.get("bufferTimeMinutes") ?? 30),
      dailyEndTime,
      dailyStartTime,
      dateEnd,
      dateStart,
      description: String(formData.get("description") ?? ""),
      initialAvailableBlocks: selectedRanges.map((range) => ({
        endAt: range.endAt,
        startAt: range.startAt,
      })),
      isBufferActive: formData.get("isBufferActive") === "on",
      title: String(formData.get("title") ?? ""),
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    clearSelection();
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
        <Input
          label="시작일"
          name="dateStart"
          onChange={(eventChange) => setDateStart(eventChange.target.value)}
          required
          type="date"
          value={dateStart}
        />
        <Input
          label="종료일"
          name="dateEnd"
          onChange={(eventChange) => setDateEnd(eventChange.target.value)}
          required
          type="date"
          value={dateEnd}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="시작 시간"
          name="dailyStartTime"
          onChange={(eventChange) => setDailyStartTime(eventChange.target.value)}
          required
          type="time"
          value={dailyStartTime}
        />
        <Input
          label="종료 시간"
          name="dailyEndTime"
          onChange={(eventChange) => setDailyEndTime(eventChange.target.value)}
          required
          type="time"
          value={dailyEndTime}
        />
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

      {canShowGrid ? (
        <div className="space-y-4 border-t border-border pt-5">
          <div className="flex items-center gap-2 text-primary">
            <CalendarRange className="size-5" aria-hidden="true" />
            <h2 className="font-serif text-2xl font-semibold">
              촬영 가능 시간
            </h2>
          </div>
          <TimeSelectionGrid
            dailyEndTime={dailyEndTime}
            dailyStartTime={dailyStartTime}
            dateEnd={dateEnd}
            dateStart={dateStart}
            mode="host-availability"
            selectedRanges={selectedRanges}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="max-h-36 space-y-2 overflow-auto">
              {selectedRanges.map((range) => (
                <div
                  className="rounded-md border border-border bg-muted px-3 py-2 text-xs"
                  key={range.id}
                >
                  {formatTimeRange(range)}
                </div>
              ))}
            </div>
            <Button
              disabled={selectedRanges.length === 0}
              onClick={clearSelection}
              variant="outline"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              선택 초기화
            </Button>
          </div>
        </div>
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
          <ArrowRight className="size-4" aria-hidden="true" />
        )}
        이벤트 만들기
      </Button>
    </form>
  );
}
