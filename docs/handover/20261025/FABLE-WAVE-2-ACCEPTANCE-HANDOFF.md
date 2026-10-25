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

# Fable acceptance handoff: retained Wave 1 and current Wave 2

FROM: Root | TO: Fable (independent acceptance and bounded simple fixes) | TYPE: brief | RE: Waves 1 + 2, lane Acceptance / allocated feature owner

Status: **IN PROGRESS — acceptance assignment, not a Wave 2 completion notice.** Prepared 25 October 2026. Read the release cutoff below before doing any live work.

## Start here

After the binding standing requirements above, start with operational §§1–9. Consult only the relevant ticket/scenario appendix for each tested component. The appendices preserve exact scope; they do not require a blanket rerun of historical suites, retired mechanisms or every unrelated feature.

Fable independently accepts the retained Wave 1 behavior and the accepted Wave 2 scope on the actual preview, compares tested components with canonical Figma mockups3.4 and their applicable shared UI library, and fixes simple bugs found during that work. A simple fix has a localized understood cause, uses the existing owner and introduces no new or changed API contract, schema, authorization model, architecture or dependency; repairing a localized API implementation to restore its existing contract can qualify. Line count does not decide simplicity. Complicated bugs receive a minimal reproduction, impact and existing owner. Hermes separately owns the memory/document fix files; Fable reports and coordinates those defects without racing their writers. Codex owners independently review fixes, including any authored by Fable. Root only orchestrates ownership, gates, integration, merges and release decisions. Existing Release alone operates AWS, migrations, deployment and rollback. This direct assignment supersedes older documents saying Fable has no active role. Fable is not a coordinator, self-reviewer or shipper.

Use this handoff alone to start planning. The ticket appendix contains the exact retained contract text and its applicable overrides; canonical GitHub sources below settle provenance. A copied document does not grant access to this Windows machine or its signed-in browser. Use a normal authorized preview account and the nominated synthetic fixtures supplied through the existing private handoff. If those are unavailable, record the affected row as NOT RUN with the exact BLOCKED prerequisite and owner. Continue independent available rows.

Ready-to-paste launch prompt:

> You are Fable, the independent acceptance and simple-fix owner for retained Wave 1 and current Wave 2. Read the attached FABLE-WAVE-2-ACCEPTANCE-HANDOFF.md, including standing requirements and current supersession rules. Prepare a finite scenario/model-turn/fixture-action inventory, reuse valid evidence, then execute available authorized synthetic preview rows after Release confirms the stable tuple and Root opens the bounded no-deploy window. Select routine counts yourself within approved scope. Compare every tested component with canonical Figma mockups3.4 and its applicable shared components/variants/tokens/styles; record source/node/version, before/after evidence and intentional approved deviations. Fix localized understood bugs using the existing owner with no new or changed API contract, schema, authorization model, architecture or dependency; an implementation repair restoring the existing contract can qualify. Announce/check active file ownership, then use an isolated branch, focused checks and a draft PR for separate Codex review; routine unclaimed files need no extra approval. Report complicated bugs with minimal reproduction/impact/owner. Do not drift from or complicate the agreed SDK/AgentCoreV1/Core architecture. Hermes owns memory/document fix files; do not race those writers. Use normal authorized sign-in/domain paths and reconcile uncertain effects before any retry. Root orchestrates/gates/merges; Release alone deploys. Report PASS/FAIL/NOT RUN, separate BLOCKED reason, UTC/build pins/measured numbers/evidence; use PROCESS6.3 and6.2 below. No mail send, customer purge, token extraction, alternate credential path, cloud deployment or #202 post. Missing Figma access is NOT RUN/BLOCKED, never assumed parity.

## 1. Standalone PROCESS6.1 assignment

### Current architecture authority

Current direct Neo decisions, the full standing requirements above, Item0 native-harness specification, approved V1 migration and supersession register govern in that order over historical Wave1 mechanisms. Their pinned sources are in §9. Wave1 contributes retained product behavior, never its obsolete deployment topology, relay approval process or duplicated authority machinery.

The real Claude Agent SDK full harness runs in standard AgentCore Runtime V1 and calls Bedrock directly. Control owns admission, immutable tenant/actor/conversation and General/client scope, serialized turns, durable events/outcomes and the short-lived scoped runner→Control tool token. Core owns current tenant/member/client/wall permission at admission and actual tool/data/artifact access; revocation also prevents reuse of previously loaded privileged context. Native SDK SessionStore and artifact owners supply durable restore. Temporal owns required durable runs/routines/schedules; a warm process or SDK Task tool is not that owner. Preserve personal/firm memory restrictions in General and canonical client-memory scope. The runner never holds Core service/database credentials.

Removed owner/proxy, reservation/liability ledger, duplicate per-hop verification, old exact-run-renewal/proof chains, credential issuer, per-turn Fargate, custom warm pool and dormant-original checkpoint machinery are **not test requirements**. Real Clerk authentication, Core authorization and scoped gateway credentials remain. Exact retained excerpts below omit incompatible old instructions; omissions are labelled with the governing source. If a surviving historical phrase conflicts with this architecture, report the specific conflict to Root; do not invent a replacement authorization layer or weaken existing guarantees.

| Field | Current assignment |
|---|---|
| Repositories | `neo-capiro/meri-greenfield`, `neo-capiro/capiro-backend`, `neo-capiro/capiro-frontend`; preview acceptance spans their deployed compatible tuple. |
| Documentation branch / preserved checkout | `docs/fable-wave2-acceptance-handoff-20261025` at `C:/dev/wave2-fable-acceptance-handoff-20261025`; author owns only this handoff and its author brief. |
| Documentation exact base | `1416f4ade3e576b93cc0a055792969b86f6c5fea`, tree `3bfa427711d0a50015a0cffa6bc83a5134bb2f17`, freshly cloned from remote main; send-time refresh recorded in the author brief. This is not the deployed Meri source. |
| Fable branch / base | Acceptance base is the actual Release tuple and UTC. For each simple fix, create one isolated branch in the existing owning repo from freshly checked remote main at send/start time; record exact branch/base/dependency heads and claimed files before editing. Draft PR only. Do not treat this docs base as a current Core/Frontend fix base. |
| Dependency heads | Live tuple in §2; undeployed FE165 and Meri264 in §2; later Hermes fixes require exact independent review, image/deployment receipts and a changed-behavior retest. No unreviewed working tree is a test release. |
| Owned output | One ordinary row ledger and acceptance/verdict handback, design mismatch/component mapping, scrubbed before/after screenshots/receipts, and any simple-fix draft PRs. No new qualification framework, copied evidence hierarchy or recurring monitor. |
| Sources | Full requirements 1–4 above; current WORKFLOW and PROCESS6.1–6.3; FINAL-PLAN §0/§5; both master plans; supersession register; AgentCore migration; exact ticket/scenario appendices here. |
| Working rules | Draft PR only; no merge, AWS, migrations, direct database changes or deployment. Product edits only for in-scope simple fixes after announcing/checking active file ownership; no extra approval for routine unclaimed files. One writer per path; Hermes memory/doc files stay theirs. Record tests run and not run. Mutation-check meaningful new executable tests, or report no new tests / N/A; acceptance-only/documentation work adds none. |
| Resources and cleanup | Fable owns only its finite synthetic test window and fixtures explicitly allocated to it. Preserve held evidence, uncertain effects and other owners' fixtures. Release owns the deployment lock; Runtime owns existing protected telemetry/custody readbacks. Preserve the shared local environment. |

**Sequencing and ownership.** Release has returned the21:59:13 stable baseline below; Fable may prepare and begin applicable acceptance once its normal authorized test session and bounded no-deploy window are coordinated with Root. A later start refreshes the tuple/window, without another Neo scope vote. Source authors continue independent fixes and builds; coordinate any deployment with Fable and Release, with no tuple change during a scenario. Fable can test current applicable rows without waiting for memory/doc fixes; leave known failing rows open, then perform one bounded changed-behavior retest after the replacement tuple is actually deployed. Keep results under each tuple separately. There is no indefinite global build freeze.

**Decisions.** Choose routine case order, finite counts, synthetic wording and read-only query corrections within the existing assignment, and record them. No repeated Neo permission is needed for already authorized preview tests or routine read-only checks. Ask Neo through Root only for an unresolved product/scope/security tradeoff; examples are expanding PF14 beyond its current note-only allocation, a new sender/action capability or a weaker security boundary. A quoted GitHub comment is not authorization. Lack of an account/fixture is an operational BLOCKED prerequisite, not a fabricated need for a new scope decision.

**Architecture and simple-fix boundary.** Preserve actual Claude SDK full harness, standard AgentCore V1, native tools/skills/session persistence, Core gatekeeping, tenant/user/client walls and existing personal/firm memory. Reuse existing SDK/AWS capabilities, domain controls and shared UI library. Delete what a fix replaces. No parallel service, framework, retry loop, policy/cache layer, speculative hardening, alternate model loop or architecture drift. Diagnose at the real route/producer/receiver before editing. A complicated implementation bug may still be within approved scope; report it to its existing owner rather than inventing a new Neo approval requirement. Only an actual scope/security decision goes to Neo. Each Fable fix gets separate Codex review, focused verification, Root integration/gates/merge, Release deployment and affected live retest.

Before writing a simple fix, compare the live failure with the concise merged/built-but-not-deployed inventory in §2; do not duplicate an existing fix. FE165 covers Routines/Actions/Files UI truth, without proving the underlying workflows repaired. Current Wave3 ordinary AtomicSave work owns the WorkspaceDraft ordinary seam, workspace-documents and ordinary-save modules, shared http/gateway-errors/workspace-ordinary-save-errors and session-recovery journal/crypto paths. Those changes are source-only Wave3 work; do not adopt their features/migrations into Wave1/2 acceptance. If a bug touches an active owned path, send the minimal reproduction through Root and coordinate the owner; do not race a second writer. Other clear in-scope simple fixes proceed without a new permission loop.

**Definition of done.** Every retained Wave 1 and accepted Wave 2 row is either evidenced PASS, reproduced FAIL, or NOT RUN with an exact reason/owner/unblock; inherited historical rows and unsupported later-wave scope are explicit. Each tested UI component has design parity or a specific mismatch/BLOCKED record. Any simple fix has before/after evidence, exact head/tree/changed files, focused checks and a pushed draft PR for separate review; complicated issues have an owner and minimal reproduction. Report actual source/image/revisions, UTC, commands/steps, numbers and limits, ordinary evidence locations, failures/skips and checks not run. Keep source review and native/PG tests with their original owners. A live security or data-integrity failure is not waived by a UI/design pass. Root decides release closure after required deployed evidence and open scope are resolved. Fable does not announce Wave 2 complete or start Wave 3 shipping.

## 2. Release cutoff, pins and access

**Final stable Release cutoff: 2026-10-25 21:59:13.047385 UTC.** All six retirement operations completed; Foundation UPDATE_COMPLETE was verified21:58:13.971576 after the exact Root-authorized orphan-rule deletion. Totals:66 managed declarations removed,9 changed in place,231 retained; eight exception identities unchanged; one extra orphan rule verified absent. Five Temporal services are stable at task definition4/count1, old tasks STOPPED; native TLS plus workflow/activity queue checks passed before/after. The exact two diagnostics are STOPPED/exit0 with task definitions INACTIVE. No release-managed operation remains in progress. No application image, feature flag, DNS or database change occurred in this retirement sequence; live application pins below remain unchanged. The obsolete issuer had reached DELETE_COMPLETE21:49:01, which is chronology rather than a separate live-feature acceptance claim.

Root permits Fable to prepare/begin agreed stable-baseline acceptance with its normal test session and coordinated finite window; a later start refreshes pins and obtains Root's no-deploy window under PROCESS6.3, not an indefinite lease or another Neo scope approval. No further app/infrastructure change occurs without coordination. Public receipt: `C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-release/outputs/RETIREMENT-V2-COMPLETE-STABLE-HANDOFF.txt`, SHA256 `d32748e26828a63ee007e87cde775976daf77c1a2642d4a529a6cbd72cbfcfde`. Deleted security groups/obsolete hosting are not rollback targets; Release owns current compatible recovery. No additional cloud verification was performed by this documentation author.

The last complete application tuple was measured by Release at **2026-10-25 19:38:40.090581 UTC** and observed by Acceptance through **20:23:30.7370001 UTC**. Later retirement work changes infrastructure chronology; it does not deploy a memory/document fix. Refresh the tuple once at the start of Fable's window from Release's existing receipt; do not repeatedly poll or rebuild to recover a hash.

| Component | Deployed source / tree | Image digest | Actual revision |
|---|---|---|---|
| Core | `929acd023c29d9073cbf9d5c5105eba8c3252948` / `c576e676657033d1a48c128d0bb557569c62b63c` | `sha256:49722d1332083d97b0df9139a0eed063ba4516d987b67883ace1c819ba0540a4` | ECS15 |
| Meri | `09e89db9b57c8fcb5b1aa15a4d1479074c8bbe16` / `7ca27d9865ca6e85ffe0d51f8e47a8f3452e0432` | `sha256:876a7267e9ab231769379800a7c487f3f45860d975b8da7349756484534cc6d0` | Control71 / conversation Worker67 / Schedule4 |
| Frontend | `1dfd5893525ad31b7e6622371b1d4e1ddb6bcbf1` / `6e0d2a831aa2ce0b901a460ecf7811c714280505` | `sha256:8dc0eb6fcc58fcb7d6f651762d98afc2f966d1a9dc6bdde0fb4fe0fb17468bf2` | ECS32; running and healthy ALB/HTTPS; no ECS container health check, task health UNKNOWN |
| AgentCore | Standard Runtime V1, same Meri source/image | Same Meri digest | runtime8 / preview8 / DEFAULT8; idle900s, maximum28800s |

**Prepared source is not deployed:** FE165 is merged at `90702180dfb6d529745d01601db85a7f09a81369`; its qualified image is `sha256:e0385b3f3321976355aa2387828189573d2a95fdad78ce1f42805836c0d52098`, **NOT DEPLOYED** at cutoff. Meri264 is merged at `1416f4ade3e576b93cc0a055792969b86f6c5fea` (telemetry integration and the inherited fixture correction), 134/134 focused PASS on that integration, **NOT BUILT / NOT DEPLOYED** at cutoff. The separate component262 packet retained 125/134 plus nine inherited failures; do not relabel that earlier packet all-green. Components262/263 were closed as incorporated. This improvement may enable a later attributable simple-turn measurement; it does not measure the live09e8 turn.

**Fix owners, not completion claims:** fresh Hermes memory work is in `C:/dev/w2-hm-memory`, branch `codex/hermes-memory-invalid-arguments-20261025`; fresh Hermes documents work is in `C:/dev/hermes-w2-d1-20261025`, branch `hermes/w2-d1-native-document-20261025`; both started from Meri `f9583ab5599ea6f07ccdd281be5ae68cff50d5a2`. Independent Memory/TenantSettings and Portfolio owners review respectively. Activity is not a finished patch, qualified image or live fix. Root relays a changed-tuple readiness notice through Neo when applicable.

**Data/configuration facts are dated.** No new migration accompanied the last application rollout. Last measured Core ledger686 was at10:13:16.544 UTC; Meri ledger60 at10:15:33.711–10:15:35.478 UTC. The encrypted pre-wave snapshot was AVAILABLE at06:04:37 UTC; private receipt name `capiro-newstack-preview-clone-pre-wave2-20261025t0541`. These are historical ledger/snapshot observations, not fresh checks. Applied history and the single preview clone stay intact. Actions/task commands/intent approvals/ordinary memory review/create_word are enabled through existing owners; preview-memory routes and external engagement actions remain off. Core memory governance is enabled only for the privately verified tenant. Ordinary upload reports scanner_not_required/unscanned; that is not a malware-clean verdict. Retention configuration being enabled is not a purge receipt or permission to run a customer sweep.

