import { Clock, ToggleRight } from "lucide-react";

export function HostDashboardShell() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="min-h-96 border border-border bg-background p-4">
        <div className="flex items-center gap-2 text-primary">
          <Clock className="size-5" aria-hidden="true" />
          <h2 className="font-serif text-2xl font-semibold">가능 시간</h2>
        </div>
      </div>
      <aside className="space-y-4 border border-border bg-muted p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">
            버퍼 타임
          </span>
          <ToggleRight className="size-6 text-primary" aria-hidden="true" />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          승인된 예약 전후 시간은 Step 3의 계산 유틸에서 막습니다.
        </p>
      </aside>
    </div>
  );
}
