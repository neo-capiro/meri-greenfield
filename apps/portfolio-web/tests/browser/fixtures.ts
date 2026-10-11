import type { Page, Route } from "@playwright/test";
export const clientId = "10000000-0000-4000-8000-000000000001";
export const personId = "20000000-0000-4000-8000-000000000001";
export const objectiveId = "30000000-0000-4000-8000-000000000001";
export const capabilityId = "40000000-0000-4000-8000-000000000001";
export const client = {
  id: clientId,
  name: "Test Aerospace",
  profileType: "CLIENT",
  profileStatus: "ACTIVE",
  status: "ACTIVE",
  sectorTag: "Aerospace",
  description: "Synthetic organization for isolated UI validation.",
  website: "https://example.test",
  intakeData: {},
  setAsideCertifications: ["LEGACY_CODE"],
};
export const person = {
  id: personId,
  clientId,
  name: "Taylor Test",
  title: "Director",
  email: "taylor@example.test",
  phone: null,
  role: null,
  notes: null,
  hierarchyLevel: "leadership",
  reportsToPersonId: null,
  placementSource: "manual",
  reviewRequired: false,
  createdAt: "2026-10-01T12:00:00Z",
};
export const objective = {
  id: objectiveId,
  clientId,
  requestId: "50000000-0000-4000-8000-000000000001",
  ownerUserId: "user-test",
  outcome: "Test outcome",
  governmentProblem: "Test problem",
  askType: "funding",
  minimumWin: "Test minimum win",
  limits: "",
  status: "draft",
  version: 1,
  readyAt: null,
  reviewRequestedAt: null,
  createdAt: "2026-10-01T12:00:00Z",
  updatedAt: "2026-10-01T12:00:00Z",
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
export const capability = {
  id: capabilityId,
  name: "Test sensor",
  type: "product",
  description: "Synthetic capability",
  sector: "Aerospace",
  tags: [],
  issueCodes: [],
  trl: 7,
  mrl: null,
  peNumber: null,
  peNumbers: [],
  keywords: [],
  notes: null,
};
export const file = {
  id: "60000000-0000-4000-8000-000000000001",
  clientId,
  fileName: "Test report.pdf",
  contentType: "application/pdf",
  byteSize: 512,
  source: "manual",
  folder: "Reports",
  viewerMode: "all",
  viewerUserIds: [],
  uploadedByUserId: null,
  uploadedByName: "Test user",
  createdAt: "2026-10-01T12:00:00Z",
  lifecycleStatus: "quarantined",
  scanStatus: "pending",
  extractionStatus: "pending",
  indexedAt: null,
  usable: false,
  blockedReason: "scan_pending",
  previewUrl: null,
  downloadUrl: null,
};
export async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
export async function installFixtures(page: Page) {
  const unexpected: string[] = [];
  await page.route("**/api/backend/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/backend/", "");
    const method = route.request().method();
    if (method !== "GET") {
      unexpected.push(`${method} ${path}`);
      return json(route, { message: "Unexpected test mutation" }, 500);
    }
    const responses: Record<string, unknown> = {
      "core/clients": [client],
      [`core/clients/${clientId}`]: client,
      "core/client-account-owners": {},
      "core/client-account-owners/options": [],
      "core/me": {
        user: { id: "user-test", email: "test@example.test" },
        tenant: { id: "tenant-test", name: "UI tests" },
        role: "user_admin",
      },
      [`core/clients/${clientId}/people`]: [person],
      [`core/clients/${clientId}/team`]: [],
      [`core/clients/${clientId}/activity`]: [],
      [`core/clients/${clientId}/facilities`]: [],
      [`core/clients/${clientId}/objectives`]: [objective],
      [`core/clients/${clientId}/advocacy-matters`]: [],
      [`core/clients/${clientId}/capabilities`]: [capability],
      [`core/clients/${clientId}/capability-fit`]: {
        status: "empty",
        computedAt: null,
        matches: [],
      },
      "core/engagement/mail-threads": [],
      "core/me/email-signature": { html: null, enabled: false },
      "core/engagement/attachments": [
        file,
        {
          ...file,
          id: "60000000-0000-4000-8000-000000000002",
          fileName: "Program overview.txt",
          lifecycleStatus: "available",
          scanStatus: "clean",
          extractionStatus: "extracted",
          usable: true,
          blockedReason: undefined,
          folder: null,
        },
      ],
      "strategy/strategies": [],
      "workspace/drafts": { drafts: [] },
      "core/engagement/meetings": [],
      "core/legiwatch/live-hearings/calendar": {
        rows: [],
        total: 0,
        page: 1,
        pageSize: 200,
      },
      "strategy/planner/tasks": { items: [], nextCursor: null },
      "core/federal-register/upcoming-deadlines": [],
    };
    if (path in responses) return json(route, responses[path]);
    unexpected.push(`${method} ${path}`);
    await json(route, { message: "No fixture for this contract" }, 500);
  });
  return unexpected;
}
