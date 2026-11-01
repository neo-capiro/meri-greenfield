## 1. Claude handles the harness

The quality bar is Claude's own. Answer quality comes from the whole harness, not only the model: its system prompt, built-in tools, subagents, skills, context management and compaction, and session handling.

- Run `@anthropic-ai/claude-agent-sdk` with its **full harness** and the Claude Code system-prompt preset, plus a short Capiro/Meri append. Don't replace the preset with our own prose.
- Do not rebuild what the SDK or AWS already does: model calls, retries, streaming, the tool loop, context management and compaction, session resume/fork, per-run turn and spend limits, AWS credentials.
- The real Claude SDK calls Bedrock directly using its narrowly scoped AgentCore runtime IAM role. Preserve the full preset, native tools, subagents and all 14 skills.
- Capiro data reaches Claude as **tools** (rule 4), not as a custom retrieval layer around the model.

Spec and plan: `phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`. It is **Wave 2 item 0**, and it comes before every other item that touches the runner, the proxy or authority.

## 2. Simple, standard architecture

```text
browser -> control (current access, conversation/run ownership, durable events)
        -> AgentCore Runtime V1 (isolated conversation session; actual Claude SDK) -> Bedrock
                                      -> tool gateway -> Core
control -> existing durable SDK SessionStore and artifact owners
control -> Temporal for required durable runs, schedules and background work
```

- **Core is the gatekeeper for Capiro data.** Tenant, member, client and wall rules remain server-side in Core. Check current access at admission and actual tool/data/artifact access; revocation must also prevent use of previously loaded privileged context. Do not duplicate policy in the harness.
- Reuse one isolated environment only for the same immutable tenant/actor/conversation and approved General/client scope. Serialize turns; stop idle compute and restore exact SDK transcripts and artifacts from their durable owners. A Runtime session ID is not authorization or durable storage.
- Keep the SDK's per-run turn/spend limits and one canonical tenant cap/usage owner. Preserve required durable runs, schedules, consent, outcomes and uncertain-write fences; neither SDK Task tools nor a warm process replaces Temporal durability.
- **No custom warm pool, per-turn ECS task requirement, model proxy, duplicated per-hop authority, credential-minting service or spend-reservation ledger.** Use standard Runtime V1; no V2 snapshot machinery or second SDK implementation.
- Before adding a mechanism, identify the standard feature or existing owner it uses. Before deleting a wrapper, prove the retained lower-layer behavior with meaningful positive/negative tests. Do not remove canonical authorization, idempotency or durable outcomes as “extra security.”

## 3. Leave no dead code behind

A change is not done until what it replaced is gone.

1. **Delete in the same PR** everything the change makes unused: code, tests, fixtures, docs, config keys, env vars, feature flags, IAM statements, ALB rules, secrets, task definitions, CloudFormation resources, kit steps, alarms and metric filters. Applied database migrations are history: never edit them. Drop tables only through a separately reviewed forward migration after a snapshot; this hosting migration does not itself authorize schema/data removal.
2. **Temporary diagnostics come out before merge** of the fix they were added for. A log line stays only as named product telemetry that someone reads.
3. **No code behind a flag nothing turns on.** The "source-complete, activation-held" status is retired for code we don't intend to ship. Dark features need an owner and a date, or they are deleted.
4. **No** commented-out code, `legacy` or `_old` copies, compatibility shims for removed things, or "superseded" stubs.
5. **Show proof in the PR:** list the identifiers, files and resources deleted, with a search proving no executable/active caller remains; label immutable historical references, and explain any drop in test count.
6. **Old plan tickets for removed mechanisms are closed as superseded**, not implemented and left dormant. See `source-of-truth/SUPERSEDED-BY-ITEM-0.md`.
7. **Reuse before write.** Use SDK, AWS and library features first. Custom code needs one line saying what the standard option couldn't do.

## 4. Capiro data must keep working

