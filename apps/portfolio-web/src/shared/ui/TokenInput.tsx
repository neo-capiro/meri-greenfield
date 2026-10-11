"use client";
import { useState } from "react";
export function TokenInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const tokens = draft
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (tokens.length) onChange([...new Set([...value, ...tokens])]);
    setDraft("");
  };
  return (
    <div className="stack" style={{ gap: 6 }}>
      <label>
        {label}
        <input
          value={draft}
          placeholder={placeholder ?? "Add a value and press Enter"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
        />
      </label>
      <div className="row">
        {value.map((token) => (
          <span className="chip" key={token}>
            {token}
            <button
              type="button"
              className="button ghost"
              aria-label={`Remove ${token} from ${label}`}
              onClick={() => onChange(value.filter((v) => v !== token))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
