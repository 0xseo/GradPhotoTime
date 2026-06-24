import { CalendarDays, Camera, Users } from "lucide-react";
import { EventCodeEntry } from "@/components/guest/event-code-entry";
import { AppHeader } from "@/components/layout/app-header";

export default async function Home() {
  return (
    <main className="min-h-dvh bg-background">
      <section className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
        <AppHeader ctaHref="/host/events/new" ctaLabel="이벤트 생성" />

        <div className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-medium text-accent">
                Graduation photo scheduler
              </p>
              <h1 className="max-w-2xl font-serif text-5xl font-semibold leading-tight text-primary sm:text-6xl">
                졸업사진 약속을 한 화면에서 맞추세요.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Host는 촬영 가능 시간을 열고, Guest는 겹치는 후보 시간에
                그룹으로 신청합니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border-y border-border py-4">
                <CalendarDays className="mb-3 size-5 text-accent" />
                <p className="text-sm font-medium text-foreground">
                  터치 시간 선택
                </p>
              </div>
              <div className="border-y border-border py-4">
                <Users className="mb-3 size-5 text-accent" />
                <p className="text-sm font-medium text-foreground">
                  혼합 그룹 예약
                </p>
              </div>
              <div className="border-y border-border py-4">
                <Camera className="mb-3 size-5 text-accent" />
                <p className="text-sm font-medium text-foreground">
                  승인 기반 확정
                </p>
              </div>
            </div>
          </div>

          <EventCodeEntry />
        </div>
      </section>
    </main>
  );
}
