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

# Wave 2 handoff — administratively closed with carryovers, 26 October 2026

**Administrative status: CLOSED WITH CARRYOVERS. Functional acceptance: CHANGES.** Neo directed: give Fable the remaining Wave2 issues, close Wave2, continue with a fresh Wave3 orchestrator, and receive Fable's results in Wave3. This supersedes the earlier wait-for-results instruction. It does not convert FAIL, NOT RUN or UNKNOWN into PASS. No new Wave2 repair/acceptance cycle is allocated.

The accepted release is deployed. Fable now owns the residual Wave2 fixes listed below. Existing Hermes authors finish their current publication/review handbacks and stop; no competing authors are launched on Fable's paths. Root merges this documentation and dispatches the fresh orchestrator; no new chat or goal was created by the documentation author.

## 1. Stopping point and changes since the last handoff

The coherent Meri87dc / frontend d285 shipment is stable at **2026-10-26 00:34:47.377383 UTC**. Root then completed exactly **three new normal-browser submissions**, with no retry or original-unknown replay. General admission/history and client reads worked at the observed boundaries, but General stored-email lookup failed with model-reported ACCESS_DENIED, prepared actions stayed unavailable, and the Stop case raced completion. The canonical acceptance addendum retains **CHANGES**.

Fable's FE167–170 fixes are merged, shipped and trusted. Their accepted checks were not repeated. Meri memory/document fixes are also live; fresh full workflow acceptance was not performed. Original M1 memory-save and D1 document-create effects remain UNKNOWN. Neither the new smoke nor infrastructure health establishes the historical control5xx cause or original request delivery.

Two current Hermes handbacks are preserved: Outlook Core139 has **CHANGES for recovery documentation**, with no projection-code defect found and independent13/13 health checks passing; frontend172 has **CHANGES / DO NOT MERGE** because generic access-loss recovery can reserve an unintended successor for a previously started terminal conversation. Both are inputs for Fable, not accepted live repairs. Both old Hermes author processes have finished or their stop is confirmed; no further Wave2 source cycle is allocated. Remaining work and a copyable prompt are in Root outputs and the standalone `FABLE-WAVE2-CARRYOVER-BRIEF.md` beside this handoff.

This final dated record supersedes current-state/next-action prose in the25 October checkpoint and the earlier26 October shipping checkpoint. Their evidence, failed attempts and original unknowns remain in the historical file/Git history. Administrative closure removes the Wave2 orchestration gate for Wave3; it does not assert full product acceptance.

## 2. Live components, candidate pins, database and snapshots

Actual Release receipt: `LIVE-87DC-D285-ROLLOUT-HANDOFF.txt`, stable **00:34:47.377383 UTC**, SHA256 `7b64867fa1bff03962612279576c5b8b65a67a88f19b977baff3c9321ff2ac5b`.

| Component | Exact deployed source / image digest | Actual state |
|---|---|---|
| Core15 | `929acd023c29d9073cbf9d5c5105eba8c3252948`; `sha256:49722d1332083d97b0df9139a0eed063ba4516d987b67883ace1c819ba0540a4` | Unchanged, HEALTHY |
| Meri Control72 / Worker68 / Schedule5 | `87dc649e829779d5f47e1a0cc5b0e939e0c729d2`, tree `8e5083e9bed316fdd38015b92331d202dfc33020`; `sha256:2e8d7c2f3bc7124d3c00e35ba0aa5196b84b35c4b04147025e29fb8d800dde3e` | HEALTHY; all material initializers exit0; matching Control targets healthy |
| AgentCore standard RuntimeV1 | Same Meri source/image | Runtime9 / named preview9 / DEFAULT9 READY |
| Frontend33 | `d285e659f2bfbc00bfbd464b8c6f07dfba898d5d`; `sha256:bbd949f8b32327b285c8b047b7041698102e9baccc8afabe034f37a4fe3327ac` | RUNNING / ALB healthy / TLS200; ECS task health UNKNOWN because there is no container healthcheck |

Both CloudFormation updates and drain completed; five services each desired/running1, pending0. Only source/image/version/material pins changed. No feature flag, provider, DB/PKI, schema, DNS, network, sizing or policy change. Meri reused its once-qualified image; frontend d285 was built once and production build/container smoke/exact-digest scan passed with zero reported findings. FE9070 image was superseded and never deployed. No broad source/acceptance suite repeated.

