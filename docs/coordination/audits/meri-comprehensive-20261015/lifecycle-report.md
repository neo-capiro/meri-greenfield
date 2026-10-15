# Meri lifecycle and architecture audit
Read-only source audit, 15 October 2026. Final branch recheck: 18:47 UTC. Implementation remains with Fable.

## Executive result
The candidate has substantial canonical conversation, checkpoint, session, issuance, fencing and native cleanup code. Its primary worker follows the intended single Claude Agent SDK loop, and Temporal remains deterministic orchestration. It is not an integrated or fully qualified lifecycle product. The clearest new defect is a pause/approval-hold publication race that can kill the SDK before checkpoint capture and leave the database indefinitely running-and-held. Additional blockers are missing lifecycle owners in concrete startup, missing crash recovery orchestration, and a per-run history API behind conversation-wide next-turn sequencing.

All findings below concern candidate source at the immutable shared base, unless a different pin is given. None proves the current live deployment has a particular fault. Known p1a hook-latch/plugin-path/Bash-default findings are deliberately excluded.

## Revision census and integration status
| Ref | Full SHA | Status |
|---|---|---|
| default main | 8b123bea4c90794dc2d766814b6ddbdbfe0928bc | Integrated default; apps/control contains qualification-temporal, not candidate product conversations |
| shared reviewed base | ba40647c5b6f1f81773869e41ce82c099d64d505 | Candidate-only; GitHub compare reports 2,496 ahead / 0 behind main, merge base main |
| fable/meri-resume-20261015 | b5be44d5141ae5fd3830aed789cb7ad525506c4e | Candidate; 23 commits behind shared base |
| fable/meri-complete-20261015 | f0befe1e486cfda644f1f6170cf3d9d671e5158f | Older candidate |
| fable/meri-first-chat | 700f203e7b97b64207489d29e17e00014f7ff43b | Candidate branch |
| fable/p1a-sdk-capabilities-20261015 | 6d9bb391005f73c8be6ec636c346a05381b5bd98 | Separate candidate, +5 commits from shared base |
| fable/p1b-operating-controls-20261015 | 06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40 | Separate candidate, +4 commits |
| fable/p1c-quality-browser-20261015 | e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4 | Separate candidate, +5 commits |

GitHub branch listing and compare were read through the connected GitHub reader. Main and all named Fable heads were rechecked unchanged at 18:47 UTC. Branch changes after that time are outside this snapshot. This audit does not combine sibling branches into an imagined integrated build.

## Findings

### L1. P1: Pause can close the SDK without capturing a checkpoint, leaving the run held and running
**Classification:** Confirmed control-flow defect, synthetic interleaving reproduced; applies to pause and the same approval.wait hold mechanism. Candidate-only.