- Capiro data is served to Claude as tools. Core remains the source: today's read families call Core at `/api/clio/tools/<operation>`, and the new tools call the same endpoints.
- Tools are hosted by **control** (the existing tool gateway) so the runner never holds the Core service secret (`x-internal-service-secret`). The runner gets only a short-lived per-run token for control, scoped to tenant, user, client, conversation and run.
- Reuse the existing read handlers under `apps/gateway/sources/*` and their typed schemas. Delete the authority, relay and measurement wrappers around them.
- Parity: every read family that works today must be reachable as a tool with the same results and the same permission outcomes. A parity checklist is part of the item 0 spec.
- Negative tests are mandatory: another tenant's data, another client's data, and walled data must not be retrievable, through chat or through tools. A General chat reads across the clients the user can already see, with each client's wall enforced per result (FINAL-PLAN decision 2).
- The original read-only first cut is historical. Neo subsequently authorized preview client-record writes and autonomous Wave 2 completion. Activate accepted writes through their existing authenticated domain/intent owners and receipts, with the actual route/configuration and effect semantics verified. This does not authorize the assistant to send external mail without the user's specific send instruction.

# Fable handoff — Wave 4 fixes and complete Research Portfolio

**Current authority — user-requested stopping point:** the existing Wave 5 orchestrator `01a17d3b-4cf1-7f21-a8ac-f0aa7cd0380d` now coordinates and finishes the remaining Wave 4 work. Existing Release chat `01a17ae6` remains the sole shared target operator; Hermes Agent app/CLI remains the independent review and acceptance owner. The old Wave 4 root stops product and release work at reviewed source integration. Follow the [Wave 4 to Wave 5 takeover](WAVE4-TO-WAVE5-TAKEOVER.md) for the exact remaining sequence and owner references. Earlier root/Fable assignments below are retained history, not a second active orchestration lane.

27 October 2026. From the Wave 4 orchestrator to Fable.

**Current return update:** all 33 returned findings are reconciled in the [finding dispositions](FABLE-FINDING-DISPOSITIONS.md); do not repeat the static scan. Core PR195 is merged at `8d77e225fe3c16c891190654efeea8050978aaf8`, equal to reviewed `b49f010174de9a2dfaa598f327caf62761138283` tree `360fe212a3ef699ecb2e5cf7359671ede3d4cf32`. Frontend PR252 is merged at `d96087ae977465ccaec8e25f728e2a80acb1ebd4`, equal to reviewed `77987943e56c876e4810a320a8209e61bfa340ef` tree `330e0f1a672a8d0322bad9613624ae9d86495b04` (functional source `cbf9d5bc78b8817ca5f91adee870cbe5dceec53c`). Meri PR296 is merged at `337e54b3ad92bd80eb65eefc72b4245c4f9ff50d`; its qualified ARM64 image is `sha256:7eabf413c51ce089d860b1426836cb1904e665e2483c10c5bf2d12a4e672734b`, not deployed. The DI-07/S15 stored-locator, before/after and correction-impact projections and S14 governed Coverage readback are implemented, independently source-reviewed and merged in these pins. Source, frontend architecture, author gates and the finite IAM/configuration/preserved-edge review PASS. Final Core/frontend image completion and qualification, actual image/material/flag/edge composition, deployment/readback, Hermes live acceptance and the recorded real-corpus gaps remain pending. No new database/schema/migration/package change is introduced by the final projection amendment; do not replay completed migrations or repack immutable Wave 4 artifacts. **Wave 4 remains OPEN.**

Neo's direct 27 October choice makes the **recovered 70-row register, full section 16 and MO-05 authoritative for final sign-off**. Missing original sections 1–15 and F01–F42/V4-01–V4-15 remain recorded provenance, not a blocker or permission to invent requirements. Q07 remains skipped. See the [current uncovered requirements](RESEARCH-PORTFOLIO-REQUIREMENTS.md#current-uncovered-behavior-and-evidence) before claiming full module completion.

