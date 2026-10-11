import { describe, expect, it } from "vitest";
import { clientSearchSchema } from "../src/features/opportunities/contracts";
import {
  opportunityLink,
  opportunityAmount,
  opportunityDate,
  pageWorkflowCounts,
  boundedPage,
} from "../src/features/opportunities/presentation";
import { opportunity, opportunitySearch, clientId } from "./browser/fixtures";
describe("client opportunity contracts", () => {
  it("rejects a different client's search or bookmark instead of presenting it", () => {
    const schema = clientSearchSchema(clientId, 1);
    expect(schema.safeParse(opportunitySearch).success).toBe(true);
    expect(
      schema.safeParse({ ...opportunitySearch, clientId: "another" }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...opportunitySearch,
        opportunities: [
          {
            ...opportunity,
            decoration: {
              ...opportunity.decoration,
              bookmark: {
                ...opportunity.decoration.bookmark,
                clientId: "another",
              },
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      clientSearchSchema(clientId, 2).safeParse(opportunitySearch).success,
    ).toBe(false);
  });
  it("does not infer currency, missing workflow totals or timezone shifts for civil dates", () => {
    expect(opportunityAmount({ value: 123, valueBasis: "source_backed" })).toBe(
      "Source amount 123",
    );
    expect(
      opportunityAmount({ value: 123, valueBasis: "not_stated_by_source" }),
    ).toBe("Value not stated");
    expect(opportunityDate("2026-10-24")).toContain("24");
    expect(opportunityDate("2026-10-24")).not.toContain("23");
    expect(
      pageWorkflowCounts([{ ...opportunity, decoration: undefined }]),
    ).toEqual({ pursuing: null, saved: null });
    expect(boundedPage("-2")).toBe(1);
    expect(boundedPage("1.5")).toBe(1);
  });
  it("encodes opaque source IDs and preserves client scope in existing Module links", () => {
    const result = opportunityLink("http://127.0.0.1", clientId, {
      source: "sam_gov",
      sourceRecordId: "abc/def?x=1",
    });
    expect(result).toContain("/sam_gov/abc%2Fdef%3Fx%3D1?");
    expect(new URL(result).searchParams.get("clientId")).toBe(clientId);
    expect(new URL(result).searchParams.get("mode")).toBe("matched");
  });
});
