import { ApiError, type ApiClient } from "@/shared/api/http";
import {
  candidatesSchema,
  importReceiptSchema,
  registrantHitsSchema,
  registrantSchema,
} from "./contracts";
import { receiptMatches, validateSelection } from "./domain";

export class ImportAttemptError extends Error {
  constructor(
    message: string,
    public readonly uncertain: boolean,
  ) {
    super(message);
    this.name = "ImportAttemptError";
  }
}
export function fetchRegistrant(api: ApiClient, signal?: AbortSignal) {
  return api.request("core", "firm/registrant", registrantSchema, { signal });
}
export function fetchCandidates(
  api: ApiClient,
  registrantId: number,
  signal?: AbortSignal,
) {
  return api.request(
    "core",
    "firm/import-candidates",
    candidatesSchema.refine(
      (result) => result.registrantId === registrantId,
      "The linked firm changed. Refresh and review.",
    ),
    { signal },
  );
}
export function searchRegistrants(
  api: ApiClient,
  query: string,
  signal?: AbortSignal,
) {
  const q = query.trim();
  if (q.length < 2 || q.length > 200)
    throw new Error("Enter 2–200 characters to search.");
  return api.request(
    "core",
    `firm/lda-registrants?${new URLSearchParams({ q })}`,
    registrantHitsSchema,
    { signal },
  );
}
export function linkRegistrant(api: ApiClient, registrantId: number) {
  if (!Number.isSafeInteger(registrantId) || registrantId < 1)
    throw new Error("Select a valid firm.");
  return api.request(
    "core",
    "firm/registrant",
    registrantSchema.refine(
      (result) => result.ldaRegistrantId === registrantId,
      "Firm link receipt mismatch",
    ),
    { method: "PUT", body: { registrantId } },
  );
}
export async function importClients(
  api: ApiClient,
  registrantId: number,
  ids: number[],
) {
  const selected = [...ids];
  validateSelection(selected);
  const anchor = await fetchRegistrant(api);
  if (anchor.ldaRegistrantId !== registrantId)
    throw new ImportAttemptError(
      "The linked firm changed. Refresh and review before importing.",
      false,
    );
  const current = await fetchCandidates(api, registrantId);
  validateSelection(selected, current);
  try {
    return await api.request(
      "core",
      "firm/import",
      importReceiptSchema.refine(
        (result) => receiptMatches(result, selected),
        "Import receipt mismatch",
      ),
      { method: "POST", body: { ldaClientIds: selected } },
    );
  } catch (error) {
    // A transport/5xx/invalid-receipt failure can follow committed rows.
    const uncertain = !(error instanceof ApiError) || error.status >= 500;
    throw new ImportAttemptError(
      error instanceof Error ? error.message : "Import failed.",
      uncertain,
    );
  }
}
