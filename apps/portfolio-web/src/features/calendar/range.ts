import { Temporal } from "temporal-polyfill";
export { validDay, instantDay } from "@/shared/date/civil";
export const zones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Pacific/Honolulu",
  "UTC",
] as const;
export type CalendarZone = (typeof zones)[number];
export type CalendarView = "month" | "week" | "agenda";
export function calendarRange(
  date: string,
  view: CalendarView,
  zone: CalendarZone,
) {
  const anchor = Temporal.PlainDate.from(date);
  const first =
    view === "week"
      ? anchor.subtract({ days: anchor.dayOfWeek % 7 })
      : anchor.with({ day: 1 });
  const start =
    view === "month" ? first.subtract({ days: first.dayOfWeek % 7 }) : first;
  const end =
    view === "week"
      ? start.add({ days: 7 })
      : view === "month"
        ? first
            .add({ months: 1 })
            .add({ days: (7 - (first.add({ months: 1 }).dayOfWeek % 7)) % 7 })
        : first.add({ months: 1 });
  return {
    startDay: start.toString(),
    endDay: end.toString(),
    from: start.toZonedDateTime({ timeZone: zone }).toInstant().toString(),
    to: end.toZonedDateTime({ timeZone: zone }).toInstant().toString(),
  };
}
export function moveDate(date: string, view: CalendarView, direction: number) {
  return Temporal.PlainDate.from(date)
    .add(view === "week" ? { days: 7 * direction } : { months: direction })
    .toString();
}
export function dateTimeInstant(date: string, time: string, zone: string) {
  return Temporal.PlainDate.from(date)
    .toZonedDateTime({
      timeZone: zone,
      plainTime: Temporal.PlainTime.from(time),
    })
    .toInstant()
    .toString();
}
export function formatInstant(value: string, zone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}
