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


# W5-02 — M7 routines, Cowork and skills

FROM: Wave 4 root | TO: Wave 5 orchestrator / allocated M7 owner | TYPE: prospective phase brief

**Allocation:** FINAL-PLAN §5 M7; needs M4+M5; E32–E35. Reconcile in parallel with M5, then autonomously assign and implement finite confirmed slices with actual satisfied dependencies; no routine root-approval step.

**Repository/branch/base/dependency heads/worktree:** current Meri main plus narrowly allocated Core/backend-import and frontend main consumers. Record exact bases/dependencies/isolated worktrees first. Coordinate actual shared catalog/package/migration/registry overlap with root and the affected owner.

## Finite sequence

| Slice | Requirements | Existing owner and limit |
|---|---|---|
| Routine management/lifecycle | MR-03/04/10, MT-12, MF-18 routine portion | Existing schedule/consent/Temporal/intents; manage after chat ends, repair exact known outcome, firing/overlap/stop/history. No duplicate scheduler or paid turn merely to stop. |
| Narrow source events/history | MB-05 | Same occurrence/Temporal owner; current finite producer/event contract only. No live subscription/webhook registration. |
| Procedures/skill workflows | MO-01, MT-13, ST-16 | Existing Core store, selected SDK assets/admission/output. Preserve exact current versions. All-14 remains open where proof is missing; preserve Q07's skipped disposition and coordinate Research Portfolio workflows with Fable. |
| Durable Cowork/run views | MO-02, MF-11 | Existing lifecycle/goal/Temporal/read owners; output-dependent flows wait for M5. No new runner or automatic Planner/Strategy activation. |
| Usage/notifications | MO-10, ST-15/17 | SDK limits/compaction, one tenant cap/usage owner and supported notification keys. No reservation ledger, fairness framework or benchmark campaign. |

MF-18 browser/device activation is later M8 and excluded. E35 does not automatically allocate every A5 PF-06 feature. Wave 4 continuation/Stop/watch/task defects remain with Fable/root; do not redo them.

## Decisions and supersession

MR-04 uses current gateway run tokens, no authority-receipt layer. MT-12 uses SDK permission callback plus Core intents, no per-operation grant minting. MO-10 legacy reservations/P1-P2/task-pool wording is superseded by SDK limits, one tenant cap, compaction and Runtime limits.

Look up current source-event producer/types/policy, sustained-work entry/job kinds, shipped launchers, procedure governance and notification mapping. Escalate only unresolved choices. Do not select every fixture or republish the whole skills catalog. Preserve Q04/current admitted versions and scoped evidence.

## Evidence and done

Use focused tests for changed consent/outcome/races, controlled fixtures/clocks where allowed and Hermes for uncovered real integration. No naturally aged subject wait or repeated unchanged paid skill runs. Installed assets are not workflow proof; label gaps honestly.

Finite PRs include exact base/head/tree/files, task-owned cleanup, checks run/not run, Hermes review, dependencies and deployed acceptance still owed. Authors do not merge/deploy or perform formal acceptance.


## Current ownership and delivery rules

**Wave 5 source-work authority:** the user has asked to start Wave 5. After reconciling current code, evidence and dependencies, the Wave 5 orchestrator may itself assign finite M5/M7 slices and implement confirmed remaining requirements within these briefs. Record the exact base, owned checkout/files, author and affected checks; routine allocations do not need root approval. Coordinate actual shared-file, contract, resource or target overlap with root and the affected owner. Raise only genuinely missing product/scope decisions, and continue other independent work. A5 remains intake-only; all existing Research Portfolio requirements remain Fable's Wave 4 assignment.

**Direct user scope update:** the instruction to finish **all existing Research Portfolio requirements, including MO-05**, supersedes the earlier broader-module deferral. Fable owns that complete existing-spec implementation and bug-fix scope within Wave 4 closeout; see [Research Portfolio requirements](RESEARCH-PORTFOLIO-REQUIREMENTS.md). Root coordinates independent review, merge and deployment, followed by Hermes acceptance. This is not a Wave 5 Research Portfolio assignment. Do not create duplicate module authors; coordinate any shared module, skill, public-contract, catalog, schema or file overlap with root and Fable before edits. The Wave 5 orchestrator may allocate generic M5 artifact and M7 skill work independently within these briefs, coordinating actual overlap with Fable's Research Portfolio ownership. Q07 semantic remains skipped, outreach remains separate and onboarding remains excluded.

