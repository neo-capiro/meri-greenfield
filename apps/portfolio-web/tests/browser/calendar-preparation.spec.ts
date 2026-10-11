import { test, expect } from "@playwright/test";
import { installFixtures, json, clientId, client } from "./fixtures";

test("Master calendar accepts saved structured prep and renders its text without object coercion", async ({
  page,
}) => {
  const unexpected = await installFixtures(page);
  const meeting = {
    id: "90000000-0000-4000-8000-000000000001",
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
    preps: [
      {
        id: "prep-synthetic",
        status: "approved",
        summary: "Synthetic saved preparation",
        agenda: [{ title: "Agenda title", description: "Agenda description" }],
        talkingPoints: [
          {
            text: "Evidence-linked talking point",
            evidenceReferences: ["synthetic-source"],
          },
        ],
        risks: [{ text: "Comprehensive risk", factIds: ["synthetic-fact"] }],
        followUps: [
          {
            title: "Follow-up title",
            description: "Follow-up description",
            dueDate: "2026-10-20",
          },
          "Edited follow-up",
        ],
        createdAt: "2026-10-10T12:00:00Z",
      },
    ],
  };
  await page.route("**/core/engagement/meetings**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET" && path.endsWith("/notetaker"))
      return json(route, null);
    return json(route, path.endsWith(meeting.id) ? meeting : [meeting]);
  });
  await page.goto(
    `/calendar?view=agenda&date=2026-10-15&zone=UTC&meeting=${meeting.id}`,
  );
  const drawer = page.getByRole("dialog", { name: meeting.subject });
  await expect(drawer).toBeVisible();
  await drawer
    .getByRole("button", { name: "Preparation", exact: true })
    .click();
  for (const text of [
    "Agenda title",
    "Agenda description",
    "Evidence-linked talking point",
    "Comprehensive risk",
    "Follow-up description",
    "Due 2026-10-20",
    "Edited follow-up",
  ])
    await expect(drawer.getByText(text, { exact: true })).toBeVisible();
  await expect(drawer).not.toContainText("[object Object]");
  await page.screenshot({
    path: "test-results/calendar-structured-preparation.png",
    fullPage: true,
  });
  expect(unexpected).toEqual([]);
});
