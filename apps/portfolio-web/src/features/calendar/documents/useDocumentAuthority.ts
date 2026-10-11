"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { ApiError } from "@/shared/api/http";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { useDispatchGuard } from "../access/public";

export function useDocumentAuthority(
  scope: string,
  runtime = false,
  active = true,
) {
  const identity = useIdentity();
  const [initiatingActor, setInitiatingActor] = useState<{
    userId: string;
    tenantId: string;
  } | null>(null);
  if (
    !initiatingActor &&
    identity.isSuccess &&
    !identity.isFetching &&
    identity.data.user.id.trim() &&
    identity.data.tenant?.id.trim()
  )
    setInitiatingActor({
      userId: identity.data.user.id,
      tenantId: identity.data.tenant.id,
    });
  const guard = useDispatchGuard(
    initiatingActor?.userId,
    initiatingActor?.tenantId,
    runtime,
  );
  const lifetime = useRef<object | null>(null);
  useLayoutEffect(() => {
    if (!active) {
      lifetime.current = null;
      return;
    }
    const token = {};
    lifetime.current = token;
    return () => {
      if (lifetime.current === token) lifetime.current = null;
    };
  }, [scope, active]);
  function capture() {
    const token = lifetime.current;
    const assert = () => {
      if (!token || lifetime.current !== token)
        throw new ApiError(
          409,
          "This meeting document is no longer open. Reopen it before continuing.",
        );
      guard();
    };
    assert();
    return assert;
  }
  const allowed =
    active &&
    identity.isSuccess &&
    !identity.isFetching &&
    !identity.error &&
    initiatingActor?.userId === identity.data?.user.id &&
    initiatingActor?.tenantId === identity.data?.tenant?.id &&
    (identity.data?.role === "standard_user" ||
      canAdminister(identity.data?.role));
  return { identity, capture, allowed };
}
