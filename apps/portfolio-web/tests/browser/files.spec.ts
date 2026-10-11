import { test, expect } from "@playwright/test";
import { installFixtures, json, clientId } from "./fixtures";
const fileId = "60000000-0000-4000-8000-000000000001";
const file = {
  id: fileId,
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
test("Files keeps quarantined bytes unavailable and persists folder moves", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let moved = false;
  await page.route("**/engagement/attachments?**", (route) =>
    json(route, [{ ...file, folder: moved ? "Archive" : "Reports" }]),
  );
  await page.route(`**/files/${fileId}/folder`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ folder: "Archive" });
    moved = true;
    await json(route, { ...file, folder: "Archive" });
  });
  await page.goto(`/portfolio/${clientId}/files`);
  await page
    .getByRole("button", { name: "pdf Test report.pdf", exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: file.fileName });
  await expect(preview).toContainText("scan_pending");
  await expect(preview.getByRole("link", { name: "Download" })).toHaveCount(0);
  await expect(
    preview.getByRole("button", { name: "Read extracted text" }),
  ).toBeDisabled();
  await preview.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("checkbox", { name: `Select ${file.fileName}` }).check();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByLabel("Folder name").fill("Archive");
  await page.getByRole("button", { name: "Create folder & move file" }).click();
  await expect(
    page.getByRole("cell", { name: "Archive", exact: true }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});
test("Master calendar retains selected client, date and zone when switching views", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  const requests: URL[] = [];
  page.on("request", (request) => {
    if (request.url().includes("engagement/meetings?"))
      requests.push(new URL(request.url()));
  });
  await page.goto(
    `/calendar?clientId=${clientId}&date=2026-11-01&zone=America%2FLos_Angeles&view=month`,
  );
  await expect(
    page.getByRole("combobox", { name: "Calendar scope" }),
  ).toHaveValue(clientId);
  for (const view of ["week", "agenda", "month"]) {
    await page
      .getByRole("combobox", { name: "Calendar view" })
      .selectOption(view);
    await expect(page.getByLabel("Calendar date", { exact: true })).toHaveValue(
      "2026-11-01",
    );
    await expect(
      page.getByRole("combobox", { name: "Calendar timezone" }),
    ).toHaveValue("America/Los_Angeles");
    await expect(page).toHaveURL(new RegExp(`view=${view}`));
  }
  expect(requests.length).toBeGreaterThan(0);
  expect(
    requests.every((url) => url.searchParams.get("clientId") === clientId),
  ).toBe(true);
  await page
    .getByRole("combobox", { name: "Calendar view" })
    .selectOption("agenda");
  await page.getByRole("combobox", { name: "Calendar scope" }).selectOption("");
  await expect(page.getByText("Government unavailable")).toBeVisible();
  await expect(page.getByText(/at most 50 upcoming records/)).toBeVisible();
  expect(unexpected).toEqual([]);
});
