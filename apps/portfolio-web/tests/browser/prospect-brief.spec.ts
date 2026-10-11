import { test, expect, type Page } from "@playwright/test";
import { installFixtures, json, prospectId } from "./fixtures";
import {
  sectionKeys,
  type CurrentBrief,
  type BriefVersion,
} from "../../src/features/prospects/brief/contracts";

const base = `/business-development/prospects/${prospectId}/brief`;
test.use({ timezoneId: "America/Los_Angeles", locale: "en-US" });
const citation = {
  sourceFamily: "sam_entity",
  recordId: "source-synthetic-one",
  locator: "https://example.test/source/one",
  originalSourceName: "Synthetic public registry",
  originalSourceId: "registration-one",
  eventDate: "2026-08-02",
  sourceUpdatedAt: "2026-09-03",
  retrievedAt: "2026-10-04",
  title: "Synthetic registered company identity",
  relationshipStrength: "direct",
  stage: null,
};
function version(number: number): BriefVersion {
  return {
    id: `brief-version-${number}`,
    versionNumber: number,
    createdAt: `2026-10-${String(number).padStart(2, "0")}T12:00:00Z`,
    createdByUserId: "user-test",
    sectionsHash: `sections-${number}`,
    citationCount: 1,
    citations: [citation],
    snapshotHash: `snapshot-${number}`,
    sourceSnapshot: {
      generatedAt: "2026-10-01T12:00:00Z",
      identityBasis: "Synthetic verified registry identity",
      canonicalEntityId: null,
      canonicalName: "Test Prospect",
      evidence: [
        {
          sourceFamily: "sam_entity",
          recordId: citation.recordId,
          locator: citation.locator,
          originalSourceName: citation.originalSourceName,
          originalSourceId: citation.originalSourceId,
          claimType: "identity",
          relationshipStrength: "direct",
          eventDate: citation.eventDate,
          effectiveDate: null,
          fiscalYear: null,
          stage: null,
          sourceUpdatedAt: citation.sourceUpdatedAt,
          fetchedAt: citation.retrievedAt,
          scopeChecked: "Synthetic exact registry match",
          status: "available",
          title: citation.title,
          detail: {},
        },
      ],
    },
    sections: {
      companyAndFirmImplication: {
        text: "Synthetic company implication",
        provenance: "generated",
        citationIndexes: [0],
      },
      verifiedEvidence: {
        text: "Synthetic verified record; no financial estimates inferred",
        provenance: "generated",
        citationIndexes: [0],
      },
      judgment: {
        text: "Synthetic qualified judgment",
        provenance: "generated",
        citationIndexes: [],
      },
      practicalAction: {
        text: "Synthetic practical action",
        provenance: "generated",
        citationIndexes: [],
      },
      missingInformation: {
        text: "Synthetic information gap",
        provenance: "generated",
        citationIndexes: [],
      },
    },
  };
}
function current(saved = version(1)): CurrentBrief {
  return {
    brief: {
      id: "brief-synthetic",
      tenantId: "tenant-test",
      prospectId,
      title: "Federal strategy brief, Test Prospect",
      status: "draft",
      currentVersionNumber: saved.versionNumber,
      currentVersionId: saved.id,
      createdAt: "2026-10-01T12:00:00Z",
      updatedAt: saved.createdAt,
      createdByUserId: "user-test",
    },
    currentVersion: saved,
  };
}
async function fixture(page: Page, initial: CurrentBrief = current()) {
  const unexpected = await installFixtures(page);
  let data = initial;
  await page.route(`**${base}`, (route) => json(route, data));
  const openCard = async () => {
    await page.goto(`/portfolio/prospects/${prospectId}`);
    const card = page.getByRole("region", {
      name: "Federal strategy brief",
      exact: true,
    });
    await expect(card).toBeVisible();
    return card;
  };
  const open = async () => {
    const card = await openCard();
    await card.getByRole("button", { name: "Open brief", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Federal strategy brief, Test Prospect",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    return dialog;
  };
  return {
    unexpected,
    openCard,
    open,
    set: (value: CurrentBrief) => {
      data = value;
    },
  };
}

test("initial generation retries a frozen key after a lost response and opens saved content", async ({
  page,
}) => {
  const f = await fixture(page, { brief: null, currentVersion: null });
  const attempts: unknown[] = [];
  await page.route(`**${base}/versions`, async (route) => {
    attempts.push(route.request().postDataJSON());
    f.set(current());
    if (attempts.length === 1) return route.abort("failed");
    return json(route, {
      brief: current().brief,
      version: version(1),
      created: false,
    });
  });
  const card = await f.openCard();
  await card
    .getByRole("button", { name: "Generate from dossier", exact: true })
    .click();
  await expect(
    card.getByText(/creation outcome is not confirmed/),
  ).toBeVisible();
  expect(attempts).toHaveLength(1);
  await card
    .getByRole("button", { name: "Check saved status", exact: true })
    .click();
  await expect(card.getByRole("button", { name: "Open brief" })).toBeVisible();
  await card
    .getByRole("button", { name: "Retry same creation request" })
    .click();
  await expect(card.getByText(/creation outcome is not confirmed/)).toHaveCount(
    0,
  );
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
  await card.getByRole("button", { name: "Open brief" }).click();
  await expect(
    page.getByRole("article", { name: "Saved brief version 1" }),
  ).toContainText("Synthetic verified record; no financial estimates inferred");
  expect(
    await page.evaluate(async () => {
      await document.fonts.ready;
      const heading = document.querySelector(
        'article[aria-label="Saved brief version 1"] h2',
      );
      return {
        loaded: [...document.fonts].some(
          (font) => font.family === "Newsreader" && font.status === "loaded",
        ),
        family: heading ? getComputedStyle(heading).fontFamily : "",
      };
    }),
  ).toMatchObject({
    loaded: true,
    family: expect.stringContaining("Newsreader"),
  });
  await page.screenshot({
    path: "test-results/prospect-brief-desktop.png",
    fullPage: true,
  });
  expect(f.unexpected).toEqual([]);
});

test("version conflict preserves the draft and requires latest review before a new save", async ({
  page,
}) => {
  const f = await fixture(page);
  const concurrent = version(2);
  concurrent.sections.verifiedEvidence.text =
    "Synthetic concurrent evidence update";
  const payloads: {
    idempotencyKey: string;
    expectedVersionNumber: number;
    sections: BriefVersion["sections"];
  }[] = [];
  await page.route(`**${base}/versions`, (route) => {
    const body = route.request().postDataJSON();
    payloads.push(body);
    if (payloads.length === 1) {
      f.set(current(concurrent));
      return json(
        route,
        {
          code: "BIZDEV_BRIEF_VERSION_CONFLICT",
          message: "Synthetic version conflict",
        },
        409,
      );
    }
    const saved = { ...version(3), sections: body.sections };
    f.set(current(saved));
    return json(route, {
      brief: current(saved).brief,
      version: saved,
      created: true,
    });
  });
  const dialog = await f.open();
  await dialog
    .getByRole("button", { name: "Edit sections", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit saved prospect brief",
    exact: true,
  });
  await editor
    .getByLabel("Judgment", { exact: true })
    .fill("My preserved synthetic draft");
  await editor
    .getByRole("button", { name: "Save new version", exact: true })
    .click();
  await expect(
    editor.getByRole("alert").filter({ hasText: "Synthetic version conflict" }),
  ).toBeVisible();
  await expect(editor.getByLabel("Judgment", { exact: true })).toHaveValue(
    "My preserved synthetic draft",
  );
  await expect(
    editor.getByRole("button", { name: "Save new version" }),
  ).toBeDisabled();
  await editor
    .getByRole("button", { name: "Review latest version", exact: true })
    .click();
  await expect(
    editor.getByRole("region", { name: "Conflict review" }),
  ).toContainText("Synthetic concurrent evidence update");
  expect(payloads).toHaveLength(1);
  await page.screenshot({
    path: "test-results/prospect-brief-conflict.png",
    fullPage: true,
  });
  await editor
    .getByRole("button", {
      name: "Use latest base and keep my changed sections",
    })
    .click();
  await editor
    .getByRole("button", { name: "Save new version", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  expect(payloads[1]?.expectedVersionNumber).toBe(2);
  expect(payloads[1]?.idempotencyKey).not.toBe(payloads[0]?.idempotencyKey);
  expect(payloads[1]?.sections.judgment).toEqual({
    text: "My preserved synthetic draft",
    provenance: "edited",
    citationIndexes: [],
  });
  expect(payloads[1]?.sections.verifiedEvidence.text).toBe(
    "Synthetic concurrent evidence update",
  );
  await expect(
    dialog.getByRole("article", { name: "Saved brief version 3" }),
  ).toBeVisible();
  expect(f.unexpected).toEqual([]);
});

test("a draft root without a version can generate its first saved version", async ({
  page,
}) => {
  const saved = current();
  if (!saved.brief) throw new Error("Synthetic brief fixture is missing");
  const f = await fixture(page, {
    brief: {
      ...saved.brief,
      currentVersionId: null,
      currentVersionNumber: null,
    },
    currentVersion: null,
  });
  let writes = 0;
  await page.route(`**${base}/versions`, (route) => {
    expect(route.request().method()).toBe("POST");
    writes++;
    f.set(saved);
    return json(route, {
      brief: saved.brief,
      version: saved.currentVersion,
      created: true,
    });
  });
  const card = await f.openCard();
  await card.getByRole("button", { name: "Open brief", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: saved.brief.title,
    exact: true,
  });
  await expect(dialog).toContainText("No saved version is available.");
  await expect(
    dialog.getByRole("button", { name: "Edit sections" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await card
    .getByRole("button", { name: "Generate from dossier", exact: true })
    .click();
  await expect(card).toContainText("Version 1");
  expect(writes).toBe(1);
  expect(f.unexpected).toEqual([]);
});

test("ambiguous edit retains a frozen payload and exposes only explicit same-save retry", async ({
  page,
}) => {
  const f = await fixture(page);
  const payloads: unknown[] = [];
  await page.route(`**${base}/versions`, async (route) => {
    const input = route.request().postDataJSON();
    payloads.push(input);
    const saved = { ...version(2), sections: input.sections };
    f.set(current(saved));
    if (payloads.length === 1) return route.abort("failed");
    return json(route, {
      brief: current(saved).brief,
      version: saved,
      created: false,
    });
  });
  const dialog = await f.open();
  await dialog.getByRole("button", { name: "Edit sections" }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit saved prospect brief",
  });
  await editor
    .getByLabel("Practical action", { exact: true })
    .fill("Synthetic edited action");
  await editor.getByRole("button", { name: "Save new version" }).click();
  await expect(editor.getByText(/outcome is unconfirmed/)).toBeVisible();
  await expect(
    editor.getByLabel("Practical action", { exact: true }),
  ).toBeDisabled();
  expect(payloads).toHaveLength(1);
  await editor
    .getByRole("button", { name: "Retry same save", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toEqual(payloads[1]);
  expect(f.unexpected).toEqual([]);
});

test("current citations retain separate dates and historical versions never resolve against current indexes", async ({
  page,
}) => {
  const f = await fixture(page, current(version(2)));
  let resolves = 0;
  await page.route(`**${base}/citations?index=0`, (route) => {
    resolves++;
    return json(route, {
      resolvable: true,
      citation,
      sourceSnapshotEvidence: version(2).sourceSnapshot.evidence[0],
      currentDossierEvidence: null,
    });
  });
  await page.route(`**${base}/versions`, (route) =>
    json(route, {
      brief: current(version(2)).brief,
      versions: [version(1), version(2)],
    }),
  );
  await page.route(`**${base}/versions/1`, (route) => json(route, version(1)));
  const dialog = await f.open();
  await dialog
    .getByRole("button", { name: "Source 1", exact: true })
    .first()
    .click();
  let source = page.getByRole("dialog", {
    name: "Brief source 1",
    exact: true,
  });
  await expect(source.locator('time[datetime="2026-08-02"]')).toHaveText(
    "Aug 2, 2026",
  );
  await expect(source.locator('time[datetime="2026-09-03"]')).toHaveText(
    "Sep 3, 2026",
  );
  await expect(source.locator('time[datetime="2026-10-04"]')).toHaveText(
    "Oct 4, 2026",
  );
  await expect(source).toContainText("Synthetic verified registry identity");
  await expect(
    source.getByRole("link", { name: "Open original source" }),
  ).toHaveAttribute("href", citation.locator);
  await expect(source).toContainText("no current dossier match");
  await page.screenshot({
    path: "test-results/prospect-brief-source.png",
    fullPage: true,
  });
  await source.getByRole("button", { name: "Close", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Version history", exact: true })
    .click();
  await dialog.getByRole("button", { name: /^Version 1 ·/ }).click();
  await expect(
    dialog.getByRole("article", { name: "Saved brief version 1" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Edit sections" }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Source 1", exact: true })
    .first()
    .click();
  source = page.getByRole("dialog", { name: "Brief source 1", exact: true });
  await expect(source).toContainText(
    "Historical source shown from its immutable snapshot",
  );
  expect(resolves).toBe(1);
  expect(f.unexpected).toEqual([]);
});

test("refresh comparison preserves edited-result distinction and offers no unsafe apply", async ({
  page,
}) => {
  const f = await fixture(page);
  const sections = structuredClone(version(1).sections);
  sections.judgment = {
    ...sections.judgment,
    text: "My saved edited judgment",
    provenance: "edited",
  };
  await page.route(`**${base}/refresh-proposal`, (route) =>
    json(route, {
      baseVersionNumber: 1,
      proposed: sections,
      diff: sectionKeys.map((section) => ({
        section,
        changed: section === "judgment",
        baseText: version(1).sections[section].text,
        proposedText:
          section === "judgment"
            ? "Fresh synthetic suggestion"
            : version(1).sections[section].text,
      })),
      sourceSnapshot: version(1).sourceSnapshot,
      snapshotHash: "preview-synthetic",
    }),
  );
  const dialog = await f.open();
  await dialog
    .getByRole("button", { name: "Compare current dossier", exact: true })
    .click();
  const comparison = dialog.getByRole("region", { name: "Refresh comparison" });
  await expect(comparison).toContainText("Fresh synthetic suggestion");
  await expect(comparison).toContainText("edited section remains preserved");
  await expect(comparison).toContainText("Preview only");
  await expect(
    comparison.getByRole("button", { name: /Apply|Accept|Save/i }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/prospect-brief-refresh.png",
    fullPage: true,
  });
  expect(f.unexpected).toEqual([]);
});

test("unavailable brief404 is not mistaken for an empty brief and unauthorized roles never fetch it", async ({
  page,
}) => {
  const f = await fixture(page);
  let reads = 0;
  await page.route(`**${base}`, (route) => {
    reads++;
    return json(route, { message: "Not Found" }, 404);
  });
  const card = await f.openCard();
  await expect(card.getByText(/Briefs are unavailable/)).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Generate from dossier" }),
  ).toHaveCount(0);
  await page.route("**/core/me", (route) =>
    json(route, {
      user: { id: "user-readonly", email: "readonly@example.test" },
      tenant: { id: "tenant-test", name: "UI tests" },
      role: "client_portal_user",
    }),
  );
  await page.reload();
  await expect(card.getByText(/authorized firm member/)).toBeVisible();
  expect(reads).toBe(1);
  expect(f.unexpected).toEqual([]);
});

test("mobile dark saved brief remains readable and wrong-account receipts cannot open", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const dialog = await f.open();
  await expect(
    dialog.getByText("Synthetic company implication", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/prospect-brief-mobile-dark.png",
    fullPage: false,
  });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  const wrong = current();
  if (wrong.brief) wrong.brief.tenantId = "wrong-tenant";
  f.set(wrong);
  await page.reload();
  const card = page.getByRole("region", {
    name: "Federal strategy brief",
    exact: true,
  });
  await expect(card.getByRole("alert")).toContainText("prospect and account");
  await expect(card.getByRole("button", { name: "Open brief" })).toHaveCount(0);
  expect(f.unexpected).toEqual([]);
});

test("a denied edit preserves the local draft and disables another save", async ({
  page,
}) => {
  const f = await fixture(page);
  let writes = 0;
  await page.route(`**${base}/versions`, (route) => {
    writes++;
    return json(route, { message: "Synthetic source permission revoked" }, 403);
  });
  const dialog = await f.open();
  await dialog.getByRole("button", { name: "Edit sections" }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit saved prospect brief",
  });
  await editor
    .getByLabel("Judgment", { exact: true })
    .fill("Synthetic retained denied draft");
  await editor.getByRole("button", { name: "Save new version" }).click();
  await expect(editor.getByRole("alert")).toContainText(
    "do not have permission",
  );
  await expect(editor.getByLabel("Judgment", { exact: true })).toHaveValue(
    "Synthetic retained denied draft",
  );
  await expect(
    editor.getByRole("button", { name: "Save new version" }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  expect(f.unexpected).toEqual([]);
});

test("archived saved versions remain read-only and failed identity never exposes the brief", async ({
  page,
}) => {
  const archived = current();
  if (archived.brief) archived.brief.status = "archived";
  const f = await fixture(page, archived);
  let reads = 0;
  await page.route(`**${base}`, (route) => {
    reads++;
    return json(route, archived);
  });
  const dialog = await f.open();
  await expect(
    dialog.getByRole("article", { name: "Saved brief version 1" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Edit sections" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.route("**/core/me", (route) =>
    json(route, { message: "Synthetic identity unavailable" }, 503),
  );
  await page.reload();
  const card = page.getByRole("region", {
    name: "Federal strategy brief",
    exact: true,
  });
  await expect(card.getByRole("alert")).toContainText(
    "Synthetic identity unavailable",
  );
  await expect(card.getByRole("button", { name: "Open brief" })).toHaveCount(0);
  expect(reads).toBe(1);
  expect(f.unexpected).toEqual([]);
});

test("denied creation is a rejection and does not offer an ambiguous resend", async ({
  page,
}) => {
  const f = await fixture(page, { brief: null, currentVersion: null });
  let writes = 0;
  await page.route(`**${base}/versions`, (route) => {
    writes++;
    return json(route, { message: "Synthetic creation forbidden" }, 403);
  });
  const card = await f.openCard();
  await card.getByRole("button", { name: "Generate from dossier" }).click();
  await expect(card.getByText(/Creation was rejected/)).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Retry same creation request" }),
  ).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Generate from dossier" }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  expect(f.unexpected).toEqual([]);
});
