import type { Page } from "@playwright/test";
import { clientId, installFixtures, json } from "./fixtures";
import {
  runSchema,
  type FillRun,
} from "../../src/features/client-profile/enrichment/contracts";
export const runId = "e0000000-0000-4000-8000-000000000001";
export const findingId = "e0000000-0000-4000-8000-000000000002";
export const advocacyId = "e0000000-0000-4000-8000-000000000003";
export const matterId = "e0000000-0000-4000-8000-000000000004";
export function syntheticRun(): FillRun {
  const finding = {
    id: findingId,
    runId,
    clientId,
    kind: "profile_field",
    targetKey: "description",
    source: "public_web",
    factKind: "fact",
    currentValue: "Saved company description",
    proposedValue: "Synthetic reviewed company description",
    evidence: [
      {
        label: "Synthetic company source",
        source: "Company website",
        url: "https://example.test/source",
        excerpt: "Synthetic evidence for component qualification.",
      },
    ],
    confidence: 0.85,
    status: "pending",
    appliedAt: null,
    createdAt: "2026-10-11T07:00:00Z",
  };
  return runSchema.parse({
    id: runId,
    clientId,
    status: "completed",
    stage: "review_ready",
    requestedSources: ["public_web", "lda"],
    sourceStates: {
      public_web: { status: "completed", count: 1 },
      lda: { status: "completed", count: 1 },
    },
    summary: {},
    workflowVersion: 2,
    attachmentIds: [],
    selectedLdaIds: [12],
    setup: {
      website: "https://example.test",
      sources: ["public_web", "lda"],
      attachmentIds: [],
      selectedLdaIds: [12],
    },
    error: null,
    startedAt: "2026-10-11T07:00:00Z",
    completedAt: "2026-10-11T07:01:00Z",
    tasks: [
      {
        id: "e0000000-0000-4000-8000-000000000005",
        runId,
        clientId,
        taskType: "public_web",
        taskKey: "public_web",
        status: "completed",
        attempt: 1,
        maxAttempts: 3,
        errorCode: null,
        errorMessage: null,
        outputSummary: { count: 1 },
        nextAttemptAt: null,
      },
    ],
    findings: [
      finding,
      {
        ...finding,
        id: advocacyId,
        kind: "advocacy_record",
        targetKey: "Synthetic advocacy matter",
        source: "advocacy_history",
        currentValue: null,
        proposedValue: {
          title: "Synthetic advocacy evidence",
          recordType: "lobbying",
          activityDate: "2026-08-01",
          sourceType: "lda",
          sourceId: "synthetic-filing",
          externalKey: "lda:synthetic",
          summary: "Synthetic saved filing evidence",
        },
      },
      {
        ...finding,
        id: "e0000000-0000-4000-8000-000000000006",
        kind: "profile_completion",
        targetKey: "Profile completion",
        status: "informational",
        currentValue: null,
        proposedValue: { missing: ["facilities"], score: 70 },
      },
      {
        ...finding,
        id: "e0000000-0000-4000-8000-000000000007",
        targetKey: "Ignored synthetic finding",
        status: "rejected",
        rejectionReason: "Duplicate evidence",
      },
    ],
  });
}
export async function installEnrichment(page: Page) {
  const unexpected = await installFixtures(page);
  const state = {
    run: syntheticRun() as FillRun | null,
    posts: [] as { path: string; body: Record<string, unknown> }[],
    mode: "normal" as
      | "normal"
      | "lost"
      | "partial"
      | "wrong-client"
      | "wrong-assignment"
      | "drift"
      | "load-fail",
    runGate: null as Promise<void> | null,
    runGets: 0,
    latestGets: 0,
    role: "user_admin",
  };
  await page.route("**/api/backend/core/me", (route) =>
    json(route, {
      user: { id: "user-test", email: "test@example.test" },
      tenant: { id: "tenant-test", name: "UI tests" },
      role: state.role,
    }),
  );
  await page.route(
    `**/api/backend/core/clients/${clientId}/advocacy-matters`,
    (route) =>
      json(route, [
        {
          id: matterId,
          title: "Synthetic saved matter",
          matterType: "legislative",
          status: "active",
          summary: null,
          openedAt: null,
          lastActivityAt: null,
          recordCount: 0,
          outcomeCount: 0,
          linkCount: 0,
        },
      ]),
  );
  await page.route(
    `**/api/backend/core/clients/${clientId}/fill-with-meri/**`,
    async (route) => {
      const path =
        new URL(route.request().url()).pathname.split("/fill-with-meri/")[1] ??
        "";
      if (route.request().method() === "GET") {
        if (path === "latest") state.latestGets++;
        if (path === "setup")
          return json(route, {
            clientId,
            clientName: "Test Aerospace",
            website: "https://example.test",
            selectedIdentities: [
              {
                id: 12,
                name: "Synthetic imported identity",
                selected: true,
                origin: "imported",
              },
            ],
            suggestedIdentities: [],
            taskPreview: ["Public web", "LDA"],
          });
        if (state.mode === "load-fail")
          return json(route, { message: "Synthetic unavailable review" }, 503);
        if (path === `runs/${runId}`) {
          state.runGets++;
          if (state.runGate) await state.runGate;
        }
        const run = structuredClone(state.run);
        if (run && state.mode === "wrong-client") {
          run.clientId = runId;
          run.findings = run.findings.map((f) => ({ ...f, clientId: runId }));
          run.tasks = run.tasks?.map((t) => ({ ...t, clientId: runId }));
        }
        if (run && state.mode === "drift" && path.startsWith("runs/"))
          run.findings[0]!.proposedValue = "Changed after review";
        return json(route, run).catch(() => {});
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.posts.push({ path, body });
      if (!state.run) return json(route, { message: "Run unavailable" }, 404);
      if (path.endsWith("/apply"))
        for (const f of state.run.findings)
          if (
            Array.isArray(body.findingIds) &&
            body.findingIds.includes(f.id) &&
            !(state.mode === "partial" && f.id === advocacyId)
          )
            f.status = "accepted";
      if (path.endsWith("/cancel")) state.run.status = "cancelled";
      if (path.endsWith("/reject")) {
        const f = state.run.findings.find((f) => path.includes(f.id));
        if (f) f.status = "rejected";
      }
      if (path.endsWith("/restore")) {
        const f = state.run.findings.find((f) => path.includes(f.id));
        if (f) f.status = "pending";
      }
      if (path.endsWith("/assign-matter")) {
        const f = state.run.findings.find((f) => path.includes(f.id));
        if (f) f.status = "accepted";
        if (state.mode === "lost") return route.abort("failed");
        return json(route, {
          findingId: advocacyId,
          matterId: state.mode === "wrong-assignment" ? runId : matterId,
          alreadyApplied: false,
        });
      }
      if (state.mode === "lost") return route.abort("failed");
      return json(
        route,
        path.endsWith("/reject") || path.endsWith("/restore")
          ? { ok: true }
          : state.run,
      );
    },
  );
  return { state, unexpected };
}
