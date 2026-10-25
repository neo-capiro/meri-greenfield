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

FROM: Root | TO: Wave2 obsolete owner proxy issuer retirement | TYPE: brief | RE: source retirement and concrete Release deletion plan (Wave 2, simplification lane 2)
# Wave 2 obsolete owner/proxy/issuer retirement

Repository: `neo-capiro/meri-greenfield`. Branch: `codex/w2-owner-proxy-issuer-retirement-20261025`. Dedicated checkout: `C:/dev/w2-owner-proxy-issuer-retirement-20261025`, from Root's refreshed exact base. Author session: **Wave2 obsolete owner proxy issuer retirement**. Separate review session: **Wave2 retirement review**. Existing Release remains sole operator. These are dispatch names, not already-running sessions.

## Objective and immediately executable scope

Remove confirmed obsolete owner/proxy/issuer source and active configuration, and prepare concrete ordered resource deletion through the existing migration/release plan. Do not begin with an entire directory deletion. The source review established retirement candidates, not their complete live dependency or rollback status. Start with leaf callers and active image/CLI/render reachability at the exact base, update the ordinary existing deletion inventory, and delete only the proven unused owned subset. If an obsolete wrapper still carries a required behavior, identify the present canonical owner; do not invent another framework or copy the implementation.

The current renderer already refuses retired issuer material, but old files and old tests remain. `first-chat-private-edge.mjs` still supports current private control traffic; preserve it. Applied owner-read/issuer SQL and their regression tests explicitly preserve migration history and must remain. A folder or filename is not obsolescence proof.

## Exact initial source/config allocation

The companion `retirement-candidate-files.txt` is the exact tracked candidate list compiled at the pinned base, grouped below. It is a review/search allocation, not an instruction to delete every entry. At the refreshed base, add no path silently; report additions to Root. Author may delete confirmed obsolete executable code and obsolete-only tests/config within this list after establishing all callers; retain required evidence. Existing immutable SQL, historical receipts and raw evidence are excluded.

- Obsolete owner/proxy executable and test source under `apps/proxy/`, excluding historical/evidence/receipts and SQL; `apps/gateway/model-proxy/` executable code/tests, excluding historical evidence.
- Named runtime candidates: `apps/runtime/pinned-native-transport.mjs`, `native-runner-gateway.mjs`, `runner-poststart-cli.mjs`, `temporal-authorization.mjs`; their named tests only as listed. No missing historical file is recreated to delete it.
- Infra candidates: `infra/product-preview/proxy-image-start.sh`, `test_proxy_image_start.py`, `model-proxy-change-set.md`, `temporal-issuer-renewal.mjs`. No blanket `temporal-*` removal: native TLS, server, workers, namespaces and retained credential rotation stay.
- Read current `infra/product-preview/first-chat/ship-packet.mjs` and its existing cleanup/rollback clauses. Propose a minimal update to that file and `ship-packet.test.mjs` only if needed for the concrete cleanup; Root reserves these shared paths before the edit and Release reviews them. The author can complete all leaf work and inventory while that reservation is pending. No alternate deploy script or cleanup framework.

Discover and report references outside this list; Root allocates only specific edits if necessary. In particular `runner-poststart-cli.mjs` imports the pinned transport, and `native-authority/test/router-tls-fixture.mjs` still references it: do not leave broken tests/imports by deleting the leaf first. If those consumers still exercise retained behavior, keep the candidate and explain the remaining dependency instead of deleting the behavior. `apps/gateway/budget` is inventory-only in this allocation: do not erase canonical tenant usage/cap behavior or applied migrations. Root can allocate exact proven obsolete remaining budget leaves after review.

Frozen: event polling lane files; all Hermes read-context/native-read-context/tool-dispatch source; Runtime diagnostics/startup/control entrypoints; `apps/runtime/native-authority/**` product source; execution journals, uncertain-outcome handling, SessionStore, artifacts/retention, Temporal workflows/routines/Objective workers, packages/contracts, shared lockfiles, DB data/schema/migrations. Do not remove retained routines, durable controls, recovery, consent, uncertain-write fences or action-session idempotency. No new table drops.