**Reviewed Core addenda:** qualified context-occurrence admission `39e0837eac3f2349b84de96c456664ea43bf27a9` and Unicode draft-reader alignment `f7b3c44011196c4228a4a1dc45ae5083c48aadc9` have Hermes source PASS, including 58 independently run affected checks. Earlier Core findings have source PASS with 110 independently run checks. Final `96a4f2d2` also integrates the reviewed current-client watch guards, route-scoped JSON ingress and final native-control edge routes. These are source proofs; no new cohort live acceptance is claimed. No database schema or migration change was introduced.

The retained original assignment was to scan every in-scope Wave 4 item and complete all existing Research Portfolio requirements, including MO-05. The returned findings, native controls and final read projections now have reviewed merged source. The historical deployments below remain complete; this closeout cohort is not deployed. Wave 5 now coordinates the remaining delivery through existing Release and Hermes, using the takeover handoff rather than starting another broad scan or duplicate owner.

Fable’s earlier investigation/author assignment has returned. Any demonstrated remaining bug is assigned by the Wave 5 orchestrator to an existing domain owner with focused checks and Hermes review. Release alone performs shared target migrations, configuration, deployment and recovery; Hermes performs deployed acceptance. Do not create a second release or approval system.

## Release stopping point

**Historical pre-return stopping point:** the then-pending migrations and deployments completed at **2026-10-27 11:51:37.565 UTC**. The rows below preserve that receipt; they do not claim the new closeout candidates are deployed. Root requires preservation of the later frontend46 deployment. [Wave4 handoff section2](WAVE-4-HANDOFF.md#2-deployed-components-database-and-recovery) retains exact historical sources/images and a separate pending final-receipt slot.

| Handover fact | Actual result |
|---|---|
| Running components | Core21, Workspace8, Strategy4, Intel4, Meri control79 / Temporal75 / schedule12, frontend45; all operational health checks passed. |
| Meri activation | Named preview READY17 / DEFAULT17; contracts0.1.20, UI-stream0.1.7, catalog0.2.22,96reads; exact material consumption and initializer exit0 for all three roles. |
| Database | Final policies/projections pair completed once, exit0;700 ledger entries,597active,103rolledback,0unfinished; all698 prior rows and9 historical exceptions preserved. No migration replay. |
| SQL readers | After02 PASS11:24:27.586Z: public8/private14,15views/private missing-context isolation. Ledger proof expired11:54:27.586Z; reader admission expires15:24:27.586Z. Renew read-only for future gated actions when required. |
| Routing | Edge UPDATE_COMPLETE;74explicit rules,85resources,14preserved outputs. Final frontend dependency verification passed11:51:15Z. |
| Recovery and temporary resources | Encrypted pre-final snapshot, predecessor tasks/images/material and immutable receipts retained. No stopping-point cleanup deletion required; no rollback to an incompatible writer. Four locked synthetic S3 evidence versions retain their existing disposition. |
| Browser and target ownership | Release commands exited and release-owner browser/target idle11:51:37Z; browser left open. Root coordinates future windows; no full product acceptance/expiry action ran. |

The target is `https://portfolio-preview.app.capiro.ai` with its existing preview clone; the old `os.capiro.ai` is outside this assignment. Fable may proceed with source investigation and author checks. Coordinate any shared target/browser reproduction through root. Formal acceptance follows deployment of the returned fixes and belongs to Hermes.

## Read first and preserve the baseline

Start with the sibling [Wave 4 handoff](WAVE-4-HANDOFF.md) for current release state, [Wave 4 item inventory](WAVE4-ITEM-INVENTORY.md) for the wave scan, and [Research Portfolio requirements](RESEARCH-PORTFOLIO-REQUIREMENTS.md) for the expanded module assignment and exact sources. Read the repository `AGENTS.md`, the canonical standing requirements, and `docs/handover/20261026/WAVE-4-PLAN.md`. Scan previously accepted items too, while preserving explicit exclusions other than the superseded Research Portfolio deferral. Record a short coverage note against the existing rows; do not build a new tracking framework or infer acceptance from “no bug found.”

The merged product baseline is:

| Repository and PR base | Merged source to preserve |
| --- | --- |
| `neo-capiro/capiro-backend`, `backend-import` | PR192 `cae35473ceae6e53e0a302a174d2a8791d4465bc`; PR193 `c5b99db7238a5e29600e5c976806b0d1d1802f6d` adds only the Intel typing correction |
| `neo-capiro/meri-greenfield`, `main` | PR292 `651bdf370d13a715736ea7bce32cdd8f3a4b88d0` |
| `neo-capiro/capiro-frontend`, `main` | PR249 `05c355f770e2b99c3588fc6873f1fe449e1aed0a` is historical; final successor PR250 `050df52492a912be004877a857d4b2db13c60713` |

These rows identify deployed product source; documentation publication may advance the branch without changing the deployed product image. Fetch the actual remote before branching; do not assume a cached `origin/main` or donor checkout is current. Some local origins point at donor folders, so confirm the publication remote. Use an isolated branch/worktree and preserve other agents' changes.

Keep historical contracts `0.1.20` (archive SHA256 `b4b101eb14a309312e8d119f1ffe6c8b0c304306e38253795c6d92839d6450d2`) and UI-stream `0.1.7` (`71ae991aa7faec21374ffb0f01cd72bceddb8021151e95d377cf06cf4267ead1`) bound to their existing source/vendor records. The current candidate intake is contracts **0.1.21**, UI-stream **0.1.8** and catalog **0.2.23**, packed from frozen Meri `2f425244c`; exact archive hashes are in root's `work/fable-closeout-20261027/meri-2f425244c/package-freeze.json`, with source/provenance explained in [Meri's author handoff](MERI-FABLE-CLOSEOUT.md). Runtime correction `9959d4cf8` leaves both package trees identical. Do not regenerate solely for a documentation or merge SHA, overwrite historical records, or infer serving versions before the release receipt.