**Current direct-user instructions override historical roles:** the Wave 5 Codex orchestrator assigns and coordinates confirmed M5/M7 source work autonomously within these briefs. Fable scans and fixes remaining Wave 4 defects, completes all existing Research Portfolio requirements including MO-05, and returns PRs to the existing Wave 4 root. Root coordinates independent review, merges and ships through the designated release owner. **After deployment Hermes Agent app/CLI performs acceptance as usual.** Hermes remains the independent review and acceptance owner; Fable is not the formal acceptance owner. Root will notify Wave 5 when Wave 4 is actually complete after required Hermes acceptance, not at PR handoff or deployment.

Do not inherit old Fable/dot relay rules, an old prohibition on Fable participating, historical model settings, per-run Fargate, source-only holds or recurring issue watchers. Use the new session's configured default model. No public issue #202 post or external message is authorized by this document.

Reuse the existing owner and unchanged evidence. Check the affected real path early, make the smallest coherent change, run meaningful affected tests, obtain independent exact-head review, and build each candidate once when release needs it. Do not add a framework, generic abstraction, benchmark campaign, broad census or speculative capability to close a narrow ticket. Report tests run and not run; new executable tests need a meaningful failure witness/mutation where required by the existing process. Docs-only work has no executable tests and mutation N/A.

Wave 4 root/release retains the cloud, database, deploy/rollback and shared authenticated browser lock while Wave 4 closes. An isolated checkout does not isolate ports, Docker, schemas, catalogs, public packages or authentication. One writer per path; reserve shared contracts, migration IDs, lockfiles, architecture registry and build configuration before edits. Do not reset, move or clean another owner's checkout. Preserve WSL Codex-Gates, persistent services/data, caches and authentication. Shared target migrations/deploys are outside implementation briefs.

## Sources

The authoritative sources were read from C:/dev/w4-final-handoff-20261027 at Meri commit 651bdf370d13a715736ea7bce32cdd8f3a4b88d0. That checkout is owned by another lane and must remain untouched.

