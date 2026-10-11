"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { useSaveProfileNotes } from "./mutations";
import { useIdentity, canAdminister } from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useClient } from "@/features/portfolio/public";
export function NotesDialog({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useClient(clientId);
  const identity = useIdentity();
  const editable = canAdminister(identity.data?.role);
  const mutation = useSaveProfileNotes(clientId, () => onOpenChange(false));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Profile notes">
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(
            String(new FormData(event.currentTarget).get("notes")),
          );
        }}
      >
        <TextareaField
          label="Notes"
          name="notes"
          defaultValue={client.data?.intakeData?.profileNotes ?? ""}
          readOnly={!editable}
          rows={12}
          maxLength={20000}
        />
        {!editable && (
          <small>
            Editing profile notes requires an administrator. Use Quick log to
            record new activity.
          </small>
        )}
        <QueryState error={mutation.error} />
        {editable && (
          <button className="button primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save notes"}
          </button>
        )}
      </form>
    </Dialog>
  );
}
