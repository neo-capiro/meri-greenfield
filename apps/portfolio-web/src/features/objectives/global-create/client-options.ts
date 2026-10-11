import type { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  clientSchema,
  clientsKey,
  type Client,
} from "@/features/portfolio/public";
import {
  assertClientWriter,
  type ClientWriter,
} from "@/features/client-profile/quick-log/public";
import { ApiError } from "@/shared/api/http";

export const objectiveClientsKey = (actor: ClientWriter) =>
  [...clientsKey, actor.tenantId, actor.userId] as const;

export function clientOptions(clients: readonly Client[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  return clients.filter(
    (client) =>
      client.status.toLowerCase() !== "archived" &&
      (!query ||
        [client.name, client.sectorTag ?? ""].some((value) =>
          value.toLocaleLowerCase().includes(query),
        )),
  );
}

/** A catalog row is navigation context, not a grant to its memory contents. */
export function assertObjectiveClient(
  cache: QueryClient,
  actor: ClientWriter,
  clientId: string,
): Client {
  assertClientWriter(cache, actor);
  const key = objectiveClientsKey(actor);
  const state = cache.getQueryState(key);
  const parsed = z.array(clientSchema).safeParse(cache.getQueryData(key));
  if (
    state?.status !== "success" ||
    state.error ||
    state.fetchStatus !== "idle" ||
    state.isInvalidated ||
    !parsed.success
  )
    throw new ApiError(403, "Refresh the client list before continuing.");
  const matches = clientOptions(parsed.data, "").filter(
    (client) => client.id === clientId,
  );
  if (matches.length !== 1)
    throw new ApiError(403, "Choose a client from the current client list.");
  return matches[0]!;
}
