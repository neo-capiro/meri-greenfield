"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { QueryState } from "@/shared/ui/QueryState";
import { useBillingSummary } from "./useBillingSummary";
import styles from "./billing-summary.module.css";

const usd = (amount: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
const statuses = {
  none: "No plan",
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  comped: "Complimentary",
} as const;

export function BillingSummaryPanel({
  enabled = true,
  existingApp,
}: {
  enabled?: boolean;
  existingApp?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { query, visible, ready } = useBillingSummary(enabled, expanded);
  if (!visible) return null;
  const summary = ready ? query.data : undefined;
  return (
    <details
      className={styles.panel}
      aria-label="Current plan and usage"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        Current plan and usage
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      {expanded && (
        <QueryState
          pending={query.isPending || query.isFetching}
          error={query.error}
          retry={() => void query.refetch()}
        />
      )}
      {summary && (
        <>
          <dl className={styles.rows}>
            <div>
              <dt>Plan status</dt>
              <dd>{statuses[summary.status]}</dd>
            </div>
            <div>
              <dt>
                Purchased profile slots
                <span>{summary.usedSlots} active profiles</span>
              </dt>
              <dd>{summary.slots}</dd>
            </div>
            <div>
              <dt>
                Monthly plan rate
                <span>Plan rate per slot</span>
              </dt>
              <dd>
                {usd(summary.pricePerSlotUsd)}
                <span>/ slot / month</span>
              </dd>
            </div>
            <div>
              <dt>
                AI allowance<span>Current billing period</span>
              </dt>
              <dd>{usd(summary.llmAllowanceUsd)}</dd>
            </div>
            <div>
              <dt>
                AI usage<span>Real spend this period</span>
              </dt>
              <dd>{usd(summary.llmUsedUsd)}</dd>
            </div>
            <div>
              <dt>
                Billable AI overage<span>So far this period</span>
              </dt>
              <dd>{usd(summary.llmOverageUsd)}</dd>
            </div>
            <div>
              <dt>AI spend cap</dt>
              <dd>
                {summary.llmHardCapUsd === null
                  ? "No cap set"
                  : usd(summary.llmHardCapUsd)}
              </dd>
            </div>
            <div>
              <dt>Current period ends</dt>
              <dd>
                {summary.currentPeriodEnd ? (
                  <time
                    dateTime={summary.currentPeriodEnd}
                    title={summary.currentPeriodEnd}
                  >
                    {new Date(summary.currentPeriodEnd).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </time>
                ) : (
                  "Not available"
                )}
              </dd>
            </div>
          </dl>
          {summary.llmWarn && (
            <p className={styles.warning} role="status">
              The billing service reports an AI usage warning.
            </p>
          )}
          {!summary.billingEnabled && (
            <p className={styles.note}>Billing enforcement is disabled.</p>
          )}
          <p className={styles.note}>
            Current plan and usage values are not a quote or an amount due
            today.
          </p>
        </>
      )}
      {expanded && existingApp && (
        <a
          className={styles.manageLink}
          href={`${existingApp}/settings/billing`}
        >
          Manage billing
        </a>
      )}
    </details>
  );
}