Worker68 had two initial essential-container exit3 starts after material-init0; the first recorded RUNTIME_UNAVAILABLE. Native ECS scheduling produced the healthy third task without manual retry/configuration change. **Cause unproved**; preserve the failures without inventing another product diagnosis or automatically restarting a campaign.

Release retains exact rollback Control71/Worker67/Schedule4/FE32 definitions/materials ACTIVE and unchanged, with Core15 and named preview8/Runtime8 retained. DEFAULT9 is not assumed to rewind automatically. Existing Release alone owns rollback; no data/effect replay or restoration of removed infrastructure. Keep canonical `UpdateReplacePolicy: Retain`. Two allocated obsolete staging-label associations were removed for capacity while current/rollback/reserved labels stayed protected; no explicit secret-value deletion.

Historical database evidence is unchanged: snapshot `capiro-newstack-preview-clone-pre-wave2-20261025t0541` AVAILABLE25 October06:04:37; Core ledger686 at10:13:16.544; Meri ledger60 at10:15:33.711–10:15:35.478; Schedule ordinary LOGIN/SCRAM/TLS at10:15:50.162. These are not fresh queries. This shipment applies no migration. Preserve the one preview clone/applied history; Core139 and all open Wave3 changes are not implied deployed.

## 3. Source integration, open PRs, review and gates