## Requirements to use during the bug scan

Inspect every included plan item against its actual implementation, using the existing requirements and failure reports below. Reproduce suspected bugs through focused developer checks and repair concrete causes. **Missing live acceptance evidence is not itself a reason to change working code.** Preserve the existing `PASS / FAIL / NOT RUN` rows for root/Hermes, separating source/unit, synthetic/native, operational and live evidence. Reuse accepted unchanged checks and rerun only affected behavior or a concrete regression risk.

### Current return dispositions

The [finding disposition companion](FABLE-FINDING-DISPOSITIONS.md) maps every original ID to its exact implementation and retained review evidence. The arithmetic is **7 sharing + 4 SQL + 4 actions + 4 mail + 3 runtime + 11 RP = 33**: D1–D11 are already included, not an extra eleven. Fable's native UI prose was unnumbered and combined several controls; its grouped list must not become a second invented defect count. SH3 and SQ1 remain adjudicated non-defects. SH4 real concurrency/scale and RT2 deliberate evidence retention without pruning retain their explicit limits.

The existing native rules, imports/worksheet, operations, output/CSV/Client Files, bookmarks, review notes/assignment, watch conversion, fit, tour and real saved-draft Open/edit paths are implemented. Contributions and exact decision evidence, typed member discovery/resolution/bulk decisions, bulk reviews, retained same-scope recovery, saved comparisons, four Research segments, Changes composition, customer Coverage and the current evidence inspector are also implemented and source-reviewed at the stated freezes. A missing historical component name was not treated as a defect by itself.

Frontend author gates are PASS: full web TypeScript, lint/format of the last changed source, fixed-operation registry 5/5, and focused local checks already recorded by each author. Hermes's final frontend source review accepted all ten final architecture fingerprints; root integrated them at `a46307e7` and recorded zero blocking findings. This is not independent browser or deployed acceptance. Retain the exact limits and source-to-live separation in [current uncovered behavior](RESEARCH-PORTFOLIO-REQUIREMENTS.md#current-uncovered-behavior-and-evidence).

