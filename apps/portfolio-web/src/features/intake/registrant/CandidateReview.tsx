import { useState } from "react";
import type { Candidates } from "./contracts";
import { groupCandidates } from "./domain";
import styles from "./registrant.module.css";

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const compactDollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
export function CandidateReview({
  data,
  selected,
  disabled,
  onToggle,
  onChangeFirm,
}: {
  data: Candidates;
  selected: number[];
  disabled: boolean;
  onToggle: (id: number) => void;
  onChangeFirm: () => void;
}) {
  const [filter, setFilter] = useState("");
  const groups = groupCandidates(data.candidates);
  const visible = groups.filter((group) =>
    group.aliases.some((row) =>
      row.name.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
    ),
  );
  return (
    <section className={styles.body} aria-label="Review LDA clients">
      <p className="muted">
        {groups.length} matched clients from{" "}
        {data.registrantName ?? "your linked firm"}. Select which to add. No
        client profiles are created until you confirm.
      </p>
      <div className={styles.toolbar}>
        <input
          className={styles.filter}
          aria-label="Filter clients"
          placeholder="Filter clients"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          disabled={disabled}
        />
        <button
          className="button ghost"
          disabled={disabled}
          onClick={onChangeFirm}
        >
          Change firm
        </button>
      </div>
      {!groups.length ? (
        <p className="status">
          No LDA client filings were found for this firm.
        </p>
      ) : !visible.length ? (
        <p className="status">No clients match this filter.</p>
      ) : (
        <ul className={styles.list}>
          {visible.map((group) => (
            <li key={group.ldaClientId}>
              <label
                className={`${styles.row} ${group.onboardedAs !== null ? styles.imported : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(group.ldaClientId)}
                  disabled={
                    disabled ||
                    group.onboardedAs !== null ||
                    (selected.length >= 100 &&
                      !selected.includes(group.ldaClientId))
                  }
                  onChange={() => onToggle(group.ldaClientId)}
                  aria-label={`Select ${group.aliases[0]?.name ?? group.ldaClientId}`}
                />
                <span className={styles.text}>
                  {group.aliases.map((row, index) => (
                    <span className={styles.text} key={`${row.name}-${index}`}>
                      <strong>
                        {row.name}
                        {index > 0 ? " (filing alias)" : ""}
                      </strong>
                      <small
                        title={`Disclosed total: ${dollars.format(row.totalSpend)}`}
                      >
                        {row.filings} filings · latest{" "}
                        {row.latestFilingYear ?? "unknown"} ·{" "}
                        {compactDollars.format(row.totalSpend)} disclosed total
                      </small>
                    </span>
                  ))}
                  {group.aliases.length > 1 && (
                    <small>
                      These filing names share one LDA client ID; import once.
                    </small>
                  )}
                </span>
                {group.onboardedAs !== null && (
                  <span
                    className={styles.badge}
                    title={`Linked to ${group.onboardedAs}`}
                  >
                    Already imported
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
      {selected.length === 100 && (
        <p role="status">
          100-client limit reached. Import this selection before starting
          another.
        </p>
      )}
    </section>
  );
}
