"use client";
import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { AddGovernmentTargetButton } from "@/features/relationships/public";
import type { Facility } from "./contracts";
import { FacilityDialog } from "./FacilityDialog";
import { FacilityGeocoding } from "./FacilityGeocoding";
import { FacilityRepresentation } from "./FacilityRepresentation";
import { facilityAddress, facilityDistrict } from "./facility-map-model";
import { useFacilityRepresentation } from "./facility-map-queries";
import { useFacilityAction } from "./facility-map-mutations";
import styles from "./facility-map.module.css";

export function FacilityDetailDialog({
  clientId,
  clientName,
  facility,
  open,
  onOpenChange,
}: {
  clientId: string;
  clientName: string;
  facility: Facility;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const representation = useFacilityRepresentation(clientId, open);
  const mutation = useFacilityAction(clientId);
  const delegation = representation.data?.find(
    (row) => row.facility.id === facility.id,
  )?.representation;
  return (
    <>
      <Dialog
        open={open}
        className={styles.detail}
        onOpenChange={onOpenChange}
        title={`${facility.name}${facilityDistrict(facility) ? ` · ${facilityDistrict(facility)}` : ""}`}
        description={`Location for ${clientName}. ${facilityAddress(facility)}`}
      >
        <div className={styles.stats}>
          <div>
            <strong>
              {facility.employeeCount?.toLocaleString() ?? "Not reported"}
            </strong>
            <small>EMPLOYEES</small>
          </div>
          <div>
            <strong>{facilityDistrict(facility) ?? "Unresolved"}</strong>
            <small>HOUSE DISTRICT</small>
          </div>
          <div>
            <strong>
              {delegation && !delegation.unresolved
                ? delegation.federal.senate.length
                : "—"}
            </strong>
            <small>MATCHED SENATORS</small>
          </div>
        </div>
        {facility.notes && <p className={styles.notes}>{facility.notes}</p>}
        <section className="stack" aria-label="Elected representation">
          <h3>Delegation</h3>
          <QueryState
            pending={representation.isPending}
            error={representation.error}
            retry={() => void representation.refetch()}
          />
          {representation.data && <FacilityRepresentation value={delegation} />}
          {delegation && !delegation.unresolved && delegation.federal.house && (
            <AddGovernmentTargetButton
              clientId={clientId}
              memberId={delegation.federal.house.bioguideId}
              name={delegation.federal.house.fullName}
              sourceDirectory="congress"
            />
          )}
        </section>
        <FacilityGeocoding clientId={clientId} facility={facility} />
        <div className="row between">
          <Link
            className="button"
            href={`/portfolio/${clientId}/relationships?kind=government`}
          >
            Open relationships
          </Link>
          <div className="row">
            <button className="button" onClick={() => setEditing(true)}>
              Edit facility
            </button>
            <button
              className="button ghost danger"
              onClick={() => setRemoving(true)}
            >
              Remove
            </button>
          </div>
        </div>
      </Dialog>
      <FacilityDialog
        key={`${facility.id}-${editing}`}
        clientId={clientId}
        clientName={clientName}
        facility={facility}
        open={editing}
        onOpenChange={setEditing}
      />
      <Dialog
        open={removing}
        onOpenChange={(value) => {
          if (!mutation.isPending) setRemoving(value);
        }}
        title="Remove facility"
        description={`Remove ${facility.name} from ${clientName}? Its location will no longer contribute to this client's footprint.`}
      >
        <QueryState error={mutation.error} />
        <div className="formActions">
          <button
            className="button"
            disabled={mutation.isPending}
            onClick={() => setRemoving(false)}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { kind: "remove", facilityId: facility.id },
                {
                  onSuccess: () => {
                    setRemoving(false);
                    onOpenChange(false);
                  },
                },
              )
            }
          >
            {mutation.isPending ? "Removing…" : "Remove facility"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
