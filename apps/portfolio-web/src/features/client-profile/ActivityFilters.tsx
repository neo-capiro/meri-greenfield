"use client";
/* eslint-disable @next/next/no-img-element */
import { DropdownMenu } from "radix-ui";
import {
  type ActivityFilters as Filters,
  emptyActivityFilters,
} from "./activity-filters";
import { ActivityDateFilter } from "./ActivityDateFilter";
import styles from "./activity-filters.module.css";

const asset = (slot: string) => `/design/411-60532-${slot}.svg`;
export function ActivityFilters({
  value,
  onChange,
  kinds,
  zone,
}: {
  value: Filters;
  onChange: (filters: Filters) => void;
  kinds: string[];
  zone: string;
}) {
  return (
    <div className={styles.filters} aria-label="Activity filters">
      <label className={styles.search}>
        <span className="srOnly">Search activity</span>
        <img src={asset("search")} alt="" />
        <input
          type="search"
          placeholder="Search activity…"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
      </label>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={`button ${styles.trigger}`}
          aria-label="Activity type"
        >
          <img src={asset("filter")} alt="" />
          {value.kind || "All activity"}
          <img src={asset("chevron")} alt="" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={styles.menu} align="end">
            <DropdownMenu.RadioGroup
              value={value.kind}
              onValueChange={(kind) => onChange({ ...value, kind })}
            >
              {["", ...kinds].map((kind) => (
                <DropdownMenu.RadioItem key={kind} value={kind}>
                  {kind || "All activity"}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ActivityDateFilter
        range={value}
        zone={zone}
        onChange={(range) => onChange({ ...value, ...range })}
        onClear={() => onChange({ ...emptyActivityFilters })}
      />
    </div>
  );
}
