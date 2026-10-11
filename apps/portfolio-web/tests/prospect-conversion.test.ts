import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  linkProspectClient,
  searchLinkClients,
} from "../src/features/prospects/conversion/api";
const prospectId = "70000000-0000-4000-8000-000000000001";
const clientId = "10000000-0000-4000-8000-000000000001";
const otherId = "10000000-0000-4000-8000-000000000002";
const record = {
  id: prospectId,
  displayName: "Synthetic prospect",
  domain: null,
  website: null,
  description: null,
  serviceHypothesis: null,
  geography: null,
  ownerUserId: null,
  stage: "proposal",
  status: "active",
  nextAction: null,
  nextActionDueAt: null,
  linkedClientId: clientId,
  convertedAt: "2026-10-11T05:00:00Z",
  createdAt: "2026-10-10T05:00:00Z",
  updatedAt: "2026-10-11T05:00:00Z",
};
const receipt = {
  prospect: record,
  client: { id: clientId, name: "Synthetic client" },
  created: false,
};

describe("explicit prospect client linking", () => {
  it("encodes bounded tenant-scoped server search and forwards cancellation", async () => {
    const controller = new AbortController();
    const api = createApiClient(async (input, options) => {
      const url = new URL(String(input), "http://localhost");
      expect(url.pathname).toBe(
        "/api/backend/core/business-development/search/clients",
      );
      expect(url.searchParams.get("q")).toBe("Acme & Company");
      expect(url.searchParams.get("limit")).toBe("30");
      expect(options?.signal).toBe(controller.signal);
      return Response.json({
        results: [{ id: clientId, name: "Acme", canonicalEntityId: null }],
      });
    });
    expect(
      (await searchLinkClients(api, " Acme & Company ", controller.signal))
        .results[0]?.id,
    ).toBe(clientId);
  });
  it("submits only the explicit existing client and accepts its scoped receipt", async () => {
    const api = createApiClient(async (input, options) => {
      expect(String(input)).toBe(
        `/api/backend/core/business-development/prospects/${prospectId}/convert`,
      );
      expect(options?.method).toBe("POST");
      expect(JSON.parse(String(options?.body))).toEqual({
        existingClientId: clientId,
      });
      return Response.json(receipt);
    });
    expect((await linkProspectClient(api, prospectId, clientId)).created).toBe(
      false,
    );
  });
  it.each([
    { ...receipt, prospect: { ...record, id: otherId } },
    { ...receipt, prospect: { ...record, linkedClientId: otherId } },
    { ...receipt, client: { ...receipt.client, id: otherId } },
    { ...receipt, created: true },
    { ...receipt, prospect: { ...record, convertedAt: null } },
    { ...receipt, prospect: { ...record, status: "dismissed" } },
  ])("rejects an unverified link receipt %#", async (body) => {
    const api = createApiClient(async () => Response.json(body));
    await expect(
      linkProspectClient(api, prospectId, clientId),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("does not retry a lost write reply", async () => {
    let writes = 0;
    const api = createApiClient(async () => {
      writes++;
      throw new TypeError("Synthetic connection lost");
    });
    await expect(linkProspectClient(api, prospectId, clientId)).rejects.toThrow(
      "Synthetic connection lost",
    );
    expect(writes).toBe(1);
  });
});
