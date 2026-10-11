"use client";
import { useState } from "react";
import { useFiles } from "@/features/files/public";
import { QueryState } from "@/shared/ui/QueryState";
import { previewOnlyDependency, sources, type Setup } from "./contracts";
import styles from "./enrichment.module.css";
export function ResearchSetup({
  clientId,
  setup,
}: {
  clientId: string;
  setup: Setup;
}) {
  const files = useFiles(clientId);
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <section className={styles.setup} aria-label="Research setup">
      <h3>Research sources</h3>
      <p className="muted">
        Saved website: {setup.website ?? "No website saved"}
      </p>
      <fieldset>
        <legend>Connected sources</legend>
        {Object.entries(sources).map(([id, label]) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={selected.includes(id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, id]
                    : selected.filter((s) => s !== id),
                )
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <p>
        Imported LDA identities:{" "}
        {setup.selectedIdentities.map((i) => i.name).join(", ") || "None"}.
        Additional identity selection is unavailable until it can be reviewed
        before saving.
      </p>
      <QueryState
        pending={files.isPending}
        error={files.error}
        retry={() => void files.refetch()}
      />
      {!files.error && files.data && (
        <details>
          <summary>
            Client documents (
            {files.data.filter((f) => f.clientId === clientId).length})
          </summary>
          <ul>
            {files.data
              .filter((f) => f.clientId === clientId)
              .map((f) => (
                <li key={f.id}>
                  {f.fileName} ·{" "}
                  {f.usable === false
                    ? "Unavailable"
                    : (f.extractionStatus ?? "Readiness unknown")}
                </li>
              ))}
          </ul>
          <p>
            Use the existing Files view to upload documents. No files are sent
            to research from this review.
          </p>
        </details>
      )}
      <p role="note">{previewOnlyDependency}</p>
      <button className="button primary" disabled>
        Start research unavailable
      </button>
    </section>
  );
}
