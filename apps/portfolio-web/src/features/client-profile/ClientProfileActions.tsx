"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { MoreHorizontal } from "lucide-react";
import type { Client } from "@/features/portfolio/public";
import {
  ClientIntakeDialog,
  ArchiveClientDialog,
} from "@/features/client-intake/public";
import { useIdentity, canAdminister } from "@/shared/auth/identity";
import { ClientProfileExport } from "./export/public";
import styles from "./client-header.module.css";

export function ClientProfileActions({ client }: { client: Client }) {
  const identity = useIdentity();
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const [action, setAction] = useState<"edit" | "archive" | "export" | null>(
    null,
  );
  const role = identity.data?.role;
  const editable = canAdminister(role);
  const archivable = role === "standard_user" || editable;
  const exportable = Boolean(
    identity.data?.user.id &&
    identity.data.tenant?.id &&
    !identity.isFetching &&
    !identity.error &&
    archivable,
  );
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };
  return (
    <>
      <DropdownMenu.Root open={menu} onOpenChange={setMenu}>
        <DropdownMenu.Trigger
          ref={trigger}
          className="button iconButton"
          aria-label={`More actions for ${client.name}`}
        >
          <MoreHorizontal size={20} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={styles.menu}
            align="end"
            onCloseAutoFocus={(event) => {
              if (action) event.preventDefault();
            }}
          >
            <DropdownMenu.Item
              className={styles.menuItem}
              disabled={!editable}
              onSelect={() => setAction("edit")}
            >
              Edit client profile
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={styles.menuItem}
              disabled={!exportable}
              onSelect={() => setAction("export")}
            >
              Export client profile JSON
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={styles.menuItem}
              disabled={!archivable}
              onSelect={() => setAction("archive")}
            >
              Archive client
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ClientIntakeDialog
        client={client}
        open={action === "edit"}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        onSaved={() => setAction(null)}
        onCloseAutoFocus={restoreFocus}
      />
      <ClientProfileExport
        clientId={client.id}
        open={action === "export"}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        onCloseAutoFocus={restoreFocus}
      />
      {action === "archive" && (
        <ArchiveClientDialog
          client={client}
          open
          onOpenChange={(open) => {
            if (!open) setAction(null);
          }}
          onArchived={() => router.push("/portfolio")}
          onCloseAutoFocus={restoreFocus}
        />
      )}
    </>
  );
}
