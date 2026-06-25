"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarCheck,
  Check,
  Loader2,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  cancelReservationGroup,
  updateReservationGroup,
  type ReservationManagementView,
} from "@/app/actions/reservations";
import { TimeSelectionGrid } from "@/components/calendar/time-selection-grid";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { getReservationEditCapabilities } from "@/lib/reservations/rules";
import { formatTimeRange } from "@/lib/time/event-days";
import { buildBufferTimeRanges } from "@/lib/time/ranges";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/store/use-selection-store";
import type { ReservationStatus, SelectedTimeRange, TimeRange } from "@/types/domain";

type ReservationManagementShellProps = ReservationManagementView;

export function ReservationManagementShell({
  event,
  passwordRequired,
  reservation,
  reservationSlots,
  timeBlocks,
}: ReservationManagementShellProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const removeSelectedRange = useSelectionStore(
    (state) => state.removeSelectedRange,
  );
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const setSelectedRanges = useSelectionStore((state) => state.setSelectedRanges);
  const { canCancel, canEditPeople, canEditSlots } =
    getReservationEditCapabilities(reservation.status);
  const confirmedRanges = useMemo<TimeRange[]>(
    () =>
      reservationSlots
        .filter((slot) => slot.is_confirmed)
        .map((slot) => ({
          endAt: slot.end_at,
          startAt: slot.start_at,
        })),
    [reservationSlots],
  );
  const bufferRanges = useMemo<TimeRange[]>(
    () =>
      event.is_buffer_active
        ? buildBufferTimeRanges(confirmedRanges, event.buffer_time_minutes, {
            afterActive: event.is_buffer_after_active,
            beforeActive: event.is_buffer_before_active,
          })
        : [],
    [
      confirmedRanges,
      event.buffer_time_minutes,
      event.is_buffer_active,
      event.is_buffer_after_active,
      event.is_buffer_before_active,
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
  const visibleReservationSlots = useMemo(
    () =>
      reservationSlots.filter((slot) => slot.reservation_id !== reservation.id),
    [reservation.id, reservationSlots],
  );
  const occupiedRanges = useMemo<TimeRange[]>(
    () =>
      visibleReservationSlots.map((slot) => ({
        endAt: slot.end_at,
        startAt: slot.start_at,
      })),
    [visibleReservationSlots],
  );

  useEffect(() => {
    setSelectedRanges(
      reservation.slots.map<SelectedTimeRange>((slot) => ({
        availability: "available",
        endAt: slot.end_at,
        id: slot.id,
        startAt: slot.start_at,
      })),
    );

    return () => clearSelection();
  }, [clearSelection, reservation.id, reservation.slots, setSelectedRanges]);

  async function handleSave(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setError(null);
    setNotice(null);

    if (!canEditPeople) {
      setError("수정할 수 없는 예약 상태입니다.");
      return;
    }

    if (canEditSlots && selectedRanges.length === 0) {
      setError("예약 후보 시간을 하나 이상 선택해 주세요.");
      return;
    }

    const formData = new FormData(eventSubmit.currentTarget);
    const names = String(formData.get("participants") ?? "")
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length === 0) {
      setError("참여자 이름을 하나 이상 입력해 주세요.");
      return;
    }

    setIsSaving(true);

    const result = await updateReservationGroup({
      headcount: Number(formData.get("headcount") ?? reservation.headcount),
      participants: names.map((guestName) => ({ guestName })),
      password,
      requestedSlots: canEditSlots
        ? selectedRanges.map((range) => ({
            endAt: range.endAt,
            startAt: range.startAt,
          }))
        : undefined,
      reservationAccessCode: reservation.reservation_access_code,
    });

    setIsSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("예약 정보를 저장했습니다.");
    router.refresh();
  }

  async function handleCancel() {
    setError(null);
    setNotice(null);

    if (passwordRequired && !password.trim()) {
      setError("예약 비밀번호를 입력해 주세요.");
      return;
    }

    setIsCancelling(true);

    const result = await cancelReservationGroup({
      password,
      reservationAccessCode: reservation.reservation_access_code,
    });

    setIsCancelling(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    clearSelection();
    setNotice("예약을 취소했습니다.");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-h-96 bg-background">
        <div className="flex flex-wrap items-center gap-2 text-primary">
          <CalendarCheck className="size-5" aria-hidden="true" />
          <h2 className="font-serif text-2xl font-semibold">예약 후보</h2>
          <StatusBadge status={reservation.status} />
        </div>
        <div className="mt-4">
          <TimeSelectionGrid
            allowWaitlist
            blockedRanges={blockedRanges}
            bufferRanges={bufferRanges}
            dailyEndTime={event.daily_end_time}
            dailyStartTime={event.daily_start_time}
            dateEnd={event.date_end}
            dateStart={event.date_start}
            mode="guest-reservation"
            occupiedRanges={occupiedRanges}
            readOnly={!canEditSlots}
            reservationSlots={visibleReservationSlots}
            selectedRanges={selectedRanges}
            timeBlocks={timeBlocks}
          />
        </div>
      </div>

      <aside className="space-y-4 border border-border bg-muted p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            예약 관리 코드
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="font-mono text-2xl font-semibold text-primary">
              {reservation.reservation_access_code}
            </p>
            <CopyButton
              aria-label="예약 관리 코드 복사"
              value={reservation.reservation_access_code}
            />
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSave}>
          <div className="flex items-center gap-2 text-primary">
            <Users className="size-5" aria-hidden="true" />
            <h2 className="font-serif text-xl font-semibold">참여자</h2>
          </div>
          <Input
            defaultValue={reservation.headcount}
            disabled={!canEditPeople}
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
              className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:opacity-60"
              defaultValue={reservation.participants
                .map((participant) => participant.guest_name)
                .join("\n")}
              disabled={!canEditPeople}
              name="participants"
              required
            />
          </label>
          <Input
            label="관리 비밀번호"
            name="password"
            onChange={(eventChange) => setPassword(eventChange.target.value)}
            placeholder={passwordRequired ? "필수" : "선택"}
            required={passwordRequired}
            type="password"
            value={password}
          />

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

          <Button className="w-full" disabled={!canEditPeople || isSaving} type="submit">
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            저장
          </Button>
        </form>

        <Button
          className="w-full"
          disabled={!canCancel || isCancelling}
          onClick={handleCancel}
          variant="outline"
        >
          {isCancelling ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="size-4" aria-hidden="true" />
          )}
          예약 취소
        </Button>

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">
            선택 {selectedRanges.length}개
          </p>
          <div className="max-h-48 space-y-2 overflow-auto">
            {selectedRanges.map((range) => (
              <div
                className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs"
                key={range.id}
              >
                <span className="truncate">{formatTimeRange(range)}</span>
                {canEditSlots ? (
                  <button
                    className="text-muted-foreground hover:text-danger"
                    onClick={() => removeSelectedRange(range.id)}
                    type="button"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : (
                  <Check className="size-4 text-primary" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const meta = getStatusMeta(status);

  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-medium",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

function getStatusMeta(status: ReservationStatus) {
  if (status === "APPROVED") {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      label: "승인",
    };
  }

  if (status === "REJECTED") {
    return {
      className: "border-zinc-200 bg-zinc-100 text-zinc-600",
      label: "거절",
    };
  }

  if (status === "CANCELLED") {
    return {
      className: "border-red-200 bg-red-50 text-danger",
      label: "취소",
    };
  }

  return {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    label: "대기",
  };
}
