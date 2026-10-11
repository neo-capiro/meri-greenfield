import type { Candidate, Candidates, ImportReceipt } from "./contracts";

export function groupCandidates(candidates: Candidate[]) {
  const groups = new Map<number, Candidate[]>();
  for (const row of candidates) {
    const aliases = groups.get(row.ldaClientId) ?? [];
    aliases.push(row);
    groups.set(row.ldaClientId, aliases);
  }
  return [...groups].map(([ldaClientId, aliases]) => ({
    ldaClientId,
    aliases,
    onboardedAs:
      aliases.find((row) => row.onboardedAs !== null)?.onboardedAs ?? null,
  }));
}
export function validateSelection(ids: number[], candidates?: Candidates) {
  if (
    !ids.length ||
    ids.length > 100 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !Number.isSafeInteger(id) || id < 1)
  )
    throw new Error("Select between 1 and 100 distinct clients.");
  if (candidates) {
    const allowed = new Set(
      groupCandidates(candidates.candidates)
        .filter((row) => row.onboardedAs === null)
        .map((row) => row.ldaClientId),
    );
    if (ids.some((id) => !allowed.has(id)))
      throw new Error(
        "The client selection changed. Refresh and review before importing.",
      );
  }
}
export function receiptMatches(receipt: ImportReceipt, requested: number[]) {
  const returned = [...receipt.items, ...receipt.skipped].map(
    (row) => row.ldaClientId,
  );
  return (
    receipt.created === receipt.items.length &&
    new Set(receipt.items.map((row) => row.id)).size === receipt.items.length &&
    returned.length === requested.length &&
    new Set(returned).size === returned.length &&
    returned.every((id) => requested.includes(id))
  );
}
export function observedSelection(ids: number[], candidates: Candidates) {
  const groups = groupCandidates(candidates.candidates);
  return ids.map((id) => ({
    ldaClientId: id,
    onboardedAs:
      groups.find((row) => row.ldaClientId === id)?.onboardedAs ?? null,
  }));
}
export function canReadRegistrant(role?: string | null) {
  return (
    role === "standard_user" || role === "user_admin" || role === "capiro_admin"
  );
}
