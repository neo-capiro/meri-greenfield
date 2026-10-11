"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { QueryState } from "@/shared/ui/QueryState";
import { useFacilities } from "./queries";
import { FacilityDialog } from "./FacilityDialog";
import { FacilityDetailDialog } from "./FacilityDetailDialog";
import { FacilityMapDialog } from "./FacilityMapDialog";
import { FacilityMap } from "./FacilityMap";
import { facilityCoordinates, facilityDistrict } from "./facility-map-model";
import styles from "./facility-map.module.css";

export function FacilitiesCard({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const query = useFacilities(clientId);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [expanded, setExpanded] = useState(false);
  const facilities = query.data ?? [];
  const selected = facilities.find((facility) => facility.id === selectedId);
  const stateCount = new Set(facilities.map((f) => f.state).filter(Boolean))
    .size;
  const districtCount = new Set(
    facilities.map(facilityDistrict).filter(Boolean),
  ).size;
  return (
    <section
      className={`card stack ${styles.card}`}
      aria-label="District nexus"
    >
      <header className={styles.heading}>
        <div className={styles.title}>
          <h2>District nexus</h2>
          {query.data && (
            <p>
              {facilities.length} locations · {stateCount} states ·{" "}
              {districtCount} districts
            </p>
          )}
        </div>
        <div className={styles.actions}>
          <button
            className="button"
            aria-label="Add facility"
            onClick={() => setCreating(true)}
          >
            <img src="/design/411-47066-plus.svg" alt="" />
          </button>
          <button
            className="button ghost"
            aria-label="Open district map"
            onClick={() => setExpanded(true)}
          >
            <img src="/design/411-47066-maximize.svg" alt="" />
          </button>
        </div>
      </header>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      <div className={styles.body}>
        <ul className={styles.locations}>
          {facilities.map((facility) => (
            <li key={facility.id}>
              <button
                className={styles.location}
                aria-pressed={selectedId === facility.id}
                onClick={() => setSelectedId(facility.id)}
              >
                <img src="/design/411-47066-dot.svg" alt="" />
                <span className={styles.locationText}>
                  <span className={styles.locationTop}>
                    <strong>{facility.name}</strong>
                    <small>
                      {facilityDistrict(facility) ?? facility.state}
                    </small>
                  </span>
                  <small>
                    {facility.employeeCount === null
                      ? "Staff not reported"
                      : `${facility.employeeCount.toLocaleString()} staff`}
                  </small>
                  {facility.geocodeStatus &&
                    facility.geocodeStatus !== "matched" && (
                      <small>
                        {facility.geocodeStatus.replaceAll("_", " ")}
                      </small>
                    )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {facilities.some(facilityCoordinates) ? (
          <FacilityMap
            facilities={facilities}
            onSelect={(facility) => setSelectedId(facility.id)}
            compact
          />
        ) : (
          <div className={styles.artwork}>
            <img
              src="/design/411-47028-imgUsDotMapAlbersUsa.svg"
              alt="United States map illustration. No coordinate pins are available."
            />
          </div>
        )}
      </div>
      {query.data && !facilities.length && (
        <p className="muted">
          No facilities yet. Add a location with the plus action.
        </p>
      )}
      <FacilityDialog
        key={`new-${creating}`}
        clientId={clientId}
        clientName={clientName}
        open={creating}
        onOpenChange={setCreating}
      />
      {selected && (
        <FacilityDetailDialog
          key={selected.id}
          clientId={clientId}
          clientName={clientName}
          facility={selected}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedId("");
          }}
        />
      )}
      <FacilityMapDialog
        clientId={clientId}
        clientName={clientName}
        facilities={facilities}
        open={expanded}
        onOpenChange={setExpanded}
        onSelect={(facility) => {
          setExpanded(false);
          setSelectedId(facility.id);
        }}
      />
    </section>
  );
}
