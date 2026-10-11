import { z } from "zod";
export const matterSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  matterType: z.string(),
  status: z.string(),
  summary: z.string().nullable(),
  openedAt: z.string().nullable(),
  lastActivityAt: z.string().nullable(),
  recordCount: z.number(),
  outcomeCount: z.number(),
  linkCount: z.number(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
});
export type Matter = z.infer<typeof matterSchema>;
export const recordSchema = z.object({
  id: z.string().uuid(),
  recordType: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  activityDate: z.string().nullable(),
  sourceType: z.string(),
  sourceUrl: z.string().nullable(),
  sourceId: z.string().nullable().optional(),
  matterLocked: z.boolean().optional(),
  status: z.string().nullable().optional(),
  metadata: z
    .object({
      sourceUrl: z.string().nullable().optional(),
      presentation: z
        .object({
          sourceTitle: z.string().nullable().optional(),
          sourceStatus: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
  evidenceClass: z.string(),
  confidence: z.number(),
  outcome: z.string().nullable(),
});
export const matterDetailSchema = matterSchema.extend({
  records: z.array(recordSchema),
  links: z.array(
    z.object({
      id: z.string(),
      linkType: z.string(),
      label: z.string().nullable(),
      linkKey: z.string(),
    }),
  ),
});
export type AdvocacyRecord = z.infer<typeof recordSchema>;
export type MatterDetail = z.infer<typeof matterDetailSchema>;
export const timelineEntrySchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["record", "link"]),
  title: z.string(),
  subtype: z.string(),
  date: z.string().nullable(),
  evidenceClass: z.string().nullable(),
  confidence: z.number().nullable(),
  matterId: z.string().uuid().nullable(),
  matterTitle: z.string().nullable(),
  attributionNeedsReview: z.boolean().optional(),
});
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;
export const matterTypes = {
  funding_request: "Funding request",
  legislative: "Legislative",
  regulatory: "Regulatory",
  program_element: "Program element",
  community_project: "Community project",
  procurement: "Procurement",
  other: "Other",
} as const;
