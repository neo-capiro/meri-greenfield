import { describe, expect, it } from "vitest";
import { createApiClient, ApiError } from "../src/shared/api/http";
import { preparationSchema } from "../src/features/calendar/preparation/schema";
import {
  attachmentCompatibility,
  assertExportable,
  preparationSnapshot,
} from "../src/features/calendar/documents/contracts";
import {
  preparePdfAttachment,
  readSavedDocument,
} from "../src/features/calendar/documents/api";
import { printMeetingDocument } from "../src/features/calendar/documents/print";
import { savedDocumentKey } from "../src/features/calendar/documents/useSavedDocument";

const id = "20000000-0000-4000-8000-000000000001";
const prep = preparationSchema.parse({
  id,
  meetingId: "meeting-1",
  clientId: "client-1",
  summary: "Saved summary",
  agenda: ["Agenda"],
  talkingPoints: [],
  risks: [],
  followUps: [],
  emailEvidence: [],
  status: "draft",
  createdAt: "2026-10-11T00:00:00Z",
});
const meeting = {
  id: "meeting-1",
  subject: "Saved meeting",
  client: { id: "client-1", name: "Synthetic client" },
};
const fullMeeting = {
  ...meeting,
  description: null,
  location: null,
  startsAt: "2026-10-11T00:00:00Z",
  endsAt: "2026-10-11T01:00:00Z",
  status: "scheduled",
  joinLink: null,
  visibility: "private",
  isVirtual: false,
  meri: null,
  attendees: [],
  preps: [prep],
};
function setup(
  options: {
    meeting?: unknown;
    status?: number;
    receipt?: unknown;
    beforeRead?: () => void;
    afterPost?: () => void;
  } = {},
) {
  const calls: { path: string; method: string }[] = [];
  const api = createApiClient(async (url, request) => {
    calls.push({ path: String(url), method: request?.method ?? "GET" });
    if (request?.method === "POST") {
      options.afterPost?.();
      return Response.json(options.receipt ?? { id, fileName: "Prep.pdf" }, {
        status: options.status ?? 200,
      });
    }
    options.beforeRead?.();
    return Response.json(options.meeting ?? fullMeeting);
  });
  return { api, calls };
}
describe("saved meeting document contracts", () => {
  it("keys canonical saved documents by both tenant and actor", () => {
    const document = { kind: "preparation" as const, preparation: prep };
    const first = savedDocumentKey(meeting, document, {
      tenantId: "tenant-a",
      userId: "actor-a",
    });
    expect(first).not.toEqual(
      savedDocumentKey(meeting, document, {
        tenantId: "tenant-a",
        userId: "actor-b",
      }),
    );
    expect(first).not.toEqual(
      savedDocumentKey(meeting, document, {
        tenantId: "tenant-b",
        userId: "actor-a",
      }),
    );
  });
  it("reads canonical saved preparation, not an unsaved caller draft", async () => {
    const { api } = setup();
    const result = await readSavedDocument(api, meeting, {
      kind: "preparation",
      preparation: { ...prep, summary: "Unsaved" },
    });
    expect(result.document).toMatchObject({
      preparation: { summary: "Saved summary" },
    });
  });
  it.each([
    { id: "wrong-meeting" },
    { client: { id: "wrong-client", name: "Other" } },
    { preps: [] },
  ])(
    "refuses missing or wrong meeting/client/preparation %j",
    async (change) => {
      const { api, calls } = setup({ meeting: { ...fullMeeting, ...change } });
      await expect(
        preparePdfAttachment(api, meeting, prep, () => {}),
      ).rejects.toMatchObject({ uncertain: false });
      expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
    },
  );
  it("refuses a changed saved revision before POST", async () => {
    const { api, calls } = setup({
      meeting: { ...fullMeeting, preps: [{ ...prep, summary: "Changed" }] },
    });
    await expect(
      preparePdfAttachment(api, meeting, prep, () => {}),
    ).rejects.toMatchObject({
      uncertain: false,
      message: expect.stringContaining("changed"),
    });
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
  });
  it("rechecks actor after awaited preflight and dispatches zero POST on change", async () => {
    let actor = "a";
    const { api, calls } = setup({
      beforeRead: () => {
        actor = "b";
      },
    });
    await expect(
      preparePdfAttachment(api, meeting, prep, () => {
        if (actor !== "a") throw new ApiError(409, "Actor changed");
      }),
    ).rejects.toMatchObject({ uncertain: false });
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
  });
  it("returns only a verified stored PDF receipt on success", async () => {
    const { api, calls } = setup();
    await expect(
      preparePdfAttachment(api, meeting, prep, () => {}),
    ).resolves.toEqual({ id, fileName: "Prep.pdf" });
    expect(calls).toEqual([
      {
        path: "/api/backend/core/engagement/meetings/meeting-1",
        method: "GET",
      },
      {
        path: `/api/backend/core/engagement/meeting-preps/${id}/pdf-attachment`,
        method: "POST",
      },
    ]);
  });
  it.each([400, 404, 409, 500, 503])(
    "freezes provider/storage completion ambiguity on POST %i",
    async (status) => {
      const { api, calls } = setup({ status });
      await expect(
        preparePdfAttachment(api, meeting, prep, () => {}),
      ).rejects.toMatchObject({ uncertain: true });
      expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
    },
  );
  it.each([401, 403])(
    "preserves explicit guard refusal on POST %i",
    async (status) => {
      const { api } = setup({ status });
      await expect(
        preparePdfAttachment(api, meeting, prep, () => {}),
      ).rejects.toMatchObject({ uncertain: false });
    },
  );
  it("malformed receipt is uncertain, never a successful attachment", async () => {
    const { api } = setup({ receipt: { id, fileName: "not-pdf.txt" } });
    await expect(
      preparePdfAttachment(api, meeting, prep, () => {}),
    ).rejects.toMatchObject({ uncertain: true });
  });
  it("actor change after POST refuses its receipt and freezes the attempt", async () => {
    let active = true;
    const { api } = setup({
      afterPost: () => {
        active = false;
      },
    });
    await expect(
      preparePdfAttachment(api, meeting, prep, () => {
        if (!active) throw new Error("Session changed");
      }),
    ).rejects.toMatchObject({ uncertain: true });
  });
  it("semantic snapshot is independent of object-key order", () => {
    expect(preparationSnapshot(prep)).toBe(
      preparationSnapshot({
        createdAt: prep.createdAt,
        status: prep.status,
        emailEvidence: prep.emailEvidence,
        followUps: prep.followUps,
        risks: prep.risks,
        talkingPoints: prep.talkingPoints,
        agenda: prep.agenda,
        summary: prep.summary,
        clientId: prep.clientId,
        meetingId: prep.meetingId,
        id: prep.id,
      }),
    );
    expect(preparationSnapshot({ ...prep, agenda: ["A", "B"] })).not.toBe(
      preparationSnapshot({ ...prep, agenda: ["B", "A"] }),
    );
  });
});
describe("truthful source fidelity and restrictions", () => {
  it("refuses server replacement of Unicode in the meeting title", () => {
    expect(attachmentCompatibility(prep, "東京 briefing")).toContain(
      "preserve Unicode",
    );
  });
  it("refuses a changed meeting title before creating the reviewed attachment", async () => {
    const { api, calls } = setup({
      meeting: { ...fullMeeting, subject: "New title" },
    });
    await expect(
      preparePdfAttachment(api, meeting, prep, () => {}),
    ).rejects.toMatchObject({
      uncertain: false,
      message: expect.stringContaining("title changed"),
    });
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
  });
  it("ordinary string-only saved preparation is eligible", () =>
    expect(attachmentCompatibility(prep)).toBeNull());
  it.each(["agenda", "talkingPoints", "risks", "followUps"] as const)(
    "refuses server omission of structured %s",
    (key) => {
      expect(
        attachmentCompatibility({
          ...prep,
          [key]: [{ text: "Preserve this", factIds: [] }],
        }),
      ).toContain("omits structured");
    },
  );
  it("refuses omitted structured email evidence", () =>
    expect(
      attachmentCompatibility({
        ...prep,
        emailEvidence: [
          {
            summary: "Evidence",
            sourceId: "source",
            sourceUrl: "https://example.test",
          },
        ],
      }),
    ).toContain("omits structured"));
  it("refuses Unicode server replacement without restricting local export", () => {
    const value = { ...prep, summary: "東京 — résumé 🚀" };
    expect(attachmentCompatibility(value)).toContain("preserve Unicode");
    expect(() =>
      assertExportable({ kind: "preparation", preparation: value }),
    ).not.toThrow();
  });
  it("refuses governed institutional preparation", () => {
    const value = {
      ...prep,
      generatedFrom: { schemaVersion: "research_portfolio_institutional_v1" },
    };
    expect(() =>
      assertExportable({ kind: "preparation", preparation: value }),
    ).toThrow("governed");
  });
  it.each([
    { restricted: true, confidential: false },
    { restricted: false, confidential: true },
  ])("refuses restricted/confidential debrief %j", (flags) => {
    expect(() =>
      assertExportable({
        kind: "debrief",
        debrief: {
          id,
          body: "Restricted",
          ...flags,
          createdAt: "now",
          updatedAt: "now",
        },
      }),
    ).toThrow("cannot be exported");
  });
  it("safe server import does not allocate browser; popup refusal surfaces synchronously", () => {
    expect(() =>
      printMeetingDocument({} as HTMLElement, "Saved", { open: () => null }),
    ).toThrow("Allow pop-ups");
  });
});
