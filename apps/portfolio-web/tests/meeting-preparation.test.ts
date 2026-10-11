import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  preparationSchema,
  prepJobSchema,
} from "../src/features/calendar/preparation/schema";
import {
  editedBody,
  editValues,
  parseBoards,
} from "../src/features/calendar/preparation/editing";
import {
  changeJob,
  generatePreparation,
  readJob,
  saveBoards,
  savePreparation,
} from "../src/features/calendar/preparation/api";
import { emailEvidenceSourceUrl } from "../src/features/calendar/preparation/email-evidence";

const meetingId = "meeting/synthetic";
const prep = preparationSchema.parse({
  id: "prep-one",
  meetingId,
  clientId: "client-one",
  status: "approved",
  summary: "Original summary",
  agenda: [{ text: "Retain evidence", factIds: ["fact-one"] }],
  talkingPoints: [],
  risks: [],
  followUps: [],
  emailEvidence: ["Saved email evidence"],
  createdAt: "2026-10-11T00:00:00Z",
});
const job = prepJobSchema.parse({
  jobId: "job/one",
  meetingId,
  status: "queued",
  stage: "queued",
  depth: "standard",
  prepId: null,
  errorCode: null,
  deadlineAt: "2026-10-11T23:00:00Z",
});
function client(result: unknown, status = 200) {
  const requests: { path: string; method: string; body: unknown }[] = [];
  const api = createApiClient(async (input, options) => {
    requests.push({
      path: String(input),
      method: options?.method ?? "GET",
      body: options?.body ? JSON.parse(String(options.body)) : undefined,
    });
    return new Response(JSON.stringify(result), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { api, requests };
}
describe("preparation edits and source settings", () => {
  it("validates saved structured email evidence without losing its source attribution", () => {
    const evidence = {
      summary: "Synthetic saved exchange",
      sourceId: "synthetic-email-one",
      sourceUrl: "https://example.test/mail/one",
    };
    const structured = preparationSchema.parse({
      ...prep,
      emailEvidence: ["Legacy text", evidence],
    });
    expect(structured.emailEvidence).toEqual(["Legacy text", evidence]);
    const values = editValues(structured);
    expect(values.emailEvidence).toBe("Legacy text\nSynthetic saved exchange");
    values.summary = "Unrelated change";
    expect(editedBody(structured, values)).toEqual({
      summary: "Unrelated change",
    });
    expect(structured.emailEvidence[1]).toEqual(evidence);
    values.emailEvidence = "Attribution would be lost";
    expect(() => editedBody(structured, values)).toThrow("source attribution");
    expect(
      preparationSchema.safeParse({
        ...prep,
        emailEvidence: [{ summary: "Missing required source fields" }],
      }).success,
    ).toBe(false);
  });
  it("exposes only absolute HTTP(S) source links without credentials", () => {
    expect(emailEvidenceSourceUrl("https://example.test/mail/one")).toBe(
      "https://example.test/mail/one",
    );
    expect(emailEvidenceSourceUrl("http://example.test/mail/one")).toBe(
      "http://example.test/mail/one",
    );
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,test",
      "/relative/mail",
      "https://user:secret@example.test/mail",
      "not a URL",
    ])
      expect(emailEvidenceSourceUrl(value)).toBeUndefined();
  });
  it("preserves known institutional provenance and does not fabricate omitted sharing state", () => {
    const institutional = preparationSchema.parse({
      ...prep,
      sharedAt: undefined,
      generatedFrom: {
        schemaVersion: "research_portfolio_institutional_v1",
        briefing: true,
        reviewStatus: "unreviewed_draft",
      },
    });
    expect(institutional.generatedFrom).toEqual({
      schemaVersion: "research_portfolio_institutional_v1",
      briefing: true,
      reviewStatus: "unreviewed_draft",
    });
    expect(institutional.sharedAt).toBeUndefined();
    expect(
      preparationSchema.safeParse({
        ...prep,
        generatedFrom: { briefing: true },
      }).success,
    ).toBe(false);
  });
  it("sends only changed fields and preserves unedited evidence-linked sections", () => {
    const values = editValues(prep);
    values.summary = "Updated summary";
    expect(editedBody(prep, values)).toEqual({ summary: "Updated summary" });
    expect(prep.agenda).toEqual([
      { text: "Retain evidence", factIds: ["fact-one"] },
    ]);
  });
  it("normalizes changed lines without changing absent sections", () => {
    const values = editValues(prep);
    values.risks = "  First risk\r\n\n Second risk  ";
    values.summary = " ";
    expect(editedBody(prep, values)).toEqual({
      summary: null,
      risks: ["First risk", "Second risk"],
    });
    expect(editedBody(prep, editValues(prep))).toEqual({});
  });
  it("rejects more than eighty changed items", () => {
    expect(() =>
      editedBody(prep, {
        ...editValues(prep),
        agenda: Array.from({ length: 81 }, (_, i) => `Item${i}`).join("\n"),
      }),
    ).toThrow("at most 80");
  });
  it("validates board IDs as strings and deduplicates without numeric rounding", () => {
    expect(parseBoards("123, 123\n987654321098765432109876")).toEqual([
      "123",
      "987654321098765432109876",
    ]);
    expect(parseBoards("")).toEqual([]);
    expect(() => parseBoards("1e5")).toThrow("1–24 digits");
    expect(() => parseBoards("1234567890123456789012345")).toThrow();
    expect(() =>
      parseBoards(Array.from({ length: 21 }, (_, i) => String(i)).join(",")),
    ).toThrow();
  });
});
describe("verified preparation API boundaries", () => {
  it("submits a stable key and accepts queued as pending, not an artifact", async () => {
    const { api, requests } = client(job);
    const input = {
      requestKey: "synthetic-request-key",
      depth: "standard" as const,
      additionalContext: " Review evidence ",
    };
    expect(await generatePreparation(api, meetingId, input)).toEqual(job);
    expect(requests[0]).toEqual({
      path: "/api/backend/core/engagement/meetings/meeting%2Fsynthetic/prep",
      method: "POST",
      body: { ...input, additionalContext: "Review evidence" },
    });
  });
  it("accepts synchronous legacy preparation only with the correct meeting receipt", async () => {
    expect(
      await generatePreparation(client(prep).api, meetingId, {
        requestKey: "legacy-request",
        depth: "standard",
        additionalContext: "",
      }),
    ).toEqual(prep);
    await expect(
      generatePreparation(
        client({ ...prep, meetingId: "other" }).api,
        meetingId,
        {
          requestKey: "legacy-request",
          depth: "standard",
          additionalContext: "",
        },
      ),
    ).rejects.toThrow("did not match");
  });
  it("rejects wrong-meeting jobs and wrong-job cancel receipts", async () => {
    await expect(
      readJob(client({ ...job, meetingId: "other" }).api, meetingId),
    ).rejects.toThrow("different meeting");
    await expect(
      changeJob(
        client({ ...job, jobId: "other" }).api,
        meetingId,
        job.jobId,
        "cancel",
      ),
    ).rejects.toThrow("different meeting");
    await expect(
      changeJob(client(null).api, meetingId, job.jobId, "cancel"),
    ).rejects.toThrow("unavailable");
  });
  it("uses explicit cancel and resume routes with encoded stable IDs", async () => {
    const cancel = client({ ...job, status: "cancelled" });
    await changeJob(cancel.api, meetingId, job.jobId, "cancel");
    expect(cancel.requests[0]?.method).toBe("DELETE");
    expect(cancel.requests[0]?.path).toContain("/prep-jobs/job%2Fone");
    const resume = client(job);
    await changeJob(resume.api, meetingId, job.jobId, "resume");
    expect(resume.requests[0]?.method).toBe("POST");
    expect(resume.requests[0]?.path).toContain("/prep-jobs/job%2Fone/resume");
  });
  it("validates edit receipt identity and rejects an unbound successful response", async () => {
    await expect(
      savePreparation(
        client({ ...prep, id: "wrong" }).api,
        meetingId,
        prep.id,
        { summary: "Edited" },
      ),
    ).rejects.toThrow("did not match");
    const { meetingId: omitted, ...unbound } = prep;
    expect(omitted).toBe(meetingId);
    await expect(
      savePreparation(client(unbound).api, meetingId, prep.id, {
        summary: "Edited",
      }),
    ).rejects.toThrow("unexpected response");
  });
  it("rejects an otherwise valid preparation written to a different client", async () => {
    const wrongClient = client({ ...prep, clientId: "client-other" });
    await expect(
      savePreparation(
        wrongClient.api,
        meetingId,
        prep.id,
        { summary: "Edited" },
        "client-one",
      ),
    ).rejects.toThrow("did not match");
    await expect(
      generatePreparation(
        client({ ...prep, clientId: "client-other" }).api,
        meetingId,
        {
          requestKey: "client-bound-key",
          depth: "standard",
          additionalContext: "",
        },
        "client-one",
      ),
    ).rejects.toThrow("did not match");
  });
  it("rejects stale board mapping and a mismatched saved selection", async () => {
    await expect(
      saveBoards(
        client({ clientId: "other", boardIds: ["123"] }).api,
        meetingId,
        "client-one",
        ["123"],
      ),
    ).rejects.toThrow("did not match");
    await expect(
      saveBoards(
        client({ clientId: "client-one", boardIds: ["999"] }).api,
        meetingId,
        "client-one",
        ["123"],
      ),
    ).rejects.toThrow("did not match");
  });
  it("preserves backend authorization failures instead of acknowledging success", async () => {
    await expect(
      savePreparation(
        client({ message: "Saved source access changed" }, 403).api,
        meetingId,
        prep.id,
        {},
      ),
    ).rejects.toMatchObject({
      status: 403,
      message: "Saved source access changed",
    });
  });
});
