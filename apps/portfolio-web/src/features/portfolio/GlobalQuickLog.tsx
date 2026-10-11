"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "@/shared/ui/Dialog";
import type { Client } from "./contracts";
import { MemberQuickLog } from "@/features/relationships/public";
import styles from "./quick-log.module.css";
export function GlobalQuickLog({ clients }: { clients: Client[] }) {
  const params = useSearchParams();
  return params.has("log") ? <QuickLogSession clients={clients} /> : null;
}
function QuickLogSession({ clients }: { clients: Client[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [mode, setMode] = useState<"client" | "member">("client");
  const [visitedMember, setVisitedMember] = useState(false);
  const availableClients = clients.filter(
    (client) => client.status !== "archived",
  );
  return (
    <Dialog
      open
      title="Quick log"
      description="Record an activity for a client or a shared Directory note on a member."
      className={styles.dialog}
      onOpenChange={(open) => {
        if (!open) {
          const next = new URLSearchParams(params);
          next.delete("log");
          router.replace(`/portfolio?${next}`, { scroll: false });
        }
      }}
    >
      <div className={styles.modes}>
        <span className="eyebrow">Log to</span>
        <div role="group" aria-label="Log destination">
          <button
            className={styles.mode}
            type="button"
            aria-pressed={mode === "client"}
            onClick={() => setMode("client")}
          >
            Client
          </button>
          <button
            className={styles.mode}
            type="button"
            aria-pressed={mode === "member"}
            onClick={() => {
              setVisitedMember(true);
              setMode("member");
            }}
          >
            Member
          </button>
        </div>
      </div>
      <div hidden={mode !== "client"}>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (availableClients.some((c) => c.id === clientId))
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
              {availableClients.map((c) => (
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
      </div>
      <div hidden={mode !== "member"}>
        {visitedMember && <MemberQuickLog open />}
      </div>
    </Dialog>
  );
}
