"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { useLogActivity } from "./mutations";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
export function QuickLog({
  clientId,
  clientName,
  open,
  onOpenChange,
  personId,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId?: string;
}) {
  const mutation = useLogActivity(clientId, () => onOpenChange(false));
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) onOpenChange(value);
      }}
      title="Quick log"
      description={`Record activity for ${clientName}.`}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          mutation.mutate({
            kind: form.get("kind"),
            title: String(form.get("title")).trim(),
            body: String(form.get("body")).trim(),
            ...(personId ? { personId } : {}),
          });
        }}
      >
        <label>
          Activity type
          <select name="kind">
            <option value="note">Note</option>
            <option value="call">Call</option>
            <option value="email">Logged email</option>
            <option value="decision">Decision</option>
            <option value="request">Request</option>
          </select>
        </label>
        <label>
          Title
          <input name="title" required maxLength={300} autoFocus />
        </label>
        <TextareaField label="Details" name="body" maxLength={5000} />
        <small>Logged email records history; it does not send a message.</small>
        <QueryState error={mutation.error} />
        <div className="formActions">
          <button className="button primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save activity"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
