import { Temporal } from "temporal-polyfill";

export function validDay(value: string | null | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  try {
    return Temporal.PlainDate.from(value).toString();
  } catch {
    return;
  }
}

export function instantDay(value: string, zone: string) {
  return Temporal.Instant.from(value)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
}
