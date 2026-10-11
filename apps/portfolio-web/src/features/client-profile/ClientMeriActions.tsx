"use client";
/* Figma static trigger icons are reused from the existing client header. */
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { DropdownMenu } from "radix-ui";
import type { Client } from "@/features/portfolio/public";
import { ClientAttendancePreferences } from "@/features/calendar/attendance/public";
import { ClientEnrichmentDialog } from "./enrichment/public";
import headerStyles from "./client-header.module.css";
import styles from "./client-meri-actions.module.css";

export function ClientMeriActions({ client }: { client: Client }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [preferences, setPreferences] = useState(false);
  const [enrichment, setEnrichment] = useState(false);
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          ref={trigger}
          className={`button ${headerStyles.meri}`}
          aria-label="Meri actions"
        >
          <img src="/design/411-55991-imgIcon16.svg" alt="" />
          <span>Meri actions</span>
          <img src="/design/411-55991-imgChevron1.svg" alt="" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={styles.menu}
            align="end"
            sideOffset={8}
            onCloseAutoFocus={(event) => {
              if (preferences || enrichment) event.preventDefault();
            }}
          >
            <DropdownMenu.Item
              className={styles.item}
              disabled
              title="Client context handoff is not connected yet"
            >
              <span>✦ Ask Meri about this client</span>
              <small>Open Meri with this client in context.</small>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={styles.item}
              onSelect={() => setEnrichment(true)}
            >
              <span>✦ Fill with Meri</span>
              <small>
                Review saved suggestions from connected sources before applying
                selected findings.
              </small>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={styles.item}
              onSelect={() => setPreferences(true)}
            >
              <span>✦ Notetaker for this client</span>
              <small>
                Choose whether Meri joins this client’s meetings automatically.
              </small>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ClientEnrichmentDialog
        clientId={client.id}
        open={enrichment}
        onOpenChange={setEnrichment}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      />
      {preferences && (
        <ClientAttendancePreferences
          clientId={client.id}
          clientName={client.name}
          open
          onOpenChange={setPreferences}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        />
      )}
    </>
  );
}
