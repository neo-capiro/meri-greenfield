"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Destinations } from "@/shared/config/config";
import { Shell } from "@/shared/shell/Shell";
import { QueryState } from "@/shared/ui/QueryState";
import {
  useMemberOptions,
  memberName,
  initials,
} from "@/features/portfolio/public";
import { useProspects, useStageCatalog } from "./queries";
import {
  stages,
  legacyStages,
  stageLabel,
  type ProspectFilter,
} from "./contracts";
import { ProspectEditor } from "./ProspectEditor";
import { ProspectPipeline } from "./ProspectPipeline";
import styles from "./prospects.module.css";
export function ProspectsIndex({
  destinations,
}: {
  destinations: Destinations;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get("status");
  const filter: ProspectFilter = {
    search: params.get("q") ?? "",
    stage: params.get("stage") ?? "",
    ownerId: params.get("ownerId") ?? "",
    status: status === "all" || status === "dismissed" ? status : "active",
  };
  const query = useProspects(filter);
  const catalog = useStageCatalog();
  const owners = useMemberOptions();
  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/portfolio/prospects?${next}`, { scroll: false });
  }
  return (
    <Shell destinations={destinations}>
      <div className="page stack">
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h1>
              Prospects{" "}
              {query.data && (
                <span className="muted">{query.data.counts.visible}</span>
              )}
            </h1>
          </div>
          <button className="button primary" onClick={() => set("new", "1")}>
            + Add prospect
          </button>
        </header>
        <div className="toolbar">
          <input
            aria-label="Search prospects"
            placeholder="Search prospects"
            maxLength={200}
            value={filter.search}
            onChange={(event) => set("q", event.target.value)}
          />
          <select
            aria-label="Prospect owner"
            value={filter.ownerId}
            onChange={(event) => set("ownerId", event.target.value)}
          >
            <option value="">All owners</option>
            {owners.data?.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {memberName(owner)}
              </option>
            ))}
          </select>
          <select
            aria-label="Prospect stage"
            value={filter.stage}
            onChange={(event) => set("stage", event.target.value)}
          >
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option
                key={stage}
                value={stage}
                disabled={
                  !catalog.data &&
                  !legacyStages.some((value) => value === stage)
                }
              >
                {stageLabel(stage)}
              </option>
            ))}
          </select>
          <select
            aria-label="Prospect visibility"
            value={filter.status}
            onChange={(event) => set("status", event.target.value)}
          >
            <option value="active">Active</option>
            <option value="dismissed">Archived</option>
            <option value="all">All</option>
          </select>
          <button
            className="button"
            disabled={!query.data}
            onClick={() => set("pipeline", "1")}
          >
            Pipeline
          </button>
        </div>
        <QueryState
          pending={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.data && (
          <>
            <div className="row" aria-label="Stage totals">
              {Object.entries(query.data.counts.byStage).map(
                ([stage, count]) => (
                  <span className="chip" key={stage}>
                    {stageLabel(stage)} · {count}
                  </span>
                ),
              )}
            </div>
            {query.data.counts.visible > query.data.prospects.length && (
              <p role="status">
                Showing the latest {query.data.prospects.length} of{" "}
                {query.data.counts.visible} matching prospects. Narrow the
                filters to find older records.
              </p>
            )}
            <div className={styles.cards}>
              {query.data.prospects.map((prospect) => (
                <Link
                  className={styles.card}
                  key={prospect.id}
                  href={`/portfolio/prospects/${prospect.id}`}
                >
                  <div className="row">
                    <span className={styles.monogram}>
                      {initials(prospect.displayName)}
                    </span>
                    <div>
                      <h3>{prospect.displayName}</h3>
                      <small>
                        {prospect.geography ??
                          prospect.domain ??
                          "Company details"}
                      </small>
                    </div>
                  </div>
                  <div className="row between">
                    <span className="chip">{stageLabel(prospect.stage)}</span>
                    <small>
                      {memberName(
                        owners.data?.find(
                          (owner) => owner.id === prospect.ownerUserId,
                        ),
                      )}
                    </small>
                  </div>
                  {prospect.nextAction && (
                    <p className="muted">{prospect.nextAction}</p>
                  )}
                </Link>
              ))}
            </div>
            {!query.data.prospects.length && (
              <p className="empty">No prospects match this view.</p>
            )}
          </>
        )}
        {params.has("new") && (
          <ProspectEditor
            onClose={() => set("new", "")}
            onSaved={(record) =>
              router.push(`/portfolio/prospects/${record.id}`)
            }
          />
        )}
        {params.has("pipeline") && query.data && (
          <ProspectPipeline
            data={query.data}
            catalog={catalog.data}
            error={catalog.error}
            onClose={() => set("pipeline", "")}
          />
        )}
      </div>
    </Shell>
  );
}
