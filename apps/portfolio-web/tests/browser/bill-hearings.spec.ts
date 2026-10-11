import { test, expect } from "@playwright/test";
import { installFixtures, json, clientId, client } from "./fixtures";
const billId = "hr-4455-119";
const endpoint = `**/intelligence/clients/${clientId}/bills/${billId}/hearings`;
const path = `/portfolio/${clientId}/bills`;
const bill = {
  billId,
  displayNum: "H.R. 4455",
  title: "Synthetic National Defense Act",
  stage: "committee",
  passageProbability: 0.62,
  matchedTags: ["counter-uas", "autonomy"],
  changeChip: { label: "Material change", tone: "notable" },
  terminalRisk: false,
  unread: false,
  hearingCount: 1,
  lastHearingSessionId: "capture-raw",
  canonicalStatus: "Referred to committee",
  latestActionText: "Referred to the House Committee on Armed Services.",
  latestActionDate: "2026-09-29",
  trackedAt: "2026-08-03T12:00:00Z",
  note: "Section 1043 mirrors the client ask.",
};
const hearing = {
  sessionId: "capture-raw",
  hearingId: "canonical-hearing",
  title: "Synthetic Posture Hearing",
  occurredAt: "2026-09-24T12:00:00Z",
  committeeId: "committee-source",
  mentions: [
    {
      segmentId: "segment-a",
      timestampMs: 761000,
      speakerName: "Chair Example",
      quote: "Synthetic source statement.",
      quoteSource: "transcript",
      issueTags: [],
    },
  ],
};
async function install(page: Parameters<typeof installFixtures>[0]) {
  const unexpected = await installFixtures(page);
  await page.route(
    `**/intelligence/clients/${clientId}/tracker/board?**`,
    (route) =>
      json(route, {
        columns: [{ id: "committee", label: "Committee", cards: [bill] }],
        total: 1,
        nextCursor: null,
        hasMore: false,
        withheld: 0,
      }),
  );
  return unexpected;
}
async function open(page: Parameters<typeof installFixtures>[0]) {
  await page
    .getByRole("button", { name: bill.displayNum, exact: true })
    .click();
  return page.getByRole("dialog", { name: bill.displayNum, exact: true });
}
test("lazy linked hearing evidence uses canonical IDs and preserves board client scope and supplied latest details", async ({
  page,
}) => {
  const unexpected = await install(page);
  let reads = 0;
  await page.route(endpoint, (route) => {
    reads++;
    expect(route.request().method()).toBe("GET");
    return json(route, { count: 1, hearings: [hearing] });
  });
  await page.goto(`${path}?keep=scope`);
  await expect(
    page.getByRole("button", { name: bill.displayNum, exact: true }),
  ).toBeVisible();
  expect(reads).toBe(0);
  const drawer = await open(page);
  await expect(
    drawer.getByRole("link", { name: "Synthetic Posture Hearing →" }),
  ).toHaveAttribute(
    "href",
    "http://127.0.0.1:5191/existing/legiwatch/hearings/canonical-hearing",
  );
  await expect(
    drawer.getByRole("link", { name: "Open full board →" }),
  ).toHaveAttribute(
    "href",
    `http://127.0.0.1:5191/existing/legiwatch?tab=bills&client=${clientId}`,
  );
  await expect(drawer.getByText("12:41", { exact: true })).toBeVisible();
  await expect(
    drawer.getByText("Synthetic source statement.", { exact: true }),
  ).toBeVisible();
  await expect(drawer.getByText("Quote source: transcript")).toBeVisible();
  await expect(
    drawer.getByText("Tracked Aug 3, 2026", { exact: true }),
  ).toBeVisible();
  await expect(drawer.getByText("Sep 29, 2026", { exact: true })).toBeVisible();
  await expect(
    drawer.getByText("Material change", { exact: true }),
  ).toBeVisible();
  await expect(drawer.getByText(bill.note, { exact: true })).toBeVisible();
  expect(await drawer.locator('a[href*="capture-raw"]').count()).toBe(0);
  expect(reads).toBe(1);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: bill.displayNum, exact: true }),
  ).toBeFocused();
  await expect(page).toHaveURL(/keep=scope/);
  expect(unexpected).toEqual([]);
});
test("owner-disabled refusal stays visible and retry does not switch backend or claim empty", async ({
  page,
}) => {
  const unexpected = await install(page);
  let reads = 0;
  await page.route(endpoint, (route) => {
    reads++;
    return reads === 1
      ? json(route, { message: "Hearing source disabled" }, 404)
      : json(route, { count: 1, hearings: [hearing] });
  });
  await page.goto(path);
  const drawer = await open(page);
  await expect(drawer.getByRole("alert")).toContainText(
    "Hearing source disabled",
  );
  await expect(
    drawer.getByText("No hearings have discussed this bill yet.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await drawer.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    drawer.getByRole("link", { name: /Synthetic Posture Hearing/ }),
  ).toBeVisible();
  expect(reads).toBe(2);
  expect(unexpected).toEqual([]);
});
test("in-flight, empty and unavailable hearing states are distinct", async ({
  page,
}) => {
  const unexpected = await install(page);
  let release: (() => void) | undefined;
  let reads = 0;
  await page.route(endpoint, async (route) => {
    reads++;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return json(route, { count: 0, hearings: [] });
  });
  await page.goto(path);
  const drawer = await open(page);
  await expect(
    drawer.getByText("Loading hearings…", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => Boolean(release)).toBe(true);
  release!();
  await expect(
    drawer.getByText("No hearings have discussed this bill yet.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(reads).toBe(1);
  expect(unexpected).toEqual([]);
});
test("Core owner never requests Intel hearings and retains its own board details", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  let hearingReads = 0;
  await page.route(endpoint, (route) => {
    hearingReads++;
    return json(route, { count: 0, hearings: [] });
  });
  await page.route(
    `**/core/intelligence/clients/${clientId}/tracker/board`,
    (route) =>
      json(route, {
        columns: [
          {
            id: "committee",
            label: "Committee",
            bills: [
              {
                ...bill,
                probability: 0.62,
                tags: bill.matchedTags,
                change: bill.changeChip,
              },
            ],
          },
        ],
        total: 1,
      }),
  );
  await page.goto(`${path}?testBackend=core`);
  const drawer = await open(page);
  await expect(
    drawer.getByText("Hearing links are not enabled for this workspace.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    drawer.getByText("Tracked Aug 3, 2026", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByText("Loading hearings…", { exact: true }),
  ).toHaveCount(0);
  expect(hearingReads).toBe(0);
  expect(unexpected).toEqual([]);
});
test("missing canonical hearing IDs keep evidence readable without session substitution and encrypted pointers remain unavailable", async ({
  page,
}) => {
  const unexpected = await install(page);
  const mentions = [
    ...hearing.mentions,
    {
      segmentId: null,
      timestampMs: null,
      speakerName: null,
      quote: null,
      quoteSource: "encrypted",
      issueTags: [],
    },
    {
      segmentId: null,
      timestampMs: 0,
      speakerName: null,
      quote: "Third statement",
      issueTags: [],
    },
    {
      segmentId: null,
      timestampMs: 3600000,
      speakerName: "Witness",
      quote: "Fourth statement",
      issueTags: ["Supplied tag"],
    },
  ];
  await page.route(endpoint, (route) =>
    json(route, {
      count: 1,
      hearings: [{ ...hearing, hearingId: null, mentions }],
    }),
  );
  await page.goto(path);
  const drawer = await open(page);
  await expect(
    drawer.getByText("Full hearing record is unavailable.", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("link", { name: /Synthetic Posture Hearing/ }),
  ).toHaveCount(0);
  await expect(
    drawer.getByText("Quote unavailable (encrypted).", { exact: true }),
  ).toBeVisible();
  await drawer.getByText("1 more mentions", { exact: true }).click();
  await expect(
    drawer.getByText("Fourth statement", { exact: true }),
  ).toBeVisible();
  await expect(drawer.getByText("60:00", { exact: true })).toBeVisible();
  expect(unexpected).toEqual([]);
});
test("malformed hearing receipts refuse links; retry can establish a genuine empty response", async ({
  page,
}) => {
  const unexpected = await install(page);
  let reads = 0;
  let allowEmpty = false;
  await page.route(endpoint, (route) => {
    reads++;
    return json(
      route,
      allowEmpty
        ? { count: 0, hearings: [] }
        : { count: 2, hearings: [hearing] },
    );
  });
  await page.goto(path);
  const drawer = await open(page);
  await expect(drawer.getByRole("alert")).toContainText("unexpected response");
  await expect(
    drawer.getByRole("link", { name: /Synthetic Posture Hearing/ }),
  ).toHaveCount(0);
  expect(reads).toBe(2);
  allowEmpty = true;
  await drawer.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    drawer.getByText("No hearings have discussed this bill yet.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(reads).toBe(3);
  expect(unexpected).toEqual([]);
});
test("hearing session expiry uses the shared sign-in recovery", async ({
  page,
}) => {
  const unexpected = await install(page);
  await page.route(endpoint, (route) =>
    json(route, { message: "Expired" }, 401),
  );
  await page.goto(path);
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Your session expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", "/sign-in");
  expect(unexpected).toEqual([]);
});
test("changing client scope closes the prior bill and refuses a denied hearing read without cached evidence", async ({
  page,
}) => {
  const unexpected = await install(page);
  const otherId = "10000000-0000-4000-8000-000000000002";
  await page.route(endpoint, (route) =>
    json(route, { count: 1, hearings: [hearing] }),
  );
  await page.route(`**/core/clients/${otherId}`, (route) =>
    json(route, { ...client, id: otherId, name: "Second synthetic client" }),
  );
  await page.route(
    `**/intelligence/clients/${otherId}/tracker/board?**`,
    (route) =>
      json(route, {
        columns: [{ id: "committee", label: "Committee", cards: [bill] }],
        total: 1,
        nextCursor: null,
        hasMore: false,
        withheld: 0,
      }),
  );
  let deniedReads = 0;
  await page.route(
    `**/intelligence/clients/${otherId}/bills/${billId}/hearings`,
    (route) => {
      deniedReads++;
      return json(route, { message: "Client hearing scope denied" }, 403);
    },
  );
  await page.goto(path);
  let drawer = await open(page);
  await expect(
    drawer.getByRole("link", { name: /Synthetic Posture Hearing/ }),
  ).toBeVisible();
  await page.evaluate((next) => {
    window.history.pushState({}, "", next);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, `/portfolio/${otherId}/bills`);
  await expect(drawer).toHaveCount(0);
  drawer = await open(page);
  await expect(drawer.getByRole("alert")).toContainText("permission");
  await expect(
    drawer.getByRole("link", { name: /Synthetic Posture Hearing/ }),
  ).toHaveCount(0);
  expect(deniedReads).toBe(1);
  expect(unexpected).toEqual([]);
});
test("bill update dialog matches desktop sizing and remains scrollable in mobile dark mode", async ({
  page,
}) => {
  const unexpected = await install(page);
  await page.route(endpoint, (route) =>
    json(route, { count: 1, hearings: [hearing] }),
  );
  for (const [width, height, theme] of [
    [1440, 1040, "light"],
    [390, 844, "dark"],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(path);
    const drawer = await open(page);
    await expect(
      drawer.getByRole("link", { name: /Synthetic Posture Hearing/ }),
    ).toBeVisible();
    await expect(drawer).toHaveCSS(
      "background-color",
      theme === "dark" ? "rgb(27, 27, 27)" : "rgb(255, 255, 255)",
    );
    expect(
      await page.evaluate(
        async () => (await document.fonts.load('14px "Geist Test"')).length,
      ),
    ).toBe(1);
    expect(
      await page.evaluate(
        async () =>
          (await document.fonts.load('14px "Geist Mono Test"')).length,
      ),
    ).toBe(1);
    const bounds = await drawer.boundingBox();
    expect(Math.round(bounds!.width)).toBe(width === 1440 ? 560 : 358);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.height).toBeLessThanOrEqual(height - 32);
    await drawer
      .getByRole("link", { name: "Open full board →" })
      .scrollIntoViewIfNeeded();
    await expect(
      drawer.getByRole("link", { name: "Open full board →" }),
    ).toBeVisible();
    await drawer.screenshot({
      path: `${process.env.PORTFOLIO_BILL_HEARINGS_EVIDENCE_DIR ?? "work/bill-hearings"}/bill-updates-${width}-${theme}.png`,
    });
  }
  expect(unexpected).toEqual([]);
});
