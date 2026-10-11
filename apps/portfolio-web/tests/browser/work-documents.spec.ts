import { test, expect } from "@playwright/test";
import { client, clientId, installFixtures, json } from "./fixtures";

const draftId = "91000000-0000-4000-8000-000000000001";
const completeId = "91000000-0000-4000-8000-000000000002";
const drafts = [
  {
    id: draftId,
    docTitle: "Synthetic briefing draft",
    client: client.name,
    product: "Briefing",
    ownerId: "synthetic-user",
    status: "draft",
    updatedAt: "2026-10-08T12:00:00Z",
  },
  {
    id: completeId,
    docTitle: "Synthetic completed letter",
    client: client.name,
    product: "Letter",
    ownerId: "synthetic-user",
    status: "complete",
    updatedAt: "2026-10-09T12:00:00Z",
  },
];

test("client Work opens typed Workspace drafts through the canonical editor route", async ({
  page,
}, testInfo) => {
  const unexpected = await installFixtures(page);
  await page.route("**/workspace/drafts?scope=all", (route) =>
    json(route, {
      drafts: [
        ...drafts,
        {
          ...drafts[0],
          id: "91000000-0000-4000-8000-000000000003",
          client: null,
        },
      ],
    }),
  );
  await page.goto(`/portfolio/${clientId}/work`);
  await expect(
    page.getByRole("link", { name: "Open Strategies" }),
  ).toHaveAttribute(
    "href",
    `http://127.0.0.1:5191/existing/strategies?clientId=${clientId}`,
  );
  await expect(
    page.getByRole("link", { name: "New strategy" }),
  ).toHaveAttribute(
    "href",
    `http://127.0.0.1:5191/existing/strategies/new?clientId=${clientId}`,
  );
  for (const [id, title, status] of [
    [draftId, "Synthetic briefing draft", "Draft"],
    [completeId, "Synthetic completed letter", "Completed"],
  ] as const) {
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row.getByText(status, { exact: true })).toBeVisible();
    await expect(
      row.getByRole("link", { name: "Open Workspace" }),
    ).toHaveAttribute("href", `http://127.0.0.1:5191/existing/workspace/${id}`);
  }
  await expect(page.getByRole("row")).toHaveCount(3);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("client-work-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(18, 18, 18)",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("client-work-mobile-dark.png"),
    fullPage: true,
  });
  expect(unexpected).toEqual([]);
});

test("client Work withholds legacy name matches when accessible clients collide", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  await page.route("**/workspace/drafts?scope=all", (route) =>
    json(route, { drafts }),
  );
  await page.route("**/core/clients", (route) =>
    json(route, [
      client,
      { ...client, id: "10000000-0000-4000-8000-000000000002" },
    ]),
  );
  await page.goto(`/portfolio/${clientId}/work`);
  await expect(
    page.getByText(/name is shared by multiple clients/),
  ).toBeVisible();
  await expect(page.getByText("Synthetic briefing draft")).toHaveCount(0);
  await expect(page.getByText("Synthetic completed letter")).toHaveCount(0);
  expect(unexpected).toEqual([]);
});
