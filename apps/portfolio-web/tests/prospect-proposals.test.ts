import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  filterTemplates,
  librarySchema,
  templateSchema,
} from "../src/features/prospects/proposals/contracts";
import {
  readTemplate,
  readTemplateLibrary,
} from "../src/features/prospects/proposals/api";

const id = "79000000-0000-4000-8000-000000000001";
const template = {
  id,
  name: "Synthetic advocacy template",
  icon: null,
  description: "Synthetic plain-text description",
  product: "Synthetic advocacy",
  style: null,
  fontFamily: null,
  accentColor: null,
  meriPrimary: false,
  meriSecondary: false,
  elements: ["Cover"],
  sections: ["Scope", "Team"],
};
const client = (data: unknown, status = 200) =>
  createApiClient(async () => new Response(JSON.stringify(data), { status }));

describe("generic Workspace proposal template dependencies", () => {
  it("preserves the real nullable catalog fields without inventing ownership/version metadata", () => {
    expect(templateSchema.parse(template)).toEqual(template);
    expect(librarySchema.parse([])).toEqual([]);
    expect(
      templateSchema.safeParse({ ...template, sections: [1] }).success,
    ).toBe(false);
  });
  it("rejects duplicate identities instead of silently merging distinct catalog records", () => {
    expect(
      librarySchema.safeParse([
        template,
        { ...template, name: "Different record" },
      ]).success,
    ).toBe(false);
  });
  it("filters all returned templates by exact product and case-insensitive plain-text search", () => {
    const other = {
      ...template,
      id: "79000000-0000-4000-8000-000000000002",
      product: "Other product",
    };
    expect(
      filterTemplates([template, other], "  ADVOCACY  ", template.product),
    ).toEqual([template]);
    expect(filterTemplates([template, other], "plain-text", "")).toHaveLength(
      2,
    );
    expect(filterTemplates([template], "not present", "")).toEqual([]);
    expect(filterTemplates([template], "", "Other product")).toEqual([]);
  });
  it("requests the workspace origin and forwards cancellation without a prospect filter", async () => {
    let requested:
      | {
          url: string;
          method: string | undefined;
          signal: AbortSignal | null | undefined;
        }
      | undefined;
    const controller = new AbortController();
    const api = createApiClient(async (url, options) => {
      requested = {
        url: String(url),
        method: options?.method,
        signal: options?.signal,
      };
      return new Response(JSON.stringify([template]));
    });
    expect(await readTemplateLibrary(api, controller.signal)).toEqual([
      template,
    ]);
    expect(requested).toEqual({
      url: "/api/backend/workspace/templates/library",
      method: "GET",
      signal: controller.signal,
    });
  });
  it("rejects an unrelated detail receipt and encodes the requested identity", async () => {
    let url = "";
    const api = createApiClient(async (input) => {
      url = String(input);
      return new Response(JSON.stringify(template));
    });
    await expect(readTemplate(api, "different/id")).rejects.toMatchObject({
      status: 502,
    });
    expect(url).toBe("/api/backend/workspace/templates/different%2Fid");
    expect(await readTemplate(client(template), id)).toEqual(template);
  });
  it.each([401, 403, 404, 503])(
    "keeps service failure %i distinct from an empty catalog",
    async (status) => {
      await expect(
        readTemplateLibrary(
          client({ message: "Synthetic service rejection" }, status),
        ),
      ).rejects.toMatchObject({ status });
    },
  );
  it("never starts another request automatically after an ambiguous read failure", async () => {
    let calls = 0;
    const api = createApiClient(async () => {
      calls++;
      throw new TypeError("Synthetic connection lost");
    });
    await expect(readTemplateLibrary(api)).rejects.toThrow(
      "Synthetic connection lost",
    );
    expect(calls).toBe(1);
  });
});
