import { test, expect, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";
function documentCapture(testInfo: TestInfo, name: string) {
  const directory = process.env.PORTFOLIO_DOCUMENT_SCREENSHOTS;
  return directory ? path.join(directory, name) : testInfo.outputPath(name);
}
const id = "20000000-0000-4000-8000-000000000001";
const prep = {
  id,
  meetingId: "meeting-1",
  clientId: "client-1",
  summary: "Validate the FY27 request and confirm the evidence staff need.",
  agenda: ["Operational gap", "District production", "Staff questions"],
  talkingPoints: [
    "Deployment readiness, testing evidence and district impact.",
  ],
  risks: [],
  followUps: [],
  emailEvidence: [],
  status: "draft",
  createdAt: "2026-10-11T00:00:00Z",
};
const meeting = {
  id: "meeting-1",
  subject: "FY27 staff briefing",
  client: { id: "client-1", name: "Synthetic client" },
  description: null,
  location: null,
  startsAt: "2026-10-12T16:00:00Z",
  endsAt: "2026-10-12T17:00:00Z",
  status: "scheduled",
  joinLink: null,
  visibility: "private",
  isVirtual: false,
  meri: null,
  attendees: [],
  preps: [prep],
};
async function setup(
  page: Page,
  options: {
    rich?: boolean;
    restricted?: boolean;
    governed?: boolean;
    postStatus?: number;
    runtime?: boolean;
    holdRead?: boolean;
    badReceipt?: boolean;
    wrongClient?: boolean;
    readError?: boolean;
    holdNewActorRead?: boolean;
    holdPost?: boolean;
  } = {},
) {
  let posts = 0;
  let reads = 0;
  let actor = "actor-a";
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/backend/core/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/api/backend/core/",
    )[1];
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (path === "me")
      return json({
        user: { id: actor, email: "synthetic@example.test" },
        tenant: { id: "tenant-a", name: "Synthetic" },
        role: "standard_user",
      });
    if (path === "engagement/capabilities")
      return json({
        runtime: { externalActionsEnabled: options.runtime !== false },
      });
    if (path === "engagement/meetings/meeting-1") {
      reads++;
      if (options.holdRead && reads > 1) await gate;
      if (options.holdNewActorRead && actor === "actor-b") await gate;
      if (options.readError)
        return json({ message: "Saved document access refused" }, 403);
      const current = options.rich
        ? {
            ...prep,
            summary: "東京 — résumé 🚀\nSecond line <img onerror=evil()>",
            agenda: [{ text: "Evidence-linked agenda", factIds: ["fact-1"] }],
            emailEvidence: [
              {
                summary: "Email evidence retained",
                sourceId: "source-1",
                sourceUrl: "https://example.test/source",
              },
            ],
          }
        : actor === "actor-b"
          ? { ...prep, summary: "Actor B current saved preparation" }
          : prep;
      return json({
        ...meeting,
        ...(options.wrongClient
          ? { client: { id: "other-client", name: "Other" } }
          : {}),
        preps: [
          {
            ...current,
            ...(options.governed
              ? {
                  generatedFrom: {
                    schemaVersion: "research_portfolio_institutional_v1",
                  },
                }
              : {}),
          },
        ],
      });
    }
    if (path === "engagement/meetings/meeting-1/debriefs")
      return json([
        {
          id,
          body: "Discussed the funding path.\nAction: share the technical brief.\n東京 — résumé 🚀",
          restricted: options.restricted ?? false,
          confidential: false,
          createdAt: "2026-10-11T00:00:00Z",
          updatedAt: "2026-10-11T00:00:00Z",
        },
      ]);
    if (path?.endsWith("/pdf-attachment")) {
      posts++;
      if (options.holdPost) await gate;
      return json(
        options.badReceipt
          ? {}
          : { id, fileName: "Prep - FY27 staff briefing.pdf" },
        options.postStatus ?? 200,
      );
    }
    return json({ message: `Unexpected synthetic route ${path}` }, 404);
  });
  await page.goto("/__test/meeting-documents");
  return {
    posts: () => posts,
    reads: () => reads,
    release: () => release?.(),
    changeActor: () => {
      actor = "actor-b";
    },
  };
}
test("preparation preview prints persisted rich Unicode content and safe source links", async ({
  page,
}, testInfo) => {
  await setup(page, { rich: true });
  await page.getByRole("button", { name: "Preview preparation" }).click();
  await expect(page.getByText("Evidence-linked agenda")).toBeVisible();
  await expect(page.getByText("Email evidence retained")).toBeVisible();
  await page.screenshot({
    path: documentCapture(testInfo, "preparation-desktop-light.png"),
  });
  await page.evaluate(() => {
    const original = window.open.bind(window);
    window.open = (...args) => {
      const popup = original(...args);
      if (popup)
        popup.print = () => {
          popup.name = "print-requested";
        };
      return popup;
    };
  });
  const popupEvent = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Print / Save as PDF" }).click();
  const popup = await popupEvent;
  await expect(popup.locator("body")).toContainText("東京 — résumé 🚀");
  await expect(popup.locator("body")).toContainText(
    "Second line <img onerror=evil()>",
  );
  await expect(popup.locator("body")).toContainText("Evidence-linked agenda");
  await expect(popup.locator("a")).toHaveAttribute(
    "href",
    "https://example.test/source",
  );
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  expect(await popup.evaluate(() => window.name)).toBe("print-requested");
  expect(await popup.locator("script,img,iframe").count()).toBe(0);
});
test("popup refusal keeps preview and saved content available", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Preview preparation" }).click();
  await expect(page.getByText(prep.summary)).toBeVisible();
  await page.evaluate(() => {
    window.open = () => null;
  });
  await page.getByRole("button", { name: "Print / Save as PDF" }).click();
  await expect(page.getByText(/Allow pop-ups/)).toBeVisible();
  await expect(page.getByText(prep.summary)).toBeVisible();
});
test("debrief preview preserves saved body and light reference geometry", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.getByRole("button", { name: "Preview debrief" }).click();
  await expect(
    page.getByText(/Action: share the technical brief/),
  ).toBeVisible();
  const width = await page
    .getByRole("dialog")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(width).toBe(660);
  await page.screenshot({
    path: documentCapture(testInfo, "debrief-desktop-light.png"),
  });
});
test("mobile dark preparation fits viewport and loads Geist", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { rich: true });
  await page.getByRole("button", { name: "Preview preparation" }).click();
  await expect(page.getByText("Evidence-linked agenda")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(27, 27, 27)");
  expect(
    await page.evaluate(
      async () => (await document.fonts.load('14px "Geist Test"')).length,
    ),
  ).toBeGreaterThan(0);
  await page.screenshot({
    path: documentCapture(testInfo, "preparation-mobile-dark.png"),
  });
});
test("restricted debrief never renders or prints private content", async ({
  page,
}) => {
  await setup(page, { restricted: true });
  await page.getByRole("button", { name: "Preview debrief" }).click();
  await expect(page.getByText(/cannot be exported here/)).toBeVisible();
  await expect(page.getByText(/Action: share/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Print / Save as PDF" }),
  ).toBeDisabled();
});
test("governed preparation refuses ordinary export", async ({ page }) => {
  await setup(page, { governed: true });
  await page.getByRole("button", { name: "Preview preparation" }).click();
  await expect(page.getByText(/originating governed/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Print / Save as PDF" }),
  ).toBeDisabled();
});
test("server-incompatible rich preparation offers truthful fidelity refusal and zero writes", async ({
  page,
}) => {
  const flow = await setup(page, { rich: true });
  await page.getByRole("button", { name: "Email PDF" }).click();
  await expect(
    page.getByText(/omits structured preparation items/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare attachment", exact: true }),
  ).toBeDisabled();
  expect(flow.posts()).toBe(0);
});
test("explicit prepare stores one verified receipt without sending", async ({
  page,
}) => {
  const flow = await setup(page, { holdRead: true });
  await page.getByRole("button", { name: "Email PDF" }).click();
  await page
    .getByRole("button", { name: "Prepare attachment", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Preparing…" })).toBeDisabled();
  flow.release();
  await expect(
    page.getByText("Stored receipt Prep - FY27 staff briefing.pdf"),
  ).toBeVisible();
  expect(flow.posts()).toBe(1);
  await expect(
    page.getByRole("button", { name: "Prepare attachment", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Review previously prepared PDF",
      exact: true,
    })
    .click();
  expect(flow.posts()).toBe(1);
});
test("unknown completion freezes original attempt without retry", async ({
  page,
}) => {
  const flow = await setup(page, { postStatus: 500 });
  await page.getByRole("button", { name: "Email PDF" }).click();
  await page
    .getByRole("button", { name: "Prepare attachment", exact: true })
    .click();
  await expect(page.getByText(/may have completed/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare attachment", exact: true }),
  ).toBeDisabled();
  expect(flow.posts()).toBe(1);
});
test("invalidated identity/capability cached success refuses POST", async ({
  page,
}) => {
  const flow = await setup(page);
  await page.getByRole("button", { name: "Email PDF" }).click();
  await expect(
    page.getByRole("button", { name: "Prepare attachment", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => window.__documentInvalidate?.("capabilities"));
  await page
    .getByRole("button", { name: "Prepare attachment", exact: true })
    .click();
  await expect(page.getByText(/session or permissions changed/)).toBeVisible();
  expect(flow.posts()).toBe(0);
});
test("unmount during preflight refuses delayed storage dispatch", async ({
  page,
}) => {
  const flow = await setup(page, { holdRead: true });
  await page.getByRole("button", { name: "Email PDF" }).click();
  await page
    .getByRole("button", { name: "Prepare attachment", exact: true })
    .click();
  await expect.poll(flow.reads).toBe(2);
  await page.evaluate(() => window.__documentUnmount?.());
  flow.release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(flow.posts()).toBe(0);
});
test("print serializer strips executable attributes/resources and preserves Unicode", async ({
  page,
}) => {
  await setup(page);
  const html = await page.evaluate(() => window.__documentSanitize?.());
  expect(html).toContain("東京 &amp; résumé 🚀<br");
  expect(html).not.toContain("onclick");
  expect(html).not.toContain("javascript:");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<svg");
  expect(html).toContain("Title &lt;script&gt; &amp; &quot;quote&quot;");
});

test("runtime-disabled environment refuses attachment creation", async ({
  page,
}) => {
  const flow = await setup(page, { runtime: false });
  await page.getByRole("button", { name: "Email PDF" }).click();
  await expect(page.getByText(prep.summary)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare attachment", exact: true }),
  ).toBeDisabled();
  expect(flow.posts()).toBe(0);
});
test("invalidated identity success refuses local print and attachment dispatch", async ({
  page,
}) => {
  const flow = await setup(page);
  await page.getByRole("button", { name: "Email PDF" }).click();
  await expect(
    page.getByRole("button", { name: "Prepare attachment", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => window.__documentInvalidate?.("identity"));
  await page
    .getByRole("button", { name: "Prepare attachment", exact: true })
    .click();
  await expect(page.getByText(/session or permissions changed/)).toBeVisible();
  expect(flow.posts()).toBe(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() => window.__documentRefetchIdentity?.());
  await page.getByRole("button", { name: "Preview preparation" }).click();
  await expect(page.getByText(prep.summary)).toBeVisible();
  await page.evaluate(() => window.__documentInvalidate?.("identity"));
  const print = page.getByRole("button", { name: "Print / Save as PDF" });
  if (await print.isEnabled()) await print.click();
  else await expect(print).toBeDisabled();
  await expect(page.getByText(/session or permissions changed/)).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
});
test("changed initiating actor during preflight refuses POST and hides old content", async ({
  page,
}) => {
  const flow = await setup(page, { holdRead: true });
  await page.getByRole("button", { name: "Email PDF" }).click();
  await page
    .getByRole("button", { name: "Prepare attachment", exact: true })
    .click();
  await expect.poll(flow.reads).toBe(2);
  flow.changeActor();
  await page.evaluate(() => window.__documentRefetchIdentity?.());
  flow.release();
  await expect(page.getByText(/session or permissions changed/)).toBeVisible();
  await expect(page.getByText(prep.summary)).toHaveCount(0);
  expect(flow.posts()).toBe(0);
});
test("wrong client response refuses content and export", async ({ page }) => {
  const flow = await setup(page, { wrongClient: true });
  await page.getByRole("button", { name: "Preview preparation" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText(prep.summary)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Print / Save as PDF" }),
  ).toBeDisabled();
  expect(flow.posts()).toBe(0);
});
test("canonical saved access refusal retains explicit retry without exporting stale content", async ({
  page,
}) => {
  const flow = await setup(page, { readError: true });
  await page.getByRole("button", { name: "Preview preparation" }).click();
  await expect(
    page.getByText("You do not have permission for this operation."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(prep.summary)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Print / Save as PDF" }),
  ).toBeDisabled();
  expect(flow.posts()).toBe(0);
});
test("keyboard closes preview and mobile close stays in its heading row", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.getByRole("button", { name: "Preview preparation" }).click();
  await expect(page.getByText(prep.summary)).toBeVisible();
  const geometry = await page.getByRole("dialog").evaluate((element) => {
    const heading = element.querySelector("h2")!.getBoundingClientRect();
    const close = element
      .querySelector("header button")!
      .getBoundingClientRect();
    return {
      headingTop: heading.top,
      closeTop: close.top,
      closeRight: close.right,
      dialogRight: element.getBoundingClientRect().right,
    };
  });
  expect(Math.abs(geometry.headingTop - geometry.closeTop)).toBeLessThan(12);
  expect(geometry.closeRight).toBeLessThan(geometry.dialogRight);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("actor-scoped saved cache never reveals previous actor content while new read waits", async ({
  page,
}) => {
  const flow = await setup(page, { holdNewActorRead: true });
  await page.getByRole("button", { name: "Preview preparation" }).click();
  await expect(page.getByText(prep.summary)).toBeVisible();
  flow.changeActor();
  await page.evaluate(() => window.__documentRefetchIdentity?.());
  await page.evaluate(() => window.__documentRemount?.());
  await expect.poll(flow.reads).toBe(2);
  await expect(page.getByText(prep.summary)).toHaveCount(0);
  await expect(page.getByText("Actor B current saved preparation")).toHaveCount(
    0,
  );
  flow.release();
  await expect(
    page.getByText("Actor B current saved preparation"),
  ).toBeVisible();
  expect(flow.posts()).toBe(0);
});
test("controlled close/reopen preserves unknown PDF attempt without a second POST", async ({
  page,
}) => {
  const flow = await setup(page, { postStatus: 500 });
  await page.getByRole("button", { name: "Email PDF" }).click();
  await page
    .getByRole("button", { name: "Prepare attachment", exact: true })
    .click();
  await expect(page.getByText(/may have completed/)).toBeVisible();
  await page.getByRole("button", { name: "Close and check Files" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Email PDF" }).click();
  await expect(page.getByText(/may have completed/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare attachment", exact: true }),
  ).toBeDisabled();
  expect(flow.posts()).toBe(1);
});
test("controlled close during preflight revokes delayed POST even after reopen", async ({
  page,
}) => {
  const flow = await setup(page, { holdRead: true });
  await page.getByRole("button", { name: "Email PDF" }).click();
  await page
    .getByRole("button", { name: "Prepare attachment", exact: true })
    .click();
  await expect.poll(flow.reads).toBe(2);
  await page.evaluate(() => window.__documentClose?.());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => window.__documentReopen?.());
  flow.release();
  await expect(page.getByText(/no longer open/)).toBeVisible();
  expect(flow.posts()).toBe(0);
});
test("controlled close after dispatch withholds receipt and preserves uncertainty on reopen", async ({
  page,
}) => {
  const flow = await setup(page, { holdPost: true });
  await page.getByRole("button", { name: "Email PDF" }).click();
  await page
    .getByRole("button", { name: "Prepare attachment", exact: true })
    .click();
  await expect.poll(flow.posts).toBe(1);
  await page.evaluate(() => window.__documentClose?.());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  flow.release();
  await page.evaluate(() => window.__documentReopen?.());
  await expect(page.getByText(/may have completed/)).toBeVisible();
  await expect(page.getByText(/Stored receipt/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Prepare attachment", exact: true }),
  ).toBeDisabled();
  expect(flow.posts()).toBe(1);
});
