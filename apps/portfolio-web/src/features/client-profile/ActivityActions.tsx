"use client";
import { useRef, useState } from "react";
import { DropdownMenu } from "radix-ui";
import { QueryState } from "@/shared/ui/QueryState";
import type { Activity } from "./contracts";
import { useChangeActivity } from "./activity-mutations";
import { EditActivity, RemoveActivity } from "./ActivityDialogs";
import styles from "./activity-actions.module.css";

export function ActivityActions({
  clientId,
  item,
  onFallbackFocus,
}: {
  clientId: string;
  item: Activity;
  onFallbackFocus: () => void;
}) {
  const [dialog, setDialog] = useState<"edit" | "remove" | null>(null);
  const openingDialog = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const mutation = useChangeActivity(clientId, item);
  const close = () => {
    openingDialog.current = false;
    setDialog(null);
  };
  const returnFocus = () => {
    if (trigger.current) trigger.current.focus();
    else onFallbackFocus();
  };
  if (item.origin !== "recorded") return null;
  return (
    <>
      <div className={styles.actions}>
        {item.dueAt && (
          <button
            className="button"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({ action: "settle", settled: !item.settledAt })
            }
          >
            {mutation.isPending
              ? "Updating…"
              : item.settledAt
                ? "Reopen"
                : "Settle"}
          </button>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            ref={trigger}
            className={styles.trigger}
            aria-label={`Activity actions: ${item.title}`}
            disabled={mutation.isPending}
          >
            ⋯
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={styles.menu}
              align="end"
              onCloseAutoFocus={(event) => {
                // The closing menu must not steal the newly opened dialog's focus.
                if (openingDialog.current) event.preventDefault();
              }}
            >
              <DropdownMenu.Item
                onSelect={() => {
                  openingDialog.current = true;
                  setDialog("edit");
                }}
              >
                Edit activity
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  openingDialog.current = true;
                  setDialog("remove");
                }}
              >
                Remove activity…
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      <div className={styles.error}>
        <QueryState
          error={mutation.error}
          retry={() => {
            if (mutation.variables) mutation.mutate(mutation.variables);
          }}
        />
      </div>
      {dialog === "edit" && (
        <EditActivity
          clientId={clientId}
          item={item}
          onClose={close}
          onReturnFocus={returnFocus}
        />
      )}
      {dialog === "remove" && (
        <RemoveActivity
          clientId={clientId}
          item={item}
          onClose={close}
          onReturnFocus={returnFocus}
        />
      )}
    </>
  );
}
