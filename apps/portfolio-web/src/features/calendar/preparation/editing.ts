import type { Preparation } from "./schema";
import type { EditPreparation } from "./api";
import { emailEvidenceText } from "./email-evidence";
export const prepFields = {
  summary: "Summary",
  agenda: "Agenda",
  talkingPoints: "Talking points",
  risks: "Watch-outs",
  followUps: "Follow-ups",
  emailEvidence: "Email evidence",
} as const;
export type PrepField = keyof typeof prepFields;
export function itemText(item: Preparation["agenda"][number]) {
  if (typeof item === "string") return item;
  if ("text" in item) return item.text;
  return `${item.title}${item.description ? ` — ${item.description}` : ""}${item.dueDate ? ` (Due ${item.dueDate})` : ""}`;
}
export function editValues(prep: Preparation): Record<PrepField, string> {
  return {
    summary: prep.summary ?? "",
    agenda: prep.agenda.map(itemText).join("\n"),
    talkingPoints: prep.talkingPoints.map(itemText).join("\n"),
    risks: prep.risks.map(itemText).join("\n"),
    followUps: prep.followUps.map(itemText).join("\n"),
    emailEvidence: prep.emailEvidence.map(emailEvidenceText).join("\n"),
  };
}
// Only changed sections are sent: untouched evidence-linked items retain their shape.
export function editedBody(
  prep: Preparation,
  values: Record<PrepField, string>,
): EditPreparation {
  const prior = editValues(prep);
  const body: EditPreparation = {};
  for (const key of Object.keys(prepFields) as PrepField[]) {
    if (values[key] === prior[key]) continue;
    if (
      key === "emailEvidence" &&
      prep.emailEvidence.some((item) => typeof item !== "string")
    )
      throw new Error(
        "Structured email evidence retains its source attribution and cannot be edited here.",
      );
    if (key === "summary") body.summary = values.summary.trim() || null;
    else {
      const lines = values[key]
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length > 80)
        throw new Error(`${prepFields[key]} must contain at most 80 items.`);
      body[key] = lines;
    }
  }
  return body;
}
export function parseBoards(value: string) {
  const ids = [...new Set(value.split(/[\s,]+/).filter(Boolean))];
  if (ids.length > 20 || ids.some((id) => !/^\d{1,24}$/.test(id)))
    throw new Error("Enter up to 20 board IDs, each containing 1–24 digits.");
  return ids;
}
