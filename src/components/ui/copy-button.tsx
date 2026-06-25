"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  "aria-label": string;
  getValue?: () => string;
  icon?: "copy" | "share";
  value?: string;
};

export function CopyButton({
  "aria-label": ariaLabel,
  getValue,
  icon = "copy",
  value,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const Icon = copied ? Check : icon === "share" ? Share2 : Copy;

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
      onClick={handleCopy}
      size="sm"
      title={ariaLabel}
      variant="ghost"
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  );
}
