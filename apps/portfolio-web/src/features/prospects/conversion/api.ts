import { z } from "zod";
import type { ApiClient } from "@/shared/api/http";
import { prospectSchema } from "../contracts";

export const clientChoiceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  canonicalEntityId: z.string().nullable(),
});
export type ClientChoice = z.infer<typeof clientChoiceSchema>;
export const clientSearchLimit = 30;

export function searchLinkClients(
  api: ApiClient,
  search: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    q: search.trim().slice(0, 200),
    limit: String(clientSearchLimit),
  });
  return api.request(
    "core",
    `business-development/search/clients?${params}`,
    z.object({ results: z.array(clientChoiceSchema) }),
    { signal },
  );
}

export function linkProspectClient(
  api: ApiClient,
  prospectId: string,
  clientId: string,
) {
  z.uuid().parse(prospectId);
  z.uuid().parse(clientId);
  return api.request(
    "core",
    `business-development/prospects/${encodeURIComponent(prospectId)}/convert`,
    z.object({
      prospect: prospectSchema.refine(
        (record) =>
          record.id === prospectId &&
          record.linkedClientId === clientId &&
          Boolean(record.convertedAt) &&
          record.status === "active",
      ),
      client: z.object({ id: z.literal(clientId), name: z.string().min(1) }),
      created: z.literal(false),
    }),
    { method: "POST", body: { existingClientId: clientId } },
  );
}
