import { z } from "zod";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { clientSchema } from "@/features/portfolio/public";
import type { ClientWriter } from "../quick-log/public";

// Export retains JSON from source services, including their extensible intake,
// source records and provenance. Identity is separately validated, never inferred.
export const exportClientSchema = clientSchema
  .extend({ tenantId: z.uuid() })
  .catchall(z.json())
  .refine(
    (value) => z.json().safeParse(value).success,
    "The client source must contain JSON values.",
  );
export const exportIntelligenceSchema = z
  .object({
    client: z
      .object({
        id: z.uuid(),
        name: z.string(),
        description: z.string().nullable(),
        sectorTag: z.string().nullable(),
        submissionTracks: z.array(z.string()),
        capabilities: z.array(
          z.object({
            name: z.string(),
            sector: z.string().nullable(),
            tags: z.array(z.string()),
          }),
        ),
      })
      .passthrough(),
    mappings: z.array(z.json()),
    lda: z.record(z.string(), z.json()),
    contracting: z.record(z.string(), z.json()),
    lobbyIntel: z.record(z.string(), z.json()),
    relevantBills: z.array(z.json()),
    activeRegulations: z.array(z.json()),
    competitors: z.array(z.json()),
    aiSummary: z.string().nullable(),
    lastUpdated: z.iso.datetime({ offset: true }),
  })
  .catchall(z.json());
export async function prepareProfileExport(
  api: ApiClient,
  clientId: string,
  actor: ClientWriter,
  guard: () => void,
  signal: AbortSignal,
  now = () => new Date(),
) {
  guard();
  const client = await api.request(
    "core",
    `clients/${encodeURIComponent(clientId)}`,
    exportClientSchema.refine(
      (value) =>
        value.id === clientId &&
        value.tenantId === actor.tenantId &&
        value.status !== "archived",
    ),
    { signal },
  );
  guard();
  signal.throwIfAborted();
  let intelligence: z.infer<typeof exportIntelligenceSchema> | null = null;
  let omission: { code: string; httpStatus: number | null } | null = null;
  try {
    intelligence = await api.request(
      "core",
      `intelligence/client-profile/${encodeURIComponent(clientId)}`,
      exportIntelligenceSchema,
      { signal },
    );
    if (intelligence.client.id !== clientId)
      throw new ApiError(
        403,
        "The intelligence source belongs to a different profile. Nothing was exported.",
      );
  } catch (error) {
    guard();
    signal.throwIfAborted();
    if (error instanceof ApiError && [401, 403].includes(error.status))
      throw error;
    omission = {
      code: "source_unavailable",
      httpStatus: error instanceof ApiError ? error.status : null,
    };
  }
  guard();
  signal.throwIfAborted();
  return {
    schemaVersion: 1,
    exportedAt: now().toISOString(),
    complete: omission === null,
    omittedSources: omission ? ["intelligence"] : [],
    sources: {
      client: { status: "available" },
      intelligence: {
        status: omission ? "unavailable" : "available",
        error: omission,
      },
    },
    client,
    intelligence,
  };
}
export type ProfileExport = Awaited<ReturnType<typeof prepareProfileExport>>;
export function downloadProfileExport(
  payload: ProfileExport,
  guard: () => void,
) {
  guard();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = `${payload.client.name.replace(/[^a-zA-Z0-9_-]+/g, "_") || "client"}-profile${payload.complete ? "" : "-partial"}.json`;
    document.body.appendChild(anchor);
    guard();
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