The final bounded read-projection amendment is implemented, independently reviewed and merged at the Core/frontend pins above. Its scope is existing-data DI-07/S15 locators, before/after and correction impact, plus S14 governed Coverage readback. Missing stored bytes, locators or denominators remain explicit unavailable states. No new corpus ingestion, graph store, provider command, requalification service or database/schema/migration/package change was introduced. Wave 5 coordinates delivery and actual evidence; source completion does not establish corpus or live acceptance.

### Finish the complete Research Portfolio module

The companion [requirements inventory](RESEARCH-PORTFOLIO-REQUIREMENTS.md) is mandatory scope: the recovered RP/DI/MX/OP, S01–S18 and AT-01–AT-24 rows, section 14.2 probes, MO-05's 17 exact operations, and FR-15.22/full section 16. Neo selected these recovered sources for final sign-off. Missing original sections 1–15 and F01–F42/V4-01–V4-15 are retained provenance, not a blocker; do not invent them. Do not call the whole module complete while actual applicable behavior or evidence remains unresolved.

Reconcile current code before allocating fixes. Reuse portfolio lifecycle/grants/client walls, typed members, rules and review services, import recovery, qualified projections, snapshots/output jobs, canonical Client Files, research routes/evidence, changes/watches, and the current Meri/control owners. Finish specified gaps in small slices: domain behavior and permissions; UI/navigation/accessibility; analytics/snapshots/outputs; context and all 17 Meri operations; watches/feedback/tour. Coordinate schema, registry, financial projection and common route files through one owner. This is implementation completion, not just a scan of sharing.

Keep source recovery, implementation, author checks, later independent acceptance and operational prerequisites distinct. Old September `PARTIAL`, `PASS`, `BLOCKED`, flag and deployment statements are historical evidence; they neither prove a current defect nor override the current serving cohort. Do not recreate earlier repairs or repeat unchanged accepted evidence. Fable may prepare relevant fixtures and focused developer checks, but root/Hermes own deployed acceptance and source/corpus qualification. An unavailable provider, dataset or genuine product definition returns as a precise dependency with the affected requirement, while independent implementation continues.

The latest scope does not reopen Q07 semantic/index integration. Complete documented exact/capability behavior and existing safe limitations; identify the precise DI-09/AT-11 dependency if full semantic qualification requires the skipped work. Likewise, section 16's explicit print/PDF/client-portal/guest-comment exclusions remain. General module output requirements stay in scope; use the formats and artifact owners actually specified, without importing the excluded broad Office program.

### Sharing and required source permissions

Use all 14 section 16H rows, administration controls and Meri's sharing approval flow as bug-scan requirements. Their later Hermes execution order is already in `FINAL-SHARING-CONTINUATION.txt`; the original requirement is `SECTION-16-SOURCE.txt`. They cover publish/unlock, five wrong PINs and lockout, PIN rotation invalidating viewers, unavailable pages, frozen content, two-client isolation, branding on/off, unlink/archive survival, sharing off, keyboard add/move/resize/remove, source refusal, lost-response recovery, recipient network/cookies, direct owner/editor publication, admin list/revoke/switch and Meri publish/list/revoke. Fable investigates and fixes defects in these paths; Wave 5 schedules Hermes live acceptance after Release deploys.

The prior full run stopped at preview 409 and established **no complete 16H row PASS**. Preserve its partial subchecks. The missing tenant logo has since been restored from its authentic existing version, and frontend PR250 preserves safe named-widget refusal messages. Use those concrete repairs and failure reports when inspecting the sharing path; do not reimplement them. Root/Hermes still need to check actual branded preview and publication after the fixes are deployed; branding-off success cannot replace branding-on acceptance.

