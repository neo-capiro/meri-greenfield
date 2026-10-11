"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { contactInput, type Person } from "./contracts";
import { usePersonMutation } from "./mutations";
import { HierarchyEditor } from "./HierarchyEditor";
import { ContactMail } from "./ContactMail";
import { QuickLog } from "@/features/client-profile/public";
export function ContactDrawer({
  clientId,
  person,
  people,
  open,
  onClose,
}: {
  clientId: string;
  person?: Person;
  people: Person[];
  open: boolean;
  onClose: () => void;
}) {
  const [validation, setValidation] = useState("");
  const [remove, setRemove] = useState(false);
  const [note, setNote] = useState(false);
  const mutation = usePersonMutation(clientId, onClose);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !mutation.isPending) onClose();
      }}
      title={person?.name ?? "Add contact"}
      drawer
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const result = contactInput.safeParse(
            Object.fromEntries(new FormData(event.currentTarget)),
          );
          if (!result.success) {
            setValidation(
              result.error.issues[0]?.message ?? "Check the contact details.",
            );
            return;
          }
          setValidation("");
          mutation.mutate({
            kind: "save",
            id: person?.id,
            body: { ...result.data, email: result.data.email || null },
          });
        }}
      >
        <label>
          Name
          <input
            name="name"
            required
            maxLength={300}
            defaultValue={person?.name ?? ""}
            autoFocus
          />
        </label>
        <p className="muted">
          Saved titles may describe current or historical roles. Verify changes
          against a dated source; keep former roles and the source in Notes.
        </p>
        <label>
          Title
          <input
            name="title"
            maxLength={300}
            defaultValue={person?.title ?? ""}
          />
        </label>
        <div className="grid two">
          <label>
            Email
            <input
              type="email"
              name="email"
              defaultValue={person?.email ?? ""}
            />
          </label>
          <label>
            Phone
            <input
              name="phone"
              maxLength={120}
              defaultValue={person?.phone ?? ""}
            />
          </label>
        </div>
        <label>
          Role
          <input
            name="role"
            maxLength={300}
            defaultValue={person?.role ?? ""}
          />
        </label>
        <TextareaField
          label="Notes"
          name="notes"
          maxLength={20000}
          defaultValue={person?.notes ?? ""}
        />
        {validation && <p role="alert">{validation}</p>}
        <QueryState error={mutation.error} />
        <div className="formActions">
          {person && (
            <button
              type="button"
              className="button ghost"
              onClick={() => setRemove(true)}
            >
              Remove
            </button>
          )}
          <button className="button primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save contact"}
          </button>
        </div>
      </form>
      {person && (
        <>
          <HierarchyEditor
            key={`${person.id}:${person.placementSource}:${person.hierarchyLevel}:${person.reportsToPersonId}`}
            clientId={clientId}
            person={person}
            people={people}
          />
          <button className="button" onClick={() => setNote(true)}>
            Log note
          </button>
          <ContactMail
            clientId={clientId}
            person={{ ...person, personId: person.id }}
          />
          <QuickLog
            clientId={clientId}
            clientName={person.name}
            personId={person.id}
            open={note}
            onOpenChange={setNote}
          />
          <Dialog
            open={remove}
            onOpenChange={setRemove}
            title="Remove contact"
            description={`Remove ${person.name} from this client's roster?`}
          >
            <QueryState error={mutation.error} />
            <button
              className="button primary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ kind: "delete", id: person.id })}
            >
              Confirm remove
            </button>
          </Dialog>
        </>
      )}
    </Dialog>
  );
}
