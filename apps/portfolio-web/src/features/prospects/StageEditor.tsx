"use client";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import {
  isPortfolioStage,
  stageLabel,
  type Prospect,
  type StageCatalog,
} from "./contracts";
import { useProspectStage } from "./mutations";
export function StageEditor({
  record,
  catalog,
  initialStage,
  onClose,
}: {
  record: Prospect;
  catalog: StageCatalog | null | undefined;
  initialStage?: string;
  onClose: () => void;
}) {
  const [stage, setStage] = useState(initialStage ?? record.stage);
  const save = useProspectStage(record, catalog, onClose);
  const available = Boolean(
    catalog &&
    (isPortfolioStage(record.stage) || catalog.allowLegacyTransitions),
  );
  return (
    <Dialog
      open
      title="Change prospect stage"
      description={record.displayName}
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (available && stage !== record.stage) save.mutate(stage);
        }}
      >
        <p>Current stage: {stageLabel(record.stage)}</p>
        {!available && (
          <p role="status">
            Stage updates are unavailable for this prospect. Its existing stage
            is preserved.
          </p>
        )}
        <label>
          New stage
          <select
            value={stage}
            disabled={!available || save.isPending}
            onChange={(event) => setStage(event.target.value)}
          >
            {!isPortfolioStage(record.stage) && (
              <option value={record.stage}>
                {stageLabel(record.stage)} (previous stage)
              </option>
            )}
            {catalog?.stages.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {(stage === "closed_won" || stage === "closed_lost") && (
          <p>
            Changing this stage records the outcome. Client conversion and
            billing require separate actions.
          </p>
        )}
        <QueryState error={save.error} />
        <button
          className="button primary"
          disabled={!available || save.isPending || stage === record.stage}
        >
          {save.isPending ? "Saving…" : "Confirm stage"}
        </button>
      </form>
    </Dialog>
  );
}
