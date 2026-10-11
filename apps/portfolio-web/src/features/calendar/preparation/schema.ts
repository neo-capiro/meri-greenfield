import { z } from "zod";

// Canonical prep payload: legacy edited text and current evidence-linked items.
export const prepItemSchema = z.union([
  z.string(),
  z.object({ text: z.string(), factIds: z.array(z.string()) }),
  z.object({ text: z.string(), evidenceReferences: z.array(z.string()) }),
  z.object({
    title: z.string(),
    description: z.string(),
    dueDate: z.string().optional(),
  }),
]);
const factItem = z.object({ text: z.string(), factIds: z.array(z.string()) });
const generatedFrom = z
  .object({
    schemaVersion: z.string().optional(),
    reviewStatus: z.string().optional(),
    grounding: z
      .object({
        version: z.literal(1),
        contentEdited: z.boolean(),
        attendees: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            email: z.string().nullable(),
          }),
        ),
        sources: z.array(
          z.object({
            id: z.string(),
            kind: z.string(),
            title: z.string(),
            recordId: z.string().nullable(),
            observedAt: z.string().nullable(),
            excerpt: z.string(),
          }),
        ),
        references: z.array(
          z.object({
            section: z.string(),
            itemIndex: z.number(),
            sourceIds: z.array(z.string()),
          }),
        ),
        limitations: z.array(z.string()),
      })
      .optional(),
    briefing: z
      .object({
        version: z.literal(2),
        takeaways: z.array(factItem),
        sections: z.record(
          z.string(),
          z.object({
            status: z.string(),
            items: z.array(factItem),
            gap: z.string(),
          }),
        ),
        facts: z.array(
          z.object({ id: z.string(), sourceId: z.string(), quote: z.string() }),
        ),
        coverage: z.object({
          extractedBatches: z.number(),
          totalBatches: z.number(),
          factCount: z.number(),
          reviewedFactCount: z.number(),
          selectedFactCount: z.number(),
          partial: z.boolean(),
        }),
        limitations: z.array(z.string()),
      })
      .or(z.literal(true))
      .optional(),
  })
  .refine(
    (value) =>
      value.briefing !== true ||
      value.schemaVersion === "research_portfolio_institutional_v1",
    "Unrecognized preparation briefing format",
  );
export const preparationSchema = z.object({
  id: z.string(),
  meetingId: z.string().optional(),
  clientId: z.string().nullable().optional(),
  status: z.string(),
  summary: z.string().nullable(),
  agenda: z.array(prepItemSchema),
  talkingPoints: z.array(prepItemSchema),
  risks: z.array(prepItemSchema),
  followUps: z.array(prepItemSchema),
  emailEvidence: z
    .array(
      z.union([
        z.string(),
        z.object({
          summary: z.string(),
          sourceId: z.string(),
          sourceUrl: z.string(),
        }),
      ]),
    )
    .default([]),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  sharedAt: z.string().nullable().optional(),
  generatedFrom: generatedFrom.nullish(),
});
export type Preparation = z.infer<typeof preparationSchema>;
export const prepJobSchema = z.object({
  jobId: z.string(),
  meetingId: z.string(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  stage: z.string(),
  depth: z.enum(["standard", "deep", "max"]),
  prepId: z.string().nullable(),
  errorCode: z.string().nullable(),
  deadlineAt: z.string(),
});
export type PrepJob = z.infer<typeof prepJobSchema>;
export type PrepDepth = PrepJob["depth"];
export { calendarCapabilitiesSchema as prepCapabilitiesSchema } from "../access/contracts";
export const boardMappingSchema = z.object({
  clientId: z.string(),
  boardIds: z.array(z.string().regex(/^\d{1,24}$/)).max(20),
});
