import type { Page } from "@playwright/test";
import { client, clientId, installFixtures, json } from "./fixtures";
export const toolsTenantId = "10000000-0000-4000-8000-000000000002";
export const toolsClient = {
  ...client,
  status: "active",
  tenantId: toolsTenantId,
  intakeData: {
    tags: ["Saved focus"],
    profileNotes: "Synthetic saved notes",
    nested: { unchanged: true },
  },
};
export const toolsIntelligence = {
  client: {
    id: clientId,
    name: client.name,
    description: client.description,
    sectorTag: client.sectorTag,
    submissionTracks: [],
    capabilities: [],
  },
  mappings: [
    { source: "contracting", confirmed: false, externalId: "synthetic-source" },
  ],
  lda: { matched: false },
  contracting: { matched: true, totalContracts: 123.45 },
  lobbyIntel: { matched: false },
  relevantBills: [],
  activeRegulations: [],
  competitors: [],
  aiSummary: null,
  lastUpdated: "2026-10-11T00:00:00Z",
};
export async function installProfileTools(
  page: Page,
  options: {
    role?: string;
    tagStatus?: number;
    intelStatus?: number;
    wrongIntel?: boolean;
    heldRead?: () => Promise<void>;
    csvUnknown?: boolean;
    heldWrite?: () => Promise<void>;
  } = {},
) {
  const unexpected = await installFixtures(page);
  let saved = structuredClone(toolsClient);
  const calls = {
    gets: 0,
    puts: 0,
    imports: 0,
    intel: 0,
    bodies: [] as unknown[],
  };
  await page.route("**/api/backend/core/me", (route) =>
    json(route, {
      user: { id: "user-test", email: "test@example.test" },
      tenant: { id: toolsTenantId, name: "Synthetic UI tenant" },
      role: options.role ?? "user_admin",
    }),
  );
  await page.route(`**/api/backend/core/clients/${clientId}`, async (route) => {
    if (route.request().method() === "PUT") {
      calls.puts++;
      if (options.heldWrite) await options.heldWrite();
      const body = route.request().postDataJSON();
      calls.bodies.push(body);
      if (options.tagStatus)
        return json(
          route,
          { message: "Synthetic save failure" },
          options.tagStatus,
        );
      saved = { ...saved, intakeData: body.intakeData };
      return json(route, saved);
    }
    calls.gets++;
    if (calls.gets > 1 && options.heldRead) await options.heldRead();
    return json(route, saved);
  });
  await page.route(
    `**/api/backend/core/intelligence/client-profile/${clientId}`,
    (route) => {
      calls.intel++;
      return options.intelStatus
        ? json(
            route,
            { message: "Synthetic source failure" },
            options.intelStatus,
          )
        : json(
            route,
            options.wrongIntel
              ? {
                  ...toolsIntelligence,
                  client: { ...toolsIntelligence.client, id: toolsTenantId },
                }
              : toolsIntelligence,
          );
    },
  );
  await page.route("**/api/backend/core/clients/bulk-import", async (route) => {
    calls.imports++;
    if (options.heldWrite) await options.heldWrite();
    calls.bodies.push(route.request().postDataJSON());
    return options.csvUnknown
      ? json(route, { message: "Synthetic lost receipt" }, 503)
      : json(route, {
          created: 1,
          total: 2,
          errors: [{ row: 1, message: "Synthetic client slot limit" }],
          items: [{ id: clientId, name: "Alpha" }],
        });
  });
  return { calls, unexpected, current: () => saved };
}
