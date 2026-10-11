import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { assertAdvocacyCorrectionAccess } from "../src/features/advocacy/access";
import { createApiClient } from "../src/shared/api/http";
import { matterDetailSchema } from "../src/features/advocacy/contracts";
import { advocacySourceUrl } from "../src/features/advocacy/source";
import { loadMatter, loadMatters } from "../src/features/advocacy/queries";
import {
  prepareCorrection,
  submitCorrection,
  checkCorrection,
  type Correction,
} from "../src/features/advocacy/correction";

const clientId = "10000000-0000-4000-8000-000000000001";
const sourceId = "a0000000-0000-4000-8000-000000000001";
const targetId = "a0000000-0000-4000-8000-000000000002";
const recordId = "b0000000-0000-4000-8000-000000000001";
const root = `/api/backend/core/clients/${clientId}/advocacy-matters`;
const record = {
  id: recordId,
  recordType: "meeting",
  title: "Synthetic record",
  summary: "Source summary",
  activityDate: null,
  sourceType: "meeting",
  sourceId: "source-id",
  sourceUrl: null,
  evidenceClass: "INFERRED",
  confidence: 0.7,
  outcome: null,
  matterLocked: false,
  metadata: { presentation: { sourceTitle: "Original title" } },
};
const source = matterDetailSchema.parse({
  id: sourceId,
  title: "Source matter",
  matterType: "other",
  status: "active",
  summary: null,
  openedAt: null,
  lastActivityAt: null,
  recordCount: 1,
  outcomeCount: 0,
  linkCount: 1,
  records: [record],
  links: [
    {
      id: "link-source",
      linkType: "meeting",
      linkKey: "meeting-source",
      label: null,
    },
  ],
  updatedAt: "2026-10-10T12:00:00Z",
});
const target = matterDetailSchema.parse({
  ...source,
  id: targetId,
  title: "Destination matter",
  recordCount: 0,
  linkCount: 0,
  records: [],
  links: [],
});
function apiFor(responses: Record<string, unknown>) {
  const fetcher = vi.fn<typeof fetch>(async (input, options) => {
    const path = String(input);
    if (options?.method === "POST") return new Response(null, { status: 204 });
    if (!(path in responses))
      throw new Error(`Unexpected test request ${path}`);
    return new Response(JSON.stringify(responses[path]));
  });
  return { api: createApiClient(fetcher), fetcher };
}
const before = () => ({
  [root]: [source, target],
  [`${root}/${sourceId}`]: source,
  [`${root}/${targetId}`]: target,
});

