import type { ApiClient } from "@/shared/api/http";
import type { TrackerBackend } from "@/shared/config/config";
import {
  coreBoardSchema,
  intelBoardSchema,
  coreBoard,
  intelBoard,
  billSearchSchema,
  coreTrackSchema,
  coreUntrackSchema,
  intelTrackSchema,
  intelUntrackSchema,
  corpusSchema,
} from "./contracts";
export const trackerBase = (clientId: string, backend: TrackerBackend) =>
  `${backend === "core" ? "intelligence/" : ""}clients/${encodeURIComponent(clientId)}/tracker`;
export async function fetchBoard(
  api: ApiClient,
  clientId: string,
  backend: TrackerBackend,
  cursor: string | null,
  signal?: AbortSignal,
) {
  const base = trackerBase(clientId, backend);
  if (backend === "core")
    return coreBoard(
      await api.request(backend, `${base}/board`, coreBoardSchema, { signal }),
    );
  const params = new URLSearchParams({ limit: "100" });
  if (cursor) params.set("cursor", cursor);
  return intelBoard(
    await api.request(backend, `${base}/board?${params}`, intelBoardSchema, {
      signal,
    }),
  );
}
export function searchBills(
  api: ApiClient,
  clientId: string,
  backend: TrackerBackend,
  q: string,
  jurisdictions: string[],
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ q: q.trim() });
  if (backend === "intelligence")
    jurisdictions.forEach((key) => params.append("jurisdictions", key));
  return api.request(
    backend,
    `${trackerBase(clientId, backend)}/bill-search?${params}`,
    billSearchSchema,
    { signal },
  );
}
export async function setTracked(
  api: ApiClient,
  clientId: string,
  backend: TrackerBackend,
  billId: string,
  track: boolean,
) {
  const base = trackerBase(clientId, backend);
  if (track) {
    if (backend === "core")
      return api.request(backend, `${base}/track`, coreTrackSchema, {
        method: "POST",
        body: { billId, source: "manual_search" },
      });
    return api.request(
      backend,
      `${base}/track`,
      intelTrackSchema.refine(
        (record) => record.billId === billId && record.clientId === clientId,
        "Tracked bill association mismatch",
      ),
      {
        method: "POST",
        body: { billId, source: "manual_search", isManual: true },
      },
    );
  }
  return backend === "core"
    ? api.request(
        backend,
        `${base}/track/${encodeURIComponent(billId)}`,
        coreUntrackSchema,
        { method: "DELETE" },
      )
    : api.request(backend, `${base}/untrack`, intelUntrackSchema, {
        method: "POST",
        body: { billId },
      });
}
export function fetchJurisdictions(api: ApiClient, signal?: AbortSignal) {
  return api.request(
    "intelligence",
    "legiwatch/bills/corpus-metadata",
    corpusSchema,
    { signal },
  );
}
