"use client";
import { useState } from "react";
import {
  hierarchyLevels,
  levelLabel,
  reportingCycle,
  type Person,
} from "./contracts";
import { usePersonMutation } from "./mutations";
import { QueryState } from "@/shared/ui/QueryState";
export function HierarchyEditor({
  clientId,
  person,
  people,
}: {
  clientId: string;
  person: Person;
  people: Person[];
}) {
  const [saved, setSaved] = useState(false);
  const mutation = usePersonMutation(clientId, () => setSaved(true));
  return (
    <section className="stack">
      <h3>Hierarchy placement</h3>
      <small>
        {person.placementSource === "manual"
          ? "Manual placement"
          : "Title-based automatic placement"}
        . Saved titles may be historical; verify roles against a dated source.
      </small>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(false);
          const form = new FormData(event.currentTarget);
          const level = String(form.get("level"));
          const parsed =
            hierarchyLevels.find((value) => value === level) ?? null;
          mutation.mutate({
            kind: "hierarchy",
            id: person.id,
            body: {
              hierarchyLevel: parsed,
              reportsToPersonId: String(form.get("manager")) || null,
              reviewRequired: form.has("review"),
            },
          });
        }}
      >
        <div className="grid two">
          <label>
            Level
            <select name="level" defaultValue={person.hierarchyLevel ?? ""}>
              <option value="">Not placed</option>
              {hierarchyLevels.map((value) => (
                <option key={value} value={value}>
                  {levelLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reports to
            <select
              name="manager"
              defaultValue={person.reportsToPersonId ?? ""}
            >
              <option value="">No saved manager</option>
              {people
                .filter((candidate) => candidate.id !== person.id)
                .map((candidate) => (
                  <option
                    key={candidate.id}
                    value={candidate.id}
                    disabled={reportingCycle(people, person.id, candidate.id)}
                  >
                    {candidate.name} · {candidate.title}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label className="row">
          <input
            type="checkbox"
            name="review"
            defaultChecked={person.reviewRequired}
          />
          Needs title review
        </label>
        <QueryState error={mutation.error} />
        {saved && <p role="status">Placement saved.</p>}
        <div className="row">
          <button className="button" disabled={mutation.isPending}>
            Save placement
          </button>
          <button
            type="button"
            className="button ghost"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                kind: "hierarchy",
                id: person.id,
                body: { resetToAutomatic: true },
              })
            }
          >
            Reset to automatic
          </button>
        </div>
      </form>
    </section>
  );
}
