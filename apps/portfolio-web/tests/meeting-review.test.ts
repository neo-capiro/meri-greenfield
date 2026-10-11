import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "../src/shared/api/http";
import {
  approveReviewedAttachment,
  AttachmentApprovalError,
  readMeetingAttachments,
  readSavedNotes,
  revalidateSavedNote,
} from "../src/features/calendar/review/api";
import {
  canReviewAttachment,
  reviewKey,
} from "../src/features/calendar/review/contracts";

const actor = { userId: "user-test", tenantId: "tenant-test" };
const meeting = {
  id: "meeting-test",
  client: { id: "client-test", name: "Synthetic" },
  subject: "Staff call",
  description: null,
  location: null,
  startsAt: "2026-10-11T12:00:00Z",
  endsAt: "2026-10-11T13:00:00Z",
  status: "scheduled",
  joinLink: null,
  visibility: "private",
  isVirtual: false,
  meri: "done",
  attendees: [],
  preps: [],
};
const note = {
  id: "note-test",
  meetingId: meeting.id,
  clientId: meeting.client.id,
  body: "Reviewed the public briefing.\nFollow up with staff.",
  restricted: false,
  confidential: true,
  authorUserId: actor.userId,
  createdAt: "2026-10-11T12:00:00Z",
  updatedAt: "2026-10-11T12:00:00Z",
};
const file = {
  id: "70000000-0000-4000-8000-000000000001",
  tenantId: actor.tenantId,
  meetingId: meeting.id,
  clientId: meeting.client.id,
  s3Key: "synthetic/key",
  fileName: "Briefing.pdf",
  contentType: "application/pdf",
  byteSize: 1000,
  source: "meeting",
  folder: null,
  viewerMode: "all" as const,
  viewerUserIds: [],
  uploadedByUserId: actor.userId,
  createdAt: "2026-10-11T12:00:00Z",
  lifecycleStatus: "ready",
  scanStatus: "clean",
  extractionStatus: null,
  indexedAt: null,
  supersededByAttachmentId: null,
  approvedAt: null,
  approvedByUserId: null,
  usable: true,
};
const receipt = {
  ...file,
  approvedAt: "2026-10-11T12:05:00Z",
  approvedByUserId: actor.userId,
};
function transport(
  options: {
    meeting?: unknown;
    notes?: unknown;
    files?: unknown;
    receipt?: unknown;
    status?: number;
    lost?: boolean;
  } = {},
) {
  const calls: { path: string; method: string; body?: unknown }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const method = init?.method ?? "GET";
    calls.push({
      path: String(url),
      method,
      ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
    });
    if (method === "POST" && options.lost) throw new TypeError("Lost reply");
    const value =
      method === "POST"
        ? (options.receipt ?? receipt)
        : String(url).endsWith("/notes")
          ? (options.notes ?? [note])
          : String(url).includes("attachments?")
            ? (options.files ?? [file])
            : (options.meeting ?? meeting);
    return new Response(JSON.stringify(value), {
      status: method === "POST" ? (options.status ?? 200) : 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { api: createApiClient(fetcher), calls };
}
describe("saved meeting notes source review", () => {
  it("uses exact parent routes and returns unchanged text with supported manual method", async () => {
    const { api, calls } = transport();
    expect(await revalidateSavedNote(api, meeting, note, () => {})).toEqual({
      text: note.body,
      method: "manual",
    });
    expect(calls).toEqual([
      {
        path: "/api/backend/core/engagement/meetings/meeting-test",
        method: "GET",
      },
      {
        path: "/api/backend/core/engagement/meetings/meeting-test/notes",
        method: "GET",
      },
    ]);
  });
  it.each([
    ["changed text", { ...note, body: "Changed" }],
    ["changed timestamp", { ...note, updatedAt: "2026-10-11T12:01:00Z" }],
    ["revoked access", { ...note, body: null, restricted: true }],
    ["confidentiality change", { ...note, confidential: false }],
    ["different author", { ...note, authorUserId: "other" }],
    ["empty source", { ...note, body: "  " }],
    ["removed", { ...note, id: "other-note" }],
  ])(
    "refuses %s without any generation or persistence request",
    async (_label, current) => {
      const { api, calls } = transport({ notes: [current] });
      await expect(
        revalidateSavedNote(api, meeting, note, () => {}),
      ).rejects.toThrow();
      expect(calls.every((call) => call.method === "GET")).toBe(true);
    },
  );
  it.each([
    ["meeting", { ...note, meetingId: "foreign" }],
    ["client", { ...note, clientId: "foreign" }],
  ])("rejects a mismatched note %s receipt", async (_label, current) => {
    const { api } = transport({ notes: [current] });
    await expect(readSavedNotes(api, meeting)).rejects.toMatchObject({
      status: 502,
    });
  });
  it("rejects duplicate note IDs and wrong meeting before source reads", async () => {
    const duplicate = transport({ notes: [note, note] });
    await expect(readSavedNotes(duplicate.api, meeting)).rejects.toMatchObject({
      status: 502,
    });
    const wrong = transport({ meeting: { ...meeting, id: "other" } });
    await expect(readSavedNotes(wrong.api, meeting)).rejects.toMatchObject({
      status: 502,
    });
    expect(wrong.calls).toHaveLength(1);
  });
  it("rechecks current authority after held note reads before handing off text", async () => {
    const { api, calls } = transport();
    const guard = vi
      .fn()
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new ApiError(403, "Revoked");
      });
    await expect(
      revalidateSavedNote(api, meeting, note, guard),
    ).rejects.toThrow("Revoked");
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });
});
describe("meeting attachment review approval", () => {
  it("preflights meeting and current file, then records approval with no body or provider route", async () => {
    const { api, calls } = transport();
    const result = await approveReviewedAttachment(
      api,
      meeting,
      actor,
      file,
      () => {},
    );
    expect(result).toMatchObject({
      id: file.id,
      tenantId: actor.tenantId,
      meetingId: meeting.id,
      approvedAt: receipt.approvedAt,
      approvedByUserId: actor.userId,
    });
    expect(result).not.toHaveProperty("usable");
    expect(calls).toEqual([
      {
        path: "/api/backend/core/engagement/meetings/meeting-test",
        method: "GET",
      },
      {
        path: "/api/backend/core/engagement/attachments?meetingId=meeting-test",
        method: "GET",
      },
      {
        path: `/api/backend/core/engagement/meetings/meeting-test/attachments/${file.id}/approve`,
        method: "POST",
      },
    ]);
  });
  it.each([
    ["missing", []],
    ["blocked", [{ ...file, usable: false }]],
    ["replaced bytes", [{ ...file, s3Key: "replacement/key" }]],
    ["already approved", [receipt]],
    [
      "changed viewer settings",
      [{ ...file, viewerMode: "restricted", viewerUserIds: [actor.userId] }],
    ],
  ])("does not POST for %s preflight", async (_label, files) => {
    const { api, calls } = transport({ files });
    await expect(
      approveReviewedAttachment(api, meeting, actor, file, () => {}),
    ).rejects.toMatchObject({ uncertain: false });
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
  });
  it.each([
    ["foreign tenant", { ...file, tenantId: "foreign" }],
    ["foreign meeting", { ...file, meetingId: "foreign" }],
    ["foreign client", { ...file, clientId: "foreign" }],
    ["superseded", { ...file, supersededByAttachmentId: "new-version" }],
    [
      "nonviewer",
      {
        ...file,
        viewerMode: "restricted",
        viewerUserIds: [],
        uploadedByUserId: "other",
      },
    ],
  ])("rejects %s list and performs zero writes", async (_label, current) => {
    const { api, calls } = transport({ files: [current] });
    await expect(
      approveReviewedAttachment(api, meeting, actor, file, () => {}),
    ).rejects.toMatchObject({ uncertain: false });
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });
  it.each([
    [
      "wrong attachment",
      { ...receipt, id: "70000000-0000-4000-8000-000000000002" },
    ],
    ["wrong actor", { ...receipt, approvedByUserId: "other" }],
    ["wrong tenant", { ...receipt, tenantId: "other" }],
    ["false approval", { ...receipt, approvedAt: null }],
    ["changed content", { ...receipt, s3Key: "different" }],
  ])("treats %s successful receipt as uncertain", async (_label, current) => {
    const { api, calls } = transport({ receipt: current });
    await expect(
      approveReviewedAttachment(api, meeting, actor, file, () => {}),
    ).rejects.toMatchObject({ uncertain: true });
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });
  it.each([401, 403, 404, 409, 422])(
    "classifies actual HTTP%d refusal as known without retry",
    async (status) => {
      const { api, calls } = transport({
        status,
        receipt: { message: "Refused" },
      });
      await expect(
        approveReviewedAttachment(api, meeting, actor, file, () => {}),
      ).rejects.toMatchObject({ uncertain: false });
      expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
    },
  );
  it("distinguishes post-dispatch local authority loss from an HTTP refusal", async () => {
    const { api, calls } = transport();
    const guard = vi.fn().mockImplementation(() => {
      if (guard.mock.calls.length === 4)
        throw new ApiError(403, "Session changed");
    });
    await expect(
      approveReviewedAttachment(api, meeting, actor, file, guard),
    ).rejects.toBeInstanceOf(AttachmentApprovalError);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
    const second = transport();
    const late = vi.fn().mockImplementation(() => {
      if (late.mock.calls.length === 4)
        throw new ApiError(403, "Session changed");
    });
    await expect(
      approveReviewedAttachment(second.api, meeting, actor, file, late),
    ).rejects.toMatchObject({ uncertain: true });
  });
  it("refuses stale authority before POST and freezes a lost response after POST", async () => {
    const before = transport();
    const guard = vi.fn().mockImplementation(() => {
      if (guard.mock.calls.length === 2) throw new ApiError(409, "Changed");
    });
    await expect(
      approveReviewedAttachment(before.api, meeting, actor, file, guard),
    ).rejects.toMatchObject({ uncertain: false });
    expect(before.calls.every((call) => call.method === "GET")).toBe(true);
    const lost = transport({ lost: true });
    await expect(
      approveReviewedAttachment(lost.api, meeting, actor, file, () => {}),
    ).rejects.toMatchObject({ uncertain: true });
    expect(lost.calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });
  it("does not grant administrators a local viewer bypass; uploader and explicit viewers match canonical policy", () => {
    expect(
      canReviewAttachment(
        { ...file, viewerMode: "restricted", uploadedByUserId: "other" },
        actor.userId,
      ),
    ).toBe(false);
    expect(
      canReviewAttachment({ ...file, viewerMode: "restricted" }, actor.userId),
    ).toBe(true);
    expect(
      canReviewAttachment(
        {
          ...file,
          viewerMode: "restricted",
          uploadedByUserId: "other",
          viewerUserIds: [actor.userId],
        },
        actor.userId,
      ),
    ).toBe(true);
  });
  it("keys private review data by actor, tenant, meeting and current association", () => {
    expect(reviewKey("notes", meeting, actor)).toEqual([
      "meeting-review",
      "notes",
      actor.tenantId,
      actor.userId,
      meeting.id,
      meeting.client.id,
    ]);
    expect(
      reviewKey("attachments", { ...meeting, client: null }, actor),
    ).not.toEqual(reviewKey("attachments", meeting, actor));
  });
  it("rejects duplicate file IDs", async () => {
    const { api } = transport({ files: [file, file] });
    await expect(
      readMeetingAttachments(api, meeting, actor),
    ).rejects.toMatchObject({ status: 502 });
  });
});
