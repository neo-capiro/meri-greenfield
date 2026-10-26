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

# Wave 2 handoff — shipping checkpoint, 26 October 2026

**Status: IN PROGRESS. Accepted fixes are merged and shipping is authorized. Full Wave 2 closure is not claimed.** Neo's latest instruction is to trust Fable's fixed items, avoid repeating their validation, merge the PRs, provide the remaining list and ship. This record follows that instruction. Release is the sole shipper; the focused General Chat and Email Repair owner retains the active runtime defect.

This dated record supersedes the *current-state and next-action wording* of the [25 October checkpoint](../20261025/WAVE-2-HANDOFF.md). That file, its original evidence, failed attempts and unknown outcomes are unchanged. The latest Fable acceptance is supplied through Root's authoritative handback; it is not a new execution by this documentation author. Final coherent deployment and post-deploy results are pending their actual owner receipts.

## 1. Stopping point and changes since the last handoff

- Root merged frontend PRs **167, 168, 169 and 170 sequentially**, without repeating Fable's tests. Frontend main is `d285e659f2bfbc00bfbd464b8c6f07dfba898d5d`.
- Meri memory/document corrections are merged at `87dc649e829779d5f47e1a0cc5b0e939e0c729d2`, tree `8e5083e9bed316fdd38015b92331d202dfc33020`. The once-built ARM64 image is qualified; rollout is in progress.
- Fable's verdict remains **CHANGES for control history/admission 5xx after 2026-10-25 22:47 UTC**. Root's General stored-email lookup failed before any mail read; delivery/effect remains unknown. The new focused owner is working that existing boundary. Stored-mail reads remain Wave 2 MT03/ML22 scope.
- The earlier native document-create and governed memory-save effects remain **UNKNOWN**, despite accepted source fixes. No new request may silently substitute for an uncertain original effect. The affected post-deploy workflow checks remain open.
- Retirement has advanced beyond the old checkpoint: Release completed the six reviewed operations at **2026-10-25 21:59:13.047385 UTC**. Section 7 records the actual result and retained exceptions. Do not execute the superseded retirement proposal again.
- Release now reports Runtime **9 READY / DEFAULT9** while named preview remains **8** pending coherent rollout. This intermediate state is not an accepted deployment tuple. The frontend build for exact `d285e659` has started; no resulting digest or health is inferred.

## 2. Live components, candidate pins, database and snapshots

The last complete pre-rollout tuple is preserved below from the **25 October 19:38:40.090581 UTC** actual Release receipt. The retirement receipt confirms the same product tuple at21:59. These are measured historical facts, not a fresh cloud read by docs. Runtime9 has since advanced separately as stated above; current coherent readiness is pending Release.

| Component | Exact pre-rollout source and image | Revision |
|---|---|---|
| Core | `929acd023c29d9073cbf9d5c5105eba8c3252948`; `sha256:49722d1332083d97b0df9139a0eed063ba4516d987b67883ace1c819ba0540a4` | Core15 |
| Meri | `09e89db9b57c8fcb5b1aa15a4d1479074c8bbe16`; `sha256:876a7267e9ab231769379800a7c487f3f45860d975b8da7349756484534cc6d0` | Control71 / Worker67 / Schedule4; Runtime8 / preview8 / DEFAULT8 |
| Frontend | `1dfd5893525ad31b7e6622371b1d4e1ddb6bcbf1`; `sha256:8dc0eb6fcc58fcb7d6f651762d98afc2f966d1a9dc6bdde0fb4fe0fb17468bf2` | FE32 |

The original five service deployments were completed with desired1/running1/pending0; Core/Meri and targets were healthy, initializers exited0. Frontend has no container health check: task health UNKNOWN, with RUNNING/ALB/HTTPS verified. Health is not functional acceptance.

