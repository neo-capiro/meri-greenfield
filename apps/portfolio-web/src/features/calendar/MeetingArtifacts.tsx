"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { useChangeMeetingArtifact } from "./mutations";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useMeetingNotes } from "./queries";
import { type Meeting, type noteSchema } from "./contracts";
import type { z } from "zod";
import { DebriefGeneration } from "./debrief/public";
import { SavedMeetingDocumentPreview } from "./documents/public";
export function MeetingArtifacts({
  meeting,
  kind,
}: {
  meeting: Meeting;
  kind: "notes" | "debriefs";
}) {
  const query = useMeetingNotes(meeting.id, kind);
  const [editing, setEditing] = useState<{
    id?: string;
    body: string;
    confidential: boolean;
    generated?: boolean;
  }>();
  const [sharing, setSharing] = useState<string>();
  const [preview, setPreview] = useState<z.infer<typeof noteSchema>>();
  const mutation = useChangeMeetingArtifact(meeting.id, kind, () => {
    setEditing(undefined);
    setSharing(undefined);
  });
  const singular = kind === "notes" ? "note" : "debrief";
  return (
    <div className="stack">
      <div className="row between">
        <h3>{kind === "notes" ? "Meeting notes" : "Debriefs"}</h3>
        <button
          className="button"
          onClick={() => setEditing({ body: "", confidential: false })}
        >
          Add {singular}
        </button>
      </div>
      {kind === "debriefs" && (
        <DebriefGeneration
          meeting={meeting}
          onDraft={(body) =>
            setEditing({ body, confidential: false, generated: true })
          }
        />
      )}
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data?.map((item) => (
        <article className="card stack" key={item.id}>
          <div className="row between">
            <span className="chip">{item.status ?? "Draft"}</span>
            <small>
              {item.confidential
                ? "Confidential"
                : item.sharedAt
                  ? "Shared with client team"
                  : "Private"}
            </small>
          </div>
          {item.restricted ? (
            <p className="muted">You do not have access to this content.</p>
          ) : (
            <>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {item.body ?? "No content."}
              </p>
              <div className="row">
                {kind === "debriefs" && (
                  <button className="button" onClick={() => setPreview(item)}>
                    Export PDF
                  </button>
                )}
                <button
                  className="button"
                  disabled={mutation.isPending}
                  onClick={() =>
                    setEditing({
                      id: item.id,
                      body: item.body ?? "",
                      confidential: item.confidential,
                    })
                  }
                >
                  Edit
                </button>
                {item.status !== "approved" && (
                  <button
                    className="button"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        action: "approve",
                        id: item.id,
                      })
                    }
                  >
                    Approve
                  </button>
                )}
                {item.status === "approved" &&
                  meeting.client &&
                  !item.confidential &&
                  !item.sharedAt && (
                    <button
                      className="button"
                      disabled={mutation.isPending}
                      onClick={() => setSharing(item.id)}
                    >
                      Share
                    </button>
                  )}
                {item.sharedAt && (
                  <button
                    className="button"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        action: "unshare",
                        id: item.id,
                      })
                    }
                  >
                    Unshare
                  </button>
                )}
              </div>
            </>
          )}
        </article>
      ))}
      {query.data?.length === 0 && <p className="empty">No {kind} yet.</p>}
      {preview && (
        <SavedMeetingDocumentPreview
          meeting={meeting}
          document={{ kind: "debrief", debrief: preview }}
          onClose={() => setPreview(undefined)}
        />
      )}
      <QueryState error={mutation.error} />
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setEditing(undefined);
        }}
        title={
          editing?.generated
            ? "Review generated debrief"
            : `${editing?.id ? "Edit" : "Add"} ${singular}`
        }
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            mutation.mutate({
              action: "save",
              id: editing?.id,
              body: String(form.get("body")).trim(),
              confidential: form.get("confidential") === "on",
            });
          }}
        >
          <TextareaField
            label="Content"
            name="body"
            rows={12}
            required
            defaultValue={editing?.body}
          />
          <label className="row">
            <input
              type="checkbox"
              name="confidential"
              defaultChecked={editing?.confidential}
            />
            Confidential
          </label>
          <small>
            Edits require approval again. Saving does not send email.
          </small>
          <QueryState error={mutation.error} />
          <button className="button primary" disabled={mutation.isPending}>
            Save {singular}
          </button>
        </form>
      </Dialog>
      <Dialog
        open={Boolean(sharing)}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setSharing(undefined);
        }}
        title={`Share ${singular}`}
        description={`Share this approved ${singular} with the authorized team for ${meeting.client?.name ?? "this client"}.`}
      >
        <p>
          Confidential material cannot be shared. This does not send an email.
        </p>
        <QueryState error={mutation.error} />
        <button
          className="button primary"
          disabled={mutation.isPending}
          onClick={() => {
            if (sharing)
              mutation.mutate({
                action: "share",
                id: sharing,
              });
          }}
        >
          Share {singular}
        </button>
      </Dialog>
    </div>
  );
}
