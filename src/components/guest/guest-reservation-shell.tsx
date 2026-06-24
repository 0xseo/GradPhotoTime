import { ListChecks, Users } from "lucide-react";

export function GuestReservationShell() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="min-h-96 border border-border bg-background p-4">
        <div className="flex items-center gap-2 text-primary">
          <ListChecks className="size-5" aria-hidden="true" />
          <h2 className="font-serif text-2xl font-semibold">예약 후보</h2>
        </div>
      </div>
      <aside className="space-y-4 border border-border bg-muted p-4">
        <div className="flex items-center gap-2 text-primary">
          <Users className="size-5" aria-hidden="true" />
          <h2 className="font-serif text-xl font-semibold">참여자</h2>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          예약 관리 코드는 Step 4의 서버 액션에서 검증합니다.
        </p>
      </aside>
    </div>
  );
}
