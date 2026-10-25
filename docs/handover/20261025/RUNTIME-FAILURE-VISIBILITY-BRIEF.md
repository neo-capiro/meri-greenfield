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

FROM: Root | TO: Runtime and Objectives author | TYPE: PROCESS6.1 brief | RE: runtime setup/startup failure visibility (Wave2 runtime lane)
PreparedUTC 2026-10-25T17:29:05.347Z

Repository: neo-capiro/meri-greenfield.
Branch: codex/wave2-runtime-diagnostics-20261025.
Exact source base: 7eee7f7c358be9ae903169816ef68eb6e64ae1f3; tree a87135487d6c48d579b3fdfc3845e975b1d56567.
Base branch: codex/wave2-batch-meri-20261025 (PR252); source dependencies are already included at the exact base. No cherry-pick of older PR250 or repeated lineage qualification.
Preserved dedicated worktree: C:/dev/wave2-runtime-diagnostics-20261025. Existing batch/Hermes/history worktrees remain untouched.
Rules revision loaded: c0411e2cd20c35b3a8619817a4fec25ef7047aba, including the instruction/engineering provenance note. Sections1–4 above are verbatim; the note grants no new scope or architecture approval. It distinguishes Neo's direct instructions from engineering interpretations and historical approved labels. Current roles supersede older Ultra/helper wording: Root Ultra orchestrates, author and separate reviewer xhigh, Release alone performs AWS/migrations/build/rollout/rollback.

Allocation, verbatim bounded work
"New phase own narrow runtime failure visibility/startup reliability fixes through EXISTINGdiagnostics, notnewframework. Read root outputs/architecture-code-review.md/evidence-review.md, existingHERMESstartupreport and exact7eee. Currentdiagnosticsalreadywired; realgapbefore runnerassembled andgenericstartupcatch/settlementcorrelation. Identifyprecisely missing safe stage/reason boundary; extendexistingcontent-free fixedcode/class diagnostics only where needed, preserving privacy (no rawSDKerror/body/token). Considerbounded readiness transienthandling ONLY if existing source/test demonstrates classification and safe strategy; do not declarecauseproven or blindly60sretry allauthfailures. Existing workerentrypoint/startupdiagnostics paths reservedyou; noeventpollingpaths (newlane), no3read-context/gatewayfiles (Hermes), noapproval/doc/routineproductports. FullPROCESS6.1brief+standing/tickets/register first, isolatedfrom7eee exactbase, narrowregression+mutantifnewtest, draftPRindependentreview. NoAWSliveprobe/repeatedacceptance. Author candidate thenRootgates/release. Do not repeatstartupresearchifnoactionablegap; focus safe diagnosableboundaries."

Working and sequencing rules
Commit and push this brief before product edits. Draft PR only; no merge, deployment, live probe or repeated acceptance. Root assigns exact-head independent review after the author candidate. Preserve full Claude Agent SDK harness on standard AgentCore RuntimeV1, direct Bedrock, control tool gateway to canonical Core, tenant isolation and durable user/firm memory. No harness/hosting replacement, broad orchestration rewrite, new telemetry framework, blanket retries or copied raw SDK errors. In-plan decisions proceed and are recorded; only an actual scope/security question goes to Neo. No issue202 post or customer-linked IDs/secrets in public artifacts.

Existing evidence and precise gap
Read Root architecture-code-review.md and architecture-evidence-review.md (the actual filename of the requested evidence review), and HERMES-WORKER-STARTUP-RESULT.txt. Existing runner diagnostics are already assembled/activated by conversation-runner; they classify reviewed codes/classes and deliberately exclude raw SDK messages and stderr. AgentCore query setup before assemble and post-run settlement currently lie outside that context. Temporal worker startup collapses native-readiness/Temporal-connect/worker-create/listen failures through WORKER_STARTUP_FAILED and cli's generic RUNTIME_UNAVAILABLE. The prior two worker66 failures recovered under normal ECS replacement without byte/config change; cause remains unproven. Hermes recommended NO CHANGE for recovery mechanics. This phase targets only demonstrated missing visibility and preserves that causal limit.

