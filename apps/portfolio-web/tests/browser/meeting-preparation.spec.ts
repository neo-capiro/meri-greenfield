import { test, expect, type Page } from "@playwright/test";
import { installFixtures, json, clientId, client } from "./fixtures";
import type { PrepJob } from "../../src/features/calendar/preparation/schema";

const meetingId = "90000000-0000-4000-8000-000000000004";
const initialPrep = {
  id: "prep-synthetic",
  meetingId,
  clientId,
  status: "approved",
  summary: "Synthetic preparation summary",
  agenda: [{ text: "Evidence-linked agenda", factIds: ["fact-one"] }],
  talkingPoints: ["Review the saved evidence"],
  risks: [],
  followUps: [],
  emailEvidence: ["Synthetic saved email evidence"],
  createdAt: "2026-10-11T00:00:00Z",
  sharedAt: null,
  generatedFrom: {
    grounding: {
      version: 1,
      contentEdited: false,
      attendees: [],
      sources: [
        {
          id: "source-one",
          kind: "meeting",
          title: "Synthetic source meeting",
          recordId: "source-one",
          observedAt: null,
          excerpt: "Synthetic evidence excerpt",
        },
      ],
      references: [],
      limitations: [],
    },
  },
};
const initialJob: PrepJob = {
  jobId: "job-synthetic",
  meetingId,
  status: "queued",
  stage: "queued",
  depth: "standard",
  prepId: null,
  errorCode: null,
  deadlineAt: "2099-10-11T23:00:00Z",
};
async function fixture(page: Page, empty = false) {
  const unexpected = await installFixtures(page);
  const meeting = {
    id: meetingId,
    subject: "Synthetic preparation meeting",
    description: null,
    location: null,
    startsAt: "2026-10-15T14:00:00Z",
    endsAt: "2026-10-15T15:00:00Z",
    status: "scheduled",
    joinLink: null,
    visibility: "private",
    isVirtual: false,
    meri: null,
    client: { id: clientId, name: client.name },
    attendees: [],
    preps: empty ? [] : [structuredClone(initialPrep)],
  };
  await page.route("**/core/engagement/capabilities", (route) =>
    json(route, {
      meetingPrepComprehensiveEnabled: true,
      runtime: { externalActionsEnabled: true },
    }),
  );
  await page.route("**/core/engagement/meetings**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET" && path.endsWith("/notetaker"))
      return json(route, null);
    if (path.endsWith("/prep-jobs/latest")) return json(route, null);
    if (path.endsWith(meetingId)) return json(route, meeting);
    return json(route, [meeting]);
  });
  const open = async () => {
    await page.goto(
      `/portfolio/${clientId}/calendar?view=agenda&date=2026-10-15&zone=UTC&meeting=${meetingId}`,
    );
    const drawer = page.getByRole("dialog", {
      name: meeting.subject,
      exact: true,
    });
    await expect(drawer).toBeVisible();
    await drawer
      .getByRole("button", { name: "Preparation", exact: true })
      .click();
    await expect(
      drawer.getByRole("region", { name: "Meeting preparation" }),
    ).toBeVisible();
    return drawer;
  };
  return { unexpected, meeting, open };
}

