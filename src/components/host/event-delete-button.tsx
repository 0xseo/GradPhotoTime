"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { deleteEvent } from "@/app/actions/events";
import { Button } from "@/components/ui/button";

type EventDeleteButtonProps = {
  eventId: string;
  eventTitle: string;
};

export function EventDeleteButton({
  eventId,
  eventTitle,
}: EventDeleteButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleDelete() {
    setError(null);
    setIsPending(true);

    const result = await deleteEvent({ eventId });

    setIsPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setIsOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <Button
        aria-label="이벤트 삭제"
        onClick={() => setIsOpen(true)}
        size="sm"
        title="이벤트 삭제"
        variant="ghost"
      >
        <Trash2 className="size-4 text-danger" aria-hidden="true" />
      </Button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/30 p-4 sm:items-center sm:justify-center"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !isPending) {
              setIsOpen(false);
              setError(null);
            }
          }}
        >
          <div className="w-full max-w-md border border-border bg-background p-4 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-danger">Delete event</p>
                <h3 className="font-serif text-2xl font-semibold text-primary">
                  이벤트 삭제
                </h3>
              </div>
              <Button
                disabled={isPending}
                onClick={() => {
                  setIsOpen(false);
                  setError(null);
                }}
                size="sm"
                variant="ghost"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {eventTitle} 이벤트와 연결된 예약, 후보 시간, 가능 시간,
              버퍼 설정을 모두 삭제합니다.
            </p>
            {error ? (
              <p className="mt-3 border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                disabled={isPending}
                onClick={() => {
                  setIsOpen(false);
                  setError(null);
                }}
                variant="outline"
              >
                취소
              </Button>
              <Button
                className="border-danger bg-danger text-white hover:bg-danger/90"
                disabled={isPending}
                onClick={handleDelete}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
                삭제
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
