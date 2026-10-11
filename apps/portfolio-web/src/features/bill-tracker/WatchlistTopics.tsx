"use client";
import type { TrackerBackend } from "@/shared/config/config";
import { termTypes, type TopicDraft, type Topic } from "./watchlist-contracts";
export function WatchlistTopics({
  topics,
  backend,
  issueAreas,
  disabled,
  onChange,
}: {
  topics: TopicDraft[];
  backend: TrackerBackend;
  issueAreas: string[];
  disabled: boolean;
  onChange: (topics: TopicDraft[]) => void;
}) {
  const availableTerms =
    backend === "core"
      ? termTypes.filter((value) =>
          ["synonym", "entity", "risk"].includes(value),
        )
      : termTypes;
  function update(key: string, patch: Partial<Topic>) {
    onChange(
      topics.map((topic) =>
        topic.key === key ? { ...topic, ...patch } : topic,
      ),
    );
  }
  return (
    <section className="stack">
      <header className="row between">
        <h3>Watchlist topics</h3>
        <button
          className="button"
          type="button"
          disabled={disabled || topics.length >= 200}
          onClick={() =>
            onChange([
              ...topics,
              {
                key: crypto.randomUUID(),
                label: "",
                issueArea: null,
                position: "monitor",
                priority: "med",
                terms: [],
              },
            ])
          }
        >
          Add topic
        </button>
      </header>
      {topics.map((topic, index) => (
        <fieldset className="card stack" key={topic.key} disabled={disabled}>
          <legend>Topic {index + 1}</legend>
          <div className="formGrid">
            <label>
              Topic name
              <input
                required
                maxLength={120}
                value={topic.label}
                onChange={(event) =>
                  update(topic.key, { label: event.target.value })
                }
              />
            </label>
            <label>
              Issue area
              <select
                value={topic.issueArea ?? ""}
                onChange={(event) =>
                  update(topic.key, { issueArea: event.target.value || null })
                }
              >
                <option value="">None</option>
                {[
                  ...new Set([
                    ...issueAreas,
                    ...(topic.issueArea ? [topic.issueArea] : []),
                  ]),
                ].map((area) => (
                  <option key={area}>{area}</option>
                ))}
              </select>
            </label>
            <label>
              Position
              <select
                value={topic.position}
                onChange={(event) => {
                  if (
                    event.target.value === "support" ||
                    event.target.value === "oppose" ||
                    event.target.value === "monitor"
                  )
                    update(topic.key, { position: event.target.value });
                }}
              >
                <option value="monitor">Monitor</option>
                <option value="support">Support</option>
                <option value="oppose">Oppose</option>
              </select>
            </label>
            <label>
              Priority
              <select
                value={topic.priority}
                onChange={(event) => {
                  if (
                    event.target.value === "low" ||
                    event.target.value === "med" ||
                    event.target.value === "high"
                  )
                    update(topic.key, { priority: event.target.value });
                }}
              >
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          {topic.terms.map((term, termIndex) => (
            <div className="formGrid" key={termIndex}>
              <label>
                Term type
                <select
                  value={term.termType}
                  onChange={(event) => {
                    const type = termTypes.find(
                      (value) => value === event.target.value,
                    );
                    if (type)
                      update(topic.key, {
                        terms: topic.terms.map((entry, i) =>
                          i === termIndex
                            ? { ...entry, termType: type }
                            : entry,
                        ),
                      });
                  }}
                >
                  {availableTerms.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Term value
                <input
                  required
                  maxLength={200}
                  value={term.value}
                  onChange={(event) =>
                    update(topic.key, {
                      terms: topic.terms.map((entry, i) =>
                        i === termIndex
                          ? { ...entry, value: event.target.value }
                          : entry,
                      ),
                    })
                  }
                />
              </label>
              <button
                className="button"
                type="button"
                onClick={() =>
                  update(topic.key, {
                    terms: topic.terms.filter((_entry, i) => i !== termIndex),
                  })
                }
              >
                Remove term {termIndex + 1}
              </button>
            </div>
          ))}
          <div className="row between">
            <button
              className="button"
              type="button"
              disabled={topic.terms.length >= 500}
              onClick={() =>
                update(topic.key, {
                  terms: [
                    ...topic.terms,
                    {
                      termType: backend === "core" ? "synonym" : "keyword",
                      value: "",
                    },
                  ],
                })
              }
            >
              Add term
            </button>
            <button
              className="button"
              type="button"
              onClick={() =>
                onChange(topics.filter((entry) => entry.key !== topic.key))
              }
            >
              Remove topic {index + 1}
            </button>
          </div>
        </fieldset>
      ))}
      {!topics.length && <p className="empty">No topics configured.</p>}
    </section>
  );
}
