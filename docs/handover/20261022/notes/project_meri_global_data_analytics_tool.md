---
name: project-meri-global-data-analytics-tool
description: Meri query_global_data/list_global_datasets tool — governed structured-query analytics over global ingested data (LDA, grants, SEC, FARA, bills, GAO/CRS, FEC, news)
metadata:
  node_type: memory
  type: project
  originSessionId: 8154b514-4f91-47f5-b032-ec872bf72a8f
  modified: 2026-09-04T03:30:32.183Z
---

Built (not deployed) 2026-09-03: two new Meri tools, `query_global_data` and
`list_global_datasets`, giving Meri aggregate/count/group-by analytics over
the global (non-tenant) reference datasets — LDA, SEC, FARA, congress/state
bills, federal grants + SAM.gov opportunities, federal awards, GAO/CRS
reports, FEC, news. Code lives in a worktree at
`C:\Users\neoma\Downloads\capiro-meri-global-analytics-wt`, branch
`agent/meri-global-analytics-tool`, one commit off `origin/main` (`28b1414bc`
base). NOT pushed, NOT merged.

**Why:** Prompted by an investor-facing question ("how many active LDA
registrations do we do") that no existing Meri tool could answer — every
`search_X` tool is a fixed filter list with no aggregation. Answering it by
hand required raw SQL via a one-off Fargate task with direct DB creds — see
[[project_strategies_report_narrative_timeline_members]]-adjacent LDA work
this session, and [[reference-capiro-invpc-task-runner]] for that escape
hatch. This tool is the governed replacement for that specific class of
question, not a general SQL-access grant.

**Design (deliberately NOT free-form SQL + a validator):** a structured query
spec `{dataset, select, filters, groupBy, orderBy, limit, asOfDate}` compiled
to parameterized SQL against a hand-maintained allowlist —
`apps/api/src/meri/analytics/global-dataset-registry.ts` (one entry per
dataset: table, allowlisted columns, reviewed derived/virtual fields) +
`query-spec-compiler.ts` (pure compiler, 25 unit tests, zero SQL-text
parsing). Rejected the free-SQL-with-a-validator approach another agent
("Hermes") proposed for this same problem: this codebase has no SQL-parsing
dependency anywhere, and its own precedent for "let the model compute"
(`run_analysis`) solves it by sandboxing execution with no DB credential at
all, not by validating a query language.

**LDA specifics** (the dataset that started this): `lda_registrations` is a
derived subquery over `lda_filing` (`DISTINCT ON (registrant_id, client_id)`
latest filing per pair, bounded by `asOfDate`, default now). `status`
(active/terminated) is a `CASE` over the official Senate LDA termination
filing-type codes (`1T`, `1TY`, `1@`, `1@Y`, ... — pulled live from
`https://lda.gov/api/v1/constants/filing/filingtypes/` and verified
2026-09-03). **Important data-quality fact discovered while building this:**
`client_id` in the raw LDA feed is scoped to the registration, not the real
company — verified every client_id maps to exactly one registrant_id, and a
single company (Amazon: 40+, Meta: 20+) gets a fresh client_id per firm that
represents it. So "distinct client_id" is NOT "distinct real company" — it's
numerically identical to the registration count in this data. Any "unique
client" number from this feed needs name-based dedup (still an
undercount-of-collapsing, since even normalized names miss variants like
"Amazon" vs "Amazon Web Services").

**Infra additions (code written, NOT applied to any real DB/AWS account):**
- Migration `20280210010000_meri_analytics_ro_role`: new `capiro_analytics_ro`
  role (LOGIN, SELECT-only on exactly the allowlisted tables, role-level
  `statement_timeout`/`lock_timeout`), modeled on `capiro_pe_promoter` /
  `capiro_defense_serve` (see [[reference-capiro-deploy-traps]]-adjacent
  patterns). New `meri_analytics_query_log` audit table.
- CDK: new `DataStack.analyticsSecret` + `DataStack.readerEndpoint` (the
  cluster's reader instance has existed since day one but was **never wired
  to any application** before this — every service's `DB_HOST` resolved to
  the writer). `query_global_data` is the first consumer of the reader
  endpoint.
