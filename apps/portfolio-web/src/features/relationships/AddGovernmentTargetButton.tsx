"use client";
import { useIsMutating } from "@tanstack/react-query";
import { useIdentity, canAdminister } from "@/shared/auth/identity";
import { QueryState } from "@/shared/ui/QueryState";
import { useGovernmentTargets, useTargetMutation } from "./target-queries";
import type { GovernmentTarget } from "./target-contracts";

// Public composition point for a representative already resolved by a client
// feature. Relationships remains the owner of target reads and writes.
export function AddGovernmentTargetButton({
  clientId,
  memberId,
  name,
  sourceDirectory,
}: {
  clientId: string;
  memberId: string;
  name: string;
  sourceDirectory: GovernmentTarget["sourceDirectory"];
}) {
  const identity = useIdentity();
  const targets = useGovernmentTargets(clientId);
  const add = useTargetMutation(clientId);
  const busy =
    useIsMutating({ mutationKey: ["client-target-write", clientId] }) > 0;
  const permitted =
    identity.data?.role === "standard_user" ||
    canAdminister(identity.data?.role);
  const added = targets.data?.some(
    (target) =>
      target.memberId === memberId &&
      target.sourceDirectory === sourceDirectory,
  );
  return (
    <div className="stack">
      {added ? (
        <p role="status">Added to targets</p>
      ) : (
        <button
          className="button"
          disabled={
            !permitted || !targets.isSuccess || targets.isFetching || busy
          }
          onClick={() =>
            add.mutate({
              kind: "add",
              memberId,
              sourceDirectory,
              source: "manual",
            })
          }
        >
          {add.isPending ? "Adding…" : "Add representative to targets"}
          <span className="srOnly">: {name}</span>
        </button>
      )}
      <QueryState
        error={identity.error}
        retry={() => void identity.refetch()}
      />
      <QueryState error={targets.error} retry={() => void targets.refetch()} />
      <QueryState error={add.error} />
      {identity.isSuccess && !permitted && !added && (
        <p className="muted">Your role cannot add government targets.</p>
      )}
    </div>
  );
}
