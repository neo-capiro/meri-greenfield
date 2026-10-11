"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useAddAdvocacyRecord } from "./mutations";
import { useAdvocacyAccess } from "./access";
export function RecordDialog({
  clientId,
  matterId,
  onClose,
}: {
  clientId: string;
  matterId: string | null;
  onClose: () => void;
}) {
  const mutation = useAddAdvocacyRecord(clientId, onClose);
  const { canEdit } = useAdvocacyAccess();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title="Add advocacy record"
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canEdit || mutation.isPending) return;
          const form = new FormData(event.currentTarget);
          const date = String(form.get("activityDate"));
          mutation.mutate({
            ...(matterId ? { matterId } : {}),
            recordType: form.get("recordType"),
            title: String(form.get("title")).trim(),
            summary: form.get("summary"),
            ...(date ? { activityDate: new Date(date).toISOString() } : {}),
          });
        }}
      >
        <label>
          Record type
          <select name="recordType" disabled={!canEdit || mutation.isPending}>
            {[
              "advocacy_ask",
              "meeting",
              "submission",
              "congressional_request",
              "regulatory_comment",
              "testimony",
              "outreach",
              "government_action",
              "outcome",
              "other",
            ].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input
            name="title"
            required
            maxLength={500}
            disabled={!canEdit || mutation.isPending}
          />
        </label>
        <label>
          Date and time (your browser time zone)
          <input
            name="activityDate"
            type="datetime-local"
            disabled={!canEdit || mutation.isPending}
          />
        </label>
        <TextareaField
          label="Summary"
          name="summary"
          maxLength={4000}
          disabled={!canEdit || mutation.isPending}
        />
        {!canEdit && (
          <p className="status">
            Your current role cannot add advocacy records.
          </p>
        )}
        <QueryState error={mutation.error} />
        <button
          className="button primary"
          disabled={!canEdit || mutation.isPending}
        >
          {mutation.isPending ? "Saving…" : "Save record"}
        </button>
      </form>
    </Dialog>
  );
}
