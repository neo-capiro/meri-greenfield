import { z } from "zod";

// Inactive contract proposal only. No adapter, capability default, route or UI
// imports this module. These shapes are NOT deployed Capiro API contracts.
export const proposalCandidateVersion = "portfolio-proposal-candidate-1";
const uuid = z.uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.iso.datetime({ offset: true });
const text = (maximum: number) =>
  z
    .string()
    .max(maximum)
    .refine((value) => value.trim().length > 0);
const uniqueIds = z
  .array(uuid)
  .min(1)
  .max(50)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Duplicate member identity",
  );

export const proposalBlueprintPinSchema = z.strictObject({
  blueprintId: uuid,
  versionId: uuid,
  versionNumber: z.number().int().positive(),
  definitionHash: hash,
});
export const proposalBriefPinSchema = z.strictObject({
  briefId: uuid,
  versionId: uuid,
  versionNumber: z.number().int().positive(),
  sectionsHash: hash,
  snapshotHash: hash,
});
export const proposalInputSchema = z.strictObject({
  // Exact reviewed decimal text. No Number conversion, currency default,
  // precision conversion, inferred fee, financial arithmetic or charge.
  // Admission must also validate the owner's approved currency/precision rule.
  fee: z
    .strictObject({
      amountDecimal: z
        .string()
        .max(100)
        .regex(/^(0|[1-9]\d*)(\.\d+)?$/),
      currencyCode: z.string().regex(/^[A-Z]{3}$/),
      frequency: z.enum(["monthly", "fixed"]),
    })
    .nullable(),
  startDate: z.iso.date().nullable(),
  includeScopeFromBrief: z.boolean(),
  includeBriefAppendix: z.boolean(),
  team: z.discriminatedUnion("included", [
    z.strictObject({ included: z.literal(false) }),
    z.strictObject({
      included: z.literal(true),
      memberIds: uniqueIds,
      approvedText: text(4000),
    }),
  ]),
});

export const proposalCreateCandidateSchema = z
  .strictObject({
    requestId: uuid,
    expectedProspect: z.strictObject({
      updatedAt: timestamp,
      identityHash: hash,
    }),
    blueprint: proposalBlueprintPinSchema,
    brief: proposalBriefPinSchema.nullable(),
    inputs: proposalInputSchema,
  })
  .refine(
    ({ inputs, brief }) =>
      !(inputs.includeScopeFromBrief || inputs.includeBriefAppendix) || !!brief,
    "An exact saved brief version is required for scope or appendix",
  );
export type ProposalCreateCandidate = z.infer<
  typeof proposalCreateCandidateSchema
>;

export const proposalWorkspaceBindingSchema = z.strictObject({
  kind: z.literal("workspace_draft"),
  draftId: uuid,
  runId: uuid,
  sourceReceiptId: uuid,
  inputHash: hash,
  // Server must prove consumption of these hashes before it admits a job.
  sourceSnapshotHash: hash,
});
export const proposalAdmissionCandidateSchema = z.strictObject({
  contractVersion: z.literal(proposalCandidateVersion),
  tenantId: uuid,
  prospectId: uuid,
  actorUserId: uuid,
  proposalId: uuid,
  operationId: uuid,
  request: proposalCreateCandidateSchema,
  workspace: proposalWorkspaceBindingSchema,
  state: z.enum(["queued", "active"]),
  replayed: z.boolean(),
});
export type ProposalAdmissionCandidate = z.infer<
  typeof proposalAdmissionCandidateSchema
>;

// A valid UUID is insufficient: the receipt must bind this exact initiating
// actor, tenant, prospect, request and every reviewed input/source pin.
export function parseProposalAdmissionCandidate(
  value: unknown,
  expected: {
    tenantId: string;
    prospectId: string;
    actorUserId: string;
    request: ProposalCreateCandidate;
  },
): ProposalAdmissionCandidate {
  const receipt = proposalAdmissionCandidateSchema.parse(value);
  const request = proposalCreateCandidateSchema.parse(expected.request);
  const same =
    receipt.tenantId === expected.tenantId &&
    receipt.prospectId === expected.prospectId &&
    receipt.actorUserId === expected.actorUserId &&
    JSON.stringify(receipt.request) === JSON.stringify(request);
  if (!same) throw new Error("Proposal admission belongs to another request");
  return receipt;
}

export const proposalUnavailableCandidateSchema = z.strictObject({
  contractVersion: z.literal(proposalCandidateVersion),
  code: z.literal("proposal_binding_unavailable"),
  reasons: z
    .array(
      z.enum([
        "workspace_port_unavailable",
        "generation_port_unavailable",
        "source_consumption_unverified",
        "prospect_scope_unavailable",
        "commercial_terms_policy_unavailable",
      ]),
    )
    .min(1),
});

// GET-only recovery of a lost admission response. An unknown cross-service
// result carries no successful-looking draft/job and does not permit replay.
export const proposalUnknownCandidateSchema = z.strictObject({
  contractVersion: z.literal(proposalCandidateVersion),
  tenantId: uuid,
  prospectId: uuid,
  actorUserId: uuid,
  requestId: uuid,
  operationId: uuid,
  state: z.literal("binding_unknown"),
  code: text(120),
});

// Read projection proposal: complete requires a durable document version,
// and a failure cannot smuggle a successful version into the same state.
export const proposalGenerationCandidateSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.enum(["queued", "active"]),
    workspace: proposalWorkspaceBindingSchema,
  }),
  z.strictObject({
    state: z.enum(["partial", "failed", "cancelled", "needs_input"]),
    workspace: proposalWorkspaceBindingSchema,
    code: text(120),
    retainedVersionId: uuid.nullable(),
  }),
  z.strictObject({
    state: z.literal("complete"),
    workspace: proposalWorkspaceBindingSchema,
    versionId: uuid,
    versionHash: hash,
    completedAt: timestamp,
    warnings: z.array(text(500)).max(50),
  }),
]);