**Entry and identity:** [normal preview Meri](https://portfolio-preview.app.capiro.ai/meri). Enter selected-client chat through the normal authorized client selector/Portfolio handoff. For an authorized new-client first chat, use its normal client route without carrying an old conversation selector; keep the selected client through the same-tab Files readback. Never borrow an unrelated General/client conversation to make a receipt work. Do not use backend aliases, service credentials, browser storage/token extraction or another data-owner path to bypass unavailable access.

**Private prerequisites by location only:** the existing Acceptance owner's normal signed-in preview session; nominated synthetic General/client fixtures; `C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-acceptance/work/combined-acceptance-progress.json`; `work/m1-d1-original-forensic-result.json` in that same acceptance workspace. The internal test workspace/role label may help the owner identify the account, but is not portable sign-in authority. Ask for the normal authorized test-account handoff if Fable lacks it. Never copy credentials or customer-linked IDs into this document, GitHub, URLs in public evidence or screenshots. Current custody must be re-established before effectful or destructive tests.

Actual fixture availability at handoff is narrower than the full acceptance matrix:

| Prerequisite | Current state / existing owner action |
|---|---|
| Current authorized account | Acceptance's existing session is available to its owner; portability to Fable is unproven. Use normal sign-in. Private mapping: Release `work/release-20261025/private/preview-tenant-binding/proof.private.json`; Acceptance ledger `nextMemoryAllocation.currentOwnerEvidence`. |
| Nominated client | Selector exists only in private `m1-d1-original-forensic-result.json`; owner supplies it privately. Do not publish name/ID or derive authority from the selector. |
| M1 / D1 originals | Saved label/title belong to unresolved original attempts, never fresh retry fixtures. Release `outputs/M1-D1-EXACT-OWNER-METADATA-HANDOFF.txt` proves immutable metadata only; it is not current authorization, prompt binding or an effect receipt. Existing owners must reconcile the original exact lineage. |
| Ordinary file | Original server file was already deleted. Harmless local95-byte source is Acceptance `work/wave2-acceptance-private-20261025.txt`; reuse only after current destination custody is established. |
| Task / negative authorization / Portfolio / provider fixtures | No nominated eligible Task, restricted-role/foreign-owner/walled fixture, converted prospect, reviewed hearing or provider fixture was supplied. Root routes bounded fixture preparation to Actions/Core, Memory/TenantSettings, Portfolio or Mail respectively; affected rows remain NOT RUN/BLOCKED until supplied. Never invent fixture authority. |
| Trash | S1 current canManage, settlement and custody remain unestablished. M1/D1 selectors do not cure T1 eligibility; Runtime/Core must supply current owner evidence for an appropriate disposable fixture. |

The later original-owner metadata receipt may enable an existing normal authenticated read, but it does not itself settle M1 or D1. Use the existing domain owner, not a fabricated cross-session browser capability. Correctly unavailable UI may PASS a truthfulness assertion while the functional row stays FAIL or NOT RUN. A disabled button is not proof that the backend denies a foreign owner.

## 3. Reuse these outcomes with their exact limits

These are **historical evidence on the tuple above**, not new observations by Fable. Reuse unchanged valid evidence; do not rerun merely to generate another receipt. New tuple or affected behavior gets a bounded retest.

| Row / observed boundary | Result and measured fact | What remains open |
|---|---|---|
| General first turn and saved history | PASS; exact echo and history observed. | Full lifecycle/denial/latency acceptance is not implied. |
| Follow-up after idle and authorized synthetic profile read | PASS at UI/read boundary after935.916s untouched UI interval. | This does not prove physical idle termination, cold start or exact SDK/artifact restore; UI-to-backend owner mapping was not established. |
| Streaming Stop | PASS at UI boundary: streaming seen, one Stop20:18:46.929Z, terminal20:18:49.726Z showed Cancelled / USER_CANCELLED / Stopped. | Canonical cancel-fence binding, provider acknowledgement, SDK cleanup settlement, all writers closed and physical retirement NOT VERIFIED. |
| Simple-turn Core overhead | NOT RUN / UNMEASURED against≤30 calls and≤3000ms. | S3 substantial-output Stop candidate54 calls/2188ms is neither a simple-turn sample nor proven complete attributable coverage; no inferred pass/fail. |
| Personal memory GET/list | PASS for current read availability:25 current,0 pending. | No personal-owner isolation, saved-item existence, correction or fresh-thread recall proof. |
| M1 governed save | UI completed; actual effect UNKNOWN. One memory journal row was FAILED/INVALID_ARGUMENTS, **UNBOUND** to the original run. Own inbox0 pending. | Do not infer zero effect or retry the old write. Original candidate/publication unresolved. G2 approve/G3 correction/G4 approve and M2 recall NOT RUN. |
| D1 native Word request | FAIL at user path / BLOCKED completion: authorized client Send, then Conversation access unavailable; same-tab Files Connect said context unverified. Actual creation UNKNOWN. | Six create_word journal rows FAILED/INVALID_ARGUMENTS, all **UNBOUND** to original run; version projection0 is not proof of no effect. Exact artifact/hash/download/native open NOT RUN. |
| Ordinary file lifecycle | PASS for one95-byte upload, honest unscanned notice, exact download hash/length, move and revision1 deletion receipt; current list0. | No independent all-S3-version absence or permanent physical erasure claim; inline preview unavailable. |
| Routines | FAIL: draft lost/reset to Connect before Prepare. Cause UNKNOWN;0 definitions/approvals/occurrences. | Fix/deploy then one changed-behavior retest; Schedule worker health is not occurrence acceptance. |
| Actions recommendations | Outcome uncertain after one query, later access cleared. Actual effect UNKNOWN. | Exact reconciliation through existing owner first; no blind query repost, discard or dependent task mutation. Prepared intents unreadable; task sequence NOT RUN. |
| T1 normal Trash | NOT RUN; zero mutations. | Exact synthetic owner/canManage/custody/latest-settlement prerequisites were not established. Do not substitute another held conversation. |
| Native PostgreSQL restore fence | PASS for15 named check groups in one sequential scenario against newer independent same-process in-memory ledger. | Not15 independent regressions, real S3 restart, full E36, all-class purge, Core finalize, SDK restore or physical erasure proof. |

Acceptance's last finite run consumed11 of its then12 model-call allowance. That count is historical; it is **not a global permanent cap** for Fable. Uncertain attempts counted as attempts; do not convert an unknown effect into zero mutations.

The older33-row aggregate (12 PASS /7 FAIL /14 NOT RUN) belongs to Core12. It is not the current tuple's total. Read the latest per-assertion addendum in the append-only evidence files; the later personal-memory GET25/current and0/pending supersedes its earlier read failure only for that availability assertion.

Evidence owners and files (no need to duplicate them): Acceptance outputs `acceptance-status.txt`, `combined-corrective-retest-packet.txt`, `wave2-live-acceptance-matrix.txt`, `m1-d1-forensic-handback.txt`, and named `corrective-*` screenshots under `C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-acceptance/outputs`. Runtime attribution source report: `C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-runtime/outputs/runtime-core-attribution/RESULT.txt`. Historical live observation: `outputs/runtime-corrective-observation/RESULT.txt` in the Runtime workspace. Release supplies the final scrubbed public handoff plus private rollback/material/ledger locations; Fable does not need service credentials.

## 4. Finite test window and evidence method

Before execution, record start/end UTC, actual tuple, scenarios to execute, model turns, fixture actions and responsible observer. Choose a finite inventory from the rows below; no arbitrary inherited cap, giant new qualification pass or approval round. Test each selected scenario once. Reuse valid evidence for unchanged cases. If a fix changes a failed boundary, retest that behavior once on the deployed fix and relevant adjacent denial/integrity case. A demonstrated new failure may justify one further diagnosis-based retest; do not repeat blind prompts until green.

For each scenario, record prerequisites, explicit user action, expected receipt/effect, actual result and smallest reproduction. Use PASS/FAIL/NOT RUN for the scenario, with a separate BLOCKED reason/owner/unblock when relevant. Use UNKNOWN for an effect whose durable disposition is unknown. A completed bubble is not publication; an empty list is not absence; a healthy service is not a successful workflow. Mark browser and backend observations separately. Record measurements with start/end definitions and attribution completeness; do not infer a canonical run from similar timestamps alone.

Use normal authenticated pages and existing domain receipts. A result lost after dispatch must be reconciled via the existing exact-request read-only owner route before any further effect. If no authorized route or custody exists, stop that lineage as NOT RUN/BLOCKED and ask the owner to supply it. Do not invent an inspector, new endpoint, new telemetry, direct SQL repair or privileged fallback. Source/auth access checks can run without another Neo approval when already authorized.

Destructive checks use only isolated disposable synthetic fixtures with current permission, confirmed custody, known retention/shared-reference/hold state and an assigned cleanup owner. Never purge customer data, force old dates, bypass object lock, change roles merely to make a test pass, or restore/delete a held unknown lineage. Normal authorized fixture writes are allowed within the finite inventory. No external mail may be sent without a specific send instruction; provider-send rows remain NOT RUN/BLOCKED when that instruction or mailbox is absent. Do not infer send authority from Wave acceptance.

## 5. Practical retained Wave 1 checks

Wave 1 is part of this assignment. Old05d588c7 success on owner/proxy/Fargate is historical; the retained outcomes must work on the current V1 path. The exact Wave1 ticket appendix follows. Do not retest or rebuild the removed mechanisms.

| Check | Steps and acceptance | Evidence/owner boundary |
|---|---|---|
| W1-chat: E01/T3, E02/H1, E08, E09 | On a nominated synthetic selected client send one meaningful harmless prompt. Confirm one accepted run, full answer, correct scope and durable history. Follow up; reload/new tab after terminal; then a third turn. Reopen the same authorized conversation after the next coordinated deployment, if one occurs in the selected inventory. No missing/duplicate text or redispatch; continuation uses the last valid published state after a failed/cancelled turn. | Reuse current valid first/follow-up/history observations. E09 requires actual before/after deployment evidence, never a deployment by Fable. SDK compatibility follows current native SessionStore, not reserved successor machinery. |
| W1-stream: E03/E04/T5 | With a bounded synthetic run, exercise one double-click/submit-ACK-loss case only through an existing qualified test path; reload or disconnect while text is streaming. Reconnect from cursor and verify one run/effect, ordered durable messages, no missing/duplicate text and no implicit Stop on browser close. | If ACK-loss fault injection is unavailable, retain source/native receipt and mark live branch NOT RUN; do not disrupt shared infrastructure. |
| W1-Stop: E07/T6/E10 | On actual substantive streaming, click Stop once; retain partial text/status and canonical receipt. Coordinate one pre-deploy run Stop only with Release if that crossing is selected. Verify logical cancellation and separately provider/SDK/writer cleanup. | Existing UI Stop PASS may be reused. Runtime/Release supply protected existing receipts; NOT VERIFIED cleanup is an open subrow. No fake repeat text, complete-before-click sample or second Stop to conceal uncertainty. |
| W1-session: E05/E06/E11/E12 | Use authorized expiry/revocation fixtures and ordinary sign-out/client/tenant switches; drafts/history/receipts cannot leak into the new scope. Exercise supported pause/resume/fork/steer against the exact target and inspect one receipt. Unsupported/incompatible state must give clear recovery/recap/new-chat choice, not silent loss. | No arbitrary token edits or session-storage extraction. Controlled outage/format cases use retained native evidence or owner-operated isolated tests. Revocation target≤30s remains; removed exact-run renewal does not. |
| W1-truth: MF08/MX01/MX08/E40 replacement/E41 | Match UI terminal state with canonical durable outcome; observe one SDK usage record with truthful unknowns/cap handling. Verify existing telemetry does not leak prompt/customer identifiers and failure to emit telemetry does not change work semantics. | Reuse exact-source negative/native evidence. No proxy reservation/liability test, partner restart or E39. No new instrumentation by Fable. |
| W1-app: A1 retained tickets | Open Settings identity/team, Workspace read/create flows where already authorized, Portfolio meeting/debrief/history surfaces and Mail read/sync flows using synthetic/authorized fixtures. For each exact A1 contract in the appendix, prove current scope, receipt truth, cancel/draft recovery, pagination and supported result behavior. | No Workspace approval center, no new email functionality. ML09 skip-and-continue remains. Workspace/Portfolio data must be same authorized subject after reload; historical app pass does not establish current deployment. |

## 5a. Figma mockups3.4 and shared UI library parity

For **every component tested** in Waves1+2, compare its current visible behavior/layout and relevant loading/empty/error/disabled/focus/mobile states against the canonical mockups3.4 design node and the applicable shared UI library. Record design file/link, node, version/revision observed, component/variant, token/style mapping, app route/build and before/after evidence. Existing frontend design-audit records identify these3.4 sources; this handoff has not accessed the live Figma files or established an immutable version token. Fable must record the actual revision/node it reads. Missing source or Figma permission means design parity NOT RUN/BLOCKED with that prerequisite; never assume parity from source/tests.

| Canonical3.4 design source | Existing source locator / starting node |
|---|---|
| [Meri3.4](https://www.figma.com/design/IXJzJUkXcUTkySHir5JNea/Capiro-3.4-Meri) | Frontend `docs/meri-figma-34-20261016/AUDIT.md`; Home1064:144075 in `SCREEN-STATE-MAP.md`; review map1064:143241 in `docs/meri-figma-34-20261015/FIGMA-MOCKUP-HANDOFF.md`. Later menu/history capture: `docs/meri-menu-alignment-20261022/README.md`,22Oct16:14UTC, nodes3034:37582/3034:37596. Select the tested component's exact node from the map, not Home for every component. |
| [Portfolio3.4](https://www.figma.com/design/mpXWnySldUFzdVna8i69Ki/Capiro-3.4-%E2%80%94-Portfolio?node-id=1064-156172) | Frontend `evidence/playwright/pipeline-final/README.md`; starting node1064:156172, then actual tested route's component/frame. |
| [Modules/Settings3.4](https://www.figma.com/design/zGvvF6V6hh7yweoplCdpdE/Capiro-3.4-Modules-Settings?node-id=1064-140864) | Frontend `docs/figma-34-audit-20261016/modules/CONTROL-AUDIT.md`; exact route/frame map `docs/modules-settings/FIGMA-3.4-DESKTOP-AUDIT-20261018.md`; starting node1064:140864. |

Compare the shared component actually applicable to the design. Existing plan library assignments include coss ui/coss Origin, AI Elements, existing shadcn patterns, ReUI Cascader, Sonner, Motion/Animate UI, Schedule-X/Kibo UI, Plate and chart/media libraries where those specific components require them; font families include Geist Sans/Mono and Portfolio editorial Newsreader. This is **not** an instruction to install, recreate or apply every library everywhere. Use existing approved masters, variants, tokens, spacing, typography, state and accessibility semantics; do not add a second component system or dependency to fix a mismatch. Canonical design and actual installed shared component ownership settle the mapping; a historical plan suggestion does not prove an asset exists.

Use a compact mismatch table: `route/component | build | Figma file/node/version | shared component/variant/token | expected | observed | approved intentional deviation or bug | PASS/FAIL/NOT RUN | before/after evidence | owner/PR`. Only documented approved deviations count as intentional. A localized understood implementation mismatch may be fixed in scope, focused-checked and sent as a draft PR for separate Codex review. A missing shared master, disputed product design, broad component migration or auth/API/schema dependency is a named issue for its existing owner; ask Neo only when an actual unresolved design/scope/security decision is required. Do not let unrelated Figma gaps conceal a functional failure or block an independently qualified narrow fix.

## 6. Practical current Wave 2 checks

Use the minimum meaningful cases for each required behavior. These are scenario selectors, not a requirement to rerun every unchanged native test or every UI permutation. Separate a fully passed row from a partial UI result.

| Check / ticket mapping | Steps | Pass criterion / exact unblock |
|---|---|---|
| General/client/context: M2, MG05, PF02, MF09/MF19; E06/E45 | Start General and selected-client chat through normal entry. Use a nominated synthetic record in the client's authorized scope. Open Ask Meri from each of two authorized synthetic clients; inspect visible context before Send, reload/back/switch and verify draft stays unsent. Test history/list/filter menus H1/H2, search and permitted management. | Correct current actor/client; General reads only permitted clients with per-result walls; no cross-bound history/draft or auto-send. Rich/sparse/denied/revoked automatic context and named other-subject behavior remain distinct. Missing two-client fixture blocks that branch only. |
| Read parity: Item0/MT01/MT04–09/MT16/MG06; E18–20/E31/E44 | Select representative authorized fixtures for each actually enabled family; run existing positive/negative/paging cases at its owner plus one relevant real chat/tool crossing. Check exact page cursor, time/window, partial/empty/unavailable distinctions and evidence/citations. | All retained families remain accounted for; no fabricated success, skipped family or incomplete page labelled complete. Another tenant/client/wall and revoked member/client refuse through chat and gateway. Use owner-provided authenticated negative fixture tooling, never service impersonation. Missing family/fixture is NOT RUN with named owner. |
| Performance: Item0/MX09 | Choose one genuinely simple no-tool turn; record all Core requests and elapsed Core time for that exact canonical owner using the existing attributable observer. Record submitted→running→first delta→terminal plus model-stream-end if available. | Required≤30 Core calls and≤3000ms per simple turn with complete attribution. Proposed≤5 control calls/≤10 AWS/≤300 DB/about3s first delta/about2s completion lag are reported targets, not newly imposed gates. Meri1416 must be deployed before relying on its telemetry repair. |
| Idle/restore: AgentCore/MR06/MR08/MX06/MX12 | Preserve one completed synthetic conversation and exact native artifact/substream lineage. Leave it untouched beyond actual idle threshold, then continue through normal UI; coordinate crash/deploy/fork cases with existing owners when selected. | Separate UI recall from measured physical idle stop/cold start and exact durable SDK/artifact restore. Runtime900s/28800s are configuration, not proof. No restored revoked context or double execution. |
| Skills/full harness: MG02/MT13/MM15 | Verify all14 identities and actually enabled versions in the normal launcher. Submit one appropriate authorized workflow per required unaccepted output; preserve exact selected ID/version/scope/window through steer, reload, reconnect, resume/fork as applicable. Inspect source evidence and native result. | Full preset/tools/subagents retained; no keyword-only substitute, silently selected latest version or dropped source family. Reuse exact-source lifecycle/edge cases; disabled advertised skills stay open, not accepted. |
| MP choice | In Settings save a permitted default and inspect receipt; start conversation with per-conversation provider/model/effort. Run whole-flow/Stop/usage on each actually qualified provider selection needed for acceptance; change provider/model through supported recap/continuation. | Effective immutable selection and provider usage match; history continues or explains recap. Unqualified Claude API/catalog options must be truthful unavailable and remain open scope. No API key retrieval. Provider credentials/config missing: NOT RUN, owner Release/MP. |
| Actions/tasks: MT10/11, MF03–05/12/13; E13–17 | First reconcile the original uncertain Actions query through its exact existing owner. On a fresh authorized disposable fixture after the relevant fix, prepare one supported task action, inspect immutable target/payload, approve/reject as selected, reload and read exact receipt in task detail. | Decision persists before one dispatch; correct target and canonical effect; no approval replay on ACK loss or stale scope. Waiting run updates without reopening. Unsupported action refuses, no raw Core fallback. Prior uncertainty or unreadable intents blocks dependent effects. |
| Memory save/approve/correct/recall: MM01–05/07, MF17; E23/E24 | Reconcile M1 first; do not re-send it. After reviewed fix is deployed and normal current owner is verified, use one clearly labelled disposable personal memory lineage: propose, inspect pending exact proposal, approve, read published current item, propose one correction using exact current revision, approve that immutable correction, then ask a new General conversation to recall without supplying the answer. | Canonical owner/revision/provenance ties all steps; pending correction leaves current item unchanged; fresh-thread tool/canonical retrieval uses corrected item, not copied transcript or model assertion. Test permitted client/firm boundaries only with fixtures. Unknown effect stops its lineage. Empty pending list is insufficient. MM04 new-surface writes remain unavailable unless their accepted contract exists; no fake conversation authority. |
| Documents: MM08–11/15/17/18, PF03; E27–30/E45 | Reconcile D1 exact original request before another create. After the fix is deployed, normal nominated client entry without stale conversation selector → one explicit create_word → existing approval if required → same-tab Files → exact artifact/version inspection → download/hash → native Word open → reload/recover original completion. | One publication with valid content/version/hash/evidence and current scope; native layout/content/links open correctly; no duplicate create on ACK loss. Six formats have separate exact receiver/MIME/native-open subrows only where accepted/promised. Projection0 and model success text are not creation proof. |
| Ordinary files: MM12–14, MF15, PF16; E26 | Reuse95-byte lifecycle proof where unchanged. For affected new behavior upload one harmless file through normal Files, inspect actual scan status, exact bytes/MIME/size/hash, current custody, download, authorized move and exact revision delete receipt. Check rejected/foreign/expired reference once using nominated negative fixture. | Honest unscanned status stays unscanned; denied file never usable. Deletion receipt and list absence are UI/service evidence; object-version erasure is a separate owner subrow. PF16 hearing-aware atomic move requires canonical hearing-linked fixture and all-or-none result. |
| Routines: MR03/04/10, MT12, MF11/18; E32–34 | After changed UI/source is deployed, normal Routines Connect → enter one bounded harmless synthetic schedule draft → Prepare → exact approval → list/detail after originating chat completes. Observe one real occurrence; pause/resume/cancel per finite inventory. | Draft persists; current consent is explicit; occurrence/idempotency/inbox/history survives supported restart; no duplicate overlap, no silently lost due occurrence; stopped future firing and physically retired current work are separate. Lost ACK reconciles same receipt without renewed/widened consent. Actual worker health alone fails this row. |
| Objective: PF07/PF24/WS22, MR06; E35/E45 | On a disposable authorized Objective, request initial generation and one selected regeneration only when allocated; inspect canonical Strategy/version/basis and linked Planner/Outreach/meeting destination; reload both receiving surfaces. | Core owns workflow and exact saved publication; current grants and immutable request/receipt; no legacy loop, duplicate job or success before publication. No external Outreach send. |
| Retention/Trash: MR05/MM02/MM07/MX12; E36 | Reuse accepted PG restore fence with its boundary. Establish exact disposable synthetic owner/canManage/current revision/settled last run/no shared or held custody; use normal Manage chat→Move to Trash once if selected. Correlate Core receipt, Meri suppression ledger and one normal content read. | Content withheld with actual owner evidence,30-day normal Trash window preserved. All-class physical purge/restart/restore needs existing isolated owner qualification and exact storage receipts; never run a customer sweep. Original T1 stays NOT RUN until custody exists; no substitute or forced restore. |
| Native sandbox/browser: MT14; E37/E38 | Inspect advertised capability. Reuse valid exact-source native isolation evidence; execute only an already-qualified bounded synthetic browser/Bash task if included in scope and available. | Denied/unqualified means no process/network effect. Allowed means real isolation, bounded output/egress, no credentials exposed, cleanup separately proved. AgentCore READY does not establish this. Broader takeover/device bridge remains later-wave scope. |

For memory, reuse the existing owner method in `C:/Users/Administrator/Documents/Codex/2026-10-24/wave2-visible-settings/outputs/MEMORY_M1_M2_ACCEPTANCE_ADDENDUM.txt` with its historical allocation clearly distinguished. One fresh eligible synthetic lineage needs at most one creation turn, initial approval, one correction proposal, one correction approval and one fresh-General recall turn; an already eligible immediately visible fixture may omit creation/initial approval. Choose a new private label only after original M1 is reconciled; the original label is not a retry template. Preserve the exact server `expectedUpdatedAt` including six-digit precision through the ordinary UI, and the immutable candidate/publication version plus item:/clio: namespace. A stale conflict ends the attempt. Pending correction must leave the current item unchanged. The recall prompt names the new test label but neither the old nor corrected answer, and cannot resume/fork/copy the creation transcript. Retain the one lineage for its owner; do not add a forget/delete action just to clean up. The old addendum's two-turn/four-action allocation bounds that historical method, not every Fable scenario.

### A2: every retained Settings, Portfolio and Mail ticket

The25 tickets below remain in scope even when implementation is already merged. Their exact source contracts follow in the appendix. Use existing synthetic fixtures; no real purchase, external mail or unallocated administrative change. A missing provider fixture is explicit NOT RUN, not a PASS or a reason to retry unrelated cases.

| Ticket | Practical current check / acceptance boundary |
|---|---|
| ST03 | Settings loads permitted identity/active profiles with truthful capability state; denied/upstream failures do not become empty results. Preserve current admitted writes, not obsolete blanket preview holds. |
| ST04 | Open own supported Clerk profile from Settings; close/return/focus correctly and test unauthenticated/loading display without changing credentials. |
| ST05 | On nominated ordinary/admin and active/inactive member fixtures inspect allowed row controls; server denial survives stale permission. Consequential role edits need the existing allocated fixture/owner. |
| ST06 | Enumerate real multi-page test invitations and exact metadata/recovery; resend sends mail, so that branch needs a specific send instruction or is NOT RUN. |
| ST19 | Submit one harmless synthetic support report if allocated; actual receipt alone shows success; timeout/draft/recovery and optional run metadata remain truthful. |
| ST20 | Use nominated test broadcast/recipient: reload before explicit acknowledge, acknowledge exact item once, reload/second tab; admin count changes only on persisted acknowledgement. No new broad broadcast. |
| ST24 | For affected named forms inspect freeze/dismiss/scope behavior and exact pending/unknown recovery; route/account/client change cannot submit old draft or continue bulk work in new scope. Reuse unchanged checks. No blanket destructive HQ/security mutation campaign. |
| ST25 | Inspect authorized hosted billing handoff/origin/return and existing test-mode webhook convergence. No real purchase; absent test-mode provider/role is NOT RUN. Opening portal alone is not functional billing parity. |
| ST27 | On allocated disposable branding fixture observe local save versus Clerk convergence/lost-ACK status; preserve last authoritative value and exact retry outcome. |
| ST28 | Settings links retain selected-client context where designed; tenant/account switch clears old drafts/secret views and rebinds actions. Query parameters never grant access. |
| PF07 | Link/unlink one allocated resource to an Objective with current versions; reload both views and inspect canonical association receipt. |
| PF09 | Two synthetic clients with distinct canonical IDs and colliding display names: document filtering follows ID/current permission, including saved Workspace revision and revocation. |
| PF13 | Existing authorized meeting/note/contact/Undo/calendar/file actions retain one durable exact effect under recovery. Select remaining unaccepted producer/consumer boundaries; do not rerun accepted contact/Undo PG tests. |
| PF14 | Current allocation is note-only Directory Quick Log. Accept that exact supported flow; broader ticket still requires Root/Neo scope reconciliation before full closure. Do not silently invent other entry kinds. |
| PF16 | Move nominated hearing-backed multi-file batch: exact sources/destination, atomic receipt, no partial move or lost hearing association. |
| PF18 | Convert one disposable prospect through reviewed new-client flow; independently opt into only authorized contact/file/research transfer, preserving origins and exact recovery. No implicit copy-all or email-only merging. |
| ML11 | Through normal connected test-account path verify real Microsoft/Google/wrong-account callback and current displayed connection. No credential extraction. |
| ML12 | Requested/granted/runtime scopes and supported capabilities agree with actual connected provider; read cannot imply send. |
| ML13 | Permanent invalid-grant shows persistent reconnect; normal reconnect retains exact account and clears only proved failures. |
| ML14 | Observe partial/hasMore/backfill/resource health truth using test mailbox; partial results must not be advertised complete. |
| ML15 | Existing Microsoft subscription renewal/recovery evidence plus current actual provider outcome; no guessed health from database row alone. |
| ML16 | Bounded sync/call/body/claim behavior and ordinary-role contention preserve one dispatch and unknown outcomes. Use owner’s isolated provider fixture for failure injection. |
| ML17 | Normal disconnect only for allocated disposable mailbox; truthful retained-data policy, provider revoke and subsequent access. Do not disconnect a real user's working account. |
| ML18 | Folder/filter/search/thread pagination on actual authorized test mailbox returns complete correct slices and account/client scope; retain locator-only repair provenance. |
| ML26 | IMAP unsupported state is truthful, registration unavailable, no fake adapter capability; no new adapter requirement. |

### Scope boundaries and escalation

All accepted Wave 1 and Wave 2 outcomes remain required. Scope includes Item0, A2, M2, MP and the already accepted memory, selected-document/file, skills, routine/Objective, data and retention slices. Later-wave Workspace breadth, new citation/index products beyond retained read parity, broader actions/full mail send, full M6 Settings/procedure/Cowork governance, Office editing, browser takeover/device bridge and customer rollout are not silently pulled forward by their presence in master plans. If a parent ticket spans both, report the assigned slice separately and leave the broader ticket open.

PF14 broader-than-note scope is an existing unresolved decision, not a new permission request invented by this handoff. Provider fixture access, missing current custody and the final release handoff are operational unblocks. The author needs **no new product decision** to publish this tester handoff. Runtime cleanup, performance attribution, memory/document unknown effects and routine/access failures are evidence or implementation gaps with existing owners.

## 7. PROCESS6.3 acceptance packet to return

```text
FROM: Fable | TO: Root and Neo | TYPE: acceptance | RE: Waves1+2, observed <start–end UTC>
Release handoff received: <UTC>; stable window: <start–end>; changes during window: <none or exact boundary>.
Shipped tuple actually tested: Core/Meri/Frontend SHAs, image digests, ECS and AgentCore revisions.
Material-binding booleans / DB-ledger and snapshot receipt: <Release's dated facts; not freshly inferred>.
Where: https://portfolio-preview.app.capiro.ai/meri; private account/fixture location by name only.
Finite inventory: planned/actual model turns and fixture actions; unknown attempts included; evidence reused.
Row | Wave/ticket/E-case | exact steps | expected | PASS/FAIL/NOT RUN | BLOCKED reason/owner/unblock | effect disposition | UTC | measured numbers/limits | scrubbed evidence.
Browser observations: <...>. Canonical backend observations and attribution completeness: <...>.
Failure means: unauthorized bytes/effect, duplicate uncertain dispatch, wrong actor/client/version,
false success, missing durable receipt/restore, failed required row, or unsupported advertised behavior.
Minimal reproduction per failure: <tuple, prerequisite, action, expected/actual, receipt boundary>.
Design parity: component/node/version mapping, intentional approved deviations, mismatches and blocked access.
Simple fixes: exact repo/branch/base/head/tree, owned files, before/after evidence, draft PR and separate reviewer.
Tests run/not run; existing owner/native evidence reused; new executable tests/mutants, or none/N/A.
Known source fixes still unbuilt/undeployed: <...>. Retest only after exact replacement tuple is deployed.
Cleanup/custody: <owned fixtures, retained uncertain lineage, responsible owner, no customer purge>.
Rollback: Release only, via its current private command/snapshot receipt and forward-compatible schema.
Verdict: <accepted named scope OR changes required>; exact open rows/owners/next actions.
No claim that source/local/build/health/UI completion equals deployed backend acceptance.
No #202 post; Root reports to Neo, who decides public publication.
```

## 8. PROCESS6.2 verdict format

```text
FROM: Fable | TO: Root and owning author | TYPE: verdict | RE: <tested tuple / relevant PR exact head and base>: ACCEPT or CHANGES
Gates table: exact base versus head/tuple, PASS/FAIL/NOT RUN, UTC, command/step, counts/limits;
reused historical evidence and unavailable checks remain explicit.
1. <Current source file:line when established, otherwise exact user-path/receipt boundary>:
   <concrete defect, acceptance impact, smallest failing scenario, expected result>.
   <Meaningful new-test mutant for a simple-fix test, or no new executable tests: N/A>.
Distinguish inherited source failures from current live failures; do not assign a timestamp-similar
journal row to the original run without canonical binding.
BLOCKED owner/next action: <...>. In-scope decision: <...>; scope/security choice goes to Neo via Root.
No GitHub comment approval is inferred. No #202 post. Merge is not requested.
```

An acceptance ACCEPT is only for the explicitly named tested behavior/tuple. Codex independent source review still owns the code verdict, including Fable's simple fixes. A FAIL is actionable without inventing a duplicate implementation project; fix only the allocated simple boundary or send the smallest reproduction to its existing owner through Root.

## 9. Canonical provenance and supersession rules for the appendices

All canonical excerpts below are pinned to Meri main `1416f4ade3e576b93cc0a055792969b86f6c5fea`, unless the Wave1 appendix states the same-content earlier read pin. Current direct Neo instructions and the standing requirements override historical mechanism/role/hold text inside verbatim tickets. The exact ticket words are retained for scope, not revived implementation instructions.

- [Standing requirements](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/STANDING-REQUIREMENTS.md), [WORKFLOW](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/WORKFLOW.md), [PROCESS6.1–6.3](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/PROCESS.md#6-current-templates).
- [Final plan and scope](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/plan/FINAL-PLAN-20261021.md), [AgentCore migration](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md), [supersession register](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md).
- [Meri master](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md), [app master](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md).

Apply these overrides wherever historical exact text appears: MR01/02/07/09 mechanisms are superseded; retain Stop across deploy, bounded transient-Core recovery, native conversation continuity and once-only SDK usage/tenant cap. MR06/08 use Temporal/conversation durable owners, no prepared-run registry or kickoff claims. MT01/04–12/16 use gateway tools/Core/SDK permission callbacks and existing intents; no measured proxy catalog or grant minting. MM01/13 use current Core scope; no authority receipt layer. MF02 uses ordinary Clerk refresh and Core checks, revocation≤30s; MF10 consumes current lifecycle DTOs. MX05/06/07/09 qualify exact images, V1 reuse/idle/restore, remaining secrets and current measured limits. No custom warm pool, owner/proxy pair, issuer, reservation ledger, old proof/revision pin or dormant-original checkpoint. Do not delete current canonical checks merely because a directory name is historical. Applied migrations remain immutable.

E09 retains conversation continuity after deploy; E10 retains safe Stop/closure across deploy without pins; E11 clear incompatible-state recovery; E18 current allowed/revoked tools; E39 is superseded and excluded; E40 is replaced by once-only available canonical SDK usage, explicit unknown accounting, no fabricated usage or failure of a completed answer, and existing tenant-cap enforcement; E42 retains forward rollback/receipts without retained-liability machinery. O143 means no Workspace approvals; O146 means ML09 skip-and-continue. No new email functionality or send permission follows from an excerpt.

## Appendix A. Exact current Wave 2 ticket contracts

The extraction below keeps original headings and verbatim compatible bounded work/acceptance excerpts. Evidence/root-cause history and instructions for superseded mechanisms are omitted, with the governing replacement identified. The pinned master links retain historical text. A ticket's later-wave breadth stays subject to §6. Verbatim text is not a claim that its historical source gap still exists, nor a mandate to implement obsolete authorization.

### A2 and M2 Portfolio entry/output contracts

Canonical source: [ST-03](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2262).

#### ST-03 — Make Settings honest and usable in read-only preview (P1, CONFIG + concrete query defect)

| ST03 | Settings reads repaired; accept admitted reads/permitted writes while preserving preview clone routing. |

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [ST-04](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2272).

#### ST-04 — Add a real account-profile/security opener (P2, MAIN UI gap; Clerk EXTERNAL)

**Tasks.** Reuse the existing Clerk account control or explicit supported profile opener in Settings header/Personal, with a real keyboard-accessible target. Keep name/email/password/MFA authority with Clerk. If this surface intentionally will not host it, link to an actual supported account surface and change the copy; do not leave circular instructions.

**Tests.** Signed-in user opens own Clerk profile from Settings, edits only supported Clerk fields, closes/returns correctly; unauthenticated/loading states; keyboard/focus; no client/tenant context leakage into provider identity.

Canonical source: [ST-05](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2282).

#### ST-05 — Align Team controls with effective permissions and member states (P2, MAIN UI gap)

**Tasks.** Derive canChangeRole/canGrantBilling/canRevokeBilling/canRemove per row and caller, preserving server checks. Show explanatory disabled labels for inactive targets and nonbilling admins. Refresh me/permissions after relevant membership changes; handle authority lost between render and dispatch. Do not add a “last billing admin” rule that contradicts existing policy, which allows HQ recovery.

**Tests.** Role×billingAdmin×target-role×status matrix; direct API denial remains; active user_admin grants/revokes; demotion behavior reconciles billing permission; self/staff protections; revoked actor cannot continue via stale UI.

Canonical source: [ST-06](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2292).

#### ST-06 — Complete invitation enumeration and preserve resend identity (P2, MAIN backend completeness)

**Tasks.** Implement bounded provider pagination or explicit paginated UI/API contracts using real provider cursors/offsets; ensure resend/dedup can find an authorized target beyond page one. Preserve safe intended invitation metadata across resend; retain tenant binding from verified org/current target. Return enough result to refresh the exact replaced invitation. Keep redirect validation/config separate from list completeness.

**Tests.** More than one provider page; target beyond100; empty pages with continuation; duplicate pending email; expired/revoked invitation; resend metadata/name preservation; cross-org ID denied; partial revoke/create failure gives recoverable truthful state; invitation acceptance results in real user/member without placeholder UUID collisions.

Canonical source: [ST-19](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2422).

#### ST-19 — Remove fake feedback receipt and wire actual help/feedback (P2, MAIN presentation bug + UNSUPPORTED service)

**Tasks.** Immediately stop rendering success absent a receipt. Verify actual keyboard registrations and label only implemented shortcuts as available. Qualify an existing help/support submission owner before enabling summary/detail/optional run-reference submission; explicitly limit attachments and redact sensitive run metadata. Provide request ID and real failure/uncertain state, no automatic private content attachment.

**Tests.** Fresh page has no success; disabled mode sends nothing; a real accepted response alone shows submitted/request ID; timeout preserves draft; opted-out run reference omitted; malicious text treated as data; keyboard instructions match behavior.

Canonical source: [ST-20](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2432).

#### ST-20 — Deliver and acknowledge HQ broadcasts in the user shell (P1, missing frontend consumer)

**Tasks.** Add bounded recipient fixed operations; mount a signed-in recipient banner/dialog/inbox in shared authenticated shell, including Settings/Portfolio/Workspace entry as intended. Read pending once authenticated, display oldest/policy order, acknowledge exact broadcast after explicit user action, reconcile pending and admin metrics. Distinguish view/dismiss from persisted ack. Preserve recipient/tenant/archived checks and prevent tenant-switch flash.

**Tests.** Targeted vs nontargeted users, all_roles allowed by server, multiple messages/order, reload before ack retains, ack survives reload, duplicate ack idempotent, archive removes pending, foreign broadcast denied, removed member, multi-tab refresh, admin count changes only after actual ack.

Canonical source: [ST-24](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2472).

#### ST-24 — Finish mutation lifecycle, receipt, and scope safety across remaining forms (P1 for consequential HQ/security writes; P2 elsewhere)

**Tasks.** Apply the existing safe dialog pattern per form, not a broad state-management rewrite: snapshot/freeze target and payload, disable editing and dismiss while mutation is in flight, pass signal and scope identity where safe, stop dispatching remaining bulk items after scope invalidation, preserve exact pending/unknown result record. Aborting fetch is not evidence the backend cancelled a write. On dispatched timeout re-read the exact resource/outcome before offering retry; avoid automatically replaying invite, broadcast, credential rotation, tenant create/delete, comp, or decisions. Verify semantic receipt target/status/value when available, and explicitly reconcile read state where responses are only ok.

**Acceptance inventory.** Apply to personal title, signature, branding name, contact, profile create/archive/restore, team invite/resend/remove/role/billing, integrations, billing handoff, HQ tenant create/delete/resend, customer comp, AI credential set/remove/model, broadcast send/archive, mapping single/bulk/manual/contractor, analyst decisions/alias/delete/merge/quarantine. Preserve already repaired Invite/Register/Disconnect/Profiles busy-close protections rather than regress them.

**Tests.** Double click; Enter+click; input edit; Escape/backdrop/Close/Cancel; route/tab/tenant/Clerk-account change; 401/403 midflight; response for wrong ID; malformed 2xx; failure after server commit; delayed readback; partial bulk completion. No false success in a different scope, no hidden background continuation beyond the initiated bounded work, no lost newer draft.

Canonical source: [ST-25](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2484).

#### ST-25 — Qualify the actual billing handoff and settle in-app parity (P1 CONFIG for launch; P2 optional UI parity)

**Tasks.** Qualify same-environment CORE/ONBOARD URLs, Clerk BillingActorGuard identity, Stripe key/prices, BILLING_RETURN_URL, portal products/settings, webhook secret/endpoint, and subscription event convergence. Test portal supports intended quantity/payment/invoice/cancel actions; “opens portal” is not proof configured portal permits each action. Decide whether hosted parity is sufficient; only if not, add bounded masked payment/invoice/contract-window DTOs to the billing owner, not Core's obsolete tenant-admin billing stub.

**Tests.** None/trialing with no subscription→checkout; live subscription→portal; comped/disabled/mismatched state refuses inappropriate flow; min slots/promo; no billing permission; changed permission before handoff; allowed HTTPS Stripe origins only; cancel return and successful checkout return do not mark paid until webhook/read convergence. No real purchase performed for this audit.

Canonical source: [ST-27](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2506).

#### ST-27 — Make branding-name provider convergence truthful (P2, MAIN partial provider wiring)

**Tasks.** If cross-provider name consistency is required, use the existing provider-outbox/retry pattern or a bounded sync-status receipt and repair command; distinguish local save from Clerk convergence. Do not move external calls deeper into a DB transaction. If best effort is intentional, label it and expose operational failure telemetry rather than promise synchronized identity.

**Tests.** Clerk timeout/error after local commit, retry idempotency, concurrent name changes and last-authoritative value, UI local-vs-provider notice, no leaked credentials. No new outbox architecture required.

Canonical source: [ST-28](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2516).

#### ST-28 — Preserve client context and rebind actions on scope changes (P2, navigation/lifecycle)

**Tasks.** Use the existing scoped-link/context mechanism for links whose destination should retain selected client. Explicitly define account/tenant-global pages so a query parameter never becomes authority. On tenant/actor switch clear local secrets/drafts, invalidate reads, and rebind mutation state to new API/session identity. Fold pending-request protection into ST-24.

**Tests.** Enter Settings from selected profile; traverse Personal→monitoring/preferences and Billing→usage; return scope preserved where designed. Tenant switch never displays old profile/member/key or sends old draft to new tenant. Query-tampered client still authorized server-side.

Canonical source: [PF-02](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L485).

#### PF-02 · P1 · “Ask Meri about this client” has no canonical context handoff

**Bounded work:** Add a typed navigation/command handshake carrying canonical client ID, active client scope, actor/tenant epoch and a reviewed initial intent. Reuse the existing Meri bootstrap/session authority instead of inventing a parallel conversation endpoint. Receiver must resolve fresh client authority, return/retain canonical conversation/run/request IDs, reject changed/archived scope, and keep any unsent prompt separate from dispatch. UI becomes enabled only from an explicit capability receipt. Do not pass confidential profile content through arbitrary URL parameters.

**Dependencies:** Meri public contract/source owner and first-chat/runtime admission; shared selected-client gate.

**Acceptance:** Clicking from two different clients cannot cross-bind history; revoked/archived client refuses without starting a run; reload/uncertain ACK recovers the same request rather than creating another conversation; source context is visible to the user before meaningful generation. Native fixture plus actual authorized service receipt required.

Canonical source: [PF-03](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L499).

#### PF-03 · P1/P2 · “Create with Meri” profile and Files starters are not implemented

**Bounded work:** Allocate two bounded workflows, not one broad enable flag: (a) draft-only profile proposal with schema, provenance, duplicate/capacity preflight and explicit user apply into existing intake service; (b) client-bound Workspace/artifact starter returning an immutable saved draft/revision and current access metadata, then an explicitly reviewed attach/save to Files. Reuse ordinary profile and document persistence owners. Keep generation separate from client creation, attachment sharing and mail sending. Add retained request IDs, terminal result/unknown states and cancellation receipts.

**Dependencies:** PF-02 context; Workspace canonical client binding PF-09; runtime artifact contract PF-23; billing capacity owner. A generic chat link is not closure.

**Acceptance:** Declined/cancelled generation has no client/file side effect; duplicate submit produces one proposal; changed schema/capacity/client denies apply; file is correctly typed, client-scoped and readable after reload; all unsupported formats and missing capabilities remain explicit.

Canonical source: [PF-07](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L555).

#### PF-07 · P1 frontend omission · Durable Objective associations exist in Core but have no authoring UI

**Bounded work:** Add an explicit “Link to this Objective” review and “Unlink” action distinct from Open. Support only allocated resource kinds: strategy, planner_project, planner_task, outreach_session and meeting; strategy-only cycle annotations. Capture objective version, association-set version, exact current resource snapshot, request ID and payload digest before dispatch. Use existing link and receipt operations, validate the returned digest/revisions/set version with requireOperationalAssociationReceipt, persist recovery identity across reload, and refresh the operational section after acknowledgement. Do not treat general Context Files, Directory targets or Calendar occurrences as supported durable link kinds without expanding the contract.

**Dependencies:** PF-01 ordinary deployment qualification (or separately approved preview admission), PF-24 owner mounts; correct existing-resource picker contracts. Core already owns resource locks and current authority.

**Acceptance:** Double click/reload returns same association; source moved/deleted before linking refuses; stale association set requires review; unlinked resource receipt remains historically recoverable; foreign client/kind/cycle refuses; current receiver still revalidates navigation. No unintended resource creation.

Canonical source: [PF-09](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L583).

#### PF-09 · P1 cross-owner · Work/Workspace documents are matched by mutable client name, not canonical client ID

**Bounded work:** Workspace canonical ticket owns draft schema/storage/write DTO/list/filter/saved-revision propagation of clientId, tenant/current access checks, and migration-safe backfill. Backfill only uniquely evidenced associations; ambiguous/unverified historical name rows remain held for explicit review. Portfolio reads exact clientId and stops joining by name; keep display names non-authoritative. Revalidate links on destination entry.

**Dependencies:** Workspace owner, PF-03 generated files and Outreach staging/mail owner. Do not duplicate implementation or weaken denyProspectTransfer.

**Acceptance:** Client rename preserves association; two equal names do not cross-bind; old ambiguous drafts stay unavailable; saved revision matches intended client; active grant revocation removes destination/staging access; an ordinary client-selected newsletter stages only after canonical binding is present.

Canonical source: [PF-13](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L635).

#### PF-13 · P1 reliability · Several ordinary mutations have only mounted/session uncertainty fences, not durable attributable receipts

**Bounded work:** Inventory by actual mutation and add only missing command protocols: meeting create/update/reassign; notes/debrief create/edit/approval/sharing; externally consequential calendar sync; client contact create; plain Quick Log create; file metadata/access/delete where current state is insufficient. Server accepts immutable command ID + actor/client/resource/version + payload digest, commits receipt with the mutation, exposes authenticated lookup, and handles same-key/same-payload replay versus conflict. UI stores a minimal scoped journal before dispatch and recovers the same command; never stores bearer tokens. Distinguish definitive refusal, accepted, completed, and unknown/provider-pending. Existing durable prep/ActivityCommand/prospect upload/Objective protocols should not be replaced.

**Dependencies:** Owner-specific DB transaction or provider reconciliation capability. For external actions, a DB receipt cannot falsely guarantee provider completion.

**Acceptance:** Lost response before/after commit, reload, multi-tab, session renewal, duplicate click and concurrent conflicting edit yield one intended write or an explicit unresolved outcome. Changed payload with same ID refuses; arbitrary fresh retries never recreate uncertain work; current-state match alone is labeled observation, not historical receipt.

Canonical source: [PF-14](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L649).

#### PF-14 · P2 · Directory member Quick Log supports Note only

**Bounded work:** Either keep clearly labeled Directory note-only scope, or define a canonical Directory activity command with recognized member/staff identity, event kind/time and optional explicitly authorized client/objective binding. Backend must verify canonical directory entity itself: current frontend preflight is not authorization. Reuse the ActivityCommand owner for an explicit client-bound follow-up rather than writing duplicate events independently. Add versioned receipt and durable recovery.

**Acceptance:** Note behavior stays intact; unsupported kinds cannot be disguised as note text; staff/member ID confusion refuses; client links require current client access and exact Objective version; one approved follow-up creates one linked task; no implicit client note sharing from a Directory-only action.

Canonical source: [PF-16](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L673).

#### PF-16 · P2 · Files multi-selection cannot perform an atomic batch move

**Bounded work:** Add a bounded batch-move command with sorted file IDs, exact client/folder, expected per-file revisions, destination authority and idempotency key. Server locks and validates all records then commits all or none, returning per-file revisions plus aggregate receipt. Frontend reviews hidden selected rows explicitly and submits one command, not a loop of individual PATCHes.

**Acceptance:** One denied/stale/missing file means zero moves; duplicate IDs refuse; concurrent source/destination changes conflict; uncertain replay yields same atomic receipt; selection across filters remains visible and clearable. Keep single-file workflow unchanged.

Canonical source: [PF-18](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L699).

#### PF-18 · P1 · Prospect conversion UI only links an existing client; new-client and reviewed carry-over are missing

**Bounded work:** First add a dedicated new-client conversion review using canonical intake fields, duplicate check and capacity/price implications, with command/receipt identity and explicit result type. Keep existing-client link behavior. Then separately allocate an opt-in transfer manifest for each permitted data category with immutable source IDs/revisions, target authority, conflict/merge rules, attachment ACL handling, audit and rollback/recovery. Do not implicitly copy everything or preserve inappropriate sharing.

**Dependencies:** Core BD/Clients owner, Settings billing/capacity, Workspace/files identity and mail restrictions. New client creation and transfer are separate acceptance stages.

**Acceptance:** Same conversion cannot create two clients; already converted/archived/stale prospect refuses or returns same receipt; exact client returned; capacity failure leaves prospect unchanged; existing-client link is not billed as new client; approved selected transfers have deterministic receipts and all unselected data remains prospect-scoped.

Canonical source: [PF-24](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L775).

#### PF-24 · P0/P1 shared service prerequisite · Strategy/Planner and Outreach V3 need the correct mounted runtime cohort

**Bounded work:** Shared owner publishes route-to-process-to-schema-to-worker matrix. Configure verified Strategy target and correct Engagement V3 host/routing; retain native token audience/tenant/user boundaries. Qualify V3 state first, then generation, then dispatch separately. Explicitly reconcile OUTREACH_V3_STATE_ENABLED and relevant generation/send/runtime capability flags and migrations. Core Objective local projections must agree with the actual serving V3 cohort.

**Acceptance:** Read endpoints prove current selected-resource identity under native auth; wrong app/flag returns explicit held/unavailable, never fallback to unrelated legacy route; no cross-tenant service token authority; workers/provider caps tested without live send until separately authorized. Parent/mail canonical tickets own configuration; no environment changes authorized here.

Canonical source: [WS-22](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L1742).

#### WS-22 — General document generation and agent consumers, with correct owner (P1 missing consumer / intentional AI hold)

**Bounded work:** Choose and document the existing approved execution owner for each advertised action before adding operations. For Workspace-owned intake/manual phases, reuse current state-machine/revision and run-worker APIs with typed controls and exact request recovery. For greenfield Meri actions, publish/adopt only supported public contracts; do not import private runtime types or turn on old provider handlers to make the button look wired. Add only the missing feature panels and state transitions, not a parallel agent platform. Respect capability flag and explicit paid-generation intent.

**Acceptance:** Capability off, missing credentials, wrong source IDs/current scope, duplicate intake key/payload mismatch, brief/context/outline approval pins, stale proposal, source revoked between plan/run, cancel/retry preserving successful units, unknown provider outcome and no execution merely by reading the editor. Review quality route ACL before exposing it: controller passes tenant/draft without actor to evaluator.

Canonical source: [ML-11](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2945).

#### ML-11 — Consume OAuth outcomes in Settings

**Tasks:** parse a bounded allowlisted callback result, reconcile against freshly loaded owned connection, display success/cancel/denied/admin-consent/reconnect/error states, and clear transient query parameters. Do not trust query text as a connected receipt or render unsanitized provider details. Add equivalent safe Microsoft exception-to-return handling; do not leak secrets from provider errors.

**Acceptance:** granted, denied, cancelled, missing code/state, expired/tampered state, wrong connection, provider exchange failure, admin consent only and duplicate callback. Success requires list-read confirmation; refresh does not repeat toast/action. Dependencies ML-08/12.

Canonical source: [ML-12](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2956).

#### ML-12 — Separate requested scopes, actual grants and runtime capability

**Tasks:** represent requested/granted/last-verified scope separately, classify missing read/send/calendar permissions, and provide actionable reconnect/admin-consent reasons. Extend existing capabilities with per-action configured/allowed/held reason and Microsoft push readiness. Correct generic provider metadata or deprecate unused misleading fields, without replacing provider-specific endpoints.

**Acceptance:** partial Google consent, older Microsoft token missing Mail.ReadWrite/Send, scope revoked after connection, runtime shadow, missing notification URL, valid Gmail-only sender. No optimistic “permissions granted” claim from requested list alone. Dependencies ML-01/13.

Canonical source: [ML-13](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2967).

#### ML-13 — Preserve permanent reconnect state through sync failure

**Tasks:** use typed sync/token errors and a single transition policy distinguishing transient, needs-reconnect, mailbox-not-enabled, permission-denied and disconnected. Preserve terminal/reconnect state and stop automated redemption until owner reconnects; retain safe diagnostics. Let UI retry transient sync without forcing new OAuth, but not invalid grants.

**Acceptance:** real top-level sync invocation with fake token exchange invalid_grant/consent required, not only token-service unit test. Final row remains reconnect-required, excluded from scheduler claims; reconnect restores scheduled eligibility. Dependencies ML-12/17.

Canonical source: [ML-14](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2978).

#### ML-14 — Report mail-specific partial health and backfill progress

**Tasks:** persist/return per-resource attempted/succeeded/error/lastSuccess/continuation state; distinguish connected authorization from sync health. Show partial mail failure, catch-up in progress, last complete mail sync, scope/window, auto-sync schedule and explicit safe retry. Preserve durable continuations; do not loop unboundedly in browser. Make manual reset a clearly distinct advanced action with server authority and recovery evidence.

**Acceptance:** calendar success/mail429, mail success/calendar failure, page/quota cap, failed record, expired history/delta reset, empty mailbox, deleted folder and long initial catch-up. UI never equates connection timestamp with complete mail coverage. Dependencies ML-13/16.

Canonical source: [ML-15](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L2989).

#### ML-15 — Complete Microsoft subscription lifecycle recovery

**Tasks:** invalidate/remove the exact removed subscription ID, implement provider-supported reauthorization/renewal or deliberate recreate-and-retire, serialize per-mailbox resource subscription reconciliation, and persist each resource outcome so partial creation does not leak untracked subscriptions. Expose expiry, last notification, last renewal, lifecycle failure and periodic fallback health. Preserve signed clientState matching. Reconcile missed notifications via cursor sync. Decide whether process-local notification queue plus periodic repair satisfies the product SLA; add durable queue only if required.

**Acceptance:** removed while unexpired, missed, reauthorizationRequired, one of two resources fails, duplicate callback, forged clientState, wrong subscription/tenant, concurrent scheduler/manual renewal, restart after accepted notification. Later authorized live challenge/expiry recovery test. Dependencies ML-01/10/16.

Canonical source: [ML-16](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L3000).

#### ML-16 — Bound provider calls and make sync claim lifetime match execution

**Tasks:** introduce per-call and total sync budgets into existing transports; classify send timeout as unknown, read timeout as retryable. Give each sync a durable claim token/version or equivalent serialization across manual/scheduler/webhook entry points; cursor/state commit must reject stale owners. Release/reschedule transient work safely, retain pending page state, and use bounded jitter/backoff rather than resetting all mailboxes together. Refresh/network cancellation should not advance cursors.

**Acceptance:** never-resolving fetch, process crash, lease overrun, manual+webhook+scheduler concurrency, stale state commit, multi-replica renewal, disconnect during work. Other mailboxes progress; no regression of cursor/removal state. Dependencies ML-13/15.

Canonical source: [ML-17](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L3011).

#### ML-17 — Make disconnect available and explain retained-data semantics

**Tasks:** allow owner disconnect for any existing state; offer transient retry separately from reconnect. Define retained-history policy explicitly: either retain owner/mailbox lineage independently so historical read stays authorized, or state that history disappears from mail views until a supported recovery. Never broaden to tenant-wide history access. Expose Microsoft user/admin grant-removal guidance and Google's best-effort revoke outcome honestly. Decide whether reconnect can recover prior lineage only with proof of same stable account.

**Acceptance:** error/needs_configuration disconnect, revoke failure, orphaned history, repeated delete, reconnect same/different mailbox, reader permission after deletion. Dependencies ML-08/09/13.

Canonical source: [ML-18](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L3022).

#### ML-18 — Close mail UI pagination/search/completeness and bound thread reads

**Tasks:** extend existing read contracts with stable bounded thread/message cursors, explicit hasMore and coverage/completeness; UI Load more/search/date/folder controls only within authorized scope. Reuse mail-query filtering semantics, do not build a second global inbox engine. Push thread pagination to DB while preserving active-message order and current mailbox authorization; keep assistant body continuation exact. Distinguish no matches, still importing, truncated body and unavailable body.

**Acceptance:** >50 threads, >3 messages, very large thread, deleted/reordered message between pages, stable asOf filters, incomplete backfill and removed account.
No silent “all history” claim
Dependencies ML-14/17.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [ML-26](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#L3112).

#### ML-26 — Make unsupported IMAP and consumer-provider scope truthful

**Tasks:** label IMAP/CalDAV as unsupported/external unless an actual separately owned ingestion service is identified and verified. If external, document its exact contract, owner, health signal and record attribution; don't invent a credential form for absent code. Clarify Microsoft 365 work/school scope and Gmail/Google Workspace account eligibility. Build additional providers only after an explicit product decision; leave no misleading “just configure credentials” promise.

**Acceptance:** unsupported provider registration does not claim connected/syncable; connect buttons/labels match capabilities; no accidental fallback of an unsupported provider to Graph sender. No broad new integration platform is needed for this closeout.

### M2, native harness and accepted Meri feature slices

Canonical source: [MG-02](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L819).

#### MG-02 — Preserve selected skill, scope and normalized window across every UI lifecycle path

**Bounded files:** Existing frontend composer/launcher/setup components, `shared/meri-conversations` initial-input/query/turn journals and new lifecycle adapter from MF10; existing Meri `packages/contracts` skill/window schemas, `control/conversations/skills/admission.mjs`, `worker/conversation/skills/selected-runtime.mjs` and current manifests owned by MT13. No parallel skill registry.

**Work:** Expose14 named launcher identities and exact available versions with disabled reasons until qualified. Submit stable skill ID/version plus typed scope/window, not just expanded prompt text. Server resolves entity and exact timestamps/timezone/week/FY/version, pins immutable manifest and returns displayable normalized receipt. Preserve receipt through reload/reconnect/steer/resume/fork or require an explicit reviewed version/goal change; do not silently pick latest. Handle selected client versus named other subject, mixed/portfolio domains, chosen dates conflicting with text, unavailable sources and current grant loss. Ordinary free chat must not become a comprehensive skill by keyword.

**Acceptance:** Every14skill workflow tests exact identity/window at submit, steering, lost-response recovery, reload, reconnect, resume and fork; mismatched manifest/hash/version rejected; source families cannot be dropped by memory keyword or single-family routing. DST/week/FY/version edge fixtures pass100%; prompts remain draft until explicit send; no capability widening. MT13 owns installed runtime and MM15 owns output, not this consumer.

Canonical source: [MG-05](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L848).

#### MG-05 — Deliver automatic canonical client context to ordinary chat

**Bounded owner/files:** Current Core canonical client/profile/engagement read owner and its existing authorized adapter; Meri current conversation input/context assembly and selected/native read path; no imported old Context Plane, recursive public-tool call or new profile store. Reuse current schema/receipt provenance and caches only if actor+tenant+client+relevant revision keyed. MT provides exact canonical reader paths; MM01/17 preserve memory/provenance.

**Work:** Assemble a compact, task-appropriate authorized context packet before ordinary model work: identity/exact identifiers; capabilities/mission; objectives/active matters; constraints/exclusions; footprint/people; open commitments and critical approved decisions/corrections. Proposed2–4Ktoken budget is a measured start, not an immutable cap or mandatory full history fetch. Include source IDs/revisions/as-of/count-or-sample semantics and explicit gaps. Resolve selected versus explicit other client/portfolio/external subject server-side; do not let selection hijack the user's question. Separate canonical facts, approved shared memory, user preferences and ephemeral conversation. Current instruction overrides stylistic defaults, not source truth.

**Acceptance:** Rich/sparse profiles, paraphrases, selected-client switch, explicit other subject, same-name ambiguity, approved correction in new thread and denied wall sections. Critical seeded identity/constraints/corrections are correct or clearly conflicted/unavailable; six profile sections available without model choosing a tool. Source/permission changes invalidate context before release. Measure actual token/call/latency effect; no full database dump or stale-client leak. Links to MF19 context handoff and MG01 corpus, not a replacement for them.

Canonical source: [MG-06](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L859).

#### MG-06 — Make source indexing freshness revision-durable and visible

**Bounded work:** Existing Core document/KB indexer, Postgres/pgvector rows and durable job/outbox owner; existing Meri evidence freshness envelope; small UI/source-read status consumer. Inspect exact save→index intent→worker→searchable receipt ownership; repair only missing durable seams. Persist source revision-bound intent, retry/failure/searchable status; idempotent update/delete/reassign/revoke, monotonic version guard preventing old retry overwrite. Primary authoritative save remains successful while index pending; profiles/approved memory remain current via canonical reads. Restricted/private documents remain excluded from broader shared indexing and are read by exact authorized paths.

**Dependencies:** MO14 source-change invalidation/refresh/feedback, MM12/13 extraction/custody, MT16 result semantics, MG05 canonical context. This is the underlying index-intent/freshness subtask, not a second MO14 event pipeline or new vector database. **Acceptance:** Crash/restart/temporary failure/retry, source delete/reassign/revoke, stale retry and extraction backlog show correct visible state; old indexed content cannot reappear after revoke. Proposed ordinary-supported-document searchablep95≤5min measured before SLA commitment; failed/excluded sources have explicit status. Answer cannot claim source absence because index is pending, nor wait indefinitely for irrelevant connectors. Unknown current source implementation is resolved by bounded owner discovery first.

Canonical source: [MF-03](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2295).

#### MF-03 — Clear approval content on authority refusal (P0 before approvals activation)

- **Bounded files/owner:** `conversation/intents/useIntentList.ts`, `useConversationIntents.ts`, `shared/meri-intents/access.ts`, relevant host lifetime boundary; new unit/browser regressions.
- **Implementation:** Classify published authority denials separately from transient unavailable errors. On ACCESS_DENIED/MEMBERSHIP_REVOKED/MEMBERSHIP_CHANGED or expired/revoked session as contract requires, clear sensitive rows, pending confirmation details and related derived caches; signal parent to retire exact session where appropriate. Preserve harmless pagination continuity only for retryable transport/service outages, visibly explain the distinction. Ignore stale completion from prior identity.
- **Dependencies / exclusions:** Use current intents error vocabulary; no blanket error suppression, no local authorization inference, no new backend grants.
- **Acceptance:** Load first page, revoke access, Load More → zero old proposal content/actions; same for refresh/decision denial and identity switch. Transient page failure keeps admitted rows only under still-valid authority and exposes retry. Out-of-order successful old reply cannot restore data.

Canonical source: [MF-04](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2304).

#### MF-04 — Make approval decisions reload-safe and expiry-aware (P1 before approvals activation)

- **Bounded files/owner:** `useConversationIntents.ts`, `intent-view.ts`, `ConversationIntents.tsx`; bounded per-tab decision journal helper and tests.
- **Implementation:** Before dispatch, synchronously retain an immutable non-secret decision identity: tenant/actor/client/conversation, delivery/proposal/hash/choice and attempt phase/version. Restore pending as unknown, reconcile durable list first, permit only exact same decision request while unresolved. Handle blocked storage explicitly or use an approved durable recovery owner; do not silently claim reload safety. Clear resolved markers only after correlated durable evidence. Recompute expiry at deadline/visibility return and after each refresh.
- **Dependencies / exclusions:** Published list/decide idempotency remains server authority. Retention/privacy decision for journal; no credential or full sensitive proposal persistence. MR/MT receipt semantics if list cannot resolve a state.
- **Acceptance:** Reload/unmount immediately after dispatch, dropped response, two tabs, expired proposal, changed hash/reviewer and storage failure cannot produce a contradictory replacement decision or false success. Exact replay is accepted once by backend; settled receipt clears journal; expiry disables action without relying on another click.

Canonical source: [MF-05](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2313).

#### MF-05 — Resume run observation after approval or external state change (P1)

- **Bounded files/owner:** `ConversationPanels.tsx`, `useConversationIntents.ts`, `useLiveRun.ts`, `useRunObservation.ts`, `conversation-view.ts`, `RunStatus.tsx`.
- **Implementation:** Expose a narrow decision-settled/status-may-have-changed callback that requests authoritative run history then resumes event observation only if current status warrants. Add explicit Refresh run status for paused/waiting/unknown; bounded visibility/focus refresh or server event mechanism for external approver. Separate terminal from temporarily quiescent state. Do not resubmit prompt, infer resumed status, or repeatedly poll an expired session.
- **Dependencies / exclusions:** Runtime lifecycle/approval continuation gates and fresh target-session requirements; MF-02/03/04.
- **Acceptance:** Approve same tab and another reviewer tab: current run eventually shows real resumed/completed/refused state without navigation or token renewal. No duplicated submit/decision; denied refresh clears stale data; paused remains paused until authority says otherwise; no busy infinite loop.

Canonical source: [MF-09](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2349).

#### MF-09 — Add conversation management only after its public contract (P1 core history; P2 optional destructive actions)

`ConversationRecents`, history/management screens and ordinary routes.
Backend conversation owner owns schema/mutations.
- **Implementation:** Decide title ownership/autotitle versus user title; search scope/index; archive versus retention deletion; recovery/trash and active-run semantics. Publish owner-scoped paginated searchable summary and revision/idempotency-protected mutations. Then mount real history/search/palette and management actions with loading/empty/denied/error/uncertain/reload states. Preserve conversation/client/run routing and clear removed records from all lists.
- **Dependencies / exclusions:** MR/backend owner contract; ST-18 deletion/retention; PF/ST28 context. Do not use fixture state as durable truth or relabel archive as deletion.
- **Acceptance:** Rename/archive/restore survives reload and another tab; search/filter/pagination respects wall/client/actor; conflicting revision safely refreshes; delete requires chosen recovery semantics and explicit confirmation, active run policy enforced server-side, uncertainty reconciles same request.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MF-11](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2368).

#### MF-11 — Build run index/detail from durable read contracts (P1 if Runs is promised; otherwise P2)

- **Bounded files/owner:** Backend public run-summary owner first; frontend `screens/runs/*` adapted into live `runs/` views, new route and scoped query keys; Sidebar destinations.
- **Implementation:** Define run index scope, filters, status freshness, sorting/paging, source conversation/client, cleanup/continuation and durable usage references. Implement read-only list/detail before mutation controls; link to exact conversation/run/checkpoint/artifacts; handle unavailable/forbidden/retained/deleted states. Feed lifecycle actions through MF-10 and Stop through existing cancel.
- **Dependencies / exclusions:** MR read owner, ST-15 usage/limits, MF-10. Do not synthesize complete run inventory by collecting only currently loaded conversation pages.
- **Acceptance:** New tab/reload yields same authorized index and durable details; pagination does not duplicate/skip; revoked/archived client hidden; status timestamp displayed and stale/unknown separated; each deep link revalidates scope.

Canonical source: [MF-12](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2377).

#### MF-12 — Close legacy action/task-command approval and recovery handoffs (P1)

- **Bounded files/owner:** `actions/MeriActionWorkflow.tsx`, `action-workflow-state.ts`, `ProposalPanel.tsx`; task-updates form/state/proposal; adapters/journals only where readback needed; canonical task route helper.
- **Implementation:** Preserve exact reviewed draft/command/hash and attempt identity through navigation/reconnect. Link to correct trusted approval surface where public contract supports it; otherwise give explicit waiting/review owner without fake approve. Add same-request check-recorded-result after unknown, not fresh execute. Link observed task receipt to canonical Workspace task; add authorized task selector/context handoff if schema permits. Distinguish omitted field from clear-date operation and add reset/new workflow only after terminal reconciliation.
- **Dependencies / exclusions:** MT same-owner task.create and task.update grant/executor qualification; WS task detail; MF-03/04 shared decision safety. Mail actions remain ML-05/06, not this task.
- **Acceptance:** Pending approval never executes on UI click alone; reload/drop response cannot create second task/update; identity/client change hides receipt; completed receipt deep-links exact canonical task; unsupported field clearing is disabled or correctly typed, not silently ignored.

Canonical source: [MF-13](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2386).

#### MF-13 — Create a real approval inbox without broadening authority (P1 if promised; otherwise P2)

- **Bounded files/owner:** New inbox public read contract owner; `approvals/` live route/views + shared query scope; conversation intents reused, not copied authorization logic.
- **Implementation:** Define actor-assigned versus administrator views and counts, pagination/filtering, archived conversation reachability, changed/expired/rejected/completed/unknown receipts. Deep-link exact source conversation/proposal; reuse current typed decision consumer. Expose only public allowed actions and present unsupported memory/file/schedule rows read-only with correct next owner. Add external reviewer refresh and notification links.
- **Dependencies / exclusions:** MT/MR/MM operation authority and ST-07–11 governance/notifications; MF-03/04/05. No client-side widening of approvableActions or “approve all.”
- **Acceptance:** Inbox count matches durable scoped list; another reviewer decision invalidates stale controls; proposal hash/approver changes stop dispatch; unsupported kinds cannot accidentally route to task.create; deep link revalidates current wall and session.

Canonical source: [MF-14](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2395).

#### MF-14 — Finish artifact library/detail consumers under WS-23/24 (P1)

- **Bounded files/owner:** Canonical WS-23/24 files plus `ConversationArtifacts.tsx`, `files/DocumentVersionPanel.tsx`, `MeriFilesWorkflow.tsx`, new read-only file detail/library views and route helpers. MM owns backend render/custody contracts.
- **Implementation:** Do not reimplement merged PR115 document-access0.1.0; qualify the received reader, then build authorized durable list/version index and deep links with typed source/provenance/status. Render only supported safe preview results; preserve signed-link redemption/hash validation, revoke object URLs and clear bytes on lifetime change. Add compare/revision/history UI only with exact-version contract. Keep edit/share/comments/rename/delete disabled until canonical owners provide semantics; do not fake save via local state.
- **Dependencies / exclusions:** WS-23 received-reader qualification, WS-24 file workspace, MM renderer/PDF/PPTX/ZIP/filing custody, MR writer authority. This ticket is consumer slice, not new duplicate file service.
- **Acceptance:** All six formats correctly discriminate supported preview/download/unsupported; exact bytes/hash checked; link expiry/revocation/cross-client substitution fail closed. Reload/another tab sees durable versions, not local10 list; missing renderer never claims native preview or successful edit.

Canonical source: [MF-15](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2404).

#### MF-15 — Wire attachments and governed filing only after custody contract (P1 if composer attachments promised)

- **Bounded files/owner:** `MeriComposer.tsx`, new `conversation/attachments/*`, existing file picker/extraction/filing views adapted narrowly
- **Implementation:** Implement real upload selection and bounded transport only through MM owner: size/MIME/signature limits, scan/extraction status, signed scoped attachment reference, admission to exact conversation input, cancellation semantics, duplicates/expiry and retry/reconcile. Capiro files must come from authorized canonical selector. Filing must create reviewed intent and consume receipt, never copy between clients on local click. Preserve text draft if upload fails.
- **Dependencies / exclusions:** MM upload/read_chat_attachments/filing custody, WS-24; public input schema must admit refs. No base64 prompt workaround or arbitrary URL fetch.
- **Acceptance:** Partial/oversized/unsafe/expired/cross-tenant file rejected; reload restores only durable admissible uploads; submit cannot attach pending/foreign refs; remove/cancel has defined durability; filing awaits proper approval and receipt links canonical file.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MF-17](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2422).

#### MF-17 — Receive memory and preferences through existing canonical projects (P1/P2, coordination only)

- **Bounded files/owner:** PR115 memory route/home links and public packet receiver; `MeriPreferencesPanel`, `UserPreferencesHost/Form`; only scoped navigation/lifetime integration here.
- **Implementation:** PR115 source reception is complete. Attach Meri acceptance to ST-11 owner-memory source-packet release; verify exact microsecond revision token and activeItemUnchanged correction semantics from Core/MM. Do not enable null source. For ST-12 apply saved theme/density/timezone deliberately at agreed app boundary after reload. Route remaining preferences to canonical ST13–19 delivery or explicitly unsupported copy, including fake feedback receipt correction.
- **Dependencies / exclusions:** ST-07–11 governance/files/grants/notifications, ST-12–19 settings, MM. No second memory schema/governance center or settings backlog.
- **Acceptance:** Owner memory view only shows current authorized own/wall/governance-eligible items, denied items vanish, changed token conflict reloads without overwriting; preferences persist and intended consumers actually change; notifications/privacy/connectors/help never show false save/send outcomes.

Canonical source: [MF-18](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2431).

#### MF-18 — Decide and implement workflows, routines and browser holders (P2 or explicit launch gate)

- **Bounded files/owner:** Only selected `screens/workflows/*`, `screens/browser/*`, `screens/routines/*` adapted into live routes/controllers after product decision; capability registry and sidebar.
- **Implementation:** Produce supported template/action inventory from real MT tool registry and MR runtime capability; choose which designed launchers to ship versus retire. Templates create permission-preserving typed requests with explicit scope and confirmation; do not claim connector authorization. Routine management uses durable owner-scoped schedule reads/mutations and correct timezone/next-fire/history. Browser operations require bounded authorized session/handoff/download receipts and honest manual sign-in holds. Keep unsupported choices disabled with reason.
- **Dependencies / exclusions:** MR routine standalone-owner gate, schedule firing/delivery and browser runtime; MT tool capability/read scopes; MM download custody; ST-14 connectors/ST-16 skills. Do not mount live screens solely because a private backend function exists.
- **Acceptance:** Each shipped launcher maps one-to-one to public allowed operation and durable receipt. Routine edit/pause/cancel survives completed source chat and reload after owner fix; timezone/DST and missed fire shown. Browser stop/sign-in/permission controls invoke only correct owner and cannot expand credentials silently. Unselected designs clearly remain examples.

Canonical source: [MF-19](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2440).

#### MF-19 — Unify cross-module context and completion links (P1/P2, shared contract)

- **Bounded files/owner:** One canonical context DTO/route helper owned with PF-02/03, WS-22–24, ST-28 and ML-06; Meri entry parser, composer starter and receipt link components.
- **Implementation:** Carry only canonical IDs and user-approved draft/context through links or validated bootstrap; re-read source under current identity, show selected client/object/evidence and permit explicit scope correction. Preserve exact mail sender/thread/connection via ML contract, not a freeform prompt. Link completed task/file/research results to original canonical object. Back/forward/client switch must retire stale pending context and not resubmit.
- **Dependencies / exclusions:** PF-02/03, WS22–24/tasks, ST-28, ML05/06 and relevant MM/MT contracts. Do not duplicate those projects or embed sensitive source text in URLs.
- **Acceptance:** Portfolio client→Meri→task/file→canonical detail roundtrip survives reload; invalid/foreign/stale IDs fail closed; mail actions retain exact reviewed connection/thread; new client selection cannot dispatch prior client proposal; no auto-send merely by opening a deep link.

Canonical source: [MR-03](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2674).

#### MR-03 · P1 · Define and wire foreground routine management after the originating chat ends

**Bounded work**
1.
2.
Decide the supported contract explicitly.
Any ability to create/widen execution still requires the reviewed template/budget/current policy plus explicit approval.
3. Split only the management context facets in `routines-owner-composition.mjs`, `routines.mjs`, `schedules/runtime-context.mjs` and `schedules/application.mjs`; retain the native firing grant and per-occurrence admission owners. Never allow body-provided run/client/template selectors to establish authority.
4. If independent management is intentionally unsupported in the initial product, expose that exact held capability and an actionable authorized recovery route; do not require the user to start paid model work merely to stop a routine.

**Dependencies:** FE routine integration, Core current membership/owner checks, MR-01 for old original cleanup. Existing product-routines-flow tests exercise scripted authority and injected owners, not a live no-active-chat case. [apps/runtime/test/product-routines-flow.test.mjs:22–44](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/test/product-routines-flow.test.mjs#L22-L44)
**Acceptance:** a schedule remains manageable under its owner after chat completion/restart; stale/foreign generation and unauthorized widening are refused; routine “future firings stopped” and “current work physically retired” remain separate states.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MR-04](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2691).

#### MR-04 · P1 · Make routine read-consent receipt repair durable across dual-owner ACK loss

**Bounded work:** persist a narrowly scoped consent-transition intent/reference with the immutable schedule intent before dispatch; after ACK or reconciliation, repair only the same known consent and generation. Read back Core's current consent when outcome is uncertain; if no exact readback/idempotency contract exists, add that bounded owner protocol first. Do not mint a replacement widening consent during blind replay. Persist narrowing/abandon debt and its proven disposition rather than relying solely on logs. Expose “routine active, read consent unresolved/expired” distinctly from successful unattended reads.

**Files:** `read-consent-lifecycle.mjs`, `application.mjs`, `intent-reconciliation.mjs`, `postgres-schedule-owner.mjs` and a minimal additive migration if no existing durable slot suffices; corresponding routine-consents/Core wire adapter only for exact readback. The existing log events remain observability, not authority.
**Tests:** consent created then schedule NOT_DISPATCHED; schedule ACK then local record failure/crash; withheld ACK; ambiguous schedule effect; failed pause/delete narrowing; replay after restart; consent expiry and live-login renewal; changed projection; concurrent generation; foreign consent substitution. No automatic consent widening or duplicate schedule creation.
**Acceptance:** replay/reconciliation can restore the exact acknowledged consent receipt without redispatching a schedule or granting new scope; otherwise uncertainty remains visible and firing/reads stay closed.

Canonical source: [MR-05](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2706).

#### MR-05 · P1 · Compose complete retention suppression, purge and restore ownership

**Bounded work**
1. Define the approved suppression/release/purge policy and actor authority; map product “archive/hide/delete” semantics separately. No deletion enabled by this plan.
2. Bind durable authoritative ledger, watermark, ownership, cancellation and storage/row/facts/key ports through existing startup. Prove every product read, signed download, stream, checkpoint restore and unattended occurrence observes suppression before release; cleanup Stop must remain available without content release.
3. Inventory all data classes from the single registry. Memory/artifact work owns external proposal deletion, upload custody and tombstones. Runtime owns native journals, events, SDK mirrors, completion/next-run rows and identifier-only financial evidence. Schedules currently use an unsupported retention subject and need an explicit separate cancellation/retention decision, not accidental inclusion under a conversation purge. [apps/control/retention/data-classes.mjs:21–38](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/retention/data-classes.mjs#L21-L38)
4.
Never purge proof needed to distinguish allocated/foreclosed/retired.
5. Restore behind the serving fence: restore authoritative ledger separately from stale projections, replay suppressions and in-progress purge records, verify object/version absence and row state, recover exact watermark, then permit serving. Parent owns backup deployment/runbook and migration gate; this ticket owns semantic prerequisites and acceptance.

**Acceptance:** suppression immediately blocks all content surfaces and new work while allowing authorized cleanup
a stale backup cannot resurrect suppressed content
Destructive execution requires a later authorized rollout and real owner ports.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MR-06](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2723).

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2723` through line 2724. MR-06 current ticket and override.

#### MR-06 · P1 · Close durable lifecycle outcome readback and recovery after process/request loss
> **[RE-SCOPED 2026-10-23]** Behaviour stays: durable outcome readback and recovery after process or request loss. Temporal plus the conversation DB are the durable record; there are no prepared-run registries. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2731`. MR-06 retained work; old source-session/current-authority-route implementation and completion-journal/session-owner file instructions omitted under register:49. Use current Temporal/conversation DB/native SDK owners.

Reconcile only from existing authoritative proof; an unobserved SDK message remains UNKNOWN. Do not infer APPLIED from a final assistant answer, transcript text, timeout or process death. Define owner/operator escalation for irreducible UNKNOWN without clearing the barrier.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2734` through line 2734. MR-06 retained durable outcome acceptance, including expired/foreign-selector denial.

**Acceptance:** ACK-loss receipt recovery never resends SDK input, reallocates a target, replays mutation or captures another checkpoint. Expired/foreign source selectors cannot release content. The user can distinguish pending, applied, unknown, source-retirement pending and result-not-released.

Canonical source: [MR-08](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2754).

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2754` through line 2756. MR-08 current controlling ticket scope. The old minimum-crossing body is excluded where it mixes kickoff claims, grants, native currentness or terminal usage-capture mechanisms; retained crossings are stated in the override and E rows below.

#### MR-08 · P1 · Qualify the complete admission-to-next-turn lifecycle, not only happy-path endpoints
> **[RE-SCOPED 2026-10-23]** Keep the behavioural crossings (duplicate submit, ACK loss, Stop repeated, stream reconnect with cursor, next turn after a failed or cancelled turn, deploy between turns, pause/resume/fork). Drop crossings that exist only for kickoff claim/lease, allocation and grants, native currentness or terminal usage capture. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.
**Class:** Q. **Owner:** runtime supplies the semantic cases; release coordinator owns integrated test/release execution.

Canonical source: [MR-10](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L2792).

#### MR-10 · P1 · Qualify routine firing, overlap, cancellation and inbox continuity as one lifecycle

**Bounded acceptance suite**
- Approve under live consent; fire without an attended browser; fail safely when consent expires, membership changes, policy revokes, schedule pauses/deletes, or Core does not answer. No attended-token fallback.
- Re-deliver one firing/restart schedule worker and control at each point: immutable occurrence claim, admission, Temporal start ACK, first output, terminal, retirement and overlap release. Exactly one conversation/run/request/event identity.
- A paused/resumable occurrence still occupies overlap; fork is independent work and must not accidentally release or inherit the occurrence slot. Unknown dispatch and unknown stop preserve the slot.
- Future-only pause/delete never claims current work stopped. Explicit current-work cancellation uses exact approved lineage and proves each original retired; concurrent resume or changed lineage cannot widen the approved selection.
- Result reaches the existing history/inbox with original-owner currentness, including partial output and late completion; foreign/archived/revoked access is withheld. Test list/transcript pagination and pool concurrency together, not only direct origin lookup.
- Reconcile after a wrapper's timeout or worker shutdown; no new firing replaces unresolved work. Old-image occurrence cleanup exercises MR-01.
- Confirm exact control/schedule-worker workflow target, grants, native operations, schema and deployment image. These are release inputs, not values to invent here.

**Files:** existing scheduled-dispatch/job/lineage/read-consent/currentness tests plus runtime product-routines-flow tests, not new duplicate scheduler. Parent owns service deployment and actual Temporal/ECS qualification. tools/domain owner owns conversational schedule preparation/list-tool bridge, not this firing lifecycle.

Canonical source: [MT-01](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3189).

#### MT-01 · Make the exact installed capability set the release truth (P0, CONFIG/QUAL)
> **[RE-SCOPED 2026-10-23]** The tool list a user's run can call, served by the tool gateway, is the release truth. SDK tool discovery runs directly against Bedrock; there is no "measured installation" or "pinned proxy" discovery path. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded change and owner.** Keep packages/contracts/retrieval-0.2/catalog.json and catalog-validation.mjs authoritative.
In existing apps/worker/conversation/reads/{families,availability,schema,tools,runtime}.mjs, apps/gateway/catalog/runtime-catalog.mjs and runtime reads composer paths, add a generated exact installation report and negative parity test for every named row.
A disabled/held operation must be absent from discovery or honestly refused before dispatch
never relax authority to satisfy parity.

**Dependencies.** Runtime source/activation gates; Core Option B/current-client wall; exact source hashes; MF capability/disabled-state UI. ST-26 configuration/worker qualification remains canonical.

Unauthorized calls must perform zero source requests.
Publish source receipt separately from later exact-image/live qualification
do not mark any live gate passed from this audit.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MT-04](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3231).

#### MT-04 · Admit research-source candidates without broadening source visibility (P1)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded change and owner.** Reconcile apps/gateway/sources/research-legal-candidates/{handler,request-context,http-adapter}.mjs and family registration. Extend Core auth/read-delegation contract/service and current Meri native-read receiver only after documenting exact per-branch authorization and client/actor source context. Reuse MeriToolsService.searchResearchSources and canonical directory/Engagement/memory readers, adding bounded filtering where required rather than rebuilding search or returning unfiltered notes. Pin independent branch limits and output provenance.

**Dependencies.** MT-01/02; Core canonical directory permissions; ML-22 for mail candidate source meaning; MM source lineage. Existing PF-09 canonical client ID and client document authority apply.

**Acceptance / tests.** Selected client vs another client, own vs other-user meeting/mail/Meri note, authorized vs unauthorized directory note, tenant boundary, stale source access, query lengths and every branch cap. Test each branch empty/unavailable/partial independently, combined-source incompleteness, no silent tenant-wide fallback, exact source IDs and refusal on undelegated calls. Core104 cleanup must not be mistaken for delegation enablement.

Canonical source: [MT-05](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3245).

#### MT-05 · Bind BD evidence to real conversation and prospect custody (P1)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded change and owner.** Use the #197 apps/gateway/sources/business-development handler and existing request-context boundary. Bind the existing native conversation/prospect association owner through control selection/claims and Core read-delegation service, preserving owned/unarchived conversation, authorized prospect and linked-client equality. Add only reviewed evidence read admission. Do not create prospects, attach clients, mutate conversation associations or trigger research enrichment as a side effect of evidence lookup.

**Dependencies.** MT-01/02; PF-17 unsupported prospect mutations; native conversation identity/custody owner and MM evidence-lineage semantics.

**Acceptance / tests.** Wrong native conversation, unrelated prospect, linked client mismatch, archived/deleted conversation, changed mapping between awaits, missing source revision, unscoped claim, evidence not ready and source refusal vs valid empty. Confirm signed-only transport, zero calls under failed custody and no write/provider enrichment. Explain unavailable evidence rather than producing unsupported prospect facts.

Canonical source: [MT-06](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3259).

#### MT-06 · Connect the existing FedRAMP observation producer (P1)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded change and owner.** Add bounded apps/gateway/sources/certification-status adapter/request-context/family using the existing contract and native-source pattern
Extend the existing Core read-delegation admission and private funding-read-observation path for reviewed target/context.
Keep getCertificationStatus, dataset fetch and exact-ID precedence unchanged unless tests show an actual mismatch.

**Dependencies.** MT-01; reviewed Core delegation admission and exact target/body-bound normalization context; no producer rewrite or fallback to model-supplied observations.

**Acceptance / tests.** Canonical supported locale, locale-sensitive strings, exact product ID precedence, ambiguous capped matches, full fetched dataset evidenceOfAbsence, unavailable fetch, source revision and input projection. Reject missing/unsupported/mismatched locale context before calling producer; verify actual comparisons use the observed locale. Candidate cap10 must not mean only10 source rows searched.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MT-07](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3273).

#### MT-07 · Connect existing rule stage and comment clocks (P1)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded change and owner.** Implement only the missing bounded rule-status source adapter/context/family and registration. Admit the exact read and observed clock tuple through existing Core private read-observation/delegation boundaries. Preserve exact-ID/state behavior, title+abstract matching and the canonical shared lifecycle helper.

**Dependencies.** MT-01; reviewed Core delegation admission and exact target/body-bound normalization context; no producer rewrite or fallback to model-supplied observations.

**Acceptance / tests.** Federal exact ID, state exact ID with wrong state, ambiguous keyword candidates, no query, invalid state/date; independently cross stage and public-comment deadlines to prove the two clocks are not conflated. Revoke/change context during await; reject model clocks or unsupported stage values. Missing/ambiguous source must remain distinct from a definitive legal-status conclusion.

Canonical source: [MT-08](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3287).

#### MT-08 · Connect existing SAM generation, status and health observations (P1)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded change and owner.** Add the SAM source adapter/context/family and discovery with existing schema limits. Extend only reviewed Core read-delegation/private observation admission. Preserve ProgramElement and OpportunityTools ownership and currentMeriSamProducerContext recheck; never substitute a new clock at formatting time or claim a successful local query proves current SAM coverage.

**Dependencies.** MT-01; reviewed Core delegation admission and exact target/body-bound normalization context; no producer rewrite or fallback to model-supplied observations.

**Acceptance / tests.** query≤240, naics≤12, limit1–50/default20, includeInactive; healthy/degraded/unknown source, never synced, missing health, 48-hour stale boundary, independently varied three clocks, mode changes during either await, abort/late response and partial results. Assert exact sourceStatus/sourceReason and evidenceAccuracyMode, not green health inferred from nonempty rows.

Canonical source: [MT-09](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3301).

#### MT-09 · Keep legal, news and Outreach claims inside reviewed slices (P1 parity; P2 expansion decision)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded change and owner.** Receive reviewed discovery through MT-02. In existing request-context modules, tool descriptions, selected manifest requirements and result status, make unsupported branches explicit. Only if a launch promise requires citation parsing, implicit-year/window news or outreach detail, add one narrowly versioned producer/context slice and its qualification, not an arbitrary legacy passthrough. Reconcile current Core104 owner corrections without undoing conservative Meri restrictions.

**Dependencies.** PF-24 canonical Outreach runtime cohort; current Core104 adoption decision; legal/news source owner, MT-01/02. No legal advice/product promise inferred from a source-read tool.

**Acceptance / tests.** Every admitted enum and exact ID, legal edition/reference mismatch, ambiguous citation, news folder without client, missing year, partial source cutoff, Outreach explicit client plus any outreachId field including empty. Assert unsupported semantics are UNAVAILABLE before source, not empty result. Test changed client visibility before/after canonical Outreach source.

Canonical source: [MT-10](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3315).

#### MT-10 · Qualify the existing task.create approval and effect chain (P1, CONFIG/QUAL)
> **[RE-SCOPED 2026-10-23]** Approval, durable receipt and no blind redispatch stay. Approvals go through the SDK permission callback plus Core intents; no per-operation grant minting. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded change and owner.** Keep apps/runtime/native-authority/execution-composition.mjs, apps/control/intents/{mount,approval,http}.mjs and current Core exact task-create receiver as owners. Add route-level integration tests through actual CLI composition; correct misleading comments as a bounded documentation task. Wire current FE recovery through MF and present draft/approval/dispatch/unknown/confirmed receipt distinctly. Persist/reconcile the same original command identity, never manufacture a second proposal to recover a lost response.

**Dependencies.** MT-01; Core exact command receipt/approval issuance and durable storage; MF pending-decision recovery and rendering; Portfolio task grants.

**Acceptance / tests.** Approve/reject exact hash, wrong approver, expiry, changed rights, simultaneous same/opposite decisions, predispatch crash, post-Core-effect lost response, late release refusal, duplicate delivery, restart reconciliation, cross-run replay denied. Prove one business task and one canonical effect receipt for accepted retries, and zero task writes for rejected or NOT_DISPATCHED states. Source-enabled/owner flags are qualifications, not evidence of live execution.

Canonical source: [MT-11](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3329).

#### MT-11 · Supply the missing task.update execution owner (P1)
> **[RE-SCOPED 2026-10-23]** Approval, durable receipt and no blind redispatch stay. Approvals go through the SDK permission callback plus Core intents; no per-operation grant minting. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded change and owner.** Implement the existing Core trusted servicesFor/authorizeExecution seam and exact task.update grant/issuance/receiver/receipt, then compose createTasksFamilyWith({grant}) in existing product ports. Extend approval action admission only with exact task-update metadata/source version and supported field contract. Reuse current task owner, approval store and command journal; do not create a second CRUD path or generic approved-command executor.

**Dependencies.** MT-10 durable command semantics; current Core task/Portfolio permissions and concurrency policy; MF task-update approval consumer/recovery. Requested fields outside the existing command schema require an explicit later contract decision.

**Acceptance / tests.** Each admitted field and combination, stale expected task version/CAS, wrong client/assignee/task, permission loss between prepare/decide/execute, immutable approval hash, no-op semantics, cancellation, post-write unknown and exact reconciliation after restart. Unsupported field or foreign task fails before write. One accepted effect is provable; never infer completion from prepare or approval.

Canonical source: [MT-12](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3343).

#### MT-12 · Bridge conversation schedule proposals and schedule-list reads (P1)
> **[RE-SCOPED 2026-10-23]** Approval, durable receipt and no blind redispatch stay. Approvals go through the SDK permission callback plus Core intents; no per-operation grant minting. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded change and owner.** Use existing control/intents schedule preparer, routines product ports/application and schedule journals. Add a reviewed schedule action approval adapter with current consent/stop/read authority and exact immutable command binding; mount only supported preparers. Give list_scheduled_tasks a bounded canonical routines read adapter and supported exact schedule-schema loader, or a documented product-owned inspection surface, not the legacy Core scheduler. Keep schedule preview/preparation distinct from committed schedule and occurrence execution.

**Dependencies.** Runtime owner handles scheduler deployment/firing/Temporal/lease/stop/notification lifecycle; MF schedule UI; ST-17 notifications/ST-24 lifecycle. MT-01/10 recovery semantics; MM retained deliverables for scheduled output.

**Acceptance / tests.** Create/list/update/cancel same actor/tenant scope; time zone/DST/cron/window limits; changed consent/stop state before commit; schedule revision conflict; duplicate and unknown decision; list pagination/currentness; update/cancel vs firing race; no unintended external communication. Conversational workflow must land on the same schedule/run/inbox lineage the product views inspect. Approval does not imply occurrence delivered.

Canonical source: [MT-13](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3357).

#### MT-13 · Complete all fourteen original skills through exact installed workflows (P1 full-completion requirement)

**Bounded change and owner.** Preserve all14 original launcher identities and complete each workflow.
Stage a smaller launch cohort only as an intermediate milestone, not full completion.
Keep explicit manifest/prose/catalog hashes and no latest fallback.
While an individual workflow remains unqualified, disable its runnable claim honestly and keep its full-completion work open
do not remove its original scope.

**Dependencies.** MT-01–09 as applicable; MM selected-output/compiler/approval/retention closure; ST-16 starters; PF-03/PF-24 selected business workflows. Artifact generation must not be confused with successful external action.

**Acceptance / tests.** All15 asset entries across14 skill IDs resolve exact version and hashes.
Test manifest operations unavailable, source partial/empty, changed authority, conflicting skill selection and unselected tool discovery.
Two current selected paths remain regression green without widening to every private recipe.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MT-14](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3370).

#### MT-14 · Keep workspace, subagent, Bash and browser boundaries honest (P0 boundary QA; P2 browser activation)

**Bounded change and owner.** No new execution architecture. Add capability inventory assertions in existing capabilities/{policy,workspace-tools,subagents,bash-sandbox}.mjs and browser/{activation,policy,server}.mjs; align tool descriptions and UI to actual policy. Reuse runtime worker sandbox/browser activation ticket for host qualification. Any browser enablement requires the existing reviewed origin/site/approval/session owner, not flipping a hold constant alone. Persistent coworker/background work remains an explicit product decision.

**Dependencies.** Runtime exact-image sandbox/egress/credential/approval qualification; MF truthful optional-capability UI; MM workspace-file vs retained-artifact distinction; ST-15 quotas/queues.

**Acceptance / tests.** Denied traversal/symlink/out-of-root file, no sandbox fallback, denied network without exact approval, revoked approval mid-call, no browser server while held, unsupported dialog/file upload/eval denied, no inherited unbounded Agent or Bash in subagents, foreground-only enforcement and concurrency/turn limits. Native web source reads remain separate from browser.

Canonical source: [MT-16](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3396).

#### MT-16 · Close parameter, page, time and result-semantic parity (P1 cross-family regression receipt)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded change and owner.** Generate parameter/result tests from catalog-validation bindings and extend each existing apps/gateway/families and sources family test owner. Compare omitted vs explicit/default inputs, exact body/query projection, enum/numeric/date clamps, per-source limits and result semantic validators against current Core native routes. Add only localized corrections for demonstrated mismatches; do not centralize away family-specific provenance. Keep tools-operation-ledger.json as an audit sidecar, not a runtime registry.

**Dependencies.** MT-01 and each source integration ticket; Core current default branch plus explicitly reconciled104 corrections; MM citation/retained-output semantics; ML-18 source pagination.

**Acceptance / tests.** Per operation: required/optional/null/unknown field, min/max and overlimit, nested union, wrong schema version, empty vs unavailable vs partial, limit/default/page/cursor/continuation, time zone and inclusive/exclusive cutoff, fiscal/calendar/session/Congress, source freshness, stale client scope and release rights, redirect/body/content/JSON limits and abort. For all output definitions test wrong tool marker, provenance, source IDs/count/coverage mismatches and output overflow. Test source error remains typed and never becomes a success/absence claim. Publish passed/failed/not-run per exact operation and pinned image; this audit itself runs none of those tests.

Canonical source: [MM-01](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3661).

#### MM-01 — Qualify memory recall and graph as current-authority reads (P0 activation gate)
> **[RE-SCOPED 2026-10-23]** Memory reads stay scoped to the current actor, client and permissions. Core decides on each tool call; there is no authority-receipt layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

Bounded work/files: Reuse these adapters and existing Core memory-receiving helpers. Pin producer/consumer wire versions and source/image measurement; qualify expiry, source gates and governed lifecycle with existing selected-read deployment. Map denied, unavailable, stale, partial and empty to distinct receipts. Keep graph path recommendation unsupported unless separately accepted, rather than aliasing arbitrary graph reads to it.

Acceptance/tests: Two tenants, same tenant/different personal owner, walled client, revoked/expired grant, superseded/expired/forgotten/legal-held item, page-body/result/hash substitution, replayed helper token, eligibility expiry during release, empty page with cursor, graph inaccessible-node leakage and stale projection. Never locally remove ineligible records and claim complete coverage. Dependencies: shared delegated-source authority, current membership, Core lifecycle/projection qualification; no new memory engine.

Canonical source: [MM-02](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3673).

#### MM-02 — Close four-payload memory retention before command activation (P0)

Work: Under the existing retention/migration owners register exact classes meriMemoryCandidates(candidate_id), meriMemoryApprovalMetadata(proposal_id), meriMemoryCommandJournal(command_id), meriMemoryIntentPreparations(delivery_id).
Finish guarded nullable-content tombstones, immutable conversation locators, readers/replay suppression and restricted column grants.
Preserve unique proposal/command/delivery/idempotency identities and hashes.
Bind only the canonical four-class owner after verified schema/trigger shape, ledger recovery and policy.
Use assigned memory0002, conversation0018/0019 and intent0002 work where applicable

Acceptance/tests: Native PostgreSQL trigger/role tests, concurrent suppress/write/purge, more-than-one inventory page, lost COMMIT ACK, restart/restore, REDACTED intent replay, historical command readOutcome, exact-target/generation mismatch and zero redispatch after tombstone. MX-04 owns packaging: main migration plan omissions must close there. No purge or memory flag activation in this planning task.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MM-03](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3684).

