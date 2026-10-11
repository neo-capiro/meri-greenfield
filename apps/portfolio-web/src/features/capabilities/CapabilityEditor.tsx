"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { TokenInput } from "@/shared/ui/TokenInput";
import { QueryState } from "@/shared/ui/QueryState";
import { type Capability } from "./contracts";
import { EntityDocuments } from "@/features/files/public";
import { useSaveCapability, useDeleteCapability } from "./queries";
export function CapabilityEditor({
  clientId,
  capability,
  open,
  onClose,
}: {
  clientId: string;
  capability?: Capability;
  open: boolean;
  onClose: () => void;
}) {
  const [tags, setTags] = useState(capability?.tags ?? []);
  const [pes, setPes] = useState(
    capability?.peNumbers.length
      ? capability.peNumbers
      : capability?.peNumber
        ? [capability.peNumber]
        : [],
  );
  const [keywords, setKeywords] = useState(capability?.keywords ?? []);
  const [trl, setTrl] = useState(capability?.trl ?? null);
  const [remove, setRemove] = useState(false);
  const save = useSaveCapability(clientId, onClose);
  const deletion = useDeleteCapability(clientId, onClose);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !save.isPending && !deletion.isPending) onClose();
      }}
      title={capability ? `Capability: ${capability.name}` : "New capability"}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          save.mutate({
            id: capability?.id,
            body: {
              name: String(form.get("name")).trim(),
              type: String(form.get("type")),
              sector: String(form.get("sector")) || null,
              description: String(form.get("description")),
              tags,
              issueCodes: capability?.issueCodes ?? [],
              trl,
              mrl: form.get("mrl") ? Number(form.get("mrl")) : null,
              peNumbers: pes,
              keywords,
              notes: String(form.get("notes") ?? ""),
            },
          });
        }}
      >
        <label>
          Name
          <input
            name="name"
            required
            defaultValue={capability?.name}
            autoFocus
            maxLength={300}
          />
        </label>
        <div className="grid two">
          <label>
            Type
            <input
              name="type"
              defaultValue={capability?.type ?? "product"}
              maxLength={120}
            />
          </label>
          <label>
            Sector
            <input
              name="sector"
              defaultValue={capability?.sector ?? ""}
              maxLength={120}
            />
          </label>
        </div>
        <fieldset>
          <legend>Technology Readiness Level · {trl ?? "Not set"}</legend>
          <div className="row">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((level) => (
              <button
                type="button"
                key={level}
                className={`button ${trl !== null && level <= trl ? "primary" : ""}`}
                aria-label={`TRL ${level}`}
                aria-pressed={trl === level}
                onClick={() => setTrl(level)}
              >
                {level}
              </button>
            ))}
            <button
              type="button"
              className="button ghost"
              onClick={() => setTrl(null)}
            >
              Clear TRL
            </button>
          </div>
        </fieldset>
        <label>
          Manufacturing Readiness Level
          <select name="mrl" defaultValue={capability?.mrl ?? ""}>
            <option value="">Not set</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        <TokenInput label="Tags" value={tags} onChange={setTags} />
        {capability && (
          <>
            <TokenInput label="PE numbers" value={pes} onChange={setPes} />
            <TokenInput
              label="Match keywords"
              value={keywords}
              onChange={setKeywords}
            />
          </>
        )}
        <TextareaField
          label="Description"
          name="description"
          defaultValue={capability?.description ?? ""}
          maxLength={20000}
        />
        <TextareaField
          label="Notes"
          name="notes"
          defaultValue={capability?.notes ?? ""}
          maxLength={20000}
        />
        {!capability && (
          <small>
            Save first to add PE numbers, match keywords and documents to the
            saved record.
          </small>
        )}
        <QueryState error={save.error} />
        <div className="formActions">
          {capability && (
            <button
              type="button"
              className="button ghost"
              onClick={() => setRemove(true)}
            >
              Remove capability
            </button>
          )}
          <button className="button primary" disabled={save.isPending}>
            {save.isPending
              ? "Saving…"
              : capability
                ? "Save capability"
                : "Add capability"}
          </button>
        </div>
      </form>
      {capability && (
        <EntityDocuments
          clientId={clientId}
          source={`capability:${capability.id}`}
        />
      )}
      <Dialog
        open={remove}
        onOpenChange={setRemove}
        title="Remove capability"
        description="Remove this capability from the client profile?"
      >
        <QueryState error={deletion.error} />
        <button
          className="button primary"
          disabled={deletion.isPending}
          onClick={() => {
            if (capability) deletion.mutate(capability.id);
          }}
        >
          Confirm remove
        </button>
      </Dialog>
    </Dialog>
  );
}
