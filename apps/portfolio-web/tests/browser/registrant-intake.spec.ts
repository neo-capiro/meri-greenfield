import { expect, test, type Page } from "@playwright/test";

const anchor = { ldaRegistrantId: 12, ldaRegistrantName: "Maven Advocacy" };
const candidate = (
  ldaClientId: number,
  name: string,
  onboardedAs: string | null = null,
) => ({
  ldaClientId,
  name,
  filings: 14,
  latestFilingYear: 2026,
  totalSpend: 2400000,
  onboardedAs,
});
const rows = [
  candidate(8, "Saronic Technologies"),
  candidate(9, "Epirus"),
  candidate(10, "Anduril", "Existing Anduril"),
];
async function setup(
  page: Page,
  options: {
    linked?: boolean;
    role?: string;
    userId?: string;
    candidates?: ReturnType<typeof candidate>[];
  } = {},
) {
  let current =
    options.linked === false
      ? {
          ldaRegistrantId: null as number | null,
          ldaRegistrantName: null as string | null,
        }
      : { ...anchor };
  const state = {
    posts: 0,
    puts: 0,
    identityFailure: false,
    candidates: options.candidates ?? rows,
  };
  await page.route("**/api/backend/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/backend/core/", "");
    if (path === "billing/state")
      return route.fulfill({
        json: {
          billingEnabled: false,
          status: "none",
          slots: 0,
          usedSlots: 0,
          locked: false,
          trialEndsAt: null,
          onboardingFlowVersion: 1,
        },
      });
    if (path === "me")
      return route.fulfill({
        status: state.identityFailure ? 503 : 200,
        json: state.identityFailure
          ? { message: "Session verification unavailable" }
          : {
              user: {
                id: options.userId ?? "synthetic-user",
                email: "fixture@example.invalid",
              },
              tenant: { id: "synthetic-tenant", name: "Synthetic Firm" },
              role: options.role ?? "user_admin",
            },
      });
    if (path === "firm/registrant") {
      if (request.method() === "PUT") {
        state.puts++;
        current = {
          ldaRegistrantId: request.postDataJSON().registrantId,
          ldaRegistrantName: "Maven Advocacy",
        };
      }
      return route.fulfill({ json: current });
    }
    if (path === "firm/lda-registrants")
      return route.fulfill({
        json: [
          {
            id: 12,
            name: "Maven Advocacy",
            city: "Washington",
            state: "DC",
            totalClients: 38,
            totalFilings: 412,
          },
        ],
      });
    if (path === "firm/import-candidates")
      return route.fulfill({
        json: {
          registrantId: current.ldaRegistrantId,
          registrantName: current.ldaRegistrantName,
          candidates: state.candidates,
        },
      });
    if (path === "firm/import") {
      state.posts++;
      return route.fulfill({
        json: {
          created: 1,
          items: [
            {
              id: "client-created",
              name: "Saronic Technologies",
              ldaClientId: 8,
            },
          ],
          skipped: request.postDataJSON().ldaClientIds.includes(9)
            ? [{ ldaClientId: 9, reason: "client slot limit reached" }]
            : [],
        },
      });
    }
    return route.fulfill({
      status: 500,
      json: { message: `Unallocated synthetic route: ${path}` },
    });
  });
  await page.goto("/__test/registrant-intake");
  await page
    .getByRole("button", { name: "Import with LDA", exact: true })
    .click();
  return state;
}

test("search, explicit firm-wide confirmation, review and partial receipt", async ({
  page,
}, testInfo) => {
  const state = await setup(page, { linked: false });
  await page.getByRole("textbox", { name: "Firm name" }).fill("Maven");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Link Maven Advocacy" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("registrant-search-desktop-light.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Link Maven Advocacy" }).click();
  await expect(
    page.getByText("This changes the LDA registrant for your entire firm.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(state.puts).toBe(0);
  await page.getByRole("button", { name: "Confirm firm link" }).click();
  await page
    .getByRole("checkbox", { name: "Select Saronic Technologies" })
    .check();
  await page.getByRole("checkbox", { name: "Select Epirus" }).check();
  await page
    .getByRole("button", { name: "Import 2 clients", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("1 client profiles created. 1 skipped."),
  ).toBeVisible();
  await expect(page.getByText("client slot limit reached")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("registrant-partial-receipt-desktop-light.png"),
    fullPage: true,
  });
  await expect(page.getByTestId("receipts")).toHaveText("1");
  expect(state.puts).toBe(1);
  expect(state.posts).toBe(1);
});

test("search validation, empty results and backend failure retain query", async ({
  page,
}) => {
  await setup(page, { linked: false });
  const input = page.getByRole("textbox", { name: "Firm name" });
  await input.fill("a");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("Enter 2–200 characters to search."),
  ).toBeVisible();
  await page.route("**/firm/lda-registrants?**", (route) =>
    route.fulfill({ json: [] }),
  );
  await input.fill("Absent firm");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("No matching firms. Try another name."),
  ).toBeVisible();
  await page.route("**/firm/lda-registrants?**", (route) =>
    route.fulfill({ status: 503, json: { message: "Search unavailable" } }),
  );
  await input.fill("Retained query");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Search unavailable")).toBeVisible();
  await expect(input).toHaveValue("Retained query");
});

