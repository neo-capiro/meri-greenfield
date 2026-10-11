import { TokenInput } from "@/shared/ui/TokenInput";
import { certifications, organizationTypes, samStatuses } from "./catalog";
import { ChoiceList, ChoiceSelect, TextField, type StepProps } from "./Fields";
import styles from "./intake.module.css";
export function RegistrationStep({ values, set, errors }: StepProps) {
  return (
    <div className={styles.fields}>
      <div className={styles.columns}>
        <TextField
          label="CAGE Code"
          value={values.cageCode}
          maxLength={5}
          onChange={(e) => set("cageCode", e.target.value)}
          error={errors.cageCode}
        />
        <TextField
          label="UEI"
          value={values.uei}
          maxLength={12}
          onChange={(e) => set("uei", e.target.value)}
          error={errors.uei}
        />
        <label>
          SAM.gov status
          <select
            value={values.samStatus}
            onChange={(e) => set("samStatus", e.target.value)}
          >
            <option value="">Select status</option>
            {[
              ...new Set([
                ...samStatuses,
                ...(values.samStatus ? [values.samStatus] : []),
              ]),
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <TextField
          label="SAM.gov expiration date"
          type="date"
          value={values.samExpirationDate}
          onChange={(e) => set("samExpirationDate", e.target.value)}
          error={errors.samExpirationDate}
        />
        <TextField
          label="LDA registrant name"
          value={values.ldaRegistrantName}
          onChange={(e) => set("ldaRegistrantName", e.target.value)}
        />
        <TextField
          label="EIN"
          value={values.ein}
          onChange={(e) => set("ein", e.target.value)}
          error={errors.ein}
          placeholder="XX-XXXXXXX"
        />
        <TokenInput
          label="NAICS codes"
          value={values.naicsCodes}
          onChange={(v) => set("naicsCodes", v)}
        />
        <TokenInput
          label="PSC codes"
          value={values.pscCodes}
          onChange={(v) => set("pscCodes", v)}
        />
      </div>
      <ChoiceSelect
        label="Organization types"
        options={organizationTypes}
        value={values.applicantTypes}
        onChange={(v) => set("applicantTypes", v)}
      />
      <ChoiceList
        label="Federal set-aside certifications"
        options={certifications.map((code) => [code, code])}
        value={values.setAsideCertifications}
        onChange={(v) => set("setAsideCertifications", v)}
      />
    </div>
  );
}
