import { describe, expect, it } from "vitest";
import { createApiClient, type ApiClient } from "@/shared/api/http";
import { readPublicEvent } from "@/features/calendar/public-event/api";
import {
  publicEventEnvelope,
  projectPublicEvent,
} from "@/features/calendar/public-event/contracts";
import {
  attendanceLabel,
  eventWhen,
  publicEventHref,
} from "@/features/calendar/public-event/presentation";
import { publicEventKey } from "@/features/calendar/public-event/usePublicEvent";

const eventId = "cm-119-123456";
const clientId = "10000000-0000-4000-8000-000000000001";
const hearing = {
  id: eventId,
  title: "Synthetic public markup",
  chamber: "House",
  committeeName: "Synthetic committee",
  calendarDate: "2026-10-08",
  scheduledStart: "2026-10-08T14:00:00Z",
  time: null,
  timeZone: "America/New_York",
  eventStatus: "scheduled",
  eventType: "Markup",
  visibility: "public",
};
const relevance = {
  hearingId: eventId,
  clientId,
  clientName: "Synthetic authorized client",
  band: "HIGH",
};
const envelope = {
  hearing,
  followState: {
    hearingId: eventId,
    following: true,
    createdCaptureDemand: false,
  },
  attendanceState: {
    state: "AUTOMATIC_AVAILABLE",
    reasonCode: "READY",
    message: "A source can be requested.",
    scheduled: false,
  },
  clientRelevance: {
    hearingId: eventId,
    scope: "all-clients",
    clients: [relevance],
  },
};
function client(
  body: unknown,
  status = 200,
  calls: { path: string; method: string; signal?: AbortSignal | null }[] = [],
): ApiClient {
  return createApiClient(async (path, options) => {
    calls.push({
      path: String(path),
      method: options?.method ?? "GET",
      signal: options?.signal,
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
}
describe("public proceeding read contracts", () => {
  it("uses one Core GET composition with exact canonical scope and abort signal", async () => {
    const calls: {
      path: string;
      method: string;
      signal?: AbortSignal | null;
    }[] = [];
    const signal = new AbortController().signal;
    const result = await readPublicEvent(
      client(envelope, 200, calls),
      eventId,
      undefined,
      signal,
    );
    expect(calls).toEqual([
      {
        path: `/api/backend/core/legiwatch/live-hearings/events/${eventId}/detail-v2`,
        method: "GET",
        signal,
      },
    ]);
    expect(result.follow?.following).toBe(true);
    expect(result.attendance?.scheduled).toBe(false);
    expect(result.clients).toEqual([relevance]);
  });
  it("preserves requested client scope and refuses an all-clients projection in that scope", async () => {
    const calls: { path: string; method: string }[] = [];
    const result = await readPublicEvent(
      client(envelope, 200, calls),
      eventId,
      clientId,
    );
    expect(calls[0]?.path).toContain(`?clientId=${clientId}`);
    expect(result.clients).toBeNull();
    const selected = await readPublicEvent(
      client({ ...envelope, clientRelevance: relevance }),
      eventId,
      clientId,
    );
    expect(selected.clients).toEqual([relevance]);
  });
  it("encodes opaque event IDs and never substitutes capture IDs into the route", async () => {
    const id = "official/event?part=one";
    const calls: { path: string; method: string }[] = [];
    await readPublicEvent(
      client({ ...envelope, hearing: { ...hearing, id } }, 200, calls),
      id,
    );
    expect(calls[0]?.path).toContain(
      "events/official%2Fevent%3Fpart%3Done/detail-v2",
    );
  });
  it("refuses changed canonical identity instead of showing a different event", async () => {
    await expect(
      readPublicEvent(
        client({ ...envelope, hearing: { ...hearing, id: "other-event" } }),
        eventId,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it.each([401, 403, 404, 503])(
    "preserves HTTP%s without trying another backend or action",
    async (status) => {
      const calls: { path: string; method: string }[] = [];
      await expect(
        readPublicEvent(
          client({ message: "Synthetic refusal" }, status, calls),
          eventId,
        ),
      ).rejects.toMatchObject({ status });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.method).toBe("GET");
    },
  );
  it("shows unavailable partial follow/capture/relevance without deriving any from Following", async () => {
    const partial = projectPublicEvent(
      publicEventEnvelope.parse({ hearing, followState: envelope.followState }),
    );
    expect(partial.follow?.following).toBe(true);
    expect(partial.attendance).toBeNull();
    expect(partial.clients).toBeNull();
    const invalid = projectPublicEvent(
      publicEventEnvelope.parse({
        ...envelope,
        followState: { ...envelope.followState, createdCaptureDemand: true },
        attendanceState: { ...envelope.attendanceState, state: "invented" },
      }),
    );
    expect(invalid.follow).toBeNull();
    expect(invalid.attendance).toBeNull();
  });
  it.each([
    { ...envelope.clientRelevance, hearingId: "other-event" },
    {
      ...envelope.clientRelevance,
      clients: [{ ...relevance, hearingId: "other-event" }],
    },
    { ...envelope.clientRelevance, clients: [relevance, relevance] },
    { ...relevance, clientId: "different-client" },
  ])(
    "discards mismatched or duplicate private relevance %j",
    (clientRelevance) => {
      const result = projectPublicEvent(
        publicEventEnvelope.parse({ ...envelope, clientRelevance }),
      );
      expect(result.clients).toBeNull();
    },
  );
  it("isolates keys by actor, tenant, selected event and selected client", () => {
    const key = publicEventKey(eventId, clientId, {
      userId: "user-a",
      tenantId: "tenant-a",
    });
    expect(key).not.toEqual(
      publicEventKey(eventId, clientId, {
        userId: "user-b",
        tenantId: "tenant-a",
      }),
    );
    expect(key).not.toEqual(
      publicEventKey(eventId, clientId, {
        userId: "user-a",
        tenantId: "tenant-b",
      }),
    );
    expect(key).not.toEqual(
      publicEventKey(eventId, undefined, {
        userId: "user-a",
        tenantId: "tenant-a",
      }),
    );
    expect(key).not.toEqual(
      publicEventKey("other-event", clientId, {
        userId: "user-a",
        tenantId: "tenant-a",
      }),
    );
  });
});
describe("source date and capture presentation", () => {
  it("preserves source-local calendar dates and discloses absent time precision", () => {
    expect(eventWhen(hearing)).toEqual({
      date: "Thu, Oct 8, 2026",
      time: "10:00 AM EDT",
      warning: "The source does not report whether this start time is exact.",
    });
    expect(eventWhen({ ...hearing, scheduledStart: null })).toEqual({
      date: "Thu, Oct 8, 2026",
      time: "Time not supplied",
      warning: undefined,
    });
  });
  it("never turns invalid dates, unknown zones or date-only precision into an exact time", () => {
    expect(
      eventWhen({
        ...hearing,
        calendarDate: "2026-02-30",
        timeZone: "Not/AZone",
      }),
    ).toMatchObject({
      date: "Calendar date unavailable",
      time: "Time not supplied",
    });
    expect(eventWhen({ ...hearing, timeZone: null }).warning).toContain(
      "no time has been inferred",
    );
    expect(eventWhen({ ...hearing, timePrecision: "date" }).time).toBe(
      "Date only · time not supplied",
    );
  });
  it("surfaces a changed source-local day rather than overwriting the calendar date", () => {
    const result = eventWhen({
      ...hearing,
      scheduledStart: "2026-10-09T05:00:00Z",
    });
    expect(result.date).toBe("Thu, Oct 8, 2026");
    expect(result.time).toBe("2026-10-09 · 1:00 AM EDT");
    expect(result.warning).toContain("different source-local days");
  });
  it("does not describe scheduled attendance as scheduled transcription", () => {
    expect(attendanceLabel("SCHEDULED")).toBe("Attendance scheduled");
    expect(attendanceLabel("BROWSER_ONLY")).toBe("Browser attendance only");
    expect(attendanceLabel("COMPLETE")).toBe("Transcript available");
    expect(publicEventHref("https://os.example.test/", "cm-119-one/two")).toBe(
      "https://os.example.test/legiwatch/hearings/cm-119-one%2Ftwo",
    );
    expect(publicEventHref(undefined, eventId)).toBeUndefined();
  });
});