**FR-16.36 and 16H row 11 are required, not deferred.** Root/Hermes resolved the boundary to existing qualified public source owners. The source-reviewed Core union checks canonical families and exact provenance, including the real context-occurrence eligibility correction, and refuses the named widget before publication. Do not invent a private-source ACL or arbitrary domain policy. Source review is PASS; deployment and live row-11 acceptance remain pending.

For expiry, the prepared `sharing-expiry-action-01` action has Hermes source PASS (`c20d0f14…`) but has **not run**. Hermes must first publish a dedicated synthetic canonical link through the real UI. Root/release may then age only that exact row using the accepted action after all active browser lanes return. This proves a controlled expired state, not a naturally elapsed week. No real-clock changes, new token, payload rewrite or mutation by Fable. Do not re-create the action or bypass its unknown-outcome rules.

### SQL and saved reads

Preserve F09's documented authored-query grain/aggregation semantics, exact numeric strings/nulls and honest truncation; General and selected-client private queries with current-wall enforcement; Workspace document/version/comment traversal and client-required Strategy saved reads; and ordinary-chat/PE default versus explicit pinned-version behavior. Hermes adjudicated SQ1's general parent-total fan-out concern as not a defect; do not add an automatic SQL rewrite or blanket join rejection. The actual deployed tool/authority crossings remain a later Hermes assignment, not a new broad Fable test campaign.

Retain the finite scope: eight public relations, 14 private projections, the existing 17 Workspace/Core saved-read kinds and seven Strategy kinds. General means clients currently visible to this user. PlannerTask and EngagementTask are different owners. Do not retire the older uncovered QuerySpec datasets, turn bounded results into a completeness claim, add private authority to saved jobs, or implement semantic search under this task.

### Tasks and native actions

Scan F10–F11 for actual implementation gaps, using canonical synthetic records and focused current-read reproductions where needed. Inspect task create/update approval, the real Engagement task destination, reload, start-another behavior, status/manual/external refresh and refusal after lost access. `task.update` is a nonempty unconditional patch of title/status/dueDate; preserve unpatched fields. Do not invent CAS, assignee editing or null clearing. MF13 has an actor/tenant/conversation intents list; it is not a shared inbox or count owner.

Scan the existing client/profile, persisted relevance, saved business brief, legislative document, saved note, LegiWatch suggestion/relevance and four distinct watch owners; fix concrete bugs or incomplete original requirements. Use their actual supported verbs and receipts. A generated preview is not a saved version; `selection_only`, `unknown` and completed outcomes stay distinct. Saved-note completion is direct PASS where its canonical policy permits it, without a new approval/retry loop. Return the remaining live proof needs to root/Hermes with the fix.

For mail, check current Contact/Timeline/Meri provenance, reply/reply-all/forward review, incoming-file import/quarantine/parent access and Connections account/scope health. Reading and preparing a review does not authorize sending. Do not send external mail, activate delivery/schedules/providers, grant OAuth consent, rotate keys or manipulate credentials. Real-provider effects outside the existing authorization remain explicitly unrun, not inferred from synthetic fixtures.

### Runtime and closeout

Fable should inspect runtime-related Wave 4 changes for concrete bugs and preserve existing telemetry owners. Root/Hermes will collect F12 telemetry during an already required post-deployment task/approval run, binding its actual run/session and Core calls/timing, including the agreed simple-turn limits of 30 Core calls and 3000 ms aggregate Core time. Do not add a nine-turn benchmark, new telemetry framework, or extra model/provider turns merely to fill a report. Existing N1–N6 and real-SDK spike results remain valid at their stated scope; synthetic callbacks do not establish live provider/AgentCore effects.

The exact single-paragraph DOCX is **complete**: live retrieval and native Word rendering with actual page inspection passed (`DOCX-RENDER-RESULT.txt`, SHA256 `6abb82d6ecca0bbabb5416a96e4ae5d198b9bf3fa5b34234ef559f5ea4ed3dd6`). Do not download, regenerate, render or review it again. This result does not authorize a rich-Office expansion.

