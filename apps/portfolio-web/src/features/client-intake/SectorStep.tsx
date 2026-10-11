import { TokenInput } from "@/shared/ui/TokenInput";
import { sectors, tracks } from "./catalog";
import { ChoiceList, ChoiceSelect, TextField, type StepProps } from "./Fields";
import styles from "./intake.module.css";
export function SectorStep({ values, set, errors }: StepProps) {
  return (
    <div className={styles.fields}>
      <ChoiceSelect
        label="Sector tags"
        options={sectors}
        value={values.sectors}
        onChange={(v) => set("sectors", v)}
      />
      {values.sectors.length > 0 && (
        <label>
          Primary sector
          <select
            value={values.sectors[0]}
            onChange={(e) =>
              set("sectors", [
                e.target.value,
                ...values.sectors.filter((v) => v !== e.target.value),
              ])
            }
          >
            {values.sectors.map((value) => (
              <option key={value} value={value}>
                {sectors.find(([key]) => key === value)?.[1] ?? value}
              </option>
            ))}
          </select>
        </label>
      )}
      <TokenInput
        label="Funding priorities"
        value={values.fundingPriorities}
        onChange={(v) => set("fundingPriorities", v)}
      />
      <small className={errors.fundingPriorities ? "danger" : "muted"}>
        {errors.fundingPriorities ??
          "Up to 20 priorities · 120 characters each"}
      </small>
      <ChoiceList
        label="Active submission tracks"
        options={tracks}
        value={values.submissionTracks}
        onChange={(v) => set("submissionTracks", v)}
      />
      <TokenInput
        label="LDA issue codes (bill/policy matching)"
        value={values.issueCodes}
        onChange={(v) => set("issueCodes", v)}
      />
      <div className={styles.columns}>
        <TextField
          label="Engagement start date"
          type="date"
          value={values.engagementStartDate}
          onChange={(e) => set("engagementStartDate", e.target.value)}
          error={errors.engagementStartDate}
        />
        <TextField
          label="Primary POC at client"
          value={values.primaryContactName}
          onChange={(e) => set("primaryContactName", e.target.value)}
        />
      </div>
      <TextField
        label="Internal notes"
        multiline
        value={values.internalNotes}
        onChange={(e) => set("internalNotes", e.target.value)}
        error={errors.internalNotes}
      />
      <small className="muted">
        Maximum 2,000 characters · Distinct from activity and profile notes.
      </small>
    </div>
  );
}
