"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Copy, Loader2, ListChecks, Trash2, Users } from "lucide-react";
import { createReservation } from "@/app/actions/reservations";
import type { EventBufferOverride, PublicEvent } from "@/app/actions/events";
import type { EventScheduleSlot } from "@/app/actions/time-blocks";
import { TimeSelectionGrid } from "@/components/calendar/time-selection-grid";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { formatTimeRange } from "@/lib/time/event-days";
import { buildEffectiveBufferTimeRanges } from "@/lib/time/ranges";
import { useSelectionStore } from "@/store/use-selection-store";
import type { Tables } from "@/lib/supabase/database.types";
import type { TimeRange } from "@/types/domain";

type GuestReservationShellProps = {
  activeDates: string[];
  bufferOverrides: EventBufferOverride[];
  event: PublicEvent;
  reservationSlots: EventScheduleSlot[];
  timeBlocks: Tables<"time_blocks">[];
};

export function GuestReservationShell({
  activeDates,
  bufferOverrides,
  event,
  reservationSlots,
  timeBlocks,
}: GuestReservationShellProps) {
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const bufferRanges = useMemo<TimeRange[]>(
    () =>
      buildEffectiveBufferTimeRanges({
        afterActive: event.is_buffer_after_active,
        beforeActive: event.is_buffer_before_active,
        bufferMinutes: event.buffer_time_minutes,
        isBufferActive: event.is_buffer_active,
        overrides: bufferOverrides,
        ranges: reservationSlots
          .filter((slot) => slot.is_confirmed)
          .map((slot) => ({
            endAt: slot.end_at,
            id: slot.id,
            startAt: slot.start_at,
          })),
      }),
    [
      bufferOverrides,
      event.buffer_time_minutes,
      event.is_buffer_active,
      event.is_buffer_after_active,
      event.is_buffer_before_active,
      reservationSlots,
    ],
  );
  const blockedRanges = useMemo<TimeRange[]>(
    () => [
      ...timeBlocks
        .filter((block) => block.type === "BLOCKED")
        .map((block) => ({
          endAt: block.end_at,
          startAt: block.start_at,
        })),
      ...bufferRanges,
    ],
    [bufferRanges, timeBlocks],
  );
  const occupiedRanges = useMemo<TimeRange[]>(
    () =>
      reservationSlots.map((slot) => ({
        endAt: slot.end_at,
        startAt: slot.start_at,
      })),
    [reservationSlots],
  );

  useEffect(() => {
    clearSelection();
  }, [clearSelection, event.id]);

  async function handleSubmit(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setError(null);
    setAccessCode(null);

    if (selectedRanges.length === 0) {
      setError("예약 후보 시간을 하나 이상 선택해 주세요.");
      return;
    }

    const formData = new FormData(eventSubmit.currentTarget);
    const headcount = Number(formData.get("headcount") ?? 1);
    const names = String(formData.get("participants") ?? "")
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length === 0) {
      setError("참여자 이름을 하나 이상 입력해 주세요.");
      return;
    }

    setIsPending(true);

    const result = await createReservation({
      eventId: event.id,
      headcount,
      participants: names.map((guestName) => ({ guestName })),
      password: String(formData.get("password") ?? ""),
      requestedSlots: selectedRanges.map((range) => ({
        endAt: range.endAt,
        startAt: range.startAt,
      })),
    });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    clearSelection();
    setAccessCode(result.data.reservation.reservation_access_code);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="min-h-96 bg-background">
        <div className="flex items-center gap-2 text-primary">
          <ListChecks className="size-5" aria-hidden="true" />
          <h2 className="font-serif text-2xl font-semibold">예약 후보</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          이미 신청된 시간도 선택할 수 있으며, 이 경우 대기 후보로 접수됩니다.
        </p>
        <div className="mt-4">
          <TimeSelectionGrid
            allowWaitlist
            activeDates={activeDates}
            blockedRanges={blockedRanges}
            bufferRanges={bufferRanges}
            dailyEndTime={event.daily_end_time}
            dailyStartTime={event.daily_start_time}
            dateEnd={event.date_end}
            dateStart={event.date_start}
            mode="guest-reservation"
            occupiedRanges={occupiedRanges}
            reservationSlots={reservationSlots}
            selectedRanges={selectedRanges}
            timeBlocks={timeBlocks}
          />
        </div>
      </div>
      <aside className="space-y-4 border border-border bg-muted p-4">
        <div className="flex items-center gap-2 text-primary">
          <Users className="size-5" aria-hidden="true" />
          <h2 className="font-serif text-xl font-semibold">참여자</h2>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            defaultValue={1}
            label="총 인원"
            max={30}
            min={1}
            name="headcount"
            required
            type="number"
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">
              참여자 이름
            </span>
            <textarea
              className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              name="participants"
              placeholder={"김민지\n이서준"}
              required
            />
          </label>
          <Input
            label="관리 비밀번호"
            name="password"
            placeholder="선택"
            type="password"
          />

          {error ? (
            <p className="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button
            className="w-full"
            disabled={isPending || selectedRanges.length === 0}
            type="submit"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            예약 신청
          </Button>
        </form>

        <Button
          className="w-full"
          disabled={selectedRanges.length === 0}
          onClick={clearSelection}
          variant="outline"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          선택 초기화
        </Button>

        {accessCode ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 text-emerald-900">
              <Copy className="size-4" aria-hidden="true" />
              <p className="text-sm font-medium">예약 관리 코드</p>
            </div>
            <p className="mt-2 font-mono text-xl font-semibold text-emerald-950">
              {accessCode}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Link
                className="text-sm font-medium text-primary underline"
                href={`/reservations/${accessCode}`}
              >
                예약 관리 화면 열기
              </Link>
              <CopyButton
                aria-label="예약 관리 코드 복사"
                value={accessCode}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            선택 {selectedRanges.length}개
          </p>
          <div className="max-h-40 space-y-2 overflow-auto">
            {selectedRanges.map((range) => (
              <div
                className="rounded-md border border-border bg-background px-3 py-2 text-xs"
                key={range.id}
              >
                <span>{formatTimeRange(range)}</span>
                {range.availability === "waitlist" ? (
                  <span className="ml-2 text-amber-700">대기</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
