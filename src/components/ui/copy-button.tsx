"use client";

import { useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  "aria-label": string;
  getValue?: () => string;
  icon?: "copy" | "link" | "share";
  value?: string;
};

export function CopyButton({
  "aria-label": ariaLabel,
  getValue,
  icon = "copy",
  value,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const Icon = copied ? Check : icon === "share" ? Share2 : icon === "link" ? Link2 : Copy;
  const copiedMessage = ariaLabel.includes("URL") || icon === "share" || icon === "link"
    ? "링크 복사됨"
    : "코드 복사됨";

  async function handleCopy() {
    const nextValue = getValue?.() ?? value ?? "";

    if (!nextValue) {
      return;
    }

    await navigator.clipboard.writeText(nextValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Button
      aria-label={ariaLabel}
      className="relative"
      onClick={handleCopy}
      size="sm"
      title={ariaLabel}
      variant="ghost"
    >
      <Icon className="size-4" aria-hidden="true" />
      {copied ? (
        <span
          className="absolute right-0 top-full z-50 mt-1 whitespace-nowrap border border-border bg-background px-2 py-1 text-xs text-foreground shadow-sm"
          role="status"
        >
          {copiedMessage}
        </span>
      ) : null}
    </Button>
  );
}
