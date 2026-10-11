"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { useSaveObjective } from "./mutations";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { ApiError } from "@/shared/api/http";
import {
  askTypes,
  emptyFields,
  objectiveFieldsSchema,
  statusLabels,
  type Objective,
  type ObjectiveFields,
} from "./contracts";
type Action = "save" | "request_review" | "confirm_ready";
export function ObjectiveEditor({
  clientId,
  objective,
  open,
  onOpenChange,
}: {
  clientId: string;
  objective?: Objective;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [record, setRecord] = useState(objective);
  const [fields, setFields] = useState<ObjectiveFields>(
    objective ?? emptyFields,
  );
  const [requestId] = useState(() => crypto.randomUUID());
  const [validation, setValidation] = useState("");
  const [confirming, setConfirming] = useState(false);
  const mutation = useSaveObjective(
    clientId,
    { fields, record, requestId },
    setRecord,
    () => onOpenChange(false),
  );
  const ready = Boolean(
    fields.outcome.trim() &&
    fields.governmentProblem.trim() &&
    fields.askType &&
    fields.minimumWin.trim(),
  );
  function submit(action: Action) {
    const parsed = objectiveFieldsSchema.safeParse(fields);
    if (!parsed.success) {
      setValidation(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    if (action !== "save" && !ready) {
      setValidation(
        "Complete outcome, government problem, ask type and minimum win.",
      );
      return;
    }
    setValidation("");
    if (action === "confirm_ready") setConfirming(true);
    else mutation.mutate(action);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) onOpenChange(value);
      }}
      title={objective ? "Edit objective" : "New objective"}
      description="Define the outcome and the government action that would make a meaningful win."
      drawer
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          submit("save");
        }}
      >
        <div className="row">
          <span className="chip">
            {record ? statusLabels[record.status] : "Draft"}
          </span>
          <small>Four required fields before review or ready.</small>
        </div>
        <TextareaField
          label="Outcome"
          hint="What should be different?"
          autoFocus
          maxLength={2000}
          value={fields.outcome}
          onChange={(e) => setFields({ ...fields, outcome: e.target.value })}
        />
        <TextareaField
          label="Government problem"
          hint="What must government solve?"
          maxLength={4000}
          value={fields.governmentProblem}
          onChange={(e) =>
            setFields({ ...fields, governmentProblem: e.target.value })
          }
        />
        <label>
          Ask type
          <select
            value={fields.askType ?? ""}
            onChange={(e) => {
              const parsed = objectiveFieldsSchema.shape.askType.safeParse(
                e.target.value || null,
              );
              if (parsed.success)
                setFields({ ...fields, askType: parsed.data });
            }}
          >
            <option value="">Choose an ask type</option>
            {Object.entries(askTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <TextareaField
          label="Minimum win"
          hint="What is the smallest result that matters?"
          maxLength={2000}
          value={fields.minimumWin}
          onChange={(e) => setFields({ ...fields, minimumWin: e.target.value })}
        />
        <TextareaField
          label="Limits"
          hint="Optional boundaries and constraints"
          maxLength={4000}
          value={fields.limits}
          onChange={(e) => setFields({ ...fields, limits: e.target.value })}
        />
        {record?.status !== "draft" && record && (
          <small>Saving changes reopens this objective as a draft.</small>
        )}
        {validation && (
          <p className="danger" role="alert">
            {validation}
          </p>
        )}
        <QueryState error={mutation.error} />
        {mutation.error instanceof ApiError &&
          mutation.error.status === 409 && (
            <p>
              Another change conflicts with this version. Close and reopen the
              objective to review the latest version before saving.
            </p>
          )}
        <div className="formActions">
          <button className="button" disabled={mutation.isPending}>
            Save draft
          </button>
          <button
            className="button"
            type="button"
            disabled={mutation.isPending}
            onClick={() => submit("request_review")}
          >
            Request review
          </button>
          <button
            className="button primary"
            type="button"
            disabled={mutation.isPending}
            onClick={() => submit("confirm_ready")}
          >
            Confirm ready
          </button>
        </div>
        {mutation.isPending && <p role="status">Saving objective…</p>}
      </form>
      <Dialog
        open={confirming}
        onOpenChange={(value) => {
          if (!mutation.isPending) setConfirming(value);
        }}
        title="Confirm objective ready"
        description="Outcome, government problem, ask type and minimum win are complete."
      >
        <p>
          This confirms the objective is ready. Editing it later reopens the
          draft.
        </p>
        <div className="formActions">
          <button
            className="button"
            disabled={mutation.isPending}
            onClick={() => setConfirming(false)}
          >
            Back
          </button>
          <button
            className="button primary"
            disabled={mutation.isPending}
            onClick={() => {
              setConfirming(false);
              mutation.mutate("confirm_ready");
            }}
          >
            Confirm ready
          </button>
        </div>
      </Dialog>
    </Dialog>
  );
}
