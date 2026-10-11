"use client";
import { useState } from "react";
import { Temporal } from "temporal-polyfill";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useMemberOptions, memberName } from "@/features/portfolio/public";
import { useProspectNextStep } from "./mutations";
import type { Prospect } from "./contracts";
export function NextStepEditor({
  record,
  onClose,
}: {
  record: Prospect;
  onClose: () => void;
}) {
  const owners = useMemberOptions();
  const save = useProspectNextStep(record.id, onClose);
  const [validation, setValidation] = useState("");
  const zone = Temporal.Now.timeZoneId();
  const due = record.nextActionDueAt
    ? Temporal.Instant.from(record.nextActionDueAt)
        .toZonedDateTimeISO(zone)
        .toPlainDateTime()
        .toString({ smallestUnit: "minute" })
    : "";
  return (
    <Dialog
      open
      title="Next step & ownership"
      description={`Due times use ${zone}. Owner changes require an active tenant member.`}
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          try {
            const rawDue = String(form.get("due") ?? "");
            const nextActionDueAt = rawDue
              ? Temporal.PlainDateTime.from(rawDue)
                  .toZonedDateTime(zone, { disambiguation: "reject" })
                  .toInstant()
                  .toString()
              : null;
            setValidation("");
            save.mutate({
              nextAction: String(form.get("action") ?? "").trim() || null,
              nextActionDueAt,
              ownerUserId: String(form.get("owner") ?? "") || null,
            });
          } catch {
            setValidation(
              "Choose a valid, unambiguous local due date and time.",
            );
          }
        }}
      >
        <label>
          Next step
          <input
            name="action"
            maxLength={500}
            defaultValue={record.nextAction ?? ""}
            autoFocus
          />
        </label>
        <label>
          Due date & time
          <input name="due" type="datetime-local" defaultValue={due} />
        </label>
        <label>
          Prospect owner
          <select
            name="owner"
            defaultValue={record.ownerUserId ?? ""}
            disabled={!owners.isSuccess}
          >
            <option value="">Unassigned</option>
            {record.ownerUserId &&
              !owners.data?.some(
                (owner) => owner.id === record.ownerUserId,
              ) && (
                <option value={record.ownerUserId}>
                  Current owner (not in active options)
                </option>
              )}
            {owners.data?.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {memberName(owner)}
              </option>
            ))}
          </select>
        </label>
        <QueryState
          pending={owners.isPending}
          error={owners.error}
          retry={() => void owners.refetch()}
        />
        {validation && (
          <p className="danger" role="alert">
            {validation}
          </p>
        )}
        <QueryState error={save.error} />
        <button
          className="button primary"
          disabled={save.isPending || !owners.isSuccess}
        >
          Save next step & owner
        </button>
      </form>
    </Dialog>
  );
}
