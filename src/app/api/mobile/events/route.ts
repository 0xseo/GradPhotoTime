import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  mobileError,
  mobileOk,
  readJsonBody,
} from "@/lib/mobile/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile/auth";
import {
  optionalBoolean,
  optionalText,
  requireDate,
  requireInteger,
  requireTime,
} from "@/lib/validators/action-inputs";

type CreateMobileEventBody = {
  activeDates?: string[];
  bufferTimeMinutes?: number;
  dailyEndTime?: string;
  dailyStartTime?: string;
  dateEnd?: string;
  dateStart?: string;
  description?: string | null;
  isBufferAfterActive?: boolean;
  isBufferBeforeActive?: boolean;
  title?: string;
};

export async function POST(request: Request) {
  try {
    const user = await getMobileUserFromRequest(request);

    if (!user) {
      return mobileError("로그인이 필요합니다.", 401);
    }

    const body = await readJsonBody<CreateMobileEventBody>(request);
    const dateStart = requireDate(body.dateStart, "dateStart");
    const dateEnd = requireDate(body.dateEnd, "dateEnd");
    const dailyStartTime = requireTime(body.dailyStartTime, "dailyStartTime");
    const dailyEndTime = requireTime(body.dailyEndTime, "dailyEndTime");
    const activeDates = normalizeActiveDates(body.activeDates, dateStart, dateEnd);
    const isBufferBeforeActive = optionalBoolean(
      body.isBufferBeforeActive,
      true,
    );
    const isBufferAfterActive = optionalBoolean(body.isBufferAfterActive, true);
    const admin = createSupabaseAdminClient();

    if (dateStart > dateEnd) {
      return mobileError("시작일은 종료일보다 늦을 수 없습니다.");
    }

    if (dailyStartTime >= dailyEndTime) {
      return mobileError("시작 시간은 종료 시간보다 빨라야 합니다.");
    }

    const { data, error } = await admin
      .from("events")
      .insert({
        buffer_time_minutes: requireInteger(
          body.bufferTimeMinutes ?? 30,
          "bufferTimeMinutes",
          0,
          180,
        ),
        daily_end_time: dailyEndTime,
        daily_start_time: dailyStartTime,
        date_end: dateEnd,
        date_start: dateStart,
        description: optionalText(body.description, 1_000),
        host_id: user.id,
        is_buffer_active: isBufferBeforeActive || isBufferAfterActive,
        is_buffer_after_active: isBufferAfterActive,
        is_buffer_before_active: isBufferBeforeActive,
        title: optionalText(body.title, 120) ?? "졸업사진 일정",
      })
      .select(
        "id,event_code,title,description,date_start,date_end,daily_start_time,daily_end_time,timezone,buffer_time_minutes,is_buffer_active,is_buffer_before_active,is_buffer_after_active",
      )
      .single();

    if (error || !data) {
      return mobileError(error?.message ?? "이벤트를 생성하지 못했습니다.");
    }

    const { error: activeDatesError } = await admin
      .from("event_active_dates")
      .insert(
        activeDates.map((activeDate) => ({
          active_date: activeDate,
          event_id: data.id,
        })),
      );

    if (activeDatesError) {
      await admin.from("events").delete().eq("id", data.id);
      return mobileError(activeDatesError.message);
    }

    return mobileOk({ event: data }, { status: 201 });
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "이벤트 생성에 실패했습니다.",
      500,
    );
  }
}

function normalizeActiveDates(
  value: string[] | undefined,
  dateStart: string,
  dateEnd: string,
) {
  const source = value === undefined ? buildDateList(dateStart, dateEnd) : value;
  const activeDates = [...new Set(source.map((date) => requireDate(date, "activeDate")))]
    .filter((date) => date >= dateStart && date <= dateEnd)
    .sort();

  if (activeDates.length === 0) {
    throw new Error("활성 날짜가 하나 이상 필요합니다.");
  }

  return activeDates;
}

function buildDateList(dateStart: string, dateEnd: string) {
  const dates: string[] = [];
  const current = new Date(`${dateStart}T00:00:00`);
  const end = new Date(`${dateEnd}T00:00:00`);

  while (current.getTime() <= end.getTime()) {
    dates.push(toDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}
