"use client";
import { Dialog as Primitive } from "radix-ui";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./dialog.module.css";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  drawer = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  drawer?: boolean;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className={styles.overlay} />
        <Primitive.Content
          className={`${styles.content} ${drawer ? styles.drawer : ""}`}
        >
          <header className="row between">
            <Primitive.Title asChild>
              <h2>{title}</h2>
            </Primitive.Title>
            <Primitive.Close
              className="button ghost iconButton"
              aria-label="Close"
            >
              <X size={16} />
            </Primitive.Close>
          </header>
          {description ? (
            <Primitive.Description className="muted">
              {description}
            </Primitive.Description>
          ) : (
            <Primitive.Description className="srOnly">
              {title}
            </Primitive.Description>
          )}
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
