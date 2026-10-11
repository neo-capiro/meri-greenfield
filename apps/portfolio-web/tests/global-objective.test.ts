import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { clientSchema } from "../src/features/portfolio/public";
import {
  assertObjectiveClient,
  clientOptions,
  objectiveClientsKey,
} from "../src/features/objectives/global-create/client-options";

const actor = { tenantId: "tenant-test", userId: "user-test" };
const clients = ["Aerospace One", "Civic Two", "Archived Three"].map(
  (name, index) =>
    clientSchema.parse({
      id: `10000000-0000-4000-8000-00000000000${index + 1}`,
      name,
      sectorTag: index ? "Civic" : "Aviation",
      profileType: index ? "PROSPECT" : "CLIENT",
      profileStatus: "ACTIVE",
      status: index === 2 ? "archived" : "ACTIVE",
    }),
);
function setup(role = "standard_user") {
  const cache = new QueryClient();
  cache.setQueryData(["identity"], {
    user: { id: actor.userId, email: "test@example.test" },
    tenant: { id: actor.tenantId, name: "Synthetic" },
    role,
  });
  cache.setQueryData(objectiveClientsKey(actor), clients);
  return cache;
}

describe("global objective client selection", () => {
  it("searches names and sectors without inventing a profile-type restriction", () => {
    expect(
      clientOptions(clients, " AVIATION ").map((client) => client.id),
    ).toEqual([clients[0]!.id]);
    expect(clientOptions(clients, "civic").map((client) => client.id)).toEqual([
      clients[1]!.id,
    ]);
    expect(clientOptions(clients, "")).toHaveLength(2);
    expect(clientOptions(clients, "absent")).toEqual([]);
  });
  it.each(["standard_user", "user_admin", "capiro_admin"])(
    "allows canonical %s writer with an exact scoped row",
    (role) => {
      const cache = setup(role);
      expect(assertObjectiveClient(cache, actor, clients[1]!.id)).toEqual(
        clients[1],
      );
      cache.clear();
    },
  );
  it.each(["client_portal_user", "unknown", ""])(
    "refuses %s without a role bypass",
    (role) => {
      const cache = setup(role);
      expect(() => assertObjectiveClient(cache, actor, clients[0]!.id)).toThrow(
        "session cannot change",
      );
      cache.clear();
    },
  );
  it.each(["userId", "tenantId"] as const)(
    "rejects changed %s even with the old scoped catalog cached",
    (field) => {
      const cache = setup();
      expect(() =>
        assertObjectiveClient(
          cache,
          { ...actor, [field]: "other" },
          clients[0]!.id,
        ),
      ).toThrow("session cannot change");
      cache.clear();
    },
  );
  it.each(["identity", "catalog"])(
    "refuses invalidated %s before navigation",
    async (target) => {
      const cache = setup();
      await cache.invalidateQueries({
        queryKey:
          target === "identity" ? ["identity"] : objectiveClientsKey(actor),
        refetchType: "none",
      });
      expect(() =>
        assertObjectiveClient(cache, actor, clients[0]!.id),
      ).toThrow();
      cache.clear();
    },
  );
  it.each(["identity", "catalog"])(
    "refuses an in-flight %s refresh instead of using cached access",
    async (target) => {
      const cache = setup();
      let complete!: () => void;
      const pending = cache.fetchQuery({
        queryKey:
          target === "identity" ? ["identity"] : objectiveClientsKey(actor),
        queryFn: () =>
          new Promise<never>((_resolve, reject) => {
            complete = () => reject(new Error("Synthetic failed refresh"));
          }),
        retry: false,
      });
      expect(() =>
        assertObjectiveClient(cache, actor, clients[0]!.id),
      ).toThrow();
      complete();
      await expect(pending).rejects.toThrow("Synthetic failed refresh");
      expect(() =>
        assertObjectiveClient(cache, actor, clients[0]!.id),
      ).toThrow();
      cache.clear();
    },
  );
  it.each([clients[2]!.id, "10000000-0000-4000-8000-000000000099", ""])(
    "refuses archived/missing/unselected client %s",
    (id) => {
      const cache = setup();
      expect(() => assertObjectiveClient(cache, actor, id)).toThrow(
        "current client list",
      );
      cache.clear();
    },
  );
  it("does not accept an unscoped catalog or a malformed duplicate selection", () => {
    const cache = setup();
    cache.removeQueries({ queryKey: objectiveClientsKey(actor), exact: true });
    cache.setQueryData(["portfolio", "clients"], clients);
    expect(() => assertObjectiveClient(cache, actor, clients[0]!.id)).toThrow(
      "Refresh",
    );
    cache.setQueryData(objectiveClientsKey(actor), [clients[0], clients[0]]);
    expect(() => assertObjectiveClient(cache, actor, clients[0]!.id)).toThrow(
      "current client list",
    );
    cache.setQueryData(objectiveClientsKey(actor), [{ id: clients[0]!.id }]);
    expect(() => assertObjectiveClient(cache, actor, clients[0]!.id)).toThrow(
      "Refresh",
    );
    cache.clear();
  });
});
