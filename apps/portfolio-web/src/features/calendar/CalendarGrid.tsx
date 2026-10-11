"use client";
import "temporal-polyfill/global";
import { useEffect } from "react";
import { Temporal } from "temporal-polyfill";
import { ScheduleXCalendar, useNextCalendarApp } from "@schedule-x/react";
import { createViewMonthGrid, createViewWeek } from "@schedule-x/calendar";
import "@schedule-x/theme-default/dist/index.css";
import type { CalendarItem } from "./contracts";
import type { CalendarView, CalendarZone } from "./range";
import styles from "./calendar.module.css";
export function CalendarGrid({
  items,
  date,
  view,
  zone,
  onDate,
  onMeeting,
}: {
  items: CalendarItem[];
  date: string;
  view: CalendarView;
  zone: CalendarZone;
  onDate: (date: string) => void;
  onMeeting: (id: string) => void;
}) {
  const calendar = useNextCalendarApp({
    views: [createViewMonthGrid(), createViewWeek()],
    defaultView: view === "week" ? "week" : "month-grid",
    selectedDate: Temporal.PlainDate.from(date),
    timezone: zone,
    firstDayOfWeek: 7,
    isResponsive: false,
    dayBoundaries: { start: "06:00", end: "22:00" },
    weekOptions: { gridHeight: 900 },
    callbacks: {
      onEventClick: (event) =>
        onMeeting(String(event.id).replace(/^meeting:/, "")),
      onSelectedDateUpdate: (date) => onDate(date.toString()),
    },
  });
  useEffect(() => {
    calendar?.events.set(
      items
        .filter((item) => item.kind === "meeting" && item.startAt && item.endAt)
        .map((item) => ({
          id: item.key,
          title: item.title,
          start: Temporal.Instant.from(item.startAt!).toZonedDateTimeISO(zone),
          end: Temporal.Instant.from(item.endAt!).toZonedDateTimeISO(zone),
        })),
    );
  }, [calendar, items, zone]);
  useEffect(() => {
    if (!calendar) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => calendar.setTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [calendar]);
  return (
    <div className={styles.grid}>
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
