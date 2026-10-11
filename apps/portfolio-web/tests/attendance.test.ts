import { describe, expect, it, vi } from "vitest";
import { createApiClient, ApiError } from "../src/shared/api/http";
import { meetingSchema } from "../src/features/calendar/contracts";
import {
  AttendanceConflict,
  AttendanceUncertain,
  changePreference,
  readPreference,
  readSession,
  removeMeri,
  sendMeri,
} from "../src/features/calendar/attendance/api";
import {
  botSessionSchema,
  consentCopy,
  dispatchSchema,
  progressing,
  sessionLabel,
} from "../src/features/calendar/attendance/contracts";
const meetingId = "90000000-0000-4000-8000-000000000001",
  clientId = "10000000-0000-4000-8000-000000000001",
  id = "95000000-0000-4000-8000-000000000001",
  otherId = "95000000-0000-4000-8000-000000000002";
const meeting = meetingSchema.parse({
  id: meetingId,
  subject: "Synthetic attendance",
  description: null,
  location: null,
  startsAt: "2026-10-20T15:00:00Z",
  endsAt: "2026-10-20T16:00:00Z",
  status: "scheduled",
  joinLink: "https://meet.google.com/synthetic",
  visibility: "private",
  isVirtual: true,
  meri: null,
  client: { id: clientId, name: "Synthetic" },
  attendees: [],
  preps: [],
});
const session = botSessionSchema.parse({
  id,
  meetingId,
  clientId,
  provider: "recall",
  platform: "meet",
  status: "joining",
  recordingPolicy: "transcript_only",
  error: null,
  startedAt: "2026-10-20T14:59:00Z",
  endedAt: null,
  createdAt: "2026-10-20T14:59:00Z",
  updatedAt: "2026-10-20T14:59:00Z",
});
const consent = {
  authorizedToRecord: true,
  allPartiesWillBeNotified: true,
} as const;
const input = { ...consent, meetingUrl: meeting.joinLink! };
const off = { enabled: false, stopping: false },
  on = { enabled: true, stopping: false };
