import { businessFlags } from "./catalog";
import { ChoiceList, TextField, type StepProps } from "./Fields";
import styles from "./intake.module.css";
export function CompanyStep({ values, set, errors }: StepProps) {
  return (
    <div className={styles.fields}>
      <div className={styles.columns}>
        <TextField
          label="Legal name *"
          value={values.name}
          maxLength={200}
          onChange={(e) => set("name", e.target.value)}
          error={errors.name}
        />
        <TextField
          label="Website *"
          value={values.website}
          onChange={(e) => set("website", e.target.value)}
          error={errors.website}
          placeholder="company.com"
        />
      </div>
      <TextField
        label="Company description *"
        multiline
        value={values.description}
        onChange={(e) => set("description", e.target.value)}
        error={errors.description}
      />
      <small className="muted">
        Required · Maximum 600 characters · {values.description.length}/600
      </small>
      <div className={styles.columns}>
        <TextField
          label="Main company email"
          type="email"
          value={values.primaryContactEmail}
          onChange={(e) => set("primaryContactEmail", e.target.value)}
          error={errors.primaryContactEmail}
        />
        <TextField
          label="Main company phone"
          type="tel"
          value={values.primaryContactPhone}
          onChange={(e) => set("primaryContactPhone", e.target.value)}
        />
      </div>
      <ChoiceList
        label="Small Business Classification"
        options={businessFlags}
        value={Object.keys(values.sbClassification).filter(
          (key) => values.sbClassification[key],
        )}
        onChange={(selected) =>
          set(
            "sbClassification",
            Object.fromEntries(
              businessFlags.map(([key]) => [key, selected.includes(key)]),
            ),
          )
        }
      />
    </div>
  );
}
