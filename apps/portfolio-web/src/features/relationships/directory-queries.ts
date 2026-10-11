"use client";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/shared/api/provider";
import { queryString } from "@/shared/api/http";
import {
  type DirectoryKind,
  type DirectoryPage,
  type Committee,
  memberSearchSchema,
  peopleSearchSchema,
  stateSearchSchema,
  committeeSearchSchema,
  committeeStaffSchema,
  staffDetailSchema,
  memberDetailSchema,
  stateDetailSchema,
} from "./directory-contracts";
import type { GovernmentTarget } from "./target-contracts";
export function useTargetDirectory(
  kind: DirectoryKind,
  query: string,
  page: number,
  committeeId?: string,
) {
  const api = useApi();
  return useQuery({
    queryKey: ["target-directory", kind, query, page, committeeId],
    enabled: Boolean(query.trim() || committeeId),
    queryFn: async ({ signal }): Promise<DirectoryPage> => {
      const options = { signal };
      const search = queryString({ q: query.trim(), page, pageSize: 20 });
      if (kind === "congress") {
        const data = await api.request(
          "core",
          `directory/contacts?${search}`,
          memberSearchSchema,
          options,
        );
        return {
          ...data,
          rows: data.contacts.map((row) => ({
            id: row.id,
            name: row.fullName,
            title: row.title,
            meta: [row.chamber, row.state, row.party]
              .filter(Boolean)
              .join(" · "),
            directory: "congress",
          })),
        };
      }
      if (kind === "state") {
        const data = await api.request(
          "core",
          `explorer/state-legislators?${search}&activeOnly=true`,
          stateSearchSchema,
          options,
        );
        return {
          total: data.total,
          page,
          pageSize: 20,
          rows: data.rows.map((row) => ({
            id: row.id,
            name: row.name,
            title: "State legislator",
            meta: [row.state, row.chamber, row.district, row.party]
              .filter(Boolean)
              .join(" · "),
            directory: "state",
            current: true,
          })),
        };
      }
      if (kind === "committee") {
        if (!committeeId) return { rows: [], total: 0, page: 1, pageSize: 20 };
        const data = await api.request(
          "core",
          `directory/committees/${encodeURIComponent(committeeId)}/staff?${search}`,
          committeeStaffSchema.refine(
            (result) =>
              result.committee?.id === committeeId &&
              result.staff.every((row) => row.committee.id === committeeId),
            "Committee association mismatch",
          ),
          options,
        );
        return {
          ...data,
          rows: data.staff.map((row) => ({
            id: row.id,
            name: row.fullName,
            title: row.title,
            meta: row.committee.name,
            directory: "staff",
            current: row.isCurrent,
          })),
        };
      }
      const data = await api.request(
        "core",
        `directory/people?${search}&personType=staff&current=true`,
        peopleSearchSchema,
        options,
      );
      return {
        ...data,
        rows: data.people.map((row) => ({
          id: row.id,
          name: row.fullName,
          title: row.title,
          meta: [row.state, row.party].filter(Boolean).join(" · "),
          directory: "staff",
          current: row.isCurrent,
        })),
      };
    },
  });
}
export function useCommittees(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: ["directory-committee-taxonomy"],
    enabled,
    queryFn: async ({ signal }) => {
      const rows: Committee[] = [];
      for (let page = 1; ; page++) {
        const data = await api.request(
          "core",
          `directory/committees?page=${page}&pageSize=200`,
          committeeSearchSchema,
          { signal },
        );
        if (data.page !== page || data.pageSize !== 200)
          throw new Error(
            "Committee catalog paging changed. Retry to reload it.",
          );
        rows.push(...data.committees);
        if (page * data.pageSize >= data.total)
          return [...new Map(rows.map((row) => [row.id, row])).values()];
        if (data.committees.length === 0)
          throw new Error(
            "Committee catalog is incomplete. Retry to reload it.",
          );
      }
    },
  });
}
export function useTargetContact(target: GovernmentTarget) {
  const api = useApi();
  return useQuery({
    queryKey: [
      "target-contact-detail",
      target.sourceDirectory,
      target.memberId,
    ],
    queryFn: async ({ signal }) => {
      const id = encodeURIComponent(target.memberId);
      if (target.sourceDirectory === "staff") {
        const detail = await api.request(
          "core",
          `directory/staffers/${id}`,
          staffDetailSchema.refine(
            (row) => row.id === target.memberId,
            "Staff identity mismatch",
          ),
          { signal },
        );
        return {
          emails: detail.emails.map((row) => row.value),
          positions: detail.positions,
        };
      }
      if (target.sourceDirectory === "state") {
        const detail = await api.request(
          "core",
          `explorer/state-legislators/${id}`,
          stateDetailSchema.refine(
            (row) => row.id === target.memberId,
            "Legislator identity mismatch",
          ),
          { signal },
        );
        return { emails: detail.email ? [detail.email] : [], positions: [] };
      }
      const detail = await api.request(
        "core",
        `directory/members/${id}`,
        memberDetailSchema,
        { signal },
      );
      // Only explicitly identified email contact methods become recipients.
      return {
        emails: detail.socialContacts
          .filter((row) => row.type?.toLowerCase() === "email")
          .map((row) => row.value),
        positions: detail.offices.map((row) => ({
          title: null,
          officeName: row.name,
          isCurrent: row.endDate === null,
          startDate: row.startDate,
          endDate: row.endDate,
        })),
      };
    },
  });
}
