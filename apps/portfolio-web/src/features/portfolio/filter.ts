import { memberName, type Client, type Member } from "./contracts";
export interface PortfolioFilter {
  search: string;
  status: string;
  sector: string;
  owner: string;
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
  return clients.filter(
    (client) =>
      (!term ||
        `${client.name} ${client.description ?? ""} ${client.primaryContactName ?? ""} ${client.sectorTag ?? ""} ${memberName(owners[client.id]?.accountOwner)}`
          .toLocaleLowerCase()
          .includes(term)) &&
      (!filter.status || client.profileStatus === filter.status) &&
      (!filter.sector || client.sectorTag === filter.sector) &&
      (!filter.owner || owners[client.id]?.accountOwnerUserId === filter.owner),
  );
}
