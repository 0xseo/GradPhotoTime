"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/actions/result";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  optionalBoolean,
  optionalText,
  requireDate,
  requireEventCode,
  requireInteger,
  requireText,
  requireTime,
} from "@/lib/validators/action-inputs";

export type PublicEvent = Pick<
  Tables<"events">,
  | "buffer_time_minutes"
  | "daily_end_time"
  | "daily_start_time"
  | "date_end"
  | "date_start"
  | "description"
  | "event_code"
  | "id"
  | "is_buffer_active"
  | "timezone"
  | "title"
>;

export type CreateEventInput = {
  bufferTimeMinutes?: number;
  dailyEndTime: string;
  dailyStartTime: string;
  dateEnd: string;
  dateStart: string;
  description?: string | null;
  isBufferActive?: boolean;
  timezone?: string;
  title: string;
};

export type CreateEventData = {
  event: PublicEvent;
};

export async function createEvent(
  input: CreateEventInput,
): Promise<ActionResult<CreateEventData>> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return actionError("로그인한 사용자만 이벤트를 생성할 수 있습니다.");
    }

    const payload = parseCreateEventInput(input);
    const { data, error } = await supabase
      .from("events")
      .insert({
        buffer_time_minutes: payload.bufferTimeMinutes,
        daily_end_time: payload.dailyEndTime,
        daily_start_time: payload.dailyStartTime,
        date_end: payload.dateEnd,
        date_start: payload.dateStart,
        description: payload.description,
        host_id: user.id,
        is_buffer_active: payload.isBufferActive,
        timezone: payload.timezone,
        title: payload.title,
      })
      .select(
        "id,event_code,title,description,date_start,date_end,daily_start_time,daily_end_time,timezone,buffer_time_minutes,is_buffer_active",
      )
      .single();

    if (error) {
      return actionError(error.message);
    }

    revalidatePath("/");

    return actionOk({ event: mapPublicEvent(data) });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type VerifyEventCodeData = {
  event: PublicEvent;
};

export async function verifyEventCode(
  eventCodeOrInput: string | { eventCode: string },
): Promise<ActionResult<VerifyEventCodeData>> {
  try {
    const eventCode =
      typeof eventCodeOrInput === "string"
        ? requireEventCode(eventCodeOrInput)
        : requireEventCode(eventCodeOrInput.eventCode);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("events")
      .select(
        "id,event_code,title,description,date_start,date_end,daily_start_time,daily_end_time,timezone,buffer_time_minutes,is_buffer_active",
      )
      .eq("event_code", eventCode)
      .single();

    if (error || !data) {
      return actionError("존재하지 않는 이벤트 코드입니다.");
    }

    return actionOk({ event: mapPublicEvent(data) });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

function parseCreateEventInput(input: CreateEventInput) {
  const title = requireText(input.title, "title", 80);
  const description = optionalText(input.description, 1_000);
  const dateStart = requireDate(input.dateStart, "dateStart");
  const dateEnd = requireDate(input.dateEnd, "dateEnd");
  const dailyStartTime = requireTime(input.dailyStartTime, "dailyStartTime");
  const dailyEndTime = requireTime(input.dailyEndTime, "dailyEndTime");
  const timezone = optionalText(input.timezone, 80) ?? "Asia/Seoul";
  const bufferTimeMinutes = requireInteger(
    input.bufferTimeMinutes ?? 30,
    "bufferTimeMinutes",
    0,
    180,
  );
  const isBufferActive = optionalBoolean(input.isBufferActive, false);

  if (new Date(dateStart).getTime() > new Date(dateEnd).getTime()) {
    throw new Error("dateStart must be earlier than or equal to dateEnd.");
  }

  if (dailyStartTime >= dailyEndTime) {
    throw new Error("dailyStartTime must be earlier than dailyEndTime.");
  }

  return {
    bufferTimeMinutes,
    dailyEndTime,
    dailyStartTime,
    dateEnd,
    dateStart,
    description,
    isBufferActive,
    timezone,
    title,
  };
}

function mapPublicEvent(event: PublicEvent): PublicEvent {
  return {
    buffer_time_minutes: event.buffer_time_minutes,
    daily_end_time: event.daily_end_time,
    daily_start_time: event.daily_start_time,
    date_end: event.date_end,
    date_start: event.date_start,
    description: event.description,
    event_code: event.event_code,
    id: event.id,
    is_buffer_active: event.is_buffer_active,
    timezone: event.timezone,
    title: event.title,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server action error.";
}