Close actual implementation gaps when their criteria are met and return the remaining deployment/acceptance needs explicitly. Keep formal acceptance rows open for root/Hermes. Record the disposition of any synthetic resources created during your reproductions. Four small locked S3 evidence versions are deliberately retained; do not bypass retention or treat them as a blanket cleanup task. Wave 5 records final Wave 4 closure only after the remaining requirements are accepted or explicitly disposed of by the user.

## How to investigate and fix without expanding the work

1. Reproduce the current user path first: actual mounted route, signed-in scope, serving backend, capability/material settings, producer/receiver versions and representative data. Trace the failing boundary before changing code or requesting a new build.
2. Fix the smallest coherent cause in its existing owner. Inspect adjacent wiring in that flow so the fix is usable. Keep tenant/client/wall checks in Core, the native SDK harness and standard Runtime V1, durable SessionStore/artifact owners and required Temporal behavior. A runtime session ID is not authorization.
3. Keep each PR focused on one bug or inseparable correction. Coordinate shared contracts, catalogs, generated packages, architecture registry entries and common routes with root before overlapping another agent's edits. Update only affected entries; no repository-wide rebaseline or formatting sweep.
4. Run meaningful affected checks and required repository gates. Retain a failing witness where useful, then verify the fix. Keep unrelated inherited failures distinct. Once the necessary checks pass, stop expanding the test run. Root/release performs the required release-image build, smoke and scan once through the existing process.
5. Return the frozen correction and evidence to root. Root arranges independent review as needed, merges and deploys, then runs acceptance with Hermes. Authors do not accept their own fix. For visual bug fixes use the actual design reference and appropriate Playwright developer evidence; later formal visual acceptance requires Hermes to inspect the actual images.
6. Reconcile uncertain effects by the existing readback owner. An UNKNOWN result never authorizes reposting a prompt, decision, write or migration. Preserve original failures and immutable receipts.
7. Remove code and temporary diagnostics made obsolete by the fix in that PR, with the repository's proportionate proof. Applied migrations are immutable history. Do not add compatibility shims, dormant alternate paths, speculative abstractions, new approval/packet/fingerprint systems, a replacement ACL system or a second ownership layer.

Preserve WSL `Codex-Gates`, persistent services/volumes, current checkouts, evidence, dependency caches, shared browser and authentication configuration. Cleanup must identify the exact task-owned resource; no resets, broad prune, recursive checkout cleanup or credential export.

Use canonical synthetic fixtures for focused author reproductions; keep ordinary setup within the current product owner and coordinated target/browser allocation. Use real owner-issued identifiers, not fabricated IDs or scopes, and do not alter customer data or global membership. The prepared two-lane browser/fixture ownership rules are for root's later Hermes campaign. Shared target changes wait for every active acceptance lane to return.

## What stays outside this handoff

Q07 semantic/index integration is **skipped**. **All existing Research Portfolio/MO-05 requirements are now in scope**; earlier deferral language is historical and superseded. Onboarding, rich Office/full M5 and full M6/M7 remain outside this wave. Outreach backend189/frontend245/Meri288 is a separate PR-only, unshipped lane; do not merge or deploy it as a Wave 4 cleanup. A broad scan may identify an unrelated problem, but record it for root instead of silently implementing it here.

Do not perform target migrations, deployments, resource deletion, runtime/material changes or rollback yourself. Do not replay the initial SQL/bootstrap or completed sharing migrations to repair stale admission. Do not deploy a raw synthesized template that drops historical resources, use an incompatible old writer after a forward migration, or reuse an expired readiness receipt. Return the concrete operational need to root/release.

## PR return contract

Send the Wave 4 orchestrator one concise handoff per PR with:

