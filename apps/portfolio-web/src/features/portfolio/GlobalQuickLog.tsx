"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "@/shared/ui/Dialog";
import type { Client } from "./contracts";
export function GlobalQuickLog({ clients }: { clients: Client[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  return (
    <Dialog
      open={params.has("log")}
      title="Quick log"
      description="Choose the client for this activity."
      onOpenChange={(open) => {
        if (!open) {
          const next = new URLSearchParams(params);
          next.delete("log");
          router.replace(`/portfolio?${next}`, { scroll: false });
        }
      }}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (clients.some((c) => c.id === clientId))
            router.push(`/portfolio/${clientId}?log=1`);
        }}
      >
        <label>
          Client
          <select
            required
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary" disabled={!clientId}>
          Continue
        </button>
      </form>
    </Dialog>
  );
}
