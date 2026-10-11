import { test, expect } from "@playwright/test";
import { installFixtures, json, prospect, prospectId } from "./fixtures";
const catalog = {
  version: "portfolio-3.1",
  createStage: "identified",
  legacyMapping: "pending",
  allowLegacyTransitions: false,
  stages: [
    "identified",
    "initiated",
    "engaged",
    "proposal",
    "negotiation",
    "closed_won",
    "closed_lost",
  ].map((value) => ({
    value,
    label:
      value === "closed_won"
        ? "Closed won"
        : value === "closed_lost"
          ? "Closed lost"
          : value.charAt(0).toUpperCase() + value.slice(1),
  })),
};
test("old backend preserves reads and company edits while new creates stay unavailable", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let writes = 0;
  await page.route(
    `**/business-development/prospects/${prospectId}`,
    async (route) => {
      if (route.request().method() === "GET") return json(route, prospect);
      writes++;
      const body = route.request().postDataJSON();
      expect(body).not.toHaveProperty("stage");
      expect(body.displayName).toBe("Edited company");
      return json(route, { message: "Test save unavailable" }, 503);
    },
  );
  await page.goto("/portfolio/prospects?new=1");
  const create = page.getByRole("dialog", { name: "Add prospect" });
  await expect(
    create.getByRole("button", { name: "Create prospect" }),
  ).toBeDisabled();
  await create.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("link", { name: /Test Prospect/ }).click();
  await page.getByRole("button", { name: "Edit details" }).click();
  const edit = page.getByRole("dialog", { name: "Edit company details" });
  await edit.getByLabel("Company name").fill("Edited company");
  await edit.getByRole("button", { name: "Save company details" }).click();
  await expect(edit.getByRole("alert")).toBeVisible();
  await expect(edit.getByLabel("Company name")).toHaveValue("Edited company");
  expect(writes).toBe(1);
  expect(unexpected).toEqual([]);
});
test("new catalog creates identified and closed won changes only stage, then refreshes pipeline", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let record = { ...prospect };
  const writes: { method: string; body: Record<string, unknown> }[] = [];
  await page.route("**/business-development/prospect-stages", (route) =>
    json(route, catalog),
  );
  await page.route("**/business-development/prospects**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method === "GET") {
      if (url.pathname.endsWith("/history")) return json(route, []);
      if (url.pathname.endsWith(prospectId)) return json(route, record);
      return json(route, {
        prospects: [record],
        counts: {
          visible: 1,
          total: 1,
          active: 1,
          dismissed: 0,
          byStage: { [record.stage]: 1 },
        },
      });
    }
    const body = route.request().postDataJSON();
    writes.push({ method, body });
    if (method === "POST") expect(body.stage).toBe("identified");
    else expect(body).toEqual({ stage: "closed_won" });
    record = { ...record, ...body };
    return json(route, record);
  });
  await page.goto("/portfolio/prospects?new=1");
  const create = page.getByRole("dialog", { name: "Add prospect" });
  await create.getByLabel("Company name").fill("New company");
  await create.getByRole("button", { name: "Create prospect" }).click();
  await expect(
    page.getByRole("heading", { name: "New company", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Change stage", exact: true }).click();
  const change = page.getByRole("dialog", { name: "Change prospect stage" });
  await change.getByLabel("New stage").selectOption("closed_won");
  await expect(change).toContainText(
    "Client conversion and billing require separate actions",
  );
  await change.getByRole("button", { name: "Confirm stage" }).click();
  await expect(change).not.toBeVisible();
  await page.getByRole("link", { name: "← Prospects" }).click();
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  const pipeline = page.getByRole("dialog", { name: "Prospects pipeline" });
  await expect(
    pipeline.getByRole("heading", { name: "Closed won", exact: true }),
  ).toBeVisible();
  await expect(
    pipeline.getByRole("link", { name: "New company", exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(unexpected).toEqual([]);
});
test("legacy stages remain unmapped and note failures preserve entered text", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let notes = 0;
  await page.route("**/business-development/prospect-stages", (route) =>
    json(route, catalog),
  );
  await page.route(`**/business-development/prospects/${prospectId}`, (route) =>
    json(route, { ...prospect, stage: "outreach" }),
  );
  await page.route(
    `**/business-development/prospects/${prospectId}/notes`,
    (route) => {
      notes++;
      return json(route, { message: "Test note unavailable" }, 503);
    },
  );
  await page.goto(`/portfolio/prospects/${prospectId}`);
  await page.getByRole("button", { name: "Change stage", exact: true }).click();
  const change = page.getByRole("dialog", { name: "Change prospect stage" });
  await expect(change.getByLabel("New stage")).toBeDisabled();
  await expect(
    change.getByRole("button", { name: "Confirm stage" }),
  ).toBeDisabled();
  await change.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Add note" }).click();
  const note = page.getByRole("dialog", { name: "Add prospect note" });
  await note.getByLabel("Note", { exact: true }).fill("Preserve this note");
  await note.getByRole("button", { name: "Save note" }).click();
  await expect(note.getByRole("alert")).toBeVisible();
  await expect(note.getByLabel("Note", { exact: true })).toHaveValue(
    "Preserve this note",
  );
  expect(notes).toBe(1);
  expect(unexpected).toEqual([]);
});
