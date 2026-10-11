import { z } from "zod";
export const termTypes = [
  "bill",
  "agency",
  "committee",
  "legislator",
  "company",
  "competitor",
  "topic",
  "risk_phrase",
  "support_language",
  "opposition_language",
  "program_element",
  "synonym",
  "entity",
  "risk",
  "keyword",
] as const;
export const topicSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  issueArea: z.string().nullable(),
  position: z.enum(["support", "oppose", "monitor"]),
  priority: z.enum(["low", "med", "high"]),
  terms: z.array(z.object({ termType: z.enum(termTypes), value: z.string() })),
});
export type Topic = z.infer<typeof topicSchema>;
export type TopicDraft = Topic & { key: string; originalLabel?: string };
const rejectionSchema = z.object({
  topics: z.array(z.object({ label: z.string(), reason: z.string() })),
  terms: z.array(
    z.object({ topicLabel: z.string(), value: z.string(), reason: z.string() }),
  ),
});
export const intelWatchlistSchema = z.object({
  clientId: z.string(),
  issueAreas: z.array(z.string()),
  jurisdictions: z.array(z.string()),
  topics: z.array(topicSchema),
  version: z.number().int().nonnegative(),
  suggestedIssueAreas: z.array(z.string()).optional(),
  suggestedJurisdictions: z.array(z.string()).optional(),
  rejected: rejectionSchema.optional(),
  updatedByName: z.string().nullable().optional(),
});
export const coreWatchlistSchema = z.object({
  issueAreas: z.array(z.string()),
  tags: z.array(
    z.object({
      tag: z.string(),
      issueArea: z.string().nullable().optional(),
      synonyms: z.array(z.string()),
      relatedEntities: z.array(z.string()),
      riskTerms: z.array(z.string()),
      position: z.enum(["support", "oppose", "monitor"]).optional(),
      priority: z.enum(["low", "med", "high"]),
    }),
  ),
});
export type Watchlist = {
  issueAreas: string[];
  jurisdictions: string[];
  topics: Topic[];
  version?: number;
  suggestedIssueAreas?: string[];
  suggestedJurisdictions?: string[];
  rejected?: z.infer<typeof rejectionSchema>;
};
export type WatchlistDraft = {
  issueAreas: string[];
  jurisdictions: string[];
  topics: TopicDraft[];
};
export const taxonomySchema = z.object({ issueAreas: z.array(z.string()) });
export function fromCoreWatchlist(
  data: z.infer<typeof coreWatchlistSchema>,
): Watchlist {
  return {
    issueAreas: data.issueAreas,
    jurisdictions: [],
    topics: data.tags.map((tag) => ({
      label: tag.tag,
      issueArea: tag.issueArea ?? null,
      position: tag.position ?? "monitor",
      priority: tag.priority,
      terms: [
        ...tag.synonyms.map((value) => ({
          termType: "synonym" as const,
          value,
        })),
        ...tag.relatedEntities.map((value) => ({
          termType: "entity" as const,
          value,
        })),
        ...tag.riskTerms.map((value) => ({ termType: "risk" as const, value })),
      ],
    })),
  };
}
export function toCoreWatchlist(draft: WatchlistDraft) {
  return {
    issueAreas: draft.issueAreas,
    tags: draft.topics.map((topic) => ({
      tag: topic.label,
      issueArea: topic.issueArea,
      position: topic.position,
      priority: topic.priority,
      synonyms: topic.terms
        .filter((term) => term.termType === "synonym")
        .map((term) => term.value),
      relatedEntities: topic.terms
        .filter((term) => term.termType === "entity")
        .map((term) => term.value),
      riskTerms: topic.terms
        .filter((term) => term.termType === "risk")
        .map((term) => term.value),
    })),
  };
}
export function toIntelWatchlist(draft: WatchlistDraft, version: number) {
  return {
    issueAreas: draft.issueAreas,
    jurisdictions: draft.jurisdictions,
    expectedVersion: version,
    topics: draft.topics.map((topic) => ({
      ...topicSchema.parse(topic),
      ...(topic.originalLabel && topic.originalLabel !== topic.label
        ? { renameFrom: topic.originalLabel }
        : {}),
    })),
  };
}
