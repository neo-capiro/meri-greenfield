"use client";
import { useEffect, useRef, useState } from "react";
import { DropdownMenu } from "radix-ui";
import type { Activity } from "./contracts";
import { useChangeActivity } from "./activity-mutations";
import {
  ActivityMutationStatus,
  EditActivity,
  RemoveActivity,
} from "./ActivityDialogs";
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
  const pinFocus = useRef(false);
  const close = () => {
    openingDialog.current = false;
    setDialog(null);
  };
  const state = useChangeActivity(clientId, item, close);
  const { mutation } = state;
  useEffect(() => {
    if (!mutation.isPending && pinFocus.current) {
      pinFocus.current = false;
      if (document.activeElement === document.body) trigger.current?.focus();
    }
  }, [mutation.isPending]);
  const returnFocus = () => {
    if (trigger.current) trigger.current.focus();
    else onFallbackFocus();
  };
  if (item.origin !== "recorded") return null;
  return (
    <>
      <div className={styles.actions}>
        {item.kind === "note" && item.pinned && (
          <span className={styles.pinned}>★ Pinned</span>
        )}
        {item.dueAt && (
          <button
            className="button"
            disabled={mutation.isPending || state.reviewing || !state.canWrite}
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
            disabled={mutation.isPending || state.reviewing || !state.canOpen}
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
              {item.kind === "note" && (
                <DropdownMenu.Item
                  disabled={!state.canWrite}
                  onSelect={() => {
                    pinFocus.current = true;
                    mutation.mutate({ action: "pin", pinned: !item.pinned });
                  }}
                >
                  {item.pinned ? "Unpin note" : "Pin note"}
                </DropdownMenu.Item>
              )}
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
      {!dialog && (
        <ActivityMutationStatus
          state={state}
          retry={() => {
            if (mutation.variables) mutation.mutate(mutation.variables);
          }}
        />
      )}
      {dialog === "edit" && (
        <EditActivity
          item={item}
          state={state}
          onClose={close}
          onReturnFocus={returnFocus}
        />
      )}
      {dialog === "remove" && (
        <RemoveActivity
          item={item}
          state={state}
          onClose={close}
          onReturnFocus={returnFocus}
        />
      )}
    </>
  );
}
