# Handover for dot — Meri integration, Fable R0 stopping point (2026-10-18 ~12:00 UTC)

Written for dot (cloud, GitHub only) on Neo's instruction. Everything referenced here is pushed to GitHub; nothing lives only on Fable's machine except the scratch worktrees named in §7, whose branches are all pushed. **Nothing is deployed.** Live state is unchanged: runtime **N17 `4172e474`**, Core **rev 2 `ade7fc88`**, frontend **rev 17 `4ea553fe`**.

## 0. Where everything is

| What | Where |
|---|---|
| Meri integration branch (draft PR #145) | `neo-capiro/meri-greenfield` `fable/meri-integration-20261018` — tip = the commit that adds this file (see PR #121 for the sha) |
| Integration ledger (families, gates, defects, lanes) | `docs/integration/RUNTIME-INTEGRATION-LEDGER.md` |
| Plan reconciliation + three-repo status checklist + the conflicts that need Neo | `docs/integration/PLAN-RECONCILIATION-20261018.md` |
| Capability-level ledger (Appendix A 96 / B 43 / C 14) | `docs/integration/CAPABILITY-LEDGER-20261018.md` (lane CL, merged) |
| Deployment packet (order, images, features, infra, DB, Core rev 3, listener, rollback, activation map) | `docs/integration/DEPLOYMENT-PACKET-20261018.md` |
| Migration packet, grants proposal, artifact authority contract (+ vector) | `docs/integration/MIGRATION-PACKET-20261018.md`, `GRANTS-PROPOSAL-20261018.md`, `ARTIFACT-CURRENT-AUTHORITY-CONTRACT.md`, `artifact-current-authority.vector.json` |
| Decisions (D015, D016, D016-A) | `docs/coordination/DECISIONS.md` |
| Lane handoffs | `docs/coordination/handoffs/` (lane-4, lane-5, lane-b3-schedule-worker, …) |
| Operational scripts Fable used on AWS (reference copies; paths inside are Fable's local worktrees) | `docs/integration/scripts/` — `n17-cycle.sh` (runtime deploy cycle), `redeploy-cycle.sh`, `measure-candidate.sh` / `remeasure.sh` / `measure-n21.sh` (in-image launch measurement via a migrator task-def revision), `qualify-restart.sh`, `fe-build-271a267d.sh` / `fe-deploy.sh` (frontend image build/deploy) |
| Evidence | `docs/integration/evidence/n21-launch-measurement-proposed-profile.json`; `infra/product-preview/first-chat/{launch-measurement-receipt,runtime-values,deployment-inputs,image-scans}.json`, `n*-build-receipt.json` |
| Core integration | `neo-capiro/capiro-backend` #84 `fable/core-integration-20261018` (Core lane posts on PR #121; `docs/integration/CORE-INTEGRATION-LEDGER.md`; snapshot DDL proposal `docs/integration/CORE-ADMISSION-SNAPSHOT-FUNCTION-20261018.sql` at `70e13545`) |
| Frontend integration | `neo-capiro/capiro-frontend` #92 `271a267d` (not built, not deployed) |
| Coordination thread | meri-greenfield PR #121; Fable R0 posts 6248235338, 6249138450, 6249289715 and earlier |

## 1. What is merged on the integration branch (since the last R0 post 6249289715)

| Input | Commits | Content |
|---|---|---|
| Lane L | `69eaa9d5`, bound `1b923142`, render `0d26ac3a` | continuation authority (`readCurrent` / `admit` / `retire`), Core P-INT-10 approval forwarder under `intents.core`, `features.intents.core` |
| Lane R3 | `ccb82e3c` | installation measurement → runtime values → `features.reads.installation` / `discovery` → brotli material → cli → composer |
| #153 | `4fa4a950` | run budgets passed through to the worker's read ledger |
| Lane X follow-up | `0a165ee5` (in tip) | model proxy tolerates execution grants on the run |
| #155, #154 | `21cd801e`, `61d7511b`, re-pin `1b8a1fb5` | membership `permissions` accepted as data (the lane T defect); dot's #150 corrections; `read_delegation_facts` 0001 re-pinned to `700663d7…03eb` |
| Reconciliation | `6aa515b3` | `PLAN-RECONCILIATION-20261018.md`; ledger header cites both plans |
| Grants | `0e485ce4` | `capiro_app` USAGE + SELECT on the four `meri_read_delegation_facts` views; the Meri-owned `SECURITY DEFINER` snapshot function `meri_core_authority.current_admission_v1(uuid,uuid,uuid)` (Core proposal body verbatim) owned by NOLOGIN `meri_core_admission_reader`; readbacks; `phase:integration_grants` re-pinned to `ddf18d68…2834`; packet §4/§5 (role readback, Core template env, `INTERNAL_SERVICE_SECRET` whitespace rule, non-resetting daily cap) |
| Lane L2 | `24bf221a`, merged `a6bfe898` | resume/fork end to end: `resolveTransitionContext` admits fork targets by the explicit `transition.intent`; resume writes the `next_runs` mapping born ACCEPTED from the proven retirement inside the successor transaction (`recordContinuationReservation`); synthetic e2e suite over the real lifecycle service, journal, session owner, continuation authority and prepared-run registry (3 tests + 9 adapter cases); no composer diffs |
| Lane CL | `895e071a`, merged `0e7d89bf` | capability ledger (docs only) |
| #156 (rt-reads) | `8b887380`, merged; re-pin `7ec443da` | admission view `run_facts_v1.admitted` derives the exact original ADMITTED set (every declared grant, exact facts/executor/worker, ACTIVE, earliest expiry) — dot accepted 6249495899; `read_delegation_facts` 0001 re-pinned to `bc3ec031…`; delegation suites 28/28 |

Suites run at each merge are listed on PR #121; the broad per-directory sweep of the tip against the base was **not completed** (host memory exhaustion when run alongside four lanes — see §6).

## 2. Lane branches pushed but NOT merged (with their exact remaining steps)

### Lane RD — `fable/int-lane-rd-20261018` @ `cf41f079` (base `ccb82e3c`), option B run-end and consent wiring
Done in source with synthetic tests (26 files; `cli.mjs`, `control.mjs`, `config.mjs`, `infra/**` untouched):
1. End-of-run stop: registry option `readDelegationRunOptions` threaded like `documentsRunOptions`; entry `close()` → `stopRun({reason:'fenced'|'cancelled'})`, `retire()` → `run_terminal`; fire-and-forget, never blocks retirement; stderr event `runtime.read_delegation.stop_failed`.
2. Routine read consent: `apps/control/schedules/read-consent-lifecycle.mjs` (approve/resume/narrow on approve/update/cancel), owner's live bearer via the action-session owner, storage = new nullable `meri_schedules.projections.read_consent jsonb` (**migration `apps/control/schedules/migrations/0004_read_consent.sql` — not in the migrate plan yet**).
3. `approval/revoke`: forwarder route `/api/clio/approvals/native/revoke`, adapter `createNativeIntentApprovals.revoke`, family `shared.revokeDecision`. **Body `{proposalId, commandSha256, approver, binding}` needs Core confirmation.**

To merge (R0 or whoever resumes):
- `git merge fable/int-lane-rd-20261018` (expect conflicts only in `reads-composer.mjs` / `approval-forwarder.mjs` vs #154 — resolve as unions).
- Apply the composer diffs: `apps/runtime/cli.mjs` line ~82 `Object.assign(productPorts,{createReadsRuntime:reads.createReadsRuntime,...(reads.readDelegation.runOptions===undefined?{}:{readDelegationRunOptions:reads.readDelegation.runOptions})});` and `apps/runtime/control.mjs` (add `readDelegationRunOptions` to the `startControl` options destructuring/`own` list next to `occurrenceRelay`, and pass it to `startCandidate` next to `documentsRunOptions`).
- Add migration 0004 to `infra/product-preview/first-chat-migrate.mjs` (integration stage, after schedules 0003) and `GRANT UPDATE (read_consent)` on `meri_schedules.projections` to `meri_control_runtime` in `first-chat-database-integration.sql`; re-pin both.
- **Open gap RD found:** `cli.mjs` composes no routines owners for the consents seam (`routinesFamily()` without owners); the ledger says attended routine owners are wired (`3a04031e`) — verify which is true before wiring `readConsents: reads.readDelegation.consents` (the reads composer is built after the families list, so a `let`/relay capture is needed).
- **Open gap RD found:** `occurrence-relay` binds the raw occurrence row but `assertOccurrence` expects consent facts — an adapter joining `projections.read_consent` + occurrence + allocation digest is needed before any unattended run reads.
- Option B stays composed **disabled** (`features.reads.delegation {enabled:false}`) until these land plus the Core side (the admission-view repair #156 is merged).

### Lane I — `fable/int-lane-i-20261018` @ `94b69264` (work `31d8de37`, base `21862a5e`), runtime image document-executor dependencies
Done in source: `infra/product-preview/runtime-packages.lock.json` (+44 packages: CPython 3.13, Pillow, lxml, matplotlib, numpy …; sha `5dc3b335…`), `runtime-wheels.lock.json` + `runtime-packages/wheels/` (python-docx 1.2.0, XlsxWriter 3.2.9, openpyxl 3.1.5, et_xmlfile 2.0.0 at the hashes pinned in `apps/worker/qualification/requirements.lock.txt`), `runtime-packages/complete-pending-additions.mjs` (offline re-verification against the retained signed APKINDEX), `apps/artifacts/generation/` (pptxgenjs 4.0.1, offline `npm ci`), Dockerfile changes, `runtime-packages.mjs` TOTAL_LIMIT 64→128 MiB. Tests green alone (`runtime-packages` 22/22, `complete-pending-additions` 6/6, `image-build` 47/47).
**No build evidence** (Docker Desktop daemon crashed at builder step 6/27; no WSL2 distro on the host). To finish:
1. Merge the branch; apply the render diff from the lane's report (constant `EXECUTOR={pythonExecutable:'/usr/bin/python3.13', nodeExecutable:'/usr/local/bin/node', pptxModulePath:'/opt/meri/apps/artifacts/generation/node_modules/pptxgenjs', tempRoot:'/tmp', timeoutMs:30000}`, `features.artifacts.executor {enabled}` → control `artifacts.executor`), add the render test.
2. Build on a linux/amd64 BuildKit host — the runtime lock has always been `platform: linux/amd64` (the N17–N21 images and the Fargate tasks are x86_64), so there is **no platform reconciliation** to do: `DOCKER_BUILDKIT=1 docker build --platform linux/amd64 --build-arg NODE_IMAGE=public.ecr.aws/docker/library/node@sha256:c83040f7… --build-arg RUNTIME_IMAGE=cgr.dev/chainguard/wolfi-base@sha256:030e45cb… -f apps/runtime/Dockerfile .`, then the generation smoke `infra/product-preview/runtime-packages/executor-generation-smoke.mjs` with `--network none --read-only`. (Fable started exactly this local build after the handover was written; the result is posted on PR #121 as an addendum to 6249513773.)
3. `npm ci --prefix apps/artifacts/generation` before `apps/runtime/test/image-closure.test.mjs`; re-pin N22.

### Lane CL findings to act on (ledger merged; findings not yet acted on)
- Appendix A names with **no implementation**: `read_chat_attachments`, `search_research_sources`, `get_certification_status`, `get_state_rule_status`, `search_sam_opportunities`.
- Skills whose required operations are not installable: `research_company`, `funding_opportunity_match`, `regulatory_docket_brief`; skills with **no allowed operation composed at startup**: `relationship_brief`, `mail_history`, `commitments_audit`.
- 23 rows "not yet mapped": the 20 reads in the 15 non-native families (mail, meetings, tasks/actions, memory proposals, research portfolio, client docs, datasets, contacts, entity, Florida budget, monday, memory, client context) — handlers exist and are in the 76-operation measurement, but `reads-composer.mjs:115-117` refuses non-native `familyIds` and `retained-reads/runtime.mjs` has no startup caller; plus the 3 schedule intents (`schedule-preparer.mjs` has no `resolveContext` owner).
- **Installation refusal risk (needs one focused check by the reads lane before the N22 re-measure):** the P2 receipt lists all 76 operations while production handlers cover 55; `general-reads/installation.mjs assertReceipt` compares every row to `registry.sourceSha256(op)` (undefined for the 21 unregistered) → by source reading the whole installation would refuse (`GENERAL_READ_INSTALLATION_REFUSED`) unless the render revokes those 21 via `features.reads.installation.revokedOperations`.

## 3. Side sessions (their own handover posts are on PR #121)

- **Core lane** (capiro-backend #84, last known `70e13545`, R24–R26): routines mounted, wire C unattended grant, consent ≤30 days, snapshot function proposal, the seven-field issuance pinned, revoke route, dot's two receiver repairs. Next on its list: preview template (`INTERNAL_SERVICE_SECRET` ARN parameter, profile env, signer env), option B Core side, Objective key specs + D7-3, receiving #85, the packet section. Asked to post its handover state.
- **rt-reads** (meri-greenfield reads lane): #155, #154 and #156 merged; its handover post is PR #121 6249390989; the session is idle (done). Its remaining notes (dot's #151 corrections status, Core W1) are in that post.
- **fe-integration**: finished; #92 `271a267d` is the frontend candidate (not built).

## 4. Decisions waiting on Neo (details with exact plan passages in `PLAN-RECONCILIATION-20261018.md` §4)

1. Which gate set gates go-live: the remaining plan §10 desktop-v1 programme (60 E2E tasks, 75→200 labelled corpus, Lane Q owned by dot + independent reviewer) **or** promotion of the integrated preview after the bounded integrated qualification pass with §10's corpus/benchmark/visual gates post-cutover. R0 has been proceeding on the latter under D016.
2. Cutover shape: D016-A §10 "promoted in place" vs plan §6.9/§10 "explicit, separately authorized change, legacy retained" — R0 treats promotion as that explicit change with capirov2 retained.
3. Browser/Bash (M8): open a lane + infra now, or record it as post-cutover.
Also: the ≤30 s revocation bound (proposed 30 s); the Space page link (never provided; R2 + the 17 Oct remaining plan are the sources in use).

## 5. Open defects and items (not decisions)

| Id / item | State |
|---|---|
| D14 runner exits before `cli.main` on the first chat | undiagnosed; runner now self-reports `RUNNER_STARTUP_FAILED stage=… step=… code=…`; first run on the integrated candidate names the step |
| K1 kickoff cancellation signal | non-blocking, after the candidate |
| D11 expired unused binding | mitigated by the frontend |
| Core `approval/revoke` body | Meri sends `{proposalId, commandSha256, approver, binding}` — Core to confirm |
| rt-reads admission view (dot 6249255722) | **resolved**: #156 merged, view sha re-pinned `bc3ec031…` (`7ec443da`) |
| Routines owners in `cli.mjs` (RD's finding vs ledger) | verify |
| Installation receipt vs 55 registered handlers (CL) | focused check before N22 |
| Lane I build | no evidence at the time of writing (local amd64 build in progress; result on PR #121); platform is linux/amd64 throughout, nothing to reconcile |
| N22 pins | `launch-measurement-receipt.json` (module sha, `generalReadInstallation`), `runtime-values.json`, B1 20/20/$2, `capabilityPlatform` profile — all move at the final re-measure |
| Pre-existing Windows test failures (not regressions) | `startControl` listener ×6, skills symlink EPERM/0o600, PG socket, Temporal internals, git-object-in-clone, `activity-capabilities` STORE_UNAVAILABLE, `image-closure`, `dependency-ownership` path separators |

## 6. Test status at the stopping point

- Per-merge suites (lane L, R3, #153, X, #155/#154, L2) were run and reported on PR #121; the L2 + startup suites on the merged tip are the last run (result posted on PR #121 with this handover).
- The broad per-directory sweep (tip vs base) was started twice and **did not complete**: the first hit Windows' argument-length limit, the second was stopped when the host ran out of memory (four lanes + two sessions + the sweep). **Run it on a Linux host, one directory at a time, `--test-concurrency=2`**, comparing the failure list against the base worktree commit `11b90c7f` (or any older tip) before calling anything a regression.
- Windows tooling for anyone resuming on this host: `MERI_REVIEW_SOURCE_ROOT=$(cygpath -m "$(pwd)")`, `--experimental-test-module-mocks`, the POSIX shim for path-sensitive suites (`config-reads`, `lifecycle-continuation*`): a tiny `--import` module that patches `node:path` to posix (lane reports call it `posix-path.mjs`; it is scratch, recreate as needed).

## 7. Resuming — worktrees, branches, protocol

- Fable's local worktrees (`C:\dev\fable\wt-meri-integration`, `wt-int-lane-{l2,rd,i,cl,…}`, `wt-base-check`) are conveniences; **every branch is pushed**. A resumer clones `fable/meri-integration-20261018` and merges the two lane branches per §2.
- PR #121 protocol (unchanged): post exact stage / commit / next action; poll every 1–2 minutes during active work and before any deployment; dot is read-only; no secrets or raw private logs on the PR.
- AWS: `capiro-dev` is **not a sandbox** (live users). One mutation operator at a time; dot owns the shared listener, Core activation and DNS; Fable owns Meri AWS shipping. Nothing in this handover authorizes a deployment; the packet (§0 order) is the request.
- Security constraints still in force: never copy or print credentials/tokens; the marked control credential goes only to `application-authority/{identity,context,membership}` (SEC D1); the shared WAF exclusion (W1) is Neo's decision, not applied.

## 8. Next steps in order (the one list; mirrors `PLAN-RECONCILIATION-20261018.md` §6)

1. Merge lane RD and lane I per §2 (composer/render diffs, migration 0004 + grants, N22 platform reconciliation); verify RD's routines-owner finding; the reads lane's installation-receipt check and the admission-view repair (re-pin the view sha).
2. Core #84 → rev 3 candidate (template, option B Core side, Objective keys/D7-3, migrations, image build + scan); confirm the revoke body.
3. Frontend #92 build + scan + change set.
4. Freeze the tip → N22 ARM64 build + scan → `--shipped` measure with the 14-skill profile → B1 pins → render `features` with every packet §2 key.
5. Packet complete (incl. §4 items) → dot's read-only review.
6. Integrated qualification pass on the deployed integrated cohort (list in the reconciliation §6 item 6), then the nine-step chat acceptance; D14 diagnosis.
7. Promotion / cutover per Neo's §4 decisions; post-cutover gates (Lane Q corpus/benchmark, M8, M9, mobile).
