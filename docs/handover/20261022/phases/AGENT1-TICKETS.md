# Agent 1: C12 (MR-07) and M1 runtime (verbatim from the Meri master closeout plan)

> **HISTORICAL (2026-10-23).** Wave 1 material for layers that Wave 2 item 0 deletes (the owner/proxy pair, budget reservations, per-operation authority, P1/P2/S2). Do not send or implement it. See `../STANDING-REQUIREMENTS.md` and `../source-of-truth/SUPERSEDED-BY-ITEM-0.md`.

#### MR-07 · P1 · Publish a precise checkpoint/version and dormant-original continuity contract
**Class:** D + Q, not permission to relax current refusal. **Owner:** runtime compatibility, release/adoption gate, FE messaging.

**Evidence:** SDK and CLI are pinned; the original admission remains tied to its admitting render. Completed-conversation next turns survive image-only changes but refuse SDK/CLI changes; pre-existing successor reservations adopt the accepting image only when compatibility holds. [apps/worker/conversation/options.mjs:20–33](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/options.mjs#L20-L33), [apps/runtime/test/conversation-survives-deploy.test.mjs:71–104](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/test/conversation-survives-deploy.test.mjs#L71-L104)

**Bounded work**
- Document separate states: admitted but unrun original; running original; retired completed turn; failed/cancelled turn with older completed checkpoint; reserved successor; pause/resume/fork checkpoint; SDK mirror append uncertainty.
- For each, specify image-only update, SDK/CLI/opaque-format update, policy/client change, rollback and expiry outcomes. Preserve current denial on incompatible SDK/format.
- Decide supported remediation: retained compatible runtime / explicit migration owner / explicit new conversation with clearly disclosed lack of session continuation. PR178 approved configuration adoption remains its own decision and must not silently become checkpoint migration.
- Add typed user-visible reasons for incompatible continuation vs transient service failure, without exposing private configuration or claiming a new conversation resumes the old SDK session.
- Do not silently replace an admitted-but-unrun original or recompute its expiry on refresh; any explicit replacement requires proof of no authority and a separate approved identity transition.

**Files:** `prepared-candidate.mjs`, `prepared-run-configuration.mjs`, checkpoint compatibility validators/session factory and generated public errors where needed; deployment docs and FE are separate owners.
**Acceptance:** image-compatible continuity retains conversation, prompt identity, original source checkpoint and monotonically increasing writer fence; incompatible change produces zero reservation/admission/model calls; cleanup MR-01 still works even when execution is incompatible.

---

#### MR-01 · P0 · Repair historical stop-only retirement after a control render change
**Class:** S, with live consequence U. **Owner:** runtime/native lifecycle. **Release rule:** do not declare cross-render in-flight cleanup qualified until this is closed.

**Exact mismatch**
- A restarted dynamic original has no cached controller. The stop route calls `initial(binding, life, true)`. “true” allows expiry only; `admittedRecord` still defaults to `pinConfiguration=true`. A different configuration SHA rejects before the retirement port. [apps/runtime/prepared-run-registry.mjs:37–46](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/prepared-run-registry.mjs#L37-L46), [apps/runtime/prepared-run-registry.mjs:138–147](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/prepared-run-registry.mjs#L138-L147)
- The retirement port independently calls `initialRecord(..., cleanup=true)`, which still compares current policy, runtime versions, configuration SHA, run window and current schedule bounds. [apps/runtime/prepared-run-bindings.mjs:38–44](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/prepared-run-bindings.mjs#L38-L44), [apps/runtime/prepared-run-bindings.mjs:97–104](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/prepared-run-bindings.mjs#L97-L104)
- It reconstructs issuance facts using the current operations, approved reads, control capability digest and transport; reconstructs allocator task request, qualification, allocation and container from current configuration; then demands hashes equal the original immutable records. Rotation of a credential omitted from the configuration identity can therefore reach a later facts-drift refusal even when the configuration digest is unchanged. [apps/runtime/prepared-run-bindings.mjs:105–111](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/prepared-run-bindings.mjs#L105-L111), [apps/runtime/prepared-run-configuration.mjs:7–16](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/prepared-run-configuration.mjs#L7-L16)
- Historical allocation retrieval exists only for an already RETIRED source. It cannot retire an old live source. [apps/runtime/prepared-run-bindings.mjs:55–68](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/prepared-run-bindings.mjs#L55-L68)

**Why existing tests do not close it**
Candidate11's helper retires the original before render B is constructed. Its deployment tests therefore establish *post-retirement continuation*, not cross-render cleanup. The restart-retirement fixture recreates processes with the same configuration. [apps/runtime/test/conversation-survives-deploy.test.mjs:22–45](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/test/conversation-survives-deploy.test.mjs#L22-L45), [apps/runtime/test/conversation-survives-deploy.test.mjs:53–63](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/test/conversation-survives-deploy.test.mjs#L53-L63), [apps/runtime/test/restart-retirement.test.mjs:1–70](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/test/restart-retirement.test.mjs#L1-L70)

**Bounded work**
1. Add a stop-only trusted historical-facts resolver over immutable initial-admission, run, issuance and allocation rows. First inventory whether every nonsecret original fact is recoverable; if not, add narrowly scoped immutable custody for future issuances plus a fail-closed legacy repair procedure. Do not assume the facts hash can reconstruct missing facts.
2. Route only authenticated original retirement through that resolver. Match tenant/actor/conversation/full binding, original execution identity, original task ARN/task definition, grant set, hashes and stored request before invoking the existing canonical stop.
3. Separate “valid historical ownership for cleanup” from “eligible under the current render for new execution.” Keep current-render preparation, kickoff, lease, policy, scope, SDK and admission checks untouched.
4. Do not reopen model credentials, mint grants, allocate, restore, run the SDK, or reissue a turn in this path. Preserve ambiguous physical stop and revocation as UNKNOWN. Do not accept caller-supplied historical configuration as authority.
5. Extend `prepared-run-registry.mjs`, `prepared-run-bindings.mjs`, the immutable issuance reader only as necessary, and `restart-retirement.test.mjs`/`conversation-survives-deploy.test.mjs`. Reuse `createOriginalRetirement`, not a second allocator. [apps/runtime/native-authority/remote-composition.mjs:98–110](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/native-authority/remote-composition.mjs#L98-L110)

**Dependencies:** current receipt schema, original allocation/issuance owner, release-coordinator migration/release review; P2 only for its existing currentness/security verification.
**Acceptance:** the matrix in §3; every successful receipt must be backed by exact physical-stop evidence and revoked grants, with zero new grants/allocations/model invocations. A successor is still refused until source settlement. No observed live failure is asserted by this audit.

---

#### MR-02 · P1 · Consume the existing transient-authority classification in the control pump
**Class:** S. **Owner:** worker lifecycle.

**Root cause/evidence:** `native-client.mjs` now attaches the existing authority-unavailable marker only to a genuine unanswered dependency/transport. `activity-lifecycle.mjs` still decides using the string code alone. Its own comment documents the old conflation: DEADLINE can be skipped for the run lifetime; all NATIVE_UNAVAILABLE errors are skipped twice then fatal. Thus a known transient outage and a definitive refusal follow the same count path. [apps/runtime/native-client.mjs:21–32](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/native-client.mjs#L21-L32), [apps/runtime/native-client.mjs:65–80](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/native-client.mjs#L65-L80), [apps/worker/conversation/continuation/activity-lifecycle.mjs:14–20](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/continuation/activity-lifecycle.mjs#L14-L20), [apps/worker/conversation/continuation/activity-lifecycle.mjs:54–73](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/continuation/activity-lifecycle.mjs#L54-L73)

**Bounded work:** use the existing authority-availability predicate in the unfenced read classification; preserve canonical diagnostics and cause. Definitive authorization/refusal/malformed-protocol errors should fail immediately. A proven nonanswer may use the existing bounded backoff inside the same absolute run lifetime. Do not change claim, ACK, capture, fenced-read or held-publication behavior; these are effect/hold barriers, not skippable polls. Agree any allowance change with the P1 table owner, rather than creating a second timeout policy.

**Tests:** update `lifecycle-activity.test.mjs` cases currently asserting a third generic unavailable ends the run. Add explicit marked transient vs unmarked refusal; several missed reads followed by steer; a refusal after two misses; deadline during backoff; revoked task lease; cancellation before initialization; fenced read after publication refusal; no repeated command claim or UUID. Existing tests at lines73–109 prove the old behavior, not the new classification. [apps/worker/conversation/test/lifecycle-activity.test.mjs:73–109](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/test/lifecycle-activity.test.mjs#L73-L109)
**Acceptance:** no definitive refusal is masked; no benign marked outage kills solely by generic-code count; original absolute deadlines and all irreversible-control uncertainty barriers remain intact.

---

#### MR-06 · P1 · Close durable lifecycle outcome readback and recovery after process/request loss
**Class:** S limited recovery surface; Q broader durability; U old-source-session replay behavior.

**Existing behavior:** durable controls are claimed once; PENDING can dispatch, DISPATCHING/UNKNOWN cannot be automatically resent; steer becomes APPLIED only after the exact SDK user-message UUID. Completion has immutable PUBLISHED readback, and Stop has its own durable fence readback. These are intentional barriers. [apps/control/conversations/lifecycle/service.mjs:53–103](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/conversations/lifecycle/service.mjs#L53-L103), [apps/worker/conversation/continuation/activity-lifecycle.mjs:83–108](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/continuation/activity-lifecycle.mjs#L83-L108)

**Missing closure:** the inspected public lifecycle family exposes control and checkpoint inspection, not a separate content-free control-outcome readback tied to a committed source-to-target transition. Replaying an exact command returns the journal receipt only if the ordinary source operation can still authenticate. That does not prove receipt recovery after a resume advances the current run, a process restarts, or source credential expires. Existing `readApplied` is a within-request recovery path using transition authority. [apps/control/conversations/lifecycle/service.mjs:64–67](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/conversations/lifecycle/service.mjs#L64-L67), [packages/contracts/conversation-lifecycle/protocol.mjs:1–4](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/packages/contracts/conversation-lifecycle/protocol.mjs#L1-L4)

**Bounded work:** first test actual composed old/new-session replay across a successful transition and lost ACK. If current source already supports it through another current-authority route, publish that exact contract and consumer instead of adding an endpoint. Otherwise provide a read-only receipt lookup under fresh current identity plus exact persisted transition custody, returning only source/target/control state and receipt IDs. Reconcile only from existing authoritative proof; an unobserved SDK message remains UNKNOWN. Do not infer APPLIED from a final assistant answer, transcript text, timeout or process death. Define owner/operator escalation for irreducible UNKNOWN without clearing the barrier.

**Files:** lifecycle service/journal transition readback, identity transition resolver, contract metadata/client and FE consumer only if required; `completion-journal` and `session-owner` receive boundary tests, not a second state machine.
**Acceptance:** ACK-loss receipt recovery never resends SDK input, reallocates a target, replays mutation or captures another checkpoint. Expired/foreign source selectors cannot release content. The user can distinguish pending, applied, unknown, source-retirement pending and result-not-released.

---

#### MR-08 · P1 · Qualify the complete admission-to-next-turn lifecycle, not only happy-path endpoints
**Class:** Q. **Owner:** runtime supplies the semantic cases; release coordinator owns integrated test/release execution.

**Bounded work:** turn §4 into a composed regression suite at the exact release commit and packed contracts. Retain existing unit/protocol tests and add missing crossings of process boundaries, real transaction ACK loss, identity renewal, native currentness and provider terminal evidence. No parallel workflow/model loop.

Minimum crossings:
- initial input allocation/admission/submit duplicates and ACK loss before/after run acceptance and Temporal start;
- kickoff claim/lease expiry, task replacement, queued cancellation before allocation and durable foreclosure;
- load/currentness outage, SDK init failure, mirror append ACK loss, restored transcript/session key mismatch;
- stream disconnect/reconnect with strict cursor, duplicate event ID, late output after Stop/hold/suppression;
- terminal usage followed by capture/publication loss; completion observed but physical task not yet retired;
- Stop repeated after caller disconnect, control restart, Temporal NOT_FOUND and reconciliation exhaustion;
- next turn after completed/failed/cancelled source, with and without an older completed checkpoint, reserved before deploy and accepted after;
- steer/pause/approval wait/capture/resume/fork including retained original during fork and fresh target session;
- process-local session renewal after bearer expiry/control restart, same exact binding, with no implicit next-turn reservation or Stop.

**Evidence basis:** existing semantic tests cover many individual boundaries, including terminal events, hold failure, lifecycle commands and image continuity, but use scripted/native test owners. [apps/worker/conversation/test/terminal-settlement.test.mjs:1–22](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/test/terminal-settlement.test.mjs#L1-L22), [apps/worker/conversation/test/completion-activity.test.mjs:1–15](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/test/completion-activity.test.mjs#L1-L15), [apps/worker/conversation/test/lifecycle-activity.test.mjs:36–48](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/test/lifecycle-activity.test.mjs#L36-L48), [apps/runtime/test/conversation-survives-deploy.test.mjs:22–49](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/test/conversation-survives-deploy.test.mjs#L22-L49)

**Acceptance evidence:** each case records actual source/target bindings, exact image/SDK/CLI/contracts, request/control/event identity, journal transitions, allocation/task/grant disposition, checkpoint lineage and sanitized error/outcome. Require absence assertions for duplicated provider calls or unintended actions. A mock pass cannot be labeled physical stop, real SQL durability, deployed SDK compatibility or live currentness.

---

#### MR-09 · P1 · Qualify provider terminal accounting and unresolved-liability recovery
**Class:** Q + operational closure, not a new budget implementation. **Owner:** proxy/accounting runtime; P1/P2 retain their existing ownership.

**Existing contract:** the Bedrock native parser accepts the supported model/stop/usage envelope, excludes unsupported cache/context-edit/tier shapes and requires a terminal message-stop/EOF. The reservation CountTokens basis is not required to equal billed input; exceeding liability holds/quarantines rather than refunding. [apps/proxy/qualification/runtime/native_usage.py:1–265](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/proxy/qualification/runtime/native_usage.py#L1-L265), [apps/proxy/product/response_settlement.py:1–296](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/proxy/product/response_settlement.py#L1-L296)

**Bounded work**
1. Freeze supported model alias/API shape, allowed stop reasons, usage fields and treatment of optional Bedrock metrics in release evidence. Current source behavior, not an old PR title, is authoritative. Any expansion of thinking, cache, context edits or provider features is a separately reviewed capability change.
2. Add terminal evidence cases: partial frame, malformed/nonterminal EOF, message_stop without EOF, disconnect after provider completion before settlement ACK, duplicated terminal, usage mismatch, output above reservation, late cancel, zero reported usage and owner replacement.
3. Inventory durable request/hold/dispatch/native evidence/settlement receipts after proxy death. Wire an exact content-free outcome inspection/reconciliation procedure using the current settlement owner's readOutcome. If proof is unavailable, retain UNKNOWN; no second inference and no automatic refund.
4. Ensure UNKNOWN liability blocks capacity reuse and retention purge until authoritative settlement/no-dispatch proof exists. Operator evidence must retain original task/grant/pricing/request binding, not use current pricing or logs as substitute authority.

**Dependencies:** active P1 budget table, P2 pair/currentness, MR-05 retention and release telemetry/runbook. No duplicate P1 timing edit, no P2 replacement implementation.
**Acceptance:** lost ACK can read back an exact committed settlement; no outcome evidence never becomes free capacity; actual usage cannot be attributed to a later run or different price version; downstream completion does not imply cost settlement.
