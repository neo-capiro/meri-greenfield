# Wave 2 handover: Fable → Neo's local Codex orchestrator

Written by Fable on 2026-10-23, at the Wave 1 stopping point. Neo's decisions: **Wave 2 and later run in a local Codex session on another machine, which does all the shipping** (O226, O229), and **Wave 2 starts with item 0, the Claude-native harness** (O239).

## Read these first, in this order

1. **`STANDING-REQUIREMENTS.md`**: Neo's requirements. Claude handles the harness; a simple, standard architecture; leave no dead code; Capiro data must keep working. They override the older plans.
2. **`WAVE-1-HANDOFF.md`**: exactly where Wave 1 stopped, what passed, what didn't run, what is parked.
3. **This file.**
4. **`phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`**: item 0.
5. **`source-of-truth/SUPERSEDED-BY-ITEM-0.md`**: check it before implementing any ticket from the old plans. The plans themselves are marked inline.

**Also:**
- `CODEX-ORCHESTRATION-SETUP.md`: roles, communication rules, gate rules, setup prompts. This file supersedes its §0.6–§0.7 and the "run on neomart" assumption.
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

## 1. Live on preview as of 2026-10-23 (portfolio-preview.app.capiro.ai)

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

## 2. Wave 2 work, its exact state, and the next step

**Do item 0 first (Neo, 2026-10-23).** It changes the runner, proxy, owner, budget and authority code that several items below depend on. Re-check each item against item 0 before sending it.

