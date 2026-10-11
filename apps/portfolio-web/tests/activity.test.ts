import { describe, expect, it } from "vitest";
import { activitySchema } from "../src/features/client-profile/contracts";
import {
  activityRangeError,
  emptyActivityFilters,
  filterActivity,
  recentActivityRange,
} from "../src/features/client-profile/activity-filters";

const item = (
  id: string,
  occurredAt: string,
  kind = "note",
  body: string | null = null,
) =>
  activitySchema.parse({
    id,
    occurredAt,
    kind,
    title: id,
    body,
    sourceType: null,
    sourceId: null,
    origin: "recorded",
    dueAt: null,
    settledAt: null,
    pinned: false,
  });

describe("activity history selection", () => {
  it("searches title and nullable body without changing service kinds or source order", () => {
    const items = [
      item("first", "2026-10-10T12:00:00Z", "note", "Pilot funding"),
      item("PILOT meeting", "2026-10-09T12:00:00Z", "meeting"),
    ];
    expect(
      filterActivity(
        items,
        { ...emptyActivityFilters, query: " pilot " },
        "UTC",
      ).map((r) => r.id),
    ).toEqual(["first", "PILOT meeting"]);
    expect(
      filterActivity(
        items,
        { ...emptyActivityFilters, query: "PILOT", kind: "meeting" },
        "UTC",
      ).map((r) => r.id),
    ).toEqual(["PILOT meeting"]);
    expect(
      filterActivity(
        items,
        { ...emptyActivityFilters, kind: "Meeting" },
        "UTC",
      ),
    ).toEqual([]);
  });
  it("includes the complete selected local day across a 25-hour DST change", () => {
    const items = [
      item("before", "2026-11-01T06:59:59Z"),
      item("start", "2026-11-01T07:00:00Z"),
      item("end", "2026-11-02T07:59:59Z"),
      item("after", "2026-11-02T08:00:00Z"),
    ];
    const filters = {
      ...emptyActivityFilters,
      from: "2026-11-01",
      to: "2026-11-01",
    };
    expect(
      filterActivity(items, filters, "America/Los_Angeles").map((r) => r.id),
    ).toEqual(["start", "end"]);
    expect(filterActivity(items, filters, "UTC").map((r) => r.id)).toEqual([
      "before",
      "start",
    ]);
  });
  it("supports open date bounds and all dates without excluding older history", () => {
    const items = [
      item("old", "2025-01-01T12:00:00Z"),
      item("new", "2026-10-10T12:00:00Z"),
    ];
    expect(filterActivity(items, emptyActivityFilters, "UTC")).toEqual(items);
    expect(
      filterActivity(
        items,
        { ...emptyActivityFilters, to: "2025-01-01" },
        "UTC",
      ).map((r) => r.id),
    ).toEqual(["old"]);
    expect(
      filterActivity(
        items,
        { ...emptyActivityFilters, from: "2026-01-01" },
        "UTC",
      ).map((r) => r.id),
    ).toEqual(["new"]);
  });
  it("refuses impossible/inverted dates instead of presenting a successful empty range", () => {
    const bad = {
      ...emptyActivityFilters,
      from: "2026-11-02",
      to: "2026-11-01",
    };
    expect(activityRangeError(bad)).toMatch(/start date/);
    expect(
      activityRangeError({ ...emptyActivityFilters, to: "2026-02-30" }),
    ).toMatch(/valid activity dates/);
    expect(
      filterActivity([item("one", "2026-10-10T12:00:00Z")], bad, "UTC"),
    ).toEqual([]);
    expect(
      activitySchema.safeParse({
        ...item("one", "2026-10-10T12:00:00Z"),
        occurredAt: "bad-date",
      }).success,
    ).toBe(false);
  });
  it("builds the last 30 civil dates relative to the viewer rather than the server zone", () => {
    expect(
      recentActivityRange(
        30,
        new Date("2026-11-02T00:30:00Z"),
        "America/Los_Angeles",
      ),
    ).toEqual({ from: "2026-10-03", to: "2026-11-01" });
    expect(
      recentActivityRange(30, new Date("2026-11-02T00:30:00Z"), "UTC"),
    ).toEqual({ from: "2026-10-04", to: "2026-11-02" });
  });
});
