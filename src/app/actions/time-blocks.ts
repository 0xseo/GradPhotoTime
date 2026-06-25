"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/actions/result";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  optionalText,
  requireEventCode,
  requireTimeBlockType,
  requireTimeRanges,
  requireUuid,
} from "@/lib/validators/action-inputs";
import type { TimeBlockType, TimeRange } from "@/types/domain";

export type EventScheduleSlot = Pick<
  Tables<"reservation_slots">,
  "end_at" | "id" | "is_confirmed" | "reservation_id" | "start_at"
> & {
  headcount: number;
  participantNames: string[];
  reservationAccessCode: string;
  reservationStatus: Tables<"reservations">["status"];
};

export type ListTimeBlocksInput =
  | {
      eventCode: string;
      eventId?: never;
    }
  | {
      eventCode?: never;
      eventId: string;
    };

export type ListTimeBlocksData = {
  eventId: string;
  reservationSlots: EventScheduleSlot[];
  timeBlocks: Tables<"time_blocks">[];
};

export async function listTimeBlocks(
  input: ListTimeBlocksInput,
): Promise<ActionResult<ListTimeBlocksData>> {
  try {
    const eventCode = input.eventCode;
    const supabase = createSupabaseAdminClient();
    const eventId = eventCode
      ? await getEventIdByCode(eventCode)
      : requireUuid(input.eventId, "eventId");

    if (!eventCode) {
      await assertCurrentUserIsEventHost(supabase, eventId);
    }

    const { data: timeBlocks, error: timeBlocksError } = await supabase
      .from("time_blocks")
      .select("*")
      .eq("event_id", eventId)
      .order("start_at", { ascending: true });

    if (timeBlocksError) {
      return actionError(timeBlocksError.message);
    }

    const reservationSlots = await listReservationSlotsForEvent(supabase, eventId);

    return actionOk({
      eventId,
      reservationSlots,
      timeBlocks: timeBlocks ?? [],
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export type TimeBlockDraft = TimeRange & {
  note?: string | null;
  type: TimeBlockType;
};

export type SaveTimeBlocksInput = {
  blocks: TimeBlockDraft[];
  eventId: string;
};

export type SaveTimeBlocksData = {
  timeBlocks: Tables<"time_blocks">[];
};

export async function saveTimeBlocks(
  input: SaveTimeBlocksInput,
): Promise<ActionResult<SaveTimeBlocksData>> {
  try {
    const supabase = createSupabaseAdminClient();
    const eventId = requireUuid(input.eventId, "eventId");
    const blocks = parseTimeBlockDrafts(input.blocks);
    await assertCurrentUserIsEventHost(supabase, eventId);

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("event_code")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return actionError("이벤트를 찾을 수 없거나 수정 권한이 없습니다.");
    }

    const { error: deleteError } = await supabase
      .from("time_blocks")
      .delete()
      .eq("event_id", eventId);

    if (deleteError) {
      return actionError(deleteError.message);
    }

    if (blocks.length === 0) {
      revalidateEventPaths(eventId, event.event_code);
      return actionOk({ timeBlocks: [] });
    }

    const { data, error } = await supabase
      .from("time_blocks")
      .insert(
        blocks.map((block) => ({
          end_at: block.endAt,
          event_id: eventId,
          note: block.note,
          start_at: block.startAt,
          type: block.type,
        })),
      )
      .select("*")
      .order("start_at", { ascending: true });

    if (error) {
      return actionError(error.message);
    }

    revalidateEventPaths(eventId, event.event_code);

    return actionOk({ timeBlocks: data ?? [] });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

async function assertCurrentUserIsEventHost(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  eventId: string,
) {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await serverSupabase.auth.getUser();

  if (userError || !user) {
    throw new Error("로그인한 Host만 일정을 관리할 수 있습니다.");
  }

  const { data: event, error } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("host_id", user.id)
    .single();

  if (error || !event) {
    throw new Error("이 이벤트의 Host만 일정을 관리할 수 있습니다.");
  }
}

async function getEventIdByCode(eventCodeInput: string) {
  const eventCode = requireEventCode(eventCodeInput);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("event_code", eventCode)
    .single();

  if (error || !data) {
    throw new Error("존재하지 않는 이벤트 코드입니다.");
  }

  return data.id;
}

async function listReservationSlotsForEvent(
  supabase:
    | ReturnType<typeof createSupabaseAdminClient>
    | Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
) {
  const { data: slots, error: slotsError } = await supabase
    .from("reservation_slots")
    .select("id,reservation_id,start_at,end_at,is_confirmed")
    .eq("event_id", eventId)
    .order("start_at", { ascending: true });

  if (slotsError) {
    throw new Error(slotsError.message);
  }

  if (!slots?.length) {
    return [];
  }

  const reservationIds = [
    ...new Set(slots.map((slot) => slot.reservation_id)),
  ];
  const { data: reservations, error: reservationsError } = await supabase
    .from("reservations")
    .select("id,status,headcount,reservation_access_code")
    .in("id", reservationIds);

  if (reservationsError) {
    throw new Error(reservationsError.message);
  }

  const statusByReservationId = new Map(
    reservations?.map((reservation) => [reservation.id, reservation.status]) ?? [],
  );
  const reservationById = new Map(
    reservations?.map((reservation) => [reservation.id, reservation]) ?? [],
  );
  const { data: participants, error: participantsError } = await supabase
    .from("reservation_participants")
    .select("reservation_id,guest_name")
    .in("reservation_id", reservationIds)
    .order("created_at", { ascending: true });

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  return slots.flatMap<EventScheduleSlot>((slot) => {
    const reservationStatus =
      statusByReservationId.get(slot.reservation_id) ?? "PENDING";
    const reservation = reservationById.get(slot.reservation_id);

    if (reservationStatus === "REJECTED" || reservationStatus === "CANCELLED") {
      return [];
    }

    return [
      {
        end_at: slot.end_at,
        headcount: reservation?.headcount ?? 1,
        id: slot.id,
        is_confirmed: slot.is_confirmed,
        participantNames:
          participants
            ?.filter(
              (participant) =>
                participant.reservation_id === slot.reservation_id,
            )
            .map((participant) => participant.guest_name) ?? [],
        reservationAccessCode: reservation?.reservation_access_code ?? "",
        reservation_id: slot.reservation_id,
        reservationStatus,
        start_at: slot.start_at,
      },
    ];
  });
}

function parseTimeBlockDrafts(blocks: TimeBlockDraft[]) {
  const ranges = requireTimeRanges(blocks, "blocks");

  return ranges.map((range, index) => ({
    ...range,
    note: optionalText(blocks[index]?.note, 500),
    type: requireTimeBlockType(blocks[index]?.type),
  }));
}

function revalidateEventPaths(eventId: string, eventCode: string) {
  revalidatePath(`/host/events/${eventId}`);
  revalidatePath(`/event/${eventCode}`);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server action error.";
}
