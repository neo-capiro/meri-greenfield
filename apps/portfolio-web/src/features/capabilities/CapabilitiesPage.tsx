"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import type { Destinations } from "@/shared/config/config";
import { QueryState } from "@/shared/ui/QueryState";
import { useCapabilities } from "./queries";
import { maturity } from "./contracts";
import { CapabilityEditor } from "./CapabilityEditor";
import { CapabilityFit } from "./CapabilityFit";
import { Registrations } from "./Registrations";
import styles from "./capabilities.module.css";
export function CapabilitiesPage({
  clientId,
  destinations,
}: {
  clientId: string;
  destinations: Destinations;
}) {
  const query = useCapabilities(clientId);
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [codes, setCodes] = useState(false);
  const selected = params.get("capability");
  const capability = query.data?.find((cap) => cap.id === selected);
  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("capability", id);
    else next.delete("capability");
    router.replace(`${path}?${next}`, { scroll: false });
  };
  return (
    <div className="page stack">
      <header className="row between">
        <h1>Capabilities</h1>
        <div className="row">
          <button className="button" onClick={() => open("new")}>
            Add capability
          </button>
          <button className="button" onClick={() => setCodes(true)}>
            Registrations &amp; codes
          </button>
        </div>
      </header>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <section className="card stack">
          <header className="row between">
            <p className="eyebrow">Capability areas</p>
            <small>
              {query.data.length} areas ·{" "}
              {
                query.data.filter((cap) => maturity(cap.trl) === "Fielded")
                  .length
              }{" "}
              fielded
            </small>
          </header>
          <div className={styles.grid}>
            {query.data.map((cap) => (
              <button
                key={cap.id}
                className={styles.card}
                onClick={() => open(cap.id)}
              >
                <span className="monogram">▦</span>
                <strong>{cap.name}</strong>
                <p className="muted">{cap.description}</p>
                <div className="row">
                  <span className="chip">{maturity(cap.trl)}</span>
                  <small>
                    {cap.peNumbers.join(", ") ||
                      cap.peNumber ||
                      "No program line mapped"}
                  </small>
                </div>
              </button>
            ))}
          </div>
          {query.data.length === 0 && (
            <p className="empty">
              Add a capability area to describe what this client can deliver.
            </p>
          )}
        </section>
      )}
      <CapabilityFit
        clientId={clientId}
        existingApp={destinations.existingApp}
      />
      <p className="muted">
        Past advocacy and submissions:{" "}
        <Link href={`/portfolio/${clientId}/objectives`}>
          Advocacy history ↗
        </Link>
      </p>
      <CapabilityEditor
        key={selected ?? "closed"}
        clientId={clientId}
        capability={capability}
        open={selected === "new" || Boolean(capability)}
        onClose={() => open(null)}
      />
      <Registrations
        clientId={clientId}
        open={codes}
        onClose={() => setCodes(false)}
      />
    </div>
  );
}
