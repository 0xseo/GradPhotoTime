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
  requireTime,
  requireUuid,
  requireTimeRanges,
} from "@/lib/validators/action-inputs";
import type { TimeRange } from "@/types/domain";

export type EventBufferOverride = Tables<"event_buffer_overrides">;
export type EventBufferSide = "BEFORE" | "AFTER";

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
  | "is_buffer_after_active"
  | "is_buffer_before_active"
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
  initialAvailableBlocks?: TimeRange[];
  isBufferActive?: boolean;
  isBufferAfterActive?: boolean;
  isBufferBeforeActive?: boolean;
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
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
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
        is_buffer_after_active: payload.isBufferAfterActive,
        is_buffer_before_active: payload.isBufferBeforeActive,
        timezone: payload.timezone,
        title: payload.title,
      })
      .select(
        "id,event_code,title,description,date_start,date_end,daily_start_time,daily_end_time,timezone,buffer_time_minutes,is_buffer_active,is_buffer_before_active,is_buffer_after_active",
      )
      .single();

    if (error) {
      return actionError(error.message);
    }

    if (payload.initialAvailableBlocks.length > 0) {
      const { error: blocksError } = await admin.from("time_blocks").insert(
        payload.initialAvailableBlocks.map((block) => ({
          end_at: block.endAt,
          event_id: data.id,
          note: null,
          start_at: block.startAt,
          type: "AVAILABLE",
        })),
      );

      if (blocksError) {
        await admin.from("events").delete().eq("id", data.id);
        return actionError(blocksError.message);
      }
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
        "id,event_code,title,description,date_start,date_end,daily_start_time,daily_end_time,timezone,buffer_time_minutes,is_buffer_active,is_buffer_before_active,is_buffer_after_active",
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

export type UpdateEventBufferInput = {
  bufferTimeMinutes: number;
  eventId: string;
  isBufferActive: boolean;
  isBufferAfterActive: boolean;
  isBufferBeforeActive: boolean;
};

export type UpdateEventBufferData = {
  event: PublicEvent;
};

export async function updateEventBufferSettings(
  input: UpdateEventBufferInput,
): Promise<ActionResult<UpdateEventBufferData>> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return actionError("로그인한 Host만 버퍼 설정을 저장할 수 있습니다.");
    }

    const eventId = requireUuid(input.eventId, "eventId");
    const bufferTimeMinutes = requireInteger(
      input.bufferTimeMinutes,
      "bufferTimeMinutes",
      0,
      180,
    );
    const isBufferActive = optionalBoolean(input.isBufferActive, false);
    const isBufferAfterActive = optionalBoolean(input.isBufferAfterActive, false);
    const isBufferBeforeActive = optionalBoolean(
      input.isBufferBeforeActive,
      false,
    );
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("events")
      .update({
        buffer_time_minutes: bufferTimeMinutes,
        is_buffer_active: isBufferActive,
        is_buffer_after_active: isBufferAfterActive,
        is_buffer_before_active: isBufferBeforeActive,
      })
      .eq("id", eventId)
      .eq("host_id", user.id)
      .select(
        "id,event_code,title,description,date_start,date_end,daily_start_time,daily_end_time,timezone,buffer_time_minutes,is_buffer_active,is_buffer_before_active,is_buffer_after_active",
      )
      .single();

    if (error || !data) {
      return actionError("버퍼 설정을 저장할 수 없습니다.");
    }

    revalidatePath(`/host/events/${data.id}`);
    revalidatePath(`/event/${data.event_code}`);

    return actionOk({ event: mapPublicEvent(data) });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type UpdateEventDateRangeInput = {
  dateEnd: string;
  dateStart: string;
  eventId: string;
};

export type UpdateEventDateRangeData = {
  event: PublicEvent;
};

