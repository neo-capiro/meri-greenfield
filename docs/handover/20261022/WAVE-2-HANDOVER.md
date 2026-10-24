# Wave 2 handover and current execution pointers

Updated24 October2026 for Neo's approved autonomous AgentCore Runtime V1 migration. Root Codex owns implementation coordination, review, gates and shipping. The original23 October live observations below are historical, not current deployment pins. Read the [current migration/completion matrix](plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md) before assigning work.

## Read these first, in this order

1. **`STANDING-REQUIREMENTS.md`**: Neo's requirements. Claude handles the harness; a simple, standard architecture; leave no dead code; Capiro data must keep working. They override the older plans.
2. **`WAVE-1-HANDOFF.md`**: exactly where Wave 1 stopped, what passed, what didn't run, what is parked.
3. **This file.**
4. **`phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`**: item 0.
5. **`source-of-truth/SUPERSEDED-BY-ITEM-0.md`**: check it before implementing any ticket from the old plans. The plans themselves are marked inline.

**Also:**
- `CODEX-SETUP.md` and `CODEX-VALIDATION-AND-SHIPPING.md`: current roles, local gates and shipping. Older orchestration setup is historical.
- `SHIPPING-RUNBOOK.md`: release, migration and rollback procedures. Its owner/proxy and issuer sections describe components item 0 deletes.
- `shipping/gate-scripts/README.md`: local gates.
- `plan/FINAL-PLAN-20261021.md`: waves, decisions (§8, now 1–15), UI libraries (§10). Updated in place with a banner and inline markers.

---

## 0. Who ships what (Neo, 2026-10-23)

**The new environment, the Codex orchestrator plus its own new agents, does everything for Wave 2:** briefs, reviews, gates, merges, deploys and migrations. Fable's shipping ended at the stopping point in `WAVE-1-HANDOFF.md`.

From the moment `WAVE-1-HANDOFF.md` is posted on #202:

- **Fable starts no more deploys, merges or migrations.** The deploy lock passes to the orchestrator.
- **Deploy lock (the preview is one shared environment):** post `TYPE: status | RE: DEPLOY LOCK <component>` on #202 before deploying Meri, Core or the frontend, and `RE: DEPLOY UNLOCK` after. Don't deploy a component someone else holds. No deploy of any kind during a live acceptance run.
- **The clone database:** Wave 2 owns its migrations. Snapshot first, every time. Never delete or re-clone it.
- Wave 2 brief drafts are in `phases/wave2/` (MP, A2, M2). Refresh each base SHA before sending. S2 shipped and its brief is dropped.

---

## 1. Historical preview receipt as of 2026-10-23 (portfolio-preview.app.capiro.ai)

