"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { initials, memberName, type Client, type Member } from "./contracts";
import styles from "./portfolio.module.css";
export function ProfileResults({
  rows,
  view,
  owners,
}: {
  rows: Client[];
  view: "list" | "cards";
  owners?: Record<string, { accountOwner: Member | null }>;
}) {
  return view === "list" ? (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Organization</th>
            <th>Type</th>
            <th>Sector</th>
            <th>Account owner</th>
            <th>Status</th>
            <th>
              <span className="srOnly">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((client) => (
            <tr key={client.id}>
              <td>
                <Link className="row" href={`/portfolio/${client.id}`}>
                  <span className="monogram">
                    {client.logoUrl ? (
                      <img src={client.logoUrl} alt="" width={40} height={40} />
                    ) : (
                      initials(client.name)
                    )}
                  </span>
                  <span>
                    <strong>{client.name}</strong>
                    <small className={styles.website}>
                      {client.website ?? "No website"}
                    </small>
                  </span>
                </Link>
              </td>
              <td>{client.profileType ?? "—"}</td>
              <td>{client.sectorTag ?? "—"}</td>
              <td>
                {owners ? memberName(owners[client.id]?.accountOwner) : "—"}
              </td>
              <td>
                <span className="chip">{client.profileStatus}</span>
              </td>
              <td>
                <Link
                  href={`/portfolio/${client.id}`}
                  aria-label={`Open ${client.name}`}
                >
                  <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className={styles.cards}>
      {rows.map((client) => {
        const owner = owners?.[client.id]?.accountOwner;
        return (
          <article className={styles.profileCard} key={client.id}>
            <Link
              className="row"
              href={`/portfolio/${client.id}`}
              aria-label={`Open ${client.name}`}
            >
              <span className="monogram">
                {client.logoUrl ? (
                  <img src={client.logoUrl} width={40} height={40} alt="" />
                ) : (
                  initials(client.name)
                )}
              </span>
              <div className={styles.cardIdentity}>
                <h3>{client.name}</h3>
                <small>{client.sectorTag ?? "Sector not supplied"}</small>
              </div>
            </Link>
            <div className="row between">
              <span className="chip">{client.profileStatus}</span>
              <span
                className={styles.ownerAvatar}
                title={memberName(owner)}
                aria-label={`Account owner: ${memberName(owner)}`}
              >
                {owner ? initials(memberName(owner)) : "—"}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
