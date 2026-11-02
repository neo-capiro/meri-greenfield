# Send email from chat — 2 November 2026

## What already existed

The governed mail chain was complete apart from choosing a sender for a new message:

- Intent row `mail_send@0.2.0` → tool `propose_mail` (`apps/worker/conversation/intents/catalog.mjs`). Preview turns it on with `features.capabilityPlatform.*.governedIntents: true`. Intents have no per-operation roster in `deployment-inputs.json`.
- The runtime preparer `apps/runtime/native-authority/native-mail-preparer.mjs` stores an approval proposal and sends nothing.
- Control approval (`apps/control/intents/approval.mjs`) → approval forwarder → Core `NativeApprovalService` → `native-mail-execution.ts` → `EngagementService.sendSingleMail`.
- Core rechecks the actor credential, active membership and conversation, client wall, connected-mailbox ownership and address, and the approval decision and its revocation. The send runs inside the `SingleMailLedger` transaction. The request key is the proposal id, so a replay or a lost acknowledgement reads the stored attempt and never sends twice.
- Gmail and Graph send, reply, reply-all and forward are supported, with attachments from authorized Core files.
- Frontend card: `apps/web/src/features/meri/conversation/intents/mail-view.ts`.

## What this change adds

1. **Trusted sender resolution** (`apps/runtime/native-authority/mail-sender.mjs`). Before this change the model had to supply the internal `senderConnectionId` and `clientId`, and only a thread's `nativeActions` gave it a sender. A brand-new email therefore had no sender.
   - The preparer now reads the actor's own Core sending mailboxes (`GET /api/engagement/mail/mailboxes` with the attended credential, after `readCurrent`).
   - It uses the one connected mailbox. If several are connected, it uses the one whose address the user named.
   - It refuses with a plain reason when no mailbox is connected, the named address is unknown, or the choice is ambiguous.
   - The client association is always the trusted selection.
2. **Model-facing projection** (`intents/schema.mjs` `mailInput`). The model gives only the message: mode, to, cc, bcc, subject, bodyHtml, files, original and an optional senderEmail. A proof shows the projection plus the trusted fields stays inside the canonical schema.
3. **Correctable refusals.** An invalid message (upper-case or duplicate address, multi-line subject) used to settle as UNKNOWN ("do not repeat"). It is now `INVALID_ARGUMENTS` with a field-path detail. The intent mount now keeps an owner's own detail over the schema's.
4. **Guidance** on the `propose_mail` tool:
   - draft, then propose;
   - reply or forward by copying a `mail.read_thread` native action;
   - attach client files using their `read_client_documents` proof;
   - never say "sent" before the provider accepts;
   - point the user to Settings when no mailbox is connected.
5. **Card** (frontend PR): internal ids are no longer shown, and failures are described in plain words.

## Release check

`governedIntents: true` in the worker capability policy is not enough. Before acceptance, confirm the live **control material** has both:

- `intents.enabled: true`;
- `intents.core` (origin and service secret).

Without `intents.core` the mail preparer is not composed, and `propose_mail` answers "not available".

The sender comes from Core `GET /api/engagement/mail/mailboxes`, read with the attended credential. This is Core's own send predicate: connected, owned by the user, token stored, address present.

## Acceptance plan (preview, connected Outlook or Gmail)

| # | Prompt | Expected card | Expected outcome after Approve |
|---|---|---|---|
| 1 | "Email jane.doe@example.com: thanks for today, I'll send the deck Friday." | Send an email. From: the connected address. To: jane.doe@example.com. Subject and short drafted body. No ids. | "Accepted by provider". The chat says it was sent once. A second Approve click or a reload does not send again. |
| 2 | "Draft a follow-up to the last email from <contact> and send it as a reply." | Meri reads the thread and proposes Mode: Reply to the original sender, with the original subject. | Reply lands in the same thread in the mailbox. |
| 3 | In a client conversation: "Send <contact> the latest <client> one-pager from our files." | Send an email with Attachments: the file name and size. | Message arrives with the attachment. |
| 4 | With two mailboxes connected: "Send a test email to me." | Meri asks which address to send from, then proposes with that sender. | Sent from the chosen mailbox. |
| 5 | Account with no connected mailbox: "Email bob@example.com hello." | No card. Meri says no mailbox is connected and to connect Outlook or Gmail in Settings, Connections. | Nothing sent. |

Reject path: on prompt 1, press Reject. The card shows "Rejected" and nothing is sent.
