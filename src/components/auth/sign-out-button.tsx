"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const signOutAction = signOut.bind(null, redirectTo);

  return (
    <form action={signOutAction}>
      <Button size="sm" type="submit" variant="ghost">
        <LogOut className="size-4" aria-hidden="true" />
        로그아웃
      </Button>
    </form>
  );
}
