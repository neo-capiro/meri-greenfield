import {
  sectionKeys,
  sectionsSchema,
  type Sections,
  type SectionKey,
  type BriefVersion,
} from "./contracts";
export type Draft = Record<SectionKey, string>;
export function draftOf(version: BriefVersion): Draft {
  return {
    companyAndFirmImplication: version.sections.companyAndFirmImplication.text,
    verifiedEvidence: version.sections.verifiedEvidence.text,
    judgment: version.sections.judgment.text,
    practicalAction: version.sections.practicalAction.text,
    missingInformation: version.sections.missingInformation.text,
  };
}
export function changedSections(version: BriefVersion, draft: Draft): Sections {
  const sections = structuredClone(version.sections);
  for (const key of sectionKeys) {
    if (!draft[key].trim() || draft[key].length > 4000)
      throw new Error("Each section needs 1–4000 characters.");
    if (draft[key] !== version.sections[key].text)
      sections[key] = {
        ...sections[key],
        text: draft[key],
        provenance: "edited",
      };
  }
  return sectionsSchema.parse(sections);
}
// An explicit merge carries only this user's changes onto the reviewed latest
// version. Citation identities must still match; indexes are remapped by identity.
export function mergeDraft(
  base: BriefVersion,
  latest: BriefVersion,
  draft: Draft,
) {
  const merged = structuredClone(latest.sections);
  for (const key of sectionKeys) {
    if (draft[key] === base.sections[key].text) continue;
    const indexes = base.sections[key].citationIndexes.map((index) => {
      const old = base.citations[index];
      const next = latest.citations.findIndex(
        (citation) => old && JSON.stringify(citation) === JSON.stringify(old),
      );
      if (next < 0)
        throw new Error(
          "A cited source changed or is no longer available. Review the latest sources before editing this section again.",
        );
      return next;
    });
    merged[key] = {
      text: draft[key],
      provenance: "edited",
      citationIndexes: indexes,
    };
  }
  return sectionsSchema.parse(merged);
}
export function sourceHref(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    /* A saved locator can be a reference rather than a URL. */
  }
  return undefined;
}
