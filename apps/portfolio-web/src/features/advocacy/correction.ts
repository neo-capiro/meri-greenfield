import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import type { MatterDetail } from "./contracts";
import { advocacyPath, loadMatter, loadMatters, loadTimeline } from "./queries";

export type Correction =
  | { kind: "merge"; source: MatterDetail; target: MatterDetail }
  | {
      kind: "reassign";
      recordId: string;
      source: MatterDetail | null;
      target: MatterDetail;
    }
  | {
      kind: "detach" | "not-advocacy";
      recordId: string;
      source: MatterDetail | null;
      reason?: string;
    };

function sameSnapshot(expected: MatterDetail, actual: MatterDetail) {
  return JSON.stringify(expected) === JSON.stringify(actual);
}
export async function prepareCorrection(
  api: ApiClient,
  clientId: string,
  correction: Correction,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const list = await loadMatters(api, clientId, signal);
  const source = correction.source;
  const target = "target" in correction ? correction.target : null;
  for (const matter of [source, target]) {
    if (!matter) continue;
    if (!list.some((row) => row.id === matter.id))
      throw new ApiError(
        409,
        "A selected matter is no longer available. Reload and review the current records.",
      );
    if (
      !sameSnapshot(matter, await loadMatter(api, clientId, matter.id, signal))
    )
      throw new ApiError(
        409,
        "The selected matter changed. Reload and review the current records before correcting it.",
      );
  }
  if (source && target && source.id === target.id)
    throw new ApiError(400, "Choose a different matter.");
  if (correction.kind !== "merge") {
    const current = source
      ? source.records.some((record) => record.id === correction.recordId)
      : (await loadTimeline(api, clientId, signal)).some(
          (entry) =>
            entry.kind === "record" &&
            entry.id === correction.recordId &&
            entry.matterId === null,
        );
    if (!current)
      throw new ApiError(
        409,
        "This record is no longer in the reviewed location. Reload history before correcting it.",
      );
    if (
      correction.kind === "not-advocacy" &&
      (correction.reason?.length ?? 0) > 1000
    )
      throw new ApiError(400, "Reason must be at most 1000 characters.");
  }
  signal?.throwIfAborted();
  return correction;
}

export function submitCorrection(
  api: ApiClient,
  clientId: string,
  correction: Correction,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const root = advocacyPath(clientId);
  if (correction.kind === "merge")
    return api.request(
      "core",
      `${root}/${encodeURIComponent(correction.target.id)}/merge`,
      z.null(),
      {
        method: "POST",
        body: { sourceMatterId: correction.source.id },
        signal,
      },
    );
  return api.request(
    "core",
    `${root}/records/${encodeURIComponent(correction.recordId)}/${correction.kind}`,
    z.null(),
    {
      method: "POST",
      signal,
      ...(correction.kind === "reassign"
        ? { body: { targetMatterId: correction.target.id } }
        : correction.kind === "not-advocacy"
          ? { body: correction.reason ? { reason: correction.reason } : {} }
          : {}),
    },
  );
}

export async function checkCorrection(
  api: ApiClient,
  clientId: string,
  correction: Correction,
  options: { signal?: AbortSignal; acknowledged?: boolean } = {},
) {
  const { signal } = options;
  signal?.throwIfAborted();
  if (correction.kind === "merge") {
    const list = await loadMatters(api, clientId, signal);
    if (
      list.some((row) => row.id === correction.source.id) ||
      !list.some((row) => row.id === correction.target.id)
    )
      return false;
    const target = await loadMatter(
      api,
      clientId,
      correction.target.id,
      signal,
    );
    return (
      correction.source.records.every((record) =>
        target.records.some(
          (row) => row.id === record.id && row.matterLocked === true,
        ),
      ) &&
      correction.source.links.every((link) =>
        target.links.some(
          (row) =>
            row.linkType === link.linkType && row.linkKey === link.linkKey,
        ),
      )
    );
  }
  if (correction.kind === "reassign") {
    const target = await loadMatter(
      api,
      clientId,
      correction.target.id,
      signal,
    );
    if (
      !target.records.some(
        (row) => row.id === correction.recordId && row.matterLocked === true,
      )
    )
      return false;
    return (
      !correction.source ||
      !(
        await loadMatter(api, clientId, correction.source.id, signal)
      ).records.some((row) => row.id === correction.recordId)
    );
  }
  const timeline = await loadTimeline(api, clientId, signal);
  const entry = timeline.find(
    (row) => row.kind === "record" && row.id === correction.recordId,
  );
  if (
    correction.kind === "detach"
      ? !entry || entry.matterId !== null
      : Boolean(entry)
  )
    return false;
  if (correction.kind === "not-advocacy" && !options.acknowledged) return false;
  return (
    !correction.source ||
    !(
      await loadMatter(api, clientId, correction.source.id, signal)
    ).records.some((row) => row.id === correction.recordId)
  );
}
