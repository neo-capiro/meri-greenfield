"use client";
import { useState } from "react";
import { useClient } from "@/features/portfolio/public";
import { useIdentity, canAdminister } from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useSaveRegistrations } from "./registration-mutations";
import { certifications } from "@/features/client-intake/public";
const tokens = (value: FormDataEntryValue | null) => [
  ...new Set(
    String(value ?? "")
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean),
  ),
];
export function Registrations({
  clientId,
  open,
  onClose,
}: {
  clientId: string;
  open: boolean;
  onClose: () => void;
}) {
  const client = useClient(clientId);
  const identity = useIdentity();
  const [editing, setEditing] = useState(false);
  const save = useSaveRegistrations(clientId, () => setEditing(false));
  const editable = canAdminister(identity.data?.role);
  const data = client.data;
  const intakeValue = (key: string) => {
    const value = data?.intakeData?.[key];
    return typeof value === "string" ? value : null;
  };
  const values = [
    ["UEI", data?.uei],
    ["CAGE", data?.cageCode],
    ["EIN", intakeValue("ein")],
    ["Primary NAICS", intakeValue("primaryNaics")],
    ["NAICS codes", data?.naicsCodes?.join(", ")],
    ["PSC codes", data?.pscCodes?.join(", ")],
    ["Set-aside certifications", data?.setAsideCertifications?.join(", ")],
    ["Organization types", data?.applicantTypes?.join(", ")],
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !save.isPending) onClose();
      }}
      title="Registrations & codes"
    >
      <QueryState
        pending={client.isPending}
        error={client.error}
        retry={() => void client.refetch()}
      />
      {data &&
        (editing ? (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              save.mutate({
                uei: String(form.get("uei")).trim(),
                cageCode: String(form.get("cage")).trim(),
                naicsCodes: tokens(form.get("naics")),
                pscCodes: tokens(form.get("psc")),
                setAsideCertifications: form
                  .getAll("certification")
                  .map(String),
              });
            }}
          >
            <label>
              UEI
              <input name="uei" maxLength={12} defaultValue={data.uei ?? ""} />
            </label>
            <label>
              CAGE
              <input
                name="cage"
                maxLength={5}
                defaultValue={data.cageCode ?? ""}
              />
            </label>
            <label>
              NAICS codes (comma separated)
              <input
                name="naics"
                defaultValue={data.naicsCodes?.join(", ") ?? ""}
              />
            </label>
            <label>
              PSC codes (comma separated)
              <input
                name="psc"
                defaultValue={data.pscCodes?.join(", ") ?? ""}
              />
            </label>
            <fieldset>
              <legend>Held certifications</legend>
              {data.setAsideCertifications
                ?.filter(
                  (code) => !certifications.some((known) => known === code),
                )
                .map((code) => (
                  <div key={code}>
                    <input type="hidden" name="certification" value={code} />
                    <small>{code} · Existing code retained</small>
                  </div>
                ))}
              {certifications.map((code) => (
                <label className="row" key={code}>
                  <input
                    type="checkbox"
                    name="certification"
                    value={code}
                    defaultChecked={data.setAsideCertifications?.includes(code)}
                  />
                  {code}
                </label>
              ))}
            </fieldset>
            <small>
              EIN, primary NAICS and registry details require a targeted update
              contract to preserve concurrent profile notes and intake edits.
            </small>
            <QueryState error={save.error} />
            <div className="row">
              <button className="button primary" disabled={save.isPending}>
                Save registrations
              </button>
              <button
                className="button"
                type="button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="stack">
            <p className="muted">
              SAM.gov: {intakeValue("samStatus") ?? "Not supplied"}
              {intakeValue("samExpirationDate") &&
                ` · Expires ${intakeValue("samExpirationDate")}`}
            </p>
            <dl>
              {values.map(([label, value]) => (
                <div className="row between" key={label}>
                  <dt className="eyebrow">{label}</dt>
                  <dd>{value || "Not supplied"}</dd>
                </div>
              ))}
            </dl>
            {intakeValue("ein") &&
              !/^\d{9}$/.test(
                (intakeValue("ein") ?? "").replace(/\D/g, ""),
              ) && (
                <p role="status">
                  EIN needs review: the saved value does not contain nine
                  digits.
                </p>
              )}
            {editable && (
              <button className="button" onClick={() => setEditing(true)}>
                Edit registrations
              </button>
            )}
            {!editable && (
              <small>Registration edits require an administrator.</small>
            )}
          </div>
        ))}
    </Dialog>
  );
}
