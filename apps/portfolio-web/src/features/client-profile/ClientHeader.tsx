"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { clientViews } from "@/shared/shell/client-views";
import { type Client, initials } from "@/features/portfolio/public";
import { ClientProfileActions } from "./ClientProfileActions";
import { ClientMeriActions } from "./ClientMeriActions";
import styles from "./client-header.module.css";
const asset = (name: string) => `/design/411-55991-${name}.svg`;
export function ClientHeader({ client }: { client: Client }) {
  const path = usePathname();
  const base = `/portfolio/${client.id}`;
  const view =
    clientViews.find((item) => path === `${base}${item.suffix}`) ??
    clientViews[0];
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "j" &&
        !event.altKey
      ) {
        event.preventDefault();
        setSwitching((value) => !value);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/portfolio" aria-label="Back to Portfolio">
            <img src={asset("imgIconArrowLeft")} alt="" />
          </Link>
          <Link href="/portfolio" className="muted">
            Portfolio
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={base} className={styles.clientName} title={client.name}>
            {client.name}
          </Link>
          <span aria-hidden="true">/</span>
          <DropdownMenu.Root open={switching} onOpenChange={setSwitching}>
            <DropdownMenu.Trigger
              className={styles.view}
              aria-label={`Switch client view: ${view.label}`}
              aria-keyshortcuts="Meta+J Control+J"
            >
              <img src={asset("imgIconLayoutGrid")} alt="" />
              {view.label}
              <img src={asset("imgIconChevronDown")} alt="" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={styles.menu} align="start">
                {clientViews.map((item) => (
                  <DropdownMenu.Item key={item.suffix} asChild>
                    <Link
                      href={`${base}${item.suffix}`}
                      aria-current={item === view ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </nav>
        <div className={styles.actions}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="button" aria-label="Quick add">
              <img src={asset("imgIconPlus")} alt="" />
              <span>Quick add</span>
              <img src={asset("imgChevron")} alt="" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={styles.menu} align="end">
                {[
                  ["New objective", "/objectives?new=1"],
                  ["New meeting", "/calendar?new=meeting"],
                  ["Log activity", "?log=1"],
                  ["Account notes", "?notes=1"],
                ].map(([label, suffix]) => (
                  <DropdownMenu.Item key={label} asChild>
                    <Link href={`${base}${suffix}`}>{label}</Link>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <ClientMeriActions client={client} />
          <ClientProfileActions client={client} />
        </div>
      </header>
      {view.suffix && (
        <section className={styles.strip} aria-label="Client identity">
          <span className={styles.avatar}>
            {client.logoUrl ? (
              <img src={client.logoUrl} alt="" width={40} height={40} />
            ) : (
              initials(client.name)
            )}
          </span>
          <div className={styles.identity}>
            <strong>{client.name}</strong>
            <p className="muted">
              {client.sectorTag ?? "Sector not specified"}
            </p>
          </div>
          <span className="chip">
            {client.profileStatus.toLowerCase().replaceAll("_", " ")} client
          </span>
        </section>
      )}
    </div>
  );
}