- [Standing requirements](../20261022/STANDING-REQUIREMENTS.md), particularly necessary qualification, environment retention and direct-user overrides.
- [Process current templates](../20261022/PROCESS.md#6-current-templates); exact source tickets are copied below.
- [Final plan §5 and §6](../20261022/plan/FINAL-PLAN-20261021.md); §5 contains M5, M7 and A5. §6 explicitly calls the dated wave schedule historical sequencing, not a current calendar or source allocation.
- [Supersession register](../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md); full Claude SDK, direct Bedrock, Core gateway and Runtime V1 remain canonical.
- Meri/application master path, section, line and durable source link accompany each original ticket.
- Root's final Wave 4 handoff and current decision log supersede dated operational draft facts. Root owns the current release receipt and Wave 4 ownership; Wave 5 assigns its own finite M5/M7 source slices within these briefs.

The canonical prefix is copied verbatim, including source-relative links. The authoritative standing-requirements link above resolves those source paths.

## Verbatim integrated scenarios

Source: Meri master, Minimum integrated regression scenarios. Select affected proof; this does not require repeating unchanged evidence or every negative case live.

| ID | Scenario | Required observation |
|---|---|---|
| E32 | Routine create/update/stop/list from completed chat | Durable schedule management does not accidentally require an active foreground run; authority remains narrow |
| E33 | Routine overlap/retry/DST/timezone/worker death | Exact occurrence/idempotency/consent, no double fire or silently lost due occurrence |
| E34 | Consent revoked or Stop during routine execution | Current cancellation proof/retirement, durable unknown where required, truthful inbox status |
| E35 | Objective/Planner continuation | Core owns workflow; source/run/reader grants exact; no resurrected legacy loop |

## Verbatim source tickets

The bodies preserve historical evidence. They are requirements and provenance, not current-head assertions. Apply scope limits and the supersession register first; never recreate retired mechanisms or re-merge old donors.

Source: [MR-03](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mr-03), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2674.

#### MR-03 · P1 · Define and wire foreground routine management after the originating chat ends
**Class:** S dependency, D supported product behavior, U live consequence. **Owner:** runtime routines; FE consumes.

**Root cause:** all attended routine context resolution is tied to a currently active Meri execution allocation. The selected run must be starting/running/waiting-for-approval; its allocation must be ADMITTED, unexpired and match the current render's versions and allocation hash. [apps/runtime/native-authority/routines-owner-composition.mjs:45–87](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/native-authority/routines-owner-composition.mjs#L45-L87) Routine list and reconcile also resolve/authorize through this owner. [apps/control/schedules/application.mjs:115–126](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/schedules/application.mjs#L115-L126)

This is appropriate evidence for execution capability but is not by itself a durable routine-management authority. A standalone Routines page after a completed/retired chat, a fresh sign-in, or an image change can have an existing owned schedule but no qualifying live chat allocation. Source therefore does not establish that the user can list, reconcile, narrow or cancel that routine then.

**Bounded work**
1. Add composed tests for list, detail-equivalent list filtering, prepare pause/delete, approval, read-consent refresh and cancellation with no active chat, terminal latest run, expired allocation and changed image.
2. Decide the supported contract explicitly. Recommended: keep execution/new allocation admission unchanged, but resolve read-only routine ownership and narrowing/stop management from the trusted current identity, membership, persisted schedule owner and exact schedule generation, not a running model allocation. Any ability to create/widen execution still requires the reviewed template/budget/current policy plus explicit approval.
3. Split only the management context facets in `routines-owner-composition.mjs`, `routines.mjs`, `schedules/runtime-context.mjs` and `schedules/application.mjs`; retain the native firing grant and per-occurrence admission owners. Never allow body-provided run/client/template selectors to establish authority.
4. If independent management is intentionally unsupported in the initial product, expose that exact held capability and an actionable authorized recovery route; do not require the user to start paid model work merely to stop a routine.

**Dependencies:** FE routine integration, Core current membership/owner checks, MR-01 for old original cleanup. Existing product-routines-flow tests exercise scripted authority and injected owners, not a live no-active-chat case. [apps/runtime/test/product-routines-flow.test.mjs:22–44](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/test/product-routines-flow.test.mjs#L22-L44)
**Acceptance:** a schedule remains manageable under its owner after chat completion/restart; stale/foreign generation and unauthorized widening are refused; routine “future firings stopped” and “current work physically retired” remain separate states.

Source: [MR-04](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mr-04), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2691.

#### MR-04 · P1 · Make routine read-consent receipt repair durable across dual-owner ACK loss
**Class:** S. **Owner:** routines/read-delegation integration, with Core owner dependency.

**Root cause/evidence**
- Consent is created/resumed/narrowed before the schedule mutation. Its reference is recorded beside the schedule only after an acknowledged mutation. [apps/control/schedules/read-consent-lifecycle.mjs:30–63](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/schedules/read-consent-lifecycle.mjs#L30-L63), [apps/control/schedules/application.mjs:95–113](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/schedules/application.mjs#L95-L113)
- An acknowledged approval replay returns before repairing that consent projection. The existing test explicitly asserts acknowledged replay touches no consent. [apps/control/schedules/application.mjs:85–89](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/schedules/application.mjs#L85-L89), [apps/control/schedules/test/read-consent.test.mjs:25–43](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/schedules/test/read-consent.test.mjs#L25-L43)
- Narrow/abandon failures are logged and not durably queued here; acknowledged-not-released consent recording is best-effort. A process loss after the schedule effect but before local consent custody can leave a valid routine whose local occurrence read join refuses. The join correctly requires a matching current active consent reference, and must stay fail-closed. [apps/control/schedules/occurrence-read-consent.mjs:28–45](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/schedules/occurrence-read-consent.mjs#L28-L45)

**Bounded work:** persist a narrowly scoped consent-transition intent/reference with the immutable schedule intent before dispatch; after ACK or reconciliation, repair only the same known consent and generation. Read back Core's current consent when outcome is uncertain; if no exact readback/idempotency contract exists, add that bounded owner protocol first. Do not mint a replacement widening consent during blind replay. Persist narrowing/abandon debt and its proven disposition rather than relying solely on logs. Expose “routine active, read consent unresolved/expired” distinctly from successful unattended reads.

**Files:** `read-consent-lifecycle.mjs`, `application.mjs`, `intent-reconciliation.mjs`, `postgres-schedule-owner.mjs` and a minimal additive migration if no existing durable slot suffices; corresponding routine-consents/Core wire adapter only for exact readback. The existing log events remain observability, not authority.
**Tests:** consent created then schedule NOT_DISPATCHED; schedule ACK then local record failure/crash; withheld ACK; ambiguous schedule effect; failed pause/delete narrowing; replay after restart; consent expiry and live-login renewal; changed projection; concurrent generation; foreign consent substitution. No automatic consent widening or duplicate schedule creation.
**Acceptance:** replay/reconciliation can restore the exact acknowledged consent receipt without redispatching a schedule or granting new scope; otherwise uncertainty remains visible and firing/reads stay closed.

Source: [MR-10](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mr-10), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2792.

#### MR-10 · P1 · Qualify routine firing, overlap, cancellation and inbox continuity as one lifecycle
**Class:** Q; MR-03/04 are the concrete source gaps. **Owner:** routines runtime; Core/FE/release counterparts.

**Already present:** deterministic occurrence identities; original-owner current grants before admission/start; pause/delete/generation fences; exact admitted run and request reuse; UNKNOWN overlap barrier; paused/approval-wait same-work occupancy; explicit human stop proof bound to selected lineage; and inbox currentness for original owner with current membership. [apps/runtime/native-authority/routines-firing-authority.mjs:71–124](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/native-authority/routines-firing-authority.mjs#L71-L124), [apps/control/schedules/scheduled-job-lifecycle.mjs:29–53](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/schedules/scheduled-job-lifecycle.mjs#L29-L53), [apps/control/schedules/scheduled-run-cancellation.mjs:47–75](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/schedules/scheduled-run-cancellation.mjs#L47-L75), [apps/control/schedules/scheduled-conversation-currentness.mjs:15–53](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/schedules/scheduled-conversation-currentness.mjs#L15-L53)

**Bounded acceptance suite**
- Approve under live consent; fire without an attended browser; fail safely when consent expires, membership changes, policy revokes, schedule pauses/deletes, or Core does not answer. No attended-token fallback.
- Re-deliver one firing/restart schedule worker and control at each point: immutable occurrence claim, admission, Temporal start ACK, first output, terminal, retirement and overlap release. Exactly one conversation/run/request/event identity.
- A paused/resumable occurrence still occupies overlap; fork is independent work and must not accidentally release or inherit the occurrence slot. Unknown dispatch and unknown stop preserve the slot.
- Future-only pause/delete never claims current work stopped. Explicit current-work cancellation uses exact approved lineage and proves each original retired; concurrent resume or changed lineage cannot widen the approved selection.
- Result reaches the existing history/inbox with original-owner currentness, including partial output and late completion; foreign/archived/revoked access is withheld. Test list/transcript pagination and pool concurrency together, not only direct origin lookup.
- Reconcile after a wrapper's timeout or worker shutdown; no new firing replaces unresolved work. Old-image occurrence cleanup exercises MR-01.
- Confirm exact control/schedule-worker workflow target, grants, native operations, schema and deployment image. These are release inputs, not values to invent here.

**Files:** existing scheduled-dispatch/job/lineage/read-consent/currentness tests plus runtime product-routines-flow tests, not new duplicate scheduler. Parent owns service deployment and actual Temporal/ECS qualification. tools/domain owner owns conversational schedule preparation/list-tool bridge, not this firing lifecycle.

Source: [MB-05](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mb-05), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:1154.

#### MB-05 · Complete narrow source-event triggers and truthful routine history (P1 required v1)

**Requirement/evidence.** Original Greenfield L172–173 requires Temporal Schedules AND a narrow endpoint for supported source events, not another scheduler. P17 M5 L334 requires schedule/history/timezone/retry/reauthorization. Current [public routines transport](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/schedules/application-http.mjs#L7-L12) exposes prepare/approve/list/reconcile, not an admitted event trigger. Existing [Temporal run-history owner](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/schedules/temporal-run-history.mjs#L18-L33) deliberately reports historyComplete:false/currentRetryVerified:false for bounded original-run references.

**Root cause.** Recurrence support and a partial original-run description do not establish event-trigger authentication/deduplication, complete occurrence/retry history or final destination receipt. Business subscriptions and source-invalidation notifications cannot safely call a generic model-run endpoint.

**Bounded implementation.** Define a finite producer/event-type/version allowlist with authenticated producer identity, canonical source/client/resource revision, event identity/hash/time and approved subscription/routine reference. Server derives initiating owner/current scope/destination/budget/retry policy from the durable approved routine; untrusted event payload carries no grant or free prompt. Persist event acceptance/deduplication and causal link before invoking the existing occurrence/Temporal owner. Reauthorize membership, source consent and action grants at every execution; suppress revoked/disabled/superseded events. Specify ordering, coalescing, replay window, burst backpressure, retry/poison events and exact unknown-ACK recovery. Use SQS/EventBridge only for a specific accepted source transport, never as a second run scheduler.

Extend existing routine history projection/public DTO and MF consumer to explain event→accepted/skipped/deduped/queued→occurrence/attempt→approval→terminal result/artifact/destination, with retry/continued-run links, cursors and explicit partial coverage. A notification delivered or event accepted is not a successful job. Bound retention of event payloads and receipts under MR-05; keep hashes/content-free lineage where content is suppressed.

**Files/owners.** Existing apps/control/schedules/{application,scheduled-occurrence,scheduled-dispatch,scheduled-job-lineage,temporal-run-history,postgres-schedule-owner}; one source-trigger receiver and contract under the same owner; centrally allocated additive durable schema; existing runtime schedule product port and frontend routine history. MR-03/04/10 remain canonical management/consent/firing/history owners. MO-06 business subscriptions and MO-14 source-revision invalidation consume this contract; they do not implement their own scheduler.

**Acceptance/tests.** Duplicate/redelivered/out-of-order event, wrong producer/tenant/client/source version, expired subscription/current grant, disabled schedule, burst/overlap, source deletion during queue, UTC/DST where scheduled windows apply, worker death, lost event-accept/dispatch ACK, held approval, unknown external effect and poisoned event recovery. Exactly one admitted occurrence for the deduplication key; no second effect from replay. History covers original and current retry/continuation truthfully or returns explicit partial/unknown, survives originating chat closure/reload and hides revoked source content.

**Dependencies/unknowns.** MR-03–05/09/10, MT-12, MF-18, MO-06/14, MX-04/11/12. First producer/event types, acceptable lag/burst/replay policy and destination types require a bounded contract decision. No live webhook registration, source subscription or recurring automation is created by this plan.

Source: [MT-12](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mt-12), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3343.

#### MT-12 · Bridge conversation schedule proposals and schedule-list reads (P1)
> **[RE-SCOPED 2026-10-23]** Approval, durable receipt and no blind redispatch stay. Approvals go through the SDK permission callback plus Core intents; no per-operation grant minting. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** schedule/update/cancel preparers and canonical routines application exist, but selected intentMountFor does not mount them and generic approval only accepts task.create. list_scheduled_tasks is deliberately not an intent yet has no read family; blindly adding it to retrieval-only schema loading also fails its different schema namespace.

**Bounded change and owner.** Use existing control/intents schedule preparer, routines product ports/application and schedule journals. Add a reviewed schedule action approval adapter with current consent/stop/read authority and exact immutable command binding; mount only supported preparers. Give list_scheduled_tasks a bounded canonical routines read adapter and supported exact schedule-schema loader, or a documented product-owned inspection surface, not the legacy Core scheduler. Keep schedule preview/preparation distinct from committed schedule and occurrence execution.

**Dependencies.** Runtime owner handles scheduler deployment/firing/Temporal/lease/stop/notification lifecycle; MF schedule UI; ST-17 notifications/ST-24 lifecycle. MT-01/10 recovery semantics; MM retained deliverables for scheduled output.

**Acceptance / tests.** Create/list/update/cancel same actor/tenant scope; time zone/DST/cron/window limits; changed consent/stop state before commit; schedule revision conflict; duplicate and unknown decision; list pagination/currentness; update/cancel vs firing race; no unintended external communication. Conversational workflow must land on the same schedule/run/inbox lineage the product views inspect. Approval does not imply occurrence delivered.

**Pinned evidence.** [apps/worker/conversation/intents/catalog.mjs:22-36](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/intents/catalog.mjs#L22-L36), [apps/runtime/native-authority/execution-composition.mjs:167-176](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/native-authority/execution-composition.mjs#L167-L176), [apps/worker/conversation/reads/schema.mjs:2-9](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/reads/schema.mjs#L2-L9), [apps/control/intents/approval.mjs:28-35](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/intents/approval.mjs#L28-L35).

Source: [MT-13](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mt-13), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3357.

#### MT-13 · Complete all fourteen original skills through exact installed workflows (P1 full-completion requirement)

**Root cause / current state.** Fourteen named skills and15 current pinned versioned assets exist, but selected admission and worker selected-runtime allow exactly relationship_brief and commitments_audit. Historical original manifests are not installed launch promises. Current bill_watch1.0.0 points to the document-application research-brief manifest; bill_watch1.0.1 is also an explicit pinned asset. Selecting one does not silently select the other.

**Bounded change and owner.** Preserve all14 original launcher identities and complete each workflow. Stage a smaller launch cohort only as an intermediate milestone, not full completion. For each required additional asset, update existing control/conversations/skills/admission.mjs and worker/conversation/skills/selected-runtime.mjs only after producing a measured installation of its exact manifest operations, source contexts, total budget and output owner. Keep explicit manifest/prose/catalog hashes and no latest fallback. While an individual workflow remains unqualified, disable its runnable claim honestly and keep its full-completion work open; do not remove its original scope.

**Dependencies.** MT-01–09 as applicable; MM selected-output/compiler/approval/retention closure; ST-16 starters; PF-03/PF-24 selected business workflows. Artifact generation must not be confused with successful external action.

**Acceptance / tests.** All15 asset entries across14 skill IDs resolve exact version and hashes. For each admitted workflow test selected admission→original allocation→narrow tools→real source pages→cited output→MM retained artifact/approval lineage and cancellation/restart. Test manifest operations unavailable, source partial/empty, changed authority, conflicting skill selection and unselected tool discovery. Two current selected paths remain regression green without widening to every private recipe.

**Pinned evidence.** [packages/skills/assets.json:1](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/packages/skills/assets.json#L1), [packages/skills/index.mjs:16-51](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/packages/skills/index.mjs#L16-L51), [apps/control/conversations/skills/admission.mjs:26-42](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/conversations/skills/admission.mjs#L26-L42), [apps/worker/conversation/skills/selected-runtime.mjs:13-20](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/skills/selected-runtime.mjs#L13-L20).

Source: [MO-01](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mo-01), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:1226.

#### MO-01 · Finish versioned procedures and firm-skill governance

**Original obligation:** R L193–195, L474–476; A L253–268. **Priority:** full-completion P1 unless explicitly gated below; safety/authority prerequisite P0 before activation.

**Current source / gap:** Core already has admin-gated firm-skills list/create/update/enable/remove/restore/test, optimistic version checks, history/audit and current procedure validation. Current selected SDK assets/admission do not establish the six built-in procedures or firm versioned procedure execution. Do not build another skill store. Evidence E3/E12.

**Bounded implementation and owner:** Core meri-firm-skills.service.ts and meri-procedure-runtime-validation.service.ts remain canonical. Bind selected runtime/manifest resolution to exact current procedure record/version/digest and trusted native conversation/client mapping. Preserve six named built-ins briefing, draft, bill_analysis, hearing_prep, coalition_letter, amendment_tracker with purpose, scope, evidence prerequisites, capability/effect policy and completion checks. UI settings consume existing admin routes and history/rollback; “use this process next time” creates a reviewable versioned proposal rather than self-modifying instructions. Small writing profile, if its original off-voice trigger is met, uses governed audience/structure/tone/terms/length/citation/exclusions and ≤5approved exemplars, precedence current instruction > client > firm > defaults.

**Dependencies / non-duplication:** MT-13 all14 quick actions remains separate; ST-16 skill settings; MM governance; MF/MG typed selected-skill UI. Keep current SDK pinning and independent business authorization.

**Acceptance:** All6built-ins resolve exact version; firm create/edit/rollback/disable/version conflict; current role/client/ethical wall revoked before and after resolution; altered manifest or allowedTools rejected. Reload retains actual selected version and review. New procedure content cannot grant tools, effects or memory permissions. History/audit survives restore; no stale cached enabled version executes.

Source: [MO-02](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mo-02), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:1239.

#### MO-02 · Complete durable Cowork jobs and child goal-revision lineage

**Original obligation:** R L218–241, four flows L284–291; A L262–268. **Priority:** full-completion P1 unless explicitly gated below; safety/authority prerequisite P0 before activation.

**Current source / gap:** Durable lifecycle already supports steer/pause/resume/fork and Temporal orchestration. SDK Agent is explicitly foreground, fixed roles and workspace tools. These facts alone do not establish sustained research/deliverable/audit jobs with durable child assignments, goal revisions and background handoff. This is an integration/contract proof gap, not absence of all steering. Evidence E4/E5.

**Bounded implementation and owner:** Extend existing conversation lifecycle/objective-generation/run/event owners, not a new job runner. Define explicit Start Work/Delegate entry and current revisioned objective, requested deliverables/dependencies/capabilities/shared remaining budget. Map current states to queued/planning/executing/waiting/finalizing/completed/partial/failed/cancel-requested/cancelled. Persist assignment identity and goal revision before child dispatch, result/artifact receipts before acknowledgement/notification; recover through existing checkpoints/fences. Resolve fresh delegated authority on resume. Parent reconciles cited child findings/conflicts and owns final narrative/proposals. Legacy research history gets a current-authority read bridge or explicit migration disposition, not silent disappearance.

**Dependencies / non-duplication:** MR-06/07/08 recovery and current steer owners; MF-10/11/12 views; MM-15/16 output/history; PF-06/24 objective/Planner. Approval-wait uses existing hold/resume, consumes zero model calls, and keeps only independent safe work eligible.

**Acceptance:** Four job kinds; explicit chat fast path vs sustained entry; tab detach/reconnect; steer House-only goal revision and reject old child publication; replacement worker at predispatch/result-before-ACK boundaries; cancel requested vs actual stop and committed effects; narrowed child sources/tools/depth/concurrency; no self-approval, grant widening or memory activation. Prove a waiting job makes no polling model calls. Preserve partial useful output and budget liability without replay.

Source: [MO-10](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mo-10), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:1343.

#### MO-10 · Close complete-job cost, context integrity and fair capacity
> **[RE-SCOPED 2026-10-23]** Cost ceilings, context integrity and fair capacity stay: SDK `maxTurns` / `maxBudgetUsd` plus one tenant cap, SDK compaction, runner pool limits. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Original obligation:** R L377–401; A recovery/accounting and G. **Priority:** full-completion P1 unless explicitly gated below; safety/authority prerequisite P0 before activation.

**Current source / gap:** Current budgets/UNKNOWN settlement and MX-09latency measurement exist, but hard aggregate caps do not prove complete-job economics, compaction correctness or tenant fairness. Do not replace active P1budget/deadline or P2proof owners. Evidence E9/E4.

**Bounded implementation and owner:** Extend existing accounting/usage/retrieval/session owners with weekly tenant/turn usage plus cost per successfully completed job, partial/failed separately; parent/children, provider input/output/reasoning/cache, extraction/retrieval/tool/verification/compression/retries/fallbacks and allocated infrastructure, measured vs estimated vs unresolved. Measure largest output contributors and apply bounded projections with durable full-source pointers. Preserve synthesis reserve and compaction lineage for objective/steering/client constraints/source versions/prior attachments/proposals/tool-result pairs/contradictions. Remove revoked/client-switched protected content from future model context. Define no-progress/alternating-loop detection without blocking genuine pagination/polling; one retry owner with Retry-After, deadline and failure-class rules. Qualify fair tenant queues/interactive capacity and quotas.

**Dependencies / non-duplication:** MX-09measurement, MR-07/09checkpoint/accounting, ST-15usage/limits, existing P1/P2. Optional specialist/training economics apply only if that separately retained feature is adopted; no GPU/training prerequisite.

**Acceptance:** Interrupted/unknown reservations never treated as zero spend; context budget prior to dispatch; failed/partial job denominators and experiment/service costs honest; compaction/resume preserves goal and approvals without revoked bytes; one tenant longjob cannot starve interactive tenant; legitimate page continuation works, unchanged failure cycles stop with useful sourced partial. Verification repaired/unresolved/notchecked/unavailable distinctions preserved; verifier outage is not contradiction or blanket approval requirement.

Source: [MF-11](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mf-11), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2368.

#### MF-11 — Build run index/detail from durable read contracts (P1 if Runs is promised; otherwise P2)

- **Root cause / evidence:** Run list/detail exist only as fixtures; conversation history is not necessarily a complete user/client run inbox, and inspected public contract has no distinct run-list route.
- **Bounded files/owner:** Backend public run-summary owner first; frontend `screens/runs/*` adapted into live `runs/` views, new route and scoped query keys; Sidebar destinations.
- **Implementation:** Define run index scope, filters, status freshness, sorting/paging, source conversation/client, cleanup/continuation and durable usage references. Implement read-only list/detail before mutation controls; link to exact conversation/run/checkpoint/artifacts; handle unavailable/forbidden/retained/deleted states. Feed lifecycle actions through MF-10 and Stop through existing cancel.
- **Dependencies / exclusions:** MR read owner, ST-15 usage/limits, MF-10. Do not synthesize complete run inventory by collecting only currently loaded conversation pages.
- **Acceptance:** New tab/reload yields same authorized index and durable details; pagination does not duplicate/skip; revoked/archived client hidden; status timestamp displayed and stale/unknown separated; each deep link revalidates scope.

Source: [MF-18](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mf-18), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2431.

#### MF-18 — Decide and implement workflows, routines and browser holders (P2 or explicit launch gate)

- **Root cause / evidence:** Workflow library/setup, browser activity/sign-in/permissions/download, model/skills and routine management are design fixtures, not ordinary consumers.
- **Bounded files/owner:** Only selected `screens/workflows/*`, `screens/browser/*`, `screens/routines/*` adapted into live routes/controllers after product decision; capability registry and sidebar.
- **Implementation:** Produce supported template/action inventory from real MT tool registry and MR runtime capability; choose which designed launchers to ship versus retire. Templates create permission-preserving typed requests with explicit scope and confirmation; do not claim connector authorization. Routine management uses durable owner-scoped schedule reads/mutations and correct timezone/next-fire/history. Browser operations require bounded authorized session/handoff/download receipts and honest manual sign-in holds. Keep unsupported choices disabled with reason.
- **Dependencies / exclusions:** MR routine standalone-owner gate, schedule firing/delivery and browser runtime; MT tool capability/read scopes; MM download custody; ST-14 connectors/ST-16 skills. Do not mount live screens solely because a private backend function exists.
- **Acceptance:** Each shipped launcher maps one-to-one to public allowed operation and durable receipt. Routine edit/pause/cancel survives completed source chat and reload after owner fix; timezone/DST and missed fire shown. Browser stop/sign-in/permission controls invoke only correct owner and cannot expand credentials silently. Unselected designs clearly remain examples.

Source: [ST-15](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#st-15), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2382.

#### ST-15 — Wire Meri usage, effective limits, and queue navigation (P2, UNSUPPORTED)

**Evidence.** Metrics and run usage are placeholders; limits/model read-only unavailable; View run queue has no destination. Core AI cost summaries are not interchangeable with Meri attempt/concurrency/deadline accounting. [Usage screen][st-preference-usage], [model][st-unavailable-workspace].

**Tasks.** Bind effective runtime usage/attempts/current run/available capacity and policy to a qualified Meri read model. Link the actual permitted run queue. Keep ordinary view read-only; any administrator config editor must use existing authoritative policy contracts and separate capability, not browser-side threshold edits. Replace illustrative near-limit/budget/concurrency states with effective states while retaining explanations.

**Tests.** Failed/cancelled/retried attempts included according to runtime policy; clock/day boundary; stale metrics marked; budget reached/queue queued/cancelled; tenant isolation; no user can raise limits through preference save.

Source: [ST-16](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#st-16), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2392.

#### ST-16 — Wire skills/templates as permission-preserving starting points (P2, UNSUPPORTED)

**Evidence.** Three Use skill buttons and Attach a permitted template disabled; approved list placeholder. [Skills][st-preference-skills], [model][st-unavailable-workspace].

**Tasks.** Qualify existing permitted skill/template catalog, list only accessible entries, pass selected template into the existing conversation/task creation flow, and implement attachment via the existing file permission/scan/readiness pipeline. No arbitrary template text becomes authority or tool permissions. If no permitted template, actual empty state and disabled attach.

**Tests.** Revoked template, stale catalog, forbidden upload, file quarantine/processing, wrong client scope, duplicate launch, skill content cannot expand tools/authority. Prove actual research/document/spreadsheet/presentation start, not a success toast alone.

Source: [ST-17](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#st-17), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2402.

#### ST-17 — Connect workspace update preferences and header entry (P2, UNSUPPORTED)

**Evidence.** Updates fields and preview/profile-menu controls disabled; static caught-up notice despite no data. Canonical preference doc already has three notification booleans, but no consumer is shown by this Settings page. [Updates][st-preference-updates], [model][st-unavailable-account], [document][st-preferences-document].

**Tasks.** Define mapping between designed run/decision/connection categories and actual supported notification keys; do not conflate memoryReviewed and connection state without a contract. Add revisioned controls only for supported categories and bind existing notification consumers/delivery filtering. Reuse real Updates/profile entry components; render unavailable separately from zero unread. Broadcast recipient workflow ST-20 is a distinct mandatory-message policy, not automatically suppressible by personal toggles.

**Tests.** Saved preference survives reload and affects correct notifications only; mandatory approvals/security notices not accidentally suppressed; no fake caught-up or preview success; account/tenant switch clears stale updates; notification ownership enforced.

### Source reference definitions

[st-preference-usage]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/UsageLimitsScreen.tsx
[st-unavailable-workspace]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/unavailable-workspace.ts
[st-preference-skills]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/SkillsTemplatesScreen.tsx
[st-preference-updates]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/NotificationsAccountScreen.tsx
[st-unavailable-account]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/screens/settings/unavailable-account.ts
[st-preferences-document]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/packages/contracts/user-preferences-application/document.mjs

#### Additional mandatory MT-13/MM-15 acceptance from the original plan

Commitments & Deliverables keeps commitments_audit, requiresClient:true, readOnly:true and general/client scopes; even a general launch requires a selected client. Audit authorized mail/meetings/transcripts/debriefs/tasks/actions/documents/Monday with real continuation and older promises. Deduplicate promises versus decisions/questions/proposals, retain linked record IDs, evidenced owner/due date or unknown, dependencies and acceptance evidence. Exactly completed, in progress, or no record of action are audit statuses; native task status is separate. Completion needs delivery/acceptance evidence. Monday coverage is exactly checked, disconnected, unavailable, or not mapped, with partial pages explicit. No unread page proves absence. Audit performs zero task/message/memory mutations; a later requested action uses its own immutable approved operation and observed receipt. Preserve CD-01–CD-07 semantics through focused fixtures, not seven automatic paid runs. All14 launchers retain exact client/scope metadata from Remaining Plan L172–195 and every selected procedure/version is traced.
