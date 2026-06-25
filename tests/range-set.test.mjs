import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyAvailabilityToggleSelection,
  applySelectedTimeRange,
  applyTimeBlockSelection,
} from "../src/lib/time/range-set.ts";

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

describe("selected time range updates", () => {
  it("removes the dragged range when dragging from an existing selection", () => {
    const selectedRanges = [
      {
        ...range(9, 0, 12, 0),
        availability: "available",
        id: "selected",
      },
    ];

    assert.deepEqual(
      applySelectedTimeRange(
        selectedRanges,
        range(10, 0, 11, 0),
        "available",
        "remove",
      ).map(({ availability, endAt, startAt }) => ({
        availability,
        endAt,
        startAt,
      })),
      [
        {
          ...range(9, 0, 10, 0),
          availability: "available",
        },
        {
          ...range(11, 0, 12, 0),
          availability: "available",
        },
      ],
    );
  });

  it("merges adjacent additions without duplicating selections", () => {
    const selectedRanges = [
      {
        ...range(9, 0, 10, 0),
        availability: "available",
        id: "selected",
      },
    ];

    assert.deepEqual(
      applySelectedTimeRange(
        selectedRanges,
        range(10, 0, 11, 0),
        "available",
        "add",
      ).map(({ availability, endAt, startAt }) => ({
        availability,
        endAt,
        startAt,
      })),
      [
        {
          ...range(9, 0, 11, 0),
          availability: "available",
        },
      ],
    );
  });
});

describe("time block selection updates", () => {
  it("removes overlap from existing available blocks when adding blocked time", () => {
    assert.deepEqual(
      applyTimeBlockSelection(
        [
          {
            ...range(9, 0, 12, 0),
            note: null,
            type: "AVAILABLE",
          },
        ],
        [range(10, 0, 11, 0)],
        "BLOCKED",
      ),
      [
        {
          ...range(9, 0, 10, 0),
          note: null,
          type: "AVAILABLE",
        },
        {
          ...range(11, 0, 12, 0),
          note: null,
          type: "AVAILABLE",
        },
        {
          ...range(10, 0, 11, 0),
          note: null,
          type: "BLOCKED",
        },
      ],
    );
  });

  it("splits available blocks when dragging from an available range", () => {
    assert.deepEqual(
      applyAvailabilityToggleSelection(
        [
          {
            ...range(9, 0, 12, 0),
            note: null,
            type: "AVAILABLE",
          },
        ],
        [range(10, 0, 11, 0)],
      ),
      [
        {
          ...range(9, 0, 10, 0),
          note: null,
          type: "AVAILABLE",
        },
        {
          ...range(11, 0, 12, 0),
          note: null,
          type: "AVAILABLE",
        },
      ],
    );
  });

  it("merges available blocks when dragging from unavailable time", () => {
    assert.deepEqual(
      applyAvailabilityToggleSelection(
        [
          {
            ...range(9, 0, 10, 0),
            note: null,
            type: "AVAILABLE",
          },
          {
            ...range(11, 0, 12, 0),
            note: null,
            type: "AVAILABLE",
          },
        ],
        [range(10, 0, 11, 0)],
      ),
      [
        {
          ...range(9, 0, 12, 0),
          note: null,
          type: "AVAILABLE",
        },
      ],
    );
  });
});
