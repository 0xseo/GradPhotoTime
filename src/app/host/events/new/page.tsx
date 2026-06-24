import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewEventPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8">
      <div className="mb-8 flex items-center gap-3 text-primary">
        <CalendarDays className="size-6" aria-hidden="true" />
        <h1 className="font-serif text-3xl font-semibold">새 이벤트</h1>
      </div>

      <form className="space-y-5">
        <Input label="이벤트명" name="title" placeholder="졸업사진 촬영" />
        <Input label="시작일" name="dateStart" type="date" />
        <Input label="종료일" name="dateEnd" type="date" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="시작 시간" name="dailyStartTime" type="time" />
          <Input label="종료 시간" name="dailyEndTime" type="time" />
        </div>
        <Button type="submit" className="w-full">
          생성 준비
        </Button>
      </form>
    </main>
  );
}