## Dependency and rollback inventory, then deletion gates

Reuse the migration plan's existing deletion table and Release's current cleanup inventory. One row per actual candidate: exact source/config identifier; current import/entrypoint/CLI/image/render reader; replacement owner and relevant retained test; live service/task/stack/IAM/secret/network/schedule references (Release evidence only); whether required by the bounded rollback; proposed action/order; retained evidence; failure/rollback action; disposition READY / RETAIN / ALREADY ABSENT / BLOCKED with named owner and evidence timestamp. No extra packet registry. Public output uses resource role names/counts/booleans; current exact private identities stay in Release's named private location.

Resource search seeds, not current-existence claims: `meri-product-preview-owner`, `meri-product-preview-proxy`, `meri-product-preview-temporal-issuer`; old owner/proxy task definitions, private PKI (`meri/preview/private-pki`), issuer token material/signing keys, old grants/roles, SG/ALB rules, obsolete alarms/log groups/image kit callers. Release must freshly check service desired/running tasks, task-definition references, schedules/rules, ENIs/shared groups, roles and secret readers, retention and rollback images/config before proposing removal. Do not delete retained log evidence or keys/versions merely because their service is stopped.

Gate 1, source: prove the exact last executable/config/image caller has gone or moved to the existing owner; retain historical migrations and meaningful retained-behavior tests. Show after-searches and explain all remaining matches and test-count changes.

Gate 2, reviewed Release plan: Root plus independent retirement reviewer review the concrete list, dependencies and rollback consequence. Existing migration plan requires replacement acceptance and explicit closure of the bounded old-hosting rollback before live deletion. Current chat UI successes alone do not prove full replacement/Stop/restore/credential/routine acceptance. Missing evidence is BLOCKED, not silently waived and not an indefinite reason to retain all unused source. Root selects any accepted equivalent against the retained plan; a real scope/security change goes to Neo.

Gate 3, operation: only Release executes the reviewed current commands against verified account/region and the preview deploy lock, using current topology and exact compatible source/config. No author AWS mutation or exploratory delete. Never use historical IDs as targets. Release verifies absence and retained-service health, records irreversible consequences and closes the rollback window explicitly. Forward recovery after old hosting retirement must be independently proven AgentCore-compatible; an old task revision alone is not rollback.

## Local checks, mutants, exclusions

First run relevant import/config/source checks on base to preserve inherited failures; select the retained behavior commands from the actual changed surface. Existing useful checks include:

```text
node --test --test-concurrency=1 infra/product-preview/first-chat-database.test.mjs infra/product-preview/agentcore-runtime.test.mjs infra/product-preview/temporal-deployment.test.mjs infra/product-preview/first-chat/render-material.test.mjs infra/product-preview/first-chat/ship-packet.test.mjs
node --test --test-concurrency=1 apps/runtime/test/agentcore-candidate.test.mjs apps/runtime/test/agentcore-execution.test.mjs apps/runtime/test/agentcore-routine-composition.test.mjs
npm run typecheck --prefix apps/runtime
```

These are selection seeds, not a demand to rerun all on every leaf deletion. Read manifests/environment prerequisites and select the smallest affected set. If a command is unavailable or inherited-red, preserve base/head evidence and name Root's environment owner. Use existing Node 24 and isolated fixture inputs; no shared DB changes. If infra synthesis is actually changed, run its existing targeted synthesis/assertion check with MERI_REVIEW_SOURCE_ROOT, real checkout and installed workspace dependencies. No cloud credentials or secret values in results. Do not rebuild a proxy merely to qualify its deletion.

