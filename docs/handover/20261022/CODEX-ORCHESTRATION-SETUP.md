# Codex orchestration and shipping setup (Capiro / Meri)

Handover from Fable (Claude Code) to Codex, 2026-10-22. **Codex takes over Fable's role, coordinator and shipper, starting with Wave 2.** §0.6 gives Codex the Wave 1 state it inherits; §0.7 is how it starts Wave 2.

Run it on **neomart** (Windows 11, user neoma), where the repositories, kits, AWS profile and Docker live. Run the six prompts below in order, in one setup session. Steps 1–4 are required; 5 is optional; 6 is the per-task prompt.

---

## 0. Facts every prompt relies on (read once; prompts below reference this section)

### Repositories (all on neomart; keep locations and histories)

| Repo | Local path | Integration branch | What it is |
|---|---|---|---|
| neo-capiro/meri-greenfield | `C:\dev\fable\meri-greenfield` | `main` | Meri runtime: control, worker, runner, owner/proxy pair, temporal-issuer, contracts, infra (`infra/product-preview`) |
| neo-capiro/capiro-backend | `C:\dev\fable\capiro-backend` | **`backend-import`** (not `main`) | Preview Core API (`apps/api`), Prisma schema and migrations |
| neo-capiro/capiro-frontend | `C:\dev\fable\capiro-frontend` | `main` | Portfolio preview web app (Meri screens, Portfolio, Workspace, Settings, Mail) |

