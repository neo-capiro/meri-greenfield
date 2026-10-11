import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  debriefBody,
  generateDebrief,
} from "../src/features/calendar/debrief/api";

describe("reviewed meeting source generation", () => {
  const draft = {
    recap: "Discussed the submitted source.",
    actionItems: ["Review the recorded question."],
    notes: "Retain this qualification.",
    provider: "anthropic",
    model: "service-model",
    raw: { private: "not retained" },
  };
  it("dispatches only the canonical generation request and strips provider internals", async () => {
    const requests: { path: string; options: RequestInit | undefined }[] = [];
    const api = createApiClient(async (path, options) => {
      requests.push({ path: String(path), options });
      return Response.json(draft);
    });
    const result = await generateDebrief(
      api,
      "meeting/one",
      " Reviewed source\n",
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.path).toBe(
      "/api/backend/core/engagement/meetings/meeting%2Fone/debrief-draft",
    );
    expect(requests[0]?.options?.method).toBe("POST");
    expect(JSON.parse(String(requests[0]?.options?.body))).toEqual({
      method: "upload",
      sourceText: " Reviewed source\n",
    });
    expect(result).not.toHaveProperty("raw");
    expect(debriefBody(result)).toBe(
      "Discussed the submitted source.\n\nAction items\n• Review the recorded question.\n\nNotes\nRetain this qualification.",
    );
  });
  it("rejects an empty source before a provider-generating request", () => {
    let calls = 0;
    const api = createApiClient(async () => {
      calls++;
      return Response.json(draft);
    });
    expect(() => generateDebrief(api, "one", "\n ")).toThrow("nonempty source");
    expect(calls).toBe(0);
  });
  it.each([
    { ...draft, actionItems: "invented format" },
    { ...draft, provider: "unverified-provider" },
    { ...draft, recap: " ", notes: "", actionItems: [] },
  ])(
    "rejects malformed or unusable proposals without a save",
    async (response) => {
      const api = createApiClient(async () => Response.json(response));
      await expect(generateDebrief(api, "one", "Source")).rejects.toMatchObject(
        { status: 502 },
      );
    },
  );
  it("propagates denied generation and does not retry or save", async () => {
    let calls = 0;
    const api = createApiClient(async () => {
      calls++;
      return Response.json({ message: "Generation disabled" }, { status: 403 });
    });
    await expect(generateDebrief(api, "one", "Source")).rejects.toMatchObject({
      status: 403,
    });
    expect(calls).toBe(1);
  });
});
