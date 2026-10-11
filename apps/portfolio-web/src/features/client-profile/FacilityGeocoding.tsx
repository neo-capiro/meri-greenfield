"use client";
import { useState } from "react";
import { QueryState } from "@/shared/ui/QueryState";
import type { Facility } from "./contracts";
import { useFacilityAction } from "./facility-map-mutations";
import styles from "./facility-map.module.css";

export function FacilityGeocoding({
  clientId,
  facility,
}: {
  clientId: string;
  facility: Facility;
}) {
  const mutation = useFacilityAction(clientId);
  const [queued, setQueued] = useState(false);
  const hasAddress = Boolean(
    facility.addressLine?.trim() &&
    facility.city?.trim() &&
    facility.state?.trim(),
  );
  return (
    <section className="stack" aria-label="Address resolution">
      <h3>Address resolution</h3>
      <p className="muted">
        Geocoder:{" "}
        {facility.geocodeStatus?.replaceAll("_", " ") ?? "Not requested"}
        {facility.districtSource
          ? ` · District source: ${facility.districtSource === "geocoded" ? "Geocoded" : facility.districtSource}`
          : ""}
      </p>
      {facility.geocodeMatchedAddress && (
        <p>{facility.geocodeMatchedAddress}</p>
      )}
      {facility.congressionalDistrictCongress != null && (
        <p className="muted">
          District boundary source: {facility.congressionalDistrictCongress}th
          Congress.
        </p>
      )}
      {facility.geocodeLastError && (
        <p className="danger">{facility.geocodeLastError}</p>
      )}
      {facility.geocodeCandidates?.length ? (
        <fieldset className={styles.candidates}>
          <legend>Choose a Census address</legend>
          {!facility.geocodeCandidateRevision && (
            <p className="muted">
              Reviewed address selection is unavailable from this service.
            </p>
          )}
          {facility.geocodeCandidates.map((candidate, candidateIndex) => (
            <div className={styles.candidate} key={candidateIndex}>
              <span>
                {candidate.matchedAddress ?? "Address unavailable"}
                {candidate.congressionalDistrict
                  ? ` · District ${candidate.congressionalDistrict}`
                  : ""}
              </span>
              <button
                className="button"
                disabled={
                  mutation.isPending ||
                  !candidate.matchedAddress ||
                  !facility.geocodeCandidateRevision
                }
                onClick={() => {
                  if (!facility.geocodeCandidateRevision) return;
                  mutation.mutate({
                    kind: "geocode-candidate",
                    facilityId: facility.id,
                    candidateIndex,
                    expectedRevision: facility.geocodeCandidateRevision,
                  });
                }}
              >
                Use this address
              </button>
            </div>
          ))}
        </fieldset>
      ) : null}
      <div className="row">
        <button
          className="button"
          disabled={mutation.isPending || !hasAddress}
          onClick={() =>
            mutation.mutate({
              kind: "resolve-district",
              facilityId: facility.id,
            })
          }
        >
          {mutation.isPending && mutation.variables.kind === "resolve-district"
            ? "Resolving…"
            : "Resolve district"}
        </button>
        <button
          className="button ghost"
          disabled={mutation.isPending || !hasAddress}
          onClick={() =>
            mutation.mutate(
              { kind: "geocode", facilityId: facility.id },
              { onSuccess: () => setQueued(true) },
            )
          }
        >
          Retry geocoding
        </button>
      </div>
      {!hasAddress && (
        <p className="muted">
          Enter a street address, city and state before geocoding.
        </p>
      )}
      {queued && (
        <p role="status" className="muted">
          Retry requested. The current geocoder result above updates when the
          service finishes.
        </p>
      )}
      <QueryState error={mutation.error} />
    </section>
  );
}
