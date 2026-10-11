import type { Page, Route } from "@playwright/test";
import type { Prospect } from "../../src/features/prospects/contracts";
export const clientId = "10000000-0000-4000-8000-000000000001";
export const personId = "20000000-0000-4000-8000-000000000001";
export const opportunity = {
  id: "sam_gov:notice/one",
  source: "sam_gov" as const,
  sourceRecordId: "notice/one",
  title: "Test opportunity",
  agency: "Test agency",
  type: "contract" as const,
  lifecycle: "active" as const,
  deadline: "2026-10-24",
  summary: "Synthetic record",
  value: 1250000,
  valueBasis: "source_backed" as const,
  relevanceScore: 0.8,
  matchedSignals: [
    {
      signal: "sensor",
      strength: "strong" as const,
      matchedOn: "Test sensor capability",
    },
  ],
  eligibility: {
    state: "needs_review" as const,
    reason: "Review source requirements",
  },
  clientId,
  decoration: {
    workflow: { available: true, status: "pursuing", unavailableReason: null },
    bookmark: { saved: true, scope: "client" as const, clientId },
    capabilities: {
      save: { allowed: true, reason: "Allowed" },
      pursue: { allowed: false, reason: "Review required" },
    },
  },
};
export const opportunitySearch = {
  opportunities: [opportunity],
  page: 1,
  pageSize: 20,
  total: 1,
  totalIsCapped: false,
  catalogComplete: true,
  counts: { active: 1, grants: 0, contracts: 1, closed: 0 },
  mode: "matched",
  clientId,
  freshness: [
    {
      source: "sam_gov",
      state: "current",
      lastSyncedAt: "2026-10-10T12:00:00Z",
    },
  ],
  profileGaps: null,
  generatedAt: "2026-10-11T12:00:00Z",
};
export const objectiveId = "30000000-0000-4000-8000-000000000001";
export const capabilityId = "40000000-0000-4000-8000-000000000001";
export const prospectId = "70000000-0000-4000-8000-000000000001";
export const prospect: Prospect = {
  id: prospectId,
  displayName: "Test Prospect",
  domain: "prospect.test",
  website: "https://prospect.test",
  description: "Synthetic prospect for isolated validation.",
  serviceHypothesis: "Advocacy",
  geography: "Virginia",
  ownerUserId: null,
  stage: "proposal",
  status: "active",
  nextAction: "Review proposal",
  nextActionDueAt: "2026-11-05T14:00:00Z",
  linkedClientId: null,
  convertedAt: null,
  createdAt: "2026-10-01T12:00:00Z",
  updatedAt: "2026-10-01T12:00:00Z",
};
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
      "core/billing/state": {
        billingEnabled: false,
        status: "none",
        slots: 0,
        usedSlots: 1,
        trialEndsAt: null,
        onboardingFlowVersion: 1,
        locked: false,
      },
      "core/clients": [client],
      "core/intelligence/portfolio-alerts": {
        alerts: [],
        total: 0,
        clientCount: 1,
        generatedAt: "2026-10-11T06:00:00Z",
      },
      [`core/clients/${clientId}`]: client,
      "core/client-account-owners": {},
      "core/client-account-owners/options": [],
      "core/me": {
        user: { id: "user-test", email: "test@example.test" },
        tenant: { id: "tenant-test", name: "UI tests" },
        role: "user_admin",
      },
      "core/business-development/prospect-stages": null,
      "core/business-development/prospects": {
        prospects: [prospect],
        counts: {
          visible: 1,
          total: 1,
          active: 1,
          dismissed: 0,
          byStage: { proposal: 1 },
        },
      },
      [`core/business-development/prospects/${prospectId}`]: prospect,
      [`core/business-development/prospects/${prospectId}/history`]: [],
      [`core/business-development/prospects/${prospectId}/brief`]: {
        brief: null,
        currentVersion: null,
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
      "core/engagement/capabilities": {
        meetingPrepComprehensiveEnabled: false,
        runtime: { externalActionsEnabled: false },
      },
      "core/me/email-signature": { html: null, enabled: false },
      "core/intelligence/opportunities/v2/search": opportunitySearch,
      [`core/intelligence/clients/${clientId}/pe-relevance`]: {
        data: [
          {
            peCode: "0604134A",
            title: "Synthetic test program",
            score: 0.91,
            paths: [
              {
                path: "capability_pe_direct",
                score: 1,
                evidence: ["Explicit capability reference"],
              },
            ],
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      },
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
      [`intelligence/clients/${clientId}/bills/tx-2025-hb1/hearings`]: {
        count: 0,
        hearings: [],
      },
      [`intelligence/clients/${clientId}/tracker/board`]: {
        columns: [
          { id: "introduced", label: "Introduced", cards: [] },
          { id: "committee", label: "In committee", cards: [] },
          { id: "passed", label: "Passed chamber", cards: [] },
          { id: "enacted", label: "Enacted", cards: [] },
        ],
        total: 0,
        nextCursor: null,
        hasMore: false,
        withheld: 0,
      },
    };
    if (path === "core/business-development/prospect-stages")
      return json(route, { message: "New stages unavailable" }, 404);
    if (path === "core/me/portfolio-layout")
      return json(route, { message: "Saved ordering unavailable" }, 404);
    if (path === `core/business-development/prospects/${prospectId}/contacts`)
      return json(route, { message: "Contacts unavailable" }, 404);
    if (path in responses) return json(route, responses[path]);
    unexpected.push(`${method} ${path}`);
    await json(route, { message: "No fixture for this contract" }, 500);
  });
  return unexpected;
}
