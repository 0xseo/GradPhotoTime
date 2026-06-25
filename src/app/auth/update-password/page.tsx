import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { AppHeader } from "@/components/layout/app-header";

export default function UpdatePasswordPage() {
  return (
    <main className="min-h-dvh bg-background">
      <section className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6 sm:px-8">
        <AppHeader />
        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="mb-6 space-y-2">
            <p className="text-sm font-medium text-accent">Account</p>
            <h1 className="font-serif text-4xl font-semibold text-primary">
              비밀번호 변경
            </h1>
          </div>
          <UpdatePasswordForm />
        </div>
      </section>
    </main>
  );
}