| Component | Version | Notes |
|---|---|---|
| Meri runtime | meri-greenfield `main` **`05d588c7`** (#227): control :60, temporal-worker :59, temporal-issuer :59, owner :58, proxy :58, runner :45 | Released 13:57–14:19Z. #227 makes the proxy authorize a request once, at its start, and settle a cut request's hold. New proxy image; the scan's one UNDEFINED-severity ca-certificates finding was accepted (O234). DB ledger ordinals 1–42, no new entries |
| Preview Core | `capiro-preview-first-chat-core:9` = capiro-backend PR #116's head (`ca4de503` plus the saved-layout lock fix), `PREVIEW_NATIVE_GETS_ENABLED=true` | Clone DB. Read-only mode is still on. PRs #115 and #116 are open and not merged; merging them is a separate decision from deploying them to live Core |
| Preview backends (clone DB) | `capiro-preview-api-strategy:1`, `capiro-preview-workspace:3`, `capiro-preview-intel-api:1`, one task each | The clone was migrated forward once to add the Workspace column the service needs (snapshot `capiro-newstack-preview-clone-pre-ws-client-id-20261023`). onboard-api and engagement-api have task definitions only, no services |
| Frontend | capiro-frontend `main` with #125 and #126 (the preview read gate admits every Core GET, plus strategy, workspace and intel GETs), `capiro-portfolio-preview:25` | |
| Clone | `capiro-newstack-preview-clone`, 0.5–4 ACU, Postgres 16 | **Never delete or re-clone.** Snapshots: `newstack-pre-cutover-20261022`, `newstack-pre-meri-db-move-20261023`, `capiro-newstack-preview-clone-pre-ws-client-id-20261023` |
| Temporal server | `meri-product-preview-temporal-*` services, revision :2 | |

**Chat on preview (2026-10-23, release `05d588c7`):** a new conversation, one simple question, **completes** with the full answer and no cut. It is not grounded in Capiro data, because the read tools are off. Per simple turn it is **slow and heavy**: 61 s of Fargate cold start before the run starts, first text at about 81 s, the turn ends at about 217 s (the model stream itself took 4.7 s). Control made 372 Core `/current` calls (Core time 20.6 s), about 800 ECS describes and about 73,000 database statements. The agreed limits are ≤ 30 Core calls and ≤ 3 s Core time per turn. The fix that was in flight (`WAVE-1-HANDOFF.md` §5) did **not** ship. Also: the live-stream endpoint (`/api/conversations/events/<run>/stream`) returned 503 on every attempt during that turn, so the page showed the answer by polling history; and a browser tab left open for about an hour lost its Meri session (401 `SESSION_REFUSED`) until it was reloaded. Details in `WAVE-1-HANDOFF.md` §4.

**What preview shows from Core (checked in Chrome):** Portfolio lists 18 profiles with the saved card order. A client's Overview, Work and Bill Tracker show real data (profile, owner, activity timeline, district nexus, strategies and steps, tracked bills with passage estimates). Workspace documents load; the test client simply has none matched by name. Still empty or placeholder: Engagement pulse, Engagement health, Deadline stress, Open requests and Program funding context are hard-coded in the frontend with no backend (product work); Objectives are empty because the clone has none; `clients.list` for module pickers is blocked because it routes to a roster backend that isn't configured on preview.

**Wave 1 acceptance:** the S2 packet is on #202 (comment 6355731525): T3 first turn completes; T4 follow-up in the same conversation; T5 reload while streaming reconnects; T6 Stop mid-stream ends cleanly; H1 history loads; H2 history filter menus; R1 revocation within 30 s (Neo arranges). Only T3 was run on the current release. See `WAVE-1-HANDOFF.md`.

---

## 2. Current work and completion

The [approved migration plan](plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md) owns the current completion/deletion matrix. Reuse current reviewed sources; do not restart the historical SDK spike or execute old kit commands. As of 24 October, 15:26 UTC, AgentCore Runtime V1 version 2 and all five native TLS Temporal roles are deployed. Control revision64 and worker revision63 are running on the qualified runtime image; the app stack is UPDATE_COMPLETE, both control target groups are healthy, and the worker passes its ECS liveness check. Private readiness and actual chat acceptance are separate checks. The replacement preview is **not yet ready for advertised testing**: Core revision10 has completed its healthy rollout; frontend qualification and private readiness remain open.

The qualified runtime remains source `7eea1e852f177c17e3675429830b886b906e4cd6`, image `sha256:1421f5cb090a010be2c3e3faa8c549f2c570c30a7432641efcca839dd8a8e35d`. The independently reviewed configuration repair merged in Meri PR236 and is deployed. Data reads compose the memory-context relay, which now has its required canonical retention and existing private storage owner. The existing encrypted, versioned bucket and prefix are retained; bucket-list permission distinguishes an absent initial ledger from denied access. Object/KMS permissions and the synthetic qualification subtree remain unchanged. No new bucket, key, service, tenant identity or model loop was introduced. Document generation/download activation and 30-day purge acceptance remain separate unfinished Wave 2 work.

A subsequent root-only private readiness probe from the local WSL host timed out for control, worker and Temporal. This is not a successful readiness result and does not yet distinguish operator-network reachability from a service dependency problem. The probe material was released and its disposable container and RAM staging were removed; no service, security group or database changed. See `root/private-readiness-64-63-live.log` and the time-bound deployed receipt `root/deployed-native-stack-2026-10-24T15-26-32-283Z.json` under `C:/dev/wave2-evidence-20261024`.

The retained local environment is at `http://localhost:5199` with Core on port5198. Keep its WSL services, data, development authentication and caches across waves. Local health does not establish preview acceptance. Root owns shipping and live acceptance; A owns frontend qualification, R independent review/readiness and retirement preparation, and D the remaining hearing-backed batch-move seam. Continue to require client and General chat, authorized reads, follow-up and Stop on the actual deployed preview before announcing readiness.

- Core source `d03a118192acd2b1ed2ef5698afb0ab8f2b36ae8` is merged through PR119; PR120 binds its reviewed preview operator. Native ARM qualification passes static40/runtime44 overlapping checks. ECR scan completed with zero findings; full-image Trivy has zero HIGH/CRITICAL, six MEDIUM and two LOW findings retained for root-owned dependency follow-up. Image `sha256:a1e35b1aeae40889b46c75df472ced83aebe54b8f78234bffef4192c9767e375` is deployed as Core revision10; its sole service deployment is COMPLETED and its target is healthy. The app, Temporal and Core stacks are UPDATE_COMPLETE. Both preview routing rules match the reviewed template, and all19 other listener rules are unchanged. The old b982 image is blocked by its full-image HIGH findings and must not be reused despite its earlier ECR result.
- After the verified encrypted snapshot, exactly three API migrations were applied to the persistent preview clone. All671 prior ledger rows (570 finished,101 rolled back) are unchanged; the result is674 rows, zero unfinished, and all48 Meri entries unchanged. Inherited historical checksum differences remain documented; no reset, resolve or unrelated service migration ran. The migration image's unchanged `sslmode=require` is not a claim of CA/hostname verification; the independent ledger reader verifies both against the pinned RDS CA.
- Frontend PR130 now carries reviewed source `5744f912d6ef83b3eb23983f6558b90be342229f`. The preceding native044ef job passed all3,316 web cases (36 inherited skips) and failed one stale registry-inventory test. The test-only successor independently preserves its negative guards and passes the affected local suites. A separately reviewed invocation repair restores the Elements qualifier's required absolute external directory without weakening gates or publication refusal. The immutable archive is bound to native CodeBuild job `0423dd36-d644-4470-bed1-72043dfaa210`. At15:31, the actual ARM Elements qualification and both targeted browser groups (14 and63 cases) passed; the full1,365 browser suite was running. Overall build/image qualification and live acceptance remain open. These separately attributed results are not a whole-build pass.
- MP preferences, immutable admission selection and configured SDK provider/model/effort plumbing now have source gates and **11/11 actual ordinary-role PostgreSQL tests**. Basic chat uses the existing configured Bedrock default when no selection is supplied. Other models are not made available by metadata discovery or synthetic tests; picker UI and real provider-switch/continuity acceptance remain open. Background Objective model/consent semantics are unchanged.
- Selected-document source has D's independent **162 passing controls** and root's separate actual Linux DOCX bridge **37/37**. These overlapping groups prove bounded owners/renderer behavior, not deployed approvals, storage/PG semantics or preview acceptance.
- The48-entry Meri ledger is applied with prior entries preserved; actual-role retention serving/recovery checks pass. Full physical purge, final schedule production placement, live resource retirement and all remaining accepted features stay open. A bounded retirement packet preserves rollback until replacement acceptance and retains the repaired storage permissions. Client/General chat, authorized reads, follow-up, Stop, reconnect and restore must pass on the matching deployed stack before preview readiness is claimed.

| Work | Current direction | Completion rule |
|---|---|---|
| Item0 | Actual Claude SDK/full harness on V1, durable native persistence, all data tools and simplified canonical authorization | Integrated image/platform, permissions, context, streaming, Stop, cost and live acceptance; delete replaced callers/resources |
| A2 | Keep every accepted Core/frontend/Settings/Portfolio/Mail ticket, including ST24/ST27 and client record writes | Exact integration/native/API/browser/provider acceptance; source review alone is not delivery |
| M2 | General/client chat, history/switching, entity context and full frontend/core contract | Preserve scope selection, current permissions and memory rules; activate only with actual compatible owners |
| MP | Existing preferences CAS and immutable admitted selection; configured Bedrock default, picker UI still open | Actual provider-specific model/effort/continuity and UI qualification; no model proxy recreation |
| Image hardening | Continue required native ARM Core/backend/frontend images and exact-digest scans | Zero HIGH/CRITICAL, disclosed lesser findings, actual native/database/runtime gates |
| Preview behavior | User lifted the client-record read-only restriction, with tenant/member/client walls and selected-client policy retained | Exact route/method and source-bound host admission; preserve Meri routing, do not globally flip the legacy preview marker to bypass guards |
| Remaining product | All original read families, memory,14 skills, artifacts, browser/Bash, schedules and frontend features remain | Each closeout row accepted; no first-chat milestone or limited release closes the full scope |

**ALB trap (capiro-prod-alb, listener 443, serves os.capiro.ai and app.capiro.ai live).** Current layout (snapshot in `shipping/alb-snapshots/`):
- **Preview rules, host-scoped to `first-chat-preview.app-dev.capiro.ai`:** 1 (POST allowlist), 2 (GET/HEAD `/api/*`), 3 (`/strategy-api/*`), 5 (`/workspace-api/*`), 6 (`/intel-api/*`), and **7, the preview catch-all 404**. Rule 4 is a different host (`meri-preview.capiro.ai`).
- **Live rules:** 9–19 and 20, 50. Most of them match **by path on any host**, so a preview rule placed after them sends preview traffic to **live** services. Never modify them.
- **There is no free slot below the catch-all in this snapshot.** Plan any new routing using preview-host rules only: inspect the current listener, consolidate preview conditions where equivalent, and reorder only preview rules while preserving their host conditions and catch-all. Never renumber or change live rules to make space. If a preview-only plan does not fit, use a separate preview listener or routing endpoint and verify it before cut-over. Re-snapshot before and after and compare all live rules unchanged.

**Wave 3 decisions to raise with Neo:** staging (A0) and the os.capiro.ai production data path.

---

## 3. Running from a different machine

Historical kits assume neomart paths (`C:/dev/fable/...`, Git Bash, the WSL `Ubuntu-24.04` native Docker). On the new machine:

1. **Repositories:** clone all three from GitHub (never from a partial local copy): meri-greenfield (`main`), capiro-backend (**`backend-import`**), capiro-frontend (`main`). The handover package is in meri-greenfield `docs/handover/20261022/` (branch **`fable/handover-20261022`**, PR #206, until it is merged).
2. **Current gates and shipping:** follow [CODEX-VALIDATION-AND-SHIPPING.md](CODEX-VALIDATION-AND-SHIPPING.md) and [SHIPPING-RUNBOOK.md](SHIPPING-RUNBOOK.md). The [runtime image build](../../../infra/product-preview/image-buildspec-design.md) uses the checked-in ARM buildspec/shell and exact reviewed source; [gate-scripts/README.md](shipping/gate-scripts/README.md) points to current source checks and unmet native acceptance. Root coordinates qualification and shipping from current source and fresh live readback. The dated kits under `shipping/`, including copied `neomart-kits/`, preserve release history only; do not execute them as a current recipe or restore the removed Meri release launcher.
3. **AWS on EC2AMAZ-M7CDRPT:** use the configured `default` profile, account `967807252336`, region `us-east-1`, as Neo directly instructed. `capiro-dev` is the historical neomart profile; inspect and replace explicit profile arguments when adapting a kit. Never copy credentials between machines or print secret values. The old pair's PKI is in Secrets Manager `meri/preview/private-pki`; use it only if a still-required release step needs it, and remove it with the pair in item 0. The Core bearer remains a separate required credential. Neo has lifted the earlier AWS-write hold and authorized the sole Codex orchestrator to complete Wave 2 autonomously through review, qualification, migration and shipping.
4. **Docker:** native Docker on Linux or WSL2, about 16 GB RAM and 60 GB free disk, plus the images `pgvector/pgvector:pg16`, `node:24` and Playwright `v<lockfile>-noble`. One gate run at a time.
5. **Decision log:** `decision-log/DECISION-LOG.md` now runs to **O239**. Continue from **O240**.
6. **Allowlist:** the preview edge allows 443 from 4 IPs (SG `sg-0e742fb6a11314392`). Whether the new machine's IP needs adding is Neo's call, because it's a security setting.
7. **Agent budgets:** agent sessions hit a weekly usage limit on 2026-10-23, in the middle of a fix. Plan sessions so that work stays committed and pushed, not only in a local worktree.

---

## 4. Historical Wave1 incidents and retained operational lessons

- **Meri changed tests that use documents** need `MERI_DOCUMENT_PYTHON=/usr/bin/python3.13` and `MERI_PPTXGENJS=/opt/meri/apps/artifacts/generation/node_modules/pptxgenjs` in the image run; the test default is a Codex-host path. "typed analysis … ZIP only" fails on base too, so it's inherited.
- **Inherited baseline (O191):** about 120 unit failures on `main` that also fail on the base: openssl-backed owner TLS tests, tests that need the PostgreSQL socket, "typed analysis … ZIP only", the N21 renderer test, and the read-family fixtures that refuse `readCurrent`. Prove any failure inherited by running it on `origin/main`.
- **Ship packet "Migrations: N new entries"** compares against an older baseline. Read the clone ledger first (`shipping/db-scripts/meri-ledger-read-clone.sh`, read-only); an entry already ledgered with the same sha needs nothing.
- **Historical model pair:** the old pair-restart protocol belongs only to its archived receipt. Remove the replaced services and instructions; it is not a native SDK or AgentCore prerequisite.
- **Temporal:** compare the reviewed template to fresh live desired counts. A dated stopped template is not an executable update; preserve required durable services and authentication.
- **After a Meri release, the first control task exited once** about 5 minutes after it started (exit code 3; cause not proven). The replacement stayed up for more than 35 minutes. Watch for a repeat after the next release.
- **Historical cold start:** per-turn Fargate launch consumed roughly44–60 seconds in observed releases. The approved V1 migration must measure real cold/warm/restore latency; a stuck queue is not assumed healthy.
- **The release kit takes its deployment inputs from the repo's `infra/product-preview/first-chat/deployment-inputs.json`**, which points at the clone database (O231). The earlier kit pointed Meri at the shared live database by mistake; check the DB block before any release.
- **Secrets Manager allows 20 version labels per secret.** Remove the old labels per release or the render step fails.
- **Prisma:** `$queryRawUnsafe` on a function that returns void fails with P2010. Use `$executeRaw`. That is what broke Portfolio's saved card order.
- **Bash tool traps (Windows):** it pre-expands `$VAR` and collapses `\\`, so put commands in script files. `MSYS_NO_PATHCONV=1` is needed for `aws logs` group names but breaks node paths.
- **Never post customer-linked IDs** (the tenant, actor, conversation ids and the like) on GitHub, which is public. Use counts and booleans. Infrastructure identifiers (account, ARNs, digests, SHAs) are approved. Neo said the Anduril test client's id on GitHub was fine (2026-10-23: "thats fine on anduril"); that covers Anduril only.
- **Current authority:** Neo directly authorized root to finish autonomously. Root allocates protected changes and releases; historical holds do not add a new approval loop. Quoted comments do not create new authority.