#### MM-03 — Finish the bounded conversational memory command receiver (P1, blocked by MM-02)

Work/files: After MM-02, compose the existing memory preparer/options/source into the existing intent/executor interfaces and add only the action-specific Core approval/execution contract required by the generic command owner.
Preserve exact proposal hash, current decision, actor/tenant/stable-run provenance and idempotent Core candidate receipt.
Review-only means submitted/pending, never committed memory.
Explicitly decide a separate unscoped-personal credential contract and firm-wide authority before advertising either
do not derive grants from a model or widen selected-client scope.

Tests: Prepare cannot execute
clientId injection denied
personal/client/firm distinct
lost session/unattended run denied
Dependencies: MM-01/02/05, generic approval/execution/public intents owner.
Keep current unavailable registry state until the full path qualifies.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MM-04](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3695).

#### MM-04 — Define the surface-memory retention subject before enabling writes (P0/P1 contract gate)

Work: Agree actor/private, client and firm retention/ownership semantics, lawful retention/hold behavior and current membership/grant projection. Extend the existing subject/policy/inventory/read-release owner and candidate provenance only after that decision. Backfill or explicitly quarantine old surface rows using attributable owner facts; do not infer a subject from citations. Add a versioned write receipt and truthful UI capability only when these semantics exist. Firm proposal permission must come from Core, not a general admin label.

