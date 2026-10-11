import { QueryState } from "@/shared/ui/QueryState";
import type { RegistrantHit } from "./contracts";
import styles from "./registrant.module.css";
export function FirmLinkConfirmation({
  choice,
  needsReadback,
  error,
  pending,
  disabled,
  onCancel,
  onConfirm,
  onRefresh,
}: {
  choice?: RegistrantHit;
  needsReadback: boolean;
  error: Error | null;
  pending: boolean;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onRefresh: () => void;
}) {
  return (
    <>
      {choice && (
        <section className={styles.confirm} aria-label="Confirm linked firm">
          <h3>Link {choice.name} to this firm?</h3>
          <p>
            This changes the LDA registrant for your entire firm. Existing
            client profiles are not removed.
          </p>
          <div className={styles.toolbar}>
            <button
              className="button"
              disabled={disabled || needsReadback}
              onClick={onCancel}
            >
              Keep looking
            </button>
            <button
              className="button primary"
              disabled={disabled || needsReadback}
              onClick={onConfirm}
            >
              {pending ? "Linking…" : "Confirm firm link"}
            </button>
          </div>
        </section>
      )}
      <div className={styles.feedback}>
        <QueryState error={error} />
        {needsReadback && (
          <>
            <p role="alert">
              The firm link is not confirmed. Read back the current link before
              choosing again.
            </p>
            <button className="button" disabled={disabled} onClick={onRefresh}>
              Refresh linked firm
            </button>
          </>
        )}
      </div>
    </>
  );
}
