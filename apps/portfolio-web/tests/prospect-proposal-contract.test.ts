import { describe, expect, it } from "vitest";
import {
  parseProposalAdmissionCandidate,
  proposalCandidateVersion,
  proposalCreateCandidateSchema,
  proposalGenerationCandidateSchema,
  proposalUnavailableCandidateSchema,
  proposalUnknownCandidateSchema,
} from "../src/features/prospects/proposals/persistence-contract";

const id = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const hash = "a".repeat(64);
const request = {
  requestId: id(1),
  expectedProspect: { updatedAt: "2026-10-11T12:00:00Z", identityHash: hash },
  blueprint: {
    blueprintId: id(2),
    versionId: id(3),
    versionNumber: 2,
    definitionHash: hash,
  },
  brief: {
    briefId: id(4),
    versionId: id(5),
    versionNumber: 1,
    sectionsHash: hash,
    snapshotHash: hash,
  },
  inputs: {
    fee: {
      amountDecimal: "12345678901234567890.0100",
      currencyCode: "USD",
      frequency: "monthly" as const,
    },
    startDate: "2026-10-12",
    includeScopeFromBrief: true,
    includeBriefAppendix: false,
    team: {
      included: true as const,
      memberIds: [id(6)],
      approvedText: "Reviewed team text",
    },
  },
};
const workspace = {
  kind: "workspace_draft" as const,
  draftId: id(7),
  runId: id(8),
  sourceReceiptId: id(9),
  inputHash: hash,
  sourceSnapshotHash: hash,
};
const scope = { tenantId: id(10), prospectId: id(11), actorUserId: id(12) };
const admission = {
  contractVersion: proposalCandidateVersion,
  ...scope,
  proposalId: id(13),
  operationId: id(14),
  request,
  workspace,
  state: "queued",
  replayed: false,
};

