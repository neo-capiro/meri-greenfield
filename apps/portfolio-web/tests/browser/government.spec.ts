import { expect, test } from "@playwright/test";
import { clientId, json } from "./fixtures";
import {
  committee,
  subcommittee,
  governmentTarget,
  statePersonId,
  stateTarget,
  installGovernmentFixtures,
} from "./government-fixtures";
const path = `/portfolio/${clientId}/relationships?kind=government`;

test("directory feeds fail independently, paginate, and retain a failed add for explicit retry", async ({
  page,
}) => {
  const unexpected = await installGovernmentFixtures(page);
  const saved: unknown[] = [];
  let attempts = 0;
  let release: (() => void) | undefined;
  await page.route(`**/clients/${clientId}/targets`, async (route) => {
    if (route.request().method() === "GET") return json(route, saved);
    attempts++;
    expect(route.request().postDataJSON()).toEqual({
      memberId: "member-22",
      sourceDirectory: "congress",
      source: "manual",
    });
    if (attempts === 1)
      return json(route, { message: "Add temporarily unavailable" }, 503);
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    const row = {
      ...governmentTarget,
      memberId: "member-22",
      memberName: "Test Member Two",
      sourceDirectory: "congress",
      staffKind: null,
      tier: null,
    };
    saved.push(row);
    return json(route, row);
  });
  await page.route("**/directory/contacts?**", (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("q")).toBe("Test");
    const current = Number(url.searchParams.get("page"));
    return json(route, {
      contacts: [
        {
          id: current === 1 ? "member-21" : "member-22",
          fullName: current === 1 ? "Test Member One" : "Test Member Two",
          title: "Representative",
          chamber: "House",
          state: "VA",
          party: "I",
        },
      ],
      total: 21,
      page: current,
      pageSize: 20,
    });
  });
  await page.route("**/directory/people?**", (route) =>
    json(route, { message: "Staff directory unavailable" }, 503),
  );
  await page.route("**/explorer/state-legislators?**", (route) =>
    json(route, {
      rows: [
        {
          id: statePersonId,
          name: stateTarget.memberName,
          state: "VA",
          chamber: "lower",
          party: null,
          district: "12",
        },
      ],
      total: 1,
    }),
  );
  await page.goto(path);
  await page
    .getByRole("button", { name: "Add relationship", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Add relationship" });
  await dialog.getByLabel("Search the directory").fill("Test");
  await dialog.getByRole("button", { name: "Search", exact: true }).click();
  await expect(dialog.getByText("Staff directory unavailable")).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: `Add ${stateTarget.memberName}`,
      exact: true,
    }),
  ).toBeVisible();
  const members = dialog.getByRole("region", { name: "Members", exact: true });
  await members.getByRole("button", { name: "Next", exact: true }).click();
  const add = members.getByRole("button", {
    name: "Add Test Member Two",
    exact: true,
  });
  await add.click();
  await expect(members.getByText("Add temporarily unavailable")).toBeVisible();
  expect(attempts).toBe(1);
  await add.click();
  await expect(
    dialog.getByRole("button", { name: "Done", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => Boolean(release)).toBe(true);
  release?.();
  await expect(members.getByText("Added", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Congressional and state targets" })
      .getByRole("button", { name: "Test Member Two" }),
  ).toBeVisible();
  expect(attempts).toBe(2);
  expect(unexpected).toEqual([]);
});

test("committee selection fetches every taxonomy page and preserves current/former staff", async ({
  page,
}) => {
  const unexpected = await installGovernmentFixtures(page);
  const pages: number[] = [];
  await page.route("**/directory/committees?**", (route) => {
    const current = Number(
      new URL(route.request().url()).searchParams.get("page"),
    );
    pages.push(current);
    return json(route, {
      committees:
        current === 1
          ? [
              committee,
              ...Array.from({ length: 199 }, (_, index) => ({
                ...committee,
                id: `committee-extra-${index}`,
                officeId: 100 + index,
                name: `Other committee ${index}`,
              })),
            ]
          : [subcommittee],
      total: 201,
      page: current,
      pageSize: 200,
    });
  });
  await page.route("**/directory/committees/committee-2/staff?**", (route) =>
    json(route, {
      committee: subcommittee,
      staff: [
        {
          id: "staff-13",
          fullName: "Former Test Staff",
          title: "Counsel",
          isCurrent: false,
          committee: { id: subcommittee.id, name: subcommittee.name },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  );
  await page.goto(path);
  await page.getByRole("button", { name: "Add committee staff" }).click();
  const dialog = page.getByRole("dialog", { name: "Add relationship" });
  const select = dialog.getByLabel("Committee / subcommittee");
  await expect(
    select.getByRole("option", {
      name: "House / Test Committee / Test Subcommittee",
      exact: true,
    }),
  ).toBeAttached();
  await select.selectOption(subcommittee.id);
  await expect(
    dialog.getByRole("button", { name: "Add Former Test Staff", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Former position", { exact: true }),
  ).toBeVisible();
  expect(pages).toEqual([1, 2]);
  expect(unexpected).toEqual([]);
});

test("state target details preserve encoded identity; tier clearing, reviewed mail and failed removal retain state", async ({
  page,
}) => {
  const unexpected = await installGovernmentFixtures(page);
  let target: Omit<typeof stateTarget, "tier"> & { tier: number | null } =
    stateTarget;
  let mails = 0;
  let removals = 0;
  await page.route(`**/clients/${clientId}/targets**`, (route) => {
    const method = route.request().method();
    if (method === "PATCH") {
      expect(route.request().postDataJSON()).toEqual({
        memberId: statePersonId,
        tier: null,
      });
      target = { ...target, tier: null };
      return json(route, target);
    }
    if (method === "DELETE") {
      removals++;
      expect(new URL(route.request().url()).searchParams.get("memberId")).toBe(
        statePersonId,
      );
      return json(route, { message: "Removal unavailable" }, 503);
    }
    return json(route, [governmentTarget, target]);
  });
  await page.route("**/engagement/mail/send", (route) => {
    mails++;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      clientId,
      to: [{ email: "state@example.test", name: stateTarget.memberName }],
    });
    expect(body).not.toHaveProperty("personIds");
    return json(route, { message: "Test provider unavailable" }, 503);
  });
  await page.goto(`${path}&target=${encodeURIComponent(statePersonId)}`);
  const drawer = page.getByRole("dialog", {
    name: stateTarget.memberName,
    exact: true,
  });
  await expect(
    drawer.getByRole("link", { name: "Open directory profile" }),
  ).toHaveAttribute(
    "href",
    `http://127.0.0.1:5191/existing/directory/state-legislators/${encodeURIComponent(statePersonId)}`,
  );
  await drawer.getByLabel("Tier", { exact: true }).selectOption("");
  await expect.poll(() => target.tier).toBe(null);
  await drawer.getByRole("button", { name: "Mail", exact: true }).click();
  const compose = page.getByRole("dialog", { name: "New email", exact: true });
  await compose.getByLabel("Subject", { exact: true }).fill("Test subject");
  await compose
    .getByLabel("Message", { exact: true })
    .fill("Test directory message");
  await compose.getByRole("button", { name: "Review email" }).click();
  expect(mails).toBe(0);
  const review = page.getByRole("dialog", { name: "Send email", exact: true });
  await review.getByRole("button", { name: "Send email", exact: true }).click();
  await expect(review.getByText("Test provider unavailable")).toBeVisible();
  expect(mails).toBe(1);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await drawer
    .getByRole("button", { name: "Remove target", exact: true })
    .click();
  const remove = page.getByRole("dialog", {
    name: "Remove target",
    exact: true,
  });
  await remove.getByRole("button", { name: "Confirm removal" }).click();
  await expect(remove.getByText("Removal unavailable")).toBeVisible();
  expect(removals).toBe(1);
  expect(unexpected).toEqual([]);
});
