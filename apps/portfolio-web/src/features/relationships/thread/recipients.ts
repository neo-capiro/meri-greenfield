import { mailRecipient, type Recipient } from "../email/recipients";
import type { FullThread } from "./contracts";

export function orderedMessages(thread: FullThread) {
  return [...thread.messages].sort(
    (a, b) =>
      Date.parse(b.sentAt ?? b.receivedAt ?? b.createdAt) -
      Date.parse(a.sentAt ?? a.receivedAt ?? a.createdAt),
  );
}
export function replyRecipients(
  thread: FullThread,
  actorEmail: string | null,
  all: boolean,
): {
  to: Recipient[];
  cc: Recipient[];
  messageId: string;
} {
  const own = mailRecipient.safeParse({
    email: thread.connectionEmail?.trim(),
  });
  if (!own.success)
    throw new Error(
      "The originating mailbox address is unavailable. Reply recipients cannot be verified.",
    );
  if (thread.connectionStatus !== "connected")
    throw new Error(
      "The originating mailbox is not connected. Reconnect it before preparing a reply.",
    );
  const self = new Set([own.data.email]);
  const actor = mailRecipient.safeParse({ email: actorEmail?.trim() });
  if (actor.success) self.add(actor.data.email);
  const message = orderedMessages(thread)[0];
  if (!message) throw new Error("No stored message is available to reply to.");
  if (
    !Number.isFinite(
      Date.parse(message.sentAt ?? message.receivedAt ?? message.createdAt),
    )
  )
    throw new Error(
      "The message date is unavailable. A reply target cannot be selected safely.",
    );
  const sender = mailRecipient.safeParse({
    email: message.fromEmail?.trim(),
    ...(message.fromName ? { name: message.fromName } : {}),
  });
  if (!sender.success)
    throw new Error(
      "The message sender is unavailable. Reply recipients cannot be verified.",
    );
  const list = (items: typeof message.toRecipients) =>
    items.map((item) =>
      mailRecipient.parse({
        email: item.email.trim(),
        ...(item.name ? { name: item.name } : {}),
      }),
    );
  // Never use Bcc, snippets or the thread-wide participant roster. For an
  // outgoing message, its actual To addresses identify the other party.
  const toMessage = list(message.toRecipients);
  const ccMessage = all ? list(message.ccRecipients) : [];
  const pool = self.has(sender.data.email)
    ? [...toMessage, ...ccMessage]
    : [sender.data, ...(all ? [...toMessage, ...ccMessage] : [])];
  const seen = new Set(self);
  const distinct = pool.filter((item) => {
    if (seen.has(item.email)) return false;
    seen.add(item.email);
    return true;
  });
  const [to, ...cc] = distinct;
  if (!to)
    throw new Error(
      "This message has no verified recipient other than your own addresses.",
    );
  if (all && cc.length > 10)
    throw new Error(
      "Reply all exceeds the service's 10 Cc recipient limit. Review recipients in your mailbox.",
    );
  return { to: [to], cc: all ? cc : [], messageId: message.id };
}
