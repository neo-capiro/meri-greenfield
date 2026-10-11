import { QueryState } from "@/shared/ui/QueryState";
import type { FrozenImport } from "./useImportAttempt";
import type { observedSelection } from "./domain";
import styles from "./registrant.module.css";
export function ImportRecovery({
  frozen,
  observed,
  error,
  reading,
  disabled,
  onReadback,
}: {
  frozen: FrozenImport;
  observed?: ReturnType<typeof observedSelection>;
  error?: Error;
  reading: boolean;
  disabled: boolean;
  onReadback: () => void;
}) {
  return (
    <section className={styles.body} aria-label="Unconfirmed import">
      <h3>Import completion is unconfirmed</h3>
      <p role="alert">
        Some clients may already have been created. This selection is frozen; do
        not repeat the import. Read back the linked firm’s current client state.
      </p>
      <p>Original LDA client IDs: {frozen.ids.join(", ")}</p>
      <button className="button" disabled={disabled} onClick={onReadback}>
        {reading ? "Checking…" : "Check current client state"}
      </button>
      <QueryState error={error} />
      {observed && (
        <>
          <p className="muted">
            Observed now; this is not the original import receipt. A client not
            yet observed may still finish importing.
          </p>
          <ul className={styles.list}>
            {observed.map((row) => (
              <li className={styles.row} key={row.ldaClientId}>
                LDA client {row.ldaClientId}:{" "}
                {row.onboardedAs === null
                  ? "Not observed as imported"
                  : `Currently linked to ${row.onboardedAs}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
