import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";

// The generation endpoint returns a proposal, not a persisted debrief.
export const debriefDraftSchema = z.object({
  recap: z.string(),
  actionItems: z.array(z.string()),
  notes: z.string(),
  provider: z.enum(["openai", "anthropic"]),
  model: z.string().min(1),
});
export function generateDebrief(
  api: ApiClient,
  meetingId: string,
  sourceText: string,
  signal?: AbortSignal,
  method: "upload" | "manual" | "voice" = "upload",
) {
  if (!sourceText.trim())
    throw new ApiError(422, "Review a nonempty source before generating.");
  return api.request(
    "core",
    `engagement/meetings/${encodeURIComponent(meetingId)}/debrief-draft`,
    debriefDraftSchema.refine(
      (draft) =>
        Boolean(
          draft.recap.trim() ||
          draft.notes.trim() ||
          draft.actionItems.some((item) => item.trim()),
        ),
      "The service returned an empty draft",
    ),
    { method: "POST", body: { method, sourceText }, signal },
  );
}
export function debriefBody(draft: z.infer<typeof debriefDraftSchema>) {
  return [
    draft.recap.trim(),
    draft.actionItems.some((item) => item.trim())
      ? `Action items\n${draft.actionItems
          .filter((item) => item.trim())
          .map((item) => `• ${item.trim()}`)
          .join("\n")}`
      : "",
    draft.notes.trim() ? `Notes\n${draft.notes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
