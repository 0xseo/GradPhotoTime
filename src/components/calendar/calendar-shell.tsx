import Link from "next/link";
import { Camera } from "lucide-react";

type CalendarShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
};

export function CalendarShell({ children, eyebrow, title }: CalendarShellProps) {
  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="flex items-center gap-2 text-primary">
            <Camera className="size-5" aria-hidden="true" />
            <span className="font-serif text-lg font-semibold">
              Grad Photo Time
            </span>
          </Link>
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
