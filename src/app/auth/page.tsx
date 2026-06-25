import { Suspense } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";

export default function AuthPage() {
  return (
    <main className="min-h-dvh bg-background">
      <section className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-3 py-2">
          <Link href="/" className="flex items-center gap-2 text-primary">
            <Camera className="size-6" aria-hidden="true" />
            <span className="font-serif text-xl font-semibold">
              Grad Photo Time
            </span>
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <p className="text-sm font-medium text-accent">Host sign in</p>
            <h1 className="max-w-xl font-serif text-5xl font-semibold leading-tight text-primary sm:text-6xl">
              촬영 일정을 열려면 먼저 로그인하세요.
            </h1>
            <p className="max-w-lg text-base leading-7 text-muted-foreground">
              가입 시 이메일 인증을 진행하고, 이후에는 이메일과 비밀번호로
              로그인합니다.
            </p>
          </div>

          <Suspense>
            <AuthForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
