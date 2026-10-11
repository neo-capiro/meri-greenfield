"use client";
import type { ReactNode } from "react";
import type { Destinations } from "@/shared/config/config";
import { Shell } from "@/shared/shell/Shell";
import { QueryState } from "@/shared/ui/QueryState";
import { useClient } from "@/features/portfolio/public";
export function ClientFrame({
  clientId,
  destinations,
  children,
}: {
  clientId: string;
  destinations: Destinations;
  children: ReactNode;
}) {
  const client = useClient(clientId);
  return (
    <Shell
      destinations={destinations}
      client={{ id: clientId, name: client.data?.name ?? "Client" }}
    >
      {client.isPending || client.error ? (
        <div className="page">
          <QueryState
            pending={client.isPending}
            error={client.error}
            retry={() => void client.refetch()}
          />
        </div>
      ) : (
        children
      )}
    </Shell>
  );
}