- Repository, PR URL, exact base and head SHA/tree, dependencies and current mergeability. Use `backend-import` for backend and `main` for Meri/frontend unless root's current integration instructions say otherwise.
- The user-visible bug, current reproduction, original requirement and final behavior; changed files and why each belongs.
- Actual affected test/build/lint/type results, commands and exits; retained failure evidence and relevant limitations. Report missing GitHub checks honestly rather than calling zero checks green.
- Any existing independent review's exact head/report and resolved or remaining findings; clearly say if root still needs to arrange that review. Explain any difference between a reviewed tree and the proposed merge tree. Do not substitute the author's own checks for independent review.
- Migration, schema, contract/catalog/package, environment, route, material and deployment impact. Explicitly say when no such change exists. Identify cleanup and compatible recovery implications.
- Remaining live acceptance and the exact owner/input needed after shipping. Include private evidence paths by name, never credentials, PINs, cookies, capability URLs or customer records.

Source authors stop short of target deployment. Wave 5 coordinates any necessary independent review and integration; Release deploys and Hermes accepts. Do not call an issue closed merely because its PR exists or its local tests pass; satisfy its actual completion criteria and keep any pending rollout/acceptance visible. Fable's handoff is ready when every in-scope item has been scanned, concrete fixes and remaining implementation decisions are accounted for, and the resulting PRs have the author evidence root needs to review and deploy.

Return any newly allocated remaining correction to the **existing Wave 5 orchestrator**, which now coordinates Wave 4 closure. If the environment cannot message it, give the user exact PR URLs and return information. Coordinate shared-file collisions through Wave 5 and target operations through Release; preserve the independent Wave 5 allocations.

## Existing evidence and working locations

`W` below is `C:/Users/Administrator/Documents/Codex/2026-10-26/wave4-orchestrator-20261026`; `R` is `C:/Users/Administrator/Documents/Codex/2026-10-27/research-sharing-finish-20261027`. Keep private contents local.

| Purpose | Existing entry point |
| --- | --- |
| Current requirement and status rows | `W/work/wave4-handoff-draft/FINALIZATION-FIELDS.md`; original repository `docs/handover/20261026/WAVE-4-PLAN.md`; root's final dated handoff supersedes draft operational state |
| Full Research Portfolio allocation and source recovery | [Research Portfolio requirements](RESEARCH-PORTFOLIO-REQUIREMENTS.md); current backend `docs/research-portfolios/PROJECT-CLOSEOUT-PLAN.md` and `phase11/` registers; MO-05 in the Meri source-of-truth |
| Sharing requirements | `R/outputs/SECTION-16-SOURCE.txt`; `W/work/acceptance-readiness-20261027/FINAL-SHARING-CONTINUATION.txt` |
| SQL/native/runtime continuation | `W/work/acceptance-readiness-20261027/FINAL-SQL-NATIVE-RUNTIME-PROMPT.txt` and `F09-F12-REUSE-FIXTURE-ADDENDUM.txt` |
| Parallel browser ownership | `W/work/acceptance-readiness-20261027/TWO-LANE-BROWSER-OWNERSHIP-ADDENDUM.txt` |
| Sharing history and exact DOCX PASS | `W/work/hermes-review/sharing-live-acceptance/`; preserve the original reports and private fixture pointers |
| Source-access finding and author trace | `W/work/hermes-review/sharing-operators/SOURCE-PERMISSION-REVIEW.txt`; `W/work/sharing-source-admission/AUTHOR-TRACE.txt` |
| Controlled expiry preparation and review | `R/work/sharing-expiry-action-01/HANDOFF.txt`; `W/work/hermes-review/sharing-expiry-review/REVIEW.txt` |
| Runtime scope and retained evidence | `W/work/runtime-wave4-qualification/ROOT-REMAINING-QUALIFICATION.txt` and `review-native-results/VERDICT.txt` |
| Operational owner and current receipts | `R/outputs/` and `W/work/hermes-review/RELEASE-OWNER-COORDINATION.txt`; use the latest explicit handoff, not an old header or image receipt |

If a local receipt is unavailable in your environment, request that specific sanitized evidence from root. Do not reconstruct it by replaying a migration, uncertain action, credential setup or already accepted test campaign.
