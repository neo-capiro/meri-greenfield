import { Temporal } from "temporal-polyfill";
import { validDay } from "@/shared/date/civil";
import type { PublicEvent } from "./contracts";

export function eventWhen(hearing: PublicEvent["hearing"]) {
  const day = validDay(hearing.calendarDate);
  const date = day
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${day}T12:00:00Z`))
    : "Calendar date unavailable";
  if (hearing.timePrecision === "date")
    return {
      date,
      time: "Date only · time not supplied",
      warning: hearing.scheduledStart
        ? "The source marks this event as date-only; its timestamp is not used as an exact start."
        : undefined,
    };
  let start: string | undefined;
  let warning: string | undefined;
  if (hearing.scheduledStart) {
    try {
      const instant = Temporal.Instant.from(hearing.scheduledStart);
      if (!hearing.timeZone) throw new Error("Source timezone absent");
      const zoned = instant.toZonedDateTimeISO(hearing.timeZone);
      start = new Intl.DateTimeFormat("en-US", {
        timeZone: hearing.timeZone,
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(instant.epochMilliseconds));
      if (day && zoned.toPlainDate().toString() !== day) {
        start = `${zoned.toPlainDate()} · ${start}`;
        warning =
          "The published calendar date and scheduled start fall on different source-local days.";
      }
    } catch {
      warning =
        "The scheduled start or its source time zone is unavailable; no time has been inferred.";
    }
  }
  if (!warning && hearing.scheduledStart && !hearing.timePrecision)
    warning = "The source does not report whether this start time is exact.";
  return {
    date,
    time:
      start ??
      (hearing.time
        ? `Published time: ${hearing.time} · zone/precision not verified`
        : "Time not supplied"),
    warning,
  };
}
export function attendanceLabel(
  state: NonNullable<PublicEvent["attendance"]>["state"],
) {
  const labels = {
    AUTOMATIC_AVAILABLE: "Automatic attendance available",
    AUTOMATIC_PENDING_PREFLIGHT: "Source preflight required",
    BROWSER_ONLY: "Browser attendance only",
    NO_PUBLIC_STREAM: "No public capture source",
    CLOSED_SESSION: "Closed session",
    NOT_ELIGIBLE: "Capture unavailable",
    SCHEDULED: "Attendance scheduled",
    CAPTURING: "Capturing",
    PROCESSING: "Transcript processing",
    COMPLETE: "Transcript available",
    FAILED: "Capture failed",
  };
  return labels[state];
}
export function publicEventHref(
  existingApp: string | undefined,
  eventId: string,
) {
  return existingApp
    ? `${existingApp.replace(/\/+$/, "")}/legiwatch/hearings/${encodeURIComponent(eventId)}`
    : undefined;
}
