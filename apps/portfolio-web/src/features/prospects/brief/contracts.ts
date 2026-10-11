import { z } from "zod";

export const sectionKeys = [
  "companyAndFirmImplication",
  "verifiedEvidence",
  "judgment",
  "practicalAction",
  "missingInformation",
] as const;
export type SectionKey = (typeof sectionKeys)[number];
export const sectionLabels: Record<SectionKey, string> = {
  companyAndFirmImplication: "Company and firm implication",
  verifiedEvidence: "Verified evidence",
  judgment: "Judgment",
  practicalAction: "Practical action",
  missingInformation: "Missing information",
};
const section = z.strictObject({
  text: z.string().min(1).max(4000),
  provenance: z.enum(["generated", "edited"]),
  citationIndexes: z.array(z.number().int().min(0).max(11)).max(12),
});
export const sectionsSchema = z.strictObject({
  companyAndFirmImplication: section,
  verifiedEvidence: section,
  judgment: section,
  practicalAction: section,
  missingInformation: section,
});
export type Sections = z.infer<typeof sectionsSchema>;
export const citationSchema = z.object({
  sourceFamily: z.string(),
  recordId: z.string(),
  locator: z.string().nullable(),
  originalSourceName: z.string().nullable(),
  originalSourceId: z.string().nullable(),
  eventDate: z.string().nullable(),
  sourceUpdatedAt: z.string().nullable(),
  retrievedAt: z.string().nullable(),
  title: z.string(),
  relationshipStrength: z.string(),
  stage: z.string().nullable(),
});
export type Citation = z.infer<typeof citationSchema>;
const evidenceSchema = z.object({
  sourceFamily: z.string(),
  recordId: z.string().nullable(),
  locator: z.string().nullable(),
  originalSourceName: z.string().nullable(),
  originalSourceId: z.string().nullable(),
  claimType: z.enum([
    "identity",
    "government_exposure",
    "relevant_signal",
    "footprint",
    "lobbying",
    "people",
  ]),
  relationshipStrength: z.enum([
    "direct",
    "conditional",
    "thematic",
    "unresolved",
  ]),
  eventDate: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  fiscalYear: z.number().nullable(),
  stage: z
    .enum([
      "requested",
      "authorized",
      "obligated",
      "awarded",
      "ceiling",
      "forecast",
    ])
    .nullable(),
  sourceUpdatedAt: z.string().nullable(),
  fetchedAt: z.string().nullable(),
  scopeChecked: z.string().nullable(),
  status: z.enum([
    "available",
    "empty_in_queried_scope",
    "ambiguous",
    "stale",
    "partial",
    "error",
  ]),
  title: z.string(),
  // The authoritative evidence contract owns a section-specific detail record.
  // It is retained, never interpreted as invented financial/strategic fields.
  detail: z.record(z.string(), z.unknown()),
});
const snapshotSchema = z.object({
  generatedAt: z.string(),
  identityBasis: z.string(),
  canonicalEntityId: z.string().nullable(),
  canonicalName: z.string().nullable(),
  evidence: z.array(evidenceSchema).max(24),
});
export const versionSummarySchema = z.object({
  id: z.string(),
  versionNumber: z.number().int().min(1).max(100),
  createdAt: z.string(),
  createdByUserId: z.string().nullable(),
  sectionsHash: z.string(),
  citationCount: z.number().int().min(0).max(12),
});
export const versionSchema = versionSummarySchema
  .extend({
    sections: sectionsSchema,
    citations: z.array(citationSchema).max(12),
    sourceSnapshot: snapshotSchema,
    snapshotHash: z.string(),
  })
  .refine(
    (value) =>
      value.citationCount === value.citations.length &&
      sectionKeys.every((key) =>
        value.sections[key].citationIndexes.every(
          (index) => index < value.citations.length,
        ),
      ),
    "Invalid saved citation references",
  );
export type BriefVersion = z.infer<typeof versionSchema>;
export const briefSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  prospectId: z.string(),
  title: z.string().max(300),
  status: z.enum(["draft", "archived"]),
  currentVersionNumber: z.number().int().min(1).nullable(),
  currentVersionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdByUserId: z.string().nullable(),
});
export const currentSchema = z
  .object({
    brief: briefSchema.nullable(),
    currentVersion: versionSchema.nullable(),
  })
  .refine(
    (value) =>
      value.brief
        ? value.currentVersion === null
          ? value.brief.currentVersionId === null &&
            value.brief.currentVersionNumber === null
          : value.brief.currentVersionId === value.currentVersion.id &&
            value.brief.currentVersionNumber ===
              value.currentVersion.versionNumber
        : value.currentVersion === null,
    "Saved brief version does not match its root",
  );
export type CurrentBrief = z.infer<typeof currentSchema>;
export const writeSchema = z.object({
  brief: briefSchema,
  version: versionSchema,
  created: z.boolean(),
});
export const versionsSchema = z
  .object({
    brief: briefSchema,
    versions: z.array(versionSummarySchema).max(100),
  })
  .refine(
    (value) =>
      new Set(value.versions.map((v) => v.versionNumber)).size ===
      value.versions.length,
    "Duplicate saved versions",
  );
export const refreshSchema = z
  .object({
    baseVersionNumber: z.number().int().min(1),
    proposed: sectionsSchema,
    diff: z
      .array(
        z.object({
          section: z.enum(sectionKeys),
          changed: z.boolean(),
          baseText: z.string(),
          proposedText: z.string(),
        }),
      )
      .length(5),
    sourceSnapshot: snapshotSchema,
    snapshotHash: z.string(),
  })
  .refine(
    (value) =>
      new Set(value.diff.map((item) => item.section)).size ===
      sectionKeys.length,
    "Incomplete refresh comparison",
  );
export type RefreshProposal = z.infer<typeof refreshSchema>;
export const resolutionSchema = z.discriminatedUnion("resolvable", [
  z.object({
    resolvable: z.literal(true),
    citation: citationSchema,
    sourceSnapshotEvidence: evidenceSchema.nullable(),
    currentDossierEvidence: evidenceSchema.nullable(),
  }),
  z.object({
    resolvable: z.literal(false),
    limitation: z.enum([
      "citation_index_out_of_range",
      "brief_not_found",
      "source_changed",
    ]),
    message: z.string(),
    citation: citationSchema.nullable(),
  }),
]);
