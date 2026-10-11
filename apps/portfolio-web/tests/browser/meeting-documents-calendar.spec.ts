import { test, expect, type Page } from "@playwright/test";
import { installFixtures, json, clientId, client, file } from "./fixtures";
const meetingId = "90000000-0000-4000-8000-000000000009";
const prepId = "91000000-0000-4000-8000-000000000009";
const attachmentId = "92000000-0000-4000-8000-000000000009";
const prep = {
  id: prepId,
  meetingId,
  clientId,
  status: "approved",
  summary: "Canonical saved preparation for document review",
  agenda: ["Review evidence"],
  talkingPoints: ["Discuss next steps"],
  risks: [],
  followUps: [],
  emailEvidence: [],
  createdAt: "2026-10-11T00:00:00Z",
};
const meeting = {
  id: meetingId,
  subject: "Synthetic Calendar document meeting",
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
  preps: [prep],
};
async function fixture(page: Page) {
  const unexpected = await installFixtures(page);
  let currentPrep = { ...prep };
  let pdfs = 0,
    clientAttachmentReads = 0,
    sends = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/mail/send"))
      sends++;
  });
  await page.route("**/core/engagement/capabilities", (route) =>
    json(route, {
      meetingPrepComprehensiveEnabled: false,
      runtime: { externalActionsEnabled: true },
    }),
  );
  await page.route("**/core/engagement/clients/*/notetaker", (route) =>
    json(route, { enabled: false, stopping: false }),
  );
  await page.route("**/core/engagement/meetings**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/notetaker")) return json(route, null);
    if (path.endsWith("/debriefs"))
      return json(route, [
        {
          id: prepId,
          body: "Saved Calendar debrief\nNext step: provide the requested evidence.",
          restricted: false,
          confidential: false,
          status: "approved",
          sharedAt: null,
          createdAt: "2026-10-11T00:00:00Z",
          updatedAt: "2026-10-11T00:00:00Z",
        },
      ]);
    if (path.endsWith(meetingId))
      return json(route, { ...meeting, preps: [currentPrep] });
    if (path.endsWith("/meetings"))
      return json(route, [{ ...meeting, preps: [currentPrep] }]);
    return route.fallback();
  });
  await page.route(
    `**/core/engagement/meeting-preps/${prepId}/pdf-attachment`,
    (route) => {
      pdfs++;
      return json(route, {
        id: attachmentId,
        fileName: "Saved meeting preparation.pdf",
      });
    },
  );
  await page.route("**/core/engagement/attachments?**", (route) => {
    // The open Calendar drawer separately reads meeting attachments for its
    // approval panel. Count only the composer’s client-scoped scan preflight.
    if (
      new URL(route.request().url()).searchParams.get("clientId") === clientId
    )
      clientAttachmentReads++;
    return json(route, [
      {
        ...file,
        id: attachmentId,
        fileName: "Saved meeting preparation.pdf",
        lifecycleStatus: "ready",
        scanStatus: "clean",
        usable: true,
        blockedReason: undefined,
      },
    ]);
  });
  const open = async (tab: "Preparation" | "Debriefs") => {
    await page.goto(
      `/calendar?view=agenda&date=2026-10-15&zone=UTC&meeting=${meetingId}`,
    );
    const drawer = page.getByRole("dialog", {
      name: meeting.subject,
      exact: true,
    });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: tab, exact: true }).click();
    return drawer;
  };
  return {
    unexpected,
    open,
    pdfs: () => pdfs,
    clientAttachmentReads: () => clientAttachmentReads,
    sends: () => sends,
    changePreparation: () => {
      currentPrep = {
        ...prep,
        summary: "Preparation changed after the saved PDF",
      };
    },
  };
}
test("Calendar preparation toolbar opens current saved PDF preview", async ({
  page,
}) => {
  const flow = await fixture(page);
  const drawer = await flow.open("Preparation");
  await drawer
    .getByRole("button", { name: "Print / Save as PDF", exact: true })
    .click();
  const preview = page.getByRole("dialog", {
    name: `Meeting prep — ${meeting.subject}`,
    exact: true,
  });
  await expect(preview.getByText(prep.summary)).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "Print / Save as PDF", exact: true }),
  ).toBeEnabled();
  expect(flow.pdfs()).toBe(0);
  expect(flow.sends()).toBe(0);
  expect(flow.unexpected).toEqual([]);
});
test("Calendar explicit PDF preparation opens existing composer with unverified seed then canonical availability", async ({
  page,
}) => {
  const flow = await fixture(page);
  const drawer = await flow.open("Preparation");
  await drawer.getByRole("button", { name: "Email PDF", exact: true }).click();
  const review = page.getByRole("dialog", {
    name: "Prepare meeting PDF attachment",
    exact: true,
  });
  await expect(review.getByText(prep.summary)).toBeVisible();
  await review
    .getByRole("button", { name: "Prepare attachment", exact: true })
    .click();
  const composer = page.getByRole("dialog", { name: "New email", exact: true });
  await expect(composer).toBeVisible();
  await expect(
    composer.getByText("Saved meeting preparation.pdf", { exact: true }),
  ).toBeVisible();
  expect(flow.pdfs()).toBe(1);
  expect(flow.clientAttachmentReads()).toBe(0);
  await composer
    .getByRole("button", { name: "Check scan status", exact: true })
    .click();
  await expect.poll(flow.clientAttachmentReads).toBe(1);
  await expect(
    composer.getByText("Ready to attach", { exact: true }),
  ).toBeVisible();
  await expect(
    composer.getByRole("button", { name: "Review email", exact: true }),
  ).toBeDisabled();
  expect(flow.sends()).toBe(0);
  expect(flow.unexpected).toEqual([]);
});
test("Calendar saved debrief Export PDF opens current persisted body", async ({
  page,
}) => {
  const flow = await fixture(page);
  const drawer = await flow.open("Debriefs");
  await drawer.getByRole("button", { name: "Export PDF", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Meeting debrief · PDF preview",
    exact: true,
  });
  await expect(
    preview.getByText(/Next step: provide the requested evidence/),
  ).toBeVisible();
  expect(flow.pdfs()).toBe(0);
  expect(flow.sends()).toBe(0);
  expect(flow.unexpected).toEqual([]);
});
test("Calendar reopens the already prepared PDF after composer cancellation without another POST", async ({
  page,
}) => {
  const flow = await fixture(page);
  const drawer = await flow.open("Preparation");
  await drawer.getByRole("button", { name: "Email PDF", exact: true }).click();
  const review = page.getByRole("dialog", {
    name: "Prepare meeting PDF attachment",
    exact: true,
  });
  await review
    .getByRole("button", { name: "Prepare attachment", exact: true })
    .click();
  const composer = page.getByRole("dialog", { name: "New email", exact: true });
  await expect(composer).toBeVisible();
  await composer
    .getByRole("button", { name: "Check scan status", exact: true })
    .click();
  await expect(
    composer.getByText("Ready to attach", { exact: true }),
  ).toBeVisible();
  await composer.getByRole("button", { name: "Close", exact: true }).click();
  flow.changePreparation();
  await drawer.getByRole("button", { name: "Email PDF", exact: true }).click();
  await expect(
    review.getByText(
      /original saved PDF; later preparation changes are not included/,
    ),
  ).toBeVisible();
  await expect(
    review.getByText("Preparation changed after the saved PDF", {
      exact: true,
    }),
  ).toBeVisible();
  await review
    .getByRole("button", {
      name: "Review previously prepared PDF",
      exact: true,
    })
    .click();
  await expect(composer).toBeVisible();
  await expect(
    composer.getByText("Saved meeting preparation.pdf", { exact: true }),
  ).toBeVisible();
  await composer
    .getByRole("button", { name: "Check scan status", exact: true })
    .click();
  await expect(
    composer.getByText("Ready to attach", { exact: true }),
  ).toBeVisible();
  expect(flow.pdfs()).toBe(1);
  expect(flow.clientAttachmentReads()).toBe(2);
  expect(flow.sends()).toBe(0);
  expect(flow.unexpected).toEqual([]);
});
