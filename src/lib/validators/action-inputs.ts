import { normalizeEventCode } from "./event-code";
import type { ParticipantDraft, TimeBlockType } from "@/types/domain";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireText(value: unknown, fieldName: string, maxLength = 120) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`${fieldName} is required.`);
  }

  if (trimmedValue.length > maxLength) {
    throw new Error(`${fieldName} is too long.`);
  }

  return trimmedValue;
}

export function optionalText(value: unknown, maxLength = 1_000) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Invalid text value.");
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.length > maxLength) {
    throw new Error("Text value is too long.");
  }

  return trimmedValue;
}

export function requireUuid(value: unknown, fieldName: string) {
  const textValue = requireText(value, fieldName);

  if (!UUID_PATTERN.test(textValue)) {
    throw new Error(`${fieldName} must be a valid UUID.`);
  }

  return textValue;
}

export function requireDate(value: unknown, fieldName: string) {
  const textValue = requireText(value, fieldName);

  if (!DATE_PATTERN.test(textValue) || Number.isNaN(Date.parse(textValue))) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return textValue;
}

export function requireTime(value: unknown, fieldName: string) {
  const textValue = requireText(value, fieldName);

  if (!TIME_PATTERN.test(textValue)) {
    throw new Error(`${fieldName} must be a valid time.`);
  }

  return textValue.length === 5 ? `${textValue}:00` : textValue;
}

export function requireEmail(value: unknown) {
  const textValue = requireText(value, "email", 254).toLowerCase();

  if (!EMAIL_PATTERN.test(textValue)) {
    throw new Error("email must be a valid email address.");
  }

  return textValue;
}

export function requirePhone(value: unknown) {
  const textValue = requireText(value, "phone", 20).replace(/[()\s-]/g, "");

  if (!PHONE_PATTERN.test(textValue)) {
    throw new Error("phone must be in E.164 format, like +821012345678.");
  }

  return textValue;
}

export function requireOtp(value: unknown) {
  const textValue = requireText(value, "otp", 12).replace(/\s/g, "");

  if (!/^\d{4,10}$/.test(textValue)) {
    throw new Error("otp must be a numeric verification code.");
  }

  return textValue;
}

export function requireInteger(
  value: unknown,
  fieldName: string,
  min: number,
  max: number,
) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  if (value < min || value > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}.`);
  }

  return value;
}

export function optionalBoolean(value: unknown, defaultValue = false) {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "boolean") {
    throw new Error("Invalid boolean value.");
  }

  return value;
}

export function requireEventCode(value: unknown) {
  const normalizedCode = normalizeEventCode(requireText(value, "eventCode"));

  if (!/^[A-Z0-9]{6,10}$/.test(normalizedCode)) {
    throw new Error("eventCode must be 6-10 letters or numbers.");
  }

  return normalizedCode;
}

export function requireReservationAccessCode(value: unknown) {
  const normalizedCode = requireText(value, "reservationAccessCode")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();

  if (!/^[A-Z0-9]{8,32}$/.test(normalizedCode)) {
    throw new Error("reservationAccessCode must be 8-32 letters or numbers.");
  }

  return normalizedCode;
}

export function requireTimeRange(value: unknown, fieldName: string) {
  if (!isObject(value)) {
    throw new Error(`${fieldName} must be a time range.`);
  }

  const startAt = requireIsoDateTime(value.startAt, `${fieldName}.startAt`);
  const endAt = requireIsoDateTime(value.endAt, `${fieldName}.endAt`);

  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
    throw new Error(`${fieldName}.startAt must be earlier than endAt.`);
  }

  return { endAt, startAt };
}

export function requireTimeRanges(value: unknown, fieldName: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  if (value.length > 100) {
    throw new Error(`${fieldName} can include up to 100 ranges.`);
  }

  return value.map((range, index) =>
    requireTimeRange(range, `${fieldName}[${index}]`),
  );
}

export function requireTimeBlockType(value: unknown): TimeBlockType {
  if (value !== "AVAILABLE" && value !== "BLOCKED") {
    throw new Error("time block type must be AVAILABLE or BLOCKED.");
  }

  return value;
}

export function requireParticipants(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("participants must be an array.");
  }

  if (value.length === 0 || value.length > 30) {
    throw new Error("participants must include 1-30 people.");
  }

  return value.map<ParticipantDraft>((participant, index) => {
    if (!isObject(participant)) {
      throw new Error(`participants[${index}] must be an object.`);
    }

    return {
      guestName: requireText(participant.guestName, "guestName", 80),
      userId:
        typeof participant.userId === "string" && participant.userId
          ? requireUuid(participant.userId, "userId")
          : undefined,
    };
  });
}

function requireIsoDateTime(value: unknown, fieldName: string) {
  const textValue = requireText(value, fieldName);

  if (Number.isNaN(new Date(textValue).getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date time.`);
  }

  return new Date(textValue).toISOString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