test("standard users can review but cannot import or change firm", async ({
  page,
}) => {
  const state = await setup(page, { role: "standard_user" });
  await expect(
    page.getByText(
      "Only firm administrators can link a registrant or import clients.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Select Saronic Technologies" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Change firm" }),
  ).toBeDisabled();
  expect(state.posts).toBe(0);
  expect(state.puts).toBe(0);
});

test("stale administrator data never permits writes after identity error", async ({
  page,
}) => {
  const state = await setup(page);
  await page
    .getByRole("checkbox", { name: "Select Saronic Technologies" })
    .check();
  state.identityFailure = true;
  await page.evaluate("window.__registrantRecheck()");
  await expect(
    page.getByText("Session verification unavailable"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import 1 client", exact: true }),
  ).toBeDisabled();
  expect(state.posts).toBe(0);
});

for (const changed of ["user", "tenant"] as const) {
  test(`a changed ${changed} during preflight stops the old attempt before POST`, async ({
    page,
  }) => {
    const state = await setup(page);
    await page
      .getByRole("checkbox", { name: "Select Saronic Technologies" })
      .check();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let preflight = false;
    await page.route("**/firm/import-candidates", async (route) => {
      preflight = true;
      await gate;
      await route.fulfill({
        json: {
          registrantId: 12,
          registrantName: "Maven Advocacy",
          candidates: rows,
        },
      });
    });
    await page
      .getByRole("button", { name: "Import 1 client", exact: true })
      .click();
    await expect.poll(() => preflight).toBe(true);
    await page.route("**/core/me", (route) =>
      route.fulfill({
        json: {
          user: {
            id: changed === "user" ? "another-user" : "synthetic-user",
            email: "fixture@example.invalid",
          },
          tenant: {
            id: changed === "tenant" ? "another-tenant" : "synthetic-tenant",
            name: "Synthetic Firm",
          },
          role: "user_admin",
        },
      }),
    );
    await page.evaluate("window.__registrantRecheck()");
    release?.();
    await expect(
      page.getByText(
        "Your session changed. Refresh and review before importing.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Import completion is unconfirmed" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("receipts")).toHaveText("0");
    expect(state.posts).toBe(0);
  });
}

test("missing user ID never enables an administrator write", async ({
  page,
}) => {
  const state = await setup(page, { userId: "" });
  await expect(
    page.getByText(
      "Your firm session could not be verified. Refresh your session before importing.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Import \d/ })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  expect(state.posts).toBe(0);
  expect(state.puts).toBe(0);
});

test("an unmounted preflight cannot POST from its stale identity cache", async ({
  page,
}) => {
  const state = await setup(page);
  await page
    .getByRole("checkbox", { name: "Select Saronic Technologies" })
    .check();
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let preflight = false;
  await page.route("**/firm/import-candidates", async (route) => {
    preflight = true;
    await gate;
    await route.fulfill({
      json: {
        registrantId: 12,
        registrantName: "Maven Advocacy",
        candidates: rows,
      },
    });
  });
  await page
    .getByRole("button", { name: "Import 1 client", exact: true })
    .click();
  await expect.poll(() => preflight).toBe(true);
  await page.evaluate("window.__registrantUnmount()");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  release?.();
  await expect
    .poll(() => page.evaluate("window.__registrantPendingWrites()"))
    .toBe(0);
  expect(state.posts).toBe(0);
  await expect(page.getByTestId("receipts")).toHaveText("0");
});

test("already imported rows are disabled and aliases select one canonical ID", async ({
  page,
}) => {
  const state = await setup(page, {
    candidates: [
      ...rows,
      { ...candidate(8, "Saronic filing alias"), totalSpend: 12 },
    ],
  });
  await expect(
    page.getByRole("checkbox", { name: "Select Anduril" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Saronic filing alias (filing alias)"),
  ).toBeVisible();
  await expect(
    page.getByText("These filing names share one LDA client ID; import once."),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Select Saronic Technologies" })
    .check();
  await page
    .getByRole("button", { name: "Import 1 client", exact: true })
    .click();
  await expect(
    page.getByText("1 client profiles created. 0 skipped."),
  ).toBeVisible();
  expect(state.posts).toBe(1);
});

test("anchor drift blocks dispatch and asks for refreshed review", async ({
  page,
}) => {
  const state = await setup(page);
  await page
    .getByRole("checkbox", { name: "Select Saronic Technologies" })
    .check();
  await page.route("**/firm/registrant", (route) =>
    route.fulfill({
      json: { ldaRegistrantId: 99, ldaRegistrantName: "Changed Firm" },
    }),
  );
  await page
    .getByRole("button", { name: "Import 1 client", exact: true })
    .click();
  await expect(
    page.getByText(
      "The linked firm changed. Refresh and review before importing.",
    ),
  ).toBeVisible();
  expect(state.posts).toBe(0);
});

test("pending import refuses duplicate clicks and closing", async ({
  page,
}) => {
  const state = await setup(page);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("**/firm/import", async (route) => {
    calls++;
    await gate;
    await route.fulfill({
      json: {
        created: 1,
        items: [
          {
            id: "client-created",
            name: "Saronic Technologies",
            ldaClientId: 8,
          },
        ],
        skipped: [],
      },
    });
  });
  await page
    .getByRole("checkbox", { name: "Select Saronic Technologies" })
    .check();
  await page
    .getByRole("button", { name: "Import 1 client", exact: true })
    .dblclick();
  await expect(page.getByRole("button", { name: "Importing…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect.poll(() => calls).toBe(1);
  expect(state.posts).toBe(0);
  release?.();
  await expect(
    page.getByText("1 client profiles created. 0 skipped."),
  ).toBeVisible();
});

test("unknown completion freezes IDs and readback never becomes a fake receipt", async ({
  page,
}) => {
  const state = await setup(page);
  let posts = 0;
  await page.route("**/firm/import", (route) => {
    posts++;
    state.candidates = [
      candidate(8, "Saronic Technologies", "Created despite lost receipt"),
      ...rows.slice(1),
    ];
    return route.fulfill({
      status: 503,
      json: { message: "Receipt unavailable" },
    });
  });
  await page
    .getByRole("checkbox", { name: "Select Saronic Technologies" })
    .check();
  await page
    .getByRole("button", { name: "Import 1 client", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import completion is unconfirmed" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check current client state" })
    .click();
  await expect(
    page.getByText(
      "LDA client 8: Currently linked to Created despite lost receipt",
    ),
  ).toBeVisible();
  await expect(page.getByTestId("receipts")).toHaveText("0");
  expect(posts).toBe(1);
  await expect(page.getByRole("button", { name: /^Import \d/ })).toHaveCount(0);
});

for (const event of ["invalidate", "unmount"])
  for (const stage of ["POST", "read-model-refresh"])
    test(`held ${stage} cannot publish import success after ${event}`, async ({
      page,
    }) => {
      const state = await setup(page);
      let reached = false,
        posts = 0;
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/firm/import-candidates", async (route) => {
        // Initial/preflight reads may race setup; only hold a post-write refresh.
        if (stage === "read-model-refresh" && posts === 1) {
          reached = true;
          await held;
        }
        await route.fulfill({
          json: {
            registrantId: 12,
            registrantName: "Maven Advocacy",
            candidates: rows,
          },
        });
      });
      await page.route("**/firm/import", async (route) => {
        posts++;
        if (stage === "POST") {
          reached = true;
          await held;
        }
        await route.fulfill({
          json: {
            created: 1,
            items: [
              {
                id: "client-created",
                name: "Saronic Technologies",
                ldaClientId: 8,
              },
            ],
            skipped: [],
          },
        });
      });
      await page
        .getByRole("checkbox", { name: "Select Saronic Technologies" })
        .check();
      await page
        .getByRole("button", { name: "Import 1 client", exact: true })
        .click();
      await expect.poll(() => reached).toBe(true);
      if (event === "unmount")
        await page.evaluate(() => window.__registrantUnmount?.());
      else {
        state.identityFailure = true;
        await page.evaluate(() => window.__registrantRecheck?.());
      }
      release();
      await expect
        .poll(() => page.evaluate(() => window.__registrantPendingWrites?.()))
        .toBe(0);
      await expect(page.getByTestId("receipts")).toHaveText("0");
      await expect(
        page.getByText("1 client profiles created. 0 skipped."),
      ).toHaveCount(0);
      expect(posts).toBe(1);
    });

test("explicit slot refusal retains selected input without a receipt", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/firm/import", (route) =>
    route.fulfill({
      status: 402,
      json: { message: "You've used all client slots." },
    }),
  );
  await page
    .getByRole("checkbox", { name: "Select Saronic Technologies" })
    .check();
  await page
    .getByRole("button", { name: "Import 1 client", exact: true })
    .click();
  await expect(page.getByText("You've used all client slots.")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Select Saronic Technologies" }),
  ).toBeChecked();
  await expect(page.getByTestId("receipts")).toHaveText("0");
});

test("empty candidate feed remains an explicit empty state", async ({
  page,
}) => {
  await setup(page, { candidates: [] });
  await expect(
    page.getByText("No LDA client filings were found for this firm."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import 0 clients" }),
  ).toBeDisabled();
});

test("lost firm-link receipt requires readback and never imports implicitly", async ({
  page,
}) => {
  const state = await setup(page, { linked: false });
  let linked = false;
  let writes = 0;
  await page.route("**/firm/registrant", (route) => {
    if (route.request().method() === "PUT") {
      linked = true;
      writes++;
      return route.fulfill({
        status: 503,
        json: { message: "Link receipt unavailable" },
      });
    }
    return route.fulfill({
      json: linked
        ? anchor
        : { ldaRegistrantId: null, ldaRegistrantName: null },
    });
  });
  await page.getByRole("textbox", { name: "Firm name" }).fill("Maven");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Link Maven Advocacy" }).click();
  await page.getByRole("button", { name: "Confirm firm link" }).click();
  await expect(
    page.getByText(
      "The firm link is not confirmed. Read back the current link before choosing again.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm firm link" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Refresh linked firm" }).click();
  await expect(
    page.getByText("Firm-wide setup · Linked firm: Maven Advocacy"),
  ).toBeVisible();
  expect(writes).toBe(1);
  expect(state.posts).toBe(0);
});

test("foreign successful-looking receipt is refused and stays unconfirmed", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/firm/import", (route) =>
    route.fulfill({
      json: {
        created: 1,
        items: [{ id: "foreign", name: "Foreign", ldaClientId: 99 }],
        skipped: [],
      },
    }),
  );
  await page
    .getByRole("checkbox", { name: "Select Saronic Technologies" })
    .check();
  await page
    .getByRole("button", { name: "Import 1 client", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import completion is unconfirmed" }),
  ).toBeVisible();
  await expect(page.getByText("Original LDA client IDs: 8")).toBeVisible();
  await expect(page.getByTestId("receipts")).toHaveText("0");
  await expect(
    page.getByText("1 client profiles created. 0 skipped."),
  ).toHaveCount(0);
});

test("selection stops at100 and remains selected through filtering", async ({
  page,
}) => {
  const state = await setup(page, {
    candidates: Array.from({ length: 101 }, (_, index) =>
      candidate(index + 1, `Synthetic Client ${index + 1}`),
    ),
  });
  for (let id = 1; id <= 100; id++)
    await page
      .getByRole("checkbox", {
        name: `Select Synthetic Client ${id}`,
        exact: true,
      })
      .check();
  await expect(
    page.getByRole("button", { name: "Import 100 clients" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("checkbox", {
      name: "Select Synthetic Client 101",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Filter clients" })
    .fill("Client 101");
  await expect(
    page.getByRole("button", { name: "Import 100 clients" }),
  ).toBeEnabled();
  await page.getByRole("textbox", { name: "Filter clients" }).clear();
  await expect(
    page.getByRole("checkbox", {
      name: "Select Synthetic Client 1",
      exact: true,
    }),
  ).toBeChecked();
  expect(state.posts).toBe(0);
});

test("desktop light visual layout and keyboard dialog focus", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page
    .getByRole("checkbox", { name: "Select Saronic Technologies" })
    .check();
  await page.evaluate(() => document.fonts.ready);
  const box = await page.getByRole("dialog").boundingBox();
  expect(box?.width).toBe(640);
  expect(
    await page.evaluate(
      async () => (await document.fonts.load('14px "Geist Test"')).length,
    ),
  ).toBeGreaterThan(0);
  await page.screenshot({
    path: testInfo.outputPath("registrant-review-desktop-light.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Import with LDA", exact: true }),
  ).toBeFocused();
});

test("mobile dark review has no horizontal overflow and accessible actions", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await setup(page);
  await page
    .getByRole("checkbox", { name: "Select Saronic Technologies" })
    .check();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const dialog = page.getByRole("dialog");
  expect(
    await dialog.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe("rgb(27, 27, 27)");
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Import 1 client", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("registrant-review-mobile-dark.png"),
    fullPage: true,
  });
});
