"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./shell.module.css";
import { clientViews } from "./client-views";

const asset = (index: number) => `/design/471-93465-imgIcon${index || ""}.svg`;

export function PortfolioNavigation({
  client,
  onNavigate,
}: {
  client?: { id: string; name: string };
  onNavigate: () => void;
}) {
  const path = usePathname();
  const type = useSearchParams().get("type");
  const globalItems = [
    {
      label: "Overview",
      href: "/portfolio",
      icon: 0,
      active: path === "/portfolio" && !type,
    },
    {
      label: "Clients",
      href: "/portfolio?type=CLIENT",
      icon: 1,
      active: path === "/portfolio" && type === "CLIENT",
    },
    {
      label: "Prospects",
      href: "/portfolio/prospects",
      icon: 2,
      active: path === "/portfolio/prospects",
    },
  ];
  return (
    <>
      <p className="eyebrow">Portfolio</p>
      <nav aria-label="Portfolio" onClick={onNavigate}>
        {globalItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-label={`Portfolio ${item.label}`}
            title={item.label}
            aria-current={item.active ? "page" : undefined}
          >
            <img src={asset(item.icon)} alt="" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      {client && (
        <>
          <hr className="divider" />
          <p className={`eyebrow ${styles.clientName}`} title={client.name}>
            {client.name}
          </p>
          <nav aria-label="Client" onClick={onNavigate}>
            {clientViews.map(({ label, suffix, icon }) => (
              <Link
                key={suffix}
                href={`/portfolio/${client.id}${suffix}`}
                title={label}
                aria-current={
                  path === `/portfolio/${client.id}${suffix}`
                    ? "page"
                    : undefined
                }
              >
                <img src={asset(icon)} alt="" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </>
      )}
    </>
  );
}
