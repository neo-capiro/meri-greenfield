import { it, expect } from "vitest";
import {
  fromCoreWatchlist,
  toCoreWatchlist,
  toIntelWatchlist,
  type WatchlistDraft,
} from "../src/features/bill-tracker/watchlist-contracts";
it("preserves legacy synonym, entity, risk, stance and priority fields through a topic edit", () => {
  const stored = {
    issueAreas: ["Defense"],
    tags: [
      {
        tag: "Sensors",
        issueArea: "Defense",
        position: "oppose" as const,
        priority: "high" as const,
        synonyms: ["Radar"],
        relatedEntities: ["Test Agency"],
        riskTerms: ["Prohibition"],
      },
    ],
  };
  const projected = fromCoreWatchlist(stored);
  const draft: WatchlistDraft = {
    ...projected,
    topics: projected.topics.map((topic) => ({
      ...topic,
      key: "local",
      label: "Edited sensors",
    })),
  };
  expect(toCoreWatchlist(draft)).toEqual({
    ...stored,
    tags: [{ ...stored.tags[0], tag: "Edited sensors" }],
  });
});
it("sends version and rename identity while stripping UI keys and term ids", () => {
  const result = toIntelWatchlist(
    {
      issueAreas: [],
      jurisdictions: ["VA"],
      topics: [
        {
          key: "local",
          id: "stable-topic",
          originalLabel: "Old label",
          label: "New label",
          issueArea: null,
          position: "monitor",
          priority: "med",
          terms: [{ termType: "program_element", value: "0601101D" }],
        },
      ],
    },
    7,
  );
  expect(result.expectedVersion).toBe(7);
  expect(result.topics[0]).toEqual({
    id: "stable-topic",
    label: "New label",
    renameFrom: "Old label",
    issueArea: null,
    position: "monitor",
    priority: "med",
    terms: [{ termType: "program_element", value: "0601101D" }],
  });
  expect(result.topics[0]).not.toHaveProperty("key");
});