const now = Date.parse("2026-10-11T12:00:00Z");
function client(...responses: unknown[]) {
  const fetcher = vi.fn<typeof fetch>();
  for (const response of responses)
    fetcher.mockResolvedValueOnce(Response.json(response));
  return { api: createApiClient(fetcher), fetcher };
}
describe("canonical notetaker reads and status semantics", () => {
  it("discloses notes-first approved persistence and the best-effort approved debrief without promising a review gate", () => {
    expect(consentCopy.intro).toContain(
      "private Meeting Notes for review, saved as approved",
    );
    expect(consentCopy.intro).toContain("attempts an approved Debrief");
    expect(consentCopy.intro).toContain(
      "Debrief creation can fail independently",
    );
    expect(consentCopy.intro).toContain("not automatically shared or emailed");
    expect(consentCopy.intro).not.toContain(
      "separate generation and review action",
    );
  });
  it("reads nullable latest owned meeting session with cancellation and rejects foreign receipts", async () => {
    const signal = new AbortController().signal;
    const { api, fetcher } = client(null);
    expect(await readSession(api, meetingId, signal)).toBeNull();
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(signal);
    await expect(
      readSession(client({ ...session, meetingId: otherId }).api, meetingId),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("preserves Off/stopping and rejects inconsistent preference rather than claiming removal", async () => {
    expect(
      await readPreference(
        client({ enabled: false, stopping: true }).api,
        clientId,
      ),
    ).toEqual({ enabled: false, stopping: true });
    await expect(
      readPreference(client({ enabled: true, stopping: true }).api, clientId),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("does not label a scheduled join as attendance or a completed session as an automatic debrief", () => {
    expect(sessionLabel(session)).toContain("attendance not yet confirmed");
    expect(sessionLabel({ ...session, status: "drafting" })).toContain(
      "meeting notes",
    );
    expect(sessionLabel({ ...session, status: "done" })).toBe("Completed");
    expect(progressing({ ...session, status: "processing" })).toBe(true);
    expect(progressing({ ...session, status: "removed" })).toBe(false);
  });
  it("requires both affirmations, trims URL and refuses credentials/unsupported protocols", () => {
    expect(
      dispatchSchema.parse({ ...input, meetingUrl: `  ${input.meetingUrl}  ` })
        .meetingUrl,
    ).toBe(input.meetingUrl);
    for (const invalid of [
      { ...input, authorizedToRecord: false },
      { ...input, allPartiesWillBeNotified: false },
      { ...input, meetingUrl: "javascript:alert(1)" },
      { ...input, meetingUrl: "https://user:pass@meet.google.com/test" },
    ])
      expect(dispatchSchema.safeParse(invalid).success).toBe(false);
  });
});
describe("explicit send preflight and receipt", () => {
  it("sends only reviewed consent/URL/transcript policy and future join time after ownership/session reads", async () => {
    const { api, fetcher } = client(meeting, null, session),
      guard = vi.fn();
    await expect(sendMeri(api, meeting, input, guard, now)).resolves.toEqual(
      session,
    );
    expect(guard).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual([
      "GET",
      "GET",
      "POST",
    ]);
    expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toEqual({
      ...input,
      recordingPolicy: "transcript_only",
      joinAt: meeting.startsAt,
    });
  });
  it("requests immediate join without a stale joinAt once the meeting has started", async () => {
    const { api, fetcher } = client(meeting, null, session);
    await sendMeri(
      api,
      meeting,
      input,
      () => {},
      Date.parse(meeting.startsAt) + 1,
    );
    expect(
      JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body)),
    ).not.toHaveProperty("joinAt");
  });
  it("refuses changed meeting, cancelled meeting and existing active/processing session without POST", async () => {
    for (const changed of [
      { ...meeting, client: null },
      { ...meeting, startsAt: "2026-10-21T15:00:00Z" },
      { ...meeting, joinLink: "https://zoom.us/j/other" },
    ]) {
      const { api, fetcher } = client(changed);
      await expect(
        sendMeri(api, meeting, input, () => {}, now),
      ).rejects.toBeInstanceOf(AttendanceConflict);
      expect(fetcher).toHaveBeenCalledOnce();
    }
    const cancelled = { ...meeting, status: "cancelled" };
    await expect(
      sendMeri(client(cancelled).api, cancelled, input, () => {}, now),
    ).rejects.toMatchObject({ status: 422 });
    for (const status of ["joining", "processing", "drafting"]) {
      const { api, fetcher } = client(meeting, { ...session, status });
      await expect(
        sendMeri(api, meeting, input, () => {}, now),
      ).rejects.toBeInstanceOf(AttendanceConflict);
      expect(fetcher).toHaveBeenCalledTimes(2);
    }
  });
  it("rechecks current actor/runtime after awaited preflight before POST", async () => {
    const { api, fetcher } = client(meeting, null);
    await expect(
      sendMeri(
        api,
        meeting,
        input,
        () => {
          throw new ApiError(409, "Scope changed");
        },
        now,
      ),
    ).rejects.toThrow("Scope changed");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("wrong successful meeting/client receipts are uncertain, with no automatic resend", async () => {
    for (const invalid of [
      { ...session, meetingId: otherId },
      { ...session, clientId: null },
    ]) {
      const { api, fetcher } = client(meeting, null, invalid);
      await expect(
        sendMeri(api, meeting, input, () => {}, now),
      ).rejects.toBeInstanceOf(AttendanceUncertain);
      expect(fetcher).toHaveBeenCalledTimes(3);
    }
  });
  it("lost POST reply is uncertain while rejected/failed preflight retains its actual error", async () => {
    const { api, fetcher } = client(meeting, null);
    fetcher.mockRejectedValueOnce(new TypeError("lost reply"));
    await expect(
      sendMeri(api, meeting, input, () => {}, now),
    ).rejects.toBeInstanceOf(AttendanceUncertain);
    expect(fetcher).toHaveBeenCalledTimes(3);
    const failed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ message: "Not owned" }, { status: 404 }),
      );
    await expect(
      sendMeri(createApiClient(failed), meeting, input, () => {}, now),
    ).rejects.toMatchObject({ status: 404, message: "Not owned" });
    expect(failed).toHaveBeenCalledOnce();
  });
});
describe("removal and client standing preference", () => {
  it("refuses removal of a changed/latest session before DELETE", async () => {
    const { api, fetcher } = client({ ...session, id: otherId });
    await expect(
      removeMeri(api, meetingId, session, () => {}),
    ).rejects.toBeInstanceOf(AttendanceConflict);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("accepts matching actual removal/processing status without fabricating a cancellation", async () => {
    for (const status of ["removed", "processing"] as const) {
      const { api, fetcher } = client(session, { ...session, status });
      expect((await removeMeri(api, meetingId, session, () => {})).status).toBe(
        status,
      );
      expect(fetcher.mock.calls[1]?.[1]?.method).toBe("DELETE");
    }
  });
  it("rejects mismatched/active successful removal receipts as uncertain", async () => {
    for (const invalid of [
      { ...session, id: otherId, status: "removed" },
      { ...session, meetingId: otherId, status: "removed" },
      session,
    ])
      await expect(
        removeMeri(client(session, invalid).api, meetingId, session, () => {}),
      ).rejects.toBeInstanceOf(AttendanceUncertain);
  });
  it("surfaces in-flight dispatch removal refusal and does not retry DELETE", async () => {
    const { api, fetcher } = client(session);
    fetcher.mockResolvedValueOnce(
      Response.json(
        {
          message:
            "The notetaker is still being dispatched — try again in a moment",
        },
        { status: 400 },
      ),
    );
    await expect(
      removeMeri(api, meetingId, session, () => {}),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("enables only explicit standing consent and preserves actual Off/stopping receipt", async () => {
    const enable = client(off, on);
    expect(
      await changePreference(
        enable.api,
        clientId,
        off,
        true,
        consent,
        () => {},
      ),
    ).toEqual(on);
    expect(JSON.parse(String(enable.fetcher.mock.calls[1]?.[1]?.body))).toEqual(
      consent,
    );
    const disable = client(on, { enabled: false, stopping: true });
    expect(
      await changePreference(
        disable.api,
        clientId,
        on,
        false,
        undefined,
        () => {},
      ),
    ).toEqual({ enabled: false, stopping: true });
    expect(disable.fetcher.mock.calls[1]?.[1]?.method).toBe("DELETE");
    expect(disable.fetcher.mock.calls[1]?.[1]?.body).toBeUndefined();
  });
  it("retries stopping with DELETE and never enables while still stopping", async () => {
    const stopping = { enabled: false, stopping: true };
    const retry = client(stopping, off);
    expect(
      await changePreference(
        retry.api,
        clientId,
        stopping,
        false,
        undefined,
        () => {},
      ),
    ).toEqual(off);
    expect(retry.fetcher.mock.calls[1]?.[1]?.method).toBe("DELETE");
    const enable = client(stopping);
    await expect(
      changePreference(enable.api, clientId, stopping, true, consent, () => {}),
    ).rejects.toMatchObject({ status: 409 });
    expect(enable.fetcher).toHaveBeenCalledOnce();
  });
  it("blocks stale preference, false receipt and changed-scope dispatch", async () => {
    const stale = client(on);
    await expect(
      changePreference(stale.api, clientId, off, true, consent, () => {}),
    ).rejects.toBeInstanceOf(AttendanceConflict);
    expect(stale.fetcher).toHaveBeenCalledOnce();
    await expect(
      changePreference(
        client(off, off).api,
        clientId,
        off,
        true,
        consent,
        () => {},
      ),
    ).rejects.toBeInstanceOf(AttendanceUncertain);
    const scope = client(off);
    await expect(
      changePreference(scope.api, clientId, off, true, consent, () => {
        throw new ApiError(409, "Actor changed");
      }),
    ).rejects.toThrow("Actor changed");
    expect(scope.fetcher).toHaveBeenCalledOnce();
  });
});
