"use client";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
export function useAdvocacyAccess() {
  const identity = useIdentity();
  const ready =
    !identity.isPending &&
    !identity.error &&
    Boolean(identity.data?.tenant?.id);
  return {
    identity,
    canRead:
      ready &&
      (identity.data?.role === "standard_user" ||
        canAdminister(identity.data?.role)),
    canEdit: ready && canAdminister(identity.data?.role),
  };
}
