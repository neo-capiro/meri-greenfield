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

FROM: Root | TO: Wave2 event polling simplification | TYPE: brief | RE: bounded event observation work (Wave 2, simplification lane 1)
# Wave 2 event polling simplification

Repository: `neo-capiro/meri-greenfield`. Branch: `codex/w2-event-polling-simplification-20261025`. Dedicated new checkout: `C:/dev/w2-event-polling-simplification-20261025`, created from the refreshed exact deployed/integration base by Root; never repurpose or reset the source checkout. Author session: **Wave2 event polling simplification**. Independent review session: **Wave2 event polling review**. Neither has been created by this briefing task.

## Objective and first actions

Reduce existing DB polling/redundant observation work in the live conversation event subscription, with the smallest measured change. The verified current defaults are `pollMs=100`, `idleRecheckMs=10000`, subscription cap 30000 ms and page maximum 100 events. Empty polls read the store; Core access is checked at opening, after each nonempty page's read before release, and at idle rechecks. The production identity adapter shares its canonical `/current` receipt within a pass: test fixture port calls are not automatically network calls. Do not describe a background-minute count such as 252/min as one run's Core calls or as a demonstrated per-turn budget breach.

1. Read the real route and service path plus existing tests. Verify a bounded idle/sparse/burst baseline using the existing `event-observation.test.mjs` fixtures; record elapsed interval, polls/store reads, delivered pages/events, session observations and delivery delay separately. Use no model turn or AWS for this local comparison.
2. First try a small capped adaptive poll delay within the existing observer: retain prompt initial/active reads, back off repeated empty reads, reset when output appears, and bound sleep by idle-access recheck and subscription deadlines. Keep post-read current access before every nonempty page release. Do not add a notification bus, event authority cache, background subscriber registry or new persistence owner. This is a starting implementation choice; an equally smaller measured change is acceptable.
3. Retain prompt terminal flush, accepted durable cursor, orderly window close/reconnect, signal cancellation, no late output after Stop/retention refusal, and current access. Do not batch data across an unchecked authority change. Avoid hot looping when a terminal page or capped window ends.
4. Compare the same bounded fixtures serially on unchanged base and candidate. Return exact numbers and limits; reject a change whose DB saving only comes from unacceptable event/Stop delay. A local fixture demonstrates the changed mechanism, not complete deployed DB statement totals or the simple-turn budget.

## Exclusive owned paths and freezes

Product edits only: `apps/control/conversations/events.mjs`; the `observe` implementation/constants and directly necessary comments in `apps/control/conversations/service.mjs`. Do not change service admission, loaded context or usage logic as collateral cleanup.

Owned adjacent tests: `apps/control/conversations/test/event-observation.test.mjs`, `events-reconnect-authority.test.mjs`, `stream.test.mjs`; only a demonstrated directly affected assertion in `retention-serving.test.mjs` or `stop-races.test.mjs`. Existing fixture use is preferred; `application-fixture.mjs`/`store-fixture.mjs` are read-only unless Root assigns the precise edit first. New test file only when the existing suite cannot express the case; explain why.

No edits to `apps/runtime/native-read-context.mjs`, native read-context/current-authority owners, `apps/runtime/tool-dispatch.mjs`, Hermes's read-context work, runtime diagnostics/startup or Runtime's files. No changes to control composition, execution journal, dispatcher/workflow, Temporal, SDK, public contracts, lockfiles, DB schema, frontend, infra or build system. Any necessary shared-path change is reported to Root for the existing owner; do independent work meanwhile. Lane 2 may not edit either owned product file.

## Required local acceptance

Use existing Node 24 environment and packed contract/UI dependencies; read the manifests before commands. Run serially and record base/head UTC, exact commands, exit codes, totals, failures and skips. Initial applicable command:

```text
node --test --test-concurrency=1 apps/control/conversations/test/event-observation.test.mjs apps/control/conversations/test/events-reconnect-authority.test.mjs apps/control/conversations/test/stream.test.mjs apps/control/conversations/test/retention-serving.test.mjs apps/control/conversations/test/stop-races.test.mjs
npm run typecheck --prefix apps/control/conversations
```

Add only relevant existing current-access/history composition cases if the diff changes their boundary. Do not run the root's entire accumulated suite. Do not edit gold assertions merely because lower polling makes an old implementation-specific polling-count expectation fail; replace that expectation with measured intended cadence plus behavior.

