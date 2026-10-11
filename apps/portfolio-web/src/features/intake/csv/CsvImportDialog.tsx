"use client";
import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { useIdentity } from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import { clientsKey } from "@/features/portfolio/public";
import {
  currentClientWriter,
  assertClientWriter,
  ambiguousClientWrite,
  type ClientWriter,
} from "@/features/client-profile/quick-log/public";
import {
  parseClientCsv,
  defaultMapping,
  mapClientCsv,
  csvFields,
  type CsvRecord,
  type CsvField,
} from "./model";
import { importCsvClients, type CsvReceipt } from "./api";
import styles from "./csv.module.css";
export interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack?: () => void;
  onImported?: (receipt: CsvReceipt) => void;
  onCloseAutoFocus?: ComponentProps<typeof Dialog>["onCloseAutoFocus"];
}
export function CsvImportDialog({
  open,
  onOpenChange,
  onBack,
  onImported,
  onCloseAutoFocus,
}: CsvImportDialogProps) {
  const api = useApi();
  const cache = useQueryClient();
  const identity = useIdentity();
  const actor = currentClientWriter(cache);
  const [records, setRecords] = useState<CsvRecord[]>();
  const [mapping, setMapping] = useState<(CsvField | "")[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [receipt, setReceipt] = useState<CsvReceipt>();
  const [owner, setOwner] = useState<ClientWriter>();
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const sameOwner =
    !owner ||
    Boolean(
      actor &&
      owner.userId === actor.userId &&
      owner.tenantId === actor.tenantId,
    );
  const allowed = Boolean(
    actor && sameOwner && !identity.error && !identity.isFetching,
  );
  const frozen = pending || uncertain || Boolean(receipt);
  useLayoutEffect(() => {
    const current = new AbortController();
    controller.current = open ? current : null;
    return () => {
      current.abort();
      if (controller.current === current) controller.current = null;
    };
  }, [open, actor?.userId, actor?.tenantId]);
  let preview: ReturnType<typeof mapClientCsv> = [];
  let mappingError = "";
  try {
    if (records) preview = mapClientCsv(records, mapping);
  } catch (failure) {
    mappingError =
      failure instanceof Error ? failure.message : "Review the column mapping.";
  }
  async function read(file: File) {
    if (frozen || !allowed || !controller.current) return;
    const current = controller.current;
    setError("");
    setRecords(undefined);
    try {
      if (file.size > 1_048_576)
        throw new Error("Use a CSV file no larger than 1 MB.");
      const parsed = parseClientCsv(await file.text());
      current.signal.throwIfAborted();
      if (controller.current !== current) return;
      const header = parsed[0];
      if (!header) throw new Error("Include a CSV header.");
      setMapping(defaultMapping(header.cells));
      setOwner(actor);
      setRecords(parsed);
    } catch (failure) {
      if (!current.signal.aborted)
        setError(
          failure instanceof Error ? failure.message : "CSV could not be read.",
        );
    }
  }
  async function submit() {
    const current = controller.current;
    const initiating = currentClientWriter(cache);
    if (
      !current ||
      !initiating ||
      !allowed ||
      lock.current ||
      frozen ||
      mappingError ||
      !preview.length ||
      preview.some((row) => !row.row)
    )
      return;
    const rows = preview.flatMap((row) => (row.row ? [row.row] : []));
    lock.current = true;
    setPending(true);
    setError("");
    let sent = false;
    const guard = () => {
      current.signal.throwIfAborted();
      if (controller.current !== current)
        throw new Error("The import dialog closed.");
      try {
        assertClientWriter(cache, initiating);
      } catch (failure) {
        if (sent)
          throw new Error(
            "Your session changed after the import was dispatched. Inspect Portfolio before another import.",
          );
        throw failure;
      }
    };
    try {
      const result = await importCsvClients(
        api,
        rows,
        guard,
        current.signal,
        () => {
          sent = true;
        },
      );
      setReceipt(result);
      await cache.invalidateQueries({ queryKey: clientsKey });
      onImported?.(result);
    } catch (failure) {
      if (sent && ambiguousClientWrite(failure)) setUncertain(true);
      setError(failure instanceof Error ? failure.message : "Import failed.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import client CSV"
      description="Review mapped rows before creating client profiles."
      wide
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <div className="stack">
        {!allowed && (
          <p className="status">
            A current authorized client session is required.
          </p>
        )}
        <p className="muted">
          Up to 500 rows, 1 MB. Each valid row is saved independently. Existing
          names, duplicates, and client-slot limits can reject individual rows.
          Importing also starts the existing entity and government-ID
          resolution.
        </p>
        {error && <p role="alert">{error}</p>}
        {uncertain && (
          <p className="status">
            The import outcome is unknown. Some profiles may already exist. This
            dialog will not resend the batch. Inspect Portfolio before starting
            another import.
          </p>
        )}
        {!receipt && (
          <>
            <label className="field">
              Client CSV
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={!allowed || frozen}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void read(file);
                }}
              />
            </label>
            {records && sameOwner && (
              <>
                <div className={styles.mapping}>
                  {records[0]?.cells.map((header, index) => (
                    <label className="field" key={index}>
                      {header || `Column ${index + 1}`}
                      <select
                        aria-label={`Map column ${index + 1}`}
                        disabled={frozen}
                        value={mapping[index] ?? ""}
                        onChange={(event) =>
                          setMapping((old) =>
                            old.map((field, item) =>
                              item === index
                                ? (csvFields.find(
                                    (field) => field === event.target.value,
                                  ) ?? "")
                                : field,
                            ),
                          )
                        }
                      >
                        <option value="">Skip column</option>
                        {csvFields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                {mappingError && <p role="alert">{mappingError}</p>}
                <div className={styles.preview}>
                  <table>
                    <caption>{preview.length} rows to review</caption>
                    <thead>
                      <tr>
                        <th>CSV line</th>
                        <th>Organization</th>
                        <th>Validation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row) => (
                        <tr key={row.line}>
                          <td>{row.line}</td>
                          <td>{row.row?.name ?? "—"}</td>
                          <td>{row.error ?? "Ready"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
        {receipt && sameOwner && (
          <section aria-live="polite" className="stack">
            <h3>
              {receipt.created} of {receipt.total} profiles created
            </h3>
            {receipt.errors.map((row) => (
              <p className="status" key={row.row}>
                CSV line {preview[row.row]?.line ?? row.row + 2}
                {row.field && ` · ${row.field}`}: {row.message}
              </p>
            ))}
            {receipt.items.map((item) => (
              <Link href={`/portfolio/${item.id}`} key={item.id}>
                {item.name}
              </Link>
            ))}
          </section>
        )}
        <div className="row">
          {onBack && !frozen && (
            <button className="button" onClick={onBack}>
              Back
            </button>
          )}
          <button className="button" onClick={() => onOpenChange(false)}>
            Close
          </button>
          {!receipt && (
            <button
              className="button primary"
              disabled={
                !allowed ||
                frozen ||
                Boolean(mappingError) ||
                !preview.length ||
                preview.some((row) => !row.row)
              }
              onClick={() => void submit()}
            >
              {pending
                ? "Importing…"
                : `Import ${preview.length || ""} clients`}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
