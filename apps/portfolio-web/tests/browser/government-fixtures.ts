import type { Page } from "@playwright/test";
import { clientId, installFixtures, json } from "./fixtures";
export const statePersonId = "ocd-person/80000000-0000-4000-8000-000000000001";
export const governmentTarget = {
  id: "90000000-0000-4000-8000-000000000001",
  clientId,
  memberId: "staff-12",
  sourceDirectory: "staff" as const,
  memberName: "Test Committee Staff",
  party: null,
  state: null,
  chamber: null,
  committee: "Test Subcommittee",
  staffKind: "committee" as const,
  tier: 1,
  source: "manual",
  addedAt: "2026-10-10T12:00:00Z",
  representedFacilities: null,
};
export const stateTarget = {
  ...governmentTarget,
  id: "90000000-0000-4000-8000-000000000002",
  memberId: statePersonId,
  memberName: "Test State Legislator",
  sourceDirectory: "state" as const,
  staffKind: null,
  state: "VA-12",
  chamber: "lower",
  tier: 2,
  representedFacilities: [],
};
export const committee = {
  id: "committee-1",
  officeId: 1,
  parentOfficeId: null,
  name: "Test Committee",
  chamber: "House",
  kind: "committee",
  staffCount: 0,
};
export const subcommittee = {
  ...committee,
  id: "committee-2",
  officeId: 2,
  parentOfficeId: 1,
  name: "Test Subcommittee",
  kind: "subcommittee",
  staffCount: 1,
};
export const staffDetail = {
  kind: "staff",
  id: "staff-12",
  emails: [{ value: "committee@example.test", type: "work" }],
  positions: [
    {
      title: "Staff director",
      officeName: "Test Subcommittee",
      isCurrent: true,
      startDate: "2026-01-01",
      endDate: null,
    },
  ],
};
export async function installGovernmentFixtures(page: Page) {
  const unexpected = await installFixtures(page);
  await page.route(`**/clients/${clientId}/targets`, (route) =>
    json(route, [governmentTarget, stateTarget]),
  );
  await page.route(`**/clients/${clientId}/target-recommendations`, (route) =>
    json(route, { recommendations: [], computedAt: null }),
  );
  await page.route("**/directory/staffers/staff-12", (route) =>
    json(route, staffDetail),
  );
  await page.route("**/explorer/state-legislators/ocd-person%2F*", (route) =>
    json(route, {
      id: statePersonId,
      name: stateTarget.memberName,
      email: "state@example.test",
    }),
  );
  return unexpected;
}