| Item | Lane | State | Next for the orchestrator |
|---|---|---|---|
| **0. Claude-native harness**: SDK full harness, direct Bedrock, Capiro data as MCP tools; delete the proxy, owner, temporal-issuer, budget reservations and per-operation authority | new lane | Spec: `phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`. Nothing built | Start with the spec's §6 step 1 (the spike, no changes on `main`), then ship each step and check it on preview before the next |
| **M2** capiro-frontend **#123** (conversation history, switching, General/client chat) | agent 4 | Head **`0261e9e2`**, dot SOURCE ACCEPT. At the previous head `09bb4b9d`: unit 426/426, browser all pass, `next build` OK on Next 16.4.0. The only failure was `test:production` `verify-documents.mjs:90`, which expected `/meri`; `0261e9e2` changes that one line to the exact `/meri/conversations`. The full gate at `0261e9e2` was **started and cancelled** (build `ba03601e`). Not merged | Run the full FE gate (`ship-fe-kit/make-fe-ship-kit.mjs 0261e9e2… --worktree <clean wt> --label m2`, then steps 00, 02–05; the kit generator already writes the archive, so skip 01). On PASS plus a clean merge, merge and deploy (06–08) |
| **A2** capiro-backend **#111** (ML-13 and the A2 backend set) | agent 3 | **Merged** to `backend-import` `db96ad31`. Core image `11aa247a…` qualified with 0 findings. **Not deployed** | Use `shipping/core-kit/` (the newest kit: step 04 copies the serving revision and changes only the image and `RELEASE_SHA`; `make-core-kit.py` shows how a kit is derived from the previous one). Set `ROLLBACK_TD`, `ROLLBACK_DIGEST` and `ROLLBACK_SHA` in `kit.env` to the serving **`:9`**. Snapshot the clone, apply any new Core migrations to the clone (`045-migrate-clone.sh`), roll Core. Decide first how capiro-backend #115 and #116 fit |
| **A2** remaining frontend tickets | agent 3 | Brief: `phases/wave2/WAVE2-AGENT3-A2-BRIEF.md` | Refresh the base SHAs, then send |
| **MP** (Claude API alongside Bedrock) | agent 2 | **Re-scoped by item 0** to an SDK provider setting: `phases/wave2/WAVE2-AGENT2-MP-BRIEF.md` | Send after item 0 step 2 is released |
| **M2** Core-for-Meri parts | agent 4 | In `WAVE2-AGENT4-M2-BRIEF.md`, with an item 0 note | Continue after #123 |
| **Image hardening** (Neo, O224/O225): intel-api, api-strategy, **workspace**, **engagement-api** to **0 HIGH / 0 CRITICAL** | agent 2 | **Paused** by O226. Brief on #202 (comments 6355187204 and 6355270797). Today (preview `ca4de503`, CRITICAL/HIGH): intel-api 10/77, api-strategy 2/8, workspace and engagement similar to live (5/13 and 1/9). Everything is in Debian base OS packages plus ffmpeg | Re-send the brief. Model: Core's `apps/api/Dockerfile.alpine-qualification`. Gate: CodeBuild plus an exact-digest ECR scan, 0 HIGH/CRITICAL. onboard-api is out of scope |
| **Preview as production** (Neo, O219): all reads, writes and real external effects on preview | orchestrator | **Partly done on 2026-10-23.** Services now run for api-strategy, workspace and intel-api (see §1); the preview read gate admits all Core GETs. Left: hardened images (above); services for onboard-api and engagement-api; frontend base URLs for their calls; `CAPIRO_PREVIEW_READ_ONLY=false` | Do the hardened images first, then the remaining services and ALB rules (see the trap below), then writes |
| MX-01 session-refusal alarm and status table | — | **Done** (#212) | — |

**ALB trap (capiro-prod-alb, listener 443, serves os.capiro.ai and app.capiro.ai live).** Current layout (snapshot in `shipping/alb-snapshots/`):
- **Preview rules, host-scoped to `first-chat-preview.app-dev.capiro.ai`:** 1 (POST allowlist), 2 (GET/HEAD `/api/*`), 3 (`/strategy-api/*`), 5 (`/workspace-api/*`), 6 (`/intel-api/*`), and **7, the preview catch-all 404**. Rule 4 is a different host (`meri-preview.capiro.ai`).
- **Live rules:** 9–19 and 20, 50. Most of them match **by path on any host**, so a preview rule placed after them sends preview traffic to **live** services. Never modify them.
- **There is no free slot below the catch-all in this snapshot.** Plan any new routing using preview-host rules only: inspect the current listener, consolidate preview conditions where equivalent, and reorder only preview rules while preserving their host conditions and catch-all. Never renumber or change live rules to make space. If a preview-only plan does not fit, use a separate preview listener or routing endpoint and verify it before cut-over. Re-snapshot before and after and compare all live rules unchanged.

**Wave 3 decisions to raise with Neo:** staging (A0) and the os.capiro.ai production data path.

---

## 3. Running from a different machine

Today's kits assume neomart paths (`C:/dev/fable/...`, Git Bash, the WSL `Ubuntu-24.04` native Docker). On the new machine:

1. **Repositories:** clone all three from GitHub (never from a partial local copy): meri-greenfield (`main`), capiro-backend (**`backend-import`**), capiro-frontend (`main`). The handover package is in meri-greenfield `docs/handover/20261022/` (branch **`fable/handover-20261022`**, PR #206, until it is merged).
2. **Kits:** `docs/handover/20261022/shipping/` has `ship-kit`, `ship-proxy-kit`, `ship-fe-kit`, `core-kit`, `db-scripts/`, `preview-backends/` (how the preview backends and the Workspace migration were done), `neomart-kits/` (a worked example per release), `gate-scripts/` and `alb-snapshots/`. The kits are the versions in use on 2026-10-23, including the O231 fix (the deployment inputs, and so the database, come from the repo's pinned inputs). Every kit hard-codes `C:/dev/fable`, so either create that directory layout or search and replace it. `ship-kit/tools/release-candidate.sh` is the one-command Meri release (steps 01–15, then 16–19 run separately). It needs **`MERI_PREVIEW_CLIENT_ID`** (the preview's client id, kept in the private deploy inputs; Neo provides it).
3. **AWS on EC2AMAZ-M7CDRPT:** use the configured `default` profile, account `967807252336`, region `us-east-1`, as Neo directly instructed. `capiro-dev` is the historical neomart profile; inspect and replace explicit profile arguments when adapting a kit. Never copy credentials between machines or print secret values. The old pair's PKI is in Secrets Manager `meri/preview/private-pki`; use it only if a still-required release step needs it, and remove it with the pair in item 0. The Core bearer remains a separate required credential. Neo has lifted the earlier AWS-write hold and authorized the sole Codex orchestrator to complete Wave 2 autonomously through review, qualification, migration and shipping.
4. **Docker:** native Docker on Linux or WSL2, about 16 GB RAM and 60 GB free disk, plus the images `pgvector/pgvector:pg16`, `node:24` and Playwright `v<lockfile>-noble`. One gate run at a time.
5. **Decision log:** `decision-log/DECISION-LOG.md` now runs to **O239**. Continue from **O240**.
6. **Allowlist:** the preview edge allows 443 from 4 IPs (SG `sg-0e742fb6a11314392`). Whether the new machine's IP needs adding is Neo's call, because it's a security setting.
7. **Agent budgets:** agent sessions hit a weekly usage limit on 2026-10-23, in the middle of a fix. Plan sessions so that work stays committed and pushed, not only in a local worktree.

---

## 4. Gate and ship traps learned in Wave 1 (each one cost a cycle)

- **Meri changed tests that use documents** need `MERI_DOCUMENT_PYTHON=/usr/bin/python3.13` and `MERI_PPTXGENJS=/opt/meri/apps/artifacts/generation/node_modules/pptxgenjs` in the image run; the test default is a Codex-host path. "typed analysis … ZIP only" fails on base too, so it's inherited.
- **Inherited baseline (O191):** about 120 unit failures on `main` that also fail on the base: openssl-backed owner TLS tests, tests that need the PostgreSQL socket, "typed analysis … ZIP only", the N21 renderer test, and the read-family fixtures that refuse `readCurrent`. Prove any failure inherited by running it on `origin/main`.
- **Ship packet "Migrations: N new entries"** compares against an older baseline. Read the clone ledger first (`shipping/db-scripts/meri-ledger-read-clone.sh`, read-only); an entry already ledgered with the same sha needs nothing.
- **Never restart the owner or the proxy alone.** Step 16 stops and starts both together. Wait 60 s after the proxy's last start-up `gate=pair` line before any chat. (Both go away with item 0.)
- **The Temporal stack template declares a desired count of 0.** After any change set to it, set all five services back to 1.
- **After a Meri release, the first control task exited once** about 5 minutes after it started (exit code 3; cause not proven). The replacement stayed up for more than 35 minutes. Watch for a repeat after the next release.
- **The first turn after a release looks stuck on "Queued"** for about 55–60 s: that is the runner's Fargate cold start, not a failure.
- **The release kit takes its deployment inputs from the repo's `infra/product-preview/first-chat/deployment-inputs.json`**, which points at the clone database (O231). The earlier kit pointed Meri at the shared live database by mistake; check the DB block before any release.
- **Secrets Manager allows 20 version labels per secret.** Remove the old labels per release or the render step fails.
- **Prisma:** `$queryRawUnsafe` on a function that returns void fails with P2010. Use `$executeRaw`. That is what broke Portfolio's saved card order.
- **Bash tool traps (Windows):** it pre-expands `$VAR` and collapses `\\`, so put commands in script files. `MSYS_NO_PATHCONV=1` is needed for `aws logs` group names but breaks node paths.
- **Never post customer-linked IDs** (the tenant, actor, conversation ids and the like) on GitHub, which is public. Use counts and booleans. Infrastructure identifiers (account, ARNs, digests, SHAs) are approved. Neo said the Anduril test client's id on GitHub was fine (2026-10-23: "thats fine on anduril"); that covers Anduril only.
- **Only Neo approves**, directly in chat. A comment quoting Neo is not an approval.
