import { describe, expect, it } from "vitest";
import { clientSchema } from "../src/features/portfolio/contracts";
import {
  clearPortfolioFilters,
  filterClients,
  portfolioHref,
  readPortfolioState,
  sortClients,
} from "../src/features/portfolio/filter";
const clients = [
  clientSchema.parse({
    id: "11111111-1111-4111-8111-111111111111",
    name: "Zephyr",
    status: "active",
    profileStatus: "ACTIVE",
    sectorTag: "Energy",
    primaryContactName: "Ada Test",
    intakeData: { city: "Seattle", state: "WA" },
  }),
  clientSchema.parse({
    id: "22222222-2222-4222-8222-222222222222",
    name: "Alpha",
    status: "active",
    profileStatus: "ONBOARDING",
    sectorTag: "Aerospace",
    intakeData: { city: "New York", state: "NY" },
  }),
];
const owners = {
  [clients[0]!.id]: {
    accountOwnerUserId: "owner-1",
    accountOwner: {
      id: "owner-1",
      firstName: "Sam",
      lastName: "Owner",
      email: "sam@example.test",
    },
  },
  [clients[1]!.id]: { accountOwnerUserId: null, accountOwner: null },
};
const empty = { search: "", status: "", sector: "", owner: "" };
describe("Portfolio index contract-backed controls", () => {
  it("combines actual profile fields and primary owner, without matching missing-field placeholders", () => {
    expect(
      filterClients(
        clients,
        {
          ...empty,
          search: " Sam owner ",
          sector: "Energy",
          status: "ACTIVE",
          owner: "owner-1",
        },
        owners,
      ),
    ).toEqual([clients[0]]);
    expect(
      filterClients(clients, { ...empty, search: "ada test" }, owners),
    ).toEqual([clients[0]]);
    expect(
      filterClients(clients, { ...empty, search: "Unassigned" }, owners),
    ).toEqual([]);
    expect(
      filterClients(clients, { ...empty, search: "Seattle, WA" }, owners),
    ).toEqual([clients[0]]);
    expect(
      filterClients(clients, { ...empty, search: "new york ny" }, owners),
    ).toEqual([clients[1]]);
  });
  it("distinguishes known unassigned from missing owner receipts", () => {
    expect(
      filterClients(clients, { ...empty, owner: "unassigned" }, owners),
    ).toEqual([clients[1]]);
    expect(
      filterClients(clients, { ...empty, owner: "unassigned" }, {}),
    ).toEqual([]);
  });
  it("preserves server recent order and sorts by name without mutating cached data", () => {
    expect(sortClients(clients, "recent")).toEqual(clients);
    expect(sortClients(clients, "name").map((c) => c.name)).toEqual([
      "Alpha",
      "Zephyr",
    ]);
    expect(clients.map((c) => c.name)).toEqual(["Zephyr", "Alpha"]);
  });
  it("restores current and audit layout deep links and exposes unsupported sorts", () => {
    expect(
      readPortfolioState(
        new URLSearchParams("layout=list&q=Sam&owner=owner-1&sort=name"),
      ),
    ).toMatchObject({
      view: "list",
      search: "Sam",
      owner: "owner-1",
      sort: "name",
      unsupportedSort: "",
    });
    expect(
      readPortfolioState(
        new URLSearchParams("layout=list&view=cards&sort=readiness"),
      ),
    ).toMatchObject({
      view: "cards",
      sort: "recent",
      unsupportedSort: "readiness",
    });
  });
  it("updates one URL control, preserving unrelated scope, and replaces legacy layout", () => {
    const next = portfolioHref(
      "/portfolio",
      new URLSearchParams("q=A%26B&layout=list&log=1"),
      "view",
      "cards",
    );
    expect(next).toBe("/portfolio?q=A%26B&log=1&view=cards");
    expect(
      portfolioHref("/portfolio", new URLSearchParams("q=one"), "q", ""),
    ).toBe("/portfolio");
  });
  it("clears all result filters while retaining layout, sort and unrelated actions", () => {
    expect(
      clearPortfolioFilters(
        "/portfolio",
        new URLSearchParams(
          "q=a&status=ACTIVE&sector=Energy&owner=one&type=CLIENT&search=1&view=list&sort=name&log=1",
        ),
      ),
    ).toBe("/portfolio?view=list&sort=name&log=1");
  });
});