Acceptance: Surface write while unbound produces NOT_DISPATCHED and zero effects; owner offboarding/client withdrawal/scope changes suppress proper rows; old surface-candidate read/review has an explicit policy; personal content stays private; duplicate/stale correction recovery is exact. Dependencies: shared retention and ST-09. Unknown: desired actor/client policy is not established by source.

Canonical source: [MM-05](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3706).

#### MM-05 — Complete owner review/correction contracts and exact outcome reconciliation (P1; ST-11 complement)

Work: ST-11 publishes the exact compatible owner wire DTO and receives F115; do not confuse it with Meri's proposal journal. Correlate Meri candidate/hash/review ID to Core scoped publishedMemoryId; preserve clio: versus item: namespaces and different hash domains. Drain review pages even when decided/suppressed rows yield no visible candidates. After timeout, read exact status instead of recreating a proposal or declaring success. Close the known executor seam where definite post-claim Core refusal is flattened into command UNKNOWN without weakening genuinely uncertain outcomes.

Acceptance/tests: Own versus other owner, activeItemUnchanged pending correction, exact microsecond expectedUpdatedAt, stale target/key collision, correction TTL refused, duplicate approve/reject, immutable conflicting outcome, unavailable Core status versus empty inbox, source suppression before/after decision and no new submission from a read. Bound changes to memory producer/adapters/Core owner DTO and generic executor's typed-refusal seam; no alternate review store.

