import type { Client } from "./contracts";
import styles from "./portfolio.module.css";
export function PortfolioPulse({ clients }: { clients?: Client[] }) {
  return (
    <section className={styles.pulse} aria-label="Portfolio pulse">
      <div className={styles.coverage}>
        <p className="eyebrow">Portfolio pulse</p>
        <div className="row">
          <strong>—</strong>
          <small>
            of work linked
            <br />
            to an objective
          </small>
        </div>
      </div>
      {[
        ["Clients", clients?.filter((c) => c.profileType === "CLIENT").length],
        ["Need attention", undefined],
        ["Objectives", undefined],
        ["Off track", undefined],
        ["Strategies", undefined],
      ].map(([label, count]) => (
        <div key={label}>
          <strong>{count ?? "—"}</strong>
          <span className="eyebrow">{label}</span>
        </div>
      ))}
    </section>
  );
}
