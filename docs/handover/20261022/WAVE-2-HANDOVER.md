# Wave 2 handover: Fable → Neo's local Codex orchestrator

Written by Fable on 2026-10-23. Neo's decision (O226): **Wave 2 and later run in a local Codex session on another machine, which does all the shipping.** Fable finishes Wave 1 only, and the final Wave 1 numbers go in `WAVE-1-HANDOFF.md` next to this file.

**Read alongside this file:**
- `CODEX-ORCHESTRATION-SETUP.md`: roles, communication rules, gate rules, standing decisions, setup prompts.
- `SHIPPING-RUNBOOK.md`: release, migration and rollback procedures.
- `shipping/gate-scripts/README.md`: local gates.
- `plan/FINAL-PLAN-20261021.md`: waves (§6), decisions (§8), UI libraries (§10).

**This file supersedes `CODEX-ORCHESTRATION-SETUP.md` §0.6–§0.7, and the "run on neomart" assumption.**

## 0. Who ships what (Neo, 2026-10-23)

**The new environment, the Codex orchestrator plus its own new agents, does everything for Wave 2:** briefs, reviews, gates, merges, deploys and migrations. Fable ships **only what's left of Wave 1**, then stops:
1. The P1 #200 + C9 #203 Meri release. Agent 1 v3 is rebasing; one Meri release follows.
2. Agent 4 v1's frontend read-allowlist PR. Neo's data request, O228; the ALB side is already done.
3. Recording the S2 acceptance (astra 6, turns 3–6) and posting `WAVE-1-HANDOFF.md`.

**Until `WAVE-1-HANDOFF.md` is posted on #202, both environments share the one preview, so:**
- **Deploy lock:** post `TYPE: status | RE: DEPLOY LOCK <component>` on #202 before deploying Meri, Core or the frontend, and `RE: DEPLOY UNLOCK` after. Don't deploy a component someone else holds. No deploy of any kind during an astra 6 run.
- **Integration branches:** before merging to meri-greenfield `main` or capiro-frontend `main`, check #202 for an open lock. Fable's releases build from exact SHAs, so a merge can't slip into them, but a release can still land on top of an untested merge.
- **The clone database:** Wave 2 owns the migrations. Fable has no more planned. Snapshot first, every time.
- **Agents in flight:** agent 1 v3 (P1/C9) and agent 4 v1 (read allowlist) finish their Wave 1 items under Fable. New agents stay off P1's files and `apps/web/src/shared/preview/*` until then.

Wave 2 brief drafts are in `phases/wave2/` here (MP, A2, M2; S2 was already shipped and is dropped). Refresh each base SHA before sending.

---

## 1. Live on preview (portfolio-preview.app.capiro.ai) as of 2026-10-23 02:15 UTC