describe("inactive prospect proposal contract candidate", () => {
  it("preserves reviewed decimal precision and exact team text without financial calculation", () => {
    const parsed = proposalCreateCandidateSchema.parse(request);
    expect(parsed.inputs.fee?.amountDecimal).toBe("12345678901234567890.0100");
    expect(parsed.inputs.team).toEqual(request.inputs.team);
  });

  it("accepts blank commercial terms for a saved draft without manufacturing values", () => {
    const parsed = proposalCreateCandidateSchema.parse({
      ...request,
      brief: null,
      inputs: {
        fee: null,
        startDate: null,
        includeScopeFromBrief: false,
        includeBriefAppendix: false,
        team: { included: false },
      },
    });
    expect(parsed.inputs.fee).toBeNull();
    expect(parsed.inputs.startDate).toBeNull();
  });

  it.each(["includeScopeFromBrief", "includeBriefAppendix"])(
    "refuses %s without the exact saved brief version",
    (field) => {
      expect(
        proposalCreateCandidateSchema.safeParse({
          ...request,
          brief: null,
          inputs: {
            ...request.inputs,
            includeScopeFromBrief: false,
            [field]: true,
          },
        }).success,
      ).toBe(false);
    },
  );

  it("refuses legacy clientId, mutable template ID and browser-authored source evidence", () => {
    for (const extra of [
      { clientId: id(11) },
      { templateId: id(2) },
      { briefText: "Unverified" },
    ]) {
      expect(
        proposalCreateCandidateSchema.safeParse({ ...request, ...extra })
          .success,
      ).toBe(false);
    }
  });

  it("refuses duplicate team identities, invalid calendar dates and numerical fee coercion", () => {
    const variants = [
      {
        ...request.inputs,
        team: { ...request.inputs.team, memberIds: [id(6), id(6)] },
      },
      { ...request.inputs, startDate: "2026-02-30" },
      {
        ...request.inputs,
        fee: { ...request.inputs.fee, amountDecimal: 12.1 },
      },
    ];
    variants.forEach((inputs) =>
      expect(
        proposalCreateCandidateSchema.safeParse({ ...request, inputs }).success,
      ).toBe(false),
    );
  });

  it("accepts an exactly bound durable Workspace receipt including replay", () => {
    expect(
      parseProposalAdmissionCandidate(
        { ...admission, replayed: true },
        { ...scope, request },
      ).replayed,
    ).toBe(true);
  });

  it.each(["tenantId", "prospectId", "actorUserId"])(
    "refuses a receipt for another %s",
    (field) => {
      expect(() =>
        parseProposalAdmissionCandidate(
          { ...admission, [field]: id(99) },
          { ...scope, request },
        ),
      ).toThrow(/another request/);
    },
  );

  it("refuses changed brief revision or reviewed fees even when the request UUID is unchanged", () => {
    for (const changed of [
      { ...request, brief: { ...request.brief, versionId: id(99) } },
      {
        ...request,
        inputs: {
          ...request.inputs,
          fee: { ...request.inputs.fee, amountDecimal: "999" },
        },
      },
    ]) {
      expect(() =>
        parseProposalAdmissionCandidate(
          { ...admission, request: changed },
          { ...scope, request },
        ),
      ).toThrow(/another request/);
    }
  });

  it("compares parsed fields independently of transport object-key ordering", () => {
    const reordered = {
      inputs: request.inputs,
      brief: request.brief,
      blueprint: request.blueprint,
      expectedProspect: request.expectedProspect,
      requestId: request.requestId,
    };
    expect(
      parseProposalAdmissionCandidate(
        { ...admission, request: reordered },
        { ...scope, request },
      ).proposalId,
    ).toBe(id(13));
  });

  it("refuses an unbound generic draft or HillDay document as an admission receipt", () => {
    for (const binding of [
      { draftId: id(7) },
      { ...workspace, kind: "hillday_document" },
    ]) {
      expect(() =>
        parseProposalAdmissionCandidate(
          { ...admission, workspace: binding },
          { ...scope, request },
        ),
      ).toThrow();
    }
  });

  it("requires explicit unavailability and never accepts fake queued admission fields", () => {
    const unavailable = {
      contractVersion: proposalCandidateVersion,
      code: "proposal_binding_unavailable",
      reasons: ["source_consumption_unverified"],
    };
    expect(proposalUnavailableCandidateSchema.parse(unavailable).code).toBe(
      "proposal_binding_unavailable",
    );
    expect(
      proposalUnavailableCandidateSchema.safeParse({
        ...unavailable,
        state: "queued",
        draftId: id(7),
      }).success,
    ).toBe(false);
    expect(
      proposalUnavailableCandidateSchema.safeParse({
        ...unavailable,
        reasons: [],
      }).success,
    ).toBe(false);
  });

  it("requires a durable saved version before complete and preserves partial as partial", () => {
    expect(
      proposalGenerationCandidateSchema.safeParse({
        state: "complete",
        workspace,
      }).success,
    ).toBe(false);
    expect(
      proposalGenerationCandidateSchema.parse({
        state: "partial",
        workspace,
        code: "section_failed",
        retainedVersionId: null,
      }).state,
    ).toBe("partial");
    expect(
      proposalGenerationCandidateSchema.safeParse({
        state: "failed",
        workspace,
        code: "section_failed",
        retainedVersionId: null,
        versionId: id(15),
      }).success,
    ).toBe(false);
    expect(
      proposalGenerationCandidateSchema.parse({
        state: "complete",
        workspace,
        versionId: id(15),
        versionHash: hash,
        completedAt: "2026-10-11T12:05:00Z",
        warnings: [],
      }).state,
    ).toBe("complete");
  });

  it("keeps unknown binding separate from admitted or retryable generation", () => {
    const unknown = {
      contractVersion: proposalCandidateVersion,
      ...scope,
      requestId: id(1),
      operationId: id(14),
      state: "binding_unknown",
      code: "workspace_acknowledgement_lost",
    };
    expect(proposalUnknownCandidateSchema.parse(unknown).state).toBe(
      "binding_unknown",
    );
    expect(
      proposalUnknownCandidateSchema.safeParse({ ...unknown, workspace })
        .success,
    ).toBe(false);
    expect(() =>
      parseProposalAdmissionCandidate(unknown, { ...scope, request }),
    ).toThrow();
  });
});
