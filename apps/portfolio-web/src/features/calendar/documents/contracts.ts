import type { z } from "zod";
import type { Meeting, noteSchema } from "../contracts";
import type { Preparation } from "../preparation/schema";

export type DocumentMeeting = Pick<Meeting, "id" | "subject" | "client">;
export type SavedMeetingDocument =
  | { kind: "preparation"; preparation: Preparation }
  | { kind: "debrief"; debrief: z.infer<typeof noteSchema> };
export interface PreparationPdfReceipt {
  id: string;
  fileName: string;
}
export function documentId(document: SavedMeetingDocument) {
  return document.kind === "preparation"
    ? document.preparation.id
    : document.debrief.id;
}

export function assertExportable(document: SavedMeetingDocument) {
  if (document.kind === "debrief") {
    if (document.debrief.restricted || document.debrief.confidential)
      throw new Error(
        "Restricted or confidential debriefs cannot be exported here.",
      );
  } else if (
    document.preparation.generatedFrom?.schemaVersion ===
    "research_portfolio_institutional_v1"
  ) {
    throw new Error(
      "Use the originating governed Research Portfolio review workflow to export this preparation.",
    );
  }
}

/** Current server PDF supports ordinary string lists and WinAnsi text only. */
export function attachmentCompatibility(
  preparation: Preparation,
  meetingTitle = "",
): string | null {
  try {
    assertExportable({ kind: "preparation", preparation });
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "This preparation cannot be exported.";
  }
  if (preparation.generatedFrom)
    return "The server PDF does not preserve all generated briefing evidence and coverage disclosures. Use local Print / Save as PDF until the server renderer supports this preparation.";
  const lists = [
    preparation.agenda,
    preparation.talkingPoints,
    preparation.risks,
    preparation.followUps,
    preparation.emailEvidence,
  ];
  if (lists.some((items) => items.some((item) => typeof item !== "string")))
    return "The server PDF omits structured preparation items. Use local Print / Save as PDF to preserve the saved content.";
  const text = [meetingTitle, preparation.summary ?? "", ...lists.flat()].join(
    "\n",
  );
  if (/[^\s\x20-\x7e\xa0-\xffŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]/u.test(text))
    return "The server PDF replaces some characters in this preparation. Use local Print / Save as PDF to preserve Unicode content.";
  return null;
}

/** Stable across JSON object-key order; array order remains meaningful. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function preparationSnapshot(preparation: Preparation) {
  return stable(preparation);
}
