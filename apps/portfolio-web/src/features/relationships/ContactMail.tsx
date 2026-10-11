"use client";
import { useState } from "react";
import { type MailContact } from "./email";
import { useContactThreads, useMailThread } from "./email";
import { MailCompose } from "./MailCompose";
import { QueryState } from "@/shared/ui/QueryState";
import { Dialog } from "@/shared/ui/Dialog";
export function ContactMail({
  clientId,
  person,
}: {
  clientId: string;
  person: MailContact;
}) {
  const query = useContactThreads(clientId, person.email);
  const [selected, setSelected] = useState<string | null>(null);
  const [compose, setCompose] = useState<"new" | "reply" | null>(null);
  const thread = useMailThread(selected);
  return (
    <section className="stack">
      <header className="row between">
        <h3>Message history</h3>
        <button
          className="button"
          disabled={!person.email}
          onClick={() => setCompose("new")}
        >
          Mail
        </button>
      </header>
      {person.email ? (
        <>
          <QueryState
            pending={query.isPending}
            error={query.error}
            retry={() => void query.refetch()}
          />
          {query.data?.map((item) => (
            <button
              className="button ghost"
              key={item.id}
              onClick={() => setSelected(item.id)}
            >
              <span>
                <strong>{item.subject}</strong>
                <p className="muted">{item.snippet}</p>
              </span>
            </button>
          ))}
          {query.data?.length === 0 && (
            <p className="muted">No accessible messages for this contact.</p>
          )}
          <small>
            Up to 50 recent client threads from your accessible mailbox. Open a
            thread to read its full message history.
          </small>
        </>
      ) : (
        <p className="muted">
          Add an email address to view mail for this contact.
        </p>
      )}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={thread.data?.subject ?? "Mail thread"}
        drawer
      >
        <QueryState
          pending={thread.isPending}
          error={thread.error}
          retry={() => void thread.refetch()}
        />
        {thread.data?.messages.map((message) => (
          <article className="card stack" key={message.id}>
            <strong>
              {message.fromName ?? message.fromEmail ?? "Unknown sender"}
            </strong>
            <small>
              {new Date(
                message.sentAt ?? message.receivedAt ?? message.createdAt,
              ).toLocaleString()}
            </small>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {message.bodyText ?? "Message text is not available."}
            </p>
          </article>
        ))}
        {thread.data && (
          <button className="button" onClick={() => setCompose("reply")}>
            Reply to {person.name}
          </button>
        )}
      </Dialog>
      {compose && (
        <MailCompose
          key={`${compose}:${selected}`}
          clientId={clientId}
          person={person}
          thread={
            compose === "reply" && thread.data
              ? { id: thread.data.id, subject: thread.data.subject }
              : undefined
          }
          onClose={() => setCompose(null)}
        />
      )}
    </section>
  );
}
