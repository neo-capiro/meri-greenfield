import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import { saveObjective } from "../src/features/objectives/writer";
import {
  objectiveSchema,
  type Objective,
} from "../src/features/objectives/contracts";
import {
  clientDrafts,
  workProjection,
  type StrategyDetail,
  type WorkspaceDraft,
} from "../src/features/work/contracts";
import {
  reportingCycle,
  type Person,
} from "../src/features/relationships/contracts";
import {
  plainMailHtml,
  threadsForRecipient,
  type MailThread,
} from "../src/features/relationships/email";

const id = "10000000-0000-4000-8000-000000000001";
const fields = {
  outcome: "Fund testing",
  governmentProblem: "Capacity",
  askType: "funding" as const,
  minimumWin: "One pilot",
  limits: "",
};
const record = objectiveSchema.parse({
  ...fields,
  id,
  clientId: id,
  requestId: id,
  ownerUserId: null,
  status: "draft",
  version: 1,
  readyAt: null,
  reviewRequestedAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  readiness: {
    isReady: true,
    completedFields: 4,
    requiredFields: 4,
    checklist: {
      outcome: true,
      governmentProblem: true,
      askType: true,
      minimumWin: true,
    },
  },
});

describe("Objective persistence and lifecycle recovery", () => {
  it("retains a created draft when transition fails and retries only that transition", async () => {
    const calls: { path: string; body: unknown }[] = [];
    let transitions = 0;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (path, init) => {
        calls.push({
          path: String(path),
          body: JSON.parse(String(init?.body)),
        });
        if (!String(path).includes("transition")) return Response.json(record);
        transitions++;
        return transitions === 1
          ? Response.json({ message: "Unavailable" }, { status: 503 })
          : Response.json({ ...record, status: "ready", version: 2 });
      });
    const api = createApiClient(fetcher);
    let persisted: Objective | undefined;
    const retain = (value: Objective) => {
      persisted = value;
    };
    await expect(
      saveObjective(
        api,
        id,
        { fields, requestId: id },
        "confirm_ready",
        retain,
      ),
    ).rejects.toThrow();
    expect(persisted).toEqual(record);
    await expect(
      saveObjective(
        api,
        id,
        { fields, requestId: id, record: persisted },
        "confirm_ready",
        retain,
      ),
    ).resolves.toMatchObject({ status: "ready", version: 2 });
    expect(calls).toHaveLength(3);
    expect(calls[0]?.body).toMatchObject({ requestId: id });
    expect(calls[1]).toEqual(calls[2]);
    expect(calls[2]?.body).toEqual({
      action: "confirm_ready",
      expectedVersion: 1,
    });
  });
  it("does not resend a ready transition or overwrite an unchanged record", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const ready = { ...record, status: "ready" as const };
    await expect(
      saveObjective(
        createApiClient(fetcher),
        id,
        { fields, requestId: id, record: ready },
        "confirm_ready",
        () => {},
      ),
    ).resolves.toEqual(ready);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("Work associations and date windows", () => {
  const draft: WorkspaceDraft = {
    id,
    docTitle: "Draft",
    client: "Client",
    product: null,
    ownerId: id,
    status: "draft",
    updatedAt: "2026-10-01",
  };
  it("withholds name-based Workspace matches when accessible names collide", () => {
    const client = { id, name: "Client" };
    expect(clientDrafts([draft], client, [client])).toEqual([draft]);
    expect(
      clientDrafts([draft], client, [client, { id: "other", name: "Client" }]),
    ).toEqual([]);
    expect(
      clientDrafts([{ ...draft, client: null }], client, [client]),
    ).toEqual([]);
  });
  it("uses a half-open 30-day window and excludes completed work from live items", () => {
    const node = {
      id,
      title: "Step",
      kind: "task",
      status: "active",
      startsOn: "2026-10-11",
      endsOn: null,
      openEnded: false,
      ownerUserId: null,
      note: null,
    };
    const strategy: StrategyDetail = {
      id,
      clientId: id,
      title: "Plan",
      type: "policy",
      ownerUserId: id,
      goal: null,
      targetDate: null,
      draftedByMeri: false,
      artifacts: [{ id }],
      nodes: [
        node,
        { ...node, id: "end", startsOn: "2026-11-10" },
        { ...node, id: "complete", status: "completed" },
        { ...node, id: "risk", kind: "risk", status: "draft" },
      ],
    };
    const projection = workProjection([strategy], "2026-10-11");
    expect(projection.upcoming.map((item) => item.id)).toEqual([id]);
    expect(projection.live.map((item) => item.id)).toEqual([id, "end"]);
    expect(projection.risks.map((item) => item.id)).toEqual(["risk"]);
    expect(projection.artifacts).toBe(1);
  });
});

describe("Relationship boundaries", () => {
  it("rejects self-management, indirect cycles and pre-existing cycles", () => {
    const person = (personId: string, manager: string | null): Person => ({
      id: personId,
      clientId: id,
      name: personId,
      title: null,
      email: null,
      phone: null,
      role: null,
      notes: null,
      hierarchyLevel: null,
      reportsToPersonId: manager,
      placementSource: "manual",
      reviewRequired: false,
      createdAt: "2026-10-01T00:00:00Z",
    });
    const people = [person("a", "b"), person("b", "c"), person("c", null)];
    expect(reportingCycle(people, "a", "a")).toBe(true);
    expect(reportingCycle(people, "c", "a")).toBe(true);
    expect(reportingCycle(people, "a", "c")).toBe(false);
    expect(
      reportingCycle([{ ...people[0]!, reportsToPersonId: "a" }], "x", "a"),
    ).toBe(true);
  });
  it("matches complete mail addresses and escapes user text before provider HTML", () => {
    const thread = {
      id,
      clientId: id,
      subject: "Test",
      snippet: null,
      connectionEmail: null,
      participants: [{ email: "PERSON@example.test" }],
      messages: [],
    } satisfies MailThread;
    expect(threadsForRecipient([thread], " person@example.test ")).toEqual([
      thread,
    ]);
    expect(threadsForRecipient([thread], "otherperson@example.test")).toEqual(
      [],
    );
    expect(plainMailHtml('<script>\n&"')).toBe(
      "<p>&lt;script&gt;</p><p>&amp;&quot;</p>",
    );
  });
});