| Current candidate | Achieved stage | Outstanding |
|---|---|---|
| Meri `87dc649e829779d5f47e1a0cc5b0e939e0c729d2`, tree `8e5083e9bed316fdd38015b92331d202dfc33020`; `sha256:2e8d7c2f3bc7124d3c00e35ba0aa5196b84b35c4b04147025e29fb8d800dde3e` | One ARM64 build completed25 October23:05:38.277 UTC; canonical probes, txt/docx/xlsx/pptx/zip generation smoke and cleanup PASS; scan COMPLETE with0 findings | Coherent service/runtime receipt and affected live outcomes |
| FE `d285e659f2bfbc00bfbd464b8c6f07dfba898d5d` | Accepted Fable fixes merged; exact archive verified by Release; one build starting | Built digest, qualification and actual deploy receipt |
| Earlier FE `90702180dfb6d529745d01601db85a7f09a81369`; `sha256:e0385b3f3321976355aa2387828189573d2a95fdad78ce1f42805836c0d52098` | Ready predecessor image | Superseded as the final Fable-fix source; do not call this the d285 image |

Database evidence remains historical: encrypted snapshot `capiro-newstack-preview-clone-pre-wave2-20261025t0541` was AVAILABLE at06:04:37 UTC; Core ledger **686** at10:13:16.544, Meri ledger **60** at10:15:33.711–10:15:35.478, and Schedule ordinary LOGIN/SCRAM/TLS at10:15:50.162. The last recorded product rollout applied no migration. No new database operation is performed or inferred here. Applied history and the persistent preview clone must remain intact.

Release's prepared normal rollback target for the new candidate is the pre-rollout **Core15 / Control71 / Worker67 / Schedule4 / FE32 and Runtime8/preview8/DEFAULT8** cohort with its exact saved compatible bindings. Source comparison found no SQL/migration/public-contract change in the Meri candidate; that is compatibility evidence, not a rollback rehearsal or current live receipt. The older14/70/66/3/31 and named-runtime7 custody is historical. After retirement, never blindly restore deleted security-group identities. Release alone owns current rollback, retaining forward schema/data and reconciling CloudFormation. Canonical `UpdateReplacePolicy: Retain` stays in place.

## 3. Source integration, open PRs, review and gates

