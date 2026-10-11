"use client";
import { Dialog as Primitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./dialog.module.css";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  drawer = false,
  wide = false,
  className = "",
  onCloseAutoFocus,
  onOpenAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  drawer?: boolean;
  wide?: boolean;
  className?: string;
  onCloseAutoFocus?: ComponentProps<
    typeof Primitive.Content
  >["onCloseAutoFocus"];
  onOpenAutoFocus?: ComponentProps<typeof Primitive.Content>["onOpenAutoFocus"];
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className={styles.overlay} />
        <Primitive.Content
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={onOpenAutoFocus}
          className={`${styles.content} ${drawer ? styles.drawer : ""} ${wide ? styles.wide : ""} ${className}`}
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
