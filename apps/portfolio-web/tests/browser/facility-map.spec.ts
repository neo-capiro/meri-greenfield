import { test, expect, type Page } from "@playwright/test";
import { clientId, installFixtures, json } from "./fixtures";
import { boundaryFixture, facility } from "../facility-map-fixtures";

async function mapFixtures(page: Page) {
  const unexpected = await installFixtures(page);
  await page.route(`**/clients/${clientId}/facilities`, (route) =>
    json(route, [facility]),
  );
  await page.route(`**/clients/${clientId}/targets`, (route) =>
    json(route, []),
  );
  await page.route("**/intelligence/district-nexus/boundaries?*", (route) =>
    json(route, {
      status: "current",
      vintage: "119",
      generatedAt: "2026-10-11T00:00:00Z",
      districtCount: 2,
      source: "census_cartographic_500k",
      hash: "synthetic-boundary",
      warnings: [],
    }),
  );
  await page.route(
    "**/intelligence/district-nexus/boundaries/C/geojson",
    (route) => json(route, boundaryFixture),
  );
  await page.route(`**/clients/${clientId}/representation`, (route) =>
    json(route, [
      {
        facility: {
          id: facility.id,
          name: facility.name,
          city: facility.city,
          state: facility.state,
        },
        representation: {
          unresolved: false,
          federal: {
            house: {
              bioguideId: "T000001",
              fullName: "Test Representative",
              party: null,
              state: "CA",
              district: 1,
              chamber: "house",
            },
            senate: [],
          },
          state: { lower: null, upper: null },
        },
      },
    ]),
  );
  await page.route(
    `**/intelligence/clients/${clientId}/district-nexus-v2`,
    (route) =>
      json(route, {
        clientId,
        score: null,
        coveragePercent: 12,
        breakdown: [
          {
            component: "facility",
            label: "Facilities",
            credit: 3,
            weight: 20,
            rationale: "Synthetic evidence",
            evidenceCount: 1,
          },
        ],
        districts: [{ districtKey: "CA-01", score: null }],
        generatedAt: "2026-10-11T00:00:00Z",
        warnings: [],
        freshness: [],
      }),
  );
  return unexpected;
}
test("real coordinate pins, keyboard district selection, pan/zoom and source-backed details", async ({
  page,
}) => {
  const unexpected = await mapFixtures(page);
  await page.goto(`/portfolio/${clientId}`);
  const card = page.getByRole("region", {
    name: "District nexus",
    exact: true,
  });
  const pin = card.getByRole("button", {
    name: "Open facility Synthetic lab",
    exact: true,
  });
  await expect(pin).toBeVisible();
  await pin.focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog", {
    name: "Synthetic lab · CA-01",
    exact: true,
  });
  await expect(detail).toContainText("Test Representative");
  await expect(detail).toContainText("12");
  await expect(
    detail.getByRole("link", { name: "Open relationships" }),
  ).toHaveAttribute(
    "href",
    `/portfolio/${clientId}/relationships?kind=government`,
  );
  await detail.getByRole("button", { name: "Close", exact: true }).click();
  const actionAssets = await card.locator("img").evaluateAll((images) =>
    images.map((image) => ({
      src: image.getAttribute("src"),
      width: image.getBoundingClientRect().width,
      height: image.getBoundingClientRect().height,
      loaded:
        image instanceof HTMLImageElement &&
        image.complete &&
        image.naturalWidth > 0,
    })),
  );
  expect(actionAssets.length).toBeGreaterThan(0);
  expect(actionAssets.every((asset) => asset.loaded)).toBe(true);
  expect(
    actionAssets.find((asset) => asset.src?.endsWith("plus.svg")),
  ).toMatchObject({ width: 16, height: 16 });
  expect(
    actionAssets.find((asset) => asset.src?.endsWith("marker.svg")),
  ).toMatchObject({ width: 24, height: 24 });
  for (const [name, size] of [
    ["maximize", 15],
    ["dot", 8],
    ["zoom-in", 14],
    ["zoom-out", 14],
  ] as const) {
    expect(
      actionAssets.find((asset) => asset.src?.endsWith(`${name}.svg`)),
    ).toMatchObject({ width: size, height: size });
  }
  await card.getByRole("button", { name: "Open district map" }).click();
  const map = page.getByRole("dialog", {
    name: "District nexus · Test Aerospace",
    exact: true,
  });
  await expect(map).toContainText("Insufficient evidence");
  const district = map.getByRole("button", {
    name: "District CA-01",
    exact: true,
  });
  await district.focus();
  await page.keyboard.press("Enter");
  await expect(map.getByLabel("Selected district")).toHaveValue("CA-01");
  await map.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(map.locator("svg > g")).toHaveAttribute(
    "transform",
    /scale\(1\.5\)/,
  );
  await map.getByRole("button", { name: "Pan left", exact: true }).click();
  await expect(map.locator("svg > g")).toHaveAttribute(
    "transform",
    /^translate\(-40 0\)/,
  );
  await map.getByRole("button", { name: "Reset map", exact: true }).click();
  await map
    .getByRole("group", {
      name: "Current congressional districts and facility pins",
      exact: true,
    })
    .focus();
  await page.keyboard.press("ArrowUp");
  await expect(map.locator("svg > g")).toHaveAttribute(
    "transform",
    /^translate\(0 -40\)/,
  );
  await map.getByRole("button", { name: "Reset map", exact: true }).click();
  await page.screenshot({ path: "test-results/facility-map-desktop.png" });
  const assets = await map.locator("img").evaluateAll((images) =>
    images.map((image) => ({
      src: image.getAttribute("src"),
      width: image.getBoundingClientRect().width,
      height: image.getBoundingClientRect().height,
      loaded:
        image instanceof HTMLImageElement &&
        image.complete &&
        image.naturalWidth > 0,
    })),
  );
  expect(assets.every((asset) => asset.loaded)).toBe(true);
  expect(assets.length).toBeGreaterThan(0);
  expect(
    assets.find((asset) => asset.src?.endsWith("marker.svg")),
  ).toMatchObject({ width: 24, height: 24 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(map).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/facility-map-mobile-dark.png" });
  await map.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Open facility Synthetic lab", exact: true })
    .click();
  await expect(detail).toBeVisible();
  expect(
    await detail.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/facility-detail-mobile-dark.png",
  });
  expect(unexpected).toEqual([]);
});
test("candidate index, district resolution, queued retry and failure messages stay client-bound", async ({
  page,
}) => {
  const unexpected = await mapFixtures(page);
  let chosen = false,
    queued = false,
    attempts = 0;
  const ambiguous = {
    ...facility,
    latitude: null,
    longitude: null,
    geocodeStatus: "ambiguous",
    geocodeCandidateRevision: `v1:${"a".repeat(64)}`,
    geocodeCandidates: [
      {
        matchedAddress: "1 TEST ST, LOS ANGELES, CA 90001",
        congressionalDistrict: "01",
        state: "CA",
        latitude: 34.05,
        longitude: -118.25,
      },
    ],
  };
  await page.route(`**/clients/${clientId}/facilities`, (route) =>
    json(route, [
      chosen ? { ...facility, geocodeCandidates: null } : ambiguous,
    ]),
  );
  await page.route(
    `**/clients/${clientId}/facilities/${facility.id}/**`,
    async (route) => {
      const action = new URL(route.request().url()).pathname.split("/").at(-1);
      expect(route.request().method()).toBe("POST");
      if (action === "reviewed") {
        expect(
          new URL(route.request().url()).pathname.endsWith(
            "/geocode-candidate/reviewed",
          ),
        ).toBe(true);
        expect(route.request().postDataJSON()).toEqual({
          candidateIndex: 0,
          expectedRevision: ambiguous.geocodeCandidateRevision,
        });
        chosen = true;
        return json(route, facility);
      }
      if (action === "geocode") {
        queued = true;
        return json(route, facility);
      }
      attempts++;
      return json(route, { message: "Synthetic geocoder failure" }, 503);
    },
  );
  await page.goto(`/portfolio/${clientId}`);
  await page.getByRole("button", { name: /Synthetic lab CA-01/ }).click();
  const detail = page.getByRole("dialog", {
    name: "Synthetic lab · CA-01",
    exact: true,
  });
  await detail
    .getByRole("button", { name: "Use this address", exact: true })
    .click();
  await expect(
    detail.getByRole("button", { name: "Use this address" }),
  ).not.toBeVisible();
  await detail
    .getByRole("button", { name: "Resolve district", exact: true })
    .click();
  await expect(detail.getByRole("alert")).toContainText(
    "Synthetic geocoder failure",
  );
  expect(attempts).toBe(1);
  await detail
    .getByRole("button", { name: "Retry geocoding", exact: true })
    .click();
  await expect(detail.getByRole("status")).toContainText("Retry requested");
  expect(queued).toBe(true);
  await page.screenshot({ path: "test-results/facility-geocoding-detail.png" });
  expect(unexpected).toEqual([]);
});

