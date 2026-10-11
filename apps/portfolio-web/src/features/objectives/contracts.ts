import { z } from "zod";
// Wire contract candidate: capirov2 PR 2362, objective-rules.ts / presentObjective.
export const askTypes = {
  funding: "Funding",
  policy_authority: "Policy / authority",
  both: "Funding and policy",
  protect_funding: "Protect funding",
  meri_propose: "Let Meri propose",
} as const;
export const objectiveFieldsSchema = z.object({
  outcome: z.string().trim().max(2000),
  governmentProblem: z.string().trim().max(4000),
  askType: z
    .enum([
      "funding",
      "policy_authority",
      "both",
      "protect_funding",
      "meri_propose",
    ])
    .nullable(),
  minimumWin: z.string().trim().max(2000),
  limits: z.string().trim().max(4000),
});
export type ObjectiveFields = z.infer<typeof objectiveFieldsSchema>;
export const objectiveSchema = objectiveFieldsSchema.extend({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  requestId: z.string().uuid(),
  ownerUserId: z.string().nullable(),
  status: z.enum(["draft", "in_review", "ready"]),
  version: z.number().int().positive(),
  readyAt: z.string().nullable(),
  reviewRequestedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  readiness: z.object({
    isReady: z.boolean(),
    completedFields: z.number(),
    requiredFields: z.literal(4),
    checklist: z.object({
      outcome: z.boolean(),
      governmentProblem: z.boolean(),
      askType: z.boolean(),
      minimumWin: z.boolean(),
    }),
  }),
});
export type Objective = z.infer<typeof objectiveSchema>;
export const scopedObjectivesSchema = (clientId: string) =>
  z
    .array(objectiveSchema)
    .refine(
      (records) =>
        records.every((record) => record.clientId === clientId) &&
        new Set(records.map((record) => record.id)).size === records.length,
      "Objectives do not identify the selected client uniquely",
    );
export const statusLabels = {
  draft: "Draft",
  in_review: "In review",
  ready: "Ready",
} as const;
export const emptyFields: ObjectiveFields = {
  outcome: "",
  governmentProblem: "",
  askType: null,
  minimumWin: "",
  limits: "",
};
