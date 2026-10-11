"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  clientLocation,
  clientSectorLabel,
  initials,
  memberName,
  safeWebsite,
  type Client,
  type Member,
} from "./contracts";
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
      <table aria-label="Portfolio profiles">
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
                  <ProfileLogo client={client} />
                  <span>
                    <strong>{client.name}</strong>
                    <small className={styles.website}>
                      {client.website ?? "No website"}
                    </small>
                  </span>
                </Link>
              </td>
              <td>{client.profileType ?? "—"}</td>
              <td>{clientSectorLabel(client) ?? "—"}</td>
              <td>
                {owners?.[client.id]
                  ? memberName(owners[client.id]?.accountOwner)
                  : "Owner unavailable"}
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
      {rows.map((client) => (
        <ProfileCard
          key={client.id}
          client={client}
          ownership={owners?.[client.id]}
        />
      ))}
    </div>
  );
}
export function ProfileCard({
  client,
  ownership,
}: {
  client: Client;
  ownership?: { accountOwner: Member | null };
}) {
  const owner = ownership?.accountOwner;
  const location = clientLocation(client);
  const sector = clientSectorLabel(client);
  return (
    <article className={styles.profileCard}>
      <Link
        className={styles.cardTop}
        href={`/portfolio/${client.id}`}
        aria-label={`Open ${client.name}`}
      >
        <ProfileLogo client={client} />
        <div className={styles.cardIdentity}>
          <h3>{client.name}</h3>
          <small>
            {sector ?? "Sector not supplied"}
            {location && ` · ${location}`}
          </small>
        </div>
      </Link>
      <div className={styles.cardBottom}>
        <span
          className="chip"
          aria-label={`Profile status: ${client.profileStatus}`}
        >
          {client.profileStatus}
        </span>
        <span
          className={styles.ownerAvatar}
          title={ownership ? memberName(owner) : "Owner unavailable"}
          aria-label={`Account owner: ${ownership ? memberName(owner) : "unavailable"}`}
        >
          {owner ? initials(memberName(owner)) : "—"}
        </span>
      </div>
    </article>
  );
}
function ProfileLogo({ client }: { client: Client }) {
  const src = safeWebsite(client.logoUrl);
  return (
    <span className={styles.profileLogo}>
      {src ? (
        <img src={src} alt="" width={40} height={40} />
      ) : (
        initials(client.name)
      )}
    </span>
  );
}
