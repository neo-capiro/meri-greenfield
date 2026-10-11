import { z } from "zod";
// Values intentionally remain JSON: finding kinds carry different server-owned
// payloads. The review renders them without synthesizing domain fields.
const json = z.json();
export const sources = {
  public_web: "Public web",
  synced_email: "Synced email",
  sam_gov: "SAM.gov",
  lda: "LDA",
  program_elements: "Program Elements",
  bill_tracker: "Bill Tracker",
} as const;
export const findingSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  kind: z.string(),
  targetKey: z.string(),
  source: z.string(),
  factKind: z.enum(["fact", "recommendation"]),
  currentValue: json,
  proposedValue: json,
  evidence: z.array(
    z.object({
      label: z.string(),
      url: z.string().nullable().optional(),
      excerpt: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      observedAt: z.string().nullable().optional(),
      metadata: z.record(z.string(), json).optional(),
    }),
  ),
  confidence: z.number(),
  status: z.enum(["pending", "accepted", "rejected", "informational"]),
  rejectionReason: z.string().nullable().optional(),
  appliedAt: z.string().nullable(),
  createdAt: z.string(),
});
export const runSchema = z
  .object({
    id: z.string().uuid(),
    clientId: z.string().uuid(),
    status: z.enum(["running", "completed", "partial", "failed", "cancelled"]),
    requestedSources: z.array(z.string()),
    sourceStates: z.record(z.string(), json),
    summary: z.record(z.string(), json),
    stage: z.string().optional(),
    error: z.string().nullable(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    workflowVersion: z.number().optional(),
    attachmentIds: z.array(z.string().uuid()).optional(),
    selectedLdaIds: z.array(z.number().int()).optional(),
    setup: z
      .object({
        website: z.string().nullable().optional(),
        sources: z.array(z.string()).optional(),
        attachmentIds: z.array(z.string().uuid()).optional(),
        selectedLdaIds: z.array(z.number().int()).optional(),
      })
      .nullable()
      .optional(),
    tasks: z
      .array(
        z.object({
          id: z.string().uuid(),
          runId: z.string().uuid(),
          clientId: z.string().uuid().optional(),
          taskType: z.string(),
          taskKey: z.string(),
          status: z.enum([
            "queued",
            "running",
            "completed",
            "failed",
            "skipped",
            "cancelled",
          ]),
          attempt: z.number().int(),
          maxAttempts: z.number().int(),
          errorCode: z.string().nullable(),
          errorMessage: z.string().nullable(),
          outputSummary: z.record(z.string(), json).nullable(),
          nextAttemptAt: z.string().nullable(),
        }),
      )
      .optional(),
    findings: z.array(findingSchema),
  })
  .superRefine((run, ctx) => {
    if (
      new Set(run.findings.map((f) => f.id)).size !== run.findings.length ||
      run.findings.some(
        (f) =>
          f.runId !== run.id || (f.clientId && f.clientId !== run.clientId),
      ) ||
      run.tasks?.some(
        (t) =>
          t.runId !== run.id || (t.clientId && t.clientId !== run.clientId),
      ) ||
      (run.tasks &&
        new Set(run.tasks.map((t) => t.id)).size !== run.tasks.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Run contains inconsistent child identities.",
      });
  });
const identityOption = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  selected: z.boolean(),
  origin: z.enum(["imported", "suggested"]),
});
export const setupSchema = z.object({
  clientId: z.string().uuid(),
  clientName: z.string(),
  website: z.string().nullable(),
  selectedIdentities: z.array(identityOption),
  suggestedIdentities: z.array(identityOption),
  taskPreview: z.array(z.string()),
});
export type FillRun = z.infer<typeof runSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Setup = z.infer<typeof setupSchema>;
export type JsonValue = z.infer<typeof json>;
const applyable = new Set([
  "profile_field",
  "government_identity",
  "person",
  "facility",
  "capability",
  "lda_identity",
  "federal_footprint",
  "advocacy_record",
  "advocacy_outcome",
  "regulatory_outcome",
]);
export const canSelectFinding = (f: Finding) =>
  f.status === "pending" && applyable.has(f.kind);
export const safeEvidenceUrl = (value: string | null | undefined) => {
  try {
    const url = new URL(value ?? "");
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};
export const previewOnlyDependency =
  "New research and retries need a review-only service contract. The current service can save website, identity mappings and facility districts before approval.";
