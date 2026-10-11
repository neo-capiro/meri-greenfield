"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Plus, MapPin } from "lucide-react";
import { QueryState } from "@/shared/ui/QueryState";
import { useFacilities } from "./queries";
import { FacilityDialog } from "./FacilityDialog";
import type { Facility } from "./contracts";
import styles from "./overview.module.css";
export function FacilitiesCard({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const query = useFacilities(clientId);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Facility>();
  return (
    <section className="card stack">
      <header className="row between">
        <div>
          <p className="eyebrow">Locations</p>
          <h2>Facilities</h2>
        </div>
        <button
          className="button iconButton"
          aria-label="Add facility"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} />
        </button>
      </header>
      <div className={styles.map}>
        <img
          src="/design/411-47028-imgUsDotMapAlbersUsa.svg"
          alt="United States facility map"
        />
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data?.length ? (
        <ul className={styles.facilityList}>
          {query.data.map((facility) => (
            <li key={facility.id}>
              <button
                className="button ghost row"
                onClick={() => setSelected(facility)}
              >
                <MapPin size={14} />
                <span>
                  {facility.name}
                  <small className={styles.block}>
                    {[facility.city, facility.state]
                      .filter(Boolean)
                      .join(", ") || "Address not specified"}
                  </small>
                </span>
              </button>
              {facility.geocodeStatus &&
                facility.geocodeStatus !== "matched" && (
                  <small>{facility.geocodeStatus.replaceAll("_", " ")}</small>
                )}
            </li>
          ))}
        </ul>
      ) : (
        query.data && (
          <p className="muted">
            No facilities yet. Add a location with the plus action.
          </p>
        )
      )}
      <FacilityDialog
        key={selected?.id ?? "new"}
        clientId={clientId}
        clientName={clientName}
        open={creating || Boolean(selected)}
        facility={selected}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setSelected(undefined);
          }
        }}
      />
    </section>
  );
}
