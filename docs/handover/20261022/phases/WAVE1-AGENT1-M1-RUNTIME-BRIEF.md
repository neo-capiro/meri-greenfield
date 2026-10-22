# Wave 1 · Agent 1 v1 · M1 runtime brief (Reliable chat)

**From:** Fable. **Repository:** `neo-capiro/meri-greenfield`. **Branch:** `feat/meri-m1-runtime`, cut from `main` eb6579204 (PR197 + C12, live since 2026-10-21 23:44 UTC).
**How we work:** you build. dot's reviewers review. Fable merges and ships.
**Rules:** draft PRs only; no merges, no AWS access; list the tests you ran and the ones you couldn't run; mutation-check every new test.

## Sources of truth
1. The two master closeout plans (20261021). They're the detailed spec.
2. `STANDING-RULES.md` (verbatim sections from both plans).
3. The tickets below, verbatim.

Implement each ticket's **bounded work** and meet its **acceptance** exactly. Reuse the owners it names. If a ticket, the rules and this brief disagree, or a ticket leaves a decision open, **ask Fable on #202; don't decide.** Name the closed ticket IDs in the PR.

## Sequencing with P1 (#200)
- Start now. P1 is waiting on the #196/#199 merge, and M1 doesn't need to wait.
- Keep M1 in its own PR. **Don't touch P1's exception files** (apps/proxy/product, apps/gateway/budget). M1 needs none of them; if it turns out it does, ask first.
- P1 merges first. Then rebase M1 onto that `main`, fix conflicts, and rerun the gates.
- Small, ticket-scoped commits make that rebase cheap.

## Context from tonight's live release
- The first preview turn on eb657920 failed with ATTEMPT_LOST: 112 s on the owner hot path, then a control 503 at activity-complete. The same failure happened on C11. S1 (P1 + P2) removes the latency; it's not M1's job.
- **But** M1's lifecycle tickets must make that failure mode honest and recoverable. A turn that runs out its window ends as a durable, readable terminal outcome (MR-06/MR-08), and the next turn is admissible and clearly signalled (M1-X1 below).

## Tickets

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

#### M1-X1 · P0 (new, for agent 4's MF-06 Ready state) · Publish next-turn admissibility
**Why:** agent 4's composer can only say "You can send your next message" on evidence. Public contract 0.1.10 exposes terminal history and cancel receipts, but nothing proving that the previous run has retired and that a new turn will be admitted. A terminal record can still be followed by retirement 409 (see capiro-frontend #119).
**Bounded work:** add one additive field to the existing public conversation status or history contract (no new route): either `nextTurn: {admissible: boolean, reason}`, or a retirement-complete marker, derived from the same authority control uses to admit the next run. Bump the contract version additively. Don't add a timer or an inference.
**Acceptance:** after a terminal turn, the field flips to admissible only when control would admit the next run. A send while it's false is refused with the existing retirement 409. Tests cover completed, failed, cancelled and stop-in-progress, plus across a deploy (E09/E10). Agent 4 is told the field name and version on #202.

#### E12-D · Pause, resume and fork across a deploy
B's C11 review (follow-up 4): "Still pinned on both branches, by design for now: pause → resume/fork across a deploy." M1 closes this under E12 below. A conversation paused before an image-only deploy resumes or forks afterwards under the candidate-11 continuity rule. Unsupported cases are explicitly unavailable, never silently broken.

#### Review follow-ups owed from candidates 9–11 (small; one commit each)
1. Revive `native-restorer-pg`: the broker pg fixture needs a transition-authority stub.
2. Tighten the `running` assertion (candidate 9 review).
3. Drop the router TLS fixture's `openssl` dependency (`synthetic-certificates.mjs`, C10 item 3), so the composed router tests load in the runtime image.
4. B's C11 notes:
   - (1) `accept`'s continuity read is not a full integrity check. Keep it refuse-only and add the identity-to-run binding check if it's cheap.
   - (3) Add the runbook line: only a `policyRevision`, SDK/CLI or format bump invalidates existing conversations; an image deploy does not.
   - (4) This is E12-D above.
5. Any ledger-load test failure on your base run: classify it per MX-13 (don't skip it).

## Acceptance scenarios (master plan §5, verbatim; M1 owns E05–E12 and E40)
| ID | Scenario | Required observable result |
|---|---|---|
| E05 | Session expiry and transient Core503 | Retryable unavailable differs from revoked identity; no unauthorized bytes or false success |
| E06 | Sign-out/tenant/client change with stored draft/intent | Old data/credentials/receipts cannot cross the new identity or client |
| E07 | Stop at queue/load/start/model/tool/output phases | Logical stop fence and physical cleanup/unknown status are distinguishable; no later unauthorized effect |
| E08 | Failed/cancelled turn after completed checkpoint | Next allowed turn uses last valid published checkpoint, not failed partial state |
| E09 | Image-only release after completed turn | Existing conversation and pending reserved successor continue under candidate11-compatible rules |
| E10 | Deploy/rotation while old original is in flight | Historical Stop/retirement can close old work safely; current execution checks are not weakened |
| E11 | SDK/CLI/format incompatibility | Closed refusal before persistent successor acceptance; clear recovery/new-chat choice |
| E12 | Resume/fork/retry/steer/pause | Correct exported contract semantics, exact target, current scope and one receipt; unsupported cases explicitly unavailable |
| E40 | Budget/terminal usage missing or contradictory | UNKNOWN liability preserved; no invented usage or release of reserved spend |

#### MX-13 · Close the honest regression receipt, including host-sensitive and native-only gaps
**Priority / type:** P1 qualification; some failing source assertions may block P0 paths.

**Evidence and root cause:** EX-06 already provides inventory/receipts, so do not write another general runner. PR196 retains paired scripted STORE_UNAVAILABLE/schema/provenance/IPC failures and serial deadline failures; it explicitly refuses to relabel them as absent external DB. PR197 retains two public provenance failures, Windows artifact failures, M8 host/native gaps and unrun PKI/render/nativePG controls. No checks were executed by this read-only audit. GitHub statuses and PR-triggered workflow lists were empty for audited main/196/197, not green receipts or proof no other checks exist.

**Bounded work:** Existing QA owner inventories every test file against the combined source, exact lock/dependency closure, owner and environment. Reproduce each relevant failure once on both exact base and head with retained outputs; classify source regression, inherited defect, stale fixture, unsupported host, absent native prerequisite or unknown. Fix assertion/fixture drift only against an independently justified contract, not by weakening guards or excluding failing tests. Use nonroot Linux and disposable PostgreSQL16 for native tests; run Python/tooling/checkpoint synthesis and package public generators omitted from the main Node baseline separately. Keep timeout/interruption/skip/failure counts and test IDs; test concurrency must respect shared DBs and timing fixtures.

**Dependencies:** MX-02 combined tree, MX-04/05 native environment, individual MF/MR/MT/MM fixtures.

**Acceptance:** Each selected capability has clean relevant positive/negative/contract/native tests or a named blocking defect; waived optional held tests cannot qualify enabled paths. Receipts pin source/tree/dirty state/host/packages/command/selectors/time/output hashes, distinguish declared archive commit from verified provenance, and do not add overlapping counts. All first-chat/next-turn/deploy/Stop regressions remain in the suite.


## Definition of done for this PR
- Every ticket above meets its acceptance.
- E05–E12 and E40 have named tests or a named blocking defect.
- Mutation checks are killed.
- P1-file collisions are zero.
- The PR body lists the gates that need Docker, PostgreSQL 16 or AWS as "Fable-run". I run them when shipping.
