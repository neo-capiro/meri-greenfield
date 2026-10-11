import {
  clientLocation,
  clientSectors,
  memberName,
  type Client,
  type Member,
} from "./contracts";
import { sectorLabel } from "@/shared/domain/sector";
export interface PortfolioFilter {
  search: string;
  status: string;
  sector: string;
  owner: string;
}
export const unassignedOwner = "unassigned";
export interface PortfolioIndexState extends PortfolioFilter {
  type: string;
  view: "list" | "cards";
  sort: "saved" | "recent" | "name";
  unsupportedSort: string;
}
export function readPortfolioState(
  params: Pick<URLSearchParams, "get">,
): PortfolioIndexState {
  const sort = params.get("sort") ?? "saved";
  return {
    search: params.get("q") ?? "",
    status: params.get("status") ?? "",
    sector: params.get("sector") ?? "",
    owner: params.get("owner") ?? "",
    type: params.get("type") ?? "",
    view:
      (params.get("view") ?? params.get("layout")) === "list"
        ? "list"
        : "cards",
    sort: sort === "saved" || sort === "name" ? sort : "recent",
    unsupportedSort: ["saved", "name", "recent"].includes(sort) ? "" : sort,
  };
}
export function portfolioHref(
  pathname: string,
  params: URLSearchParams,
  key: string,
  value: string,
) {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  if (key === "view") next.delete("layout");
  return `${pathname}${next.size ? `?${next}` : ""}`;
}
export function clearPortfolioFilters(
  pathname: string,
  params: URLSearchParams,
) {
  const next = new URLSearchParams(params);
  for (const key of ["q", "status", "sector", "owner", "type", "search"])
    next.delete(key);
  return `${pathname}${next.size ? `?${next}` : ""}`;
}
export function sortClients(
  clients: Client[],
  sort: "saved" | "recent" | "name",
) {
  // GET /clients is ordered by createdAt DESC. Preserve that order for Recent.
  return sort === "name"
    ? [...clients].sort(
        (a, b) =>
          a.name.localeCompare(b.name, undefined, {
            sensitivity: "base",
            numeric: true,
          }) || a.id.localeCompare(b.id),
      )
    : clients;
}
export function filterClients(
  clients: Client[],
  filter: PortfolioFilter,
  owners: Record<
    string,
    { accountOwnerUserId: string | null; accountOwner?: Member | null }
  >,
) {
  const term = filter.search.trim().toLocaleLowerCase();
  return clients.filter((client) => {
    const location = clientLocation(client);
    const sectors = clientSectors(client);
    const searchText = [
      client.name,
      client.description,
      client.primaryContactName,
      sectors.join(" "),
      sectors.map(sectorLabel).join(" "),
      location?.replace(", ", " "),
      location,
      owners[client.id]?.accountOwner
        ? memberName(owners[client.id]?.accountOwner)
        : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return (
      (!term || searchText.includes(term)) &&
      (!filter.status || client.profileStatus === filter.status) &&
      (!filter.sector || sectors.includes(filter.sector)) &&
      (!filter.owner ||
        (filter.owner === unassignedOwner
          ? owners[client.id]?.accountOwnerUserId === null
          : owners[client.id]?.accountOwnerUserId === filter.owner))
    );
  });
}
