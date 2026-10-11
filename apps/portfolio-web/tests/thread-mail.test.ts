import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/shared/api/http";
import {
  readTimelineThread,
  threadKey,
} from "../src/features/relationships/thread/contracts";
import {
  orderedMessages,
  replyRecipients,
} from "../src/features/relationships/thread/recipients";
import {
  fullThread,
  threadId,
  threadClientId,
  threadTenantId,
} from "./thread-mail-fixture";
const scope = {
  tenantId: threadTenantId,
  userId: "actor",
  clientId: threadClientId,
  threadId,
};
describe("synced timeline thread", () => {
  it("reads exact stored thread source and preserves all messages", async () => {
    const calls: string[] = [];
    const api = createApiClient(async (input) => {
      calls.push(String(input));
      return Response.json(fullThread);
    });
    expect((await readTimelineThread(api, scope)).messages).toHaveLength(2);
    expect(calls).toEqual([
      `/api/backend/core/engagement/mail-threads/${threadId}`,
    ]);
  });
  it.each(["id", "clientId", "tenantId"] as const)(
    "refuses incorrect %s receipt",
    async (field) => {
      const api = createApiClient(async () =>
        Response.json({
          ...fullThread,
          [field]: "80000000-0000-4000-8000-000000000001",
        }),
      );
      await expect(readTimelineThread(api, scope)).rejects.toThrow();
    },
  );
  it("refuses cross-thread messages and duplicate message identities", async () => {
    for (const messages of [
      [{ ...fullThread.messages[0], threadId: threadClientId }],
      [fullThread.messages[0], fullThread.messages[0]],
    ]) {
      const api = createApiClient(async () =>
        Response.json({ ...fullThread, messages }),
      );
      await expect(readTimelineThread(api, scope)).rejects.toThrow();
    }
  });
  it("keys cached data by actor, tenant, client and thread", () => {
    for (const field of ["userId", "tenantId", "clientId", "threadId"] as const)
      expect(threadKey({ ...scope, [field]: "other" })).not.toEqual(
        threadKey(scope),
      );
  });
  it("orders received-only messages by actual effective date rather than server null ordering", () => {
    expect(orderedMessages(fullThread)[0]?.id).toBe(fullThread.messages[1]?.id);
    expect(fullThread.messages[0]?.sentAt).toBe("2026-10-10T14:00:00Z");
  });
  it("Reply selects only the actual newest sender", () => {
    expect(replyRecipients(fullThread, "actor@example.test", false)).toEqual({
      to: [{ email: "taylor@example.test", name: "Taylor Test" }],
      cc: [],
      messageId: fullThread.messages[1]?.id,
    });
  });
  it("Reply all excludes both own addresses, deduplicates actual To/Cc and ignores roster", () => {
    const result = replyRecipients(fullThread, "ACTOR@example.test", true);
    expect(result.cc.map((item) => item.email)).toEqual([
      "colleague@example.test",
      "copied@example.test",
    ]);
    expect(result.to).toEqual([
      { email: "taylor@example.test", name: "Taylor Test" },
    ]);
  });
  it("an outgoing message replies to its actual To address", () => {
    expect(
      replyRecipients(
        { ...fullThread, messages: [fullThread.messages[0]!] },
        "actor@example.test",
        false,
      ).to[0]?.email,
    ).toBe("taylor@example.test");
  });
  it.each([null, "invalid"])(
    "blocks missing or invalid originating self identity %s",
    (connectionEmail) => {
      expect(() =>
        replyRecipients(
          { ...fullThread, connectionEmail },
          "actor@example.test",
          true,
        ),
      ).toThrow("mailbox address");
    },
  );
  it("blocks disconnected mailbox, invalid sender and malformed recipients", () => {
    expect(() =>
      replyRecipients(
        { ...fullThread, connectionStatus: "disconnected" },
        null,
        false,
      ),
    ).toThrow("not connected");
    expect(() =>
      replyRecipients(
        {
          ...fullThread,
          messages: [{ ...fullThread.messages[1]!, fromEmail: null }],
        },
        null,
        false,
      ),
    ).toThrow("sender");
    expect(() =>
      replyRecipients(
        {
          ...fullThread,
          messages: [
            { ...fullThread.messages[1]!, ccRecipients: [{ email: "bad" }] },
          ],
        },
        null,
        true,
      ),
    ).toThrow();
  });
  it("never falls back to the participant roster for a self-only or empty thread", () => {
    expect(() =>
      replyRecipients({ ...fullThread, messages: [] }, null, false),
    ).toThrow("No stored");
    expect(() =>
      replyRecipients(
        {
          ...fullThread,
          messages: [
            {
              ...fullThread.messages[0]!,
              toRecipients: [{ email: "mailbox@example.test" }],
            },
          ],
        },
        null,
        true,
      ),
    ).toThrow("no verified recipient");
  });
  it("refuses reply-all recipients exceeding the service's explicit Cc bound", () => {
    expect(() =>
      replyRecipients(
        {
          ...fullThread,
          messages: [
            {
              ...fullThread.messages[1]!,
              toRecipients: Array.from({ length: 11 }, (_, i) => ({
                email: `contact${i}@example.test`,
              })),
              ccRecipients: [],
            },
          ],
        },
        null,
        true,
      ),
    ).toThrow("10 Cc");
  });
});
