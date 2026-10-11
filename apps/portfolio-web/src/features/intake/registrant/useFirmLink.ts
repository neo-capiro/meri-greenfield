"use client";
import { useRef, useState } from "react";
import type { RegistrantHit } from "./contracts";
import { useLinkRegistrant } from "./queries";

/** Owns only firm-link confirmation and its explicit readback requirement. */
export function useFirmLink({
  permitted,
  blocked,
  refetch,
  onLinked,
}: {
  permitted: boolean;
  blocked: boolean;
  refetch: () => Promise<{ isSuccess: boolean }>;
  onLinked: (id: number) => void;
}) {
  const mutation = useLinkRegistrant();
  const [choice, setChoice] = useState<RegistrantHit>();
  const [needsReadback, setNeedsReadback] = useState(false);
  const [reading, setReading] = useState(false);
  const lock = useRef(false);
  async function confirm() {
    if (
      !permitted ||
      !choice ||
      blocked ||
      lock.current ||
      mutation.isPending ||
      needsReadback
    )
      return;
    lock.current = true;
    try {
      await mutation.mutateAsync(choice.id);
      setChoice(undefined);
      onLinked(choice.id);
    } catch {
      setNeedsReadback(true);
    } finally {
      lock.current = false;
    }
  }
  async function refresh() {
    if (blocked || lock.current || !permitted) return;
    lock.current = true;
    setReading(true);
    try {
      const result = await refetch();
      if (result.isSuccess) {
        setNeedsReadback(false);
        mutation.reset();
        setChoice(undefined);
      }
    } finally {
      setReading(false);
      lock.current = false;
    }
  }
  return {
    choice,
    setChoice,
    needsReadback,
    reading,
    mutation,
    confirm,
    refresh,
    isLocked: () => lock.current,
  };
}
