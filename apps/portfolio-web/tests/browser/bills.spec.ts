import { test, expect } from "@playwright/test";
import { installFixtures, json, clientId } from "./fixtures";
test("intel search, tracking and paging retain client scope; failed untrack stays reviewable", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  const billId = "tx-2025-hb1";
  const bill = {
    billId,
    displayNum: "HB 1",
    title: "Synthetic state measure",
    stage: "committee",
    passageProbability: 0.17,
    matchedTags: ["Test topic"],
    changeChip: null,
    terminalRisk: true,
    unread: false,
    hearingCount: 0,
    lastHearingSessionId: null,
    canonicalStatus: "Failed",
    latestActionText: "Failed in committee",
    latestActionDate: "2026-10-01",
    jurisdiction: "TX",
  };
  let tracked = false;
  let attempts = 0;
  const reads: string[] = [];
  await page.route(
    `**/intelligence/clients/${clientId}/tracker/**`,
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/board")) {
        reads.push(url.search);
        const first = !url.searchParams.has("cursor");
        return json(route, {
          columns: [
            {
              id: "committee",
              label: "In committee",
              cards: tracked && first ? [bill] : [],
            },
          ],
          total: tracked ? 2 : 0,
          nextCursor: tracked && first ? "page-two" : null,
          hasMore: tracked && first,
          withheld: tracked && first ? 1 : 0,
        });
      }
      if (url.pathname.endsWith("/bill-search")) {
        expect(url.searchParams.getAll("jurisdictions")).toEqual(["US", "TX"]);
        return json(route, [
          {
            billId,
            displayNum: "HB 1",
            title: bill.title,
            stage: "committee",
            probability: 0.17,
            jurisdiction: "TX",
          },
        ]);
      }
      if (url.pathname.endsWith("/track")) {
        expect(route.request().postDataJSON()).toEqual({
          billId,
          source: "manual_search",
          isManual: true,
        });
        tracked = true;
        return json(route, { billId, clientId });
      }
      expect(url.pathname).toContain("/untrack");
      attempts++;
      return json(route, { message: "Test removal unavailable" }, 503);
    },
  );
  await page.route("**/legiwatch/bills/corpus-metadata", (route) =>
    json(route, {
      jurisdictions: [
        { key: "US", count: 1 },
        { key: "TX", count: 1 },
      ],
    }),
  );
  await page.goto(`/portfolio/${clientId}/bills`);
  await page.getByRole("button", { name: "Track bill", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Track a bill" });
  await search.getByLabel("TX", { exact: true }).check();
  await search.getByLabel("Bill number or title").fill("HB 1");
  await search.getByRole("button", { name: "Search", exact: true }).click();
  await search.getByRole("radio", { name: /HB 1/ }).check();
  await search.getByRole("button", { name: "Track selected bill" }).click();
  await expect(search).not.toBeVisible();
  await expect(
    page.getByText("2 tracked bills", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load more bills" }).click();
  await expect(
    page.getByRole("button", { name: "Load more bills" }),
  ).not.toBeVisible();
  expect(reads.some((value) => value.includes("cursor=page-two"))).toBe(true);
  await page.getByRole("button", { name: "Board view", exact: true }).click();
  await page.getByRole("button", { name: /HB 1 17% estimate/ }).click();
  const drawer = page.getByRole("dialog", { name: "HB 1", exact: true });
  await expect(
    drawer.getByText("Terminal risk", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("link", { name: "Open Bill 360" }),
  ).toHaveAttribute(
    "href",
    new RegExp(`/bills/${billId}\\?clientId=${clientId}`),
  );
  await drawer
    .getByRole("button", { name: "Untrack bill", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Confirm untrack", exact: true })
    .click();
  await expect(drawer.getByRole("alert")).toBeVisible();
  expect(attempts).toBe(1);
  expect(unexpected).toEqual([]);
});
test("facility edit clears optional values instead of omitting them", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  const facility = {
    id: "facility-test",
    clientId,
    name: "Test site",
    city: "Austin",
    state: "TX",
    zip: "78701",
    addressLine: "1 Test Street",
    employeeCount: 12,
    congressionalDistrict: "10",
    notes: "Old note",
    geocodeStatus: "unresolved",
  };
  let saved = false;
  await page.route(`**/clients/${clientId}/representation`, (route) =>
    json(route, []),
  );
  await page.route(`**/clients/${clientId}/facilities**`, async (route) => {
    if (route.request().method() === "GET")
      return json(route, [
        saved
          ? {
              ...facility,
              notes: null,
              employeeCount: null,
              congressionalDistrict: null,
            }
          : facility,
      ]);
    const body = route.request().postDataJSON();
    expect(route.request().method()).toBe("PATCH");
    expect(body).toMatchObject({
      notes: null,
      employeeCount: null,
      congressionalDistrict: null,
      state: "TX",
      city: "Austin",
    });
    saved = true;
    return json(route, { ...facility, ...body });
  });
  await page.goto(`/portfolio/${clientId}`);
  await page.getByRole("button", { name: /Test site/ }).click();
  await page
    .getByRole("button", { name: "Edit facility", exact: true })
    .click();
  const edit = page.getByRole("dialog", { name: "Edit facility" });
  await edit.getByLabel("Notes", { exact: true }).fill("");
  await edit.getByLabel("Employees", { exact: true }).fill("");
  await edit.getByLabel("Congressional district", { exact: true }).fill("");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).not.toBeVisible();
  await page
    .getByRole("button", { name: "Edit facility", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Notes", { exact: true }),
  ).toHaveValue("");
  expect(unexpected).toEqual([]);
});
