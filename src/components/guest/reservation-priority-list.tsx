"use client";

import { useState, type PointerEvent } from "react";
import { Check, ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectedTimeRange, TimeRange } from "@/types/domain";

type ReservationPriorityListProps = {
  canEdit?: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRemove: (rangeId: string) => void;
  onReorder: (draggedRangeId: string, targetRangeId: string) => void;
  ranges: SelectedTimeRange[];
  title: string;
};

export function ReservationPriorityList({
  canEdit = true,
  isOpen,
  onOpenChange,
  onRemove,
  onReorder,
  ranges,
  title,
}: ReservationPriorityListProps) {
  const [draggingRangeId, setDraggingRangeId] = useState<string | null>(null);

  function handleDragMove(event: PointerEvent<HTMLButtonElement>) {
    if (!draggingRangeId) {
      return;
    }

    const targetElement = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-priority-range-id]");
    const targetRangeId = targetElement?.dataset.priorityRangeId;

    if (!targetRangeId || targetRangeId === draggingRangeId) {
      return;
    }

    onReorder(draggingRangeId, targetRangeId);
  }

  function stopDragging(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDraggingRangeId(null);
  }

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <button
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => onOpenChange(!isOpen)}
        type="button"
      >
        <span className="text-sm font-medium text-foreground">
          {title} {ranges.length}개
        </span>
        {isOpen ? (
          <ChevronUp className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4 text-primary" aria-hidden="true" />
        )}
      </button>

      {isOpen ? (
        <div className="max-h-48 space-y-2 overflow-auto">
          {ranges.length > 0 ? (
            ranges.map((range, index) => (
              <div
                className={cn(
                  "grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-md border border-border bg-background px-2 py-2 text-xs",
                  draggingRangeId === range.id &&
                    "border-primary bg-[#f6fbff] shadow-sm",
                )}
                data-priority-range-id={range.id}
                key={range.id}
              >
                {canEdit ? (
                  <button
                    aria-label="우선순위 드래그"
                    className="inline-flex size-7 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary active:cursor-grabbing"
                    onPointerCancel={stopDragging}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setDraggingRangeId(range.id);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={handleDragMove}
                    onPointerUp={stopDragging}
                    type="button"
                  >
                    <GripVertical className="size-4" aria-hidden="true" />
                  </button>
                ) : (
                  <Check className="size-4 text-primary" aria-hidden="true" />
                )}
                <span className="font-mono text-muted-foreground">
                  {range.priorityOrder ?? index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    {range.isConfirmed ? (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                        확정
                      </span>
                    ) : null}
                    <p className="truncate font-medium text-foreground">
                      {formatReservationPriorityRange(range)}
                    </p>
                  </div>
                </div>
                {canEdit && !range.isConfirmed ? (
                  <button
                    aria-label="후보 삭제"
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-danger"
                    onClick={() => onRemove(range.id)}
                    type="button"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="rounded-md border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
              선택한 후보 시간이 없습니다.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function formatReservationPriorityRange(range: TimeRange) {
  const start = new Date(range.startAt);
  const end = new Date(range.endAt);
  const date = `${start.getMonth() + 1}/${start.getDate()}`;
  const startTime = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(start);
  const endTime = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(end);

  return `${date} ${startTime} - ${endTime}`;
}
