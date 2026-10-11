"use client";
import type { ComponentProps } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useIdentity, canAdminister } from "@/shared/auth/identity";
import type { Client } from "@/features/portfolio/public";
import { useArchiveClient } from "./mutations";
export function ArchiveClientDialog({
  open,
  onOpenChange,
  client,
  onArchived,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  onArchived: () => void;
  onCloseAutoFocus?: ComponentProps<typeof Dialog>["onCloseAutoFocus"];
}) {
  const identity = useIdentity();
  const archive = useArchiveClient(() => {
    onOpenChange(false);
    onArchived();
  });
  const permitted =
    identity.data?.role === "standard_user" ||
    canAdminister(identity.data?.role);
  return (
    <Dialog
      open={open}
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(value) => {
        if (!archive.isPending) onOpenChange(value);
      }}
      title="Archive client"
      description={`Archive ${client.name}?`}
    >
      <p>
        This removes the client from the active Portfolio. Its saved records are
        retained.
      </p>
      <QueryState
        pending={identity.isPending}
        error={identity.error}
        retry={() => void identity.refetch()}
      />
      <QueryState error={archive.error} />
      {identity.data && !permitted && (
        <p role="alert">Your role cannot archive clients.</p>
      )}
      <div className="formActions">
        <button
          className="button"
          disabled={archive.isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </button>
        <button
          className="button"
          disabled={!permitted || archive.isPending}
          onClick={() => archive.mutate(client.id)}
        >
          {archive.isPending ? "Archiving…" : "Archive client"}
        </button>
      </div>
    </Dialog>
  );
}
