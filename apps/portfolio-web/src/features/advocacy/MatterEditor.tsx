"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { useSaveMatter } from "./mutations";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { matterTypes, type Matter } from "./contracts";
import { useAdvocacyAccess } from "./access";
export function MatterEditor({
  clientId,
  open,
  onOpenChange,
  matter,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matter?: Matter;
}) {
  const { canEdit } = useAdvocacyAccess();
  const mutation = useSaveMatter(clientId, matter?.id, () =>
    onOpenChange(false),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) onOpenChange(value);
      }}
      title={matter ? "Edit matter" : "New matter"}
      description="Group this client's advocacy records around a matter."
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canEdit || mutation.isPending) return;
          const form = new FormData(event.currentTarget);
          mutation.mutate({
            title: String(form.get("title")).trim(),
            summary: String(form.get("summary")).trim(),
            ...(matter
              ? { status: form.get("status") }
              : { matterType: form.get("matterType") }),
          });
        }}
      >
        <label>
          Title
          <input
            name="title"
            required
            maxLength={300}
            defaultValue={matter?.title}
            autoFocus
          />
        </label>
        {!matter && (
          <label>
            Matter type
            <select name="matterType">
              {Object.entries(matterTypes).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {matter && (
          <label>
            Status
            <select name="status" defaultValue={matter.status}>
              {[
                ...new Set([
                  matter.status,
                  "planning",
                  "active",
                  "monitoring",
                  "outcome_observed",
                  "withdrawn",
                  "archived",
                ]),
              ].map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        )}
        <TextareaField
          label="Summary"
          name="summary"
          maxLength={4000}
          defaultValue={matter?.summary ?? ""}
        />
        <QueryState error={mutation.error} />
        {!canEdit && (
          <p className="status">
            Your current role cannot save advocacy matters.
          </p>
        )}
        <button
          className="button primary"
          disabled={!canEdit || mutation.isPending}
        >
          {mutation.isPending
            ? "Saving…"
            : matter
              ? "Save matter"
              : "Create matter"}
        </button>
      </form>
    </Dialog>
  );
}
