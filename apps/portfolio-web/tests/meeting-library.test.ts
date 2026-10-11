import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import { meetingSchema } from "../src/features/calendar/contracts";
import {
  assignMeeting,
  AssignmentConflict,
  extractMeetingSource,
  readLibrary,
} from "../src/features/calendar/library/api";
import {
  libraryBounds,
  libraryFiltersSchema,
  materialsLabel,
  readLibraryFilters,
} from "../src/features/calendar/library/contracts";
const id = "90000000-0000-4000-8000-000000000001";
const clientId = "10000000-0000-4000-8000-000000000001";
const otherId = "10000000-0000-4000-8000-000000000002";
const meeting = meetingSchema.parse({
  id,
  subject: "Synthetic meeting",
  description: null,
  location: null,
  startsAt: "2026-10-15T14:00:00Z",
  endsAt: "2026-10-15T15:00:00Z",
  status: "scheduled",
  joinLink: null,
  visibility: "shared",
  isVirtual: false,
  meri: null,
  client: { id: clientId, name: "Synthetic client" },
  attendees: [],
  preps: [],
});
const row = {
  id,
  subject: meeting.subject,
  startsAt: meeting.startsAt,
  visibility: "private" as const,
  client: meeting.client,
  libraryQualifiedBy: [
    { kind: "prep" as const, current: false },
    { kind: "notes" as const, current: true },
  ],
};
const filters = libraryFiltersSchema.parse({});
describe("verified meeting library boundary", () => {
  it("uses inclusive civil dates and exclusive zoned end across DST", () => {
    expect(
      libraryBounds(
        { ...filters, from: "2026-11-01", to: "2026-11-01" },
        "America/New_York",
      ),
    ).toEqual({ from: "2026-11-01T04:00:00Z", to: "2026-11-02T05:00:00Z" });
  });
  it("rejects invalid date, reverse range and invalid deep-linked filters", () => {
    for (const params of [
      "libraryFrom=2026-02-30",
      "libraryFrom=2026-10-20&libraryTo=2026-10-01",
      "libraryType=all",
      "libraryPage=-1",
    ])
      expect(readLibraryFilters(new URLSearchParams(params)).success).toBe(
        false,
      );
  });
  it("sends server filters/page and preserves cancellation", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: [row], page: 2, limit: 50, total: 51 }),
      );
    const signal = new AbortController().signal;
    await readLibrary(
      createApiClient(request),
      {
        ...filters,
        page: 2,
        search: "Synthetic & client",
        artifactType: "prep",
        visibility: "private",
      },
      "UTC",
      clientId,
      signal,
    );
    expect(
      Object.fromEntries(
        new URL(String(request.mock.calls[0]?.[0]), "http://localhost")
          .searchParams,
      ),
    ).toEqual({
      clientId,
      search: "Synthetic & client",
      artifactType: "prep",
      visibility: "private",
      page: "2",
      limit: "50",
    });
    expect(request.mock.calls[0]?.[1]?.signal).toBe(signal);
  });
  it("fails closed for wrong client/page, duplicate rows and missing qualification", async () => {
    for (const receipt of [
      {
        data: [{ ...row, client: { id: otherId, name: "Other" } }],
        page: 1,
        limit: 50,
        total: 1,
      },
      { data: [row], page: 2, limit: 50, total: 1 },
      { data: [row, row], page: 1, limit: 50, total: 2 },
      {
        data: [{ ...row, libraryQualifiedBy: [] }],
        page: 1,
        limit: 50,
        total: 1,
      },
    ])
      await expect(
        readLibrary(
          createApiClient(async () => Response.json(receipt)),
          filters,
          "UTC",
          clientId,
        ),
      ).rejects.toMatchObject({ status: 502 });
  });
  it("distinguishes historical qualification from current approval", () => {
    expect(materialsLabel(row)).toBe("Previously approved · Prep · Notes");
  });
});
describe("client assignment boundary", () => {
  it("rechecks the dispatch gate after the preflight before issuing PUT", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(meeting));
    const guard = vi.fn(() => {
      throw new Error("scope changed");
    });
    await expect(
      assignMeeting(createApiClient(request), meeting, null, guard),
    ).rejects.toThrow("scope changed");
    expect(guard).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[1]?.method).toBe("GET");
  });
  it("refuses stale preflight and performs no PUT", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ ...meeting, client: { id: otherId, name: "Changed" } }),
      );
    await expect(
      assignMeeting(createApiClient(request), meeting, null),
    ).rejects.toBeInstanceOf(AssignmentConflict);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("sends only client association and requires a private matching receipt", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(meeting))
      .mockResolvedValueOnce(
        Response.json({ ...meeting, client: null, visibility: "private" }),
      );
    await expect(
      assignMeeting(createApiClient(request), meeting, null),
    ).resolves.toMatchObject({ id, client: null, visibility: "private" });
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ clientId: null }),
    });
  });
  it("rejects mismatched identity/client or missing sharing revocation", async () => {
    for (const receipt of [
      { ...meeting, id: otherId, client: null, visibility: "private" },
      { ...meeting, visibility: "private" },
      { ...meeting, client: null },
    ]) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(meeting))
        .mockResolvedValueOnce(Response.json(receipt));
      await expect(
        assignMeeting(createApiClient(request), meeting, null),
      ).rejects.toMatchObject({ status: 502 });
      expect(request).toHaveBeenCalledTimes(2);
    }
  });
  it("propagates ownership denial without a write", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ message: "Meeting not found" }, { status: 404 }),
      );
    await expect(
      assignMeeting(createApiClient(request), meeting, null),
    ).rejects.toMatchObject({ status: 404 });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
describe("runtime-gated extraction", () => {
  it("accepts the audio transcription contract without inventing completeness", async () => {
    const source = await extractMeetingSource(
      createApiClient(async () =>
        Response.json({
          attachmentId: id,
          fileName: "synthetic-memo.webm",
          contentType: "audio/webm",
          source: "transcription",
          text: "Review the audio against this transcript.",
          contentHash: "synthetic-hash",
          disclosure: "Audio transcription requires review.",
        }),
      ),
      id,
    );
    expect(source.text).toBe("Review the audio against this transcript.");
    expect(source.truncated).toBeUndefined();
    expect(source.disclosure).toBe("Audio transcription requires review.");
  });
  it("binds exact receipt and retains truncation/disclosure", async () => {
    await expect(
      extractMeetingSource(
        createApiClient(async () =>
          Response.json({
            attachmentId: id,
            text: "Source",
            truncated: true,
            disclosure: "Not scanned",
          }),
        ),
        id,
      ),
    ).resolves.toMatchObject({ truncated: true, disclosure: "Not scanned" });
    await expect(
      extractMeetingSource(
        createApiClient(async () =>
          Response.json({
            attachmentId: otherId,
            text: "Source",
            truncated: false,
          }),
        ),
        id,
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("does not reinterpret gated/empty extraction as success", async () => {
    await expect(
      extractMeetingSource(
        createApiClient(async () =>
          Response.json({
            attachmentId: id,
            text: "Source",
            truncated: "false",
          }),
        ),
        id,
      ),
    ).rejects.toMatchObject({ status: 502 });
    await expect(
      extractMeetingSource(
        createApiClient(async () =>
          Response.json({ message: "Runtime disabled" }, { status: 403 }),
        ),
        id,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      extractMeetingSource(
        createApiClient(async () =>
          Response.json({ attachmentId: id, text: "  ", truncated: false }),
        ),
        id,
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
});