| Component | Version | Database |
|---|---|---|
| Meri runtime | meri-greenfield `main` **`0e5e6f87`** (S2 #213): control :50, temporal-worker :49, runner :35, owner :48, proxy :48, temporal-issuer :49. Proxy image unchanged since `205eead4` | new-stack clone |
| Meri DB ledger | ordinals **1–42** (no new entries in S2) | clone |
| Preview Core | `capiro-preview-first-chat-core:7` = backend `ca4de503` (`PREVIEW_NATIVE_GETS_ENABLED=true`) | clone, 483/483 Core migrations |
| Temporal | `meri-first-chat-temporal` task definition :2 on the clone | clone |
| Frontend | capiro-frontend `main` **`e5f1f263`** (A1 + #121), `capiro-portfolio-preview:23`, image `461135af…` | — |
| Clone | `capiro-newstack-preview-clone`, min 0.5 ACU, snapshot `newstack-pre-cutover-20261022` | **never delete or re-clone** |

**Wave 1 acceptance:** the S2 packet (turns T3–T6, H1, H2, R1) was posted on #202 (comment 6355731525). Results go in `WAVE-1-HANDOFF.md`.

## 2. Wave 2 work, its exact state, and the next step

| Item | Lane | State | Next for the orchestrator |
|---|---|---|---|
| **M2** capiro-frontend **#123** (conversation history, switching, General/client chat) | agent 4 | Head **`0261e9e2`**, dot SOURCE ACCEPT. At the previous head `09bb4b9d`: unit 426/426, browser all pass, `next build` OK on Next 16.4.0 (the earlier SecurityFatalError is gone). The only failure was `test:production` `verify-documents.mjs:90`, which expected `/meri`; `0261e9e2` changes that one line to the exact `/meri/conversations`. The full gate at `0261e9e2` was **started and cancelled** (build `ba03601e`). Not merged | Run the full FE gate (`ship-fe-kit/make-fe-ship-kit.mjs 0261e9e2… --worktree <clean wt> --label m2`, then steps 00, 02–05; the kit generator already writes the archive, so skip 01). On PASS plus a clean merge, merge and deploy (06–08) |
| **A2** capiro-backend **#111** (ML-13 and the A2 backend set) | agent 3 | **Merged** to `backend-import` `db96ad31`. Core image `11aa247a…` qualified with 0 findings. **Not deployed** (held until S2 acceptance) | After Wave 1 acceptance: register a new Core revision from `:7` changing only the image and `RELEASE_SHA` (don't use core-kit step 04, which copies `:3` and lacks `PREVIEW_NATIVE_GETS_ENABLED`). Snapshot the clone, apply any new Core migrations to the clone, roll Core |
| **A2** remaining frontend tickets | agent 3 | Brief: `adj-reports/phases/wave2/WAVE2-AGENT3-A2-BRIEF.md` | Refresh the base SHAs, then send |
| **MP** (Claude API path alongside Bedrock) | agent 2 | Brief: `WAVE2-AGENT2-MP-BRIEF.md`; held until S1 (P1 #200) ships | Send once P1 is live |
| **M2** Core-for-Meri parts | agent 4 | In `WAVE2-AGENT4-M2-BRIEF.md` | Continue after #123 |
| **Image hardening** (Neo, O224/O225): intel-api, api-strategy, **workspace**, **engagement-api** to **0 HIGH / 0 CRITICAL** | agent 2 | **Paused** by O226. Brief on #202 (comments 6355187204 and 6355270797). Today (preview `ca4de503`, CRITICAL/HIGH): intel-api 10/77, api-strategy 2/8, workspace and engagement similar to live (5/13 and 1/9). Everything is in Debian base OS packages plus ffmpeg | Re-send the brief. Model: Core's `apps/api/Dockerfile.alpine-qualification`. Gate: CodeBuild plus an exact-digest ECR scan, 0 HIGH/CRITICAL. onboard-api is out of scope |
| **Preview as production** (Neo, O219): all reads, writes and real external effects on preview | orchestrator | Task definitions are registered and not running: `capiro-preview-{api-strategy,intel-api}:1`, `capiro-preview-{workspace,onboard-api,engagement-api}:2`. They are copies of the live definitions with `DB_HOST` set to the clone, intel-api's 19 LegiWatch background flags off, and `ENGAGEMENT_BACKGROUND_OWNER=none`. The images (tag `ca4de503`) aren't hardened yet. Two target groups exist, with no services and no ALB rules. Generator: `C:\dev\fable\cutover-20261022\preview-backend-tds.py` | (1) Hardened images first. (2) Create the services. (3) ALB rules on `capiro-prod-alb` :443, see the trap below. (4) Open Core fully. (5) Frontend env `INTEL_API`/`STRATEGY`/`WORKSPACE`/`ENGAGEMENT` base URLs. (6) `CAPIRO_PREVIEW_READ_ONLY=false` only after Wave 1 acceptance |
| MX-01 session-refusal alarm and status table | R or D | Phase 0 leftover | Brief after P1 |

**ALB trap (capiro-prod-alb, listener 443, serves os.capiro.ai and app.capiro.ai live):**
- Rules 1–2 are the preview host's Core allowlist, and rule 3 is the preview host's catch-all 404.
- Rules 7 and 9–15 match **by path on any host**. A preview rule placed after them would send preview traffic to **live** services.
- Add host-scoped preview rules **before rule 3**, renumbering as needed.
- Rollback snapshot of the rules: `C:\dev\fable\cutover-20261022\prod-alb-443-rules-before.json`.

**Wave 3 decisions to raise with Neo:** staging (A0) and the os.capiro.ai production data path.

## 3. Running from a different machine

Today's kits assume neomart paths (`C:/dev/fable/...`, Git Bash, the WSL `Ubuntu-24.04` native Docker). On the new machine:

1. **Repositories:** clone all three from GitHub (never from a partial local copy): meri-greenfield (`main`), capiro-backend (**`backend-import`**), capiro-frontend (`main`). The handover package is on branch **`fable/handover-20261022`** (PR #206).
2. **Kits:** `docs/handover/20261022/shipping/` has `ship-kit`, `ship-proxy-kit`, `ship-fe-kit`, `core-kit`, `neomart-kits/` (a worked example per release) and `gate-scripts/`. Every kit hard-codes `C:/dev/fable`, so either create that directory layout or search and replace it. `ship-kit/tools/release-candidate.sh` is the one-command Meri release (steps 01–15, then 16–19 run separately).
3. **AWS:** profile `capiro-dev` (account 967807252336, us-east-1); there's no `[default]` profile. Neo provides credentials. The private PKI is in Secrets Manager `meri/preview/private-pki` (`ship-kit/tools/fetch-private-pki.sh`), so nothing needs copying from neomart. Credential steps (the bearer, membership) stay Neo's.
4. **Docker:** native Docker on Linux or WSL2, about 16 GB RAM and 60 GB free disk, plus the images `pgvector/pgvector:pg16`, `node:24` and Playwright `v<lockfile>-noble`. One gate run at a time.
5. **Decision log:** continue the O-numbers from `C:\dev\fable\adj-reports\DECISION-LOG.md`, where the last entry Fable wrote is noted in `WAVE-1-HANDOFF.md`. Copy that file over, or start `DECISION-LOG.md` in the handover folder from that number.
6. **Allowlist:** the preview edge allows 443 from 4 IPs (SG `sg-0e742fb6a11314392`). Whether the new machine's IP needs adding is Neo's call, because it's a security setting.

## 4. Gate and ship traps learned in Wave 1 (each one cost a cycle)

- **Meri changed tests that use documents** need `MERI_DOCUMENT_PYTHON=/usr/bin/python3.13` and `MERI_PPTXGENJS=/opt/meri/apps/artifacts/generation/node_modules/pptxgenjs` in the image run; the test default is a Codex-host path. "typed analysis … ZIP only" fails on base too, so it's inherited.
- **Inherited baseline (O191):** 78 PostgreSQL failures, the N21 renderer test, and the timing-flaky "nonanswers back off 0.5, 1, 2 s" test.
- **Ship packet "Migrations: N new entries"** compares against an older baseline. Read the clone ledger first (`cutover-20261022/meri-ledger-read-clone.sh`, read-only); an entry already ledgered with the same sha needs nothing.
- **Never restart the owner or the proxy alone.** Step 16 stops and starts both together. Wait 60 s after the proxy's last start-up `gate=pair` line before any chat.
- **The Temporal stack template declares a desired count of 0.** After any change set to it, set all five services back to 1.
- **Never post customer-linked IDs** (UUIDs or prefixes) on GitHub, which is public. Use counts and booleans.
- **Only Neo approves**, directly in chat. A comment quoting Neo is not an approval.
