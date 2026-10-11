import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  saveObjective,
  deleteObjective,
} from "../src/features/objectives/writer";
import {
  scopedObjectivesSchema,
  type Objective,
} from "../src/features/objectives/contracts";

const clientId = "10000000-0000-4000-8000-000000000001";
const otherId = "10000000-0000-4000-8000-000000000002";
const fields = {
  outcome: "Fund testing",
  governmentProblem: "Capacity",
  askType: "funding" as const,
  minimumWin: "One pilot",
  limits: "",
};
const record: Objective = {
  ...fields,
  id: "20000000-0000-4000-8000-000000000001",
  clientId,
  requestId: "30000000-0000-4000-8000-000000000001",
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
};

describe("Objective exact operation receipts", () => {
  it("validates exact client and unique identities for the objective list", () => {
    const schema = scopedObjectivesSchema(clientId);
    expect(schema.parse([record])).toEqual([record]);
    expect(schema.safeParse([record, record]).success).toBe(false);
    expect(schema.safeParse([{ ...record, clientId: otherId }]).success).toBe(
      false,
    );
  });
  it("refuses a record from another client before dispatch", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      saveObjective(
        createApiClient(fetcher),
        clientId,
        {
          fields,
          requestId: record.requestId,
          record: { ...record, clientId: otherId },
        },
        "confirm_ready",
        vi.fn(),
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  for (const changed of [
    { clientId: otherId },
    { requestId: otherId },
    { outcome: "Another actor's later edit" },
  ])
    it(`does not retain or transition a mismatched create receipt ${JSON.stringify(changed)}`, async () => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ ...record, ...changed }));
      const persisted = vi.fn();
      await expect(
        saveObjective(
          createApiClient(fetcher),
          clientId,
          {
            fields,
            requestId: record.requestId,
          },
          "confirm_ready",
          persisted,
        ),
      ).rejects.toThrow();
      expect(persisted).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

  for (const changed of [
    { id: otherId },
    { clientId: otherId },
    { requestId: otherId },
    { version: 1 },
    { version: 3 },
    { ownerUserId: otherId },
    { status: "ready" },
    { minimumWin: "Different win" },
  ])
    it(`refuses a mismatched edit receipt ${JSON.stringify(changed)}`, async () => {
      const edited = { ...fields, outcome: "Updated outcome" };
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ ...record, ...edited, version: 2, ...changed }),
        );
      const persisted = vi.fn();
      await expect(
        saveObjective(
          createApiClient(fetcher),
          clientId,
          {
            fields: edited,
            requestId: record.requestId,
            record,
          },
          "confirm_ready",
          persisted,
        ),
      ).rejects.toThrow();
      expect(persisted).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

  for (const changed of [
    { id: otherId },
    { clientId: otherId },
    { requestId: otherId },
    { version: 1 },
    { status: "in_review" },
    { outcome: "Different result" },
    { ownerUserId: otherId },
  ])
    it(`refuses a mismatched lifecycle receipt ${JSON.stringify(changed)}`, async () => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ ...record, status: "ready", version: 2, ...changed }),
        );
      const persisted = vi.fn();
      await expect(
        saveObjective(
          createApiClient(fetcher),
          clientId,
          {
            fields,
            requestId: record.requestId,
            record,
          },
          "confirm_ready",
          persisted,
        ),
      ).rejects.toThrow();
      expect(persisted).toHaveBeenCalledExactlyOnceWith(record);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

  it("accepts an idempotent create returning the same fields already ready at a later version", async () => {
    const ready = { ...record, status: "ready", version: 4 };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(ready));
    await expect(
      saveObjective(
        createApiClient(fetcher),
        clientId,
        {
          fields,
          requestId: record.requestId,
        },
        "confirm_ready",
        vi.fn(),
      ),
    ).resolves.toEqual(ready);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("accepts an exact trimmed edit followed by review of that saved revision", async () => {
    const edited = { ...fields, outcome: "Updated outcome" };
    const saved = { ...record, ...edited, version: 2 };
    const reviewed = { ...saved, status: "in_review", version: 3 };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(saved))
      .mockResolvedValueOnce(Response.json(reviewed));
    const retained = vi.fn();
    await expect(
      saveObjective(
        createApiClient(fetcher),
        clientId,
        {
          fields: { ...edited, outcome: "  Updated outcome  " },
          requestId: otherId,
          record,
        },
        "request_review",
        retained,
      ),
    ).resolves.toEqual(reviewed);
    expect(retained).toHaveBeenCalledExactlyOnceWith(saved);
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      action: "request_review",
      expectedVersion: 2,
    });
  });

  for (const receipt of [
    null,
    true,
    { id: record.id, deleted: false, version: 2 },
    { id: otherId, deleted: true, version: 2 },
    { id: record.id, deleted: true, version: 1 },
  ])
    it(`refuses unconfirmed deletion ${JSON.stringify(receipt)}`, async () => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(receipt));
      await expect(
        deleteObjective(createApiClient(fetcher), clientId, record),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

  it("accepts only the exact deleted identity and next version", async () => {
    const receipt = { id: record.id, deleted: true, version: 2 };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(receipt));
    await expect(
      deleteObjective(createApiClient(fetcher), clientId, record),
    ).resolves.toEqual(receipt);
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("DELETE");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      expectedVersion: 1,
    });
  });

  it("refuses cross-client deletion before dispatch", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      deleteObjective(createApiClient(fetcher), otherId, record),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
