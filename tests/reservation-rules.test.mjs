import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCandidateSlotBlockReason,
  getReservationEditCapabilities,
} from "../src/lib/reservations/rules.ts";
import { buildBufferTimeRanges } from "../src/lib/time/ranges.ts";

function at(hour, minute = 0) {
  return `2026-07-01T${String(hour).padStart(2, "0")}:${String(
    minute,
  ).padStart(2, "0")}:00.000Z`;
}

function range(startHour, startMinute, endHour, endMinute) {
  return {
    endAt: at(endHour, endMinute),
    startAt: at(startHour, startMinute),
  };
}

describe("reservation edit capabilities", () => {
  it("allows pending reservations to edit people, edit slots, and cancel", () => {
    assert.deepEqual(getReservationEditCapabilities("PENDING"), {
      canCancel: true,
      canEditPeople: true,
      canEditSlots: true,
    });
  });

  it("allows approved reservations to edit people and cancel, but not slots", () => {
    assert.deepEqual(getReservationEditCapabilities("APPROVED"), {
      canCancel: true,
      canEditPeople: true,
      canEditSlots: false,
    });
  });

  it("locks rejected and cancelled reservations", () => {
    assert.deepEqual(getReservationEditCapabilities("REJECTED"), {
      canCancel: false,
      canEditPeople: false,
      canEditSlots: false,
    });
    assert.deepEqual(getReservationEditCapabilities("CANCELLED"), {
      canCancel: false,
      canEditPeople: false,
      canEditSlots: false,
    });
  });
});

describe("candidate slot block rules", () => {
  const availableBlock = {
    ...range(9, 0, 18, 0),
    type: "AVAILABLE",
  };

  it("allows a candidate inside available time with no conflicts", () => {
    assert.equal(
      getCandidateSlotBlockReason({
        bufferMinutes: 30,
        candidate: range(14, 0, 15, 0),
        confirmedRanges: [range(10, 0, 11, 0)],
        timeBlocks: [availableBlock],
      }),
      null,
    );
  });

  it("blocks candidates overlapping host blocked time", () => {
    assert.equal(
      getCandidateSlotBlockReason({
        bufferMinutes: 0,
        candidate: range(13, 30, 14, 30),
        confirmedRanges: [],
        timeBlocks: [
          availableBlock,
          {
            ...range(14, 0, 15, 0),
            type: "BLOCKED",
          },
        ],
      }),
      "BLOCKED_TIME",
    );
  });

  it("blocks candidates outside declared available time when availability exists", () => {
    assert.equal(
      getCandidateSlotBlockReason({
        bufferMinutes: 0,
        candidate: range(8, 30, 9, 30),
        confirmedRanges: [],
        timeBlocks: [availableBlock],
      }),
      "OUTSIDE_AVAILABLE",
    );
  });

  it("blocks candidates that overlap a confirmed reservation or its buffer", () => {
    assert.equal(
      getCandidateSlotBlockReason({
        bufferMinutes: 30,
        candidate: range(10, 45, 11, 15),
        confirmedRanges: [range(11, 0, 12, 0)],
        timeBlocks: [availableBlock],
      }),
      "CONFIRMED_OR_BUFFER",
    );

    assert.equal(
      getCandidateSlotBlockReason({
        bufferMinutes: 30,
        candidate: range(12, 0, 12, 30),
        confirmedRanges: [range(11, 0, 12, 0)],
        timeBlocks: [availableBlock],
      }),
      "CONFIRMED_OR_BUFFER",
    );
  });

  it("treats touching the edge of a buffer as non-overlapping", () => {
    assert.equal(
      getCandidateSlotBlockReason({
        bufferMinutes: 30,
        candidate: range(10, 0, 10, 30),
        confirmedRanges: [range(11, 0, 12, 0)],
        timeBlocks: [availableBlock],
      }),
      null,
    );
  });
});

describe("buffer range construction", () => {
  it("builds before and after ranges around confirmed slots", () => {
    assert.deepEqual(buildBufferTimeRanges([range(11, 0, 12, 0)], 30), [
      range(10, 30, 11, 0),
      range(12, 0, 12, 30),
    ]);
  });

  it("returns no buffer ranges when disabled with zero minutes", () => {
    assert.deepEqual(buildBufferTimeRanges([range(11, 0, 12, 0)], 0), []);
  });
});