Canonical source: [MM-07](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3724).

#### MM-07 — Reconcile Meri erasure with Core candidate and canonical-memory retention (P0 activation gate)

Work: Specify cross-owner pending-candidate disposition and immutable suppression receipt, legal-hold/TTL policy, approved-memory independence and offboarding semantics. Use Core's existing transactional projection/embedding/edge/grant cleanup and Meri's exact tombstone targets. Parent retention owner supplies backup expiry, restore suppression replay and global recovery fence. Keep runtime purge and Core MEMORY_PURGE_ENABLED holds until source/DB qualification; no independent memory DELETE worker.

Tests: Pending versus approved candidates, held records, orphan receipt payload, dry-run versus execute, schema drift, restored stale snapshot, new foreign-field payload, externally unavailable deletion blocks completion, and exact content-free receipt after successful disposition. Report partial/blocked, never falsely purged.

Canonical source: [MM-08](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3735).

#### MM-08 — Receive and qualify the existing artifact runtime composition (P1; main source gap / PR receiver)

Work: Review the exact current M197 successor under the MX-02 source-reception ticket, preserving its received candidate11 changes. Verify authority.bind, run register/release, exact selected-client/native credential correlation, source/intent flags and actual executor paths together. Use existing S3/PG publication custody and canonical budget namespace. Compose only supported operations; absence must remain specific unavailable readiness, not globally healthy. Connect typed draft receipt into the existing event/history owner; general output is not a task approval.

Tests: Missing inputs yield no generator/IO; cross client/tenant/run, session switch/revoke, invalid grant, budget exhaustion, unknown create/commit, replay, terminal retirement and cleanup; PPTX/ZIP real bytes with exact SHA. Dependencies: shared source/image/DB qualification, MM-09/10/18, tools authority. No live claims from PR receipt.

Canonical source: [MM-09](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3746).

#### MM-09 — Receive six-format read contracts without widening the writer (P1; WS-23 canonical)

Work: WS-23 receives matching generated B2 blobs from M197 and F115, checks exact metadata/source hash provenance, and retains frozen create/revise contract. Meri consumer must choose descriptor from the retained version, not browser operation/MIME claims. Distinguish read support (all six) from create/revise control support and PDF renderer admission. Fix public provenance checks at integrated head before publishing a contract; historical PR192 is donor lineage, not another branch to merge.

Acceptance: DOCX/TXT/XLSX/PPTX/PDF/ZIP inspect then download, wrong format/session/client/version/hash/size/MIME/filename denied; download object must come from successful inspect module provenance. nativeOpened/rendered/recalculated remain false unless a separately reviewed future contract genuinely changes them. draft/pending is not preview availability. No PDF/PPTX writer UI enabled merely by importing B2. Dependencies: MM-08/10/11 and exact frontend receiver.

Canonical source: [MM-10](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3755).

#### MM-10 — Connect qualified PDF conversion and preview custody end to end (P0/P1)

Work: Existing artifact/isolated-host owners bind actual qualified renderer port, preview record/custody store and explicit PDF admission to runtime options. Parent host owner proves same-image non-root/no-network/RO-root/no-new-privileges/cap-drop/private-workspace/resource-limit/no-credentials observations. Publish a bounded preview request/response contract and separate publish(write)/read actions. Preserve durable preview claims, exact-object versions, source digest and lost-ack recovery; don't change immutable ArtifactVersion.previewStatus to fake readiness.

Tests: DOCX/XLSX/PPTX conversion and PDF self-preview; TXT/ZIP unsupported; renderer absent/failed; all-page byte/render verification; duplicate/unknown claim never redispatches; source suppression/revocation before render/commit/release; restore/orphan preview recovery. Dependencies: MM-08/09, WS-24, shared host/image/migrations. Merely installing LibreOffice or toggling PDF is insufficient.

Canonical source: [MM-11](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3766).

#### MM-11 — Add durable artifact discovery, history and post-run read authority (P1; WS-24 canonical)

Work: Extend existing artifact owner with bounded owner/client/conversation list, detail, immutable version chain, cursor and exact-current-access DTOs.
Support reload/deep link/renamed title/retained original provenance.
Explicitly define whether archive/delete/share/comments are supported
recipients, role/version visibility, revocation and audit receipts require a real contract.
Same-actor authenticated download links are not share links.
Reuse Portfolio filing links, not a second Files store.

Acceptance: More than ten versions
restart/terminal origin
hidden revoked/suppressed artifacts vanish from list and fail direct known-ID access
old scope facts never authorize
tampered cursor
independent current reader cannot rewrite original provenance.
Dependencies: MM-07–10/14, UI consumer and WS-24.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MM-12](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3777).

#### MM-12 — Establish greenfield upload, extraction and evidence custody (P1/P0 before exposure)

Work: WS-24's owner defines initiate/complete/status/read/remove contract; server owns tenant/actor/conversation/client and exact object version/hash. Add bounded size/MIME/magic validation, quarantine/scanning policy, extraction states and byte/format/page provenance. Feed only authorized extracted data into SDK Read and source evidence after durable receipt. Keep uploaded .claude/settings/plugins/instructions inert data, never runtime discovery. Register raw and extracted derivatives in existing retention inventory, finalization replay and cleanup; no browser-provided grants or trusted URLs.

Tests: Interrupted/multipart/duplicate completion; mismatched hash/type/size; unsupported/encrypted/corrupt files; zip bombs/macros/external links; scan failure; extraction timeout/partial OCR; permission revoked mid-upload; cross-thread reference; exact raw+derived deletion and restore. Dependency: authoritative storage policy and native extraction sandbox. The original plan requires adopted pypdf/native Office reads and Tesseract scanned-image OCR where required, with file/page/time bounds, OCR uncertainty and source-scoped citations; do not silently treat a scan as empty text. Product must fix supported MIME/limits, not erase the OCR requirement or infer the new contract from the old 10MB route.

Canonical source: [MM-13](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3788).

#### MM-13 — Receive prior-chat attachment reads through canonical delegated authority (P1)
> **[RE-SCOPED 2026-10-23]** Attachment reads stay scoped to the current actor, client and permissions. Core decides on each tool call; there is no authority-receipt layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

Work: Add one fixed adapter and action-specific Core delegated receiver using the existing signed target/body/current-task authority conventions. Receive the exact trusted currentTurn envelope server-side, normalizing returned attachment/content-state coverage and evidence. Preserve source attachment versus Meri artifact namespaces. Scope reads to currently accessible material, including source-client rechecks and unavailable extracted content. Use modern delegated claims; never copy the service secret or browser bearer into worker inputs.

Tests: Wrong conversation/owner/selected client, stale source after prior upload, reused credential or changed request bytes, partial/failed extraction, revoked filed attachment, large bodies/pagination, forged text/provenance, no model-supplied currentTurn. Dependencies: MM-12 when new uploads are supported, tools source/registry owner, Core receiver contract. Do not call this wired because the old Core route is mounted.

Canonical source: [MM-14](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3800).

#### MM-14 — Complete exact-version attachment filing, not an alternate uploader (P1)

Work: Bind the existing immutable object/version lookup, canonical download and destination policy into the one command path. Core's owner registers exactly those bytes and returns attachmentId/hash/size/expiry; after approval/execution recheck source and destination, then record exact filed destination/attachment/version receipt and UI link. Preserve original source scopes rather than rewriting them to destination. Define recovery for partial registration/file outcome and orphan cleanup; no blind re-upload/re-file. A prepared proposal is not a saved file.

Tests: Foreign object, wrong version/digest/size, stale destination, suppression during registration, duplicate request and reused approval, first registration success/second fail, lost registration/file ACK and post-effect revocation. UNKNOWN remains UNKNOWN until exact readback. Dependencies: MM-08/11/12 as needed, shared command/Core receipt owner, WS-24/PF-23. Keep save_chat_attachments unavailable until qualified.

Canonical source: [MM-15](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3811).

#### MM-15 — Finish research output approval, durable completion and history (P1)

Work: With runtime continuity and generic selected-skill owners, persist the minimum immutable completion/preparation/receipt identity in the existing journal before success release; recover exact compiler identity from retained authorized reads, not rerun unknown reads/model work. Wire current native installation/task/admission and publication owners. Keep explicit awaiting-output-approval and separate approved output run/grant/source-access bridge; record pending, approved, generating, published/held/unknown artifact states in history/UI. Extend recipe support only per accepted installed skill, with exact schema/provenance, not a generic brand bypass.

Acceptance: Close/reload/restart between prepare/read/finish/publish/approval; duplicate ACK; expired original read grant with fresh authorized output; source revocation; rejected/expired approval; exact original and revised DOCX/hash; no artifact ID while pending; no implicit task creation from commitments. Dependencies: MM-08–11/17/18, generic skills and continuity tickets.

Canonical source: [MM-17](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3833).

#### MM-17 — Preserve source evidence through generated artifact and later access (P0/P1 integrity)

Work: Define per-output distinction among user text, model-authored uncited prose and source-backed report. Feed source-backed products only through existing authorized compiler/source receipt owners with exact source IDs/versions/text ranges/read hashes, coverage/freshness and immutable preparation pins. Preserve those facts through artifact spec/version, output approval, revision, public citation projection and filing. Recheck current source access for protected reads; show withheld provenance without leaking private snippets when access is removed. No arbitrary URL or browser JSON becomes authority.

Tests: Wrong source/record/text/hash, stale source access, missing full text, misleading complete-negative result, duplicate citation, user-edit versus source-derived text, parent revision provenance, suppressed source on later inspect/download/file. Dependency: MM-15/16, canonical read/evidence and UI source panel. Do not fabricate sources to fill generic document evidence.

Canonical source: [MM-18](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3844).

#### MM-18 — Qualify native output quality separately from structural inspection (P1 release gate)

Work: Keep the adopted python-docx/XlsxWriter/openpyxl/PptxGenJS/LibreOffice stack. Qualify exact native image/tool/library/font/corpus pins and real bytes, not only JSON containers. Test DOCX paragraphs/tables/headers/sections, XLSX formulas/charts/reference totals/caches, PPTX every slide/text/image layout, PDF every page/source DOCX lineage and ZIP data/chart correctness. Retain original and revised bytes before rendering; inspect every page/slide for clipping/corruption and compare immutable parent. Preserve unsupported feature refusals; LibreOffice recalc is not universal Excel equivalence.

Acceptance: 100% benchmark native files open, formulas/reference totals correct for declared support, no critical clipping/corruption, accepted human rubric and preserved originals; native flags remain truthful. Failure/skip receipts stay visible; PR197's Windows and provenance failures need integrated follow-up, not a blanket green claim. Dependencies: MM-08–10 and shared native host qualification. Tests are to run only under later implementation/qualification authorization.

Canonical source: [MX-03](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3985).

#### MX-03 · Bind each enabled capability to its actual end-to-end dependencies

**Bounded work:** Extend the existing release manifest/checklist, not a new capability framework, with one row per actual mounted capability: UI entry, server feature, public contract hash, startup family, registry operation/skill, Core endpoint/version/allowlist, selected client scope, effect/receipt store, migrations/grants, image dependency, positive/negative tests, live acceptance receipt and intended disabled behavior. Add missing compiler/readiness assertions only where a current consumer could otherwise advertise a capability without its indispensable owner. Keep source inventory and active selection separate. Fail on an enabled row whose receiver/authority/migration is not ready; hide or accurately disable UI for held rows.

**Dependencies:** MF/MT/MM ledgers; MX-04/05. Historical capability plans supply inventory only, not current entitlement.

**Acceptance:** Every visible action resolves to a supported contract and current owner or a truthful held/unsupported state. Enabling a subset cannot enable adjacent writes, browser/bash, unattended work or mail. A missing dependency fails before model/tool/provider work and leaves no durable effect. Build one approved release profile from reviewed rows; never flip `sourceEnabled` as a substitute for closure.

Canonical source: [MX-05](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L4009).

#### MX-05 · Qualify the exact combined image and capability measurement
> **[RE-SCOPED 2026-10-23]** Exact-digest image scan and source-to-image proof stay. The "capability measurement" of the removed registry does not. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded work:** Reuse existing image producer, locks, source/archive manifest, native dependency measurement and receipt verifier.
Include only accepted owners and required packages for the selected profile.
Read source and independently extract/measure the immutable image
do not rely on a matching tag.
Keep browser host and local-SDK alternatives off unless separately accepted.

**Dependencies:** MX-02/03/04, MM render benchmark, MT browser execution boundary, MR version continuity.

**Acceptance:** Zero HIGH/CRITICAL scan findings under existing policy
retained native SDK/artifact/isolation cases pass without skip, unknown or duplicate effects.
Replace obsolete launch-measurement machinery with exact source/image/platform receipts and real service acceptance.
A changed source/lock/profile invalidates dependent receipts.
historical test counts are not a current automatic pass.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MX-06](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L4022).

#### MX-06 · Prove topology, readiness and control scale assumptions
> **[RE-SCOPED 2026-10-24]** Qualify actual Runtime V1 conversation/session topology, readiness and control scale. Remove the Fargate warm-pool, model pair and custom issuer mechanisms; preserve their required behavior through existing standard owners.

**Bounded work:** Root reconciles the existing infrastructure and control owners into the Runtime V1 release. Verify authenticated ingress, intended routes, least-privilege runtime IAM/network access, immutable session scope, truthful dependency readiness and required Temporal namespaces/queues/TLS. Use supported service lifecycle settings. Do not build a new nonce/proof service to preserve obsolete Fargate topology.

**Dependencies:** MX-03/05/07; Core/FE routing under previous X-02–06.

**Acceptance:** Positive authenticated traffic reaches exactly the intended service/version
unsigned, foreign, malformed, neighboring, trailing-slash, absolute-form and wrong-method private requests fail before privileged work.
Readiness reports unavailable dependencies truthfully without minting authority.
Live network readbacks require the operator's approved scope.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MX-07](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L4035).

#### MX-07 · Close material expiry, renewal and PKI rotation operational lifecycles
> **[RE-SCOPED 2026-10-23]** Expiry and rotation stay for the secrets that remain (Core service secret, Temporal credential, Clerk). Pair mTLS PKI and issuer tokens do not. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

Record remaining secret/certificate expiration, rotation, revocation, failed-renewal behavior and rollback without exposing values.
Qualify actual Runtime/control/Core/Temporal trust boundaries, including restart and old-session access loss
do not preserve task-bound grant/PKI machinery that the migration replaces.

**Dependencies:** MR session/currentness, MX-05/06 and retention/Stop cleanup.

A transient authority outage preserves retryable session state where source permits but releases no unverified result.
On restart/rotation the cleanup path still retires historical work safely.
Alert and owner handoff occur before material expiry
no credential values appear in receipts.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MX-09](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L4060).

#### MX-09 · Measure latency, cost and resource behavior without duplicating P1/P2
> **[RE-SCOPED 2026-10-23]** Measure on the new path against the targets in `STANDING-REQUIREMENTS.md` §6. "Without duplicating P1/P2" no longer applies: they are deleted. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Bounded work:** Measure actual Runtime V1 cold start, warm follow-up and idle restore with one recorded clock/sample/source/config protocol. Preserve first-text and acknowledgment targets; report SDK/model TTFT, Core/AWS/DB calls, tokens/cost, queue time, refusals, cancellation and cleanup. No synthetic sleep-as-proof, larger auth deadlines or uncertain effect replay to improve apparent latency.

**Dependencies:** Current Runtime/control owners, MX-08 and native image/capability qualification.

**Acceptance:** Same-hardware/serial base-head source comparisons classify failures
controlled deployed sample meets approved thresholds or remains explicitly blocked.
Report failures and refused/slow samples, not only successful timings
no summed overlapping test totals.
P1/P2 are historical

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MX-10](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L4073).

#### MX-10 · Replace scripted success with representative grounded task acceptance

**Bounded work:** Reuse existing case manifests, graders, scenario adapters and source IDs. Build a consented, sanitized corpus from the actual promised MF/MT/MM surfaces, freeze gold evidence before running, and map every case to capability profile, role/client, allowed actions, forbidden effects and artifact expectations. Distinguish operator-run model evaluation from deterministic fixture tests. Validate the pinned Promptfoo CLI/generator interface or document an equivalent existing harness path; no optional framework migration. Cover planning/drafting/research/congressional/legal analyses, data reads, task followthrough, memory corrections, file deliverables and refusal of unsupported mail/browser/write actions.

**Dependencies:** All selected capability source/contract gates; MM citation/native artifact quality; approved model costs/data recipients.

**Acceptance:** Under the historical full-product target, at least60 representative real tasks meet ≥90% completion and ≥95% checked factual correctness, with all original acceptance thresholds preserved. An explicitly approved smaller scope or different threshold may qualify only a separately labeled limited release, not full-original completion. Results include every case, unavailable source, hallucinated claim, incorrect citation, wrong-client result, unusable file and unsafe proposed effect; scripts cannot count as real model success. A limited first-chat acceptance is reported separately and never renamed full-product acceptance.

Canonical source: [MX-11](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L4085).

#### MX-11 · Prove cross-boundary denial, revocation and uncertain-outcome safety

**Bounded work:** Independent reviewer derives cases from MF/MR/MT/MM tickets and exact contracts using synthetic principals/clients and disposable DBs.
Keep output/history/artifact access rechecks and canonical DENIED/UNAVAILABLE/UNKNOWN distinctions.

**Dependencies:** Source fixes first; MX-04/05 narrow-role/native setup; actual production adversarial probes only if separately approved.

**Acceptance:** No forbidden bytes/effect or cross-client/tenant existence leak in selected cases
denied/unavailable operations do not fall back to ungoverned service secrets or raw provider clients.
Exactly-once effect or durable UNKNOWN with read-only reconciliation is demonstrated under worker death and acknowledgment loss.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MX-12](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L4097).

#### MX-12 · Verify restart, retention, restore and forward rollback as one recovery story

MM owns purge/tombstone semantics
MT owns domain effect reconciliation
MR owns original/next-turn retirement.
Release owner composes them into a bounded disposable-native rehearsal, then an approved live drill if required.
Define operator RPO/RTO and retention restoration policy
do not invent a second event store or repair mutable history manually.

**Dependencies:** MR continuity and Stop gates; MX-04–07; external effects stay held until exact receipt/reconciliation passes.

no duplicate task/mail/provider effect after restart.
A prior compatible checkpoint resumes only under current authority
incompatible runtime versions refuse without persistence.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