test("reviewed candidate selection refuses a service without a snapshot revision", async ({
  page,
}) => {
  const unexpected = await mapFixtures(page);
  await page.route(`**/clients/${clientId}/facilities`, (route) =>
    json(route, [
      {
        ...facility,
        geocodeCandidates: [
          {
            matchedAddress: "OLD CANDIDATE",
            congressionalDistrict: "01",
            state: "CA",
            latitude: 34,
            longitude: -118,
          },
        ],
      },
    ]),
  );
  await page.goto(`/portfolio/${clientId}`);
  await page
    .getByRole("button", { name: "Open facility Synthetic lab", exact: true })
    .click();
  const detail = page.getByRole("dialog", {
    name: "Synthetic lab · CA-01",
    exact: true,
  });
  await expect(
    detail.getByText(
      "Reviewed address selection is unavailable from this service.",
    ),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Use this address", exact: true }),
  ).toBeDisabled();
  expect(unexpected).toEqual([]);
});

test("a candidate conflict reloads the displayed snapshot and never falls back to the unchecked route", async ({
  page,
}) => {
  const unexpected = await mapFixtures(page);
  let writes = 0;
  const revision = (character: string) => `v1:${character.repeat(64)}`;
  await page.route(`**/clients/${clientId}/facilities`, (route) =>
    json(route, [
      {
        ...facility,
        geocodeCandidateRevision: revision(writes === 0 ? "a" : "b"),
        geocodeCandidates: [
          {
            matchedAddress:
              writes === 0 ? "FIRST CANDIDATE" : "REVIEW NEW CANDIDATE",
            congressionalDistrict: "01",
            state: "CA",
            latitude: 34,
            longitude: -118,
          },
        ],
      },
    ]),
  );
  await page.route(
    `**/clients/${clientId}/facilities/${facility.id}/geocode-candidate/reviewed`,
    (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({
        candidateIndex: 0,
        expectedRevision: revision(writes === 0 ? "a" : "b"),
      });
      writes++;
      return json(
        route,
        {
          message:
            writes === 1
              ? "Candidates changed; review the current result."
              : "Reviewed route unavailable",
        },
        writes === 1 ? 409 : 404,
      );
    },
  );
  await page.goto(`/portfolio/${clientId}`);
  await page
    .getByRole("button", { name: "Open facility Synthetic lab", exact: true })
    .click();
  const detail = page.getByRole("dialog", {
    name: "Synthetic lab · CA-01",
    exact: true,
  });
  await detail
    .getByRole("button", { name: "Use this address", exact: true })
    .click();
  await expect(detail.getByRole("alert")).toContainText("Candidates changed");
  await expect(detail).toContainText("REVIEW NEW CANDIDATE");
  await expect(detail).not.toContainText("FIRST CANDIDATE");
  expect(writes).toBe(1);
  await detail
    .getByRole("button", { name: "Use this address", exact: true })
    .click();
  await expect(detail.getByRole("alert")).toContainText(
    "Reviewed route unavailable",
  );
  expect(writes).toBe(2);
  await expect(detail).toBeVisible();
  expect(unexpected).toEqual([]);
});
test("removal requires confirmation and does not close after a rejected delete", async ({
  page,
}) => {
  const unexpected = await mapFixtures(page);
  let deletes = 0;
  let removed = false;
  await page.route(`**/clients/${clientId}/facilities`, (route) =>
    json(route, removed ? [] : [facility]),
  );
  await page.route(
    `**/clients/${clientId}/facilities/${facility.id}`,
    (route) => {
      deletes++;
      if (deletes === 1)
        return json(route, { message: "Synthetic permission denial" }, 403);
      removed = true;
      return json(route, { deleted: true });
    },
  );
  await page.goto(`/portfolio/${clientId}`);
  await page
    .getByRole("button", { name: "Open facility Synthetic lab", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Synthetic lab · CA-01", exact: true })
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  expect(deletes).toBe(0);
  const confirmation = page.getByRole("dialog", {
    name: "Remove facility",
    exact: true,
  });
  await confirmation
    .getByRole("button", { name: "Remove facility", exact: true })
    .click();
  await expect(confirmation.getByRole("alert")).toContainText(
    "You do not have permission",
  );
  await expect(confirmation).toBeVisible();
  expect(deletes).toBe(1);
  await confirmation
    .getByRole("button", { name: "Remove facility", exact: true })
    .click();
  await expect(confirmation).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open facility Synthetic lab",
      exact: true,
    }),
  ).not.toBeVisible();
  expect(deletes).toBe(2);
  expect(unexpected).toEqual([]);
});
test("a response for another client fails closed without rendering that location", async ({
  page,
}) => {
  const unexpected = await mapFixtures(page);
  await page.route(`**/clients/${clientId}/facilities`, (route) =>
    json(route, [
      { ...facility, clientId: "different-client", name: "Foreign location" },
    ]),
  );
  await page.goto(`/portfolio/${clientId}`);
  const card = page.getByRole("region", {
    name: "District nexus",
    exact: true,
  });
  await expect(card.getByRole("alert")).toContainText("unexpected response");
  await expect(page.getByText("Foreign location")).not.toBeVisible();
  expect(unexpected).toEqual([]);
});