**Evidence**
- The pause/approval.wait transaction sets hold_control_id immediately: [apps/control/conversations/lifecycle/journal.mjs:19-27](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/lifecycle/journal.mjs#L19-L27).
- Worker publication refuses a held run, including an attempted failure event: [apps/control/conversations/postgres-store.mjs:35-46](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/postgres-store.mjs#L35-L46).
- Local held=true is delayed until after the control reader has obtained and claimed the command: [apps/worker/conversation/continuation/activity-lifecycle.mjs:20-48](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/worker/conversation/continuation/activity-lifecycle.mjs#L20-L48).
- In parallel, the main SDK iterator publishes text, and any append refusal follows the generic error path, aborting/closing the query; its failed-status append is also refused by the hold: [apps/worker/conversation/activity.mjs:40-54](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/worker/conversation/activity.mjs#L40-L54).

**Reproduced sequence**
1. SDK is running; control poll is in flight.
2. User pause transaction commits hold_control_id.
3. A legitimate SDK text chunk arrives before that control poll returns.
4. append(message.delta) throws RUN_HELD.
5. Activity closes the SDK; append(failed) also throws RUN_HELD.
6. No control was claimed, no checkpoint captured. Stored run remains running with a hold.

The source-extracted probe returned EXECUTION_FAILED, runState=running, hold=true, claimCount=0, captureCount=0, queryClosed=1. Existing lifecycle tests cover a claimed pause and capture refusal, but do not join the SQL publication hold to this concurrent SDK stream: [apps/worker/conversation/test/lifecycle-activity.test.mjs:35-47](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/worker/conversation/test/lifecycle-activity.test.mjs#L35-L47).

The p1a activity retains the same publication/error ordering: [p1a activity:45–59](https://github.com/neo-capiro/meri-greenfield/blob/6d9bb391005f73c8be6ec636c346a05381b5bd98/apps/worker/conversation/activity.mjs#L45-L59). Its separate SDK capability work does not establish a repair.

**Repair acceptance**
Keep the durable publication fence. Make the worker's hold transition coordinated with pending publications: suppress/drain racing display output and finish the claimed control through a verified checkpoint, or record an explicit recoverable failure. Test pause before poll response, between claim and append, during completion, and during checkpoint failure across the actual service/store/activity composition. Require no post-hold output, no duplicated control input, no uncheckpointed silent close, and no permanently held-running row.

**Plan:** W05/W06/G4, verified checkpoint before normal termination, real pause/approval recovery.

### L2. P1: Concrete prepared startup does not mount the owners required for resume/fork and approval controls
**Classification:** Source integration gap, not a claim that no standalone implementation exists.

**Evidence**
- Control always mounts lifecycle routes and forwards native operations continuation/admit, continuation/retire, approval/read and approval/decision: [apps/runtime/control.mjs:54-67](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/control.mjs#L54-L67).
- Prepared-candidate startup rejects external productPorts and productPortsFactory, then supplies only identityContext: [apps/runtime/control.mjs:76-92](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/control.mjs#L76-L92).
- A transition requires transitionAuthority.readCurrent, with target-current authority and target session context: [apps/control/conversations/lifecycle/journal.mjs:64-73](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/lifecycle/journal.mjs#L64-L73). That authority is not supplied by prepared startup.
- The prepared registry's closed route set contains execution/worker/native/checkpoint/session operations, no continuation or approval owner: [apps/runtime/prepared-run-registry.mjs:60-70](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/prepared-run-registry.mjs#L60-L70). The fixed prepared application delegates only its assembled native applications; a missing/non-200 operation is refused: [apps/runtime/prepared-candidate.mjs:52-57](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/prepared-candidate.mjs#L52-L57).
- An existing test explicitly records the fallback failure when transition ports are absent: a successor is inserted, but dispatch and continuation signal never occur and LIFECYCLE_EFFECT_UNKNOWN is returned: [apps/control/conversations/test/next-run-owner.test.mjs:19](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/test/next-run-owner.test.mjs#L19).

p1b's revised startup still supplies only candidate.identityContext: [p1b control:92–100](https://github.com/neo-capiro/meri-greenfield/blob/06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40/apps/runtime/control.mjs#L92-L100).

**Impact**
Pause/checkpoint source and resume/fork factory tests do not prove a user can continue through the exact candidate startup. Approval wait and decision ownership are similarly unmounted. Current fail-closed refusals are appropriate security behavior; the product capability remains incomplete.

**Repair acceptance**
Compose the canonical continuation admission/retirement and approval/decision owners, current target transition authority and target-session context in the same startup path. Expose unsupported controls as unavailable and make readiness/capability reporting truthful until then. Test authenticated pause → durable checkpoint → new admission → original retirement/revocation → target session → exactly one dispatch, and fork/reject/cancel races through real route composition without factory-only injected authority.

### L3. P1: Conversation history/reconnect remains per-run although next-turn persistence is conversation-wide
**Classification:** Source/API integration defect; invalid cursor reproduced.

**Evidence**
- Next-turn reservations deliberately close and carry a conversation sequence base, while the new run's wire sequence restarts at 1: [apps/control/conversations/next-run-journal.mjs:54-73](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/next-run-journal.mjs#L54-L73).
- The public history method reads only the current session's binding: [apps/control/conversations/service.mjs:54](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/service.mjs#L54).
- Store read filters by run_id and rejects after greater than that run's last_sequence; it returns no sequenceBase or prior runs: [apps/control/conversations/postgres-store.mjs:48-52](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/postgres-store.mjs#L48-L52).
- Once a next target is accepted, historical bindings are refused as not latest: [apps/control/conversations/next-run-journal.mjs:44-50](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/next-run-journal.mjs#L44-L50); candidate identity uses this current-run check: [apps/runtime/prepared-candidate.mjs:27-34](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/prepared-candidate.mjs#L27-L34).
- Existing three-turn tests assert sealed ranges and old-writer refusal but do not call the public history API across the transition: [apps/control/conversations/test/next-run-owner.test.mjs:15-17](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/test/next-run-owner.test.mjs#L15-L17).

**Reproduced sequence**
First turn ends with conversation cursor 5. Next accepted run has sequenceBase=5, local lastSequence=1. Reconnecting with after=5 on the current binding returns INVALID_CURSOR. A read from zero returns the current run only. The internal listRuns view has ranges, but it is not mounted as authorized public history. SDK checkpoint context and user-visible historical replay are different requirements.

**Repair acceptance**
Add an authorized conversation-history reader over sealed ranges and a stable conversation cursor (or explicitly versioned run+offset cursor). Preserve latest-writer fencing; do not make old credentials writable to enable historical reads. Test three turns, reload/reconnect, pause/resume, fork, retained historical prompt/evidence, and membership/retention changes through the UI adapter and public route.

### L4. P1: Production workflow has no crash-recovery path; stopped/failed conversations also have no safe next-prompt path
**Classification:** Recovery acceptance gap plus explicit terminal-state product restriction.

**Evidence**
- Both product workflow definitions set maximumAttempts:1 and execute a single activity. The lifecycle workflow only waits after a successful paused/waiting result; activity failure is uncaught: [apps/control/conversations/workflow.ts:1-9](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/workflow.ts#L1-L9) and [apps/control/conversations/lifecycle/workflow.ts:12-22](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/lifecycle/workflow.ts#L12-L22).
- If the native process stops while the database run is nonterminal, polling throws PROCESS_STOPPED_WITHOUT_RUN_OUTCOME: [apps/runtime/native-authority/execution-broker.mjs:38-43](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/native-authority/execution-broker.mjs#L38-L43).
- Repeated request submission starts Temporal only while the database run is queued: [apps/control/conversations/service.mjs:34-40](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/service.mjs#L34-L40).
- Next-run selection returns the old binding for nonterminal runs and rejects failed/cancelled latest runs before checkpoint/retirement/revocation processing: [apps/control/conversations/next-run.mjs:9-21](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/next-run.mjs#L9-L21).
- The worker registers only the conversation workflow bundle and executeConversation: [apps/runtime/temporal-worker.mjs:25](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/temporal-worker.mjs#L25). Separate qualification recovery workflows exist, but are not the production recovery path.

**Representative traces**
- Worker/poller crash or process stopped without terminal publication → activity timeout/error → workflow failure → durable run can remain starting/running → request replay does not restart it.
- User Stop or ordinary SDK failure → durable cancelled/failed → fresh next-turn selection returns NEXT_RUN_SOURCE_NOT_COMPLETED. The synthetic source-extracted probes reproduced both refusals with zero retirement calls.

A failed/cancelled run has no completed checkpoint and must not simply be resumed as if complete. The missing product outcome is a safe, explicit restart/new prompt using a verified prior checkpoint or defined fresh context, not permissive checkpoint reuse.

**Repair acceptance**
Add original-attempt reconciliation and safe verified-checkpoint/new-attempt recovery with current authority, physical retirement and fresh issuance/fences. Do not repair this by blindly increasing retries. Kill the control, poller and SDK across preclaim/postlaunch/stream/capture/commit boundaries. Require recovery within two minutes on healthy infrastructure, no duplicate external effect, authoritative terminal state, and explicit Stop → next prompt behavior.

### L5. P1 when non-prepared mode is enabled: Broker cancellation exits without requesting native stop
**Classification:** Confirmed source control-flow defect in the supported default/legacy path, not in preparedKickoff=true.

**Evidence**
- preparedKickoff defaults false; catch cleanup is conditional on preparedKickoff, as is terminal cleanup: [apps/runtime/temporal-worker.mjs:13-25](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/temporal-worker.mjs#L13-L25).
- Control cancellation first persists cancelled, then sends a Temporal cancellation request: [apps/control/conversations/service.mjs:55](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/service.mjs#L55). That request alone is not native stop proof.
- The native execution broker has a stop owner, but the legacy HTTP routing does not provide a corresponding stop route: [apps/runtime/native-authority/execution-http.mjs:10-19](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/native-authority/execution-http.mjs#L10-L19).
- The current test explicitly preserves legacy default while testing independent-signal cleanup only in prepared mode: [apps/runtime/test/prepared-temporal.test.mjs:3-8](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/test/prepared-temporal.test.mjs#L3-L8).

**Probe**
After execution/start and execution/poll, a cancellation delivered through the activity heartbeat aborts the activity. Calls are exactly [execution/start, execution/poll]; stopCalls=0.

**Important boundary**
preparedKickoff=true DOES call execution/kickoff/stop on failure and terminal results, with an independent cleanup signal; unknown cleanup prevents a successful terminal receipt. Do not describe the prepared candidate as universally ignoring cancellation. Native poll also stops on revoked admission when polling still runs. The uncovered case is the legacy/default activity exiting before another poll.

**Repair acceptance**
Either fail startup/readiness for this unsupported mode while preserving a qualified in-flight migration plan, or wire an original-bound stop/revoke cleanup owner for cancellation, timeout and lease failure. Test cancellation after actual launch, during lost launch acknowledgment and during a blocked poll, proving process termination and revocation within the accepted bound.

### L6. P2 source completeness, P1 release gate: Schedules have substantive owners but no product dispatch composition or UNKNOWN reconciliation
**Classification:** Deliberately fail-closed safety with incomplete availability/integration.

**Evidence**
- Schedule lifecycle uses the adopted Temporal schedule/workflow clients, current authority, durable claims, generation fences and explicit unknown outcomes: [apps/control/schedules/schedule-lifecycle.mjs:17-65](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/schedules/schedule-lifecycle.mjs#L17-L65).
- The scheduled action passes projection/generation/task: [apps/control/schedules/temporal-schedule-mutations.mjs:21-27](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/schedules/temporal-schedule-mutations.mjs#L21-L27). Product conversation workflow expects a RunBinding; no scheduled-run authority/issuance adapter is registered in the inspected startup graph.
- Runtime product port/mount list has no schedule owner: [apps/runtime/product-applications.mjs:9-35](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/product-applications.mjs#L9-L35); worker registration is conversation-only: [apps/runtime/temporal-worker.mjs:25](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/temporal-worker.mjs#L25).
- Existing intent replay is refused; active_intent blocks later edits; only ACKNOWLEDGED clears it. Exported owner has no reconcile operation and UNKNOWN cannot transition back: [apps/control/schedules/postgres-schedule-owner.mjs:22-60](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/schedules/postgres-schedule-owner.mjs#L22-L60).
- Lifecycle correctly preserves a durable unresolved barrier after an ambiguous dispatch: [apps/control/schedules/schedule-lifecycle.mjs:60-65](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/schedules/schedule-lifecycle.mjs#L60-L65). List marks unresolved and coverage incomplete; it does not repair: [apps/control/schedules/schedule-lifecycle.mjs:87-107](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/schedules/schedule-lifecycle.mjs#L87-L107).

**Impact**
An uncertain schedule creation/update cannot safely be replayed or edited with the current owner surface. Schedule source should not be described as absent or as working end-to-end from the product. The missing work is exact-provider reconciliation and mounting a scheduled firing into current authority, fresh run binding and capability issuance.

**Repair acceptance**
Register a scheduled dispatch workflow and compose the actual command/UI path. Reconcile exact intent/generation/provider IDs after dropped acknowledgments without repeating a possibly completed effect. Verify restart, time zones/DST, overlap/misfire policy, current authorization at firing, cancellation of original runs and physical stop receipts.

## Representative architecture traces
### Ordinary prompt and completed next prompt
Identity/current run → action session → durable request/run queued → exact Temporal workflow ID → native preparation/issuance → one isolated SDK query → streamed durable events → SDK session/workspace verified completion checkpoint → native stop/revocation → next-run reservation with new run/attempt/worker/fence → distinct prompt plus explicit nextTurn lineage. The source has meaningful checks at each owner, but the history and recovery gaps above prevent calling this a complete conversation product.

### Pause and continuation
Authenticated control → durable hold/command → worker control claim → SDK interrupt → session/workspace capture/readback → checkpoint event + paused state → new admission + original retirement → target-current authorization → target session/Temporal dispatch. L1 breaks the first-to-second handoff; L2 leaves later owners absent in concrete startup.

### Cancellation
Public cancel records logical terminal state and requests Temporal cancellation. Prepared broker cleanup separately asks original native owner for stop; failed or missing stop acknowledgment remains unknown. This is the correct distinction between request cancellation and physical stop. Legacy mode's missing call is L5.

### Scheduling
Approved schedule intent → durable claim and dispatch barrier → adopted Temporal mutation → acknowledged generation. An uncertain result stays unresolved. There is no product scheduled-run issuance/dispatch in the inspected registration graph and no owner reconciliation entrypoint.

## What is working in the inspected design
- One SDK query owns model/tool/compaction decisions; the worker consumes it once: [apps/worker/conversation/activity.mjs:35-49](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/worker/conversation/activity.mjs#L35-L49). Temporal definitions contain deterministic dispatch/wait only. No second model loop was found.
- Conversation writes are serialized under canonical transaction/row checks, tied to tenant/conversation/run identity, event/request hashes and writer fences. Next-turn reservations require a genuine published completion checkpoint, retired original allocation and exact revoked grant IDs: [apps/control/conversations/next-run-journal.mjs:18-40](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/next-run-journal.mjs#L18-L40).
- Control UUID claims and SDK input-echo acknowledgments avoid pretending an unobserved steer was applied. Unknown controls are not blindly re-enqueued: [apps/worker/conversation/continuation/activity-lifecycle.mjs:56-82](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/worker/conversation/continuation/activity-lifecycle.mjs#L56-L82).
- Prepared native activity has independent cleanup and refuses successful completion when physical stop is unknown: [apps/runtime/temporal-worker.mjs:16-22](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/temporal-worker.mjs#L16-L22).
- Fresh session, capability, checkpoint, approval and authority checks are generally fail-closed. Several findings are integration/availability gaps created by absent owners, not evidence of weakened access controls.

## Organization and dead-code assessment
The code has many focused owners and deliberate separation of control, worker SDK runtime, native broker, journals, schemas and projections. A blanket “god file” or “delete all old code” finding is not supported. The main maintainability risk is that concrete composition, reusable factories, qualification fixtures and source-only modules look similar despite very different reachability/evidence levels.

Recommended organization acceptance:
1. Publish a machine-verifiable startup ownership graph: each public control → canonical owner → persistent tables → native operation → worker/workflow registration.
2. Put production recovery and scheduled-dispatch modules under explicit runtime ownership; keep old qualification fixture workflows separate and labeled.
3. Move genuinely shared production codecs currently imported from qualification namespaces into one canonical runtime package without changing semantics. Preserve immutable qualification evidence instead of deleting it as “dead code.”
4. Expand compressed multi-statement lifecycle/assembly lines into reviewable functions when touching these paths. This is an auditability improvement, not a separate proven runtime defect.
5. Require an import/reachability/route test for each accepted visible control, so factory-level success cannot be mistaken for startup integration.

## Status against the agreed plan
- [Master plan W05/W06](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/plans/MERI-DEPLOYMENT.md#L181-L182): source progress is substantial; complete durable runs, history, stop/steer/resume/fork, approvals and schedules remain unaccepted.
- [G4](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/plans/MERI-DEPLOYMENT.md#L381): actual worker-loss/approval/cancellation/fencing walkthroughs remain required.
- [Recovery and visible-control release criteria](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/plans/MERI-DEPLOYMENT.md#L414-L415): two-minute recovery, zero duplicate effects and passing behavior for all accepted controls are not demonstrated by this snapshot.
- [Single SDK orchestration and persistence separation](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/plans/MERI-DEPLOYMENT.md#L91-L98): source architecture broadly follows the intended division.
- [Runtime/version/in-flight compatibility](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/plans/MERI-DEPLOYMENT.md#L463) and [checkpoint-before-normal-termination](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/plans/MERI-DEPLOYMENT.md#L474): need exact integrated cohort and measured recovery evidence.
- [Master crosswalk](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/coordination/master-crosswalk-20261015/README.md#L25-L42) already says G0 historical accepted, G1 open, G2–G7 unaccepted. These findings support that classification. They do not establish that the broader plan was abandoned.

## Evidence and test limits
Read-only GitHub inspection materialized 209 files into isolated audit scratch (runtime/control/worker sources, selected contracts and tests). No repository, branch, PR, deployment or user-computer changes were made.

Executed only a local Node source-extracted control-flow harness. It removes import/export declarations and binds explicit synthetic schema, SDK, persistence and native ports. The actual activity/lifecycle/input/control function bodies, operation lifetime, broker control flow, next-run selection and store read body were exercised. For the pause test the SQL hold gate was modeled exactly; a real PostgreSQL server did not run. The cursor test used the repository's scripted SQL fixture. Schema mocks are intentionally no-op, so these probes prove reachable control-flow consequences of the specified valid boundary states, not end-to-end schema/admission qualification.

Probe outputs: pause race, default broker cancellation, next turn after cancelled, next turn after failed, and cross-run cursor rejection. Existing repository tests cited above were inspected, not executed. No dependency install, Anthropic call, live SDK, Temporal service, PostgreSQL server, ECS task, browser, real identity issuer or credential grant was exercised. Therefore no assertion is made about deployed stop latency, live restore correctness, exact SDK behavior under native failure, complete test-suite pass counts, or source/live parity.

Other lanes separately own migration/deployment schema prerequisites, actual ECS isolation proof, credentials/proxy/budgets, selected tools/data coverage, browser/evals and UI. Those should be joined at one immutable integrated candidate rather than repeated here.