describe("advocacy scoped corrections", () => {
  it("refuses a previously successful identity after real cache invalidation until refreshed", async () => {
    const cache = new QueryClient();
    const identity = {
      user: { id: "synthetic-user", email: "test@example.test" },
      tenant: { id: "synthetic-tenant", name: "Synthetic tenant" },
      role: "user_admin",
    };
    const actor = { userId: identity.user.id, tenantId: identity.tenant.id };
    cache.setQueryData(["identity"], identity);
    expect(() => assertAdvocacyCorrectionAccess(cache, actor)).not.toThrow();
    await cache.invalidateQueries({
      queryKey: ["identity"],
      refetchType: "none",
    });
    expect(cache.getQueryState(["identity"])?.status).toBe("success");
    expect(() => assertAdvocacyCorrectionAccess(cache, actor)).toThrow(
      "Your current role cannot correct advocacy history.",
    );
    cache.setQueryData(["identity"], identity);
    expect(() => assertAdvocacyCorrectionAccess(cache, actor)).not.toThrow();
    expect(() =>
      assertAdvocacyCorrectionAccess(cache, {
        ...actor,
        userId: "different-user",
      }),
    ).toThrow();
    cache.clear();
  });
  it("preflights same-client selected matters and source evidence before a merge", async () => {
    const { api, fetcher } = apiFor(before());
    const correction: Correction = { kind: "merge", source, target };
    await expect(prepareCorrection(api, clientId, correction)).resolves.toEqual(
      correction,
    );
    expect(
      fetcher.mock.calls.every(([, options]) => options?.method === "GET"),
    ).toBe(true);
  });
  it("rejects stale snapshots before dispatch instead of overwriting unseen changes", async () => {
    const { api } = apiFor({
      ...before(),
      [`${root}/${sourceId}`]: { ...source, summary: "Changed elsewhere" },
    });
    await expect(
      prepareCorrection(api, clientId, { kind: "merge", source, target }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects matter selection absent from this scoped list and self merges", async () => {
    await expect(
      prepareCorrection(
        apiFor({ ...before(), [root]: [source] }).api,
        clientId,
        { kind: "merge", source, target },
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      prepareCorrection(apiFor(before()).api, clientId, {
        kind: "merge",
        source,
        target: source,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("requires the exact reviewed record and bounds rejection reasons", async () => {
    const { api } = apiFor(before());
    await expect(
      prepareCorrection(api, clientId, {
        kind: "detach",
        source,
        recordId: targetId,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      prepareCorrection(api, clientId, {
        kind: "not-advocacy",
        source,
        recordId,
        reason: "x".repeat(1001),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("binds detail responses and refuses duplicated matter identities", async () => {
    const { api } = apiFor({
      ...before(),
      [`${root}/${sourceId}`]: target,
      [root]: [source, source],
    });
    await expect(loadMatter(api, clientId, sourceId)).rejects.toMatchObject({
      status: 502,
    });
    await expect(loadMatters(api, clientId)).rejects.toMatchObject({
      status: 502,
    });
  });
  it.each([
    [
      { kind: "merge", source, target },
      `${targetId}/merge`,
      { sourceMatterId: sourceId },
    ],
    [
      { kind: "reassign", source, target, recordId },
      `records/${recordId}/reassign`,
      { targetMatterId: targetId },
    ],
    [
      { kind: "detach", source, recordId },
      `records/${recordId}/detach`,
      undefined,
    ],
    [
      { kind: "not-advocacy", source, recordId, reason: "Reviewed source" },
      `records/${recordId}/not-advocacy`,
      { reason: "Reviewed source" },
    ],
  ] satisfies [Correction, string, unknown][])(
    "uses exact scoped POST shape %j",
    async (correction, path, body) => {
      const { api, fetcher } = apiFor({});
      await submitCorrection(api, clientId, correction);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher).toHaveBeenCalledWith(
        `${root}/${path}`,
        expect.objectContaining({
          method: "POST",
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );
    },
  );
  it("refuses unexpected successful bodies instead of accepting an unrelated receipt", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: targetId })));
    await expect(
      submitCorrection(createApiClient(fetcher), clientId, {
        kind: "detach",
        source,
        recordId,
      }),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("confirms merge by removed source and transferred locked record / link keys", async () => {
    const moved = {
      ...target,
      records: [{ ...record, matterLocked: true }],
      links: source.links,
    };
    const { api } = apiFor({
      [root]: [target],
      [`${root}/${targetId}`]: moved,
    });
    expect(
      await checkCorrection(api, clientId, { kind: "merge", source, target }),
    ).toBe(true);
    expect(
      await checkCorrection(
        apiFor({ [root]: [source, target] }).api,
        clientId,
        { kind: "merge", source, target },
      ),
    ).toBe(false);
    expect(
      await checkCorrection(
        apiFor({
          [root]: [target],
          [`${root}/${targetId}`]: { ...moved, records: [record] },
        }).api,
        clientId,
        { kind: "merge", source, target },
      ),
    ).toBe(false);
  });
  it("requires reassign destination membership/lock and source absence", async () => {
    const correction: Correction = {
      kind: "reassign",
      source,
      target,
      recordId,
    };
    expect(
      await checkCorrection(
        apiFor({
          [`${root}/${sourceId}`]: { ...source, records: [] },
          [`${root}/${targetId}`]: {
            ...target,
            records: [{ ...record, matterLocked: true }],
          },
        }).api,
        clientId,
        correction,
      ),
    ).toBe(true);
    expect(
      await checkCorrection(
        apiFor({ [`${root}/${targetId}`]: target }).api,
        clientId,
        correction,
      ),
    ).toBe(false);
  });
  it("requires detach identity in unassigned timeline, not merely source absence", async () => {
    const entry = {
      id: recordId,
      kind: "record",
      title: record.title,
      subtype: "meeting",
      date: null,
      evidenceClass: "INFERRED",
      confidence: 0.7,
      matterId: null,
      matterTitle: null,
    };
    const response = {
      [`${root}/timeline`]: [entry],
      [`${root}/${sourceId}`]: { ...source, records: [] },
    };
    expect(
      await checkCorrection(apiFor(response).api, clientId, {
        kind: "detach",
        source,
        recordId,
      }),
    ).toBe(true);
    expect(
      await checkCorrection(
        apiFor({ ...response, [`${root}/timeline`]: [] }).api,
        clientId,
        { kind: "detach", source, recordId },
      ),
    ).toBe(false);
  });
  it("keeps rejection readback limited to visible absence, not an invented audit receipt", async () => {
    const responses = {
      [`${root}/timeline`]: [],
      [`${root}/${sourceId}`]: { ...source, records: [] },
    };
    const correction: Correction = { kind: "not-advocacy", source, recordId };
    expect(
      await checkCorrection(apiFor(responses).api, clientId, correction),
    ).toBe(false);
    expect(
      await checkCorrection(apiFor(responses).api, clientId, correction, {
        acknowledged: true,
      }),
    ).toBe(true);
  });
  it("never dispatches an already aborted correction", async () => {
    const { api, fetcher } = apiFor({});
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      submitCorrection(
        api,
        clientId,
        { kind: "detach", source, recordId },
        controller.signal,
      ),
    ).toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "https://user:password@example.test/source",
  ])("does not navigate unsafe supplied source %s", (url) => {
    expect(advocacySourceUrl({ ...record, sourceUrl: url })).toBeUndefined();
  });
  it("preserves explicit safe source attribution and uses no source-type guessed destination", () => {
    expect(
      advocacySourceUrl({
        ...record,
        sourceUrl: "https://example.test/evidence?id=one",
      }),
    ).toBe("https://example.test/evidence?id=one");
    expect(
      advocacySourceUrl({
        ...record,
        metadata: { sourceUrl: "https://example.test/historical" },
      }),
    ).toBe("https://example.test/historical");
    expect(
      advocacySourceUrl({ ...record, sourceType: "fara" }),
    ).toBeUndefined();
  });
});
