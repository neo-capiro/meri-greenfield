# New-stack database cut-over: run plan (Fable)

> **HISTORICAL.** This cut-over ran on 2026-10-22 (O210). Do not run it again. The clone database is never deleted or re-cloned. Current hosting and release requirements are in the [AgentCore migration plan](AGENTCORE-RUNTIME-MIGRATION-20261024.md); the old owner/proxy/issuer steps below are history, not current commands.

**Goal:** Core (`backend-import` 89fcf2bb: consolidated Core plus A1) and the whole Meri runtime (control, worker, owner, proxy, issuer, Temporal) run on **one** database, `capiro-newstack-preview-clone` (Neo, O175/O183). The live shared cluster is never touched.

**Why both together:** Core's admission check reads Meri's tables in Core's own database (`meri_core_authority.current_admission_v1`). A split breaks conversation verification (O181).

## Preconditions
1. Agent 2's re-pin PR is merged (deployment-inputs `host`, temporal-binding `clusterArn` and `endpoint` point at the clone), after dot's exact-head ACCEPT.
2. Core image for 89fcf2bb is built and qualified: a `ship-core-89fcf2bb` kit (copy of ship-core-efd03f19), with in-image gates and a scan with 0 findings.
3. Meri release candidate built from the merged `main` (the re-pin), with a new render (stage-3 material carrying the clone host).
4. A quiet window: no turns in flight (check control `run.running`).

## Order (one window, about 60–90 min)
1. **Snapshot the clone:** `aws rds create-db-cluster-snapshot --db-cluster-identifier capiro-newstack-preview-clone --db-cluster-snapshot-identifier newstack-pre-cutover-<date>`, then wait until available.
2. **Meri ledger on the clone:** read-only `meri-ledger-read.sh` against the clone (PGHOST = the clone). Expect 1–42; apply nothing unless the re-pin release adds entries.
3. **Core migrations on the clone (A1):** `045-migrate-clone.sh` from the 89fcf2bb kit, adding `20281022010000_meeting_debrief_approval_metadata`. Expect "All migrations have been successfully applied".
4. **Temporal:** update the foundation-managed Temporal frontend/history/matching task definitions' `SQL_HOST_NAME` to the clone, through the stack carrying temporal-binding (render from the merged `main`), keeping TLS verification. Stop and start Temporal together.
5. **Meri runtime:** execute the release (steps 16 model pair, 17 issuer, 18 app, 19 verify) **back to back**. 16→18 must not be interrupted (O171 incident). Run it in one foreground session.
6. **Core:** register `:7` = 89fcf2bb image + the `:6` env (DB_HOST = clone, `PREVIEW_NATIVE_GETS_ENABLED=true`; the other new flags off), then roll it.
7. **Health:** `/healthz` 200; `/api/me` 401 unauthenticated; in Neo's Chrome, `/me` and `/clients` 200; the Meri page loads, and New conversation bootstraps (POST 200). **No model turns** (acceptance is stopped at 2/6 until S2).

## Rollback (reverse order, all prepared before starting)
- Core: roll to `:3` (0f5d7e15, shared DB).
- Meri runtime: forward-redeploy the previous release's deployment inputs (205eead4 kit), shared DB.
- Temporal: restore the previous `SQL_HOST_NAME` (shared cluster).
- The clone stays as it is (the snapshot is a fallback; never re-clone).

## Known traps
- Owner and proxy restart only as a pair. Wait 60 s after the last `gate=pair` line.
- Each release adds a secret label. The quota is 20, and there are 16 now: room for 4 releases.
- The Windows AWS CLI needs `PYTHONUTF8=1` for log output.
- Long chains must run in one foreground session. A session restart killed 16→18 once.
