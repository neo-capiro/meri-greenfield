import { z } from "zod";
import { safeWebsite } from "@/features/portfolio/public";
export const portfolioStages = [
  "identified",
  "initiated",
  "engaged",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;
export const legacyStages = [
  "researching",
  "qualified",
  "outreach",
  "meeting",
  "proposal",
  "won",
  "lost",
  "parked",
] as const;
export const stages = [...new Set([...portfolioStages, ...legacyStages])];
export const stageSchema = z.enum([...portfolioStages, ...legacyStages]);
export const stageLabel = (stage: string) =>
  stage
    .split("_")
    .map((word, index) =>
      index ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
// Candidate contract: capability discovery prevents sending new values to an older API.
// No legacy mapping is inferred, including won/lost -> closed_won/closed_lost.
export const stageCatalogSchema = z
  .object({
    version: z.literal("portfolio-3.1"),
    stages: z
      .array(
        z.object({ value: z.enum(portfolioStages), label: z.string().min(1) }),
      )
      .length(7),
    createStage: z.literal("identified"),
    legacyMapping: z.enum(["pending", "complete"]),
    allowLegacyTransitions: z.boolean(),
  })
  .refine(
    (catalog) =>
      new Set(catalog.stages.map((stage) => stage.value)).size ===
      portfolioStages.length,
    "Incomplete stage catalog",
  );
export type StageCatalog = z.infer<typeof stageCatalogSchema>;
export const isPortfolioStage = (stage: string) =>
  portfolioStages.some((value) => value === stage);
export const prospectSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  domain: z.string().nullable(),
  website: z.string().nullable(),
  description: z.string().nullable(),
  serviceHypothesis: z.string().nullable(),
  geography: z.string().nullable(),
  ownerUserId: z.string().nullable(),
  stage: stageSchema,
  status: z.enum(["active", "dismissed"]),
  nextAction: z.string().nullable(),
  nextActionDueAt: z.string().nullable(),
  linkedClientId: z.string().nullable(),
  convertedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Prospect = z.infer<typeof prospectSchema>;
export const prospectListSchema = z.object({
  prospects: z.array(prospectSchema),
  counts: z.object({
    visible: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    dismissed: z.number().int().nonnegative(),
    byStage: z.record(z.string(), z.number().int().nonnegative()),
  }),
});
export const historySchema = z.array(
  z.object({
    id: z.uuid(),
    kind: z.string(),
    body: z.string(),
    createdAt: z.string(),
    actorUserId: z.string().nullable(),
  }),
);
export const prospectInputSchema = z.object({
  displayName: z.string().trim().min(1, "Company name is required.").max(200),
  website: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => !value || Boolean(safeWebsite(value)),
      "Enter a valid website.",
    ),
  domain: z.string().trim().max(200),
  description: z.string().trim().max(4000),
  serviceHypothesis: z.string().trim().max(4000),
  geography: z.string().trim().max(200),
});
export type ProspectInput = z.infer<typeof prospectInputSchema>;
export type ProspectFilter = {
  search: string;
  status: "active" | "dismissed" | "all";
  stage: string;
  ownerId: string;
};
export function prospectQuery(filter: ProspectFilter) {
  const params = new URLSearchParams({ status: filter.status, limit: "200" });
  if (filter.search.trim())
    params.set("search", filter.search.trim().slice(0, 200));
  if (stageSchema.safeParse(filter.stage).success)
    params.set("stage", filter.stage);
  if (z.uuid().safeParse(filter.ownerId).success)
    params.set("ownerId", filter.ownerId);
  return params.toString();
}