- `bootstrap-roles.ts` extended with optional `ANALYTICS_USER`/`ANALYTICS_PASSWORD`.

**Verification done:** 25 compiler unit tests + 3 `AnalyticsDbService` tests,
all passing. Full CDK synth (`compute-stack.tango.spec.ts`, 11/11) passes.
`tsc --noEmit` on `apps/api` shows the same 44 pre-existing baseline errors
before and after (confirmed via `git stash`/`stash pop` A-B comparison) — zero
regressions introduced. Tool-manifest/registration parity specs updated
(apps/api tool count 79→81; orchestrator `FULL_CHAT_READ_TOOLS` 35→37;
combined delegated-catalog coverage 79→81) across `apps/api` AND
`meriv2-orchestrator` AND `@capiro/shared`'s `MERI_TOOL_MANIFEST` — all three
must move together or the drift tests fail (confirmed: apps/api is the one
true tool-execution/DB-access layer; meriv2-orchestrator delegates every tool
call back to it over HTTP and fetches schemas live via `GET /clio/tool-schemas`,
so a new tool only needs registering in apps/api's `TOOL_DEFINITIONS` +
`meriv2-orchestrator`'s catalog file, never duplicated logic).

**Corrected a claim from another agent ("Hermes") in the same conversation:**
it described Meri's tools as governed by a generic `CapabilityRegistry`
(readOnly/riskClass/tenantScope/timeoutMs/maxResultBytes). Traced
`search_gao_reports` end-to-end in real code and found no such registry —
the actual mechanism is a plain `TOOL_DEFINITIONS` array + hand-rolled JSON
schema + a `switch` in `execute()`, with read-only/concurrency-safe
classification via a simple `SIDE_EFFECTING_TOOLS` denylist-of-writes Set.
Don't trust another agent's specific architecture claims without tracing the
real code, same as a memory file.

**RLS nuance surfaced during research (relevant to any future tenant-scoped
version of this tool):** `capiro_app`'s RLS-bypass fix
(`docs/plans/2026-07-19-capiro-app-rls-bypass-remediation.md`) was executed
in **dev only** — the doc says prod is "separately gated (scheduled window +
explicit go)" and no commit/doc in-repo confirms the prod `REVOKE
capiro_master FROM capiro_app` ever ran. The doc's own stance: don't treat
RLS as the enforcement boundary — app-side predicates (the `applyTenantScope`
Prisma extension) are the real one. This build sidesteps the question
entirely (every dataset here is global/no-tenant_id), but a Phase 2
tenant-scoped version of this tool would need the compiler to hard-inject
`tenant_id` itself, never rely on a DB role/session variable.

**SHIP IN PROGRESS 2026-09-03 (Neo: "check all the work, fix bugs, merge to
main and ship to aws").** Review found 3 real bugs, fixed in `63eec5d77`:
COUNT(*) BigInt / Decimal rows broke JSON serialization (→ `normalizeRow`),
parse errors escaped as exceptions, no payload cap (→ 256KB + `truncated`).
Real-Postgres itest (`apps/api/scripts/verify-meri-global-analytics-itest.ts`,
24 checks incl. role grants, `= ANY($n)` arrays, write denials) passes.
**PR #1463 MERGED → main `f2746744d274d3b6a161436f2da19fd5a2ae1e20`.**

Deploy state so far:
- `Capiro-dev-Data` CDK-deployed (only stack safe to `cdk deploy`; Compute is
  drifted/UPDATE_ROLLBACK_COMPLETE — hand-roll it, per compute-stack.ts's own
  warning). Secret created:
  `arn:aws:secretsmanager:us-east-1:967807252336:secret:/capiro/dev/aurora/analytics-ro-vVu7Jk`.
  Reader endpoint: `capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv.cluster-ro-csryw28ai752.us-east-1.rds.amazonaws.com`.
- Inline IAM policy `MeriAnalyticsRoSecretRead` attached to BOTH exec roles
  (api `...ApiTaskDefExecutionRoleE6ABB053-YlEDKuUPHjLg`, bootstrap
  `...ApiBootstrapRolesTaskDefExecutio-JoaFYZkykTU0`) — the leading-slash
  `/capiro/dev/aurora/*` names are NOT covered by the existing `capiro/dev/*`
  wildcard, so this was required.
- arm64 images building from main `f2746744d` on builders `mga-api`/`mga-orch`
  → `capiro/dev/api:<sha>` and `capiro/dev/meriv2-orchestrator:<sha>`.
- Live before deploy: api td 278 (image commit `7028c845e`), orchestrator td
  29 (`416d02c69`). Live ledger also lacks #1462's
  `20260903200000_legiwatch_user_prefs` (one additive ALTER) — it rides along.
- Remaining, in order: admin-migrate new rev (image digest) → `migration-status`
  → `migrate` → `migration-status`; bootstrap-roles new rev (+ANALYTICS_USER/
  PASSWORD from the secret) → run; api td (image + `ANALYTICS_DB_HOST`=reader,
  `ANALYTICS_DB_NAME`=capiro, secrets `ANALYTICS_DB_PORT` (master:port),
  `ANALYTICS_DB_USER/PASSWORD` (analytics-ro)) → update-service; orchestrator
  td (image) → update-service; re-run the `capiro-dev-api-db-inspect:21`
  verify-live probe (expects 2025-12-31 active=24,682). Helper scripts in the
  session scratchpad: `mga-oneoff.sh`, `mga-roll.sh`, `patch-taskdef.js`.
- Learned: `GET /api/clio/tool-schemas` is user-JWT-guarded (401 from an
  in-VPC task even with the internal secret) — not usable for headless
  verification; prove tool presence via image contents + Meri chat instead.

**SHIPPED AND LIVE 2026-09-03.** Full sequence completed: `Capiro-dev-Data`
CDK-deployed, migration `20280210010000_meri_analytics_ro_role` applied
(`capiro-dev-api-admin-migrate:37`, `migration-status` clean after),
`capiro_analytics_ro` password rotated live via `bootstrap-roles:6` (verified
login from inside that task), `capiro-dev-api` rolled to `:281` (image
`f2746744d` digest `5c4a1c17...`) with `ANALYTICS_DB_*` wired, orchestrator
rolled to `:30` (same commit, digest `bfffadc1...`) — both `rollout:COMPLETED`.

One retry needed: building both arm64 images concurrently under QEMU crashed
Docker Desktop's whole engine (not just the build) — `docker info` failed via
the named pipe, all buildx builders showed `error`. Fix: relaunch
`Docker Desktop.exe` (found via `Get-Command`/`Get-ChildItem`, no Windows
service — it's a per-user app), poll `docker info` until healthy, then build
the two images **sequentially**, not in parallel. Don't repeat the concurrent
build.

**Live proof, not just a healthy rollout**: ran the exact SQL the compiler
emits, as `capiro_analytics_ro`, against the reader endpoint, from an in-VPC
one-off task. Numbers matched the hand-computed ones from earlier in this
session EXACTLY — active-as-of-2025-12-31 = 24,682, current active = 25,145.
`pg_is_in_recovery()=true` confirmed it hit the reader, not the writer.
Write attempt failed with "cannot execute INSERT in a read-only transaction"
— a bonus defense-in-depth layer I hadn't fully planned for: Aurora read
replicas refuse writes at the engine level regardless of role grants, on top
of the role's own lack of write grants. Tenant table (`clients`) read was
denied as expected.
`GET /api/clio/tool-schemas` needs a real user JWT (ToolServiceSecretGuard
alone isn't enough), so it can't be probed headlessly — verified tool
presence instead by pulling the actual pushed images and grepping their
compiled `dist/` output for `query_global_data`/`list_global_datasets`
(found in both api's `meri-tools.service.js` and the orchestrator's
`full-chat-read-tools.catalog.js`) — the same content that's now running live.

PR: https://github.com/neo-capiro/capirov2/pull/1463 (merged →
`f2746744d274d3b6a161436f2da19fd5a2ae1e20`).

Not touched, deliberately: `Capiro-dev-Compute` CDK stack (still drifted —
hand-rolling was correct here, matches the stack's own warning comment).
