import { describe, expect, it } from "vitest";
import { filterClients } from "../src/features/portfolio/filter";
import {
  clientSchema,
  createProfileSchema,
  safeWebsite,
} from "../src/features/portfolio/contracts";
const one = clientSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Synthetic Engineering",
  status: "active",
  profileStatus: "ACTIVE",
  sectorTag: "Technology",
});
const two = clientSchema.parse({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Synthetic Association",
  status: "active",
  profileStatus: "ONBOARDING",
  sectorTag: "Civic",
});
describe("Portfolio filtering and profile validation", () => {
  it("combines name/status/sector and actual account-owner assignments", () => {
    expect(
      filterClients(
        [one, two],
        {
          search: " engineering ",
          status: "ACTIVE",
          sector: "Technology",
          owner: "owner-1",
        },
        { [one.id]: { accountOwnerUserId: "owner-1" } },
      ),
    ).toEqual([one]);
    expect(
      filterClients(
        [one, two],
        { search: "", status: "ACTIVE", sector: "", owner: "owner-2" },
        { [one.id]: { accountOwnerUserId: "owner-1" } },
      ),
    ).toEqual([]);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,evil",
    "https://user:pass@example.test",
  ])("does not create a link for unsafe website %s", (url) =>
    expect(safeWebsite(url)).toBeUndefined(),
  );
  it("accepts ordinary scheme-free organization websites", () =>
    expect(safeWebsite("example.test")).toBe("https://example.test/"));
  it("requires an organization name and rejects malformed contact email", () => {
    const fields = {
      name: " ",
      website: "",
      description: "",
      sectorTag: "",
      primaryContactName: "",
      primaryContactEmail: "wrong",
      primaryContactPhone: "",
      profileType: "CLIENT",
    };
    expect(createProfileSchema.safeParse(fields).success).toBe(false);
    expect(
      createProfileSchema.parse({
        ...fields,
        name: " Test ",
        primaryContactEmail: "",
      }).name,
    ).toBe("Test");
  });
});
