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
export type EventActiveDate = Tables<"event_active_dates">;

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

    const { error: activeDatesError } = await admin
      .from("event_active_dates")
      .insert(
        buildDateList(payload.dateStart, payload.dateEnd).map((activeDate) => ({
          active_date: activeDate,
          event_id: data.id,
        })),
      );

    if (activeDatesError) {
      await admin.from("events").delete().eq("id", data.id);
      return actionError(activeDatesError.message);
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
    const { data: currentEvent, error: currentEventError } = await admin
      .from("events")
      .select("is_buffer_before_active,is_buffer_after_active")
      .eq("id", eventId)
      .eq("host_id", user.id)
      .single();

    if (currentEventError || !currentEvent) {
      return actionError("버퍼 설정을 저장할 수 없습니다.");
    }

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

    const resetSides: EventBufferSide[] = [];

    if (currentEvent.is_buffer_before_active !== isBufferBeforeActive) {
      resetSides.push("BEFORE");
    }

    if (currentEvent.is_buffer_after_active !== isBufferAfterActive) {
      resetSides.push("AFTER");
    }

    if (resetSides.length > 0) {
      const { error: resetError } = await admin
        .from("event_buffer_overrides")
        .delete()
        .eq("event_id", eventId)
        .in("side", resetSides);

      if (resetError) {
        return actionError(resetError.message);
      }
    } else {
      const { error: resetCustomRangesError } = await admin
        .from("event_buffer_overrides")
        .update({
          custom_end_at: null,
          custom_start_at: null,
        })
        .eq("event_id", eventId)
        .eq("is_active", true);

      if (resetCustomRangesError) {
        return actionError(resetCustomRangesError.message);
      }
    }

    revalidatePath(`/host/events/${data.id}`);
    revalidatePath(`/event/${data.event_code}`);

    return actionOk({ event: mapPublicEvent(data) });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type UpdateEventDateRangeInput = {
  activeDates: string[];
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
    const activeDates = parseActiveDates(input.activeDates);
    const dateStart = activeDates[0];
    const dateEnd = activeDates.at(-1);

    if (!dateEnd) {
      return actionError("활성 날짜를 하나 이상 선택해 주세요.");
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

    const { error: deleteError } = await admin
      .from("event_active_dates")
      .delete()
      .eq("event_id", event.id);

    if (deleteError) {
      return actionError(deleteError.message);
    }

    const { error: insertError } = await admin
      .from("event_active_dates")
      .insert(
        activeDates.map((activeDate) => ({
          active_date: activeDate,
          event_id: event.id,
        })),
      );

    if (insertError) {
      return actionError(insertError.message);
    }

    revalidatePath(`/host/events/${data.id}`);
    revalidatePath(`/event/${data.event_code}`);

    return actionOk({ event: mapPublicEvent(data) });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type ListEventBufferOverridesInput =
  | {
      eventCode: string;
      eventId?: never;
    }
  | {
      eventCode?: never;
      eventId: string;
    };

export type ListEventBufferOverridesData = {
  bufferOverrides: EventBufferOverride[];
};

export async function listEventBufferOverrides(
  input: ListEventBufferOverridesInput,
): Promise<ActionResult<ListEventBufferOverridesData>> {
  try {
    const admin = createSupabaseAdminClient();
    const eventId = input.eventCode
      ? await getEventIdByCode(input.eventCode)
      : requireUuid(input.eventId, "eventId");

    if (!input.eventCode) {
      await assertEditableEvent(eventId);
    }

    const { data, error } = await admin
      .from("event_buffer_overrides")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) {
      return actionError(error.message);
    }

    return actionOk({ bufferOverrides: data ?? [] });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type ListEventActiveDatesInput =
  | {
      eventCode: string;
      eventId?: never;
    }
  | {
      eventCode?: never;
      eventId: string;
    };

export type ListEventActiveDatesData = {
  activeDates: string[];
};

export async function listEventActiveDates(
  input: ListEventActiveDatesInput,
): Promise<ActionResult<ListEventActiveDatesData>> {
  try {
    const admin = createSupabaseAdminClient();
    const eventId = input.eventCode
      ? await getEventIdByCode(input.eventCode)
      : requireUuid(input.eventId, "eventId");

    if (!input.eventCode) {
      await assertEditableEvent(eventId);
    }

    const { data, error } = await admin
      .from("event_active_dates")
      .select("active_date")
      .eq("event_id", eventId)
      .order("active_date", { ascending: true });

    if (error) {
      return actionError(error.message);
    }

    return actionOk({
      activeDates: data?.map((row) => row.active_date) ?? [],
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type ToggleEventBufferOverrideInput = {
  customEndAt?: string | null;
  customStartAt?: string | null;
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
    const customRange = parseOptionalBufferRange(
      input.customStartAt,
      input.customEndAt,
    );

    const { data: slot, error: slotError } = await admin
      .from("reservation_slots")
      .select("id,event_id,is_confirmed")
      .eq("id", reservationSlotId)
      .eq("event_id", event.id)
      .eq("is_confirmed", true)
      .single();

    if (slotError || !slot) {
      return actionError("이 이벤트의 확정 슬롯만 버퍼를 수정할 수 있습니다.");
    }

    const { data, error } = await admin
      .from("event_buffer_overrides")
      .upsert(
        {
          custom_end_at: customRange?.endAt ?? null,
          custom_start_at: customRange?.startAt ?? null,
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

function parseActiveDates(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("activeDates must be an array.");
  }

  const activeDates = [
    ...new Set(
      value.map((date, index) => requireDate(date, `activeDates[${index}]`)),
    ),
  ].sort();

  if (activeDates.length === 0 || activeDates.length > 120) {
    throw new Error("activeDates must include 1-120 dates.");
  }

  return activeDates;
}

function parseOptionalBufferRange(
  customStartAt: unknown,
  customEndAt: unknown,
) {
  if (!customStartAt && !customEndAt) {
    return null;
  }

  if (typeof customStartAt !== "string" || typeof customEndAt !== "string") {
    throw new Error("custom buffer range requires start and end.");
  }

  const startAt = new Date(customStartAt).toISOString();
  const endAt = new Date(customEndAt).toISOString();

  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
    throw new Error("custom buffer start must be earlier than end.");
  }

  return { endAt, startAt };
}

function buildDateList(dateStart: string, dateEnd: string) {
  const dates: string[] = [];
  const current = new Date(`${dateStart}T00:00:00`);
  const end = new Date(`${dateEnd}T00:00:00`);

  while (current.getTime() <= end.getTime()) {
    dates.push(toDateOnly(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function getEventIdByCode(eventCodeInput: string) {
  const eventCode = requireEventCode(eventCodeInput);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("events")
    .select("id")
    .eq("event_code", eventCode)
    .single();

  if (error || !data) {
    throw new Error("존재하지 않는 이벤트 코드입니다.");
  }

  return data.id;
}

async function assertEditableEvent(eventId: string) {
  await getEditableEventContext(eventId);
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