Meaningful positives/negatives must show retained direct SDK/AgentCore execution, current Core access, native Temporal auth/routines and once-only/unknown dispatch still compose where the deleted source could affect them. Keep unrelated reviews green through unchanged evidence. New executable regression test requires a killed meaningful mutant, e.g. restore an obsolete active config reader into the selected render, omit the retained native TLS requirement, or re-enable a removed image/CLI path; use only a mutant that exercises the asserted actual boundary. A mere file-not-found search is deletion evidence, not behavior qualification. No executable tests added means mutation N/A; explain retained affected checks and test removals.

## Deliverable and review

Commit and push a draft PR with exact base/head/tree, exact deleted/retained files/config keys, before/after last-caller search, test count explanation, command/result/UTC/base-vs-head failures, mutants, reused evidence, and the single concrete existing-plan update for Release. Include named blockers: Release dependency/rollback readback; authenticated replacement Stop/restore/routine acceptance; Root review of deletion list. Mark live absence/deletion NOT RUN until Release proves them. Author completion is source plus reviewable retirement plan, not a claim resources were removed.

Reviewer returns PROCESS6.2 verdict against the exact head and validates no retained native-authority owner, durable journal, applied SQL or useful negative test was deleted. Root resolves overlaps/integration and forwards only the independently reviewed list to Release. Release reports PROCESS6.3 source/image/revision/UTC, commands/results, rollback window closure, retained-service checks and actual resource absence; source tests do not stand in for that evidence.

## Dispatch, authority and source pins

Prepared 2026-10-25T17:26:02+00:00; source-only briefing audit, not implementation or a test/release result. Meri HEAD was read as `7eee7f7c358be9ae903169816ef68eb6e64ae1f3` in `C:/dev/w2-batch-meri-20261025`; canonical docs HEAD was read as `c0411e2cd20c35b3a8619817a4fec25ef7047aba` in `C:/dev/wave2-handoff-20261025-docs`. Root refreshes both pins at dispatch and records the actual checkout base/time before editing; the author independently verifies HEAD, status and ownership. A moved base requires affected diff review and changed checks, not automatic repetition of unaffected gates.

Fresh visible Codex implementation session at **xhigh**, named below; do not inherit another session's history. Root remains Ultra and only orchestrates. Separate xhigh reviewer reviews exact base/head. Existing Release alone performs AWS reads/writes, migrations, build/deploy/rollback and live resource deletion; author performs local source work only. Draft PR only, commit AND push; no merge, issue #202 post or cloud operation. Attach the resulting draft PR. No recursive delegation. Existing review/Release identities are assigned by Root when dispatching; the role names in this brief are the requested visible session titles, not evidence those sessions exist yet.

Use `C:/dev/AGENTS.md`, canonical `PROCESS.md` 6.1–6.3, `WAVE-2-HANDOVER.md`, `../20261025/WAVE-2-HANDOFF.md`, item-0 spec, migration plan and supersession register from the canonical docs checkout above. Repository implementation standards and PR template still apply. Current standing roles override the product checkout's older Ultra-helper/root-AWS wording. These briefs are a proposed allocation of Neo's authorized simplification scope; engineering prose is not a new user approval.

