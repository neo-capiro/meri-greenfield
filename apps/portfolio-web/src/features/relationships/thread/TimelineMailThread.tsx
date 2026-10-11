"use client";
import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIdentity } from "@/shared/auth/identity";
import { useApi } from "@/shared/api/provider";
import { QueryState } from "@/shared/ui/QueryState";
import { canManageContacts } from "../contact-api";
import { MailCompose, type MailInitialDraft } from "../MailCompose";
import { readTimelineThread, threadKey, type ThreadScope } from "./contracts";
import { replyRecipients } from "./recipients";
import { ThreadContent } from "./ThreadContent";
import styles from "./thread.module.css";

const replyGap =
  "Reply sending is unavailable here. You can review recipients and text, then reply from your mailbox.";
export function TimelineMailThread({
  clientId,
  threadId,
}: {
  clientId: string;
  threadId: string;
}) {
  const identity = useIdentity();
  const cache = useQueryClient();
  const owner = identity.data;
  const invalidated =
    identity.isStale && cache.getQueryState(["identity"])?.isInvalidated;
  const verified =
    identity.isSuccess &&
    !identity.isFetching &&
    !identity.error &&
    !invalidated &&
    Boolean(owner?.tenant?.id.trim() && owner.user.id.trim());
  if (!verified || !owner?.tenant)
    return (
      <QueryState
        pending={identity.isPending || identity.isFetching}
        error={identity.error}
      />
    );
  const scope = {
    tenantId: owner.tenant.id,
    userId: owner.user.id,
    clientId,
    threadId,
  };
  return (
    <ThreadSession
      key={JSON.stringify(threadKey(scope))}
      scope={scope}
      actorEmail={owner.user.email}
      canReply={canManageContacts(owner.role)}
    />
  );
}
function ThreadSession({
  scope,
  actorEmail,
  canReply,
}: {
  scope: ThreadScope;
  actorEmail: string | null;
  canReply: boolean;
}) {
  const api = useApi();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<MailInitialDraft | null>(null);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: threadKey(scope),
    enabled: expanded,
    queryFn: ({ signal }) => readTimelineThread(api, scope, signal),
  });
  const thread =
    query.isSuccess && !query.error && !query.isFetching
      ? query.data
      : undefined;
  function review(all: boolean) {
    if (!thread || !canReply) return;
    try {
      const recipients = replyRecipients(thread, actorEmail, all);
      setError("");
      setDraft({
        subject: `Re: ${thread.subject.replace(/^Re:\s*/i, "")}`,
        to: recipients.to,
        cc: recipients.cc,
      });
    } catch (error) {
      setError(
        error instanceof Error && !error.message.startsWith("[")
          ? error.message
          : "Stored recipient data could not be verified. Review this message in your mailbox.",
      );
    }
  }
  return (
    <section className={styles.thread} aria-label="Synced email thread">
      {!expanded ? (
        <button
          className="button ghost"
          aria-expanded={false}
          aria-controls={id}
          onClick={() => setExpanded(true)}
        >
          Expand email thread
        </button>
      ) : (
        <div id={id} className={styles.expanded}>
          <QueryState
            pending={query.isPending || query.isFetching}
            error={query.error}
            retry={() => void query.refetch()}
          />
          {thread && (
            <>
              <ThreadContent thread={thread} />
              <div className={styles.actions}>
                <small>
                  Synced email · {thread.messages.length} stored message
                  {thread.messages.length === 1 ? "" : "s"}
                </small>
                <button
                  className="button"
                  disabled={!canReply || !thread.messages.length}
                  onClick={() => review(false)}
                >
                  Reply
                </button>
                <button
                  className="button"
                  disabled={!canReply || !thread.messages.length}
                  onClick={() => review(true)}
                >
                  Reply all
                </button>
                <button
                  className="button ghost"
                  aria-expanded={true}
                  aria-controls={id}
                  onClick={() => setExpanded(false)}
                >
                  Show less
                </button>
              </div>
              <small className="muted">
                Stored active message text, newest first. This is not a live
                mailbox view.
              </small>
              {!canReply && (
                <small>Reply requires a permitted mailbox role.</small>
              )}
            </>
          )}
          {error && <p role="alert">{error}</p>}
          {!thread && (
            <button
              className="button ghost"
              aria-expanded={true}
              aria-controls={id}
              onClick={() => setExpanded(false)}
            >
              Show less
            </button>
          )}
        </div>
      )}
      {draft && thread && (
        <MailCompose
          clientId={scope.clientId}
          person={{
            name: draft.to?.[0]?.name ?? draft.to?.[0]?.email ?? "Recipient",
            email: draft.to?.[0]?.email ?? null,
            title: null,
          }}
          thread={{ id: thread.id, subject: thread.subject }}
          initialDraft={draft}
          onClose={() => setDraft(null)}
          sendBlockedReason={replyGap}
        />
      )}
    </section>
  );
}
