import type { Page } from "@playwright/test";
import { clientId, installFixtures, json } from "./fixtures";
export const sourceId = "a0000000-0000-4000-8000-000000000001";
export const targetId = "a0000000-0000-4000-8000-000000000002";
export const recordId = "b0000000-0000-4000-8000-000000000001";
export const sourceTitle = "Synthetic source matter";
export const targetTitle = "Synthetic destination matter";
export const recordTitle = "Synthetic advocacy evidence";
export async function installAdvocacy(page: Page) {
  const unexpected = await installFixtures(page);
  const state = {
    recordMatterId: sourceId as string | null,
    rejected: false,
    locked: false,
    merged: false,
    sourceSummary: "Synthetic source matter summary",
    sourceUrl: "https://example.test/verified-source",
    mode: "normal" as "normal" | "fail" | "apply-fail",
    postGate: null as Promise<void> | null,
    getGate: null as Promise<void> | null,
    gatedGets: 0,
    completedGatedGets: 0,
    posts: [] as { path: string; body: unknown }[],
    gets: [] as string[],
  };
  const record = () => ({
    id: recordId,
    recordType: "meeting",
    title: recordTitle,
    summary: "Synthetic evidence summary",
    activityDate: "2026-10-10T12:00:00Z",
    sourceType: "meeting",
    sourceId: "synthetic-source-id",
    sourceUrl: state.sourceUrl,
    evidenceClass: "INFERRED",
    confidence: 0.74,
    outcome: null,
    status: "observed",
    matterLocked: state.locked,
    metadata: {
      presentation: {
        sourceTitle: "Original synthetic source title",
        sourceStatus: "source-observed",
      },
    },
  });
  const link = {
    id: "c0000000-0000-4000-8000-000000000001",
    linkType: "meeting",
    label: "Synthetic linked meeting",
    linkKey: "synthetic-meeting",
  };
  const detail = (id: string) => {
    const records =
      !state.rejected && state.recordMatterId === id ? [record()] : [];
    const links =
      id === sourceId || (state.merged && id === targetId) ? [link] : [];
    return {
      id,
      title: id === sourceId ? sourceTitle : targetTitle,
      matterType: "other",
      status: "active",
      summary:
        id === sourceId ? state.sourceSummary : "Synthetic destination summary",
      openedAt: null,
      lastActivityAt: null,
      recordCount: records.length,
      outcomeCount: 0,
      linkCount: links.length,
      records,
      links,
      updatedAt: "2026-10-10T12:00:00Z",
    };
  };
  await page.route(
    `**/api/backend/core/clients/${clientId}/advocacy-matters**`,
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.split("/advocacy-matters")[1] ?? "";
      if (route.request().method() === "GET") {
        state.gets.push(path);
        if (path === `/${sourceId}` && state.getGate) {
          state.gatedGets += 1;
          await state.getGate;
          state.completedGatedGets += 1;
        }
        if (!path)
          return json(
            route,
            state.merged
              ? [detail(targetId)]
              : [detail(sourceId), detail(targetId)],
          );
        if (path === "/timeline")
          return json(
            route,
            state.rejected
              ? []
              : [
                  {
                    id: recordId,
                    kind: "record",
                    title: recordTitle,
                    subtype: "meeting",
                    date: "2026-10-10T12:00:00Z",
                    evidenceClass: "INFERRED",
                    confidence: 0.74,
                    matterId: state.recordMatterId,
                    matterTitle:
                      state.recordMatterId === sourceId
                        ? sourceTitle
                        : state.recordMatterId === targetId
                          ? targetTitle
                          : null,
                  },
                ],
          );
        if (path === `/${sourceId}` && state.merged)
          return json(route, { message: "Source matter removed" }, 404);
        return json(route, detail(path.slice(1)));
      }
      const body: unknown = route.request().postData()
        ? route.request().postDataJSON()
        : undefined;
      state.posts.push({ path, body });
      if (state.postGate) await state.postGate;
      if (state.mode !== "fail") {
        state.locked = true;
        if (path.endsWith("/merge")) {
          state.merged = true;
          state.recordMatterId = targetId;
        } else if (path.endsWith("/reassign")) state.recordMatterId = targetId;
        else if (path.endsWith("/detach")) state.recordMatterId = null;
        else if (path.endsWith("/not-advocacy")) {
          state.rejected = true;
          state.recordMatterId = null;
        }
      }
      if (state.mode !== "normal")
        return json(route, { message: "Synthetic response lost" }, 503);
      return route.fulfill({ status: 201, body: "" });
    },
  );
  return { state, unexpected };
}