Required cases: empty idle subscription; sparse output; >100-event burst; terminal plus final page; reconnect at accepted cursor without duplicate/omitted events or dispatch; abort during backed-off wait; repeated cancellation; revocation between DB read and release refuses all new bytes; idle revocation reaches refusal within ≤30 s including timer/backoff/access-request margin; retention suppression/refusal; bounded slow/unavailable Core; window end while recheck is slow. Use a finite maximum test duration and deterministic synchronization where possible. Preserve the existing recheck deadline handling.

Loaded privileged context revocation remains ≤30 s: this lane must preserve the existing owner and cannot claim a complete loaded-context revocation pass from an SSE fixture. Hermes/Runtime owns that integration evidence; Root carries the explicit missing check to authenticated acceptance. Do not increase the access interval to 30 s without propagation margin, and never to 60 s.

Before/after report: three bounded serial samples each for idle and sparse observation plus one burst/reconnect run is sufficient unless a failure warrants more. Keep identical source fixture input, machine and duration; report every sample, p95/max where meaningful, and read reduction alongside first-event/inter-event/terminal latency. No fake sleeps presented as end-to-end latency proof. Live acceptance later uses T3/T4/T5/T6/H1 with finite turns already coordinated by Root; no author model budget.

For any new/changed executable regression, demonstrate an intentional meaningful mutant fails: bypass post-read fresh access, fail to abort the backed-off delay, or lose/reset the accepted cursor, according to the assertion being added. Mutate only the owned disposable checkout, restore the final source and rerun the relevant case; record killed/survived. Do not add a mutation framework. If no new executable test is needed, say none and mutation N/A with reason.

## Completion and next owner

Deliver a draft PR with exact base/head/tree, deleted/replaced polling logic, changed files, measured local base/head table and uncertainty; no latency/per-turn-budget claim stronger than the measurements. List tests NOT RUN explicitly: live Core/Clerk revocation, loaded-context invalidation, actual PG statement attribution unless exercised, real AgentCore SDK, preview reload/Stop and full simple-turn ≤30 Core calls/≤3 s. Name Root/Release and authenticated acceptance owner for those remaining checks.

Reviewer uses PROCESS6.2 on exact head, checks the post-read access and abort/deadline paths, verifies meaningful mutants, and distinguishes inherited failures from regressions using the same base environment. Root integrates/reviews final overlap and routes one candidate to Release. Release returns PROCESS6.3 exact source/image/revisions and no-deploy window; acceptance records advertised behavior independently. No new release qualification framework.

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
| **MR-08** admission-to-next-turn lifecycle suite | **RE-SCOPED** | Behavioural crossings: duplicate submit, ACK loss, Stop repeated, stream reconnect with cursor, next turn after a failed or cancelled turn, deploy between turns, pause/resume/fork | Crossings that exist only for kickoff claim/lease, allocation and grants, native currentness, terminal usage capture |
| MF-02 identity, exact-run renewal, access-loss isolation | **RE-SCOPED** | A revoked user loses access within 30 s | Ordinary Clerk session refresh plus one Core access check per turn; drop "exact-run renewal" |
| MX-09 latency, cost, resource measurement | **RE-SCOPED** | Measure on the new path against the targets in `../STANDING-REQUIREMENTS.md` §6 | "Without duplicating P1/P2" (they are gone) |

#### MF-02 — Qualify identity, exact-run renewal and access-loss isolation (P0 before live activation)
> **[RE-SCOPED 2026-10-23]** A revoked user still loses access within 30 s. Use the ordinary Clerk session refresh plus one Core access check per turn; there is no "exact-run renewal". Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

- **Root cause / evidence:** Fresh token issuance and 45-second renewal already exist. Source presence does not prove backend bearer lifetime, account mapping, deployment origin or revocation behavior.
- **Bounded files/owner:** `identity-token.server.ts`, `opaque-session-controller.ts`, `session-bootstrap.ts`, `host-controller.ts`, `useConversationConnection.ts`, `SelectedClient.tsx`, shared query scope and their tests. Fix only demonstrated gaps.
- **Implementation:** Build composed acceptance scenarios for verified native actor, tenant/client switch, archived/deleted client, signout, revoked membership, token expiry while streaming and while mutation pending, multiple renewal cycles, browser back/forward, StrictMode/remount. On exact-lifetime loss abort readers, hide actor/client-bound data and invalidate sensitive cached views without auto-canceling backend work. Reissue using fresh identity for exact existing selectors; never allocate next turn on reconnect.
- **Dependencies / exclusions:** MR session-owner expiry/error taxonomy and environment operator qualification. No browser tenant/actor override, persistent bearer storage, weakened issuer/audience or synthetic client.
- **Acceptance:** At least two real renewal cycles preserve run ID and accepted cursor, no duplicate submit/next-turn; stale account/client DOM is hidden immediately, denied data not resurrected by cached pages; explicit retry cannot mint broader authority; native subject-to-actor mismatch fails closed.

