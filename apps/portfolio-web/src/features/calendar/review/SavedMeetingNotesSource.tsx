"use client";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { SelectField } from "@/shared/ui/SelectField";
import type { ReviewMeeting, SavedNotesSource } from "./contracts";
import { useSavedMeetingNotes } from "./useSavedMeetingNotes";
import styles from "./review.module.css";

export function SavedMeetingNotesSource(props: {
  meeting: ReviewMeeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (source: SavedNotesSource) => boolean;
}) {
  return props.open ? (
    <SourceReview
      key={`${props.meeting.id}:${props.meeting.client?.id ?? "private"}`}
      {...props}
    />
  ) : null;
}
function SourceReview({
  meeting,
  open,
  onOpenChange,
  onGenerate,
}: Parameters<typeof SavedMeetingNotesSource>[0]) {
  const review = useSavedMeetingNotes(meeting, open);
  const readable =
    review.query.data?.filter(
      (note) => !note.restricted && Boolean(note.body?.trim()),
    ) ?? [];
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!review.pending) onOpenChange(value);
      }}
      title="Use saved meeting notes"
      description="Review the meeting’s own notes as the source for a generated debrief."
      className={styles.dialog}
    >
      <QueryState
        pending={
          review.identity.isPending ||
          review.capabilities.isPending ||
          review.query.isFetching
        }
        error={
          review.identity.error ??
          review.query.error ??
          review.capabilities.error
        }
        retry={() => {
          void review.query.refetch();
          void review.capabilities.refetch();
        }}
      />
      {review.allowed && !review.query.error && (
        <>
          <SelectField
            label="Saved note"
            value={review.selected?.id ?? ""}
            disabled={review.pending || review.query.isFetching}
            onChange={(event) =>
              review.setSelected(
                readable.find((note) => note.id === event.target.value),
              )
            }
          >
            <option value="">Choose a saved note</option>
            {readable.map((note) => (
              <option value={note.id} key={note.id}>
                {new Date(note.createdAt).toLocaleString()} ·{" "}
                {note.confidential ? "Confidential" : "Meeting note"}
              </option>
            ))}
          </SelectField>
          {!review.query.isPending && readable.length === 0 && (
            <p role="status">
              No readable saved notes are available for this meeting.
            </p>
          )}
          {review.selected && (
            <section aria-label="Selected saved note" className={styles.source}>
              <h3>Meeting Notes</h3>
              <p>{review.selected.body}</p>
            </section>
          )}
        </>
      )}
      {!review.ready && !review.identity.isPending && (
        <p role="note">
          A current authorized session and enabled generation service are
          required. No note is submitted automatically.
        </p>
      )}
      <p className="muted">
        The service does not identify which saved notes were created by Meri.
        Choose and review the exact note. This action generates a draft; saving,
        approval and sharing remain separate.
      </p>
      <QueryState error={review.error} />
      <footer className={styles.actions}>
        <button
          className="button"
          disabled={review.pending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </button>
        <button
          className="button"
          disabled={
            review.pending || review.query.isFetching || !review.allowed
          }
          onClick={() => {
            review.setSelected(undefined);
            void review.query.refetch();
          }}
        >
          Refresh notes
        </button>
        <button
          className="button primary"
          disabled={!review.ready || !review.selected || review.pending}
          onClick={() =>
            void review.generate(onGenerate).then((accepted) => {
              if (accepted) onOpenChange(false);
            })
          }
        >
          {review.pending ? "Checking saved note…" : "Generate Debrief"}
        </button>
      </footer>
    </Dialog>
  );
}
