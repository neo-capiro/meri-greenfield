import { test, expect } from "@playwright/test";
import { clientId, installFixtures, json, objective } from "./fixtures";

test("an unrelated create receipt never transitions or closes the objective editor", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  const writes: string[] = [];
  await page.route(`**/clients/${clientId}/objectives**`, async (route) => {
    if (route.request().method() === "GET") return json(route, []);
    writes.push(route.request().url());
    return json(route, {
      ...objective,
      ...route.request().postDataJSON(),
      clientId: "10000000-0000-4000-8000-000000000002",
    });
  });
  await page.goto(`/portfolio/${clientId}/objectives?new=1`);
  const editor = page.getByRole("dialog", { name: "New objective" });
  await editor.getByLabel(/^Outcome/).fill("Reviewed outcome");
  await editor.getByLabel(/^Government problem/).fill("Reviewed problem");
  await editor.getByLabel("Ask type").selectOption("funding");
  await editor.getByLabel(/^Minimum win/).fill("Reviewed minimum");
  await editor.getByRole("button", { name: "Request review" }).click();
  await expect(editor.getByRole("alert")).toContainText(
    "did not confirm this exact objective operation",
  );
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel(/^Outcome/)).toHaveValue("Reviewed outcome");
  expect(writes).toHaveLength(1);
  expect(writes[0]).not.toContain("transition");
  expect(unexpected).toEqual([]);
});

test("a false deletion receipt remains an error until the service confirms the exact operation", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let removed = false,
    writes = 0;
  await page.route(`**/clients/${clientId}/objectives**`, async (route) => {
    if (route.request().method() === "GET")
      return json(route, removed ? [] : [objective]);
    expect(route.request().method()).toBe("DELETE");
    writes++;
    expect(route.request().postDataJSON()).toEqual({
      expectedVersion: objective.version,
    });
    if (writes === 1)
      return json(route, {
        id: objective.id,
        deleted: false,
        version: objective.version + 1,
      });
    removed = true;
    return json(route, {
      id: objective.id,
      deleted: true,
      version: objective.version + 1,
    });
  });
  await page.goto(`/portfolio/${clientId}/objectives`);
  await page
    .getByRole("button", { name: `Delete ${objective.outcome}`, exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Delete objective" });
  await dialog
    .getByRole("button", { name: "Delete objective", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog).toBeVisible();
  expect(writes).toBe(1);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open objective", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Delete ${objective.outcome}`, exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Delete objective", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("No current objectives", { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(2);
  expect(unexpected).toEqual([]);
});

test("a wrong-client objective list is refused before content or edit actions render", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  await page.route(`**/clients/${clientId}/objectives`, (route) =>
    json(route, [
      {
        ...objective,
        outcome: "Unrelated private outcome",
        clientId: "10000000-0000-4000-8000-000000000002",
      },
    ]),
  );
  await page.goto(`/portfolio/${clientId}/objectives`);
  await expect(page.getByRole("alert")).toContainText("unexpected response");
  await expect(page.getByText("Unrelated private outcome")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open objective" }),
  ).toHaveCount(0);
  expect(unexpected).toEqual([]);
});
