import { AppHeader } from "@/components/layout/app-header";

type CalendarShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
};

export async function CalendarShell({
  children,
  eyebrow,
  title,
}: CalendarShellProps) {
  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-2">
          <AppHeader ctaHref="/host/events/new" ctaLabel="이벤트 생성" />
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 py-6">
        <div className="mb-6">
          <p className="text-sm font-medium text-accent">{eyebrow}</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-primary">
            {title}
          </h1>
        </div>
        {children}
      </section>
    </main>
  );
}