export async function updateEventDateRange(
  input: UpdateEventDateRangeInput,
): Promise<ActionResult<UpdateEventDateRangeData>> {
  try {
    const { admin, event } = await getEditableEventContext(input.eventId);
    const dateStart = requireDate(input.dateStart, "dateStart");
    const dateEnd = requireDate(input.dateEnd, "dateEnd");

    if (new Date(dateStart).getTime() > new Date(dateEnd).getTime()) {
      return actionError("시작일은 종료일보다 늦을 수 없습니다.");
    }

    const { data, error } = await admin
      .from("events")
      .update({
        date_end: dateEnd,
        date_start: dateStart,
      })
      .eq("id", event.id)
      .select(
        "id,event_code,title,description,date_start,date_end,daily_start_time,daily_end_time,timezone,buffer_time_minutes,is_buffer_active,is_buffer_before_active,is_buffer_after_active",
      )
      .single();

    if (error || !data) {
      return actionError("날짜 범위를 저장할 수 없습니다.");
    }

    revalidatePath(`/host/events/${data.id}`);
    revalidatePath(`/event/${data.event_code}`);

    return actionOk({ event: mapPublicEvent(data) });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type ListEventBufferOverridesInput = {
  eventId: string;
};

export type ListEventBufferOverridesData = {
  bufferOverrides: EventBufferOverride[];
};

export async function listEventBufferOverrides(
  input: ListEventBufferOverridesInput,
): Promise<ActionResult<ListEventBufferOverridesData>> {
  try {
    const { admin, event } = await getEditableEventContext(input.eventId);
    const { data, error } = await admin
      .from("event_buffer_overrides")
      .select("*")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true });

    if (error) {
      return actionError(error.message);
    }

    return actionOk({ bufferOverrides: data ?? [] });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type ToggleEventBufferOverrideInput = {
  eventId: string;
  isActive: boolean;
  reservationSlotId: string;
  side: EventBufferSide;
};

export type ToggleEventBufferOverrideData = {
  bufferOverride: EventBufferOverride;
};

export async function toggleEventBufferOverride(
  input: ToggleEventBufferOverrideInput,
): Promise<ActionResult<ToggleEventBufferOverrideData>> {
  try {
    const { admin, event } = await getEditableEventContext(input.eventId);
    const reservationSlotId = requireUuid(
      input.reservationSlotId,
      "reservationSlotId",
    );
    const side = requireBufferSide(input.side);
    const isActive = optionalBoolean(input.isActive, true);

    const { data: slot, error: slotError } = await admin
      .from("reservation_slots")
      .select("id,event_id")
      .eq("id", reservationSlotId)
      .eq("event_id", event.id)
      .single();

    if (slotError || !slot) {
      return actionError("이 이벤트의 확정 슬롯만 버퍼를 수정할 수 있습니다.");
    }

    const { data, error } = await admin
      .from("event_buffer_overrides")
      .upsert(
        {
          event_id: event.id,
          is_active: isActive,
          reservation_slot_id: reservationSlotId,
          side,
        },
        { onConflict: "reservation_slot_id,side" },
      )
      .select("*")
      .single();

    if (error || !data) {
      return actionError("버퍼 예외를 저장할 수 없습니다.");
    }

    revalidatePath(`/host/events/${event.id}`);
    revalidatePath(`/event/${event.event_code}`);

    return actionOk({ bufferOverride: data });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

function parseCreateEventInput(input: CreateEventInput) {
  const title = optionalText(input.title, 80) ?? "졸업사진 촬영";
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
  const isBufferAfterActive = optionalBoolean(
    input.isBufferAfterActive ?? input.isBufferActive,
    false,
  );
  const isBufferBeforeActive = optionalBoolean(
    input.isBufferBeforeActive ?? input.isBufferActive,
    false,
  );
  const initialAvailableBlocks = input.initialAvailableBlocks
    ? requireTimeRanges(input.initialAvailableBlocks, "initialAvailableBlocks")
    : [];

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
    initialAvailableBlocks,
    isBufferActive,
    isBufferAfterActive,
    isBufferBeforeActive,
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
    is_buffer_after_active: event.is_buffer_after_active,
    is_buffer_before_active: event.is_buffer_before_active,
    timezone: event.timezone,
    title: event.title,
  };
}

async function getEditableEventContext(eventIdInput: string) {
  const eventId = requireUuid(eventIdInput, "eventId");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("로그인한 Host만 이벤트를 수정할 수 있습니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data: event, error } = await admin
    .from("events")
    .select("id,event_code,host_id")
    .eq("id", eventId)
    .single();

  if (error || !event || event.host_id !== user.id) {
    throw new Error("이 이벤트의 Host만 이벤트를 수정할 수 있습니다.");
  }

  return { admin, event };
}

function requireBufferSide(value: unknown): EventBufferSide {
  if (value !== "BEFORE" && value !== "AFTER") {
    throw new Error("side must be BEFORE or AFTER.");
  }

  return value;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server action error.";
}
