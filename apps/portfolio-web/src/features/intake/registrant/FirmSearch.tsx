import { useState } from "react";
import { QueryState } from "@/shared/ui/QueryState";
import type { RegistrantHit } from "./contracts";
import { useRegistrantSearch } from "./queries";
import styles from "./registrant.module.css";

export function FirmSearch({
  permitted,
  busy,
  enabled,
  onSelect,
}: {
  permitted: boolean;
  busy: boolean;
  enabled: boolean;
  onSelect: (firm: RegistrantHit) => void;
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [validation, setValidation] = useState("");
  const result = useRegistrantSearch(query, enabled);
  return (
    <section className={styles.body} aria-label="Find your firm">
      <form
        className={styles.toolbar}
        onSubmit={(event) => {
          event.preventDefault();
          const next = input.trim();
          if (next.length < 2 || next.length > 200) {
            setValidation("Enter 2–200 characters to search.");
            return;
          }
          setValidation("");
          if (next === query) void result.refetch();
          else setQuery(next);
        }}
      >
        <input
          aria-label="Firm name"
          placeholder="Search your firm’s name (e.g. Maven Advocacy)"
          maxLength={200}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy || !enabled}
        />
        <button
          className="button primary"
          disabled={busy || !enabled || result.isFetching}
        >
          Search
        </button>
      </form>
      {validation && (
        <p className="danger" role="alert">
          {validation}
        </p>
      )}
      {query && (
        <QueryState
          pending={result.isFetching}
          error={result.error}
          retry={() => void result.refetch()}
        />
      )}
      {query && result.isSuccess && !result.isFetching && !result.error && (
        <>
          {!result.data.length ? (
            <p className="status">No matching firms. Try another name.</p>
          ) : (
            <ul className={styles.list}>
              {result.data.map((firm) => (
                <li key={firm.id} className={styles.row}>
                  <div className={styles.text}>
                    <strong>{firm.name}</strong>
                    <small>
                      {[firm.city, firm.state].filter(Boolean).join(", ") ||
                        "Location unavailable"}{" "}
                      · {firm.totalClients} clients · {firm.totalFilings}{" "}
                      filings
                    </small>
                  </div>
                  <button
                    className="button primary"
                    disabled={!permitted || busy}
                    onClick={() => onSelect(firm)}
                    aria-label={`Link ${firm.name}`}
                  >
                    This is us
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
