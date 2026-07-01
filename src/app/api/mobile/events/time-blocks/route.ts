import { revalidatePath } from "next/cache";
import {
  mobileError,
  mobileOk,
  readJsonBody,
} from "@/lib/mobile/api-response";
import { getMobileUserFromRequest } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import {
  optionalText,
  requireTimeBlockType,
  requireTimeRange,
  requireUuid,
} from "@/lib/validators/action-inputs";

type SaveMobileTimeBlocksBody = {
  blocks?: TimeBlockBody[];
  eventId?: string;
};

type TimeBlockBody = {
  endAt?: string;
  note?: string | null;
  startAt?: string;
  type?: string;
};

type ParsedTimeBlock = {
  endAt: string;
  note: string | null;
  startAt: string;
  type: Tables<"time_blocks">["type"];
};

export async function POST(request: Request) {
  try {
    const user = await getMobileUserFromRequest(request);

    if (!user) {
      return mobileError("로그인이 필요합니다.", 401);
    }

    const body = await readJsonBody<SaveMobileTimeBlocksBody>(request);
    const eventId = requireUuid(body.eventId, "eventId");
    const blocks = parseTimeBlocks(body.blocks);
    const admin = createSupabaseAdminClient();
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id,event_code,host_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event || event.host_id !== user.id) {
      return mobileError("이 이벤트의 Host만 가능 시간을 수정할 수 있습니다.", 403);
    }

    const { error: deleteError } = await admin
      .from("time_blocks")
      .delete()
      .eq("event_id", event.id);

    if (deleteError) {
      return mobileError(deleteError.message);
    }

    const { data, error } =
      blocks.length > 0
        ? await admin
            .from("time_blocks")
            .insert(
              blocks.map((block) => ({
                end_at: block.endAt,
                event_id: event.id,
                note: block.note,
                start_at: block.startAt,
                type: block.type,
              })),
            )
            .select("id,event_id,start_at,end_at,type,note")
            .order("start_at", { ascending: true })
        : { data: [], error: null };

    if (error) {
      return mobileError(error.message);
    }

    revalidatePath(`/host/events/${event.id}`);
    revalidatePath(`/event/${event.event_code}`);

    return mobileOk({ timeBlocks: data ?? [] });
  } catch (error) {
    return mobileError(
      error instanceof Error ? error.message : "가능 시간을 저장하지 못했습니다.",
      500,
    );
  }
}

function parseTimeBlocks(value: unknown): ParsedTimeBlock[] {
  if (!Array.isArray(value)) {
    throw new Error("blocks must be an array.");
  }

  if (value.length > 250) {
    throw new Error("blocks can include up to 250 ranges.");
  }

  return value.map((block, index) => {
    if (!isObject(block)) {
      throw new Error(`blocks[${index}] must be an object.`);
    }

    const range = requireTimeRange(block, `blocks[${index}]`);

    return {
      ...range,
      note: optionalText(block.note, 500),
      type: requireTimeBlockType(block.type),
    };
  });
}

function isObject(value: unknown): value is TimeBlockBody {
  return typeof value === "object" && value !== null;
}