Owned paths and exclusions
Expected edits only to apps/runtime/runner-runtime-diagnostics.mjs; apps/runtime/agentcore-query.mjs and, if required by the actual boundary, agentcore-entrypoint.mjs; apps/runtime/temporal-worker.mjs startup portion; apps/runtime/cli.mjs fixed startup/error surface; their existing focused test files; existing diagnostics documentation; this brief and one ordinary result handback.
Do not edit broker/event polling, apps/control/conversations/events.mjs/service.mjs, read-context or gateway files reserved to Hermes, approval/document/routine product ports, SDK/model/provider settings, contracts, schema, migrations, lockfiles, IAM, deploy configs or public routes. One writer per path; any discovered overlap is sent to Root before editing it. Base refresh invalidates only affected evidence and requires exact-head review, not repeated broad gates.

Outline and existing owners
1. Extend the existing AsyncLocalStorage diagnostic context and allowlisted stage/code/class classifier across validated AgentCore pre-run setup and final settlement. Establish correlation only after invocation validation; untrusted input never becomes telemetry fields. Keep existing execution/SessionStore admission and cleanup/settlement semantics and original exception behavior.
2. Distinguish worker startup material/readiness/Temporal connect/worker construction/listener boundaries using fixed reviewed stage/reason fields through the existing diagnostic emitter. Preserve the first originating error before cleanup can replace it, while retaining cleanup-unknown as a separate fact. Keep process exit codes and standard ECS restart ownership.
3. Classify only known code/class values, never arbitrary error.message, stack, SDK stderr/input/body/token, configuration values or tenant/client data. Logging failure must not alter operation success/failure or cleanup. Avoid double-emitting nested failure contexts.
4. No readiness retry is planned from timing alone. Existing readiness currently collapses distinct refusal/transport outcomes; only a demonstrated classification and safe existing strategy could justify a bounded behavior change. Otherwise leave recovery unchanged and explain why.

Verbatim applicable tickets (only the bounded visibility slice is allocated)
#### MX-08 · Turn existing telemetry into a verified operational feedback loop
**Priority / type:** P1 readiness/operability; do not rebuild P0.

**Evidence and root cause:** EX-05 P0 exists on main and intentionally observes without changing deadlines/retries. Counters exclude message/SQL/body/actor/client/tenant fields; zero-timeout sums are signals, not unique failed turns, and background metrics are subsets of totals. Current observability source has 12 filters and eight alarms. Historical OTel assertion failures are distinct. No dashboard, SNS confirmation or live metric readback was performed.

**Bounded work:** Validate emitted schema/dimension names against existing filters/alarms/dashboard and material rollout. Add only missing checks for selected new capabilities/receipts. Correct any stale count descriptions. Supply a sanitized operator runbook for no-data, dropped telemetry, Core errors, session refusals, budget quarantine, pair retirement, first-text/result latency and pending/UNKNOWN effects. Test alert delivery to the approved recipient separately; avoid automatic message subscriptions or sending actual alarms without authorization. Use current allocated runtime and observability owners; remove obsolete pair/budget alarms with their services.

**Dependencies:** MR terminal/UNKNOWN semantics and MX-09. Default-off OTel either receives its own bounded fix/qualification or stays explicitly held, without claiming P0 fixes tracing.

**Acceptance:** Synthetic traces/EMF examples validate redaction and bounded line size, deduplicate durable receipts and preserve underlying failures. Later controlled live turn correlates request/run/cost/output history and dashboard without secrets. All selected alarms are connected and tested or recorded as unaccepted; cancellation is not counted as success, missing data is not a healthy proof, aggregate+subset are not double-counted.

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

