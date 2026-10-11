"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { useSaveFacility } from "./mutations";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import type { Facility } from "./contracts";
import { facilityFormBody } from "./facility-map-model";
export function FacilityDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
  facility,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facility?: Facility;
}) {
  const [validation, setValidation] = useState("");
  const mutation = useSaveFacility(clientId, facility?.id, () =>
    onOpenChange(false),
  );
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const body = facilityFormBody(raw, facility);
      setValidation("");
      mutation.mutate(body);
    } catch (error) {
      setValidation(
        error instanceof Error ? error.message : "Review the facility details.",
      );
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) onOpenChange(value);
      }}
      title={facility ? "Edit facility" : "Add facility"}
      description={`Location for ${clientName}. Complete the address to request automatic geocoding.`}
    >
      <form className="stack" onSubmit={submit}>
        <label>
          Facility name
          <input name="name" required defaultValue={facility?.name} autoFocus />
        </label>
        <label>
          Street address
          <input
            name="addressLine"
            autoComplete="street-address"
            defaultValue={facility?.addressLine ?? ""}
          />
        </label>
        <div className="formGrid">
          <label>
            City
            <input
              name="city"
              autoComplete="address-level2"
              defaultValue={facility?.city ?? ""}
            />
          </label>
          <label>
            State / territory
            <input
              name="state"
              autoComplete="address-level1"
              pattern="[A-Za-z]{2}"
              maxLength={2}
              placeholder="CA"
              defaultValue={facility?.state ?? ""}
            />
          </label>
          <label>
            ZIP code
            <input
              name="zip"
              autoComplete="postal-code"
              defaultValue={facility?.zip ?? ""}
            />
          </label>
          <label>
            Employees
            <input
              name="employeeCount"
              type="number"
              min={0}
              step={1}
              defaultValue={facility?.employeeCount ?? ""}
            />
          </label>
          <label>
            Congressional district
            <input
              name="congressionalDistrict"
              pattern="[0-9]{1,2}"
              maxLength={2}
              placeholder="12 or 00"
              defaultValue={facility?.congressionalDistrict ?? ""}
            />
          </label>
          <label>
            State House district
            <input
              name="stateHouseDistrict"
              maxLength={64}
              defaultValue={facility?.stateHouseDistrict ?? ""}
            />
          </label>
          <label>
            State Senate district
            <input
              name="stateSenateDistrict"
              maxLength={64}
              defaultValue={facility?.stateSenateDistrict ?? ""}
            />
          </label>
        </div>
        <p className="muted">
          Use a bare House district number, or 00 for at-large. Leave districts
          blank to resolve from the address. A later successful geocode can
          replace manual state districts.
        </p>
        <TextareaField
          label="Notes"
          name="notes"
          defaultValue={facility?.notes ?? ""}
        />
        {validation && (
          <p className="danger" role="alert">
            {validation}
          </p>
        )}
        <QueryState error={mutation.error} />
        <div className="formActions">
          <button
            type="button"
            className="button"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button className="button primary" disabled={mutation.isPending}>
            {mutation.isPending
              ? "Saving…"
              : facility
                ? "Save changes"
                : "Add facility"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