#### MR-08 · P1 · Qualify the complete admission-to-next-turn lifecycle, not only happy-path endpoints
> **[RE-SCOPED 2026-10-23]** Keep the behavioural crossings (duplicate submit, ACK loss, Stop repeated, stream reconnect with cursor, next turn after a failed or cancelled turn, deploy between turns, pause/resume/fork). Drop crossings that exist only for kickoff claim/lease, allocation and grants, native currentness or terminal usage capture. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.
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

#### MX-09 · Measure latency, cost and resource behavior without duplicating P1/P2
> **[RE-SCOPED 2026-10-23]** Measure on the new path against the targets in `STANDING-REQUIREMENTS.md` §6. "Without duplicating P1/P2" no longer applies: they are deleted. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.
**Priority / type:** P1 performance qualification; existing owners retain implementation.

**Evidence and root cause:** EX-07 local acknowledgement excludes LB/TLS/Clerk/PG/Temporal/deployed UI, and fresh-task readiness stays UNRUN without a real probe. PR195's historical 164-Core-call median is a measurement baseline, not a promised reduction. Current PR196's focused owner/proxy tests pass in its receipt, but broader paired host gate remains not green.

**Bounded work:** Measure actual Runtime V1 cold start, warm follow-up and idle restore with one recorded clock/sample/source/config protocol. Preserve first-text and acknowledgment targets; report SDK/model TTFT, Core/AWS/DB calls, tokens/cost, queue time, refusals, cancellation and cleanup. No synthetic sleep-as-proof, larger auth deadlines or uncertain effect replay to improve apparent latency.

**Dependencies:** Current Runtime/control owners, MX-08 and native image/capability qualification.

**Acceptance:** Same-hardware/serial base-head source comparisons classify failures; controlled deployed sample meets approved thresholds or remains explicitly blocked. Report failures and refused/slow samples, not only successful timings; no summed overlapping test totals. P1/P2 are historical; no owner/proxy rewrite is created by this ticket.

### Matching E scenarios (verbatim)

| Scenario | Trigger | Required result |
|---|---|---|
| E02 | Reload/new tab after completion | Same messages/citations/artifacts, correct ordering and no prompt redispatch |
| E03 | Double click and lost submit acknowledgment | Same request identity reconciles to one accepted effect/run; no duplicate |
| E04 | Transport disconnect before/after first text | Cursor replay neither drops nor duplicates durable events; browser close does not silently Stop |
| E05 | Session expiry and transient Core503 | Retryable unavailable differs from revoked identity; no unauthorized bytes or false success |
| E06 | Sign-out/tenant/client change with stored draft/intent | Old data/credentials/receipts cannot cross the new identity or client |
| E07 | Stop at queue/load/start/model/tool/output phases | Logical stop fence and physical cleanup/unknown status are distinguishable; no later unauthorized effect |
| E08 | Failed/cancelled turn after completed checkpoint | Next allowed turn uses last valid published checkpoint, not failed partial state |
| E09 | Image-only release after completed turn | Existing conversation and pending reserved successor continue under candidate11-compatible rules |
| E10 | **[RE-SCOPED]** Deploy/rotation while old original is in flight | Historical Stop/retirement can close old work safely; current execution checks are not weakened |
| E18 | **[RE-SCOPED]** Read active-set and revoked operation | Only measured admitted operations are discoverable/executable; revoked/missing owner refuses |

For E09 retain continuation after deploy; E10 Stop and clean closure/resume without obsolete pins; E18 Core-allowed tool set and revoked refusal; E42 forward rollback and receipts, not retired model-spend liabilities. The exact register governs these replacements. Item-0 T3 first turn, T4 follow-up, T5 reload/reconnect, T6 Stop, H1 history and H2 history filters remain release acceptance; only changed cases are assigned to this narrow release.
