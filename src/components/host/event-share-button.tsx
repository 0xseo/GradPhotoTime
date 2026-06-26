"use client";

import { useEffect, useState } from "react";
import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

type EventShareButtonProps = {
  eventCode: string;
};

export function EventShareButton({ eventCode }: EventShareButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <Button
        aria-label="이벤트 공유"
        onClick={() => setOpen(true)}
        size="sm"
        variant="ghost"
      >
        <Share2 className="size-4" aria-hidden="true" />
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/30 p-4 sm:items-center sm:justify-center"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setOpen(false);
            }
          }}
        >
          <div className="w-full max-w-sm border border-border bg-background p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-accent">Share</p>
                <h2 className="font-serif text-2xl font-semibold text-primary">
                  이벤트 공유
                </h2>
              </div>
              <Button onClick={() => setOpen(false)} size="sm" variant="ghost">
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="rounded-md border border-border bg-muted px-3 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                공유 코드
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="font-mono text-2xl font-semibold text-primary">
                  {eventCode}
                </p>
                <div className="flex items-center gap-1">
                  <CopyButton
                    aria-label="이벤트 코드 복사"
                    value={eventCode}
                  />
                  <CopyButton
                    aria-label="이벤트 URL 복사"
                    getValue={() =>
                      `${window.location.origin}/event/${eventCode}`
                    }
                    icon="link"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