| PR | Merged result / accepted scope | Fable results reused without rerun |
|---|---|---|
| [FE167](https://github.com/neo-capiro/capiro-frontend/pull/167) | `30c00d48118a7938c4a6884b71fb64f18080d3e2`; scope chooser, Home pill and triggers | Unit17/17 PASS; production-data11/11 PASS. Selected lifecycle10/10 FAIL, identical baseline |
| [FE168](https://github.com/neo-capiro/capiro-frontend/pull/168) | `84ae41bbc37db88b241a478d3a8af573d71c45d4`; Conversations table, filters, rename and Trash | Unit6/6 PASS; browser management3/3 PASS; production-data11/11 PASS |
| [FE169](https://github.com/neo-capiro/capiro-frontend/pull/169) | `861009f073084aa328ffe4a46c8dbc3b202a57a8`; Memory cards/search and receipt-flash fix | Unit2/2 PASS; owner-review browser3/3 PASS |
| [FE170](https://github.com/neo-capiro/capiro-frontend/pull/170) | `d285e659f2bfbc00bfbd464b8c6f07dfba898d5d`; Routines list/connect gate | Unit34/34 PASS; Routines browser5/5 FAIL, identical baseline |

Fable reported lint, formatting and TypeScript checks clean for all four. These results are authoritative under Neo's latest direction. The lifecycle and Routines failures remain inherited harness debt; they are not relabeled PASS and do not trigger another qualification cycle. Exact commands/run UTC not supplied in Root's handback are **NOT AVAILABLE to this author**, not invented or rerun. Counts across suites are not added as if unique.

[Meri268](https://github.com/neo-capiro/meri-greenfield/pull/268) is merged at87dc. Accepted donor265/266 are closed as incorporated; do not cherry-pick them again. Integration retained exact accepted code and reused the actual MCP/memory/document14/14 PASS and positive TXT publication/replay proof without rerunning them. The latter uses scripted authority/SQL/CAS/TXT execution and does not prove live PG/S3, native Office rendering or current customer authority. Earlier broad-intent failures/skips remain in their receipts. Corrected document-preparer full-file counts are base4 total/2 PASS/1 FAIL/1 SKIP and head7 total/5 PASS/1 FAIL/1 SKIP; historical parser interpretations are superseded, not deleted.

The General Chat and Email Repair source work is active; **no new accepted head/PR is asserted** by this checkpoint. Fable's runtime CHANGES is not closed by merging UI changes or deploying the unrelated memory/document candidate. Prior source/review records remain in the25 October handoff and owner briefs. The pre-execution Fable packet PR267 is a separate as-of documentation draft, not this final result or product fix.

## 4. Acceptance, failures and unrun checks

| Result | Evidence and limit | Next owner/action |
|---|---|---|
| **PASS — Fable fixed frontend items** | Accepted results in§3; no repeat review/test by docs | Release deploys exact merged source |
| **FAIL — control history/admission** | Fable 5xx after22:47 UTC; Root's General request showed unavailable history/initial input before stored-mail read | Focused General Chat and Email Repair owner; affected normal-sign-in lookup/follow-up after repair ships |
| **UNKNOWN — original M1/D1 effects** | Earlier memory save result unreleased/own inbox0; native document create lost access without an artifact receipt | Existing memory/document owners reconcile original identity; no blind replay |
| **FAIL, historical live boundary — Actions/Routines** | Earlier Actions uncertain then unavailable; routine form reset before Prepare. Newly accepted UI fixes remain closed | Only affected current behavior after deployment; no broad Fable rerun |
| **PASS, bounded earlier live behavior** | Echo/history, same-conversation recall and permitted synthetic read; current-memory listing; ordinary95-byte file upload/download/move/deletion receipt; S3 streaming/one Stop/UI Cancelled | Preserve these passes at their original cohort/UTC; they are not whole-feature acceptance |
| **NOT RUN / incomplete — governed workflows** | Routine execution/future pause, chosen task effect, memory approval/correction/fresh recall, native document publication/exact download/native rendering; M2/T1 were not executed in the earlier finite batch | Existing feature/Acceptance owners, using only required prerequisites and affected cases |
| **NOT RUN / unverified — retained runtime/retention guarantees** | Bound physical idle restore, complete simple-turn Core≤30calls/≤3000ms, owner-bound provider/SDK/all-writer closure and remaining object/Core/restore/erasure crossings | Existing Runtime/Release owners; reuse accepted evidence, no new broad proof framework |
| **NOT RUN — missing fixtures** | Eligible Objective/Strategy, converted-prospect file/contact/brief carry-over, reviewed hearing/source, restricted-role and allowed/denied/revoked research cases | Existing fixture owners. These do not delay the authorized deployment; do not manufacture customer/provider effects |

The earlier33-row matrix remains **12 PASS / 7 FAIL / 14 NOT RUN** for its original cohort. Later bounded deltas do not rewrite or recount it. Earlier finite model use was11/12 at20:23:30.7370001; Fable's later total is not supplied here, so11/12 is not the current cumulative allowance. Do not infer new model/effect authorization from an old unused slot. Acceptance could not verify a usable normal browser session. Root now owns a maximum three-prompt functional smoke after the exact deployed-ready receipt. It is NOT RUN at this checkpoint; no duplicate Acceptance batch is allocated.

Explicit unavailable capability limits remain: four legacy Intel generators; legacy Stage-G/Context Import generation; General-scope Objective generation; disabled PDF/visual previews. Existing hearing/evidence reads remain in scope. Broader later-scope work is not newly promoted into a Wave2 shipping blocker. Stored-mail provider coverage is separately stale/degraded. Neo has now authorized a fresh Hermes Outlook owner for Microsoft365 provider/configuration/sync and expired subscriptions, through the existing launcher. That follow-up is separate from admission/history/General email and is not complete. It does not authorize this documentation owner or the admission owner to mutate the provider.

The accepted native PostgreSQL stale-database restore fence remains **15 named groups in one scenario**, with an independent in-memory ledger, not proof of real S3 ledger restart/fullE36/physical erasure. The935.916s untouched UI interval is not proof of physical retirement. S3's54Core calls/2188ms candidate is not a simple-turn performance verdict. No special new telemetry event becomes a product gate solely to replace missing evidence.

Docs-only checks: no product tests/builds/browser/model/cloud/provider/database operations; no new executable tests; mutation **N/A**; executable test-count change **0**. Documentation receives only ordinary diff/whitespace/link/prefix/fact checks. Accepted owner evidence is reused.

## 5. Decisions and pending Neo decisions

[O258](../20261022/decision-log/DECISION-LOG.md#o258--recorded-2026-10-26-trust-fables-accepted-fixes-merge-ship-and-publish-the-remaining-work) continues the actual O257 sequence. Neo's latest direct instruction, relayed by Root for this task, is to trust Fable's accepted fixes, avoid overvalidation, merge the PRs, list remaining items and ship. Root completed the four FE merges. Existing Release is authorized to ship; the former Fable live-change hold has ended. No second reviewer, duplicate test campaign, new shipping operator or new approval ritual is introduced.

This direction does not fabricate a PASS for Fable's remaining runtime CHANGES, unknown effects or unrun acceptance. Shipping the accepted fixes and closing all Wave2 scope are distinct. Root reports actual remaining work and controls any completion notice. No new scope/security decision is requested by this documentation task. Current auth, tenant/wall rules, durable outcomes, external-send boundaries and rollback constraints remain binding.

O255–O257 remain historical engineering decisions with their original reasons and recovery bounds. Their earlier “no deployment allocated” status is superseded by the current shipping authorization; their retained evidence is unchanged. No invented retrospective O-number is assigned to intermediate owner activity.

## 6. Traps for a fresh session

- Read this checkpoint before the25 October current-state prose. Treat old tuples and holds by their stated UTC; a merge, ready image, Runtime9 update or health check is not the final coherent deployment or functional PASS.
- Do not reopen accepted Fable fixes, rebuild an unchanged qualified candidate or run another broad regression/review census. Preserve identical-baseline failures explicitly as inherited harness debt.
- General stored email fails before read admission. An unavailable or uncertain read is not an empty inbox; a client-filtered mail result is not a personal-mailbox completeness claim. Provider ingestion is a separate issue.
- Unknown memory/document/Actions outcomes are not zero effects. Use existing exact-request reconciliation; do not replay with a new identity.
- Preserve actual Claude SDK full harness, direct Bedrock, Control tools and Core authority. The [supersession register](../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md) removes old mechanisms, not retained product acceptance. Do not recreate owner/proxy/issuer services or a custom warm pool.
- File receipt/hash checks do not establish physical object/version erasure; unscanned/scanner_not_required does not mean clean. Schedule health does not mean a routine fired; UI Cancelled does not prove all writers or provider compute stopped.
- Preserve the shared local environment and preview clone. No credential extraction, provider reconnect/send, live data edits or new customer-linked evidence publication follows from this handoff.
- Core's default branch is `backend-import`, not `main`. Runtime and frontend source SHAs differ from deployment pins. Wave3 independent source work continues, but release-dependent integration awaits Root's explicit Wave2 completion decision.

## 7. Temporary resources and diagnostics to delete

Release's **RETIREMENT-V2-COMPLETE-STABLE-HANDOFF.txt** at21:59:13.047385 UTC supersedes the old “retirement proposal/not executed” state: six operations terminal; **66 managed declarations removed**,9 in-place changes,231 retained resources across those stacks. Eight foundation exceptions retain original physical identities. Old model/issuer task definitions are INACTIVE, not byte-erased. One separately allocated orphan egress rule was removed and the blocked security-group deletion then completed. Do not replay the retirement.

Temporal's five services retained exact revision4/count1/native groups; five old tasks stopped. Standard SDK/native TLS checks before/after passed with one fresh workflow and one fresh activity poller each. Both owned diagnostics stopped/exit0; temporary diagnostic task definition INACTIVE. This is queue/TLS evidence, not every workflow's functional acceptance. Earlier failed operator connection evidence remains preserved.

Docs creates no cloud, database or diagnostic process. Keep shared WSL/services/DB/auth/config/checkouts/caches, owner evidence, held histories and original unknown-effect fixtures. Release retains compatible rollback material and permanent Retain attributes; cleanup after the rollback window requires exact ownership/reference checks. No broad key/log/SQL/history deletion or forced fixture cleanup. Details and sensitive resource identities remain with Release.

## 8. What is not in this public repository

Private records are referenced by owner and filename only. Do not publish customer names/IDs/UUIDs, tenant/actor bindings, prompt bodies, screenshots, tokens, PKI, database URIs, private signed URLs or secret values.

| Owner / location name | Reused record |
|---|---|
| Root workspace outputs | `GENERAL-CHAT-EMAIL-REPAIR-BRIEF.md`; `WAVE-2-REMAINING-ITEMS.md`; Fable's completed acceptance as supplied in the current chat. Local `FABLE-WAVE-2-ACCEPTANCE-HANDOFF.md` is the earlier pre-execution packet |
| `wave2-visible-release` outputs | `MERI-87DC-IMAGE-HANDOFF.txt`, `RETIREMENT-V2-COMPLETE-STABLE-HANDOFF.txt`, `LIVE-CORRECTIVE-ROLLOUT-HANDOFF.txt`; current coherent successor receipt pending |
| `wave2-visible-integration` outputs | `WAVE2-MERI-MEMORY-DOCUMENT-COMPOSITION.txt`, `WAVE2-MERI-PUBLICATION.json`; accepted source composition and image facts |
| `wave2-visible-acceptance` outputs | `combined-corrective-retest-packet.txt`, `wave2-live-acceptance-matrix.txt`, Root General/client read supplements; original observations and held unknowns |
| `wave2-visible-runtime` outputs | `runtime-corrective-observation/RESULT.txt`, General-email triage/follow-on results; bounded runtime observations and metadata-only handback |
| Focused General Chat and Email Repair owner | Existing source diagnosis/repair checkout and private incident mapping; no new accepted fix head is asserted here |
| Release private work | Verified image, actual deployment, forward-schema-compatible rollback, exact sensitive resource/tenant/material bindings and snapshot custody |

A final standalone Fable result file has not been located in the scoped local search. The current authoritative facts come from Root's supplied Fable handback; this provenance limit is explicit and does not justify revalidation. Raw command/UTC details absent from that handback remain unavailable.

## 9. Next-wave briefs, bases, ownership and first actions

| Owner | Preserved scope / next action |
|---|---|
| Root | Sole Ultra orchestrator/merger. Accepted FE merges are complete. Coordinate focused runtime repair, ship receipts and remaining outcomes; merge this docs PR; issue Wave2 completion only when actual closure is justified |
| Release | Sole xhigh cloud/build/deployment/rollback operator. Finish coherent Meri87dc and FEd285 rollout; provide exact source/image/service/runtime/material/readiness and compatible rollback receipts. No repeated unchanged qualification |
| General Chat and Email Repair | Existing fresh xhigh owner and isolated repair checkout; complete the control history/admission diagnosis/fix through existing owners, then affected review/merge/deploy and one normal-sign-in General stored-email lookup/follow-up |
| Root / Acceptance | Root personally owns the maximum three-prompt post-deploy functional smoke after the exact ready receipt; Acceptance could not verify a usable normal browser session. Preserve Fable's accepted cases and original unknowns; no duplicate Acceptance batch or full-matrix rerun |
| Fresh Hermes Outlook owner | Neo authorized the existing launcher to start one scoped author for Microsoft365 provider/configuration/sync and expired subscriptions. Work is separate from General admission/history; no fix or completion is asserted yet |
| Memory/document and other feature owners | Reconcile original uncertain effects and close only concrete affected workflow gaps after matching deployment; carry unrun fixture-dependent obligations honestly |
| Handoff owner | Sole new canonical26 October writer on `codex/wave2-final-handoff-20261026`, base87dc; [phase brief](PHASE-BRIEF.md). Commit/push and open/attach draft PR; Root merges. Do not modify the25 October record to erase evidence |
| Existing Wave3 owners | Continue independently authorized source work on isolated branches. Ordinary Atomic Save retains its named Workspace/session/shared paths. No speculative Wave2 takeover; final release-dependent integration awaits Root's explicit completion notice |

Fresh sessions begin from the current standing block, [PROCESS6.1–6.3](../20261022/PROCESS.md#6-current-templates), plans/supersession register and their bounded owner brief. Refresh actual repository heads before a new source branch: this docs base is Meri87dc; frontend's accepted head is d285; Core uses backend-import and must be refreshed by its owner. Existing authorization persists. This checkpoint is not a final whole-wave completion notice.