test("resolved representative target reports failed saves, validates receipt and avoids duplicate adds", async ({
  page,
}) => {
  const unexpected = await mapFixtures(page);
  let writes = 0;
  let saved = false;
  const target = {
    id: "80000000-0000-4000-8000-000000000001",
    clientId,
    memberId: "T000001",
    sourceDirectory: "congress",
    memberName: "Test Representative",
    party: null,
    state: "CA",
    chamber: "house",
    committee: null,
    staffKind: null,
    tier: null,
    source: "manual",
    addedAt: "2026-10-11T00:00:00Z",
  };
  await page.route(`**/clients/${clientId}/targets`, (route) => {
    if (route.request().method() === "GET")
      return json(route, saved ? [target] : []);
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({
      memberId: "T000001",
      sourceDirectory: "congress",
      source: "manual",
    });
    writes++;
    if (writes === 1)
      return json(route, { message: "Synthetic target save failure" }, 503);
    if (writes === 2)
      return json(route, { ...target, sourceDirectory: "state" });
    saved = true;
    return json(route, target);
  });
  await page.goto(`/portfolio/${clientId}`);
  const open = page.getByRole("button", {
    name: "Open facility Synthetic lab",
    exact: true,
  });
  await open.click();
  const detail = page.getByRole("dialog", {
    name: "Synthetic lab · CA-01",
    exact: true,
  });
  const add = detail.getByRole("button", {
    name: "Add representative to targets : Test Representative",
    exact: true,
  });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(detail.getByRole("alert")).toContainText(
    "Synthetic target save failure",
  );
  expect(writes).toBe(1);
  await add.click();
  await expect(detail.getByRole("alert")).toContainText("unexpected response");
  await expect(
    detail.getByText("Added to targets", { exact: true }),
  ).not.toBeVisible();
  expect(writes).toBe(2);
  await add.click();
  await expect(
    detail.getByText("Added to targets", { exact: true }),
  ).toBeVisible();
  await expect(add).not.toBeVisible();
  await page.screenshot({ path: "test-results/facility-target-saved.png" });
  await detail.getByRole("button", { name: "Close", exact: true }).click();
  await open.click();
  await expect(
    detail.getByText("Added to targets", { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(3);
  expect(unexpected).toEqual([]);
});
