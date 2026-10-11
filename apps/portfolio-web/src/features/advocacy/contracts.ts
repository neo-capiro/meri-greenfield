import { z } from "zod";
export const matterSchema = z.object({
  id: z.string(),
  title: z.string(),
  matterType: z.string(),
  status: z.string(),
  summary: z.string().nullable(),
  openedAt: z.string().nullable(),
  lastActivityAt: z.string().nullable(),
  recordCount: z.number(),
  outcomeCount: z.number(),
  linkCount: z.number(),
});
export type Matter = z.infer<typeof matterSchema>;
export const recordSchema = z.object({
  id: z.string(),
  recordType: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  activityDate: z.string().nullable(),
  sourceType: z.string(),
  sourceUrl: z.string().nullable(),
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
export const matterTypes = {
  funding_request: "Funding request",
  legislative: "Legislative",
  regulatory: "Regulatory",
  program_element: "Program element",
  community_project: "Community project",
  procurement: "Procurement",
  other: "Other",
} as const;
