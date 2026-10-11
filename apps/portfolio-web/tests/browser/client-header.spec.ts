import { test, expect } from "@playwright/test";
import { clientId, installFixtures } from "./fixtures";
test("client header supports keyboard navigation and scoped quick-add deep links", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  await page.goto(`/portfolio/${clientId}/work`);
  await expect(
    page.getByRole("button", { name: "Switch client view: Work", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+j");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Objectives", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${clientId}/objectives$`));
  await page.getByRole("button", { name: "Quick add", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "New meeting", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`${clientId}/calendar\\?new=meeting$`),
  );
  const meeting = page.getByRole("dialog", {
    name: "New meeting",
    exact: true,
  });
  await expect(meeting).toBeVisible();
  await meeting.getByRole("button", { name: "Close", exact: true }).click();
  await expect(meeting).not.toBeVisible();
  await expect(page).not.toHaveURL(/new=/);
  await page.getByRole("button", { name: "Quick add", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Account notes", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${clientId}\\?notes=1$`));
  await expect(
    page.getByRole("dialog", { name: "Profile notes", exact: true }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});