**Instruction and engineering provenance (25 October 2026):** the [23 October version](https://github.com/neo-capiro/meri-greenfield/commit/1ddb48d6a2f66374aa842b2d9dc0ead2f0cc256d) explicitly described the numbered rules as Fable's engineering translation of Neo's quoted words. The [24 October AgentCore change](https://github.com/neo-capiro/meri-greenfield/commit/671e3684e29d0f9557531f395a08d53289d3ecdc) replaced that attribution paragraph while revising the architecture guidance. Git history verifies those texts and edits; the quotations below retain their recorded attribution, but their original chat source was not independently reverified for this correction.

Neo's direct instructions establish authority. Engineering interpretations and an “approved” document label do not independently establish Neo's approval of each engineering sentence or a new scope decision. Required guarantees do not mandate every existing wrapper; redundant mechanisms may be simplified through the existing owners while preserving those guarantees. This attribution note changes neither the current rules 1–4 nor retained contracts, and grants no new scope or architecture approval.

In-scope implementation choices proceed and are recorded; only a genuine scope/security change goes to Neo through Root. Do not treat GitHub comments as approval. Preserve all active checkouts, WSL Codex-Gates, persistent local services/volumes/data and dependency caches. Use task-owned scratch/fixtures; record owner and cleanup on success/failure/cancellation. Never expose customer-linked identifiers, secrets, raw private configuration or customer content in public evidence. Private evidence locations by name only.

**Latest direct Neo clarification, carried by Root:** do not change the AgentCore SDK architecture. Preserve the full Claude SDK harness on standard Runtime V1, direct Bedrock, control's tool gateway to Core, and existing durable user and firm memory. Preserve immutable tenant/actor/conversation separation, currently used private edge, current authority, Temporal/durable routines and journal invariants. No cross-user/global session or memory reuse; no memory cleanup, orchestration rewrite or third direct-interactive lane is allocated. These two lanes only remove bounded polling/redundant work and proven obsolete machinery.

## Retained tickets and scenarios — canonical verbatim excerpts

The following is quoted from the canonical master plan at the docs SHA above, not an allocation of every listed file. This lane owns only the bounded slice stated above. The supersession register overrides old mechanism wording, including pins, liabilities and obsolete authority named in historical clauses. Other retained accepted work remains with its existing owner.

### Applicable supersession rows (verbatim)

| Ticket | Disposition | Keep as acceptance | Dropped |
|---|---|---|---|
| **MR-06** durable lifecycle outcome readback | **RE-SCOPED** | Outcome readback and recovery after process or request loss | Temporal plus the conversation DB are the durable record; drop the prepared-run registries |
| MO-11 retire obsolete runtime code | **KEEP, now** | Item 0 step 5 is its largest instance. Do it with item 0, not at L4 | — |
| MX-06 topology, readiness, control scale | **RE-SCOPED** | Readiness/control scale and measured Runtime V1 session reuse, idle stop and restore; no custom warm pool | Pair and issuer topology |
| MX-07 material expiry, renewal, PKI rotation | **RE-SCOPED** | Expiry and rotation for the secrets that remain (Core service secret, Temporal credential, Clerk) | Pair mTLS PKI and issuer tokens |

#### MO-11 · Retire obsolete runtime code and configuration safely
> **[RE-SCOPED 2026-10-23]** KEEP, and do it now: Wave 2 item 0 step 5 is its largest instance. Do not wait for L4. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Original obligation:** R L403–424; historical D S1-7/10/11/12. **Priority:** full-completion P1 unless explicitly gated below; safety/authority prerequisite P0 before activation.

**Current source / gap:** No current reachability/deletion receipt in this audit closes old V1/V2 loops/proxies/fallbacks/harness/flags/release scripts. Historical paths are search seeds, not proof the source still exists. Current business readers and approvals with similar names must survive. Evidence E2/E14.

**Bounded implementation and owner:** Existing Core/Meri/FE owners create last-caller/import/config-reader inventory, migrate required shared behavior to canonical owners and then delete only proven dead code. Cover V1 loop/helpers, V2 controller/routes/proxies, construction-time patches, obsolete fallback/routing and capture-only production branches, historical42capture modules/live-v1/synthetic scripts where still present, competing release scripts and branding/donor comments. Inventory9CLIO keys and MERIV2/MERIV3obsolete gates individually before removing env. Preserve approved migrations/business tables/history/receipts/audit/budgets/recovery/security fixtures. In-editor/strategy/steward/workspace-gen need separate accepted parity/retirement decision.

**Dependencies / non-duplication:** MO-09observation gate; MX-02/14canonical source/pipeline; ML-23legacy mail cutover and PF/WS existing consumers. No blanket delete, forced table drops, revived V3 or second deployment framework.

**Acceptance:** Static last-reader plus current route/traffic proof; ordinary business workflows/history survive; no alternate hot route/fallback can reactivate; config render has no dead readers; exact deletion diff/rollback and retained evidence. Existing Hermes development tooling is excluded unless user explicitly retires it. Seven-day gate or accepted equivalent recorded, not guessed.

#### MX-06 · Prove topology, readiness and control scale assumptions
> **[RE-SCOPED 2026-10-24]** Qualify actual Runtime V1 conversation/session topology, readiness and control scale. Remove the Fargate warm-pool, model pair and custom issuer mechanisms; preserve their required behavior through existing standard owners.
**Priority / type:** P0 activation gate; operational evidence absent from this audit.

**Evidence and root cause:** EX-04's shipment gates require exactly one control task, distinct private/public health targets and owner/proxy/issuer sequencing. The general manifest README describes process-local poststart challenge custody and disallows overlapping control targets during a handshake. A `/health/live` response proves process liveness, not Core current identity, configured capabilities or a working model path.

**Bounded work:** Root reconciles the existing infrastructure and control owners into the Runtime V1 release. Verify authenticated ingress, intended routes, least-privilege runtime IAM/network access, immutable session scope, truthful dependency readiness and required Temporal namespaces/queues/TLS. Use supported service lifecycle settings. Do not build a new nonce/proof service to preserve obsolete Fargate topology.

**Dependencies:** MX-03/05/07; Core/FE routing under previous X-02–06.

**Acceptance:** Positive authenticated traffic reaches exactly the intended service/version; unsigned, foreign, malformed, neighboring, trailing-slash, absolute-form and wrong-method private requests fail before privileged work. Readiness reports unavailable dependencies truthfully without minting authority. Multi-replica launch cannot be accidentally selected by a manifest that relies on process-local challenge state. Live network readbacks require the operator's approved scope.

#### MX-07 · Close material expiry, renewal and PKI rotation operational lifecycles
> **[RE-SCOPED 2026-10-23]** Expiry and rotation stay for the secrets that remain (Core service secret, Temporal credential, Clerk). Pair mTLS PKI and issuer tokens do not. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.
**Priority / type:** P0 for currentness and continuity; operator procedures/qualification, not credential handling in this audit.

**Evidence and root cause:** EX-04 records short static grant deadlines, seven-day material validity, exact staged Secret versions and an issuer→app availability window. The runtime has currentness, issuer/token-writer and task-bound PKI source; no secret contents, private keys or live material versions were inspected here. A working chat before expiry does not prove the next renewal or a rotated issuer.

**Bounded work:** Replace the custom Temporal issuer with the selected standard authentication owner. Record remaining secret/certificate expiration, rotation, revocation, failed-renewal behavior and rollback without exposing values. Qualify actual Runtime/control/Core/Temporal trust boundaries, including restart and old-session access loss; do not preserve task-bound grant/PKI machinery that the migration replaces.

**Dependencies:** MR session/currentness, MX-05/06 and retention/Stop cleanup.

**Acceptance:** Near-expiry/expired/clock-skew/revoked/wrong-issuer/wrong-key/wrong-task cases cannot grant authority or output; allowed renewal continues exactly once and does not extend the original grant beyond its cap. A transient authority outage preserves retryable session state where source permits but releases no unverified result. On restart/rotation the cleanup path still retires historical work safely. Alert and owner handoff occur before material expiry; no credential values appear in receipts.

#### MR-06 · P1 · Close durable lifecycle outcome readback and recovery after process/request loss
> **[RE-SCOPED 2026-10-23]** Behaviour stays: durable outcome readback and recovery after process or request loss. Temporal plus the conversation DB are the durable record; there are no prepared-run registries. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.
**Class:** S limited recovery surface; Q broader durability; U old-source-session replay behavior.

**Existing behavior:** durable controls are claimed once; PENDING can dispatch, DISPATCHING/UNKNOWN cannot be automatically resent; steer becomes APPLIED only after the exact SDK user-message UUID. Completion has immutable PUBLISHED readback, and Stop has its own durable fence readback. These are intentional barriers. [apps/control/conversations/lifecycle/service.mjs:53–103](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/conversations/lifecycle/service.mjs#L53-L103), [apps/worker/conversation/continuation/activity-lifecycle.mjs:83–108](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/continuation/activity-lifecycle.mjs#L83-L108)

**Missing closure:** the inspected public lifecycle family exposes control and checkpoint inspection, not a separate content-free control-outcome readback tied to a committed source-to-target transition. Replaying an exact command returns the journal receipt only if the ordinary source operation can still authenticate. That does not prove receipt recovery after a resume advances the current run, a process restarts, or source credential expires. Existing `readApplied` is a within-request recovery path using transition authority. [apps/control/conversations/lifecycle/service.mjs:64–67](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/conversations/lifecycle/service.mjs#L64-L67), [packages/contracts/conversation-lifecycle/protocol.mjs:1–4](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/packages/contracts/conversation-lifecycle/protocol.mjs#L1-L4)

**Bounded work:** first test actual composed old/new-session replay across a successful transition and lost ACK. If current source already supports it through another current-authority route, publish that exact contract and consumer instead of adding an endpoint. Otherwise provide a read-only receipt lookup under fresh current identity plus exact persisted transition custody, returning only source/target/control state and receipt IDs. Reconcile only from existing authoritative proof; an unobserved SDK message remains UNKNOWN. Do not infer APPLIED from a final assistant answer, transcript text, timeout or process death. Define owner/operator escalation for irreducible UNKNOWN without clearing the barrier.

**Files:** lifecycle service/journal transition readback, identity transition resolver, contract metadata/client and FE consumer only if required; `completion-journal` and `session-owner` receive boundary tests, not a second state machine.
**Acceptance:** ACK-loss receipt recovery never resends SDK input, reallocates a target, replays mutation or captures another checkpoint. Expired/foreign source selectors cannot release content. The user can distinguish pending, applied, unknown, source-retirement pending and result-not-released.

### Matching E scenarios (verbatim)

| Scenario | Trigger | Required result |
|---|---|---|
| E01 | Authenticated selected-client first chat | One admission/run, real response, durable transcript and correct current actor/client |
| E03 | Double click and lost submit acknowledgment | Same request identity reconciles to one accepted effect/run; no duplicate |
| E07 | Stop at queue/load/start/model/tool/output phases | Logical stop fence and physical cleanup/unknown status are distinguishable; no later unauthorized effect |
| E09 | Image-only release after completed turn | Existing conversation and pending reserved successor continue under candidate11-compatible rules |
| E10 | **[RE-SCOPED]** Deploy/rotation while old original is in flight | Historical Stop/retirement can close old work safely; current execution checks are not weakened |
| E12 | Resume/fork/retry/steer/pause | Correct exported contract semantics, exact target, current scope and one receipt; unsupported cases explicitly unavailable |
| E18 | **[RE-SCOPED]** Read active-set and revoked operation | Only measured admitted operations are discoverable/executable; revoked/missing owner refuses |
| E42 | **[RE-SCOPED]** Forward rollback and schema compatibility | Previous image redeployed through new valid material/revisions; retained receipts and liabilities remain valid |

For E09 retain continuation after deploy; E10 Stop and clean closure/resume without obsolete pins; E18 Core-allowed tool set and revoked refusal; E42 forward rollback and receipts, not retired model-spend liabilities. The exact register governs these replacements. Item-0 T3 first turn, T4 follow-up, T5 reload/reconnect, T6 Stop, H1 history and H2 history filters remain release acceptance; only changed cases are assigned to this narrow release.

## Exact tracked candidate allocation at pinned base

This inline list makes the brief standalone. Each entry still requires last-caller/replacement proof; it is not an assertion every file is obsolete. Historical evidence, applied SQL and required behavior remain protected.

```text
apps/gateway/model-proxy/product-boundary-codec.mjs
apps/gateway/model-proxy/product-boundary-codec.test.mjs
apps/gateway/model-proxy/product-envelope.mjs
apps/gateway/model-proxy/product-envelope.test.mjs
apps/gateway/model-proxy/product-request-owner.mjs
apps/gateway/model-proxy/product-request-owner.test.mjs
apps/gateway/model-proxy/product-reservation-bridge.mjs
apps/gateway/model-proxy/product-reservation-bridge.test.mjs
apps/gateway/model-proxy/product-settlement-bridge.mjs
apps/gateway/model-proxy/product-settlement-bridge.test.mjs
apps/proxy/qualification/assembly/__init__.py
apps/proxy/qualification/assembly/bridge.py
apps/proxy/qualification/assembly/lifecycle.py
apps/proxy/qualification/assembly/test_fixture_compatibility.py
apps/proxy/qualification/assembly/test_host_address.py
apps/proxy/qualification/assembly/test_lifecycle.py
apps/proxy/qualification/linux/assembly.test.py
apps/proxy/qualification/linux/import-probe.py
apps/proxy/qualification/linux/native-runtime/fixture_config.py
apps/proxy/qualification/linux/native-runtime/native_auth_probe.py
apps/proxy/qualification/linux/native-runtime/test_native_auth_config.py
apps/proxy/qualification/linux/postgres-fixture/config.py
apps/proxy/qualification/linux/postgres-fixture/docker_capture.py
apps/proxy/qualification/linux/postgres-fixture/native_bootstrap.py
apps/proxy/qualification/linux/postgres-fixture/native_output_capture.py
apps/proxy/qualification/linux/postgres-fixture/prisma-peer.py
apps/proxy/qualification/linux/postgres-fixture/prisma_error_evidence.py
apps/proxy/qualification/linux/postgres-fixture/run-fixture.py
apps/proxy/qualification/linux/postgres-fixture/server-bootstrap.sh
apps/proxy/qualification/linux/postgres-fixture/test_fixture.py
apps/proxy/qualification/linux/postgres-fixture/test_native_bootstrap.py
apps/proxy/qualification/linux/postgres-fixture/test_native_output_capture.py
apps/proxy/qualification/linux/postgres-fixture/test_prisma_error_evidence.py
apps/proxy/qualification/linux/prisma-build.py
apps/proxy/qualification/offline-policy.mjs
apps/proxy/qualification/runtime/__init__.py
apps/proxy/qualification/runtime/aws_counter.py
apps/proxy/qualification/runtime/bedrock_body.py
apps/proxy/qualification/runtime/bedrock_transport.py
apps/proxy/qualification/runtime/ingress.py
apps/proxy/qualification/runtime/lifetime.py
apps/proxy/qualification/runtime/native_usage.py
apps/proxy/qualification/runtime/server.py
apps/proxy/qualification/state/__init__.py
apps/proxy/qualification/state/admission.py
apps/proxy/qualification/state/grants.py
apps/proxy/qualification/state/ledger.py
apps/proxy/qualification/state/postgres_store.py
apps/proxy/qualification/state/pricing.py
apps/proxy/qualification/state/sql.py
apps/proxy/qualification/test/offline-policy.test.mjs
apps/proxy/qualification/test/test_aws_counter.py
apps/proxy/qualification/test/test_bedrock_transport.py
apps/proxy/qualification/test/test_ingress.py
apps/proxy/qualification/test/test_lifetime.py
apps/proxy/qualification/test/test_native_usage.py
apps/proxy/qualification/test/test_postgres_state.py
apps/proxy/qualification/test/test_server.py
apps/proxy/qualification/test/test_tool_budget_source.py
apps/runtime/native-runner-gateway.mjs
apps/runtime/pinned-native-transport.mjs
apps/runtime/runner-poststart-cli.mjs
apps/runtime/temporal-authorization.mjs
apps/runtime/test/native-runner-gateway.test.mjs
apps/runtime/test/pinned-native-transport.test.mjs
apps/runtime/test/snapshot-mount.test.mjs
apps/runtime/test/temporal-authorization.test.mjs
infra/product-preview/model-proxy-change-set.md
infra/product-preview/proxy-image-start.sh
infra/product-preview/temporal-issuer-renewal.mjs
infra/product-preview/test_proxy_image_start.py
```
