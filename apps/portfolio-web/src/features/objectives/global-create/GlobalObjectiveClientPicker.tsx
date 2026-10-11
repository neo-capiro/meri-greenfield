"use client";
import {
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type FormEvent,
} from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useClients, initials } from "@/features/portfolio/public";
import {
  currentClientWriter,
  type ClientWriter,
} from "@/features/client-profile/quick-log/public";
import { useIdentity } from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import {
  assertObjectiveClient,
  clientOptions,
  objectiveClientsKey,
} from "./client-options";
import styles from "./global-create.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (clientId: string) => void;
  onCloseAutoFocus?: ComponentProps<typeof Dialog>["onCloseAutoFocus"];
};

// Observe canonical cache authority, including invalidation without a new result.
function useWriterToken(cache: QueryClient) {
  return useSyncExternalStore(
    (notify) =>
      cache.getQueryCache().subscribe((event) => {
        if (event.query.queryKey[0] === "identity") notify();
      }),
    () => {
      const actor = currentClientWriter(cache);
      return actor ? JSON.stringify([actor.tenantId, actor.userId]) : "";
    },
    () => "",
  );
}

export function GlobalObjectiveClientPicker(props: Props) {
  const identity = useIdentity();
  const cache = useQueryClient();
  const token = useWriterToken(cache);
  const actor = token ? currentClientWriter(cache) : undefined;
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      onCloseAutoFocus={props.onCloseAutoFocus}
      title="New objective"
      description="Choose the client for this objective."
      className={styles.picker}
    >
      {props.open && (
        <PickerSession
          key={token}
          {...props}
          actor={actor}
          checkingIdentity={identity.isPending || identity.isFetching}
          identityError={identity.error}
          retryIdentity={() => void identity.refetch()}
        />
      )}
    </Dialog>
  );
}

function PickerSession({
  actor,
  checkingIdentity,
  identityError,
  retryIdentity,
  onContinue,
  onOpenChange,
}: Props & {
  actor?: ClientWriter;
  checkingIdentity: boolean;
  identityError: Error | null;
  retryIdentity: () => void;
}) {
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const scope = actor ?? { tenantId: "", userId: "" };
  const clients = useClients({ enabled: Boolean(actor), scope });
  const key = objectiveClientsKey(scope);
  const encodedKey = JSON.stringify(key);
  const state = useSyncExternalStore(
    (notify) =>
      cache.getQueryCache().subscribe((event) => {
        if (JSON.stringify(event.query.queryKey) === encodedKey) notify();
      }),
    () => cache.getQueryState(key),
    () => undefined,
  );
  const ready = Boolean(
    actor &&
    state?.status === "success" &&
    !state.error &&
    state.fetchStatus === "idle" &&
    !state.isInvalidated,
  );
  const options = ready ? clientOptions(clients.data ?? [], search) : [];
  const selectedClient = ready
    ? clientOptions(clients.data ?? [], "").find(
        (client) => client.id === selected,
      )
    : undefined;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      if (!actor)
        throw new Error("Your current session cannot create objectives.");
      const client = assertObjectiveClient(cache, actor, selected);
      onContinue(client.id);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Choose a client again.",
      );
    }
  };
  return (
    <form onSubmit={submit}>
      <div className={styles.body}>
        {checkingIdentity ? (
          <p role="status">Checking your session…</p>
        ) : identityError ? (
          <div role="alert" className="status error">
            <p>{identityError.message}</p>
            <button type="button" className="button" onClick={retryIdentity}>
              Retry session
            </button>
          </div>
        ) : !actor ? (
          <p role="status">Your current session cannot create objectives.</p>
        ) : (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="objective-client-search">
                Client <span aria-hidden="true">*</span>
              </label>
              <div className={styles.search}>
                <input
                  id="objective-client-search"
                  type="search"
                  placeholder="Search clients"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-controls="objective-client-options"
                />
                <ChevronDown size={14} aria-hidden="true" />
              </div>
            </div>
            {clients.error ? (
              <div role="alert" className="status error">
                <p>{clients.error.message}</p>
                <button
                  type="button"
                  className="button"
                  onClick={() => void clients.refetch()}
                >
                  Retry client list
                </button>
              </div>
            ) : !ready ? (
              <div role="status" className={styles.refresh}>
                <p>
                  {clients.isFetching || clients.isPending
                    ? "Loading clients…"
                    : "Refresh the client list before continuing."}
                </p>
                {!clients.isFetching && (
                  <button
                    type="button"
                    className="button"
                    onClick={() => void clients.refetch()}
                  >
                    Refresh clients
                  </button>
                )}
              </div>
            ) : (
              <fieldset
                id="objective-client-options"
                className={styles.options}
              >
                <legend className="srOnly">Choose a client</legend>
                {options.map((client) => (
                  <label
                    key={client.id}
                    className={`${styles.option} ${selected === client.id ? styles.selected : ""}`}
                  >
                    <input
                      type="radio"
                      required
                      name="objective-client"
                      value={client.id}
                      checked={selected === client.id}
                      onChange={() => {
                        setSelected(client.id);
                        setError("");
                      }}
                    />
                    <span className={styles.avatar} aria-hidden="true">
                      {initials(client.name)}
                    </span>
                    <span className={styles.details}>
                      <strong>{client.name}</strong>
                      <span>
                        {[client.sectorTag, client.profileStatus]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                ))}
                {!options.length && (
                  <p role="status">
                    {search.trim()
                      ? "No clients match your search."
                      : "No clients are available for this objective."}
                  </p>
                )}
              </fieldset>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="status error">
            {error}
          </p>
        )}
      </div>
      <footer className={styles.footer}>
        <button
          type="submit"
          className="button primary"
          disabled={!ready || !selectedClient}
        >
          Continue
        </button>
        <button
          type="button"
          className="button"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </button>
      </footer>
    </form>
  );
}