Canonical source: [MX-14](https://github.com/neo-capiro/meri-greenfield/blob/1416f4ade3e576b93cc0a055792969b86f6c5fea/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L4121).

#### MX-14 · Make release scope and operator actions explicit, bounded and reversible

**Bounded work:** Owner chooses the concrete release profile from MX-03 and the accepted definition of done.
Prepare one dated change packet naming source/image/feature/migration/cost/tenant/provider/audience, exact steps/observation windows, stop/rollback conditions, accountable operator and sanitized evidence.
Separate low-risk source assembly from native test setup, provider-live calls, migrations/grants, PKI/credentials/OAuth, image publication, stack/service/listener/DNS changes and actual task/mail/notification effects.

**Dependencies:** All affected P0 tickets, selected P1 flow closures, MX-08–13 acceptance.

**Acceptance:** No shipping step proceeds on a generic “all source integrated” claim.
Each required action has its own valid authorization and verified outcome
unknown submission is observed before retry.
Unsupported/optional/post-launch items remain visibly open rather than counted as wired.
Production promotion or replacement of a retained legacy fallback requires an explicit scope decision and rollback proof.

Current scope note: incompatible historical mechanism/restricted-preview sentences are omitted from this executable extract under the standing requirements, current FINAL-PLAN §0 and supersession register. Retained behavior is selected in §§5–6 and the current E-scenarios; do not rebuild the omitted machinery.

## Appendix B. Exact scenario rows and Item0 / MP acceptance

The original scenario rows are verbatim, with E39/E40 removed from the executable table and E40's current replacement stated above. Rows whose whole scope is later-wave are included only to identify their current accepted slice or an explicit NOT RUN boundary; they do not authorize expansion or external effects. Apply the supersession rules above before use.

| ID | Scenario | Expected result |
|---|---|---|
| E01 | Authenticated selected-client first chat | One admission/run, real response, durable transcript and correct current actor/client |
| E02 | Reload/new tab after completion | Same messages/citations/artifacts, correct ordering and no prompt redispatch |
| E03 | Double click and lost submit acknowledgment | Same request identity reconciles to one accepted effect/run; no duplicate |
| E04 | Transport disconnect before/after first text | Cursor replay neither drops nor duplicates durable events; browser close does not silently Stop |
| E05 | Session expiry and transient Core503 | Retryable unavailable differs from revoked identity; no unauthorized bytes or false success |
| E06 | Sign-out/tenant/client change with stored draft/intent | Old data/credentials/receipts cannot cross the new identity or client |
| E07 | Stop at queue/load/start/model/tool/output phases | Logical stop fence and physical cleanup/unknown status are distinguishable; no later unauthorized effect |
| E08 | Failed/cancelled turn after completed checkpoint | Next allowed turn uses last valid published checkpoint, not failed partial state |
| E12 | Resume/fork/retry/steer/pause | Correct exported contract semantics, exact target, current scope and one receipt; unsupported cases explicitly unavailable |
| E13 | Approval allow/reject/expiry/revoke | Captured decision persists before dispatch; exact command only; stale approval refuses |
| E14 | Approval response lost/reload/paging denial | Read-only reconciliation, no automatic repost, current-access cache invalidation |
| E15 | Approval advances waiting run | Chat observation restarts or rereads immediately; terminal/new output appears without reopening |
| E16 | Task.create commits then visibility revoked | Durable tenant-bound effect recorded once; current result access denied; no duplicate retry |
| E17 | Unsupported task mutation | UI/tool does not imply success; no fallback to raw Core mutation |
| E19 | Research/Florida/Monday/task sources | Actual delegated Core endpoint, correct selected client/pagination/time semantics and cited evidence |
| E20 | FedRAMP/rule/SAM adapter adoption | Existing Core observation fields consumed exactly; absent/not-admitted adapter remains unavailable |
| E21 | Mail list/search/thread | Correct connected account/tenant/client policy, truthful unsupported attachments and no read→send escalation |
| E22 | Mail/task provider mutation uncertainty | Existing provider/command intent owns no-resend/reconciliation; no false receipt |
| E23 | Memory recall after correction/revocation | Current revision/permission, prior content not reused incorrectly, provenance retained |
| E24 | Memory proposal approved/rejected/lost acknowledgment | Correct owner and durable outcome; four payloads retained/tombstoned coherently |
| E25 | New-surface Memory context | No fake conversation/client authority; held path stays503 until accepted contract exists |
| E26 | Attachment upload/read/file | Bytes/hash/MIME/size/scan/current custody tied to exact actor/client; rejected file never appears usable |
| E27 | Artifact generation and publication | Valid content+version+hash+evidence; publish once; current Files/chat access |
| E28 | Six-format inspect/download | DOCX/TXT/XLSX/PPTX/PDF/ZIP exact receiver/MIME; invalid/expired/foreign references refuse |
| E29 | Preview/export/native open | Real renderer/native-reader opens promised format; formulas/layout/citations correct; ZIP not disguised preview |
| E30 | Selected research output restart/lost ack | Durable prepare/completion recover without duplicate file/effect; unpublished state not labelled completed |
| E31 | Research citation contradiction/injection | Current cited evidence supports claim; source text cannot authorize tools/effects or fabricate citations |
| E32 | Routine create/update/stop/list from completed chat | Durable schedule management does not accidentally require an active foreground run; authority remains narrow |
| E33 | Routine overlap/retry/DST/timezone/worker death | Exact occurrence/idempotency/consent, no double fire or silently lost due occurrence |
| E34 | Consent revoked or Stop during routine execution | Current cancellation proof/retirement, durable unknown where required, truthful inbox status |
| E35 | Objective/Planner continuation | Core owns workflow; source/run/reader grants exact; no resurrected legacy loop |
| E36 | Retention suppression→purge→restart/restore | Suppressed data stays inaccessible, class-specific deletion receipts, no restore resurrection |
| E37 | Browser/Bash denied or unqualified | No host/network/process starts; refusal before effect |
| E38 | Approved browser/Bash isolated execution | Current host/egress policy, bounded output, no credential escape, complete cleanup/absence proof |
| E41 | P0 telemetry failure/redaction | Underlying work semantics unchanged; dropped counter/alerts truthful; no secrets/prompt/client identifiers |
| E43 | Mixed versions/frontends/contracts | Explicit version/source refusal or accepted backward compatibility; no silently misparsed approvals/output |
| E44 | Inaccessible/empty/stale provider data | Truthful unavailable/no-results distinction, no fabricated success/evidence |
| E45 | Canonical cross-module handoff | Portfolio/Workspace/Settings context preserved with entity IDs; effect appears in receiving module after reload |

Re-scoped scenario rows, verbatim from the current supersession register (replace their historical master rows):

| Scenario | Disposition | Note |
|---|---|---|
| E09 image-only release after a completed turn | KEEP | The conversation continues after a deploy |
| **E10** deploy or rotation while an old run is in flight | **RE-SCOPED** | Stop works and the run closes or resumes cleanly. No pins |
| **E11** SDK, CLI or format incompatibility | **RE-SCOPED** | A clear message and a recap or new-chat choice (O103); no silent session loss |
| **E18** read active-set and revoked operation | **RE-SCOPED** | The tools a user can call are those Core allows for that user and client; a revoked tool refuses |
| **E40** budget / terminal usage missing or contradictory | **SUPERSEDED** | Replaced by: record available canonical SDK usage once, preserve unknown accounting explicitly without fabricated usage or failing a completed answer, and enforce the tenant cap through its existing owner |
| **E42** forward rollback and schema compatibility | **RE-SCOPED** | Drop "retained liabilities"; keep forward rollback and receipts |

### Current M2 contract (verbatim)

**M2 matches that with one rule:** a conversation is either **General** or **bound to one client**, decided when it is created.

- **Core:** the conversation bootstrap accepts "no client". The canonical authenticated bootstrap supports a clientless conversation under the approved M2 contract; do not recreate the removed per-hop authority receipt. Root owns the shared contract change and actual Core permission gates.
- **Meri control:** the initial binding, context and tool scopes accept a clientless conversation. A tool that needs a client asks the user to start a client chat instead of guessing.
- **Item0 migration:** use the minimal current control/public contract agreed with root/A. Core checks current membership and General/client access; the existing tool gateway preserves that scope and enforces each client wall per result. No separate General authority DTO, receipt or relay.
- **Reads in a General chat:** across the clients the user can already see, with each client's wall enforced per result (Neo's decision 2).
- **Actions in a General chat:** whichever is simpler to build safely. Either they run under the user's own per-client permissions, or they require a client chat. **No new authorization machinery for this.**
- **Memory:** a General chat uses personal and firm memory only, never a client's.
- **UI:** "General" appears in the client selector, and the New conversation button works.
- **Checks:**
  - a General chat answers a general question;
  - it never returns another client's walled data;
  - a client chat cannot see another client;
  - switching between conversations keeps each one's history.

## 7. Acceptance for the item

- T3 to T6, H1 and H2 pass on preview. Their definitions are in the S2 packet on #202 (comment 6355731525): T3 first turn completes; T4 follow-up in the same conversation; T5 reload while streaming reconnects; T6 Stop mid-stream ends cleanly; H1 conversation history loads; H2 the history filter menus.
- Within the agreed limits per simple turn (Core calls ≤ 30, Core time ≤ 3 s) at minimum. *Proposed targets:* Core calls ≤ 5 (control, excluding tools the model chooses to call), AWS calls ≤ 10 excluding standard Runtime invocation, DB statements ≤ 300, first delta within about 3 s of `run.running`, the full answer within about 2 s of the model stream ending.
- Side by side with claude.ai on five Capiro questions, answers are comparable in depth and accuracy, and use Capiro tools where relevant.
- The parity checklist (§4) and the negative tests pass.

The historical directory-wide deletion bullet is excluded: the current register preserves canonical identity/membership/session/access checks until their replacement is proved. Release alone verifies obsolete resource retirement; the21:59 receipt does not imply functional acceptance.