test("edit persists only changed sections, retains failed draft, and shows saved sources", async ({
  page,
}) => {
  const { meeting, open, unexpected } = await fixture(page);
  let saves = 0;
  const payloads: unknown[] = [];
  await page.route(
    "**/core/engagement/meeting-preps/prep-synthetic",
    (route) => {
      saves++;
      const body = route.request().postDataJSON();
      payloads.push(body);
      if (saves === 1)
        return json(
          route,
          { message: "Synthetic temporary save failure" },
          503,
        );
      meeting.preps[0]!.summary = body.summary;
      meeting.preps[0]!.generatedFrom.grounding.contentEdited = true;
      return json(route, meeting.preps[0]);
    },
  );
  const drawer = await open();
  await expect(
    drawer.getByText("Synthetic saved email evidence", { exact: true }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Edit prep", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit prep", exact: true });
  await editor
    .getByLabel("Summary", { exact: true })
    .fill("Updated synthetic summary");
  await editor.getByRole("button", { name: "Save prep", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText(
    "Synthetic temporary save failure",
  );
  await expect(editor.getByLabel("Summary", { exact: true })).toHaveValue(
    "Updated synthetic summary",
  );
  await page.screenshot({
    path: "test-results/meeting-preparation-edit-error.png",
    fullPage: true,
  });
  await editor
    .getByRole("button", { name: "Retry save prep", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  await expect(
    drawer.getByText("Updated synthetic summary", { exact: true }),
  ).toBeVisible();
  expect(payloads).toEqual([
    { summary: "Updated synthetic summary" },
    { summary: "Updated synthetic summary" },
  ]);
  await drawer
    .getByRole("button", { name: "View sources and citations" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Preparation sources and citations" }),
  ).toContainText("Synthetic evidence excerpt");
  await expect(
    page.getByRole("dialog", { name: "Preparation sources and citations" }),
  ).toContainText("does not independently verify edits");
  await page.screenshot({
    path: "test-results/meeting-preparation-sources.png",
    fullPage: true,
  });
  await page
    .getByRole("dialog", { name: "Preparation sources and citations" })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/meeting-preparation-desktop.png",
    fullPage: true,
  });
  expect(unexpected).toEqual([]);
});

test("durable generation stays pending, failure preserves previous prep, explicit resume loads completion", async ({
  page,
}) => {
  const { meeting, open, unexpected } = await fixture(page);
  let job: PrepJob | null = null;
  const commands: string[] = [];
  await page.route(
    `**/core/engagement/meetings/${meetingId}/prep-jobs/latest`,
    (route) => json(route, job),
  );
  await page.route(`**/core/engagement/meetings/${meetingId}/prep`, (route) => {
    commands.push("generate");
    job = { ...initialJob };
    return json(route, job, 202);
  });
  await page.route(
    `**/core/engagement/meetings/${meetingId}/prep-jobs/job-synthetic/resume`,
    (route) => {
      commands.push("resume");
      job = { ...initialJob, status: "running", stage: "reading_evidence" };
      return json(route, job, 202);
    },
  );
  const drawer = await open();
  await drawer.getByRole("button", { name: "Regenerate", exact: true }).click();
  const progress = page.getByRole("dialog", {
    name: "Preparing your briefing",
    exact: true,
  });
  await expect(
    progress.getByRole("button", { name: "Cancel preparation", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/meeting-preparation-progress.png",
    fullPage: true,
  });
  await progress.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    drawer.getByText(
      "Progress is saved. You can close this page while preparation runs.",
    ),
  ).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Regenerate", exact: true }),
  ).toBeDisabled();
  await expect(
    drawer.getByText(initialPrep.summary, { exact: true }),
  ).toBeVisible();
  job = {
    ...initialJob,
    status: "failed",
    stage: "failed",
    errorCode: "PREP_SYNTHETIC_FAILURE",
  };
  await expect(
    drawer.getByText("Preparation could not finish", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    drawer.getByText(initialPrep.summary, { exact: true }),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "Resume preparation", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Preparing your briefing", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    drawer.getByText("Current stage: reading evidence", { exact: true }),
  ).toBeVisible();
  meeting.preps[0] = {
    ...initialPrep,
    id: "prep-generated",
    summary: "New saved synthetic briefing",
  };
  job = {
    ...initialJob,
    status: "completed",
    stage: "completed",
    prepId: "prep-generated",
  };
  await expect(
    drawer.getByText("New saved synthetic briefing", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  expect(commands).toEqual(["generate", "resume"]);
  expect(unexpected).toEqual([]);
});

test("ambiguous submit retries the same key and cancel observes the saved job", async ({
  page,
}) => {
  const { open, unexpected } = await fixture(page, true);
  const bodies: unknown[] = [];
  let job: PrepJob | null = null;
  await page.route(
    `**/core/engagement/meetings/${meetingId}/prep-jobs/latest`,
    (route) => json(route, job),
  );
  await page.route(`**/core/engagement/meetings/${meetingId}/prep`, (route) => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) return route.abort("failed");
    job = { ...initialJob };
    return json(route, job, 202);
  });
  await page.route(
    `**/core/engagement/meetings/${meetingId}/prep-jobs/job-synthetic`,
    (route) => {
      expect(route.request().method()).toBe("DELETE");
      job = { ...initialJob, status: "cancelled", stage: "cancelled" };
      return json(route, job);
    },
  );
  const drawer = await open();
  await drawer.getByLabel("Refine preparation").fill("Synthetic focus");
  await drawer
    .getByRole("button", { name: "Generate with Meri", exact: true })
    .click();
  await expect(
    drawer.getByText(
      "The request outcome is not confirmed. Check saved status before continuing.",
    ),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "Check preparation status" })
    .click();
  await drawer
    .getByRole("button", { name: "Retry same preparation request" })
    .click();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  await page
    .getByRole("dialog", { name: "Preparing your briefing", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Cancel preparation", exact: true })
    .click();
  await expect(
    drawer.getByText("Preparation cancelled", { exact: true }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});

test("source settings enforce client receipt, save board IDs, and send selected depth", async ({
  page,
}) => {
  const { open, unexpected } = await fixture(page, true);
  let stale = true;
  let saved: unknown;
  await page.route(
    `**/core/engagement/meetings/${meetingId}/prep-monday-mapping`,
    (route) => {
      if (route.request().method() === "PUT") {
        saved = route.request().postDataJSON();
        return json(route, {
          clientId,
          boardIds: ["123", "987654321098765432109876"],
        });
      }
      return json(route, {
        clientId: stale ? "wrong-client" : clientId,
        boardIds: [],
      });
    },
  );
  let submitted: unknown;
  await page.route(`**/core/engagement/meetings/${meetingId}/prep`, (route) => {
    submitted = route.request().postDataJSON();
    return json(route, { ...initialJob, depth: "deep" }, 202);
  });
  const drawer = await open();
  await drawer.getByRole("button", { name: "Prep settings" }).click();
  const settings = page.getByRole("dialog", {
    name: "Meeting preparation sources",
    exact: true,
  });
  await expect(settings.getByRole("alert")).toContainText(
    "meeting client changed",
  );
  await expect(
    settings.getByLabel("Monday.com board IDs for this client"),
  ).toBeDisabled();
  await expect(
    settings.getByRole("button", { name: "Generate with Meri" }),
  ).toBeDisabled();
  stale = false;
  await settings.getByRole("button", { name: "Retry", exact: true }).click();
  await settings
    .getByLabel("Monday.com board IDs for this client")
    .fill("123, 987654321098765432109876");
  await expect(
    settings.getByRole("button", { name: "Generate with Meri" }),
  ).toBeDisabled();
  await settings.getByRole("button", { name: "Save board mapping" }).click();
  await expect(
    settings.getByText("Board mapping saved.", { exact: true }),
  ).toBeVisible();
  await settings.getByLabel("Search depth").selectOption("deep");
  await page.screenshot({
    path: "test-results/meeting-preparation-settings.png",
    fullPage: true,
  });
  await settings.getByRole("button", { name: "Generate with Meri" }).click();
  expect(saved).toEqual({ boardIds: ["123", "987654321098765432109876"] });
  expect(submitted).toMatchObject({ depth: "deep" });
  expect(unexpected).toEqual([]);
});

test("read-only role sees saved preparation without mutation controls on mobile dark", async ({
  page,
}) => {
  const { open, unexpected } = await fixture(page);
  await page.route("**/core/me", (route) =>
    json(route, {
      user: { id: "user-readonly", email: "readonly@example.test" },
      tenant: { id: "tenant-test", name: "UI tests" },
      role: "client_portal_user",
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const drawer = await open();
  await expect(
    drawer.getByText(initialPrep.summary, { exact: true }),
  ).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Edit prep" })).toHaveCount(
    0,
  );
  await expect(
    drawer.getByRole("button", { name: "Generate with Meri" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/meeting-preparation-mobile-dark.png",
    fullPage: true,
  });
  expect(unexpected).toEqual([]);
});

test("comprehensive briefing renders saved coverage and linked source quotations", async ({
  page,
}) => {
  const { meeting, open, unexpected } = await fixture(page);
  const response = {
    ...meeting,
    preps: [
      {
        ...initialPrep,
        generatedFrom: {
          ...initialPrep.generatedFrom,
          briefing: {
            version: 2,
            takeaways: [
              {
                text: "Synthetic comprehensive takeaway",
                factIds: ["fact-one"],
              },
            ],
            sections: {
              unresolvedIssues: {
                status: "covered",
                items: [
                  {
                    text: "Synthetic unresolved question",
                    factIds: ["fact-one"],
                  },
                ],
                gap: "",
              },
            },
            facts: [
              {
                id: "fact-one",
                sourceId: "source-one",
                quote: "Synthetic source quotation",
              },
            ],
            coverage: {
              extractedBatches: 1,
              totalBatches: 2,
              factCount: 1,
              reviewedFactCount: 1,
              selectedFactCount: 1,
              partial: true,
            },
            limitations: ["Synthetic source coverage limitation"],
          },
        },
      },
    ],
  };
  await page.route(`**/core/engagement/meetings/${meetingId}`, (route) =>
    json(route, response),
  );
  const drawer = await open();
  await expect(
    drawer.getByText("Synthetic comprehensive takeaway", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByText("Synthetic unresolved question", { exact: true }),
  ).toBeVisible();
  await expect(drawer.getByText(/Partial source coverage/)).toBeVisible();
  await expect(
    drawer.getByText("Synthetic source coverage limitation", { exact: true }),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "View sources and citations" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Preparation sources and citations" }),
  ).toContainText("Synthetic source quotation");
  expect(unexpected).toEqual([]);
});

test("institutional draft remains in its originating review flow and omitted sharing is unknown", async ({
  page,
}) => {
  const { meeting, open, unexpected } = await fixture(page);
  await page.route(`**/core/engagement/meetings/${meetingId}`, (route) =>
    json(route, {
      ...meeting,
      preps: [
        {
          ...initialPrep,
          sharedAt: undefined,
          status: "edited",
          generatedFrom: {
            schemaVersion: "research_portfolio_institutional_v1",
            briefing: true,
            reviewStatus: "unreviewed_draft",
          },
        },
      ],
    }),
  );
  const drawer = await open();
  await expect(
    drawer.getByText(/originating Research Portfolio review workflow/),
  ).toBeVisible();
  await expect(
    drawer.getByText(initialPrep.summary, { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Edit prep", exact: true }),
  ).toHaveCount(0);
  await expect(
    drawer.getByRole("button", { name: "Regenerate", exact: true }),
  ).toHaveCount(0);
  await expect(
    drawer.getByText("Private until shared", { exact: true }),
  ).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("structured email evidence retains attribution through unrelated edits and rejects unsafe source links", async ({
  page,
}) => {
  const { meeting, open, unexpected } = await fixture(page);
  const evidence = [
    {
      summary: "Synthetic attributed email exchange",
      sourceId: "email-synthetic-one",
      sourceUrl: "https://example.test/mail/one",
    },
    {
      summary: "Synthetic saved exchange with an invalid link",
      sourceId: "email-synthetic-two",
      sourceUrl: "javascript:alert(1)",
    },
  ];
  const savedPrep = { ...initialPrep, emailEvidence: evidence };
  await page.route(`**/core/engagement/meetings/${meetingId}`, (route) =>
    json(route, { ...meeting, preps: [savedPrep] }),
  );
  const payloads: unknown[] = [];
  await page.route(
    "**/core/engagement/meeting-preps/prep-synthetic",
    (route) => {
      const body = route.request().postDataJSON();
      payloads.push(body);
      savedPrep.summary = body.summary;
      return json(route, savedPrep);
    },
  );
  const drawer = await open();
  await expect(
    drawer.getByText("Synthetic attributed email exchange", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("link", {
      name: "Source email-synthetic-one",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://example.test/mail/one");
  await expect(
    drawer.getByText("Source email-synthetic-two", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("link", {
      name: "Source email-synthetic-two",
      exact: true,
    }),
  ).toHaveCount(0);
  await drawer.getByRole("button", { name: "Edit prep", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit prep", exact: true });
  await expect(
    editor.getByLabel("Email evidence", { exact: true }),
  ).toBeDisabled();
  await expect(editor.getByRole("note")).toContainText("source attribution");
  await editor
    .getByLabel("Summary", { exact: true })
    .fill("Unrelated synthetic edit");
  await editor.getByRole("button", { name: "Save prep", exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect(payloads).toEqual([{ summary: "Unrelated synthetic edit" }]);
  expect(savedPrep.emailEvidence).toEqual(evidence);
  await expect(
    drawer.getByText("Synthetic attributed email exchange", { exact: true }),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "View sources and citations" })
    .click();
  const sources = page.getByRole("dialog", {
    name: "Preparation sources and citations",
  });
  await expect(
    sources.getByRole("link", {
      name: "Source email-synthetic-one",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://example.test/mail/one");
  await expect(
    sources.getByRole("link", {
      name: "Source email-synthetic-two",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/meeting-preparation-email-evidence.png",
    fullPage: true,
  });
  expect(unexpected).toEqual([]);
});

test("completed job without an artifact receipt never claims a briefing is ready", async ({
  page,
}) => {
  const { open, unexpected } = await fixture(page, true);
  await page.route(
    `**/core/engagement/meetings/${meetingId}/prep-jobs/latest`,
    (route) =>
      json(route, { ...initialJob, status: "completed", prepId: null }),
  );
  const drawer = await open();
  await expect(
    drawer.getByText(
      "The service reported completion without a saved preparation reference.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    drawer.getByText("The saved briefing is ready to use.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    drawer.getByText("No preparation yet.", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("button", {
      name: "Check preparation status",
      exact: true,
    }),
  ).toBeEnabled();
  expect(unexpected).toEqual([]);
});
