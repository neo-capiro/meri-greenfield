import type { ApiClient } from "@/shared/api/http";
import { clientSchema, type Client } from "@/features/portfolio/public";
import { intakePayload, type IntakeForm } from "./form";

export function clientReceipt(id: string) {
  return clientSchema.refine(
    (client) => client.id === id,
    "Client receipt does not match the requested profile.",
  );
}
export async function saveClientProfile(
  api: ApiClient,
  values: IntakeForm,
  initial?: IntakeForm,
  client?: Client,
) {
  const path = client ? `clients/${encodeURIComponent(client.id)}` : "clients";
  const schema = client ? clientReceipt(client.id) : clientSchema;
  const latest = client ? await api.request("core", path, schema) : undefined;
  const body = intakePayload(values, initial, latest);
  if (latest && !Object.keys(body).length) return latest;
  return api.request("core", path, schema, {
    method: client ? "PUT" : "POST",
    body,
  });
}
export function archiveClient(api: ApiClient, id: string) {
  return api.request(
    "core",
    `clients/${encodeURIComponent(id)}`,
    clientReceipt(id).refine(
      (client) => client.status === "archived",
      "The client was not archived.",
    ),
    { method: "DELETE" },
  );
}
