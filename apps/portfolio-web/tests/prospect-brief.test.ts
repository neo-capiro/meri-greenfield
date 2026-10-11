import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  currentSchema,
  sectionKeys,
  versionSchema,
} from "../src/features/prospects/brief/contracts";
import {
  changedSections,
  draftOf,
  mergeDraft,
  sourceHref,
} from "../src/features/prospects/brief/editing";
import {
  listVersions,
  readBrief,
  readRefresh,
  readVersion,
  resolveCitation,
  writeBrief,
} from "../src/features/prospects/brief/api";

const scope = { prospectId: "prospect/synthetic", tenantId: "tenant-one" };
const citation = {
  sourceFamily: "sam_entity",
  recordId: "record-one",
  locator: null,
  originalSourceName: "Synthetic source",
  originalSourceId: "source-one",
  eventDate: null,
  sourceUpdatedAt: null,
  retrievedAt: null,
  title: "Synthetic cited evidence",
  relationshipStrength: "direct",
  stage: null,
};
const version = versionSchema.parse({
  id: "version-one",
  versionNumber: 1,
  createdAt: "2026-10-11T00:00:00Z",
  createdByUserId: "user-one",
  sectionsHash: "hash-one",
  citationCount: 1,
  citations: [citation],
  snapshotHash: "snapshot-one",
  sourceSnapshot: {
    generatedAt: "2026-10-11T00:00:00Z",
    identityBasis: "registered identity",
    canonicalEntityId: null,
    canonicalName: "Synthetic company",
    evidence: [],
  },
  sections: Object.fromEntries(
    sectionKeys.map((key) => [
      key,
      {
        text: `${key} original text`,
        provenance: "generated",
        citationIndexes: [0],
      },
    ]),
  ),
});
const brief = {
  id: "brief-one",
  ...scope,
  title: "Synthetic saved brief",
  status: "draft",
  currentVersionNumber: 1,
  currentVersionId: version.id,
  createdAt: version.createdAt,
  updatedAt: version.createdAt,
  createdByUserId: "user-one",
};
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
describe("saved brief content and conflict review", () => {
  it("preserves unedited provenance and exact dates/citations while marking only changed sections edited", () => {
    const draft = draftOf(version);
    draft.practicalAction = "A user-authored action, not an inferred objective";
    const sections = changedSections(version, draft);
    expect(sections.verifiedEvidence).toEqual(
      version.sections.verifiedEvidence,
    );
    expect(sections.practicalAction).toEqual({
      text: draft.practicalAction,
      provenance: "edited",
      citationIndexes: [0],
    });
    expect(version.citations[0]?.eventDate).toBeNull();
    expect(version.sections.practicalAction.provenance).toBe("generated");
  });
  it("rejects empty and excessive sections and unknown section aliases", () => {
    expect(() =>
      changedSections(version, { ...draftOf(version), judgment: " " }),
    ).toThrow("1–4000");
    expect(() =>
      changedSections(version, {
        ...draftOf(version),
        judgment: "x".repeat(4001),
      }),
    ).toThrow("1–4000");
    expect(
      versionSchema.safeParse({
        ...version,
        sections: {
          ...version.sections,
          objectives: version.sections.judgment,
        },
      }).success,
    ).toBe(false);
  });
  it("rejects out-of-range citation references and mismatched root/current version", () => {
    expect(versionSchema.safeParse({ ...version, citations: [] }).success).toBe(
      false,
    );
    expect(
      currentSchema.safeParse({
        brief: { ...brief, currentVersionId: "other" },
        currentVersion: version,
      }).success,
    ).toBe(false);
    expect(
      currentSchema.safeParse({ brief: null, currentVersion: version }).success,
    ).toBe(false);
  });
  it("explicitly merges changed text onto latest, keeps unrelated changes and remaps stable source identity", () => {
    const latest = versionSchema.parse({
      ...version,
      id: "version-two",
      versionNumber: 2,
      citationCount: 2,
      citations: [{ ...citation, recordId: "new-source" }, citation],
      sections: {
        ...version.sections,
        verifiedEvidence: {
          ...version.sections.verifiedEvidence,
          text: "Concurrent evidence update",
        },
      },
    });
    const draft = { ...draftOf(version), practicalAction: "My retained draft" };
    const merged = mergeDraft(version, latest, draft);
    expect(merged.verifiedEvidence.text).toBe("Concurrent evidence update");
    expect(merged.practicalAction).toEqual({
      text: "My retained draft",
      provenance: "edited",
      citationIndexes: [1],
    });
    expect(draft.practicalAction).toBe("My retained draft");
  });
  it("refuses a merge when a draft's cited identity disappeared", () => {
    const latest = versionSchema.parse({
      ...version,
      citations: [{ ...citation, recordId: "different" }],
    });
    expect(() =>
      mergeDraft(version, latest, { ...draftOf(version), judgment: "Changed" }),
    ).toThrow("cited source changed");
  });
  it("refuses attribution drift when the same source identity has different saved dates or text", async () => {
    const changedCitation = { ...citation, eventDate: "2026-10-11" };
    const latest = versionSchema.parse({
      ...version,
      citations: [changedCitation],
    });
    expect(() =>
      mergeDraft(version, latest, { ...draftOf(version), judgment: "Changed" }),
    ).toThrow("cited source changed");
    await expect(
      resolveCitation(
        client({
          resolvable: true,
          citation: changedCitation,
          sourceSnapshotEvidence: null,
          currentDossierEvidence: null,
        }).api,
        scope.prospectId,
        0,
        citation,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("allows safe source locators without inventing links for references or unsafe URLs", () => {
    expect(sourceHref("https://example.test/source")).toBe(
      "https://example.test/source",
    );
    for (const value of [
      null,
      "record-one",
      "javascript:alert(1)",
      "https://user:secret@example.test/",
      "/relative",
    ])
      expect(sourceHref(value)).toBeUndefined();
  });
});
describe("brief API receipts and idempotency", () => {
  it("distinguishes a valid empty brief from disabled/missing404 and binds tenant/prospect", async () => {
    expect(
      await readBrief(client({ brief: null, currentVersion: null }).api, scope),
    ).toEqual({ brief: null, currentVersion: null });
    await expect(
      readBrief(client({ message: "Not Found" }, 404).api, scope),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readBrief(
        client({
          brief: { ...brief, tenantId: "other" },
          currentVersion: version,
        }).api,
        scope,
      ),
    ).rejects.toThrow("prospect and account");
    await expect(
      listVersions(
        client({ brief: { ...brief, prospectId: "other" }, versions: [] }).api,
        scope,
      ),
    ).rejects.toThrow("prospect and account");
  });
  it("sends exact stable create input and encoded path without automatic retry", async () => {
    const fixture = client({ brief, version, created: true });
    const input = { idempotencyKey: "fixed-synthetic-create-key" };
    await writeBrief(fixture.api, scope, input);
    expect(fixture.requests).toEqual([
      {
        path: "/api/backend/core/business-development/prospects/prospect%2Fsynthetic/brief/versions",
        method: "POST",
        body: input,
      },
    ]);
  });
  it("saves with expected version and rejects a wrong operation receipt", async () => {
    const input = {
      idempotencyKey: "fixed-synthetic-edit-key",
      expectedVersionNumber: 1,
      sections: version.sections,
    };
    const next = { ...version, id: "version-two", versionNumber: 2 };
    const fixture = client({
      brief: { ...brief, currentVersionId: next.id },
      version: next,
      created: true,
    });
    await writeBrief(fixture.api, scope, input);
    expect(fixture.requests[0]?.method).toBe("PUT");
    expect(fixture.requests[0]?.body).toEqual(input);
    await expect(
      writeBrief(client({ brief, version, created: true }).api, scope, input),
    ).rejects.toThrow("receipt");
  });
  it("allows an idempotent older replay without pretending it is the current version", async () => {
    const result = await writeBrief(
      client({
        brief: { ...brief, currentVersionId: "newer-current" },
        version,
        created: false,
      }).api,
      scope,
      { idempotencyKey: "fixed-synthetic-create-key" },
    );
    expect(result.created).toBe(false);
    expect(result.brief.currentVersionId).toBe("newer-current");
    expect(result.version.id).toBe(version.id);
  });
  it("keeps conflict and permission errors observable", async () => {
    await expect(
      writeBrief(client({ message: "Version conflict" }, 409).api, scope, {
        idempotencyKey: "fixed-synthetic-create-key",
      }),
    ).rejects.toMatchObject({ status: 409, message: "Version conflict" });
    await expect(
      readBrief(client({ message: "Forbidden" }, 403).api, scope),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("binds immutable history entries to both selected number and ID", async () => {
    await expect(
      readVersion(client(version).api, scope.prospectId, 1, "different-id"),
    ).rejects.toThrow("selected history");
    expect(
      await readVersion(client(version).api, scope.prospectId, 1, version.id),
    ).toEqual(version);
  });
  it("rejects refresh base drift and current citation identity drift", async () => {
    await expect(
      readRefresh(
        client({
          baseVersionNumber: 2,
          proposed: version.sections,
          diff: sectionKeys.map((section) => ({
            section,
            changed: false,
            baseText: "base",
            proposedText: "fresh",
          })),
          sourceSnapshot: version.sourceSnapshot,
          snapshotHash: "hash",
        }).api,
        scope.prospectId,
        1,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      resolveCitation(
        client({
          resolvable: true,
          citation: { ...citation, recordId: "other" },
          sourceSnapshotEvidence: null,
          currentDossierEvidence: null,
        }).api,
        scope.prospectId,
        0,
        citation,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
