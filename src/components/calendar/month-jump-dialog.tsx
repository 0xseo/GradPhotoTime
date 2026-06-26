"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MonthJumpDialogProps = {
  monthDate: Date;
  onClose: () => void;
  onSave: (monthDate: Date) => void;
  title?: string;
};

export function MonthJumpDialog({
  monthDate,
  onClose,
  onSave,
  title = "연월 선택",
}: MonthJumpDialogProps) {
  const [draftMonth, setDraftMonth] = useState(monthDate.getMonth());
  const [draftYear, setDraftYear] = useState(monthDate.getFullYear());
  const years = Array.from({ length: 12 }, (_, index) => draftYear - 5 + index);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/30 p-4 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md border border-border bg-background p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-accent">Calendar</p>
            <h3 className="font-serif text-2xl font-semibold text-primary">
              {title}
            </h3>
          </div>
          <Button onClick={onClose} size="sm" variant="ghost">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            aria-label="이전 연도 묶음"
            onClick={() => setDraftYear((current) => current - 12)}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <p className="font-serif text-xl font-semibold text-primary">
            {years[0]} - {years.at(-1)}
          </p>
          <Button
            aria-label="다음 연도 묶음"
            onClick={() => setDraftYear((current) => current + 12)}
            size="sm"
            variant="outline"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {years.map((year) => (
            <button
              className={cn(
                "h-10 border border-border text-sm font-medium",
                year === draftYear
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
              key={year}
              onClick={() => setDraftYear(year)}
              type="button"
            >
              {year}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, month) => (
            <button
              className={cn(
                "h-10 border border-border text-sm font-medium",
                month === draftMonth
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground",
              )}
              key={month}
              onClick={() => setDraftMonth(month)}
              type="button"
            >
              {month + 1}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose} variant="outline">
            닫기
          </Button>
          <Button onClick={() => onSave(new Date(draftYear, draftMonth, 1))}>
            적용
          </Button>
        </div>
      </div>
    </div>
  );
}
