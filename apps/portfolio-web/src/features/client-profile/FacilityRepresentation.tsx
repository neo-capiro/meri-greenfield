import type { FacilityRepresentation as Representation } from "./facility-map-contracts";
import styles from "./facility-map.module.css";

export function FacilityRepresentation({
  value,
}: {
  value: Representation | undefined;
}) {
  if (!value)
    return (
      <p className="muted">
        Representation is not available for this facility.
      </p>
    );
  if (value.unresolved)
    return (
      <p className="muted">
        {value.reason === "no_state"
          ? "Add a state to resolve elected representation."
          : "Resolve or enter a district to find elected representation."}
      </p>
    );
  const facts = [
    [
      "U.S. House",
      value.federal.house?.fullName ??
        "No matching member in the current roster",
    ],
    [
      "U.S. Senate",
      value.federal.senate.map((member) => member.fullName).join(" · ") ||
        "No matching members in the current roster",
    ],
    [
      "State House",
      value.state.lower?.name ?? "No matching legislator in the current roster",
    ],
    [
      "State Senate",
      value.state.upper?.name ?? "No matching legislator in the current roster",
    ],
  ];
  return (
    <dl className={styles.facts}>
      {facts.map(([label, text]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}