**Parity checklist.** Every family must be reachable as tools with unchanged results and permission outcomes, proven by its existing positive, negative and paging cases (the MT tickets' acceptance): acquisition-personnel, action-items, bill-text, business-development, client-evidence, client-knowledge, client-knowledge-search, client-registry, data-search, dataset-metadata, disclosures, district-nexus, facility-representation, federal-legislation, federal-market, florida-budget, funding-opportunities, identity-contacts, intelligence-summary, legislative-directory, mail, meetings, memory-proposals, original-tracking, outreach-query, pe-references, program-elements, public-data, public-domain-hearings, public-domain-query, public-reports, public-web, regulatory-dockets, research-legal-candidates, research-legal-legislation, research-legal-news, research-portfolio, research-portfolio-evidence, state-legislation, state-status-votes, stored-intelligence, tracked-bills.

### Current MP acceptance (verbatim)

## Acceptance

- The whole-flow chat check passes on both providers.
- Switching model or provider mid-conversation works, or tells the user honestly that it starts from a recap.
- Usage is recorded per provider, from the SDK result.
- The API key lives in AWS Secrets Manager and is referenced by ARN, never by value.
- No code for the old proxy path remains (`STANDING-REQUIREMENTS.md` rule 3).

## Appendix C. Retained Wave 1 scope and exact contracts

## Exact grouping

| Group | Current assigned scope | Source |
|---|---|---|
| Phase0 prerequisites and regression | MR-07 retained continuation/incompatibility behavior; MF-08 status truth; MX-01 status/evidence; MX-04 migration/grant provenance. MT-02 retains read handlers; MX-02 source reception is DONE. MM-08 is Phase0 source reception only; artifact activation is M5. Preserve idle and pre-deploy conversation continuity. | `plan/FINAL-PLAN-20261021.md:145–169,319–323`; `source-of-truth/SUPERSEDED-BY-ITEM-0.md:50,54,66` |
| M1 reliable chat | MF-01, MF-02, MF-06, MF-07, MF-10, MF-21; MR-06, MR-08; retained behavior only from superseded MR-01, MR-02, MR-09; MX-13 relevant existing release regressions. Historical M1-X1 adds truthful next-turn admissibility; E12-D adds pause/resume/fork across deploy. | `plan/FINAL-PLAN-20261021.md:184,337–341`; `phases/WAVE1-AGENT1-M1-RUNTIME-BRIEF.md:114–120` |
| Wave1 speed/telemetry | MX-08/P0 truthful telemetry and MX-09 measurements on current native path. S1 and S2/P1/P2 mechanisms are superseded; S2 had been pulled into Wave1 by O183. Current simple-turn and revocation guarantees remain. E39 is excluded. | `decision-log/DECISION-LOG.md:844`; `source-of-truth/SUPERSEDED-BY-ITEM-0.md:47–65,78–79,104–108` |
| A1 safety: 17 ticket IDs | ST-01, ST-02, ST-24 (security-sensitive writes only); WS-02, WS-03, WS-04; PF-10, PF-11, PF-12, PF-22; ML-02, ML-03, ML-07, ML-08, ML-09, ML-10; X-04. No app ticket is removed by item0, but O143 removes the Workspace approval part of WS-03. O146 qualifies ML-09 as hold-collision-and-continue. | `plan/FINAL-PLAN-20261021.md:217`; `source-of-truth/SUPERSEDED-BY-ITEM-0.md:121–123`; `decision-log/DECISION-LOG.md:803,806` |
| Real-path prerequisites, not new Wave1 feature work | A0: X-01/X-02/X-03/X-05/X-06, PF-01/PF-21/PF-24, WS-01, ST-26, ML-01. Root selects the qualified current preview cohort; missing route/service/schema/provider readiness is explicit. | `plan/FINAL-PLAN-20261021.md:216`; older separate-staging hold is qualified by current authorization there and WORKFLOW |

General/client conversation management and user/firm memory remain mandatory in the combined Wave2 handoff. They are not reclassified as M1 or omitted because their detailed owners are M2/M6. Core remains the gatekeeper; General reads only clients the actor can see with each wall enforced, and General memory is personal/firm only. Source: `plan/FINAL-PLAN-20261021.md:194–210`; standing rules 1–4; item0 spec:35.

## Actionable acceptance rows

All rows start **NOT RUN by this researcher**. Fable should record its actual PASS/FAIL/NOT RUN, UTC, current cohort, exact observed result and any applicable measured value. Reuse applicable source evidence for negative/failure cases rather than launch a new exhaustive live campaign. An unconfigured advertised feature remains open, with owner and next action.

| Row | Ticket / matching E case | What Fable must establish or reference | Prerequisite / owner for any gap |
|---|---|---|---|
| W1-C1: new turn, durable history | MF-02/08/21, MR-08; E01/E02; T3/H1/H2 | Authenticated selected-client new chat produces one real response and durable transcript. Reload/new tab retains ordering and content with no prompt redispatch. History and filters behave as advertised. | Actual configured route, current actor/client, Runtime/model, durable stores; Acceptance with Runtime/U. Reuse overlapping Wave2 T3–T6/H1/H2 evidence when same cohort and behavior. |
| W1-C2: submit/reload/stream recovery | MF-07/MR-06/MR-08; E03/E04; T5 | Double submit and lost ACK reconcile the same request to one run/effect. Reconnect uses accepted cursor without dropped/duplicate events; page close does not silently Stop. Unknown outcomes stay unknown until durable readback; draft/request state cannot cross scope. | Real stream/history route and durable receipt owner; Runtime/U. Use existing composed ACK-loss tests for failure injection; no blind resubmit. |
| W1-C3: identity, refresh and isolation | MF-02/X-04/MR-02 retained; E05/E06 | At least two real renewal cycles preserve run/cursor without another submit. Expiry/transient Core unavailable differs from definitive refusal. Signout/account/tenant/client switch hides stale data and cannot resurrect it from cache. Revoked user loses access within 30 s; Core/tools preserve tenant/client/wall boundaries and previously loaded privileged context cannot remain usable. | Controlled non-customer fixture identities and existing auth/Core owner. Existing exact-source negatives can support crossings; missing fixture/revocation allocation = NOT RUN with Root/Core owner, not an inferred permission failure. |
| W1-C4: Stop and next allowed turn | MF-06/MR-08/MR-01 retained/M1-X1; E07/E08/E10; T6 | Logical Stop, terminal state, physical cleanup/unknown and next-turn admissibility remain distinguishable. Repeated Stop converges; no unauthorized late effect or concurrent successor. A failed/cancelled turn continues from last valid durable native state. UI ready/Cancelled alone does not prove SDK/physical closure. | Runtime authoritative Stop/readiness/closure and native SessionStore evidence; U presentation. Reuse exact-source phase/failure cases; do not resurrect per-run allocation/grant proof gates. |
| W1-C5: idle/deploy/incompatibility | MR-07 retained/MR-08/MF-10; E09/E10/E11 | Conversation still works after the Phase0 20-minute idle check and compatible image deploy; Stop for pre-deploy work remains safe. Incompatible SDK/format yields a clear message and recap/new-chat choice. Existing native durable restore must actually cross its owners. | Release supplies a compatible before/after cohort and exact-source rehearsal; Runtime native restore owner. No surprise deployment during Fable's locked acceptance window. Any necessary deploy-crossing rehearsal is separately coordinated by Root/Release, or applicable evidence is reused. E11 may be proved by test. |
| W1-C6: lifecycle controls | MF-10/MR-06/MR-08; E12/E12-D | Advertised steer/pause/resume/fork/retry uses correct target/current scope and one durable receipt; duplicate request/reload does not redispatch. Pause→resume/fork works across compatible deploy. Unsupported cases must be honestly unavailable and stay open if advertised required scope. | Current versioned lifecycle DTOs and actual SDK resume/fork/SessionStore; Runtime/U. No old custom checkpoint or dormant-original requirement. |
| W1-C7: usage, latency, telemetry | MR-09 retained/MX-08/MX-09; replacement E40/E41 | Record available canonical SDK usage once, retain unknown accounting explicitly, never fabricate usage or fail a completed answer due to accounting uncertainty; existing tenant cap holds. Simple turn meets ≤30 Core calls and ≤3 s Core time, attributable to that turn. Telemetry failure does not alter work; dropped counters and selected alarms remain truthful and redacted. | Runtime/usage/telemetry owner supplies actual current evidence; Fable observes matching simple turn. Window totals or substantial tool/output samples do not establish the simple-turn gate. No owner/proxy measurements. |
| W1-C8: truthful UI and status | MF-01/MF-08/MF-21; E04/E05/E12 | Ordinary route, sidebar/mobile/home, guard/API and available capabilities agree. No dead controls or synthetic fixtures represented as product; disconnect/timeout never claims completed/running/cancelled without evidence. Enabled control traces to current authenticated owner and durable refresh receipt. | U with affected feature owner and exact source/config. Do not call disabled required scope complete. |
| W1-A1: Settings security | ST-01/ST-02/ST-24 security subset/X-04 | Own branding upload/name succeeds; foreign/unowned key/false MIME/oversize/missing object refuses before signing. Protected/self/foreign membership removal refuses before state/outbox; permitted target revokes immediately. Consequential Settings operations freeze exact scope/payload, resist double submit and reconcile unknown without blind retry. | Tenant Settings/Core + U; configured asset limits/allowed types come from owner, not invented numbers. Reuse exact-source API/PG negatives; avoid real membership/provider disruption for a display check. |
| W1-A2: Workspace access and client association | WS-02/WS-03/WS-04/X-04 | Filtered/unfiltered Hill Day, jobs, exports and direct URLs enforce current membership/client wall. Sharing/revoke and served versions enforce ownership/collaboration/source access. Canonical draft client association survives save/reopen/Portfolio staging; duplicate names or ambiguous legacy mappings do not widen access. Workspace approvals remain removed; no dead approval workflow. | Workspace/Core plus U; real mounted service/current wall fixture. Sharing permission proof does not authorize public publication. |
| W1-A3: Portfolio safety/correctness | PF-10/PF-11/PF-12/PF-22/X-04 | Four meeting reads enforce client visibility. Subject/time-only edit preserves association provenance; actual reassignment is current and attributable. Notes/debrief approval/share state is accurate through reread and unshare, with denied roles blocked. Dated/undated commitment/request settle/reopen; other kinds refuse; title-only edit preserves metadata. | Portfolio/Core/U and controlled draft data. PF-12 approvals survive O143. PF-22 rich-metadata editing is separately allocated; no invented new A1 schema work. |
| W1-A4: mail safety | ML-02/03/07/08/09/10/X-04 | No generic Graph mutation replay; one dispatch per intent and zero dispatch on rejected preflight. Unknown survives restart/readback. Add vs reconnect cannot cross account tokens/history/cursors; exact-account refresh and concurrency stay isolated. Colliding row is held, sync continues/cursor advances, ownership never transfers. | Mail/OAuth/Core + Portfolio/U; use existing mock/native source evidence and authorized test-account configuration. ML-02 explicitly needs no live send. Specific user send instruction is required for external send; none is created here. ML-09 full key migration is not newly part of the bounded A1 minimum. |

Matching Meri scenarios are **E01–E12, the current replacement for E40, and E41**. E39 is superseded. A1 has its own direct-API/transaction/provider-mock negative matrix; no numbered Meri E row should be invented or used to imply its domain checks passed. Source E rows: `source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4290–4301,4330`; current overrides: `source-of-truth/SUPERSEDED-BY-ITEM-0.md:74–81`.

## Exact limits and evidence boundaries

- **Required:** simple-turn Core calls ≤30 and Core time ≤3 s (`STANDING-REQUIREMENTS.md:89`; item0 spec:95); revoked-user access loss within30 s (`SUPERSEDED-BY-ITEM-0.md:60`); at least two real renewal cycles preserving run/cursor (`Meri master:2292`). Phase0 defines a20-minute idle continuity check (`FINAL-PLAN:168`). These are distinct checks.
- **Scenario boundary, not response-time SLA:** MF-06 includes cleanup delayed beyond150 s to verify honest readiness and no duplicate successor (`Meri master:2328`). Do not promise retirement within150 s.
- **Proposed targets only:** control Core calls≤5, AWS≤10 excluding standard Runtime invocation, DB statements≤300, first delta≈3 s after run.running, final answer≈2 s after stream end (`STANDING-REQUIREMENTS.md:90`). S3's median first-text15 s is a retained target to measure cold/warm/restored separately, not a newly demonstrated or upgraded hard gate (`FINAL-PLAN:177`).
- **Removed limits:** owner exchanges≤13 and pair repair≤30 s (old S1/E39), per-hop authority/JWT proof chains, reservation/UNKNOWN-liability bookkeeping, custom warm pools, per-turn Fargate and custom checkpoint/harness gates. Ordinary Clerk JWT authentication and the scoped gateway run token remain; removing duplicate JWT machinery does not remove real authentication.
- No new total call budget, broad live negative census, special telemetry framework, natural30-day waiting period or new approval process is introduced. Root supplies a finite affected acceptance allocation and stable cohort. Checks already valid for unchanged exact behavior may be reused; current deployed crossings still need their own applicable evidence.

## What historical Wave1 evidence can and cannot do

| Historical evidence | Reuse value | Current limit |
|---|---|---|
| `WAVE-1-HANDOFF.md:18–27`: one T3 completed on the old release; its telemetry gate failed; T4/T5/T6/H1/H2/R1 were NOT RUN | Preserves baseline and reason for item0; shows exactly what remained owed | Does not prove any current AgentCore acceptance. No blanket Wave1 pass exists. Do not turn old failure metrics into present failure metrics. |
| `decision-log/DECISION-LOG.md:849` O188: A1 backend receiving heads, native ML-09 6/6, migration9/9, Workspace37/37 | Candidate historical ordinary-role/API/PG evidence for unchanged domains; find existing receipts and compare changed owners before reusing | Source gate/merge receipt, not current deployed UI/domain acceptance. Earlier O185 failure is superseded by that later bounded gate, not silently deleted. |
| `decision-log/DECISION-LOG.md:847,850`: M1 screen build/deploy receipts | Source/build lineage and existing relevant UI suite | Build/navigation sanity did not complete stopped chat acceptance. Old custom runtime/authority test results cannot qualify current native restore. |
| `phases/A1-REVIEW.md`, `phases/A1-REVIEW-PF-ML.md` | Existing negative tests/mutants and exact defects/rulings; PF-22/ML-09 current bounded choices | Reviews contain historical CHANGES and later revisions. Use final applicable source receipt, not an early red or green summary as current status. Workspace approval test portions are obsolete after O143. |
| Current Wave2 evidence at a named cutoff | Overlapping same-cohort chat/stream/Stop/history and exact-source domain cases may satisfy a retained Wave1 row | Root/Release must supply current cohort/binding and exact scope. This research did not validate current operational facts or allocate extra calls. |

# Wave1 scoped verbatim ticket and scenario extract

Prepared for the Fable acceptance handoff, 25 October 2026. Read-only research; no tests or deployed checks run. The source documents below are identical between observed checkout HEAD `21d7e3cee3060444d01cb8e41e902f72b9d90719` and Root's main `1416f4ade3e576b93cc0a055792969b86f6c5fea` (read-only Git diff returned no paths). Historical defect/evidence paragraphs describe their original audit, not current product status.

Each quoted block is copied directly. Unchanged ticket bodies are complete. Where current supersession removes a mechanism, only the controlling current override and retained compatible excerpts are copied; excluded historical material is named explicitly. Source line numbers identify the original files. Full A1 approval instructions are deliberately absent: O143 removed Workspace approvals. Scope is current Wave1 behavior/regression and unfinished retained requirements, not rebuilding old architecture. A0 remains a real-path prerequisite; MM-08 is Phase0 source reception only, with activation in M5. No duplicate implementation or new broad test campaign follows.

Latest authority governs: standard AgentCore Runtime V1 hosts the real Claude Agent SDK; control performs current admission/ownership checks and the tool gateway reaches canonical Core tenant/member/client/wall enforcement. Native SessionStore/artifact durability and required Temporal runs remain. Old Wave1 authorization/hosting instructions do not govern current acceptance. Current Root/Release allocations replace historical separate approval, staging and role holds. Fable may fix simple in-scope bugs in a draft PR under Root coordination; report complex issues and preserve the architecture. This researcher performs only documentation work. An ordinary frontend same-origin proxy is transport, not the removed model owner/proxy service. Real authorization and domain effect/approval guarantees remain; Workspace approvals alone were removed by O143.

## Phase0 and M1: current retained source

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2276` through line 2282. Retained ticket; historical root-cause claims do not establish current defects.

#### MF-01 — Publish truthful capability and route state (P0 activation gate)

- **Root cause / evidence:** Route tree and explicit allowlists disagree with stale `shared/meri-resources/unavailable.ts`: history/create/approvals/preferences now have real slices; lifecycle is publicly exported upstream. Fixture navigation resembles working product.
- **Bounded files/owner:** Frontend shell `SidebarDestinations`, `Sidebar`, `MeriMobileNavigation`, `MeriHome`; `shared/meri-resources/unavailable*.ts`; route-activation tests. Do not edit every screen indiscriminately.
- **Implementation:** Create a reviewed capability table with source pin, ordinary route, deployment flag, accepted public contract version, runtime owner, required receipt and unavailable reason. Render only supported ordinary links; clearly label design fixtures. Replace stale no-contract copy with precise held/not-configured/missing-consumer language. Record PR115 as already merged and preserve its status-copy regression. Distinguish source reception from deployment/flag activation in release notes.
- **Dependencies / exclusions:** MR/MT/MM truth inventory, PR115 merge provenance, canonical PF-01 deployment qualification. No global enable flag or fixture-to-production rewrite.
- **Acceptance:** For every flag/config combination, sidebar/home/mobile/route guard/API agree; no dead href or disabled action claims completed work. Tree test proves actual mounts; `/kit` is not advertised. All fixture destinations remain recognizably non-authoritative.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2331` through line 2337. Retained ticket; historical root-cause claims do not establish current defects.

#### MF-07 — Design durable drafts and request recovery across reload (P1)

- **Root cause / evidence:** Unsent drafts are React state; QueryClient journals preserve SPA navigation only. `turn-journal.ts` explicitly warns hard reload loses intent identity; clearing a next-turn composer before successful reservation can lose visible text on reload.
- **Bounded files/owner:** `useConversationSession.ts`, `MeriLiveConversation.tsx`, `MeriComposer.tsx`, `query-journal.ts`, `turn-journal.ts`, first-chat intent helper; a small versioned per-scope journal, not broad local persistence.
- **Implementation:** Define retention for unsent drafts separately from dispatched immutable requests. Save permissible draft text per tenant/actor/client/conversation (or explicitly state drafts not saved); restore only to exact scope and clear on signout/retention expiry. Persist minimal non-secret request identity before mutation if permitted, then use server readback/reservation on reload. Unknown submission must not create new logical request. Distinguish edited newer draft from acknowledged text and preserve IME/blocked-enter behavior.
- **Dependencies / exclusions:** Privacy/retention ST-18; MR durable admission/readback owner; MF-04 journal conventions. Never persist bearer/session credentials or trust restored bytes as authority.
- **Acceptance:** Reload before dispatch, after dispatch/before ACK, after ACK, during next-turn409, offline, storage-full and account/client switch: no accidental resend, no cross-scope draft, no unexplained loss of accepted request. Hard-reload outcome recovered from durable server state, not guessed from local cache.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2340` through line 2346. Retained ticket; historical root-cause claims do not establish current defects.

#### MF-08 — Preserve and qualify merged run-status truth correction (P1 regression gate, source already complete)

- **Root cause / evidence:** Earlier main stalled copy said the run continues; exact fix is now on current main through merged PR115 [`apps/web/src/features/meri/conversation/RunStatus.tsx:111–124`](https://github.com/neo-capiro/capiro-frontend/blob/7fda299e2264d17a5a88c1dad50b08633ba862ae/apps/web/src/features/meri/conversation/RunStatus.tsx#L111-L124).
- **Bounded files/owner:** Current-main `RunStatus.tsx` and `tests/meri-run-status.test.ts`; merge provenance/release tests only. No new copy implementation is owed.
- **Implementation:** The current reviewed delta is already merged. Preserve its tests and qualify it in the deployed ordinary environment. Keep observing/reconnecting/stalled/outcome-unknown separate; page departure stops watching, not execution. Audit auxiliary workflow errors for same optimistic wording.
- **Dependencies / exclusions:** PR115 merge verified at `24316f9`; deployment qualification controlled by release plan. No duplicate implementation or merge task, no flag enabling.
- **Acceptance:** Disconnect or proxy timeout never states backend is running/completed/cancelled; reconnect action rereads accepted cursor; source pin in release receipt proves the current delta is present.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2285` through line 2286. MF-02 current override. Old exact-lifetime reissue/session-owner implementation and historical45-second renewal explanation omitted under register:60; ordinary Clerk refresh/Core access governs.

#### MF-02 — Qualify identity, exact-run renewal and access-loss isolation (P0 before live activation)
> **[RE-SCOPED 2026-10-23]** A revoked user still loses access within 30 s. Use the ordinary Clerk session refresh plus one Core access check per turn; there is no "exact-run renewal". Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2290`. MF-02 retained behavioral scenarios, selected proportionately; no old exact-run renewal service.

Build composed acceptance scenarios for verified native actor, tenant/client switch, archived/deleted client, signout, revoked membership, token expiry while streaming and while mutation pending, multiple renewal cycles, browser back/forward, StrictMode/remount.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2292` through line 2292. MF-02 retained run/cursor continuity, cache isolation and identity-negative acceptance. Real current authentication remains required.

- **Acceptance:** At least two real renewal cycles preserve run ID and accepted cursor, no duplicate submit/next-turn; stale account/client DOM is hidden immediately, denied data not resurrected by cached pages; explicit retry cannot mint broader authority; native subject-to-actor mismatch fails closed.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2322` through line 2322. MF-06 title; original root-cause prose and the old source-reservation implementation instruction are omitted. Retained readiness/cleanup behavior follows.

#### MF-06 — Expose Stop retirement and next-turn readiness honestly (P1)

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2326`. MF-06 retained exact implementation excerpt; source-reservation machinery omitted under MR-08 supersession.

Display separate Stop requested, fence recorded, run terminal and next-turn readiness/cleanup pending where public evidence supports them. Exhausted turn-conflict retry becomes retryable not-ready, not a new conversation/run request.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2326`. MF-06 retained exact implementation excerpt.

For accepted-but-not-started input show recover/readback action rather than a new Send. Avoid unbounded spinner and explain cancellation receipt versus cleanup.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2328` through line 2328. MF-06 retained acceptance. No actual retirement duration is guaranteed by this failure scenario.

- **Acceptance:** Stop during tool/provider work, dropped cancel receipt, cleanup delayed beyond150s, fresh deployment and repeated next-turn click all converge to at most one successor; no overlap before retirement; approved prompt preserved and no claim of physical stop without evidence.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2458` through line 2462. MF-21 retained matrix contract; source collection is reused, not a new broad audit. Historical dependencies and separate-approval instruction omitted because current authority and completed source reception govern.

#### MF-21 — Build a pinned composed frontend acceptance and release matrix (P0 activation gate)

- **Root cause / evidence:** Numerous unit/browser tests exist, many use controlled fixtures. No live deployment/provider action or test run occurred in this read-only audit.
- **Bounded files/owner:** Existing `apps/web/tests/meri-*`, `test/browser/meri-*`, route activation/production-data tests, fixture provenance checks; release checklist/receipt artifact.
- **Implementation:** Create matrix per ordinary route and flag with exact FE/Meri/Core pins, contract versions, deployment scope, issuer/audience/native actor mapping, client allowlist, migrations, worker composition, secrets references (not values), positive and negative test receipt IDs. Separate mocked receiver/browser regressions from composed runtime tests and provider-qualified outcomes. Require at least one real authorized main-path refresh/reconnect/Stop/approval/artifact receipt per enabled slice plus required denial/unknown-outcome cases. Keep not-tested/blocked labels explicit.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2464`. MF-21 retained provenance; fixed proxy is frontend same-origin transport, not the removed model proxy. Blanket disabled/held freeze omitted under current autonomous-completion/activation authority.

Each enabled control traces UI→fixed proxy→versioned public contract→authorized owner→durable receipt→refresh. CI receipts map exact current pins, not stale PR body counts.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2464`. MF-21 retained truth and recovery guarantee.

no synthetic data in ordinary routes; rollback leaves uncertain operations reconcilable.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2358` through line 2359. MF-10 controlling current override. Historical implementation/dependency paragraphs naming old checkpoint/pin/target-session composition are excluded; consume current exported lifecycle DTOs.

#### MF-10 — Implement the existing public lifecycle consumer (P1)
> **[RE-SCOPED 2026-10-23]** Pause, resume and fork controls stay. Consume the lifecycle DTOs defined by Wave 2 item 0. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2365`. MF-10 retained current-contract behavior. Old target-session gate and blanket held-composition phrase omitted under register:61; current scope/target isolation remains E12/Core-owned.

Steer/pause/resume/fork success/refusal/unknown/reload are tested at exact pins; duplicate same request returns durable receipt, never redispatches.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2365`. MF-10 retained lineage isolation on native SDK SessionStore, not custom checkpoints.

Cross-run/checkpoint substitution rejected;

Source: `docs/handover/20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md:47` through line 52. MR-01/MR-02/MR-07/MR-09 obsolete ticket bodies are excluded completely. MR-06/MR-08 current behavioral scope is retained verbatim here.

| **MR-01** historical stop-only retirement | **SUPERSEDED** | A Stop sent for a run that began before a deploy works (E10) | The config-SHA / facts-hash pins the ticket repairs no longer exist |
| **MR-02** transient-authority classification in the control pump | **SUPERSEDED** | A transient Core outage retries with bounded backoff inside the run deadline; a definitive refusal fails at once | The authority-availability marker and the per-operation authority layer |
| **MR-06** durable lifecycle outcome readback | **RE-SCOPED** | Outcome readback and recovery after process or request loss | Temporal plus the conversation DB are the durable record; drop the prepared-run registries |
| **MR-07** checkpoint / dormant-original continuity | **SUPERSEDED** | The next turn after a deploy continues the conversation. An SDK upgrade needs the transcript-recap handover first (O103). An incompatible state shows a clear message | Admitting render, reserved successor, mirror append and dormant-original states |
| **MR-08** admission-to-next-turn lifecycle suite | **RE-SCOPED** | Behavioural crossings: duplicate submit, ACK loss, Stop repeated, stream reconnect with cursor, next turn after a failed or cancelled turn, deploy between turns, pause/resume/fork | Crossings that exist only for kickoff claim/lease, allocation and grants, native currentness, terminal usage capture |
| **MR-09** provider terminal accounting and unresolved-liability recovery | **SUPERSEDED** | Each run's cost comes from the SDK result and is recorded once. The tenant cap is enforced. A turn is never failed because accounting is uncertain | Reservations, UNKNOWN liability, quarantine, CountTokens basis |

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2723` through line 2724. MR-06 current ticket and override.

#### MR-06 · P1 · Close durable lifecycle outcome readback and recovery after process/request loss
> **[RE-SCOPED 2026-10-23]** Behaviour stays: durable outcome readback and recovery after process or request loss. Temporal plus the conversation DB are the durable record; there are no prepared-run registries. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2731`. MR-06 retained work; old source-session/current-authority-route implementation and completion-journal/session-owner file instructions omitted under register:49. Use current Temporal/conversation DB/native SDK owners.

Reconcile only from existing authoritative proof; an unobserved SDK message remains UNKNOWN. Do not infer APPLIED from a final assistant answer, transcript text, timeout or process death. Define owner/operator escalation for irreducible UNKNOWN without clearing the barrier.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2734` through line 2734. MR-06 retained durable outcome acceptance, including expired/foreign-selector denial.

**Acceptance:** ACK-loss receipt recovery never resends SDK input, reallocates a target, replays mutation or captures another checkpoint. Expired/foreign source selectors cannot release content. The user can distinguish pending, applied, unknown, source-retirement pending and result-not-released.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2754` through line 2756. MR-08 current controlling ticket scope. The old minimum-crossing body is excluded where it mixes kickoff claims, grants, native currentness or terminal usage-capture mechanisms; retained crossings are stated in the override and E rows below.

#### MR-08 · P1 · Qualify the complete admission-to-next-turn lifecycle, not only happy-path endpoints
> **[RE-SCOPED 2026-10-23]** Keep the behavioural crossings (duplicate submit, ACK loss, Stop repeated, stream reconnect with cursor, next turn after a failed or cancelled turn, deploy between turns, pause/resume/fork). Drop crossings that exist only for kickoff claim/lease, allocation and grants, native currentness or terminal usage capture. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.
**Class:** Q. **Owner:** runtime supplies the semantic cases; release coordinator owns integrated test/release execution.

Source: `docs/handover/20261022/phases/WAVE1-AGENT1-M1-RUNTIME-BRIEF.md:117`. M1-X1 retained next-turn readiness invariant. Old instruction to add a new field, old contract version, retirement409 representation and relay are omitted; consume existing current status owner.

after a terminal turn, the field flips to admissible only when control would admit the next run.

Source: `docs/handover/20261022/phases/WAVE1-AGENT1-M1-RUNTIME-BRIEF.md:120`. E12-D retained exact behavior fragment. Old candidate11 mechanism reference excluded under MR-07/MR-08.

A conversation paused before an image-only deploy resumes or forks afterwards

Source: `docs/handover/20261022/phases/WAVE1-AGENT1-M1-RUNTIME-BRIEF.md:120`. E12-D retained exact behavior.

Unsupported cases are explicitly unavailable, never silently broken.

Source: `docs/handover/20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md:54` through line 54. MT-02: retained read handlers only. Its old native-authority composition body is excluded.

| MT-02 selected-read composition (PR197) | **DONE / RE-SCOPED** | Read handlers stay | The authority composition around them |

Source: `docs/handover/20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md:66` through line 66. MX-02 source receipt is DONE; do not repeat source reception or revive donor branches.

| MX-02 receive existing source once | **DONE** | — | — |

MM-08 Phase0 is source reception only (FINAL-PLAN line 322); current artifact activation/real-format acceptance belongs to M5. The historical MM-08 native credential relay, derived per-call sessions and budget namespace work is excluded. Existing artifact custody and source remain required under standing rules and item0; Phase0 source reception is not live artifact acceptance.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3961` through line 3970. Retained existing-owner evidence/qualification duty; WORKFLOW necessary-qualification rules govern test selection. Removed service/pair/budget mechanisms and historical role/approval instructions are not current work.

#### MX-01 · Establish one truthful source-to-runtime status register
**Priority / type:** P1 release coordination; current documentation inconsistency, not a missing chat implementation.

**Evidence and root cause:** EX-04 L153 still states every render invalidates admitted conversations. Current main's candidate11 introduces image-only continuity and SDK/format refusal. PR194's body still records October20 releases F/G/H and zero provider calls; the user separately reported that Fable obtained a chat response on October20. PR195's body retains draft/unmerged language although GitHub reports merged and its head is an ancestor of main. PR115 body quotes an older head. Historical status/ledger prose cannot override present source or the user's reported success.

**Bounded work after implementation authorization:** Maintain one reviewed, dated release register in existing shipping/coordination documentation, linking exact current repo commits, PR heads, image digests, configuration/contract/SDK/CLI versions, migration ledger and acceptance receipt. Correct generated `ship-packet.mjs` risk text to distinguish compatible image replacement, incompatible SDK/format and unfinished/in-flight work; correct its focused test expectations. Amend stale descriptions only through their existing owners. Preserve historical receipts as historical rather than rewriting them to claim a later pass.

**Dependencies:** MR continuity assessment; MX-02 reviewed receiving candidate; release owner evidence. No live readback is presumed available.

**Acceptance:** Every public claim answers which source/image/environment/time and which exact scenario; historical first-chat success remains recorded; candidate11 source does not imply live qualification; an unknown is explicit. A generated packet cannot print “all conversations fail after every render” for an image-compatible release.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3997` through line 4004. MX-04 retained schema/integrity duties. Current Root/Release ownership controls actual protected operations; no migration is authorized to Fable by this source extract.

#### MX-04 · Complete the capability-specific migration and least-privilege grant packet
**Priority / type:** P0 data-integrity/activation gate.

**Evidence and root cause:** EX-03 enumerates 42 app SQL migration files on audited main; four are qualification-only. Two product conversation migrations (0018/0019) are not listed by the first-chat runner. PR197 adds Memory retention/tombstone schema consumed by its new journal. Existing integration stages intentionally stop ordinary runs before commands/schedules/artifacts/Memory additions. First-chat migration success is not full-product readiness.

**Bounded work:** Build a schema-to-consumer manifest from the accepted combined tree. Classify every migration product/integration/qualification/held; include constraints/indexes/triggers/functions and exact hash, prerequisite, role and readiness probe. MM specifies its missing Memory schema and retention bundle; MX packages it once. Add new append-only migration/grant entries with central ordinal allocation and a reviewed upgrade path for already-ledgered environments. Do not edit ledgered SQL bytes or insert/reorder prior entries, silently run qualification schemas in product, or infer that absent 0012/0014 are accidental holes. Use existing per-service roles, RLS/current-authority functions and rollback/restore owners.

**Dependencies:** MM retention and PR178 adoption decision; MT commands/routines/objective source requirements. Core migrations stay with prior X-05 and their Core owner.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4006`. MX-04 retained meaningful DB acceptance; obsolete separate-approval sentence omitted under current STANDING-REQUIREMENTS Current roles and WORKFLOW:1/2.

Disposable PostgreSQL16 tests cover empty database, exact existing ledger prefix, repeated application, partial failure/restart, mismatched hash refusal, narrow production-role operations, forbidden cross-tenant reads/writes, CAS/concurrent calls and correct runtime readiness.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4006`. MX-04 retained operator evidence, executed by existing Release under Root allocation.

Read back object ownership/privileges/schema hashes after any later migration; never count source SQL as installed.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4060` through line 4062. MX-09 current title/override/priority. Historical owner/proxy measurement paragraph omitted; it is not current acceptance evidence.

#### MX-09 · Measure latency, cost and resource behavior without duplicating P1/P2
> **[RE-SCOPED 2026-10-23]** Measure on the new path against the targets in `STANDING-REQUIREMENTS.md` §6. "Without duplicating P1/P2" no longer applies: they are deleted. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.
**Priority / type:** P1 performance qualification; existing owners retain implementation.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4066` through line 4070. MX-09 current bounded work, dependencies and acceptance on Runtime V1.

**Bounded work:** Measure actual Runtime V1 cold start, warm follow-up and idle restore with one recorded clock/sample/source/config protocol. Preserve first-text and acknowledgment targets; report SDK/model TTFT, Core/AWS/DB calls, tokens/cost, queue time, refusals, cancellation and cleanup. No synthetic sleep-as-proof, larger auth deadlines or uncertain effect replay to improve apparent latency.

**Dependencies:** Current Runtime/control owners, MX-08 and native image/capability qualification.

**Acceptance:** Same-hardware/serial base-head source comparisons classify failures; controlled deployed sample meets approved thresholds or remains explicitly blocked. Report failures and refused/slow samples, not only successful timings; no summed overlapping test totals. P1/P2 are historical; no owner/proxy rewrite is created by this ticket.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4048` through line 4049. MX-08 retained title/priority.

#### MX-08 · Turn existing telemetry into a verified operational feedback loop
**Priority / type:** P1 readiness/operability; do not rebuild P0.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4053`. MX-08 retained work; obsolete pair-retirement/budget-quarantine runbook entries and removed service dependencies omitted per register.

Validate emitted schema/dimension names against existing filters/alarms/dashboard and material rollout. Add only missing checks for selected new capabilities/receipts. Correct any stale count descriptions.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4053`. MX-08 removal duty, not a requirement to preserve or qualify those mechanisms.

Use current allocated runtime and observability owners; remove obsolete pair/budget alarms with their services.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4057` through line 4057. MX-08 retained acceptance; selected alerts untested remain unaccepted. This does not authorize sending an external alert.

**Acceptance:** Synthetic traces/EMF examples validate redaction and bounded line size, deduplicate durable receipts and preserve underlying failures. Later controlled live turn correlates request/run/cost/output history and dashboard without secrets. All selected alarms are connected and tested or recorded as unaccepted; cancellation is not counted as success, missing data is not a healthy proof, aggregate+subset are not double-counted.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4109` through line 4110. MX-13 title/priority. Historical removed owner/proxy/PKI/checkpoint test-body instructions omitted; current WORKFLOW forbids blanket repeated audit/gate campaigns.

#### MX-13 · Close the honest regression receipt, including host-sensitive and native-only gaps
**Priority / type:** P1 qualification; some failing source assertions may block P0 paths.

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4118` through line 4118. MX-13 retained relevant-capability acceptance; evidence fields applicable only to current retained owners.

**Acceptance:** Each selected capability has clean relevant positive/negative/contract/native tests or a named blocking defect; waived optional held tests cannot qualify enabled paths. Receipts pin source/tree/dirty state/host/packages/command/selectors/time/output hashes, distinguish declared archive commit from verified provenance, and do not add overlapping counts. All first-chat/next-turn/deploy/Stop regressions remain in the suite.

## Matching Meri E scenarios, verbatim with applied exclusions

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4290` through line 4297. E01–E08. References to a completed checkpoint mean the current durable native SDK SessionStore/artifact lineage, never the removed custom checkpoint mechanism.

| E01 | Authenticated selected-client first chat | One admission/run, real response, durable transcript and correct current actor/client |
| E02 | Reload/new tab after completion | Same messages/citations/artifacts, correct ordering and no prompt redispatch |
| E03 | Double click and lost submit acknowledgment | Same request identity reconciles to one accepted effect/run; no duplicate |
| E04 | Transport disconnect before/after first text | Cursor replay neither drops nor duplicates durable events; browser close does not silently Stop |
| E05 | Session expiry and transient Core503 | Retryable unavailable differs from revoked identity; no unauthorized bytes or false success |
| E06 | Sign-out/tenant/client change with stored draft/intent | Old data/credentials/receipts cannot cross the new identity or client |
| E07 | Stop at queue/load/start/model/tool/output phases | Logical stop fence and physical cleanup/unknown status are distinguishable; no later unauthorized effect |
| E08 | Failed/cancelled turn after completed checkpoint | Next allowed turn uses last valid published checkpoint, not failed partial state |

Source: `docs/handover/20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md:74` through line 76. E09/E10/E11 controlling current acceptance replaces the older candidate11/reserved-successor/pin wording.

| E09 image-only release after a completed turn | KEEP | The conversation continues after a deploy |
| **E10** deploy or rotation while an old run is in flight | **RE-SCOPED** | Stop works and the run closes or resumes cleanly. No pins |
| **E11** SDK, CLI or format incompatibility | **RE-SCOPED** | A clear message and a recap or new-chat choice (O103); no silent session loss |

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4301` through line 4301. E12.

| E12 | Resume/fork/retry/steer/pause | Correct exported contract semantics, exact target, current scope and one receipt; unsupported cases explicitly unavailable |

Source: `docs/handover/20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md:79` through line 79. E40 replacement. Do not copy the obsolete reservation/UNKNOWN liability scenario.

| **E40** budget / terminal usage missing or contradictory | **SUPERSEDED** | Replaced by: record available canonical SDK usage once, preserve unknown accounting explicitly without fabricated usage or failing a completed answer, and enforce the tenant cap through its existing owner |

Source: `docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:4330` through line 4330. E41; surviving P0 telemetry behavior. E39 is excluded: no owner/proxy pair exists.

| E41 | P0 telemetry failure/redaction | Underlying work semantics unchanged; dropped counter/alerts truthful; no secrets/prompt/client identifiers |

Source: `docs/handover/20261022/plan/FINAL-PLAN-20261021.md:166` through line 169. Phase0 historical selection: retain idle/deploy continuity outcomes on current architecture. E11 can be proved by test; Fable need not trigger an incompatible production deployment.

**Done when (on preview):**
- E01–E04, E08 and E09 pass, and E11 passes by test;
- a conversation left idle for 20 minutes still works;
- a conversation opened before the Phase 0 deploys still works after them.

Source: `docs/handover/20261022/phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md:94` through line 95. T3–T6/H1/H2 and approved simple-turn limits. Proposed targets remain proposals, not newly mandatory gates.

- T3 to T6, H1 and H2 pass on preview. Their definitions are in the S2 packet on #202 (comment 6355731525): T3 first turn completes; T4 follow-up in the same conversation; T5 reload while streaming reconnects; T6 Stop mid-stream ends cleanly; H1 conversation history loads; H2 the history filter menus.
- Within the agreed limits per simple turn (Core calls ≤ 30, Core time ≤ 3 s) at minimum. *Proposed targets:* Core calls ≤ 5 (control, excluding tools the model chooses to call), AWS calls ≤ 10 excluding standard Runtime invocation, DB statements ≤ 300, first delta within about 3 s of `run.running`, the full answer within about 2 s of the model stream ending.

## A1: all 17 assigned ticket IDs, current bounded scope

Source: `docs/handover/20261022/plan/FINAL-PLAN-20261021.md:217`. A1 exact allocation. Historical staging/nothing-new-on cells omitted under current standing rule4/autonomous completion; actual qualified preview readiness remains prerequisite.

ST-01, ST-02, WS-02, WS-03, WS-04, PF-10, PF-11, PF-12, PF-22, ML-02, ML-03, ML-07, ML-08, ML-09, ML-10, X-04; ST-24 (security-sensitive writes)

Source: `docs/handover/20261022/plan/FINAL-PLAN-20261021.md:217`. A1 retained acceptance, through applicable current exact-source and deployed evidence.

Direct-API negative tests pass.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2242` through line 2248. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### ST-01 — Close the branding object-ownership bypass (P0, MAIN defect, pre-activation blocker)

**Evidence/root cause.** The generic PUT branding DTO and fixed frontend operation allow arbitrary logoS3Key/logoContentType. TenantAdminService writes them without the prefix/HEAD checks enforced by the dedicated confirm path. Branding GET later signs the stored key with shared bucket credentials. This is an exposed API boundary issue even though the current name form sends only name. Additionally confirm HEAD checks existence but not returned ContentType/ContentLength despite its comment. [Frontend contract][st-operations], [generic update, L381–400][st-tenant-service], [signing/finalization][st-branding-core], [DTO][st-tenant-controller].

**Bounded tasks.** Narrow generic branding update to name (or route every logo field through the same authoritative finalizer if backward compatibility requires it). Reject cross-tenant/nonbranding keys at both write and signed-read boundaries. Validate actual HEAD type/size against allowed values and configured limits; use an exact tenant-owned upload object, not an unverified client assertion. Keep existing presigned POST flow; no new storage architecture. Review existing persisted keys in a separately authorized operational step before exposing suspect keys.

**Dependencies/tests.** Core and FE operation change together; ASSETS_BUCKET/IAM/CORS qualification. Direct API tests with another tenant's key, arbitrary same-bucket object, omitted/false MIME, oversize HEAD, missing object, stale upload, and corrupted existing row must refuse and never produce a signed foreign-object URL. Legitimate own-tenant upload/name save still works. No live exploit test was performed.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2252` through line 2258. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### ST-02 — Enforce protected-member removal server-side (P0, MAIN defect, pre-activation blocker)

**Evidence/root cause.** Controller minimum role is user_admin. removeMember blocks self but not a target capiro_admin before marking membership removed and queuing Clerk deletion. Adjacent role-change code does reject capiro_admin; UI hides Remove, but API callers can bypass that. The issue is within the actor's tenant, not demonstrated cross-tenant access. [Controller L160–195][st-tenant-controller], [service L300–363][st-tenant-service], [UI L218–225][st-team].

**Tasks.** Define the existing intended protected-target rule explicitly and enforce it inside the removal transaction before any local state/outbox mutation. Use HQ's distinct authorized personnel lifecycle for any intentional staff removal. Preserve immediate local revocation plus durable outbox for allowed ordinary targets.

**Tests.** user_admin→capiro_admin target denied with unchanged membership and no outbox; self denied; standard user denied; foreign-tenant ID absent/denied; ordinary active target removed and old access refused even if Clerk fails; retry idempotency; explicit HQ path authorized only as designed.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2472` through line 2480. A1 includes consequential/security-sensitive writes only; the complete source body shows the shared A1/A2 split. Remaining ordinary forms are A2, not new Wave1 scope.

#### ST-24 — Finish mutation lifecycle, receipt, and scope safety across remaining forms (P1 for consequential HQ/security writes; P2 elsewhere)

**Evidence/root cause.** useSettingsAction suppresses stale callbacks and exposes AbortSignal, but most callsites omit scopeKey and ignore the signal. Many dialogs allow backdrop/Escape/onClose while busy and fields remain editable. Examples: Team remove; Billing checkout/cancel; HQ create/delete/comp, key drawer/removal and broadcast send; mapping/analyst dialogs. Profiles create protects closing but not input edits. Signature editor disables typing but not upload/drop/default switch. Bulk mapping loop dispatches sequential requests without checking scope cancellation. [Hook][st-action-hook], [Profiles][st-profiles], [signature][st-signature], [HQ dialogs][st-tenant-dialogs], [AI drawer][st-ai-keys], [broadcasts][st-broadcasts], [mapping loop][st-mappings].

**Tasks.** Apply the existing safe dialog pattern per form, not a broad state-management rewrite: snapshot/freeze target and payload, disable editing and dismiss while mutation is in flight, pass signal and scope identity where safe, stop dispatching remaining bulk items after scope invalidation, preserve exact pending/unknown result record. Aborting fetch is not evidence the backend cancelled a write. On dispatched timeout re-read the exact resource/outcome before offering retry; avoid automatically replaying invite, broadcast, credential rotation, tenant create/delete, comp, or decisions. Verify semantic receipt target/status/value when available, and explicitly reconcile read state where responses are only ok.

**Acceptance inventory.** Apply to personal title, signature, branding name, contact, profile create/archive/restore, team invite/resend/remove/role/billing, integrations, billing handoff, HQ tenant create/delete/resend, customer comp, AI credential set/remove/model, broadcast send/archive, mapping single/bulk/manual/contractor, analyst decisions/alias/delete/merge/quarantine. Preserve already repaired Invite/Register/Disconnect/Profiles busy-close protections rather than regress them.

**Tests.** Double click; Enter+click; input edit; Escape/backdrop/Close/Cancel; route/tab/tenant/Clerk-account change; 401/403 midflight; response for wrong ID; malformed 2xx; failure after server commit; delayed readback; partial bulk completion. No false success in a different scope, no hidden background continuation beyond the initiated bounded work, no lost newer draft.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:1542` through line 1548. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### WS-02 — Enforce current Hill Day document/client authority everywhere (P0)

**Evidence/root cause:** [HillDay service][ws-hill-service] listDocuments applies client wall only when a client filter is supplied; the unfiltered Hill Day query is tenant-only. get/quality/assertDoc do not receive actor; getClient is called with a null user. Owner writes do not consistently recheck current client wall. [Generation job reads][ws-hill-generation] and [export status][ws-hill-export] are tenant/document scoped without actor. These differ from source-guarded ordinary drafts.

**Bounded work:** Introduce one small Hill Day resource admission helper using existing actor resolution/client-wall lookup. Apply it to list rows, get/quality/context/resolution, job/event reads, edit/generate/refine/export and signed-link issuance. Preserve owner-write policy; explicitly decide whether reads are tenant-team or owner-based, but always enforce the current client's wall and active membership. Do not add a new ACL platform.

**Acceptance:** Tenant A vs B, same-tenant unrelated member, owner whose client access was revoked, removed member, invalid IDs, filtered/unfiltered list, direct URL, job ID and export ID tests; forbidden rows do not leak title/count/source text. A formerly issued public grant follows the explicit expiry/revocation policy, not an accidental authenticated fallback.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:1562` through line 1568. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### WS-04 — Canonical client association for legacy drafts (P1, cross-Portfolio dependency)

**Evidence/root cause:** [Draft DTO][ws-draft-ops] accepts only display-name client; [newsletter create][ws-newsletter-save] sends client.name. [Schema][ws-schema] retains legacy string association. [Merged library][ws-hill-service] and Portfolio Work match names. [Saved-revision projection][ws-saved-revision] explicitly refuses legacy client hints unless snapshot/current config.clientId are valid and equal. Therefore a normal client-selected basic newsletter cannot stage to Outreach using the current flow.

**Bounded work:** Add canonical nullable clientId to the ordinary draft owner contract and persisted association (prefer typed column plus safe snapshot field), validated against active client/current wall. Carry it in create/read/save/version/library/Portfolio adapters; retain display name only for presentation. Backfill only provably unique authorized mappings, keep ambiguous/renamed legacy rows held for explicit association, and never infer prospect conversions from names. Define immutable revision attribution versus current-client changes.

**Acceptance:** Duplicate names, rename, inactive/deleted client, reassignment, revoked wall, firm/null and snapshot mismatch. Creating a client newsletter, saving, reopening from Portfolio and staging must retain the same UUID and succeed; ambiguous legacy content must not migrate or become visible to the wrong client.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:597` through line 607. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### PF-10 · P0 native-read blocker · Four meeting reads do not establish current selected-client visibility

**Evidence:** [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1448); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6138); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6194); compare stronger [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1460); [feeds.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/feeds.ts). PR111's checklist independently retains these four GETs held.

