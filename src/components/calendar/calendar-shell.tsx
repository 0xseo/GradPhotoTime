import { AppHeader } from "@/components/layout/app-header";

type CalendarShellProps = {
  actions?: React.ReactNode;
  children: React.ReactNode;
  eyebrow: string;
  title: string;
};

export async function CalendarShell({
  actions,
  children,
  eyebrow,
  title,
}: CalendarShellProps) {
  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[92rem] px-5 py-2 sm:px-8">
          <AppHeader />
        </div>
      </header>

      <section className="mx-auto w-full max-w-[92rem] px-5 py-6 sm:px-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-accent">{eyebrow}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-3xl font-semibold text-primary">
              {title}
            </h1>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}
