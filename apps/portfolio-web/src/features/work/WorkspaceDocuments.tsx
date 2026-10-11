"use client";
import { QueryState } from "@/shared/ui/QueryState";
import { useClient, useClients } from "@/features/portfolio/public";
import type { Destinations } from "@/shared/config/config";
import { clientDrafts } from "./contracts";
import { useWorkspaceDrafts } from "./queries";
export function WorkspaceDocuments({
  clientId,
  destinations,
}: {
  clientId: string;
  destinations: Destinations;
}) {
  const query = useWorkspaceDrafts();
  const client = useClient(clientId);
  const clients = useClients();
  const rows =
    client.data && clients.data
      ? clientDrafts(query.data?.drafts ?? [], client.data, clients.data)
      : [];
  const ambiguous =
    client.data &&
    clients.data &&
    clients.data.filter((c) => c.name === client.data.name).length > 1;
  return (
    <section className="stack">
      <header className="row between">
        <h2>Workspace documents</h2>
        {destinations.workspace && (
          <a className="button" href={destinations.workspace}>
            Open Workspace ↗
          </a>
        )}
      </header>
      <QueryState
        pending={query.isPending || clients.isPending}
        error={query.error ?? clients.error}
        retry={() => {
          void query.refetch();
          void clients.refetch();
        }}
      />
      <p className="muted">
        Workspace associates legacy documents by client name. Renamed clients
        may have missing documents.
        {ambiguous &&
          " This name is shared by multiple clients; documents cannot be safely assigned here."}
      </p>
      {query.data && (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Status</th>
                <th>Updated</th>
                <th>
                  <span className="srOnly">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((draft) => (
                <tr key={draft.id}>
                  <td>
                    <strong>{draft.docTitle}</strong>
                    <p className="muted">{draft.product ?? "Document"}</p>
                  </td>
                  <td>
                    <span className="chip">
                      {draft.status === "complete" ? "Completed" : "Draft"}
                    </span>
                  </td>
                  <td>{new Date(draft.updatedAt).toLocaleDateString()}</td>
                  <td>
                    {destinations.existingApp ? (
                      <a
                        href={`${destinations.existingApp}/workspace/${draft.id}`}
                      >
                        Open Workspace ↗
                      </a>
                    ) : (
                      <small>Workspace destination unavailable</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="empty">No documents can be matched to this client.</p>
          )}
        </div>
      )}
    </section>
  );
}
