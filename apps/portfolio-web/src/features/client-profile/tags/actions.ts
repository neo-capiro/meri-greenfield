import { z } from "zod";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError, type ApiClient } from "@/shared/api/http";
import { canAdminister } from "@/shared/auth/identity";
import { clientSchema } from "@/features/portfolio/public";
import { assertClientWriter, type ClientWriter } from "../quick-log/public";

export const focusTagSchema = z
  .string()
  .trim()
  .min(1, "Enter a focus tag.")
  .max(100, "Use 100 characters or fewer.");
export function focusTags(
  intake: { [key: string]: unknown } | null | undefined,
) {
  return [
    ...new Set(
      [intake?.portfolio, intake?.tags, intake?.sectors].flatMap((value) =>
        Array.isArray(value)
          ? value.filter(
              (item): item is string =>
                typeof item === "string" && Boolean(item.trim()),
            )
          : [],
      ),
    ),
  ];
}
export function assertTagWriter(cache: QueryClient, actor: ClientWriter) {
  assertClientWriter(cache, actor);
  const identity = cache.getQueryData<{ role?: string | null }>(["identity"]);
  if (!canAdminister(identity?.role))
    throw new ApiError(403, "An administrator must add focus tags.");
}
export async function addFocusTag(
  api: ApiClient,
  clientId: string,
  actor: ClientWriter,
  value: string,
  guard: () => void,
  signal: AbortSignal,
  dispatched: () => void,
) {
  const tag = focusTagSchema.parse(value);
  const schema = clientSchema
    .extend({ tenantId: z.uuid() })
    .refine(
      (client) =>
        client.id === clientId &&
        client.tenantId === actor.tenantId &&
        client.status !== "archived",
      "The profile does not match this client and tenant.",
    );
  guard();
  const current = await api.request(
    "core",
    `clients/${encodeURIComponent(clientId)}`,
    schema,
    { signal },
  );
  guard();
  signal.throwIfAborted();
  const intake = current.intakeData ?? {};
  const existing = z.array(z.string()).safeParse(intake.tags ?? []);
  if (!existing.success)
    throw new ApiError(
      409,
      "Saved focus tags have an unsupported format. No changes were sent.",
    );
  if (
    focusTags(intake).some((value) => value.toLowerCase() === tag.toLowerCase())
  )
    throw new ApiError(409, "This focus tag is already saved.");
  const tags = [...existing.data, tag];
  dispatched();
  const receipt = await api.request(
    "core",
    `clients/${encodeURIComponent(clientId)}`,
    schema.refine(
      (client) =>
        JSON.stringify(client.intakeData?.tags) === JSON.stringify(tags),
      "The saved tags do not match this change.",
    ),
    { method: "PUT", body: { intakeData: { ...intake, tags } }, signal },
  );
  guard();
  return receipt;
}
