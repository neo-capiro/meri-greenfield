"use client";
/* eslint-disable @next/next/no-img-element */
import { Popover } from "radix-ui";
import { useState } from "react";
import { type ActivityFilters, recentActivityRange } from "./activity-filters";
import styles from "./activity-filters.module.css";

type DateRange = Pick<ActivityFilters, "from" | "to">;
export function ActivityDateFilter({
  range,
  zone,
  onChange,
  onClear,
}: {
  range: DateRange;
  zone: string;
  onChange: (range: DateRange) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const recent = recentActivityRange(30, new Date(), zone);
  const dateLabel =
    !range.from && !range.to
      ? "All dates"
      : range.from === recent.from && range.to === recent.to
        ? "Last 30 days"
        : "Date range";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={`button ${styles.trigger}`}
        aria-label={`Activity dates: ${dateLabel}`}
      >
        <img src="/design/411-60532-calendar.svg" alt="" />
        {dateLabel}
        <img src="/design/411-60532-chevron.svg" alt="" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={`${styles.menu} ${styles.dates}`}
          align="end"
          sideOffset={8}
          aria-label="Activity date range"
        >
          <p className="muted">
            Dates use {zone}. Both selected days are included.
          </p>
          <label>
            From
            <input
              type="date"
              value={range.from}
              onChange={(e) => onChange({ ...range, from: e.target.value })}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              value={range.to}
              onChange={(e) => onChange({ ...range, to: e.target.value })}
            />
          </label>
          <div className="row">
            <button
              className="button"
              onClick={() =>
                onChange(recentActivityRange(30, new Date(), zone))
              }
            >
              Last 30 days
            </button>
            <button
              className="button"
              onClick={() => onChange({ from: "", to: "" })}
            >
              All dates
            </button>
          </div>
          <button
            className="button ghost"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          >
            Clear filters
          </button>
          <Popover.Close className="button">Done</Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
