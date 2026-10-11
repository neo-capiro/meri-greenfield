import { z } from "zod";
import { Temporal } from "temporal-polyfill";
import type { ApiClient } from "@/shared/api/http";
import { queryString } from "@/shared/api/http";
import {
  hearingPageSchema,
  taskPageSchema,
  deadlineSchema,
  meetingSchema,
  type CalendarFeed,
  type CalendarItem,
} from "./contracts";
import { instantDay, dateTimeInstant } from "./range";
export async function fetchMeetings(
  api: ApiClient,
  from: string,
  to: string,
  zone: string,
  clientId?: string,
  signal?: AbortSignal,
): Promise<CalendarFeed> {
  const rows = await api.request(
    "core",
    `engagement/meetings?${queryString({ from, to, clientId })}`,
    z.array(meetingSchema),
    { signal },
  );
  return {
    items: rows.map((row) => ({
      key: `meeting:${row.id}`,
      kind: "meeting",
      sourceId: row.id,
      title: row.subject,
      day: instantDay(row.startsAt, zone),
      startAt: row.startsAt,
      endAt: row.endsAt,
      timeZone: zone,
      clientId: row.client?.id,
      status: row.status,
      provenance: "Your accessible meetings",
    })),
    limitations: [],
  };
}
export async function fetchHearings(
  api: ApiClient,
  startDay: string,
  endDay: string,
  signal?: AbortSignal,
): Promise<CalendarFeed> {
  const items: CalendarItem[] = [];
  let total = 0;
  const last = Temporal.PlainDate.from(endDay).subtract({ days: 1 }).toString();
  for (let page = 1; page <= 20; page++) {
    const data = await api.request(
      "core",
      `legiwatch/live-hearings/calendar?${queryString({ from: startDay, to: last, page, pageSize: 200, jurisdiction: "ALL" })}`,
      hearingPageSchema,
      { signal },
    );
    total = data.total;
    for (const row of data.rows)
      items.push({
        key: `hearing:${row.canonicalEventId ?? row.id}`,
        kind: "hearing",
        sourceId: row.id,
        title: row.title,
        day: row.date,
        startAt: row.startsAt ?? undefined,
        timeZone: row.timezone,
        status: row.eventStatus,
        href: row.officialPageUrl ?? undefined,
        provenance: "Public committee calendar; official calendar date",
      });
    if (page * data.pageSize >= total || !data.rows.length) break;
  }
  return {
    items: deduplicate(items),
    limitations:
      items.length < total
        ? [
            `Hearing feed incomplete: loaded ${items.length} of ${total}; refine the date range.`,
          ]
        : [],
  };
}
export async function fetchPlanner(
  api: ApiClient,
  startDay: string,
  endDay: string,
  signal?: AbortSignal,
): Promise<CalendarFeed> {
  const items: CalendarItem[] = [];
  let cursor: string | undefined;
  const visited = new Set<string>();
  let incomplete = false;
  for (let page = 0; page < 100; page++) {
    const data = await api.request(
      "strategy",
      `planner/tasks?${queryString({ cursor })}`,
      taskPageSchema,
      { signal },
    );
    for (const row of data.items) {
      if (
        row.archived ||
        !row.dueOn ||
        row.dueOn < startDay ||
        row.dueOn >= endDay
      )
        continue;
      const zone = row.timeZone ?? "UTC";
      items.push({
        key: `planner:${row.id}`,
        kind: "planner",
        sourceId: row.id,
        title: row.name,
        day: row.dueOn,
        ...(row.dueTime
          ? { startAt: dateTimeInstant(row.dueOn, row.dueTime, zone) }
          : {}),
        timeZone: zone,
        clientId: row.clientId ?? undefined,
        status: row.status,
        provenance: "Planner tasks you can access; due date",
      });
    }
    if (!data.nextCursor) {
      cursor = undefined;
      break;
    }
    if (visited.has(data.nextCursor)) {
      incomplete = true;
      break;
    }
    visited.add(data.nextCursor);
    cursor = data.nextCursor;
    if (page === 99) incomplete = true;
  }
  return {
    items: deduplicate(items),
    limitations: incomplete
      ? [
          "Planner feed incomplete: the paging limit or a repeated cursor was reached.",
        ]
      : [],
  };
}
export async function fetchUpcomingDeadlines(
  api: ApiClient,
  startDay: string,
  endDay: string,
  signal?: AbortSignal,
): Promise<CalendarFeed> {
  const rows = await api.request(
    "core",
    "federal-register/upcoming-deadlines",
    z.array(deadlineSchema),
    { signal },
  );
  return {
    items: rows
      .filter(
        (row) =>
          row.commentEndDate &&
          row.commentEndDate.slice(0, 10) >= startDay &&
          row.commentEndDate.slice(0, 10) < endDay,
      )
      .map((row) => ({
        key: `deadline:${row.documentNumber}`,
        kind: "deadline",
        sourceId: row.documentNumber,
        title: row.title,
        day: row.commentEndDate!.slice(0, 10),
        timeZone: "America/New_York",
        href: row.htmlUrl ?? undefined,
        provenance: "Federal Register public comment deadline; date only",
      })),
    limitations: [
      "Deadline source currently returns at most 50 upcoming records within the next 30 days. It cannot establish a complete historical or extended calendar.",
    ],
  };
}
export function deduplicate(items: CalendarItem[]) {
  return [...new Map(items.map((item) => [item.key, item])).values()];
}
