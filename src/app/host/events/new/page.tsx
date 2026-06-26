import { CalendarDays } from "lucide-react";
import { EventCreateForm } from "@/components/host/event-create-form";
import { AppHeader } from "@/components/layout/app-header";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function NewEventPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-dvh bg-background">
      <section className="mx-auto flex min-h-dvh w-full max-w-[92rem] flex-col px-5 py-6 sm:px-8">
        <AppHeader />
        <div className="mb-8 mt-8 flex items-center gap-3 text-primary">
          <CalendarDays className="size-6" aria-hidden="true" />
          <h1 className="font-serif text-3xl font-semibold">새 이벤트</h1>
        </div>

        {user ? (
          <EventCreateForm />
        ) : (
          <div className="border border-border bg-muted p-5">
            <p className="font-serif text-2xl font-semibold text-primary">
              로그인 후 이벤트를 만들 수 있습니다.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Host 일정은 본인 계정과 연결되어야 하므로 이메일 인증 후
              로그인이 필요합니다.
            </p>
            <Link
              className={buttonVariants({ className: "mt-5" })}
              href="/auth?next=/host/events/new"
            >
              로그인하기
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