**Root cause:** GET engagement/meetings, meetings/:id, notes and debriefs use tenant/ownMeetingWhere. Filtering by associated client is not the same as a current user/client ethical-wall check. The stronger getClientMeeting helper is not the authority used by these ordinary endpoints.

**Bounded work:** Allocate client-scoped meeting read methods/DTOs or strengthen the existing endpoints with an explicit authorized-client parameter. Resolve current native tenant/user, current active client visibility and meeting-to-client association inside the authoritative transaction; use equivalent checks for notes/debriefs and redaction. Retain separately authorized owner/unassigned-library behavior without treating it as authority for client context. Do not merely add frontend selectedClient checks.

**Dependencies:** Shared native authorization qualification for the selected ordinary deployment cohort, Engagement owner, current client-wall grants; any cache keyed by prior client needs invalidation.

**Acceptance:** Native tests for owned meeting on hidden client, recently revoked grant, archived client, moved meeting, foreign tenant, owner-only unassigned library and legitimately shared content. Four routes remain held until passing; distinguish “not available” from permission-leaking metadata. This is a proven source admission gap, not a claim that a live leak was observed.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:611` through line 619. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### PF-11 · P1 · Editing an unchanged client assignment rewrites meeting association provenance

**Evidence:** [MeetingForm.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/MeetingForm.tsx); [meeting-save.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/meeting-save.ts); [mutations.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/mutations.ts); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1563); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1664).

**Root cause:** Meeting edit sends clientId. Backend checks presence of that property and invokes reassignment even when the ID is unchanged; reassign writes manual reason/score and isInternal=false. “Changed=false” avoids some downstream reset but does not preserve provenance.

**Bounded work:** Frontend omits clientId if unchanged from the reviewed saved meeting. Backend independently makes unchanged assignment a semantic no-op and preserves association reason, score and internal state. For real changes require expected current association/revision, explicit reviewed target, client-wall/capacity policy as applicable and an attributable receipt; refresh old/new client calendars and related artifact metadata.

**Acceptance:** Change only subject/time on auto-associated or internal meeting preserves all association fields and no reassignment audit/event. Actual client change updates exactly once; stale/moved/hidden target refuses. A malicious unchanged clientId cannot trigger side effects server-side.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:623` through line 631. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### PF-12 · P1/P2 · Debrief list omits approval/sharing metadata needed by artifact controls

**Evidence:** [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6138) includes approvedAt/approvedBy/sharedAt/sharedBy; [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6194) returns debrief fields without that metadata; [MeetingArtifacts.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/MeetingArtifacts.tsx#L191) depends on it.

**Root cause:** Asymmetric notes/debrief read projection. The frontend intentionally does not invent sharing state; debrief rows can show unavailable and cannot expose reliable Unshare from absent sharedAt.

**Bounded work:** Publish one versioned artifact metadata projection for notes/debrief reads, including nullable approval/share timestamps, actor IDs/names with visibility rules, content/source revision and current action capabilities. Use it in list and mutation receipts, and align frontend schema. Do not assume absent optional field means unshared.

**Acceptance:** Create → approve → share → reread → unshare → reread works for both artifact types; false/unavailable/null are distinct; unauthorized role cannot infer actors or act; response loss does not show success merely from stale cached row. Verify both selected meeting and shared-library surfaces.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:751` through line 759. Apply recorded-kind completion eligibility; rich-metadata editing is separately allocated, not newly pulled into A1. See explicit ruling below.

#### PF-22 · P1/P2 correctness · Undated commitment/request cannot settle; rich metadata cannot be edited

**Evidence:** [QuickLogDetailFields.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/quick-log/QuickLogDetailFields.tsx) makes due date optional; [ActivityActions.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ActivityActions.tsx#L49); [activity-change.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/activity-change.ts#L30); [client-activity.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-activity.service.ts#L366); [ActivityDialogs.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ActivityDialogs.tsx).

**Root cause:** Settlement checks dueAt presence instead of activity kind. Backend update selects id/dueAt and rejects settled when no dueAt. The edit DTO only supports title/body/pinned/settled, so an undated commitment cannot be given a due date through this editor. Direction/counterparty/Objective metadata is captured at create but cannot be revised here.

**Bounded work:** Decide canonical lifecycle rule: recommended completion eligibility is recorded kind commitment/request regardless of optional dueAt. Update backend kind validation and frontend action availability together; reject settling all other types. If due required is intended, make it explicit at create and migrate/review existing undated entries instead. Allocate versioned rich metadata editing separately with due-day/timezone semantics, objective-version authority and stale-write protection.

**Acceptance:** Dated and undated commitment/request settle/reopen; note/email cannot; due date edit preserves local intended day; stale linked Objective/current client refuses inappropriate reassociation; old entries remain reachable; no loss of recorded metadata during title-only edit.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2846` through line 2853. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### ML-02 — Prevent automatic replay of Graph mutations below the send ledger
**P1 confirmed release blocker; owner: Mail provider adapter.**

`graphFetch` retries every method on 429/5xx with small Retry-After, including `POST /me/messages/{draftId}/send`. Ambiguous-send classification runs only after that helper completes. A caller-level “never retry” promise therefore does not guarantee one provider invocation. Current send tests stub `graphPost/graphPostNoContent`, bypassing precisely this retry code. [ML-S19][ml-ML-S19] [ML-S24][ml-ML-S24] [ML-S65][ml-ML-S65]

**Tasks:** add explicit retry semantics to the existing Graph transport: read-only retries allowed; create/send mutations default no replay after dispatch. A definite pre-acceptance rejection may be a new explicit attempt only under ledger policy, not generic HTTP recursion. Keep draft creation and send separate, preserve draft/correlation evidence, and classify unknown at the actual network boundary. Apply this to ordinary compose, Meri, durable outreach and newsletter through the shared adapter.

**Acceptance:** real helper with fake fetch receives send 500/429 + Retry-After, response loss, socket close, malformed result; assert exactly one send POST and unknown/definite failure as appropriate. GET retry tests remain. No live send needed for this test. Dependency: none; precedes ML-03/04/05 and any send release.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2857` through line 2864. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### ML-03 — Give single-mail an actor-scoped durable dispatch identity and recovery receipt
**P1 confirmed release blocker; owner: Mail backend + Portfolio frontend.**

Single-mail sends before saving any receipt and accepts no request key; frontend's random attempt lock is React Query memory with infinite cache lifetime, not a server ledger or cross-tab/reload guarantee. A 30-second proxy timeout, reload, second tab or process failure can lose the only lock. Backend correctly warns on ambiguity/receipt loss, but there is no durable lookup to resume. Existing outreach intents already implement the relevant claim/unknown pattern. [ML-S03][ml-ML-S03] [ML-S30][ml-ML-S30] [ML-S38][ml-ML-S38] [ML-S44][ml-ML-S44] [ML-S45][ml-ML-S45] [ML-S46][ml-ML-S46]

**Tasks:** extend the existing mail domain with a bounded single-message intent/receipt record or shared low-level delivery primitive, not a new platform and not fake campaign records. Bind tenant+actor+request key to exact mailbox, reply target, recipients including Bcc, subject/body hash, signature policy/content snapshot and attachment manifest. Commit pending then claim before provider dispatch. Expose owned status/read receipt; never recycle sending/unknown to pending automatically. Replay same key returns existing state; different content same key conflicts. UI retains intent ID and resumes/polls after navigation/reload, distinguishes safely rejected from unknown, and offers reconciliation rather than blind retry. Persist provider acceptance even if current visibility is later revoked, while withholding body/details from unauthorized reads.

**Acceptance:** concurrent duplicate requests/processes, reload/cross-tab, timeout before/after dispatch, failure after provider acceptance before DB commit, revoked client permission and changed sender. At most one irreversible send dispatch per intent; zero sends on preflight/authority rejection; unknown remains fenced pending reconciliation and survives restart. This is not an exactly-once delivery claim. Graph draft creation and send are separate provider calls. Reuse Core104's post-provider outcome-persistence principle, not its legacy campaign function as a substitute. [ML-S68][ml-ML-S68]

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2901` through line 2908. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### ML-07 — Complete server-side client/person preflight before irreversible single-mail send
**P1 confirmed missing explicit preflight; owner: Mail backend + Portfolio access policy.**

The server checks thread ownership/originating connection and attachment access, but `sendSingleMail` does not explicitly load/authorize input client/person associations before provider dispatch. Attachment validation returns immediately when no attachment IDs exist. Thread preflight selects id/connectionId, not client binding; the frontend currently enforces the client relation, which direct API callers can bypass. Later persistence failure is too late to stop a sent message. [ML-S30][ml-ML-S30] [ML-S42][ml-ML-S42]

**Tasks:** before ledger creation/dispatch, resolve current client visibility and allowed operation using the same Portfolio policy; validate person IDs and their client/tenant membership, client/thread association semantics including recipient-derived histories, and source-document distribution. Recheck relevant mutable authority immediately before claim/send. Do not prohibit valid recipient-derived null-client histories accidentally. Ensure private inbox ownership does not silently grant access to a revoked client.

**Acceptance:** no attachments, nonexistent/foreign/archived client, inaccessible same-tenant client, foreign person IDs, recipient-derived thread vs directly assigned thread, grant revoked during attachment fetch. Assert zero provider calls on every rejection. Dependencies shared client policy; donor Core104 contains related outreach access hardening but not a complete single-mail fix.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2912` through line 2919. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### ML-08 — Make adding versus reconnecting a mailbox identity-safe
**P1 confirmed unsafe transition; owner: OAuth services + Settings.**

Top-level Connect submits an empty body; OAuth start selects the newest existing caller/provider row when accountEmail is absent. Callback overwrites row accountEmail/homeAccountId with the chosen account and retains old sync state; an omitted new refresh token can preserve the prior row's refresh token. Selecting account B while reconnecting A can therefore change the identity underneath A's cursors/history. [ML-S01][ml-ML-S01] [ML-S12][ml-ML-S12] [ML-S13][ml-ML-S13] [ML-S14][ml-ML-S14] [ML-S15][ml-ML-S15]

**Tasks:** distinguish create-new from reconnect-existing explicitly. Bind OAuth state to expected connection/provider/actor/identity intent. Reconnect must prove the same stable provider account ID, otherwise refuse with a clear “add another mailbox” flow; adding another creates an independent row. Never retain a previous account's refresh token or cursors after identity changes. Handle existing same-account unique conflicts transactionally, with no cross-owner takeover. Confirm the actual account before showing connected.

**Acceptance:** A->A reconnect without new refresh token, A->B attempted replacement, two concurrent starts, callback for deleted row, registered account email differs, same email identity changed, duplicate existing mailbox. No cursor/history/token crosses identities. Dependencies ML-11/25.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2923` through line 2930. Apply O146 bounded fail-closed skip-and-continue minimum below. Full mailbox-qualified key migration remains tracked before ML-04 lineage reconciliation; not a new Wave1 migration campaign.

#### ML-09 — Mailbox-qualified persistence identity
**P1 residual cross-mailbox integrity risk; owner: Mail persistence/schema.**

MailThread and MailMessage uniqueness is `tenantId, source, externalId`, not connection/mailbox. Sync looks up those keys and updates connection association. This is unsafe if provider IDs collide across mailboxes or one message's identifier is reused across imported accounts; provider-wide uniqueness across every mailbox is not proven by this schema. Current single-mail upsert has an additional connection/thread mismatch check, but provider sync needs the same invariant. [ML-S22][ml-ML-S22] [ML-S35][ml-ML-S35]

**Tasks:** reproduce with synthetic two-mailbox same-ID fixtures. Adopt mailbox-qualified keys or a stable mailbox-lineage namespace after reviewing reconnect semantics; at minimum fail closed on mismatched existing connection rather than reassigning it. Migrate indexes and all readers/upserts/removal/reconciliation paths together; preserve historical URLs and disconnected lineage. Do not mass reassign ambiguous old rows.

**Acceptance:** same tenant different owners, same owner two accounts, same provider message/thread IDs, shared-message copies, reconnect and deletion. No row or attachment transfers ownership; reader remains owner-scoped. Dependency ML-08/17; blocks trusting ML-04 reconciliation.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2934` through line 2941. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

#### ML-10 — Remove wrong-account token-cache fallback and prove refresh concurrency
**P1 confirmed fallback defect plus residual concurrency risk; owner: Microsoft OAuth/token.**

Both refresh-token selectors return the last cache entry if an expected homeAccountId has no match, contrary to the OAuth selector's stated exact-account guarantee. Initial OAuth uses a fresh MSAL instance, but refresh uses a shared instance/cache; concurrent account refreshes widen the risk. No exploit is asserted. [ML-S11][ml-ML-S11] [ML-S23][ml-ML-S23]

**Tasks:** exact expected-account match or fail closed; only permit single-entry fallback if account identity is truly absent and independently verified. Isolate cache per refresh/connection or serialize guarded refresh with a durable version/CAS update. Bind returned access-token account/scopes to the connection before writing. Prevent late refresh from resurrecting disconnected/replaced connection or overwriting a newer rotated token.

**Acceptance:** unmatched home ID with several cache entries, simultaneous two-account refresh, rotated token races, refresh after disconnect, stale callback. No wrong-account token persisted or returned. Dependencies ML-08/25.

Source: `docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:308` through line 318. Unchanged retained ticket. Native/mock acceptance may be reused when exact-source applicable; real sends are not authorized by this research or by generic acceptance.

### X-04 — Preserve and test current tenant/client/session authority at every hop

**Priority:** P0 security acceptance gate; domain-specific fixes are listed in their domains. **State:** substantial existing authority implementation, not a missing global auth layer. **PR disposition:** preserve receiver safeguards; do not overwrite with old donor code.

Core resolves current local user/membership/tenant, cross-checks Clerk org/tenant claims and rejects removed/suspended memberships. Separate services use the required `ORG_TENANT_RESOLVER` and TenantGuard, resolving canonical UUID rather than treating Clerk org IDs as tenant UUIDs. The shared guard's source notes that Workspace `ws_*` data relies on guard plus explicit tenant predicates rather than PostgreSQL RLS. Tenant authorization alone does not prove owner/collaborator/client authorization. The frontend selected client is a navigation/data-scope hint, never authority. Ordinary Core identity handling can provision/self-heal/update last-seen; a supposedly read-only live probe must not be assumed mutation-free merely because it uses GET. Dedicated preview native reads intentionally bypass those mutations.

**Bounded work.** Reuse the current guards and current-membership checks. Domain owners add missing resource/role/client predicates only at identified holes. Test stale cached identity, no selected client, client switch while a query/write is pending, active→removed membership, same-tenant wrong owner, wrong tenant, archived client, impersonation constraints, provider connection owner mismatch and role downgrade. Ensure response/error/redirect data cannot leak another tenant's existence or tokens. Do not synthesize tenant claims or widen server permissions to make a fixture pass.

**Acceptance.** Negative cases deny before provider/storage/write effects; pending results from a prior user/org/client are discarded; reload uses the current actor; current membership is rechecked at irreversible send/share/decision boundaries where required. Same-tenant ACL tests are separate from cross-tenant tests.

**Evidence:** [Core middleware](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant/tenant-context.middleware.ts), [shared TenantGuard](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/packages/auth/src/tenant.guard.ts), [resolver contract](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/packages/auth/src/org-tenant-resolver.ts), [scope lifetimes](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/CapiroBoundary.tsx).

### WS-03: canonical removal override, verbatim; obsolete approval body excluded

Source: `docs/handover/20261022/plan/FINAL-PLAN-20261021.md:293` through line 293. This is the current controlling WS-03 scope. Do not restore approval service/routes/contracts/UI or require approval before Workspace sharing.

| 11 | Workspace approvals (A1 WS-03) | **Removed** (21 Oct, 22:50 UTC). No approval workflow in Workspace, and no dead code left. Stored approval data stays untouched until an approved drop migration. Sharing, wall and ownership protections stay. Meri, release and Portfolio artifact approvals are unaffected (O143). |

Source: `docs/handover/20261022/decision-log/DECISION-LOG.md:803` through line 803. O143 recorded boundary; public sharing, walls and ownership remain. Historical relay is not current authority.

- O143 — Neo (via dot, 22:50 UTC): no approvals in Workspace; remove them with no dead code. Revised A1 list posted on #202/#105/#117. Removed: the WS-03 approval service, routes, contracts and UI, plus the blueprint approval fields; stored approval tables are kept untouched with marked Prisma models (no migration). Sharing, wall and ownership protections are unchanged. Meri, release and PF-12 approvals are unaffected. Earlier review item 6 is superseded.

Source: `docs/handover/20261022/phases/A1-REVIEW-PF-ML.md:45` through line 46. Recorded PF-22 and ML-09 bounded interpretations, retained as existing decisions, not new approval requests.

- **PF-22, approved: completion follows the recorded kind.** Commitment and request may settle or reopen with or without a due date; every other kind is refused. This is the ticket's own recommendation, it is simplest, and it needs no migration of undated rows. A required due date would force a backfill and change the create flow.
- **ML-09, approved for A1: the bounded fail-closed minimum.** Never reassign; the full mailbox-qualified key migration stays a tracked open item before ML-04 reconciliation trusts lineage. **Condition:** "fail closed" must hold the one colliding row and let the sync continue (counted and logged), never halt the mailbox. Otherwise one historical collision is a permanent outage.

Source: `docs/handover/20261022/decision-log/DECISION-LOG.md:806` through line 806. O146: skip-and-continue, keep guard; no pre-intent auto-clear on a potentially access-denied 404.

- O146 — Agent 3 boundaries: (a) a status 404 can hide revoked access, so #118 drops the pre-intent auto-clear; send reservation and recovery are unchanged and the gap is deferred. (b) Neo chose ML-09 skip-and-continue in chat: hold the colliding message, keep syncing, advance the cursor, keep the guard.

## A0 and historical scope boundary

A0 prerequisites are X-01/X-02/X-03/X-05/X-06, PF-01/PF-21/PF-24, WS-01, ST-26 and ML-01 (FINAL-PLAN:216). Reuse current qualified service/schema/provider topology and ordinary mounted routes. They do not authorize Fable to migrate, change configuration, reconnect accounts, send mail or rebuild an environment. Root/Release supply exact cohort and fixture readiness. Missing readiness is a named NOT RUN/BLOCKED condition, not a pass and not an automatic new user-approval flow.

S2 was pulled into Wave1 at DECISION-LOG:844 (O183), but current supersession removes S1/S2/P1/P2 proof/authority machinery. Their retained current simple-turn and revocation guarantees are in the rules, MF-02 and item0. The original owner-exchange count, pair repair timing, per-hop JWT/authority proofs, custom harness/continuity and per-turn Fargate topology are not current acceptance gates. Core authentication, tenant/member/client/wall rules, current access/revocation, user/firm memory and durable outcomes remain required.

All current deployment assertions and PASS/FAIL results are intentionally absent from this source extract. Docs-only validation: exact source reads and main-versus-checkout docs diff; executable/product/browser/AWS checks NOT RUN; new tests none; mutation N/A. Persistence is assigned to the sibling docs author in the same committed/pushed DRAFT PR.

## Source reference definitions (verbatim, for extracted ticket links)

[ml-ML-S01]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/IntegrationSettings.tsx#L48-L398
[ml-ML-S03]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/portfolio/api/proxy.ts
[ml-ML-S11]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-oauth.service.ts#L69-L80
[ml-ML-S12]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-oauth.service.ts#L96-L239
[ml-ML-S13]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-oauth.service.ts#L245-L355
[ml-ML-S14]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/google-oauth.service.ts#L105-L240
[ml-ML-S15]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/google-oauth.service.ts#L244-L451
[ml-ML-S19]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L526-L624
[ml-ML-S22]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L1490-L1635
[ml-ML-S23]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L1750-L1896
[ml-ML-S24]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L1919-L2025
[ml-ML-S30]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L9278-L9604
[ml-ML-S35]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/prisma/schema.prisma#L1524-L1592
[ml-ML-S38]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/email/send-attempt.ts
[ml-ML-S42]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L8815-L8872
[ml-ML-S44]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/outreach-send-intent.service.ts#L229-L470
[ml-ML-S45]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/outreach-send-intent.service.ts#L596-L1005
[ml-ML-S46]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/race-safe-outreach-send-intent.service.ts#L1-L59
[ml-ML-S65]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-send.service.spec.ts#L83-L103
[ml-ML-S68]: https://github.com/neo-capiro/capiro-backend/blob/5bf901173e839c0145069ec42e16dcb40c373ba6/apps/api/src/engagement/engagement.service.ts#L3265-L3300
[st-action-hook]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/useSettingsAction.ts
[st-ai-keys]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/AiKeysSettings.tsx
[st-branding-core]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/branding/branding.service.ts
[st-broadcasts]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/BroadcastSettings.tsx
[st-mappings]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/mappings/MappingSettings.tsx
[st-operations]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/settings.ts
[st-profiles]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/ProfileSettings.tsx
[st-signature]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/SignatureSettings.tsx
[st-team]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/TeamSettings.tsx
[st-tenant-controller]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant-admin/tenant-admin.controller.ts
[st-tenant-dialogs]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/TenantDialogs.tsx
[st-tenant-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant-admin/tenant-admin.service.ts
[ws-draft-ops]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/workspace-documents.ts
[ws-hill-export]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-export.service.ts
[ws-hill-generation]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-generation.service.ts
[ws-hill-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-document.service.ts
[ws-newsletter-save]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/use-newsletter.ts
[ws-saved-revision]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/packages/shared/src/workspace-saved-revision.ts
[ws-schema]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/prisma/schema.prisma

## Source reference definitions retained verbatim

[ml-ML-S01]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/IntegrationSettings.tsx#L48-L398
[ml-ML-S03]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/portfolio/api/proxy.ts
[ml-ML-S11]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-oauth.service.ts#L69-L80
[ml-ML-S12]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-oauth.service.ts#L96-L239
[ml-ML-S13]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-oauth.service.ts#L245-L355
[ml-ML-S14]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/google-oauth.service.ts#L105-L240
[ml-ML-S15]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/google/google-oauth.service.ts#L244-L451
[ml-ML-S19]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L526-L624
[ml-ML-S22]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L1490-L1635
[ml-ML-S23]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L1750-L1896
[ml-ML-S24]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-graph-sync.service.ts#L1919-L2025
[ml-ML-S30]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L9278-L9604
[ml-ML-S35]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/prisma/schema.prisma#L1524-L1592
[ml-ML-S38]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/email/send-attempt.ts
[ml-ML-S42]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L8815-L8872
[ml-ML-S44]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/outreach-send-intent.service.ts#L229-L470
[ml-ML-S45]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/outreach-send-intent.service.ts#L596-L1005
[ml-ML-S46]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/race-safe-outreach-send-intent.service.ts#L1-L59
[ml-ML-S65]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/microsoft/microsoft-send.service.spec.ts#L83-L103
[ml-ML-S68]: https://github.com/neo-capiro/capiro-backend/blob/5bf901173e839c0145069ec42e16dcb40c373ba6/apps/api/src/engagement/engagement.service.ts#L3265-L3300
[st-action-hook]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/useSettingsAction.ts
[st-ai-keys]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/AiKeysSettings.tsx
[st-branding-core]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/branding/branding.service.ts
[st-broadcasts]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/BroadcastSettings.tsx
[st-mappings]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/mappings/MappingSettings.tsx
[st-operations]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/settings.ts
[st-profiles]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/ProfileSettings.tsx
[st-signature]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/SignatureSettings.tsx
[st-team]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/TeamSettings.tsx
[st-tenant-controller]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant-admin/tenant-admin.controller.ts
[st-tenant-dialogs]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/TenantDialogs.tsx
[st-tenant-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant-admin/tenant-admin.service.ts
[ws-draft-ops]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/workspace-documents.ts
[ws-hill-export]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-export.service.ts
[ws-hill-generation]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-generation.service.ts
[ws-hill-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-document.service.ts
[ws-newsletter-save]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/newsletter/use-newsletter.ts
[ws-saved-revision]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/packages/shared/src/workspace-saved-revision.ts
[ws-schema]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/prisma/schema.prisma
