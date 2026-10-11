"use client";
/* Figma supplies the static line icons. The signed-in avatar is supplied by Clerk. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { PortfolioNavigation } from "./PortfolioNavigation";
import type { Destinations } from "../config/config";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import styles from "./shell.module.css";
const asset = (name: string) => `/design/411-41421-${name}`;
export function Shell({
  children,
  destinations,
  client,
  profileControl,
}: {
  children: ReactNode;
  destinations: Destinations;
  client?: { id: string; name: string };
  profileControl?: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const base = client ? `/portfolio/${client.id}` : "/portfolio";
  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header className={styles.header}>
        <button
          className={`button ghost iconButton ${styles.mobileToggle}`}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu size={18} />
        </button>
        {destinations.existingApp ? (
          <a
            className={styles.brand}
            href={`${destinations.existingApp}/`}
            aria-label="Capiro dashboard"
          >
            <img
              src={asset("imgCapiroWordmark.png")}
              alt="Capiro"
              width={77}
              height={26}
            />
          </a>
        ) : (
          <Link
            className={styles.brand}
            href="/portfolio"
            aria-label="Portfolio home"
          >
            <img
              src={asset("imgCapiroWordmark.png")}
              alt="Capiro"
              width={77}
              height={26}
            />
          </Link>
        )}
        <WorkspaceSwitcher destinations={destinations} />
        <nav className={styles.actions} aria-label="Global actions">
          <Link
            className="button ghost iconButton"
            href={client ? `${base}?log=1` : "/portfolio?log=1"}
            aria-label="Quick log"
            title="Quick log"
          >
            <img src={asset("imgIcon3.svg")} alt="" />
          </Link>
          <Link
            className="button ghost iconButton"
            href="/calendar"
            aria-label="Master calendar"
            title="Master calendar"
          >
            <img src={asset("imgIcon4.svg")} alt="" />
          </Link>
          <Link
            className="button ghost iconButton"
            href="/portfolio?search=1"
            aria-label="Search Portfolio"
            title="Search"
          >
            <img src={asset("imgIcon5.svg")} alt="" />
          </Link>
          <button
            className="button ghost iconButton"
            disabled
            aria-label="Updates unavailable"
            title="Updates contract has not been connected"
          >
            <img src={asset("imgIcon6.svg")} alt="" />
          </button>
          <div className={styles.avatar}>
            {profileControl ?? <UserButton />}
          </div>
        </nav>
      </header>
      <div className={styles.body}>
        <aside
          className={`${styles.sidebar} ${mobileOpen ? styles.open : ""}`}
          aria-label="Portfolio navigation"
        >
          <PortfolioNavigation
            client={client}
            onNavigate={() => setMobileOpen(false)}
          />
          <div className={styles.bottom}>
            {destinations.existingApp ? (
              <a href={`${destinations.existingApp}/settings`}>
                <img src="/design/471-93465-imgIcon10.svg" alt="" />
                Settings
              </a>
            ) : (
              <span className="row muted">
                <img src="/design/471-93465-imgIcon10.svg" alt="" />
                <span>Settings unavailable</span>
              </span>
            )}
          </div>
        </aside>
        <main id="main" className={styles.main}>
          {children}
        </main>
      </div>
    </>
  );
}
