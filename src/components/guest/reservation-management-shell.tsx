"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarCheck,
  Loader2,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import {
  cancelReservationGroup,
  updateReservationGroup,
  type ReservationManagementView,
} from "@/app/actions/reservations";
import { ReservationPriorityList } from "@/components/guest/reservation-priority-list";
import { TimeSelectionGrid } from "@/components/calendar/time-selection-grid";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import {
  getConfirmedBufferRanges,
  getConfirmedDisplaySlots,
} from "@/lib/reservations/display-ranges";
import { getReservationEditCapabilities } from "@/lib/reservations/rules";
import {
  getSlotCandidateRange,
  getSlotDisplayRange,
} from "@/lib/reservations/slots";
import { splitAvailableBlocksByUnavailable } from "@/lib/time/availability";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/store/use-selection-store";
import type { ReservationStatus, SelectedTimeRange, TimeRange } from "@/types/domain";

type ReservationManagementShellProps = ReservationManagementView;

export function ReservationManagementShell({
  activeDates,
  bufferOverrides,
  event,
  passwordRequired,
  reservation,
  reservationSlots,
  timeBlocks,
}: ReservationManagementShellProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPriorityListOpen, setIsPriorityListOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const removeSelectedRange = useSelectionStore(
    (state) => state.removeSelectedRange,
  );
  const selectedRanges = useSelectionStore((state) => state.selectedRanges);
  const setSelectedRanges = useSelectionStore((state) => state.setSelectedRanges);
  const updateSelectedRange = useSelectionStore(
    (state) => state.updateSelectedRange,
  );
  const { canCancel, canEditPeople, canEditSlots } =
    getReservationEditCapabilities(reservation.status);
  const hasConfirmedSlot = reservation.slots.some((slot) => slot.is_confirmed);
  const confirmedSlotIds = useMemo(
    () =>
      new Set(
        reservation.slots
          .filter((slot) => slot.is_confirmed)
          .map((slot) => slot.id),
    ),
    [reservation.slots],
  );
  const confirmedSlotById = useMemo(
    () =>
      new Map(
        reservation.slots
          .filter((slot) => slot.is_confirmed)
          .map((slot) => [slot.id, slot]),
      ),
    [reservation.slots],
  );
  const publicTimeBlocks = useMemo(
    () => timeBlocks.filter((block) => block.type === "AVAILABLE"),
    [timeBlocks],
  );
  const confirmedDisplaySlots = useMemo(
    () => getConfirmedDisplaySlots(reservationSlots),
    [reservationSlots],
  );
  const confirmedRanges = useMemo(
    () => confirmedDisplaySlots.map((slot) => getSlotDisplayRange(slot)),
    [confirmedDisplaySlots],
  );
  const bufferRanges = useMemo(
    () =>
      getConfirmedBufferRanges({
        bufferOverrides,
        event,
        reservationSlots,
      }),
    [bufferOverrides, event, reservationSlots],
  );
  const displayedTimeBlocks = useMemo(
    () =>
      splitAvailableBlocksByUnavailable(publicTimeBlocks, [
        ...confirmedRanges,
        ...bufferRanges,
      ]),
    [bufferRanges, confirmedRanges, publicTimeBlocks],
  );
  const calendarSelectedRanges = useMemo(
    () =>
      selectedRanges.filter((range) => {
        if (!confirmedSlotIds.has(range.id)) {
          return true;
        }

        const slot = confirmedSlotById.get(range.id);

        if (!slot) {
          return false;
        }

        return !rangesEqual(range, getSlotDisplayRange(slot));
      }),
    [confirmedSlotById, confirmedSlotIds, selectedRanges],
  );

  useEffect(() => {
    const displaySlots = canEditSlots ? reservation.slots : [];

    setSelectedRanges(
      displaySlots.map<SelectedTimeRange>((slot) => {
        const range = getSlotCandidateRange(slot);

        return {
          availability: "available",
          endAt: range.endAt,
          id: slot.id,
          isConfirmed: slot.is_confirmed,
          isConfirmedCandidate:
            slot.is_confirmed && !rangesEqual(range, getSlotDisplayRange(slot)),
          priorityOrder: slot.priority_order,
          startAt: range.startAt,
        };
      }),
    );

    return () => clearSelection();
  }, [
    canEditSlots,
    clearSelection,
    reservation.id,
    reservation.slots,
    setSelectedRanges,
  ]);

  async function handleSave(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setError(null);
    setNotice(null);

    if (!canEditPeople) {
      setError("수정할 수 없는 예약 상태입니다.");
      return;
    }

    if (canEditSlots && selectedRanges.length === 0 && !hasConfirmedSlot) {
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
        ? selectedRanges
            .filter((range) => !range.isConfirmed)
            .map((range) => ({
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

  function handleResizeSelectedRange(
    selectedRange: SelectedTimeRange,
    range: TimeRange,
  ) {
    if (selectedRange.isConfirmed) {
      return;
    }

    setError(null);
    updateSelectedRange(selectedRange.id, range, "available");
  }

  function reorderSelectedRange(draggedRangeId: string, targetRangeId: string) {
    setSelectedRanges(reorderRanges(selectedRanges, draggedRangeId, targetRangeId));
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
            activeDates={activeDates}
            dailyEndTime={event.daily_end_time}
            dailyStartTime={event.daily_start_time}
            dateEnd={event.date_end}
            dateStart={event.date_start}
            mode="guest-reservation"
            onResizeSelectedRange={
              canEditSlots ? handleResizeSelectedRange : undefined
            }
            readOnly={!canEditSlots}
            reservationSlots={confirmedDisplaySlots}
            selectedRanges={calendarSelectedRanges}
            slotDisplayMode="public"
            timeBlocks={displayedTimeBlocks}
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

        <ReservationPriorityList
          canEdit={canEditSlots}
          isOpen={isPriorityListOpen}
          onOpenChange={setIsPriorityListOpen}
          onRemove={removeSelectedRange}
          onReorder={reorderSelectedRange}
          ranges={selectedRanges}
          title="후보"
        />
      </aside>
    </div>
  );
}

function reorderRanges(
  ranges: SelectedTimeRange[],
  draggedRangeId: string,
  targetRangeId: string,
) {
  const draggedIndex = ranges.findIndex((range) => range.id === draggedRangeId);
  const targetIndex = ranges.findIndex((range) => range.id === targetRangeId);

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return ranges;
  }

  const nextRanges = [...ranges];
  const [draggedRange] = nextRanges.splice(draggedIndex, 1);
  nextRanges.splice(targetIndex, 0, draggedRange);

  return nextRanges;
}

function rangesEqual(left: TimeRange, right: TimeRange) {
  return (
    new Date(left.startAt).getTime() === new Date(right.startAt).getTime() &&
    new Date(left.endAt).getTime() === new Date(right.endAt).getTime()
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
