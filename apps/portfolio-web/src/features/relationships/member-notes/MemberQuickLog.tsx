"use client";
import { useId, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIdentity } from "@/shared/auth/identity";
import { currentClientWriter } from "@/features/client-profile/quick-log/public";
import { useTargetDirectory } from "../directory-queries";
import {
  memberReferenceSchema,
  type MemberReference,
  type MemberNoteReceipt,
} from "./contracts";
import { MemberNoteForm } from "./MemberNoteForm";
import styles from "./member-notes.module.css";

export function MemberQuickLog({
  open,
  onSaved,
}: {
  open: boolean;
  onSaved?: (receipt: MemberNoteReceipt) => void;
}) {
  const cache = useQueryClient();
  const identity = useIdentity();
  useSyncExternalStore(
    (notify) =>
      cache.getQueryCache().subscribe((event) => {
        if (event.query.queryKey[0] === "identity") notify();
      }),
    () => cache.getQueryState(["identity"]),
    () => undefined,
  );
  const actor = currentClientWriter(cache);
  return open ? (
    <MemberPicker
      key={`${identity.data?.tenant?.id}:${identity.data?.user.id}`}
      allowed={Boolean(actor)}
      checking={identity.isPending || identity.isFetching}
      onSaved={onSaved}
    />
  ) : null;
}

function MemberPicker({
  allowed,
  checking,
  onSaved,
}: {
  allowed: boolean;
  checking: boolean;
  onSaved?: (receipt: MemberNoteReceipt) => void;
}) {
  const cache = useQueryClient();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [member, setMember] = useState<MemberReference>();
  const [selectionError, setSelectionError] = useState("");
  const search =
    allowed && !member && query.trim().length >= 2 ? query.trim() : "";
  const results = useTargetDirectory("congress", search, page);
  const key = ["target-directory", "congress", search, page, undefined];
  const ready = Boolean(
    search &&
    !results.isFetching &&
    !results.error &&
    results.data?.page === page &&
    results.data.pageSize === 20 &&
    new Set(results.data.rows.map((row) => row.id)).size ===
      results.data.rows.length,
  );
  if (member)
    return (
      <MemberNoteForm
        key={member.id}
        member={member}
        onSaved={onSaved}
        onChangeMember={() => setMember(undefined)}
      />
    );
  return (
    <section className={styles.form} aria-label="Member note">
      <div className={styles.field}>
        <label htmlFor={searchId}>Member</label>
        <input
          id={searchId}
          type="search"
          placeholder="Search members or office staff"
          value={query}
          disabled={!allowed}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
            setSelectionError("");
          }}
          aria-controls={`${searchId}-results`}
        />
        <small>
          Search at least two characters. Office staff matches identify their
          member; staff are not attached to the note.
        </small>
      </div>
      {checking ? (
        <p role="status">Checking your session…</p>
      ) : !allowed ? (
        <p role="status">Your current session cannot save Directory notes.</p>
      ) : !search ? (
        <p role="status">
          Search for a member to record a shared Directory note.
        </p>
      ) : results.error ? (
        <div role="alert" className="status error">
          <p>{results.error.message}</p>
          <button
            type="button"
            className="button"
            onClick={() => void results.refetch()}
          >
            Retry member search
          </button>
        </div>
      ) : results.isFetching ? (
        <p role="status">Searching members…</p>
      ) : !ready ? (
        <p role="alert">
          Member results could not be verified. Search again before selecting.
        </p>
      ) : (
        <div id={`${searchId}-results`} className={styles.results}>
          <h3 className="eyebrow">Members</h3>
          {results.data?.rows.map((row) => (
            <button
              type="button"
              key={row.id}
              className={styles.result}
              onClick={() => {
                const state = cache.getQueryState(key);
                const selected = memberReferenceSchema.safeParse({
                  id: row.id,
                  name: row.name,
                });
                if (
                  !currentClientWriter(cache) ||
                  !selected.success ||
                  state?.status !== "success" ||
                  state.fetchStatus !== "idle" ||
                  state.error ||
                  state.isInvalidated
                ) {
                  setSelectionError(
                    "Refresh this search with a current session before selecting.",
                  );
                  return;
                }
                setMember(selected.data);
              }}
            >
              <strong>{row.name}</strong>
              <small>{[row.title, row.meta].filter(Boolean).join(" · ")}</small>
            </button>
          ))}
          {!results.data?.rows.length && (
            <p role="status">No members match your search.</p>
          )}
          <div className={styles.pagination}>
            <button
              type="button"
              className="button"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous members
            </button>
            <small>Page {page}</small>
            <button
              type="button"
              className="button"
              disabled={page * 20 >= (results.data?.total ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              Next members
            </button>
          </div>
        </div>
      )}
      {selectionError && <p role="alert">{selectionError}</p>}
    </section>
  );
}
