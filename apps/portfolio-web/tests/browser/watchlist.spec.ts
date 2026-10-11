import { test, expect } from "@playwright/test";
import { installFixtures, json, clientId } from "./fixtures";
const topic = {
  id: "stable-topic",
  label: "Test topic",
  issueArea: "Defense",
  position: "monitor",
  priority: "high",
  terms: [{ termType: "agency", value: "Test Department" }],
};
const record = {
  clientId,
  issueAreas: ["Defense"],
  jurisdictions: ["VA"],
  topics: [topic],
  version: 7,
  updatedByName: "Test user",
};
async function installWatchlist(page: import("@playwright/test").Page) {
  const unexpected = await installFixtures(page);
  await page.route("**/tracker/issue-areas", (route) =>
    json(route, { issueAreas: ["Defense", "Health"] }),
  );
  await page.route("**/legiwatch/bills/corpus-metadata", (route) =>
    json(route, {
      jurisdictions: [
        { key: "US", count: 1 },
        { key: "VA", count: 1 },
      ],
    }),
  );
  return unexpected;
}
test("watchlist conflicts retain edits; partial rejection updates the version without claiming complete success", async ({
  page,
}) => {
  const unexpected = await installWatchlist(page);
  let writes = 0;
  await page.route(`**/tracker/watchlists/${clientId}`, async (route) => {
    if (route.request().method() === "GET") return json(route, record);
    const body = route.request().postDataJSON();
    writes++;
    expect(body.topics[0].id).toBe("stable-topic");
    expect(body.jurisdictions).toEqual(["VA"]);
    if (writes === 1) {
      expect(body.expectedVersion).toBe(7);
      expect(body.topics[0].renameFrom).toBe("Test topic");
      return json(
        route,
        { message: "Targeting changed; reload saved values" },
        409,
      );
    }
    if (writes === 2)
      return json(route, {
        ...record,
        version: 8,
        topics: [{ ...topic, label: "Renamed topic", terms: [] }],
        rejected: {
          topics: [],
          terms: [
            {
              topicLabel: "Renamed topic",
              value: "xx",
              termType: "agency",
              reason: "Term too short",
            },
          ],
        },
      });
    expect(body.expectedVersion).toBe(8);
    expect(body.topics[0]).not.toHaveProperty("renameFrom");
    expect(body.topics[0].terms[0].value).toBe("Test Department");
    return json(route, {
      ...record,
      version: 9,
      topics: [{ ...topic, label: "Renamed topic" }],
    });
  });
  await page.goto(`/portfolio/${clientId}/bills`);
  await page.getByRole("button", { name: "Configure", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Configure Bill Tracker" });
  await dialog.getByLabel("Topic name", { exact: true }).fill("Renamed topic");
  await dialog.getByLabel("Term value", { exact: true }).fill("xx");
  await dialog.getByRole("button", { name: "Save targeting" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Targeting changed");
  await expect(dialog.getByLabel("Topic name", { exact: true })).toHaveValue(
    "Renamed topic",
  );
  expect(writes).toBe(1);
  await dialog.getByRole("button", { name: "Save targeting" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Some entries were rejected",
  );
  await expect(dialog.getByLabel("Term value", { exact: true })).toHaveValue(
    "xx",
  );
  await dialog
    .getByLabel("Term value", { exact: true })
    .fill("Test Department");
  await dialog.getByRole("button", { name: "Save targeting" }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toBe(3);
  expect(unexpected).toEqual([]);
});
test("ordinary Intel users can inspect targeting and cannot save shared changes", async ({
  page,
}) => {
  const unexpected = await installWatchlist(page);
  await page.route(`**/tracker/watchlists/${clientId}`, (route) =>
    json(route, record),
  );
  await page.route("**/core/me", (route) =>
    json(route, {
      user: { id: "test", email: "test@example.test" },
      tenant: { id: "tenant", name: "Test" },
      role: "standard_user",
    }),
  );
  await page.goto(`/portfolio/${clientId}/bills`);
  await page.getByRole("button", { name: "Configure", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Configure Bill Tracker" });
  await expect(dialog.getByLabel("Topic name", { exact: true })).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Save targeting" }),
  ).toHaveCount(0);
  expect(unexpected).toEqual([]);
});
