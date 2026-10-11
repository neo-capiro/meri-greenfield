import { Temporal } from "temporal-polyfill";
import type { Opportunity } from "./contracts";
export function opportunityDate(value: string | null) {
  if (!value) return "No deadline stated";
  try {
    // Date-only source facts are civil dates, not midnight in the browser's zone.
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? Temporal.PlainDate.from(value)
      : Temporal.Instant.from(value)
          .toZonedDateTimeISO(Temporal.Now.timeZoneId())
          .toPlainDate();
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}
export function opportunityAmount(
  record: Pick<Opportunity, "value" | "valueBasis">,
) {
  return record.valueBasis === "source_backed" && record.value !== null
    ? `Source amount ${record.value.toLocaleString()}`
    : "Value not stated";
}
export function opportunityLink(
  base: string,
  clientId: string,
  record?: Pick<Opportunity, "source" | "sourceRecordId">,
) {
  return `${base}/intelligence/opportunities${record ? `/${encodeURIComponent(record.source)}/${encodeURIComponent(record.sourceRecordId)}` : ""}?${new URLSearchParams({ clientId, mode: "matched" })}`;
}
export function pageWorkflowCounts(rows: Opportunity[]) {
  return {
    pursuing: rows.every((row) => row.decoration?.workflow.available)
      ? rows.filter((row) => row.decoration?.workflow.status === "pursuing")
          .length
      : null,
    saved: rows.every((row) => row.decoration)
      ? rows.filter((row) => row.decoration?.bookmark.saved).length
      : null,
  };
}
export function boundedPage(value: string | null) {
  const page = Number(value ?? 1);
  return Number.isSafeInteger(page) && page >= 1 && page <= 10000 ? page : 1;
}
