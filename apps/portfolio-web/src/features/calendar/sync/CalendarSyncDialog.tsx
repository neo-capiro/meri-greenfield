"use client";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { useCalendarSync } from "./useCalendarSync";
import { useOwnedCalendarConnections } from "./queries";
import { syncRangeSchema, type CalendarSyncRange } from "./contracts";
import styles from "./sync.module.css";

export interface CalendarSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range?: CalendarSyncRange;
  clientName?: string;
}
export function CalendarSyncDialog({
  open,
  onOpenChange,
  range,
  clientName,
}: CalendarSyncDialogProps) {
  const sync = useCalendarSync(open);
  const accounts = useOwnedCalendarConnections(
    sync.tenantId,
    sync.userId,
    sync.allowed,
    sync.assertCurrent,
  );
  const [selected, setSelected] = useState("");
  const [windowOnly, setWindowOnly] = useState(false);
  const connected =
    accounts.data?.filter(
      (account) =>
        account.status === "connected" &&
        (account.provider === "microsoft_365" ||
          account.provider === "google_workspace"),
    ) ?? [];
  const connection = connected.find((account) => account.id === selected);
  const attempt = sync.attempt;
  const pending = attempt.status === "pending";
  const validRange = syncRangeSchema.safeParse(range);
  const canChooseWindow =
    connection?.provider === "microsoft_365" && validRange.success;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className={styles.dialog}
      title={pending ? "Syncing calendar" : "Sync calendar"}
      description={
        pending
          ? "Importing meetings from your connected calendar."
          : "Review a connected account before importing meetings."
      }
    >
      <p className={styles.explanation}>
        Client assignment determines which meetings appear in{" "}
        {clientName ? `${clientName}’s calendar` : "each client’s calendar"}.
      </p>
      {attempt.status === "idle" && (
        <>
          {!sync.allowed && (
            <p role="status">
              Sync requires a current permitted session and enabled external
              actions.
            </p>
          )}
          {sync.allowed && accounts.isPending && (
            <p role="status">Loading your connected accounts…</p>
          )}
          {accounts.error && (
            <div role="alert">
              {accounts.error.message}
              <button
                className="button"
                onClick={() => void accounts.refetch()}
              >
                Refresh accounts
              </button>
            </div>
          )}
          {sync.allowed && accounts.isSuccess && (
            <>
              {connected.length === 0 ? (
                <p>
                  No connected Microsoft or Google calendar is available for
                  your account.
                </p>
              ) : (
                <label className={styles.field}>
                  Connected account
                  <select
                    value={selected}
                    onChange={(event) => {
                      setSelected(event.target.value);
                      setWindowOnly(false);
                    }}
                  >
                    <option value="">Choose an account</option>
                    {connected.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.provider === "microsoft_365"
                          ? "Microsoft"
                          : "Google"}{" "}
                        ·{" "}
                        {account.accountEmail ??
                          account.displayName ??
                          "Connected account"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {connection && (
                <p className={styles.explanation}>
                  Only calendar meetings will be imported. Email is excluded.
                  Existing client assignment rules apply.
                </p>
              )}
              {connection?.provider === "google_workspace" && (
                <p className={styles.explanation}>
                  Google uses its server-managed calendar cursor. This action
                  does not select the displayed date range.
                </p>
              )}
              {canChooseWindow && (
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={windowOnly}
                    onChange={(event) => setWindowOnly(event.target.checked)}
                  />
                  Import the displayed Microsoft date range
                </label>
              )}
              {windowOnly && canChooseWindow && (
                <p className={styles.range}>
                  {range?.from} → {range?.to}
                </p>
              )}
              {connection?.provider === "microsoft_365" &&
                range &&
                !validRange.success && (
                  <p role="alert">
                    The displayed range is invalid. A window import is
                    unavailable.
                  </p>
                )}
              {connection?.provider === "microsoft_365" && !windowOnly && (
                <p className={styles.explanation}>
                  Microsoft uses its server-managed calendar cursor, initially
                  one year before and after sync time.
                </p>
              )}
            </>
          )}
          {sync.error && <p role="alert">{sync.error}</p>}
        </>
      )}
      {pending && (
        <p className={styles.explanation}>
          Closing stops waiting here; it does not cancel the calendar import.
        </p>
      )}
      {attempt.status === "unknown" && (
        <div role="alert">
          <strong>Sync outcome unknown</strong>
          <p>
            Meetings may already have been imported. This request is frozen and
            cannot be repeated here. Refreshing the calendar or account status
            cannot establish this operation’s result.
          </p>
        </div>
      )}
      {attempt.status === "completed" && sync.allowed && (
        <section aria-label="Calendar sync result" className={styles.result}>
          <strong>
            {attempt.receipt.calendar.hasMore || attempt.receipt.calendar.failed
              ? "Calendar sync returned partial results"
              : "Calendar sync completed"}
          </strong>
          <p>
            {attempt.receipt.calendar.scanned} scanned ·{" "}
            {attempt.receipt.calendar.matched} matched ·{" "}
            {attempt.receipt.calendar.skipped} skipped ·{" "}
            {attempt.receipt.calendar.removed} removed ·{" "}
            {attempt.receipt.calendar.failed} failed ·{" "}
            {attempt.receipt.calendar.pages} pages
          </p>
          <p className={styles.explanation}>
            Matched counts processing outcomes, not newly created meetings.
          </p>
          {attempt.receipt.kind === "window" && (
            <p className={styles.explanation}>
              The window endpoint returns statistics without an operation,
              account or range-bound receipt.
            </p>
          )}
          {attempt.receipt.calendar.hasMore && (
            <p className={styles.explanation}>
              {attempt.receipt.kind === "window"
                ? "The 12-page limit left more results. This window endpoint cannot resume from the next page."
                : "More results remain after this run. A separate reviewed sync may continue the server cursor."}
            </p>
          )}
        </section>
      )}
      {attempt.status === "completed" && !sync.allowed && (
        <p role="status">
          Review the current session and permissions before viewing this sync
          result.
        </p>
      )}
      <footer className="row">
        <button className="button" onClick={() => onOpenChange(false)}>
          {pending ? "Cancel" : "Close"}
        </button>
        {attempt.status === "idle" && (
          <button
            className="button primary"
            disabled={
              !sync.allowed ||
              accounts.isFetching ||
              Boolean(accounts.error) ||
              !connection
            }
            onClick={() => {
              if (
                connection &&
                (connection.provider === "microsoft_365" ||
                  connection.provider === "google_workspace")
              )
                void sync.sync({
                  connectionId: connection.id,
                  provider: connection.provider,
                  ...(windowOnly && canChooseWindow
                    ? { range: validRange.data }
                    : {}),
                });
            }}
          >
            Import calendar meetings
          </button>
        )}
        {attempt.status === "completed" && (
          <button
            className="button"
            disabled={!sync.allowed}
            onClick={sync.reviewAnother}
          >
            Review another sync
          </button>
        )}
      </footer>
    </Dialog>
  );
}
