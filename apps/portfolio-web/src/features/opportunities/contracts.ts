import { z } from "zod";
export const opportunitySources = [
  "grants_gov",
  "sam_gov",
  "agency_forecast",
  "dibbs",
  "sbir_sttr",
  "ca_portal",
] as const;
const count = z.number().int().nonnegative();
const capability = z.object({ allowed: z.boolean(), reason: z.string() });
export const opportunitySchema = z.object({
  id: z.string(),
  source: z.enum(opportunitySources),
  sourceRecordId: z.string(),
  title: z.string(),
  agency: z.string().nullable(),
  type: z.enum([
    "grant",
    "cooperative_agreement",
    "loan_assistance",
    "contract",
    "solicitation",
    "task_order_vehicle",
    "presolicitation",
    "sources_sought",
    "forecast",
    "award",
    "other",
  ]),
  lifecycle: z.enum(["active", "forecast", "closed", "post_award"]),
  deadline: z.string().nullable(),
  summary: z.string().nullable(),
  value: z.number().finite().nullable(),
  valueBasis: z.enum(["source_backed", "not_stated_by_source"]),
  relevanceScore: z.number().finite().nullable(),
  matchedSignals: z.array(
    z.object({
      signal: z.string(),
      strength: z.enum(["strong", "moderate", "weak"]),
      matchedOn: z.string(),
    }),
  ),
  eligibility: z
    .object({
      state: z.enum(["eligible", "ineligible", "needs_review", "unknown"]),
      reason: z.string(),
    })
    .nullable(),
  clientId: z.string().nullable(),
  decoration: z
    .object({
      workflow: z.object({
        available: z.boolean(),
        status: z.string().nullable(),
        unavailableReason: z.string().nullable(),
      }),
      bookmark: z.object({
        saved: z.boolean(),
        scope: z.enum(["workspace", "client"]),
        clientId: z.string().nullable(),
      }),
      capabilities: z.object({ pursue: capability, save: capability }),
    })
    .optional(),
});
export const searchResponseSchema = z.object({
  opportunities: z.array(opportunitySchema),
  page: count.min(1),
  pageSize: count.min(1),
  total: count.nullable(),
  totalIsCapped: z.boolean(),
  catalogComplete: z.boolean(),
  counts: z.object({
    grants: count.nullable(),
    contracts: count.nullable(),
    active: count.nullable(),
    closed: count.nullable(),
  }),
  mode: z.enum(["matched", "all"]),
  clientId: z.string().nullable(),
  freshness: z.array(
    z.object({
      source: z.enum(opportunitySources),
      state: z.enum([
        "current",
        "degraded",
        "stale",
        "never_synced",
        "initial_partial",
        "error_cached",
        "unavailable",
        "not_enabled",
        "unknown",
      ]),
      lastSyncedAt: z.string().nullable(),
    }),
  ),
  profileGaps: z
    .object({
      items: z.array(
        z.object({
          title: z.string(),
          body: z.string(),
          tag: z.string(),
          tone: z.enum(["warn", "muted"]),
        }),
      ),
    })
    .nullable(),
  generatedAt: z.string(),
});
export function clientSearchSchema(clientId: string, page: number) {
  return searchResponseSchema.refine(
    (result) =>
      result.clientId === clientId &&
      result.mode === "matched" &&
      result.page === page &&
      result.opportunities.every(
        (row) =>
          row.clientId === clientId &&
          (!row.decoration ||
            (row.decoration.bookmark.scope === "client" &&
              row.decoration.bookmark.clientId === clientId)),
      ),
    "Opportunity scope mismatch",
  );
}
export const programResponseSchema = z.object({
  data: z.array(
    z.object({
      peCode: z.string(),
      title: z.string().nullable(),
      score: z.number().min(0).max(1),
      paths: z.array(
        z.object({
          path: z.string(),
          score: z.number().min(0).max(1),
          evidence: z.array(z.string()),
        }),
      ),
    }),
  ),
  total: count,
  page: count.min(1),
  limit: count.min(1),
});
export type Opportunity = z.infer<typeof opportunitySchema>;
export type OpportunitySearch = z.infer<typeof searchResponseSchema>;
export type ProgramPage = z.infer<typeof programResponseSchema>;
