import type { TrackedBill } from "./contracts";
import styles from "./bills.module.css";
export function BillResults({
  columns,
  view,
  onOpen,
}: {
  columns: { id: string; label: string; bills: TrackedBill[] }[];
  view: "table" | "board";
  onOpen: (bill: TrackedBill) => void;
}) {
  if (view === "board")
    return (
      <div className={styles.board}>
        {columns.map((column) => (
          <section key={column.id} className={styles.lane}>
            <header className="row between">
              <h3>{column.label}</h3>
              <span className="chip">{column.bills.length}</span>
            </header>
            {column.bills.map((bill) => (
              <button
                className={styles.billCard}
                key={bill.billId}
                onClick={() => onOpen(bill)}
              >
                <span className="row between">
                  <strong className="mono">{bill.displayNum}</strong>
                  <span>{Math.round(bill.probability * 100)}% estimate</span>
                </span>
                <span>{bill.title ?? "Title unavailable"}</span>
                <small>{bill.canonicalStatus ?? column.label}</small>
                {bill.terminalRisk && (
                  <strong className="danger">Terminal risk</strong>
                )}
                {bill.changeLabel && <small>{bill.changeLabel}</small>}
              </button>
            ))}
            {!column.bills.length && <p className="empty">No loaded bills</p>}
          </section>
        ))}
      </div>
    );
  return (
    <div className="tableWrap">
      <table>
        <caption className="srOnly">
          Tracked bills and service passage estimates
        </caption>
        <thead>
          <tr>
            {["Bill", "Title", "Latest action", "Stage", "Pass estimate"].map(
              (label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {columns.flatMap((column) =>
            column.bills.map((bill) => (
              <tr key={bill.billId}>
                <td>
                  <button
                    className="button ghost mono"
                    onClick={() => onOpen(bill)}
                  >
                    {bill.displayNum}
                  </button>
                </td>
                <td className={styles.titleCell}>
                  {bill.title ?? "Title unavailable"}
                  {bill.terminalRisk && (
                    <small className="danger">Terminal risk</small>
                  )}
                </td>
                <td>
                  {bill.latestActionText ?? bill.changeLabel ?? "—"}
                  {bill.latestActionDate && (
                    <small>{bill.latestActionDate.slice(0, 10)}</small>
                  )}
                </td>
                <td>{bill.canonicalStatus ?? column.label}</td>
                <td>
                  <span
                    className="chip"
                    title="Estimate supplied by the configured backend; not a confirmed outcome."
                  >
                    {Math.round(bill.probability * 100)}%
                  </span>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