Supersession register, applicable verbatim rows
| Entry | Status | Retained behavior | Removed/superseded behavior |
|---|---|---|---|
| **MR-08** admission-to-next-turn lifecycle suite | **RE-SCOPED** | Behavioural crossings: duplicate submit, ACK loss, Stop repeated, stream reconnect with cursor, next turn after a failed or cancelled turn, deploy between turns, pause/resume/fork | Crossings that exist only for kickoff claim/lease, allocation and grants, native currentness, terminal usage capture |
| **S1** (P1 table, P2 PR-A) | **SUPERSEDED** | P2 PR-A (#196) is merged and shipped. P1 #200 and C9 #203 were closed unmerged. MX-08 dashboards stay |
| **M1** | **RE-SCOPED** | MR-01, MR-02, MR-09 are superseded; MR-06, MR-08 are re-scoped. E01–E12 and E40 follow B2 |

The current register controls the historical ticket text above. Do not recreate owner/proxy, reservations, allocation/lease, per-hop authority or task-proof mechanisms. Broader dashboards/alarms, full lifecycle qualification and real release acceptance remain their owners' scope; this source candidate does not close those tickets wholesale.

Matching master scenarios, verbatim
| ID | Scenario | Required behavior |
|---|---|---|
| E01 | Authenticated selected-client first chat | One admission/run, real response, durable transcript and correct current actor/client |
| E07 | Stop at queue/load/start/model/tool/output phases | Logical stop fence and physical cleanup/unknown status are distinguishable; no later unauthorized effect |
| E41 | P0 telemetry failure/redaction | Underlying work semantics unchanged; dropped counter/alerts truthful; no secrets/prompt/client identifiers |

Real-path prerequisites and qualification plan
Use the actual createAgentCoreQuery entry and startTemporalWorker startup composition with the existing trusted synthetic seams; no real model, Control, Temporal or AWS contact. Cover setup failures before runner assembly, errors during settlement, success and cleanup-unknown, and worker readiness/connect/create/listen distinction as affected. Preserve concurrent-run context separation, reviewed fixed classification, no raw content leakage, logging failure isolation, original rethrow/exit behavior and cleanup ordering. Add only missing assertions to existing tests, avoiding test-by-implementation mirrors.
Run the affected diagnostics/AgentCore-query/Temporal-startup tests with Node24's existing module mocks, and related runtime typing if edited exports require it. Reuse existing unaffected SDK/history/PG/acceptance evidence. Show new failing assertions against the exact unchanged source where practical, then PASS on head. Kill a meaningful mutant for each new tested behavior family (missing setup context, missing startup stage/origin preservation, or content leakage as appropriate); keep mutant evidence in private scratch and restore source before head verification.
NOT RUN by this allocation: AWS/live probes, model/provider calls, browser acceptance/retries, DB/retention tests, broad runtime/full-repository regressions, new images, deployments and alarms. Later exact candidate image/deployed acceptance is owned by Root/Release; a local mock pass is not physical retirement or durable restore proof.

Deletion and resource plan
Reuse existing diagnostic emitter/classifier/telemetry; remove any generic-only path that the change replaces instead of leaving a fallback duplicate. No new flags, services, framework, configuration selectors, dependencies or temporary product hooks. Record exact removed/replaced code and search for obsolete callers at handback; if no identifiers are retired, state that explicitly. Never delete canonical authority or cleanup fencing as simplification. Only scratch test outputs and the dedicated worktree are owned here; no containers/services/ports/database mutations expected. Reuse shared dependency cache without changing it, preserve all persistent local resources, and leave no mutant in product source.

Definition of done and handback
Committed/pushed brief precedes implementation. Final draft PR names exact base/head/tree and changed files, narrow command results/counts/UTC and Node version, baseline-vs-head failures, meaningful killed mutants, deletion search, tests NOT RUN and why, private evidence by filename only, and retained live gaps. Review exact final head independently at xhigh via Root allocation. Candidate then goes to Root for integration/gates/release; no source ACCEPT, live causality, complete performance or physical lifecycle claim is inferred from this phase.
