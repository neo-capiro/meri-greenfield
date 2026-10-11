"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { prospectInputSchema, type Prospect } from "./contracts";
import { useSaveProspect } from "./mutations";
import { useStageCatalog } from "./queries";
export function ProspectEditor({
  record,
  onClose,
  onSaved,
}: {
  record?: Prospect;
  onClose: () => void;
  onSaved: (record: Prospect) => void;
}) {
  const catalog = useStageCatalog();
  const save = useSaveProspect(record?.id, onSaved, catalog.data);
  const [validation, setValidation] = useState("");
  return (
    <Dialog
      open
      title={record ? "Edit company details" : "Add prospect"}
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const input = prospectInputSchema.safeParse(
            Object.fromEntries(new FormData(event.currentTarget)),
          );
          if (!input.success) {
            setValidation(
              input.error.issues.map((issue) => issue.message).join(" "),
            );
            return;
          }
          setValidation("");
          save.mutate(input.data);
        }}
      >
        <label>
          Company name
          <input
            name="displayName"
            required
            maxLength={200}
            defaultValue={record?.displayName}
            autoFocus
          />
        </label>
        <div className="formGrid">
          <label>
            Website
            <input
              name="website"
              maxLength={500}
              defaultValue={record?.website ?? ""}
            />
          </label>
          <label>
            Domain
            <input
              name="domain"
              maxLength={200}
              defaultValue={record?.domain ?? ""}
              placeholder="example.com"
            />
          </label>
        </div>
        <TextareaField
          label="Description"
          name="description"
          maxLength={4000}
          defaultValue={record?.description ?? ""}
        />
        <TextareaField
          label="Service hypothesis"
          name="serviceHypothesis"
          maxLength={4000}
          defaultValue={record?.serviceHypothesis ?? ""}
        />
        <label>
          Geography
          <input
            name="geography"
            maxLength={200}
            defaultValue={record?.geography ?? ""}
          />
        </label>
        {validation && (
          <p role="alert" className="danger">
            {validation}
          </p>
        )}
        {!record && !catalog.data && (
          <p role="status">
            Prospect creation is unavailable until the new pipeline stages are
            enabled. Company details can still be edited on existing prospects.
          </p>
        )}
        <QueryState error={save.error ?? (!record ? catalog.error : null)} />
        <div className="formActions">
          <button
            className="button primary"
            disabled={save.isPending || (!record && !catalog.data)}
          >
            {save.isPending
              ? "Saving…"
              : record
                ? "Save company details"
                : "Create prospect"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
