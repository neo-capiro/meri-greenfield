"use client";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { type Person } from "./contracts";
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
}: {
  person: Person;
  clientId: string;
  thread?: { id: string; subject: string };
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(
    thread ? `Re: ${thread.subject.replace(/^Re:\s*/i, "")}` : "",
  );
  const [body, setBody] = useState("");
  const [append, setAppend] = useState<boolean | null>(null);
  const [review, setReview] = useState(false);
  const [rewriteWarning, setRewriteWarning] = useState("");
  const send = useSendMail();
  const rewrite = useRewriteMail();
  const signature = useSignature();
  const signatureEnabled = append ?? signature.data?.enabled ?? false;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !send.isPending) onClose();
      }}
      title={thread ? "Reply" : "New email"}
      description="Sends through your own connected mailbox. Backend permissions and connection policy apply."
    >
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
            setReview(true);
          }}
        >
          <label>
            To
            <input
              value={`${person.name} <${person.email ?? "No email"}>`}
              readOnly
            />
          </label>
          <label>
            Subject
            <input
              required
              maxLength={300}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label>
            Message
            <textarea
              required
              maxLength={8000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
            />
          </label>
          <button
            type="button"
            className="button"
            disabled={rewrite.isPending || !body.trim()}
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
          <QueryState error={send.error} />
          {send.error && (
            <p role="alert">
              Delivery may be uncertain. Check your Sent Items before sending
              again.
            </p>
          )}
          <button
            className="button primary"
            disabled={
              !person.email ||
              send.isPending ||
              signature.isPending ||
              rewrite.isPending
            }
          >
            Review email
          </button>
        </form>
      )}
      <Dialog
        open={review}
        onOpenChange={(value) => {
          if (!send.isPending) setReview(value);
        }}
        title="Send email"
        description={`Send “${subject}” to ${person.email}?`}
      >
        <p style={{ whiteSpace: "pre-wrap" }}>{body}</p>
        {signatureEnabled && <small>Includes your saved signature.</small>}
        <QueryState error={send.error} />
        <button
          className="button primary"
          disabled={send.isPending || !person.email}
          onClick={() => {
            if (!person.email) return;
            send.mutate(
              {
                clientId,
                personIds: [person.id],
                to: [{ email: person.email, name: person.name }],
                subject: subject.trim(),
                bodyHtml: plainMailHtml(body),
                appendSignature: signatureEnabled,
                ...(thread ? { threadId: thread.id } : {}),
              },
              { onSuccess: () => setReview(false) },
            );
          }}
        >
          {send.isPending ? "Sending…" : "Send email"}
        </button>
      </Dialog>
    </Dialog>
  );
}
