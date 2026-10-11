import { consentCopy } from "./contracts";
import styles from "./attendance.module.css";
export interface ConsentState {
  authorizedToRecord: boolean;
  allPartiesWillBeNotified: boolean;
}
export function ConsentFields({
  value,
  onChange,
  disabled,
}: {
  value: ConsentState;
  onChange: (value: ConsentState) => void;
  disabled: boolean;
}) {
  return (
    <>
      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={value.authorizedToRecord}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...value, authorizedToRecord: event.target.checked })
          }
        />
        <span>{consentCopy.authorized}</span>
      </label>
      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={value.allPartiesWillBeNotified}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...value,
              allPartiesWillBeNotified: event.target.checked,
            })
          }
        />
        <span>{consentCopy.notified}</span>
      </label>
    </>
  );
}
