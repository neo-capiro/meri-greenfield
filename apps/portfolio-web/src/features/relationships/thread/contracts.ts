import { z } from "zod";
import type { ApiClient } from "@/shared/api/http";
import { messageSchema, threadSchema } from "../email";

// Detail returns all stored active messages. The list's three-message projection
// is deliberately insufficient for expansion or selecting reply recipients.
export const fullThreadSchema = threadSchema
  .extend({
    tenantId: z.uuid(),
    connectionStatus: z.string().nullable(),
    messages: z.array(
      messageSchema.extend({
        threadId: z.uuid(),
        createdAt: z.iso.datetime({ offset: true }),
        sentAt: z.iso.datetime({ offset: true }).nullable(),
        receivedAt: z.iso.datetime({ offset: true }).nullable(),
      }),
    ),
  })
  .refine(
    (thread) =>
      thread.messages.every((message) => message.threadId === thread.id) &&
      new Set(thread.messages.map((message) => message.id)).size ===
        thread.messages.length,
    "Mail message association mismatch",
  );
export type FullThread = z.infer<typeof fullThreadSchema>;
export interface ThreadScope {
  tenantId: string;
  userId: string;
  clientId: string;
  threadId: string;
}
export const threadKey = (scope: ThreadScope) =>
  [
    "mail-thread",
    scope.tenantId,
    scope.userId,
    scope.clientId,
    scope.threadId,
  ] as const;
export function readTimelineThread(
  api: ApiClient,
  scope: ThreadScope,
  signal?: AbortSignal,
) {
  z.uuid().parse(scope.clientId);
  z.uuid().parse(scope.threadId);
  return api.request(
    "core",
    `engagement/mail-threads/${scope.threadId}`,
    fullThreadSchema.refine(
      (thread) =>
        thread.id === scope.threadId &&
        thread.clientId === scope.clientId &&
        thread.tenantId === scope.tenantId,
      "Thread does not belong to this client and tenant",
    ),
    { signal },
  );
}
