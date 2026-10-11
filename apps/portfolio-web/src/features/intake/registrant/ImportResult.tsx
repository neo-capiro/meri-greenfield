import type { ImportReceipt } from "./contracts";
import styles from "./registrant.module.css";
export function ImportResult({ receipt }: { receipt: ImportReceipt }) {
  return (
    <section
      className={styles.body}
      aria-label="Import results"
      aria-live="polite"
    >
      <p role="status">
        {receipt.created} client profiles created. {receipt.skipped.length}{" "}
        skipped.
      </p>
      {receipt.items.length > 0 && (
        <>
          <h3>Created</h3>
          <ul className={styles.list}>
            {receipt.items.map((item) => (
              <li className={styles.row} key={item.id}>
                <span className={styles.text}>
                  <strong>{item.name}</strong>
                  <small>LDA client {item.ldaClientId}</small>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {receipt.skipped.length > 0 && (
        <>
          <h3>Skipped</h3>
          <ul className={styles.list}>
            {receipt.skipped.map((item) => (
              <li className={styles.row} key={item.ldaClientId}>
                <span className={styles.text}>
                  <strong>LDA client {item.ldaClientId}</strong>
                  <small>{item.reason}</small>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
