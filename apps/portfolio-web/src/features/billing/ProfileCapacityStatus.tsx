import { QueryState } from "@/shared/ui/QueryState";
import { profileCapacity } from "./capacity";
import type { useProfileCapacity } from "./useProfileCapacity";

export function ProfileCapacityStatus({
  capacity,
}: {
  capacity: ReturnType<typeof useProfileCapacity>;
}) {
  const { query, ready, issue } = capacity;
  const state = ready && query.data ? profileCapacity(query.data) : null;
  if (!query.isFetching && !query.error && !issue && state?.kind !== "limited")
    return null;
  return (
    <section aria-label="Client profile capacity" className="stack">
      <QueryState
        pending={query.isFetching}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {state?.kind === "limited" && (
        <p className="muted" role="status">
          {state.used} of {state.limit} client slots in use · {state.remaining}{" "}
          available
        </p>
      )}
      {issue && (
        <p className="status" role="alert">
          {issue}
        </p>
      )}
      {issue && (
        <small className="muted">
          Inline billing is not available in this preview. No charge has been
          made.
        </small>
      )}
    </section>
  );
}
