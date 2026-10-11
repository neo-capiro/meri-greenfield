import { test, expect } from "@playwright/test";
import {
  installFixtures,
  json,
  clientId,
  opportunity,
  opportunitySearch,
} from "./fixtures";
test("matched opportunity and program paging, partial health, search and exact detail links", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  const reads: URL[] = [];
  await page.route(
    "**/core/intelligence/opportunities/v2/search?*",
    (route) => {
      const url = new URL(route.request().url());
      reads.push(url);
      expect(url.searchParams.get("clientId")).toBe(clientId);
      expect(url.searchParams.get("mode")).toBe("matched");
      const number = Number(url.searchParams.get("page"));
      return json(route, {
        ...opportunitySearch,
        page: number,
        pageSize: 1,
        total: 2,
        catalogComplete: false,
        counts: { active: null, grants: null, contracts: null, closed: null },
        opportunities: [
          {
            ...opportunity,
            title: number === 1 ? "Test opportunity" : "Second opportunity",
          },
        ],
      });
    },
  );
  await page.goto(`/portfolio/${clientId}/opportunities`);
  await expect(
    page.getByText("Some catalogs are incomplete", { exact: false }),
  ).toBeVisible();
  const results = page.getByRole("region", { name: "Matched opportunities" });
  await expect(
    results.getByRole("link", { name: "Test opportunity", exact: true }),
  ).toHaveAttribute(
    "href",
    `http://127.0.0.1:5191/existing/intelligence/opportunities/sam_gov/notice%2Fone?clientId=${clientId}&mode=matched`,
  );
  await expect(page.getByRole("link", { name: "Open PE →" })).toHaveAttribute(
    "href",
    "http://127.0.0.1:5191/existing/program-elements/0604134A",
  );
  await results.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Second opportunity" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");
  await page.getByLabel("Search matched opportunities").fill("sensor & safety");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Test opportunity", exact: true }),
  ).toBeVisible();
  expect(reads.at(-1)?.searchParams.get("query")).toBe("sensor & safety");
  expect(reads.at(-1)?.searchParams.get("page")).toBe("1");
  expect(unexpected).toEqual([]);
});
test("opportunity read failures can retry without hiding an independent program feed", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let ready = false;
  await page.route("**/core/intelligence/opportunities/v2/search?*", (route) =>
    json(
      route,
      ready ? opportunitySearch : { message: "Test catalogs unavailable" },
      ready ? 200 : 503,
    ),
  );
  await page.goto(`/portfolio/${clientId}/opportunities`);
  const results = page.getByRole("region", { name: "Matched opportunities" });
  await expect(results.getByRole("alert")).toContainText(
    "Test catalogs unavailable",
  );
  await expect(page.getByRole("link", { name: "Open PE →" })).toBeVisible();
  ready = true;
  await results.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Test opportunity", exact: true }),
  ).toBeVisible();
  await expect(results.getByRole("alert")).toHaveCount(0);
  expect(unexpected).toEqual([]);
});
