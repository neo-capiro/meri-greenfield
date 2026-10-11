"use client";
import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import {
  portfolioStages,
  isPortfolioStage,
  stageLabel,
  prospectListSchema,
  type Prospect,
  type StageCatalog,
} from "./contracts";
import type { z } from "zod";
import { StageEditor } from "./StageEditor";
import styles from "./prospects.module.css";
type PipelineData = z.infer<typeof prospectListSchema>;
export function ProspectPipeline({
  data,
  catalog,
  error,
  onClose,
}: {
  data: PipelineData;
  catalog: StageCatalog | null | undefined;
  error: Error | null;
  onClose: () => void;
}) {
  const [moving, setMoving] = useState<{ record: Prospect; stage?: string }>();
  const [dragId, setDragId] = useState<string>();
  const legacy = data.prospects.filter((row) => !isPortfolioStage(row.stage));
  function card(record: Prospect) {
    const canMove = Boolean(
      catalog &&
      (isPortfolioStage(record.stage) || catalog.allowLegacyTransitions),
    );
    return (
      <article
        className={styles.pipelineCard}
        key={record.id}
        draggable={canMove}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", record.id);
          setDragId(record.id);
        }}
        onDragEnd={() => setDragId(undefined)}
      >
        <div className="row between">
          <span className="eyebrow">Prospect</span>
          {canMove && <img src="/design/411-44335-imgDragHandle.svg" alt="" />}
        </div>
        <h3>
          <Link href={`/portfolio/prospects/${record.id}`}>
            {record.displayName}
          </Link>
        </h3>
        {record.nextAction && <p>{record.nextAction}</p>}
        <div className="row between">
          <small>{stageLabel(record.stage)}</small>
          <button
            className="button ghost"
            disabled={!canMove}
            onClick={() => setMoving({ record })}
          >
            Change stage
          </button>
        </div>
      </article>
    );
  }
  return (
    <>
      <Dialog
        open
        wide
        title="Prospects pipeline"
        description="Stages and counts for the current filters. Move a card or choose Change stage to review the update."
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        {!catalog && (
          <p role="status">
            Stage updates are unavailable. You can open prospects to edit
            company details and next steps.
          </p>
        )}
        <QueryState error={error} />
        {data.counts.visible > data.prospects.length && (
          <p role="status">
            Showing the latest {data.prospects.length} of {data.counts.visible}{" "}
            matching prospects. Counts include all matches.
          </p>
        )}
        <div className={styles.pipeline} aria-label="Pipeline stages">
          {portfolioStages.map((stage) => (
            <section
              className={styles.pipelineColumn}
              key={stage}
              onDragOver={(event) => {
                if (dragId) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const record = data.prospects.find(
                  (row) =>
                    row.id === dragId &&
                    row.id === event.dataTransfer.getData("text/plain"),
                );
                if (record && record.stage !== stage)
                  setMoving({ record, stage });
                setDragId(undefined);
              }}
            >
              <header className="row between">
                <h3>{stageLabel(stage)}</h3>
                <span className="chip">{data.counts.byStage[stage] ?? 0}</span>
              </header>
              {data.prospects.filter((row) => row.stage === stage).map(card)}
              {!data.prospects.some((row) => row.stage === stage) && (
                <p className="empty">No loaded prospects</p>
              )}
            </section>
          ))}
          {legacy.length > 0 && (
            <section className={styles.pipelineColumn}>
              <header>
                <h3>Previous stages</h3>
                <p className="muted">
                  Existing stage values are preserved until migration.
                </p>
              </header>
              {legacy.map(card)}
            </section>
          )}
        </div>
        <footer className="row between">
          <span>{data.counts.dismissed} archived in these filters</span>
          <span className="muted">Pipeline value and win rate unavailable</span>
        </footer>
      </Dialog>
      {moving && (
        <StageEditor
          record={moving.record}
          catalog={catalog}
          initialStage={moving.stage}
          onClose={() => setMoving(undefined)}
        />
      )}
    </>
  );
}
