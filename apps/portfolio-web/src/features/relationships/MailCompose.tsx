"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { useState } from "react";
import { RecipientFields } from "./email/RecipientFields";
import { AttachmentFields } from "./email/AttachmentFields";
import { useMailAttachments } from "./email/useMailAttachments";
import { useMailAuthority } from "./email/authority";
import { recipients, type Recipient } from "./email/recipients";
import { MailSendError, type SendInput } from "./email/send";
import styles from "./email/email.module.css";
import type { MailInitialDraft } from "./email/draft";
export type { MailInitialDraft } from "./email/draft";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { type MailContact } from "./email";
import {
  plainMailHtml,
  useSendMail,
  useSignature,
  useRewriteMail,
} from "./email";
export function MailCompose({
  person,
  clientId,
  thread,
  onClose,
  initialDraft,
  sendBlockedReason,
}: {
  person: MailContact;
  clientId: string;
  thread?: { id: string; subject: string };
  onClose: () => void;
  initialDraft?: MailInitialDraft;
  /** A verified contract gap: review is available, dispatch/upload/rewrite are not. */
  sendBlockedReason?: string;
}) {
  const [subject, setSubject] = useState(
    initialDraft?.subject ??
      (thread ? `Re: ${thread.subject.replace(/^Re:\s*/i, "")}` : ""),
  );
  const [body, setBody] = useState(initialDraft?.body ?? "");
  const [append, setAppend] = useState<boolean | null>(null);
  const [review, setReview] = useState<{
    input: SendInput;
    text: string;
  } | null>(null);
  const [to, setTo] = useState<Recipient[]>(
    initialDraft?.to ??
      (person.email
        ? [
            {
              email: person.email.trim().toLowerCase(),
              name: person.name,
              ...(person.personId ? { personId: person.personId } : {}),
            },
          ]
        : []),
  );
  const [cc, setCc] = useState(
    initialDraft?.cc?.map((item) => item.email).join(", ") ?? "",
  );
  const [bcc, setBcc] = useState("");
  const [validation, setValidation] = useState("");
  const [rewriteWarning, setRewriteWarning] = useState("");
  const send = useSendMail(clientId);
  const rewrite = useRewriteMail();
  const signature = useSignature();
  const authority = useMailAuthority(clientId);
  const attachments = useMailAttachments(clientId, initialDraft?.attachments);
  const uncertain = send.error instanceof MailSendError && send.error.uncertain;
  const locked = send.isPending || attachments.busy || uncertain;
  const signatureEnabled = append ?? signature.data?.enabled ?? false;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !send.isPending && !attachments.busy) onClose();
      }}
      title={thread ? "Reply" : "New email"}
      description={
        sendBlockedReason
          ? "Review this reply. Sending is unavailable for this thread."
          : "Sends through your own connected mailbox. Backend permissions and connection policy apply."
      }
    >
      {sendBlockedReason && <p role="note">{sendBlockedReason}</p>}
      {send.isSuccess ? (
        <div className="stack">
          <p role="status">Email sent.</p>
          <button className="button primary" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (locked || !authority.ready || attachments.blocked) return;
            try {
              const selected = recipients(to, cc, bcc);
              const personIds = selected.to.flatMap((item) =>
                item.personId ? [item.personId] : [],
              );
              setValidation("");
              setReview({
                text: body,
                input: {
                  clientId,
                  ...(personIds.length ? { personIds } : {}),
                  ...selected,
                  subject: subject.trim(),
                  bodyHtml: plainMailHtml(body),
                  appendSignature: signatureEnabled,
                  attachmentIds: attachments.ids,
                  ...(thread ? { threadId: thread.id } : {}),
                },
              });
            } catch (error) {
              setValidation(
                error instanceof Error && !error.message.startsWith("[")
                  ? error.message
                  : "Enter valid, unique recipient addresses. To allows 1–50; Cc and Bcc allow up to 10 each.",
              );
            }
          }}
        >
          <RecipientFields
            clientId={clientId}
            to={to}
            onTo={setTo}
            cc={cc}
            onCc={setCc}
            bcc={bcc}
            onBcc={setBcc}
            disabled={locked}
          />
          <label>
            Subject
            <input
              required
              maxLength={300}
              value={subject}
              disabled={locked}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <TextareaField
            label="Message"
            required
            maxLength={8000}
            value={body}
            disabled={locked}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
          />
          <button
            type="button"
            className="button"
            disabled={
              locked ||
              !authority.ready ||
              rewrite.isPending ||
              !body.trim() ||
              Boolean(sendBlockedReason)
            }
            onClick={async () => {
              const result = await rewrite
                .mutateAsync({
                  rawText: body,
                  recipientName: person.name,
                  ...(person.title ? { recipientTitle: person.title } : {}),
                })
                .catch(() => null);
              if (result) {
                const document = new DOMParser().parseFromString(
                  result.bodyHtml,
                  "text/html",
                );
                document
                  .querySelectorAll("script,style")
                  .forEach((node) => node.remove());
                document
                  .querySelectorAll("p,div,li,br")
                  .forEach((node) => node.append("\n"));
                setBody(document.body.textContent?.trim() ?? body);
                setRewriteWarning(
                  result.verified
                    ? ""
                    : "Meri could not verify the rewrite. Your original content was retained.",
                );
              }
            }}
          >
            {" "}
            {rewrite.isPending ? "Rewriting…" : "Rewrite with Meri"}
          </button>
          {rewriteWarning && <p role="status">{rewriteWarning}</p>}
          <QueryState error={rewrite.error ?? signature.error} />
          <label className="row">
            <input
              type="checkbox"
              disabled={!signature.data?.html}
              checked={signatureEnabled}
              onChange={(e) => setAppend(e.target.checked)}
            />
            Append my saved signature
          </label>
          <small>
            {signature.data?.html
              ? "Your saved signature is appended by the server."
              : "No saved signature is available."}
          </small>
          {!sendBlockedReason && (
            <AttachmentFields
              state={attachments}
              disabled={send.isPending || uncertain || !authority.ready}
            />
          )}
          {validation && <p role="alert">{validation}</p>}
          {!authority.ready && (
            <p role="alert">
              A verified mailbox session is required before sending or
              uploading.
            </p>
          )}
          <QueryState error={authority.error} />
          <QueryState error={send.error} />
          {uncertain && (
            <p role="alert">
              Delivery may be uncertain. Check your Sent Items before sending
              again. This attempt cannot be retried here.
            </p>
          )}
          <button
            className="button primary"
            disabled={
              !to.length ||
              locked ||
              !authority.ready ||
              attachments.blocked ||
              signature.isPending ||
              rewrite.isPending
            }
          >
            Review email
          </button>
        </form>
      )}
      <Dialog
        open={Boolean(review)}
        onOpenChange={(value) => {
          if (!value && !send.isPending) setReview(null);
        }}
        title={sendBlockedReason ? "Review reply" : "Send email"}
        description={
          sendBlockedReason
            ? `Review “${review?.input.subject ?? ""}”. Sending is unavailable here.`
            : `Send “${review?.input.subject ?? ""}” through your connected mailbox?`
        }
      >
        {review && (
          <div className="stack">
            {sendBlockedReason && <p role="note">{sendBlockedReason}</p>}
            <p>To: {review.input.to.map((item) => item.email).join(", ")}</p>
            {Boolean(review.input.cc?.length) && (
              <p>Cc: {review.input.cc?.map((item) => item.email).join(", ")}</p>
            )}
            {Boolean(review.input.bcc?.length) && (
              <p>
                Bcc: {review.input.bcc?.map((item) => item.email).join(", ")}
              </p>
            )}
            <p className={styles.review}>{review.text}</p>
            {!sendBlockedReason && (
              <small>
                {review.input.attachmentIds?.length ?? 0} attachment(s),
                rechecked before sending.
              </small>
            )}
            {review.input.appendSignature && (
              <small>Includes your saved signature.</small>
            )}
          </div>
        )}
        <QueryState error={send.error} />
        {uncertain && (
          <p role="alert">
            Sending may have completed. Check your mailbox Sent Items before
            starting another email. This reviewed attempt cannot be sent again.
          </p>
        )}
        <button
          className="button primary"
          disabled={
            send.isPending ||
            uncertain ||
            !authority.ready ||
            !review ||
            Boolean(sendBlockedReason)
          }
          onClick={() => {
            if (
              !review ||
              send.isPending ||
              uncertain ||
              !authority.ready ||
              sendBlockedReason
            )
              return;
            send.mutate(review.input, { onSuccess: () => setReview(null) });
          }}
        >
          {sendBlockedReason
            ? "Sending unavailable"
            : send.isPending
              ? "Sending…"
              : "Send email"}
        </button>
      </Dialog>
    </Dialog>
  );
}
