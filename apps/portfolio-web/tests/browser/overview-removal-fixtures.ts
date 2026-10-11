import type { Page } from "@playwright/test";
import { clientId, installFixtures, json } from "./fixtures";
export const actorId = "a1000000-0000-4000-8000-000000000001";
export const tenantId = "a1000000-0000-4000-8000-000000000002";
export const activityId = "a1000000-0000-4000-8000-000000000003";
export const historyId = "a1000000-0000-4000-8000-000000000004";
export const savedSubmission = {
  id: historyId,
  tenantId,
  clientId,
  capabilityId: null,
  fiscalYear: "FY26",
  title: "Synthetic saved submission",
  meta: "Saved source context",
  outcome: "Submitted for review",
  outcomeType: "in_progress",
  notes: "Saved qualification notes",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};
export const savedActivity = {
  id: activityId,
  tenantId,
  clientId,
  actorUserId: actorId,
  createdByUserId: actorId,
  kind: "note",
  title: "Synthetic quick note",
  body: "Only this entry can be undone",
  personId: null,
  occurredAt: "2026-10-11T08:00:00Z",
  pinned: false,
  dueAt: null,
  settledAt: null,
  sourceType: null,
  sourceId: null,
};
export async function installRemoval(page: Page) {
  const unexpected = await installFixtures(page);
  const state = {
    history: [{ ...savedSubmission }],
    activities: [
      {
        ...savedActivity,
        id: historyId,
        title: "Unrelated newer note",
        origin: "recorded",
      },
    ],
    deletes: [] as string[],
    posts: 0,
    historyGets: 0,
    activityGets: 0,
    mode: "ok",
    role: "user_admin",
    holdHistory: false,
    release: () => {},
  };
  await page.route("**/api/backend/core/me", (route) =>
    json(route, {
      user: { id: actorId, email: "test@example.test" },
      tenant: { id: tenantId, name: "Synthetic tenant" },
      role: state.role,
    }),
  );
  await page.route(
    `**/api/backend/core/clients/${clientId}/submission-history`,
    async (route) => {
      state.historyGets++;
      if (state.holdHistory)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      return json(route, state.history);
    },
  );
  await page.route(
    `**/api/backend/core/clients/${clientId}/history/*`,
    async (route) => {
      state.deletes.push(route.request().url());
      if (state.mode === "rejected")
        return json(
          route,
          { message: "Could not remove this submission. Try again." },
          400,
        );
      if (state.mode !== "wrongAck") state.history = [];
      return json(
        route,
        state.mode === "wrongAck" ? { ok: true } : { deleted: true },
      );
    },
  );
  await page.route(
    `**/api/backend/core/clients/${clientId}/activity*`,
    async (route) => {
      if (route.request().method() === "GET") {
        state.activityGets++;
        return json(route, state.activities);
      }
      state.posts++;
      const body = route.request().postDataJSON();
      const row = {
        ...savedActivity,
        id:
          state.posts === 1
            ? activityId
            : "a1000000-0000-4000-8000-000000000005",
        ...body,
      };
      state.activities.push({ ...row, origin: "recorded" });
      return json(
        route,
        state.mode === "wrongCreate"
          ? { ...row, createdByUserId: historyId }
          : row,
      );
    },
  );
  await page.route(
    `**/api/backend/core/clients/${clientId}/activity/*`,
    async (route) => {
      state.deletes.push(route.request().url());
      state.activities = state.activities.filter(
        (row) => row.id !== activityId,
      );
      if (state.mode === "lostDelete") return route.abort("failed");
      return json(route, { ok: true });
    },
  );
  return { state, unexpected };
}
