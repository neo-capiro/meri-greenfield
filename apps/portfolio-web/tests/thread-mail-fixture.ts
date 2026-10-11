import type { FullThread } from "../src/features/relationships/thread/contracts";
export const threadClientId = "10000000-0000-4000-8000-000000000001";
export const threadId = "20000000-0000-4000-8000-000000000001";
export const threadTenantId = "90000000-0000-4000-8000-000000000001";
export const fullThread: FullThread = {
  id: threadId,
  clientId: threadClientId,
  tenantId: threadTenantId,
  subject: "Synthetic policy discussion",
  snippet: "Stored preview",
  connectionEmail: "mailbox@example.test",
  connectionStatus: "connected",
  participants: [{ email: "never-use-roster@example.test" }],
  messages: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      threadId,
      subject: "Synthetic policy discussion",
      fromEmail: "mailbox@example.test",
      fromName: "Mailbox owner",
      toRecipients: [{ email: "taylor@example.test", name: "Taylor Test" }],
      ccRecipients: [],
      bodyText: "Earlier outgoing message.",
      sentAt: "2026-10-10T14:00:00Z",
      receivedAt: null,
      createdAt: "2026-10-10T14:00:01Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      threadId,
      subject: "Synthetic policy discussion",
      fromEmail: "Taylor@EXAMPLE.test",
      fromName: "Taylor Test",
      toRecipients: [
        { email: "mailbox@example.test" },
        { email: "actor@example.test" },
        { email: "colleague@example.test", name: "Colleague Test" },
      ],
      ccRecipients: [
        { email: "copied@example.test" },
        { email: "COLLEAGUE@example.test" },
      ],
      bodyText:
        "Latest incoming stored message.\n<script>untrusted email is plain text</script>",
      sentAt: null,
      receivedAt: "2026-10-11T14:00:00Z",
      createdAt: "2026-10-11T14:00:01Z",
    },
  ],
};