Other working directories under `C:\dev\fable\`:
- `ship-kit`, `ship-proxy-kit`, `ship-fe-kit`: release kit generators;
- `ship-<sha8>`, `ship-proxy-<sha8>`, `ship-core-<sha8>`, `ship-fe-<sha8>`: per-release kits;
- `wt-candidate`: the worktree `release-candidate.sh` fast-forwards;
- `adj-reports\`: plans, phase briefs and **`DECISION-LOG.md`** (O-numbers; last is O194);
- `release-logs\`.

### Source of truth and plans

- **Handover package:** meri-greenfield **draft PR #206**, branch `fable/handover-20261022`, folder `docs/handover/20261022/`. It is **not on `main`**; read it from that branch.
  - `WORKFLOW.md`: roles, how work moves, who decides what.
  - `PROCESS.md`: brief, change-list and acceptance-packet templates.
  - `SHIPPING-RUNBOOK.md`: exact release, migration and rollback procedures.
  - `CURRENT-STATE.md`: live versions and holds. It is a snapshot from 02:30 UTC; the queue in §0.6 is newer.
  - `source-of-truth/`:
    - the two closeout plans: Meri Wiring (tickets MR/MF/MT/MX/MG/MM, scenarios E01–E45); Portfolio/Workspace/Settings/Mail (PF/WS/ST/ML/X);
    - `STANDING-RULES.md`.
  - `plan/FINAL-PLAN-20261021.md`: phases, waves (§6), lanes, Neo's decisions (§8). Also at `C:\dev\fable\adj-reports\FINAL-PLAN-20261021.md`.
  - `phases/`: briefs, change lists, validations.
- **Cut-over run plan:** `C:\dev\fable\adj-reports\phases\NEWSTACK-CUTOVER-PLAN.md`.
- **Wave 2 draft briefs:** `C:\dev\fable\adj-reports\phases\wave2\WAVE2-AGENT{2-MP,3-A2,4-M2}-BRIEF.md` (see §0.7). S2's brief was already sent.

### Roles (Codex replaces Fable)

| Role | Who | Does | Never does |
|---|---|---|---|
| Owner | **Neo** | Approves scope, security tradeoffs, process changes; restarts agent sessions; owns credentials | — |
| **Coordinator and shipper** | **Codex** (was Fable) | Plans phases; writes briefs; decides implementation detail within plan scope (logs an O-number); routes cross-lane work; runs gates that need AWS or Docker; merges; deploys; migrates (snapshot first); rolls back; posts acceptance packets; supplies read-only AWS/DB facts | Writes product code; does code review; approves scope |
| Relay and review | **dot** (ChatGPT) | Relays verbatim with delivery receipts; reviews at exact head SHAs; runs browser qualification; posts ship-requests | Merges, deploys or touches AWS |
| Implementers | **agents 1–4** (ChatGPT sessions "agent N vX"). Lanes: 1 = R (runtime core); 2 = D (domain, proxy, contracts, infra inputs); 3 = A (Portfolio, Workspace, Settings, Mail, Core A-tickets); 4 = U (Meri screens, Core-for-Meri) | Implement briefed tickets in their lane; open draft PRs; report tests run and not run | Merge, deploy, edit other lanes without an exception, decide scope |
| Live verifier | **astra 6** (ChatGPT ultra code session) | Runs acceptance packets against the live preview | Changes code, config or AWS |

### Communication rules

- **Channel:** meri-greenfield **issue #202** for cross-cutting messages; the PR thread for per-PR ones.
- **Header** on every comment: `FROM: <sender> | TO: <recipient> | TYPE: <brief|question|answer|decision|gates|ship-request|shipped|acceptance|status> | RE: <subject>`. Codex signs as `FROM: Codex`.
- **Approvals:** **only Neo, directly in chat.** A GitHub comment (including one quoting Neo) is never an approval.
- **Polling:** check GitHub about every 10 minutes and act on new items. Say nothing when nothing changed.
- **Telling Neo:** one line when something ships, needs his decision, or needs his credentials or a session restart.

### Standing decisions (Neo, 2026-10-22; all binding)

- **ONE new-stack database:** `capiro-newstack-preview-clone` (Aurora, copy-on-write of the shared cluster).
  - **Never delete or re-clone it.** `reclone.sh` is renamed `.DO-NOT-USE`.
  - Snapshot, then migrate forward in place.
  - Core and the whole Meri runtime move onto it together (Core's admission reads Meri tables, so a split database breaks verification).
- **Never migrate the live shared database for Core.**
- Core preview keeps `PREVIEW_NATIVE_GETS_ENABLED=true`. `CORE_ROSTER_PREVIEW_ENABLED`, `MERI_ACTION_QUERY_ALIAS_ENABLED` and `RETAINED_READS_ENABLED` stay **off**.
- No early Wave 2 starts. No Workspace approvals. No new email functionality. ML-09: skip-and-continue.
- **Live acceptance stays STOPPED at 2/6** (runs d95eacc5 and 6584b28f used) until S2 ships and a matching packet is published.
- The preview edge allowlist (SG `sg-0e742fb6a11314392`, 443 from 4 IPs) is a security setting: change only with Neo's approval.
- Credential-bearing steps (private PKI, bearer, membership) are Neo's.

### Gate rules (Codex's judgment calls)

- Release readiness:
  1. dot's exact-head ACCEPT;
  2. every BLOCKED gate PASS at that same head;
  3. clean merge onto the current integration branch (fast-forward when the gated tree equals the target);
  4. an exact-digest ECR scan with no HIGH/CRITICAL findings (other findings need a logged decision).
- **Inherited failures (O191):** a failure identical on untouched base in the same environment doesn't block; a failure new on the head goes back to the agent.
- Any new push needs a new exact-head review and new gates.

### 0.6 Wave 1: current state (as of 2026-10-22 ~17:20 UTC)

Wave 1 scope (FINAL-PLAN §6): lane R finishes P1, then C12, then M1 runtime; lane D does PR197, AGENTS.md, P2 fixes and PR-B; lane U does the M1 screens; lane A does the A1 safety fixes; the shipper ships Phase 0 and S1.

**Live on preview now:**

| Component | Version |
|---|---|
| Meri runtime | meri-greenfield P2.1 `205eead4` (control:48, worker:47, runner:33, owner:46, proxy:46, issuer:47), **shared database** |
| Preview Core | `capiro-preview-first-chat-core:3` = `0f5d7e15`, **shared database** |
| Frontend | capiro-frontend `4e2c770f` (M1 screens), `capiro-portfolio-preview:21` |
| Observability | `ControlSessionRefusals` metric |

**Known live issue:** chat turns still fail. Control makes about 345 Core calls in 90 s per turn. S2 fixes it, and S2 needs Core `ca4de503` live, which comes with the cut-over.

**Merged, not deployed:**
- `main` = `9c7948ac`. #205, #207 and **#210** are in. #210 is tests only, gated 54/54 at its head.
- capiro-backend `backend-import` = **`ca4de503`**: consolidated Core, A1 #105 + #106, and the #109 closure pins. Its qualified image `capiro/preview-core@sha256:036b368c3de9cfd8cb191bb8849760efeb2530d131e3317f7e6c357ccda54f23` passed the probes with 0 findings. It deploys only in the cut-over.

**Open Wave 1 items (Codex inherits whatever is still open):**

| Item | State | Next |
|---|---|---|
| meri-greenfield **#209** (pin Meri inputs to the clone) | dot source review clean; base/head evidence verified (Fable's run: 6345897429) | Agent 2 rebases onto `9c7948ac`; dot re-reviews the new head. Merge **only in the cut-over window** |
| capiro-frontend **#121** (Figma menu alignment) | dot source plus browser PASS; Fable build gate PASS, image `capiro/portfolio-preview@sha256:18dad6581368b44aea7e6f6d39b34a67fb7a07f2c3af5117251dac42efbfd26e`, 0 findings | On dot's ship-request: fast-forward `main` to `87a84951`, then `ship-fe-87a84951` steps 06–08 |
| meri-greenfield **#204** (M1 runtime) | Agent 1 v3 handoff at `cd7fb1f4` (389/389 combined) | dot review; Docker pinned-image gates; merge; Meri release (it can be the cut-over release) |
| **New-stack cut-over** | Core image ✅; waiting on #209 and a Meri release from `main` with #209 | Run `NEWSTACK-CUTOVER-PLAN.md`: snapshot, migrate clone (A1 `20281022010000`), Temporal `SQL_HOST_NAME`, Meri 16–19, Core `:7` |
| S2 authority-lite (agent 1; pulled into Wave 1 by Neo) | Brief sent (#202 comment 6343478137). Baseline Core `ca4de503` (current-authority endpoint) | Starts after #204 merges. Ships after the cut-over. Then post the acceptance packet: **acceptance resumes from 2/6** |
| P1 **#200**, then C9 **#203** (stacked on P1) | Waiting | After S2 |
| A1 frontend **#117/#118** | CODE ACCEPT | Deploy once the A1 backend is live (after the cut-over) |
| Phase 0 leftovers | MX-01 session-refusal alarm/status table | Lane R or D, after S2 |

### 0.7 Starting Wave 2 (Codex's first job)

1. **Close Wave 1:** write `WAVE-1-HANDOFF.md` in the handover folder:
   - what shipped, with digests and revisions;
   - what is still open, from §0.6;
   - each agent's last head and its next brief.
2. **Neo starts fresh sessions** ("agent N v{next}", new dot reviewer and coordinator sessions; Neo's rule). Each gets only its next brief.
3. **Send the Wave 2 briefs.** Drafts are in `C:\dev\fable\adj-reports\phases\wave2\`. Before sending each one:
   - refresh its base SHA;
   - re-check its prerequisites against §0.6;
   - remove anything already shipped.

   Post each one on #202 as `TYPE: brief` to "dot (relay to agent N, verbatim)".

| Wave 2 lane | Work (FINAL-PLAN §6) | Brief | Prerequisite |
|---|---|---|---|
| Agent 1 · R | Finish M1 runtime (#204) if still open, then S2 authority-lite | `WAVE2-AGENT1-S2-BRIEF.md` (already sent) | M1 merged; the cut-over to ship S2 |
| Agent 2 · D | MP: Claude API path alongside Bedrock | `WAVE2-AGENT2-MP-BRIEF.md` | S1 shipped (P1 #200) |
| Agent 4 · U | M2 screens and Core: General or client chat, New conversation | `WAVE2-AGENT4-M2-BRIEF.md` | M1, plus Neo's decision on reads across clients |
| Agent 3 · A | A2: finish screens that already have a backend | `WAVE2-AGENT3-A2-BRIEF.md` | A1 live |
| **Codex ships** | M1, A1 (backend in the cut-over, then #117/#118), the cut-over, S2, P1 + C9 | — | — |

**Wave 3 decisions:** at the start of Wave 3, Codex raises two decisions with Neo again. The first is staging (A0, plan decision 1); live checks for M4 onward and the app's write features need it. The second is the os.capiro.ai production data path (decision 6).

---

## 1. Audit (read only)

Paste:

> Set up a practical Codex coordination-and-shipping workflow for Capiro's three repositories on this machine:
> - `C:\dev\fable\meri-greenfield` (integration branch `main`);
> - `C:\dev\fable\capiro-backend` (integration branch **`backend-import`**);
> - `C:\dev\fable\capiro-frontend` (integration branch `main`).
>
> Your role replaces "Fable": coordinator and shipper. Read §0 of `C:\Users\neoma\OneDrive\Documents\Claude\CODEX-ORCHESTRATION-SETUP.md` first; it is binding context.
>
> Begin with a read-only setup audit. Inspect:
> - Existing AGENTS.md, CLAUDE.md, skills and Codex configuration in each repo.
> - The handover package on meri-greenfield branch `fable/handover-20261022` (`docs/handover/20261022/`): WORKFLOW.md, PROCESS.md, SHIPPING-RUNBOOK.md, STANDING-RULES.md, FINAL-PLAN-20261021.md.
> - `C:\dev\fable\adj-reports\DECISION-LOG.md` (last 40 entries) and `phases\NEWSTACK-CUTOVER-PLAN.md`.
> - Current branches, worktrees (`git worktree list`), uncommitted changes, and the open PRs in all three repos (`gh pr list`). Read the last 30 comments on meri-greenfield issue #202.
> - Release kits in `C:\dev\fable\`: `ship-kit\tools\release-candidate.sh`, `ship-fe-kit\make-fe-ship-kit.mjs`, the latest `ship-core-*` and `ship-fe-*` kits. Read their step lists only; run nothing.
> - Package managers, Node/Python versions, build, typecheck, lint and test commands, and CI workflows per repo.
> - Cross-repo contracts: `packages/contracts` (meri-greenfield), Core's application-authority endpoints (`apps/api/src/auth/`), and the frontend's Meri proxies.
> - Tooling: `gh` auth status, AWS CLI with profile `capiro-dev` (`aws sts get-caller-identity` only), Docker in WSL `Ubuntu-24.04`, and the subagent, MCP and hook capabilities in this Codex install.
>
> Do not expose credentials, private PKI (`C:\dev\fable\meri-preview-private-pki`), stage-3 render dirs, or env-file contents. Do not edit code, switch branches in existing worktrees, stop processes, run suites or kits, or touch AWS beyond the identity call. Preserve all active task ownership (agents 1–4 own their open PRs).
>
> Return a short table: what exists, what's missing, and the smallest setup changes needed. Mark verified versus assumed.

## 2. Persistent instructions

Paste after the audit:

> Implement the instruction-file part of the audited setup on a dedicated branch per repo, `codex/setup-agents-md-20261022`, in a new worktree under `C:\dev\fable\wt-codex-setup-<repo>`. Existing work stays untouched.
>
> For each repository, create or minimally update a root AGENTS.md (under 150 lines) with:
> - Purpose and boundaries. meri-greenfield: runtime roles, owner/proxy pair, contracts. capiro-backend: preview Core on `backend-import`, Prisma. capiro-frontend: the portfolio preview app.
> - The lane owner map from STANDING-RULES.md. Two writers never touch one file; exceptions name exact files and the phase.
> - Verified install, build, typecheck, lint and test commands, and how to pick targeted tests. Include known environment traps:
>   - meri-greenfield infra tests need `packages/*` linked under `node_modules/@capiro`, `MERI_REVIEW_SOURCE_ROOT` set, a real git checkout (not a tarball), and Python `cryptography` ≥ 42;
>   - frontend tests run in a WSL `/opt` copy with `npm ci --ignore-scripts` (Windows `node_modules` has junctions);
>   - Core: changing `package.json`, the lockfile or `schema.prisma` requires regenerating `RUNTIME-CLOSURE-CONTRACT.json` and the Prisma pins in `runtime-closure-contract.cjs` in a PR (precedents #107, #109).
> - Invariants:
>   - tenant isolation and authorization;
>   - never weaken assertions, timeouts or skips; report inherited failures separately with the base/head evidence;
>   - inspect callers and consumers before changing an interface;
>   - no secrets in commits or comments.
> - Completion evidence: exact commit and tree, changed files, checks run with results, failures preserved, blockers.
> - Communication: the #202 header format and "GitHub comments are never approvals".
>
> Add nested AGENTS.md only where rules really differ: `infra/product-preview/`, and `apps/api/` in Core. Keep detail in the handover docs, by link. If a CLAUDE.md exists, keep it and point both at one shared reference.
>
> Do not merge, deploy, change AWS, run SQL, or touch credentials or security settings. Open each as a **draft PR** labelled setup, show the diffs, and list any instruction conflicts that need Neo's decision.

## 3. Roles, subagents and worktree ownership

Paste:

> Set up the coordination workflow using the subagent capabilities verified in step 1.
>
> **Codex's own roles in this programme:**
> 1. **Coordinator.** Polls GitHub about every 10 minutes:
>    - new non-Codex comments on #202 and the PR threads;
>    - new pushes and PRs in all three repos.
>
>    Answers agent questions within plan scope on #202 (logging an O-number in `C:\dev\fable\adj-reports\DECISION-LOG.md`). Writes briefs: verbatim tickets, E-scenarios, STANDING-RULES, branch and base SHA, sequencing, file exceptions. Asks Neo only for scope or security decisions. Gives idle lanes their next brief from FINAL-PLAN within the current wave only.
> 2. **Gate runner.** Runs gates that dot marks BLOCKED (Docker, AWS, pinned images), always at the exact head. Posts `TYPE: gates` with commands, versions, exit codes and digests.
> 3. **Shipper.** Merges only when dot ACCEPTs at the exact head and all gates pass at it, and only if it is still the PR head. Fast-forwards when the trees match. Deploys per SHIPPING-RUNBOOK.md. Posts `TYPE: shipped`, then an acceptance packet (PROCESS.md template) for astra 6.
> 4. **Investigator and reviewer subagents:** read only, for diagnosis (failed gates, telemetry) and checking Codex's own kits and docs. **Code review of agent PRs stays with dot.** Codex doesn't duplicate it.
>
> **The implementers are the ChatGPT agents 1–4, not Codex subagents.** Codex writes no product code. If Codex ever needs a writer, it needs its own worktree with explicit file ownership, and never a file an agent owns.
>
> Document that worktrees don't isolate the shared AWS account (967807252336, which **serves live users**), the clone database, Docker in WSL, ports or ECR tags (immutable). Tests use isolated resources (Docker PostgreSQL 16, throwaway PKI), never the live or clone databases.
>
> Add a handoff template to the handover docs (draft PR) with these fields:
> - goal and acceptance;
> - repo, worktree, branch, base and latest commit;
> - owned files and dependencies;
> - checks and evidence locations;
> - uncommitted work and running process or CodeBuild IDs;
> - next action and blocker.
>
> Durable progress stays in issue #202, the PR threads, DECISION-LOG.md and `CURRENT-STATE.md`. No new global ledger, and no reassigning of active agent tasks.

## 4. Validation and shipping, repeatable

Paste:

> Make validation and shipping repeatable with the existing tooling. Document the following (in the handover docs, draft PR), reusing existing scripts:
>
> **Per-repo checks:** the fast checks for a bounded change, module tests, and required pre-merge checks, plus which need Docker, PostgreSQL 16, AWS, or the WSL `/opt` copy.
>
> **Ship procedures (verify each script's step list; don't run mutating steps):**
> - **Meri runtime and proxy:**
>   1. `bash C:/dev/fable/ship-kit/tools/release-candidate.sh <sha on main> [--reuse-proxy-kit C:/dev/fable/ship-proxy-<sha8>]`; it builds and stages steps 01–15. Steps 11–12 use the private PKI: paths only, never print contents.
>   2. Check the Meri ledger read-only (`meri-ledger-read.sh`) before assuming migrations.
>   3. Then run 16→19 **back to back in one foreground session**: `bash 16-execute-model.sh && bash 17-execute-issuer.sh && bash 18-execute-app.sh && bash 19-verify.sh`. An interrupted 16→18 once left control and worker at 0 tasks.
>   4. Owner and proxy restart only as a pair. Wait 60 s after the last `gate=pair` line.
>   5. Secrets Manager label quota: 20 (16 used, so room for 4 releases).
> - **Core:**
>   1. Copy the latest `ship-core-<sha8>` kit. Set `SOURCE_SHA`, `SOURCE_BRANCH` and `ARCHIVE_SHA256` (from `git -c core.autocrlf=false archive --format=zip`) in `kit.env`, and replace both SHA and hash occurrences in `buildspec.template.yml`.
>   2. Run 00–03 for the gates: build with in-image probes, then scan.
>   3. Run 04 (register TD, `DB_HOST` → clone), 045 (migrate clone as the Aurora master, snapshot first), 05 roll and 06 verify only in the cut-over.
>   4. Rollback is `90-rollback` to `:3`.
> - **Frontend:**
>   1. `node C:/dev/fable/ship-fe-kit/make-fe-ship-kit.mjs <sha> --worktree <clean worktree> --label <x>`.
>   2. Run 00 and 02–05 for the gates (01 is already done by the generator).
>   3. Deploy with 06–08. Roll back with `R1-rollback-to-<rev>`.
> - **The new-stack cut-over:** `NEWSTACK-CUTOVER-PLAN.md` exactly. Snapshot first, prepare every rollback first, then run it in a quiet window with no turns in flight.
>
> Every AWS command uses `--profile capiro-dev` (there is no default profile) and `PYTHONUTF8=1`. Kits refuse with exit 2 on wrong state; exit 3 means read back before rerunning. Never invoke a mutating kit step to "test arguments".
>
> If hooks are supported, add at most a completion reminder (exact head, evidence). No suite-per-edit hooks. Required CI and the exact-head gates remain the merge gate. Report pre-existing failures without fixing unrelated defects.

## 5. MCP (optional) — unchanged from the generic setup

Reuse working `gh` and the AWS CLI; don't add duplicate GitHub or AWS connectors. Add the OpenAI docs MCP if useful. Defer LSP. **Never connect the live or clone databases through MCP.**

## 6. Per-task prompts

**Coordinator loop** (run every ~10 minutes, or on demand):

> Coordinator check (Neo: "run Wave 2 and keep all work moving across Codex and ChatGPT"; carry any open Wave 1 items from §0.6 to completion first):
> 1. Read new comments, pushes and PRs since the last check in neo-capiro/meri-greenfield, capiro-frontend and capiro-backend (skip "FROM: Codex").
> 2. On a dot ship-request with ACCEPT at an exact head:
>    1. verify that it is still the PR head;
>    2. run the BLOCKED gates at that head;
>    3. merge and ship per the runbook;
>    4. post `TYPE: shipped` and an acceptance packet for astra 6 (unless acceptance is STOPPED; it is at 2/6 until S2).
> 3. Answer agent questions within plan scope on #202, logging an O-number. Ask Neo only for scope or security.
> 4. Give an idle lane its next brief from FINAL-PLAN (Wave 2 only; no early Wave 3 starts).
> 5. Check background gate or release jobs and continue their next step.
>
> Say nothing when nothing changed. Tell Neo in one line when something shipped or needs him.

**Ship a specific PR:**

> Ship [REPO] #[PR] at [EXACT HEAD]. Confirm dot's ACCEPT and ship-request at this head, and that the head is unchanged. Run the BLOCKED gates [LIST] at this head per SHIPPING-RUNBOOK.md, and post results as `TYPE: gates`. If all pass and the merge is clean (fast-forward when trees match), merge to [INTEGRATION BRANCH]. Deploy with [KIT]; health gates must pass, with rollback prepared first. Post `TYPE: shipped` with digests and revisions, and update DECISION-LOG.md. Never change scope, flags, security settings or credentials.

**Brief an agent:**

> Write the brief for agent [N] lane [X], phase [P], from FINAL-PLAN §5. Include the verbatim tickets from the source-of-truth plans, the matching E-scenarios, STANDING-RULES, branch and base SHA, sequencing against open PRs, and any bounded file exceptions or freezes. Post it on #202 as `TYPE: brief` to "dot (relay to agent N, verbatim)".
