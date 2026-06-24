import { CalendarDays } from "lucide-react";
import { EventCreateForm } from "@/components/host/event-create-form";

export default function NewEventPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8">
      <div className="mb-8 flex items-center gap-3 text-primary">
        <CalendarDays className="size-6" aria-hidden="true" />
        <h1 className="font-serif text-3xl font-semibold">새 이벤트</h1>
      </div>

      <EventCreateForm />
    </main>
  );
}