| PR | Exact merged result / scope | Fable evidence reused |
|---|---|---|
| [FE167](https://github.com/neo-capiro/capiro-frontend/pull/167) | `30c00d48118a7938c4a6884b71fb64f18080d3e2`; chooser/Home pill/triggers | Unit17/17 and production-data11/11 PASS; lifecycle10/10 FAIL identical baseline |
| [FE168](https://github.com/neo-capiro/capiro-frontend/pull/168) | `84ae41bbc37db88b241a478d3a8af573d71c45d4`; Conversations filters/table/rename/Trash | Unit6/6, management-browser3/3, production-data11/11 PASS |
| [FE169](https://github.com/neo-capiro/capiro-frontend/pull/169) | `861009f073084aa328ffe4a46c8dbc3b202a57a8`; Memory cards/search/receipt flash | Unit2/2 and owner-review-browser3/3 PASS |
| [FE170](https://github.com/neo-capiro/capiro-frontend/pull/170) | `d285e659f2bfbc00bfbd464b8c6f07dfba898d5d`; Routines list/connect gate | Unit34/34 PASS; Routines-browser5/5 FAIL identical baseline |

All four reported lint/format/TypeScript checks are clean. Fable's final report supplied by Neo is authoritative; no separate final-report file was found, and missing command/UTC details were not fabricated. Counts are per suite, not summed as unique tests. The10+5 baseline failures are harness debt, not new product defects or passed checks.

[Meri268](https://github.com/neo-capiro/meri-greenfield/pull/268) is merged at87dc. Donors265/266 are closed as incorporated. Reuse accepted MCP/memory/document14/14 and positive TXT publication/replay proof; no duplicate donor replay or test run. Scripted authority/SQL/TXT proof is not native Office/live PG/S3/current customer authority. Corrected document-preparer counts remain base4 total/2PASS/1FAIL/1SKIP and head7 total/5PASS/1FAIL/1SKIP. Existing broad failures/skips remain in their owner receipts.

| Current Fable input | Status / exact source | Required disposition |
|---|---|---|
| [Core139](https://github.com/neo-capiro/capiro-backend/pull/139) | OPEN DRAFT head `a2b827d75c59362d7595dece8bbcbedfd987180f`, base `722f094cf60e40b2fb270bb5c1e06bf66d795c42`, target backend-import | **CHANGES for recovery documentation**; no projection-code defect found, independent13/13 PASS. Author13/13 and adjacent116PASS/2 inherited FAIL; package build failed and typecheck reported1175 diagnostics, the same count as baseline but not proof of identical diagnostics. The author base-build comparison is not independently established. Correct overclaimed whole-sync/all-worker cause and unproved callback-routing/Send-consent prescription. Author-reported timestamps are not independently verified. Adopt after acceptance; not a live sync repair |
| [FE172](https://github.com/neo-capiro/capiro-frontend/pull/172) | OPEN DRAFT head `71f6343993d60a3595417de1b9212b150e783557`, base d285 | **CHANGES / DO NOT MERGE.** Generic accessLost drops runId and actual next-run owner reserves a successor for a started terminal run. Exact selector reserves none. Correct through canonical proven-unstarted recovery; never infer it from401/403/missing history/accessLost |

FE172 author reports55 focused PASS including5 new, two killed helper mutants, typecheck/format PASS, lint0errors/83warnings; broader1410PASS/3FAIL identical base. Architecture has inherited signals/no boundary errors, not full PASS. Candidate Linux/browser/container/live gates NOT RUN. These checks do not override the reproduced P1 reservation defect. The probe proves a reservation, **not** execution, duplicate delivery or data loss. Original broad5xx cause remains UNKNOWN.

Existing Hermes authors finish only current publication/review handbacks then stop. Fable is the residual source owner; Wave3 validates results when Neo posts them, reviews only actual changed risk, and merges/ships accepted fixes through existing Release. No parallel Wave2 authors or new repair cycles.

## 4. Acceptance, failures and unrun checks

Root's actual normal-browser smoke on the exact deployed tuple: **3 submissions,0 retries,0 original-unknown replays; allowance exhausted**. Acceptance records the owner handback in `FABLE-REPORTED-CHECKS-ADDENDUM-20261026.txt`; Acceptance executed0 new model/browser cases.

| Case / UTC | Observation | Result and limit |
|---|---|---|
| PS1 /00:35:50 | New General request Completed; current history loaded,9 Recent links. Model reported `mail_list_messages` ACCESS_DENIED and returned no records | Admission/history LIMITED PASS for this case; requested email read FAIL. Raw gateway receipt NOT INSPECTED. Model claim that General cannot read mail is **not canonical policy**; no empty-mailbox inference |
| PS2 /00:37:34 | Authorized client profile Completed; active status/description matched Root's prior normal Portfolio UI observation | Client-profile UI read PASS at this comparator boundary. Tool attribution model-reported; no fresh raw receipt or public customer data |
| PS3 /00:38:29 | Same conversation recalled marker and streamed fictional text. Stop clicked once after last observed Running; terminal Completed/story finished | Context follow-up PASS; streaming observed. Cancellation NOT PROVEN / race with completion, never Stop PASS or USER_CANCELLED |

**Prepared actions remained unavailable in both scopes.** No conditional memory/document workflow check ran. Original M1/D1 effects stay UNKNOWN. New memory/document source is live, but fresh decision/publication/download/correction/recall flow is unverified. New successful General admission does not disprove the earlier22:47 control5xx or establish the original failed request's delivery/cause.

Fable's focused residual scope: (1) actual General stored-mail authorization/result boundary; (2) explicitly safe session recovery and historical admission/history diagnosis where evidence supports it; (3) Outlook read-sync configuration/status/renewal, adopting Core139 if accepted; (4) prepared-actions reads; (5) affected memory/document workflows with exact outcome preservation. Stop cancellation remains an unproved assertion, not a newly proven Stop defect.

Separate limitations, not an invented bug/rebuild campaign: NOT RUN fixture-dependent Objective/Strategy, converted-prospect file/contact/brief, reviewed hearing/source, restricted-role and research denial cases; incomplete task/routine occurrence/future pause, broader memory correction, all-format/renderer/provider workflows; physical idle restore/retention/erasure crossings; attributable simple-turn Core≤30calls/≤3000ms and backend cancellation/SDK/all-writer closure. Preserve earlier bounded passes and actual PG proof. Missing fixtures stay NOT RUN; no forced customer/provider mutation.

Unavailable capability limits: four legacy Intel generators; legacy Stage-G/Context Import generation; General-scope Objective generation; disabled PDF/visual previews. Broader later-phase work remains separately sequenced. Earlier33-row matrix12PASS/7FAIL/14NOTRUN and prior11/12 model packet retain original time/cohort; Root's new three calls are a separate allocation, not an invented combined counter. No extra checks follow from closure.

Docs-only validation: no product tests/builds, browser/model/provider/AWS/database action. New executable tests0; mutation N/A; only ordinary documentation prefix/link/whitespace/source consistency checks. Existing evidence reused.

## 5. Decisions and pending Neo decisions

The actual decision log was checked through O258 before this final update; **O259** records Neo's latest instruction to assign residual Wave2 fixes to Fable, close Wave2 administratively and continue with a fresh Wave3 orchestrator. This supersedes waiting for more results and the old requirement to hold all Wave3 integration behind a full-Wave2-PASS claim. Functional acceptance stays CHANGES; unresolved work transfers explicitly.

No new product decision is required to start Fable's bounded repairs. Actual OAuth consent, if later proved necessary, is a normal human action for Neo, not something an agent performs on Neo's behalf. Do not preemptively demand reconnect or infer invalid credentials. Keep current Core gatekeeper/walls, authorized General mail access, no blanket General-mail ban, no auth bypass, no external send or new architecture. A real newly discovered scope/security tradeoff goes to Neo; ordinary in-scope work proceeds.

Outlook's retained screenshot correction is binding: provider-not-configured copy/disabled action belong to **Gmail**, not Microsoft365. Actual Microsoft symptoms are stale/degraded sync and expired subscriptions. Release observed only the serving Core15 task's shadow/background-owner-disabled/callbacks-false posture and absence of eight explicit Microsoft/OAuth bindings. This does not prove invalid credentials or absence of every possible background worker. Read-sync activation must use the correct existing owner and bounded configuration; do not enable unrelated outbound send behavior by guesswork.

O258's interim Runtime9/preview8 state and pending smoke are superseded by§2/§4 actual results; original entries remain historical. Permanent Retain, forward-schema-compatible rollback, privacy and unknown-effect fences remain binding.

## 6. Traps for a fresh session

- Administrative CLOSED WITH CARRYOVERS is not all-PASS acceptance. Fable owns remaining Wave2 source; do not start competing Hermes/Codex authors or a new Wave2 cycle.
- Do not merge FE172 as-is. Generic401/403/accessLost is not proof that an original never started; clearing runId can reserve a successor on the separate next-run path.
- A model-reported mail denial is not a raw gateway receipt or policy. General may read actor-owned stored mail across already permitted clients while Core enforces walls; no blanket ban or authority bypass.
- Gmail's unconfigured warning is not Microsoft evidence. Shadow task configuration is bounded to the observed serving owner, not a global worker/credential audit.
- UNKNOWN original effects are not zero; reconcile exact identity using existing receipts, never silently replay. No new prompts are allocated by the exhausted smoke.
- Reuse Fable167–170 and accepted Wave3 source/tests. Inherited10+5 browser failures remain harness debt; no broad regression/rebuild campaign.
- Keep full Claude SDK/RuntimeV1/Core tools/durable user and firm memory. Removed owner/proxy/issuer services/custom pools stay removed. Core default is backend-import.
- Preserve Ordinary Atomic Save's Workspace/session/shared-file ownership and all local environments. Fable must not overwrite Wave3 files to fix a separate chat/mail issue.

## 7. Temporary resources and diagnostics to delete

Release completed reviewed retirement at25 October21:59:13.047385 UTC: six operations terminal,66 managed declarations removed,9 in-place changes,231 retained resources; eight foundation exceptions keep original identities. Old model/issuer task definitions INACTIVE, not byte-erased. The separately allocated orphan egress rule was removed and the blocked security-group deletion completed. Do not repeat retirement or restore deleted identifiers during rollback.

Temporal's five services retained revision4/count1/native groups; five old tasks stopped. Before/after SDK/native TLS queue probes passed with one workflow and one activity poller each. Two owned diagnostics stopped/exit0; diagnostic definition INACTIVE. This is not all-workflow acceptance. Historical worker failures and operator connection failures remain evidence.

Docs created no cloud/process resources. Existing launchers close only their own completed Hermes processes and preserve checkouts/results; no new author loop. Preserve shared WSL/services/DB/auth/config/caches, rollback material, held histories and unknown-effect fixtures. No forced fixture deletion, broad SQL/log/key cleanup or shared-environment reset.

## 8. What is not in this public repository

Private locations by owner/name only; no customer names/IDs/UUIDs, prompt contents, screenshots, credentials, signed URLs, tenant mappings, secret values or PKI are copied.

| Owner / location | Record |
|---|---|
| Root outputs | `WAVE-2-REMAINING-ITEMS.md`, `FABLE-WAVE2-CARRYOVER-BRIEF.md`, `FABLE-WAVE2-REMAINING-FIXES-PROMPT.txt`, final handoff and Wave3 orchestration/parallel plan |
| `wave2-visible-release/outputs` | `LIVE-87DC-D285-ROLLOUT-HANDOFF.txt`, `MERI-87DC-IMAGE-HANDOFF.txt`, `RETIREMENT-V2-COMPLETE-STABLE-HANDOFF.txt`, `OUTLOOK-CORE-RUNTIME-POSTURE.json` |
| `wave2-visible-acceptance/outputs` | `FABLE-REPORTED-CHECKS-ADDENDUM-20261026.txt`; sealed historical matrix/finite packet and Root read supplements unchanged |
| `wave2-general-chat-email-repair/outputs` | `FABLE-CARRYOVER.txt`, `HERMES-RESULT.txt`, `HERMES-REVIEW.txt`; exact FE172 CHANGES and original incident limits |
| `wave2-visible-schedule-worker/outputs` | `HERMES-OUTLOOK-REPAIR-BRIEF.txt`, `HERMES-OUTLOOK-STATUS.txt`, `HERMES-OUTLOOK-RESULT.txt`; later committed PR139 head supersedes older head references |
| `wave2-visible-integration/outputs` | Accepted memory/document/source composition and current source receipt history |
| Release private work | `shipment87dc/live-handoff.json`, exact bindings/rollback/snapshot custody; SHA256 `ceee43a64b17b1d8ca454ffaf9acc65df25d4f97631454524406ce2288cdd512` |
| `wave2-visible-mail/outputs` | `outlook-pr139-independent-review-20261026.txt`; SHA256 `4610996331a42d7b6e0cb25fcac767cd4a96f5c8e48d792cf1f9e2d76dd493a4` |
| Existing Wave3 owner outputs | Final independent review evidence index, accepted PR records and active Ordinary Atomic Save README/brief |

No separate final Fable report artifact was located; Neo's supplied report and Acceptance's attributed addendum remain authoritative. This provenance limit does not justify revalidation.

## 9. Next-wave briefs, bases, ownership and first actions

Fresh Wave3 source defaults at preparation: Meri main87dc, frontend main d285, Core backend-import `722f094cf60e40b2fb270bb5c1e06bf66d795c42`. These source defaults differ from deployed Core929acd. Refresh before new source work; preserve accepted stacked Wave3 bases and active writers.

| Owner | Next action |
|---|---|
| Old Root | Merge/publish this final docs handoff; dispatch one fresh visible Wave3 orchestrator. Cede orchestration only after successor acknowledges goal, final receipt, Fable ownership, shared-path freezes and sole Release |
| Fresh Wave3 orchestrator | First create the user-requested goal to complete Wave3 including explicit carryovers, no token budget; Ultra. Read `WAVE-3-ORCHESTRATOR-BRIEF.md` and `WAVE-3-PARALLEL-LANE-PLAN.md`; preserve Fable's exclusive residual-Wave2 ownership. Receive Neo's Fable results there, review targeted changed risk, merge/ship accepted fixes |
| Fable | Fix the five focused carryover groups, reuse available drafts safely, correct FE172 CHANGES before any acceptance, preserve Wave3-owned files. Return exact source/PR/check/outcome evidence to Neo for posting in Wave3 |
| Existing Hermes owners/reviewers | Finish current publication/review handback only, then stop; no new Wave2 cycle. Handbacks remain available to Fable |
| Wave 2 — Release Execution Continued | Remains sole AWS/build/deploy/rollback owner. Current deployment complete; await successor's concrete accepted candidate, no duplicate rollout |
| Wave 3 — Ordinary Atomic Save | Continue existing publication/review; local72unit/23browser PASS, same33base TypeScript errors, architecture/import disposition pending. Preserve its named shared files |
| Other existing Wave3 lanes | Parallel M3 and A3 actual plan work on distinct paths; helpersxhigh, Hermes for complex/stuck issues outside Fable-owned scope, separate Codex review. Accepted stacks/evidence reused; later phases not invented as blockers |

No prior-chat memory is needed: standalone source/rules/owner paths, exact current PRs and test limits are in the adjacent briefs. No new session, goal, merge or deployment was performed by this docs author. This is the final Wave2 administrative handoff with explicit functional carryovers.
