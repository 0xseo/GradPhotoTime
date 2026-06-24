import Link from "next/link";
import { Camera } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AppHeaderProps = {
  ctaHref?: string;
  ctaLabel?: string;
};

export async function AppHeader({ ctaHref, ctaLabel }: AppHeaderProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <Link href="/" className="flex items-center gap-2 text-primary">
        <Camera className="size-6" aria-hidden="true" />
        <span className="font-serif text-xl font-semibold">Grad Photo Time</span>
      </Link>
      <div className="flex items-center gap-2">
        {user ? (
          <>
            <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:inline">
              {user.email ?? user.phone ?? "로그인됨"}
            </span>
            <SignOutButton />
          </>
        ) : (
          <Link
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            href="/auth"
          >
            로그인
          </Link>
        )}
        {ctaHref && ctaLabel ? (
          <Link
            href={ctaHref}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
