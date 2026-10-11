import { Temporal } from "temporal-polyfill";
import { instantDay, validDay } from "@/shared/date/civil";
import type { Activity } from "./contracts";

export type ActivityFilters = {
  query: string;
  kind: string;
  from: string;
  to: string;
};
export const emptyActivityFilters: ActivityFilters = {
  query: "",
  kind: "",
  from: "",
  to: "",
};

export function recentActivityRange(days: number, now: Date, zone: string) {
  const today = Temporal.PlainDate.from(instantDay(now.toISOString(), zone));
  return {
    from: today.subtract({ days: days - 1 }).toString(),
    to: today.toString(),
  };
}

export function activityRangeError({ from, to }: ActivityFilters) {
  if ((from && !validDay(from)) || (to && !validDay(to)))
    return "Choose valid activity dates.";
  if (from && to && from > to)
    return "The start date must be on or before the end date.";
}

export function filterActivity(
  items: Activity[],
  filters: ActivityFilters,
  zone: string,
) {
  if (activityRangeError(filters)) return [];
  const text = filters.query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    if (filters.kind && filters.kind !== item.kind) return false;
    if (
      text &&
      !`${item.title}\n${item.body ?? ""}`.toLocaleLowerCase().includes(text)
    )
      return false;
    const day = instantDay(item.occurredAt, zone);
    return (
      (!filters.from || day >= filters.from) &&
      (!filters.to || day <= filters.to)
    );
  });
}
