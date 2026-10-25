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

FROM: Root | TO: Integration | TYPE: PROCESS6.1 brief | RE: Accepted native telemetry and retention-fixture composition

Repository: neo-capiro/meri-greenfield. Branch: codex/wave2-native-telemetry-integration-20261025. Preserved worktree: C:/dev/wave2-native-telemetry-integration-20261025. Exact base: f9583ab5599ea6f07ccdd281be5ae68cff50d5a2.

Dependencies: independently accepted Runtime PR262 head baf6287048411233953f6c7595faf804182a9160, tree 4b816a43969e0de63f17c9422955a24c0b984086; independently accepted fixture PR263 head 14579f0da3060782e39f9121dc6b7d202a232336, tree c2fe29a7b67b260c8191e24a4315dee9ba5b0736. Both are based on the exact same main. Primary's PR262 ACCEPT is sealed at21:20:37.223937 UTC; File Workflows' PR263 ACCEPT at21:25:43.7316786 UTC on25 October2026. Existing evidence remains owned by its source lane.

How we work: Root orchestrates at Ultra and owns gates/merges; helpers implement/gate/review at xhigh. Separate independent reviewers accepted the exact inputs. Existing Release alone performs AWS/migrations/build/rollout/rollback when allocated. Integration composes a draft PR only, commits and pushes, with no merge/build/deploy/live actions or recursive delegation.

Sources of truth: current STANDING-REQUIREMENTS sections1-4 above verbatim; current Wave2 handoff; PROCESS6.1-6.3; IMPLEMENTATION-STANDARDS; WORKFLOW; item0 native harness and AgentCore Runtime V1 plan; FINAL-PLAN and supersession register. Current Root allocations override historical model/relay/shipping instructions. In-scope composition proceeds; only direct Neo chat changes scope/security. No issue202 or coordination comments.

Bounded implementation outline and canonical owners

Replay accepted262 without semantic edits: the existing telemetry provisional/bind context surrounds actual native request entry points and authenticated execution; the canonical completion journal/store observes committed publication or validated replay through its existing observer. Core remains the authorization owner, the SDK/AWS own model/harness/runtime behavior, existing journals own effects/durable outcomes and telemetry remains best effort. No new mechanism, metric family, dependency, schema, configuration or authority layer is introduced by Integration.

Apply accepted263's only insertion, memoryCandidates:[], to the existing synthetic inventory snapshot in apps/runtime/artifacts/test/native-files-owner.test.mjs. Preserve all262 production bytes and all existing/new test assertions and names. The real retention inventory producer already supplies this required array and the strict decoder rejects malformed input; no production decoder default or weakening is allowed. Root explicitly approved this same-file overlap. Source owners moving separate memory/document work to Hermes must not alter262/263 files; that independent blocker work is outside this composition and does not delay it. Telemetry source is not claimed to fix those live blockers.

Owned paths and sequencing

The only source/test paths are the six accepted262 paths listed below;263 overlaps only the named test file. The sole additional path is this integration brief. Capture base/head/path evidence, commit this brief, cherry-pick262 then263 with provenance, inspect the exact overlap, qualify once, append results here and publish the draft PR. Preserve the shared environment, existing checkouts and caches. Integration owns this checkout and ordinary scratch under its work/runtime-telemetry-composition. No database/container/cloud resource is allocated; test-owned loopback/temp resources retain their existing teardown. Read-only dependency junctions, if required, target existing author-qualified caches and remain available with the retained checkout; never modify donor packages.

- apps/control/conversations/completion-journal.mjs
- apps/control/conversations/postgres-store.mjs
- apps/runtime/agentcore-candidate.mjs
- apps/runtime/agentcore-execution.mjs
- apps/runtime/artifacts/test/native-files-owner.test.mjs
- apps/runtime/test/agentcore-candidate.test.mjs

Qualification selected for the actual overlap

Run exactly one combined command, retaining module mocking and serial concurrency:

```text
node --experimental-test-module-mocks --test --test-concurrency=1 apps/runtime/telemetry/test/turn-context.test.mjs apps/runtime/telemetry/test/counting.test.mjs apps/runtime/telemetry/test/turn-lines.test.mjs apps/runtime/test/agentcore-candidate.test.mjs apps/runtime/artifacts/test/native-files-owner.test.mjs apps/runtime/test/agentcore-execution.test.mjs
```

This single run covers the affected native-files-owner suite and all six262 focused owners together; do not rerun native-files-owner separately. Expected selected count134 with no lost assertions/names. Accepted262 evidence: allocated83e27 baseline117PASS/9FAIL of126; final262125PASS/same9FAIL of134; eight additions pass;13/13 meaningful mutants killed and source restored; runtime typecheck PASS. Accepted263 evidence: base17PASS/9FAIL of26, head26PASS/0FAIL, all nine former failures now reach retained assertions. Original failures stay historical; the combined result is separately recorded. Reuse accepted typecheck/mutants because production/dependencies are exact and263 only adds valid fixture data. Integration authors no executable tests/assertions: mutation N/A here.

Prove five nonoverlap files exact to262, including all four production files; prove overlapping test equals262 plus exactly263's approved field insertion; prove whole resulting tree equals base plus this accepted six-file composition and brief. Check Git whitespace and clean/pushed head. No broad suite, repeated baseline/mutation campaign, full architecture census, install/build/image/scan, DB/AWS/browser/model/provider/live execution. The historical objective-completion-capture removed-export failure and P0 worker-SDK dependency entrypoint failure remain explicit and are not rerun or called passing.

Verbatim bounded master tickets and acceptance
#### MX-08 · Turn existing telemetry into a verified operational feedback loop
**Priority / type:** P1 readiness/operability; do not rebuild P0.

**Evidence and root cause:** EX-05 P0 exists on main and intentionally observes without changing deadlines/retries. Counters exclude message/SQL/body/actor/client/tenant fields; zero-timeout sums are signals, not unique failed turns, and background metrics are subsets of totals. Current observability source has 12 filters and eight alarms. Historical OTel assertion failures are distinct. No dashboard, SNS confirmation or live metric readback was performed.

**Bounded work:** Validate emitted schema/dimension names against existing filters/alarms/dashboard and material rollout. Add only missing checks for selected new capabilities/receipts. Correct any stale count descriptions. Supply a sanitized operator runbook for no-data, dropped telemetry, Core errors, session refusals, budget quarantine, pair retirement, first-text/result latency and pending/UNKNOWN effects. Test alert delivery to the approved recipient separately; avoid automatic message subscriptions or sending actual alarms without authorization. Use current allocated runtime and observability owners; remove obsolete pair/budget alarms with their services.

**Dependencies:** MR terminal/UNKNOWN semantics and MX-09. Default-off OTel either receives its own bounded fix/qualification or stays explicitly held, without claiming P0 fixes tracing.

**Acceptance:** Synthetic traces/EMF examples validate redaction and bounded line size, deduplicate durable receipts and preserve underlying failures. Later controlled live turn correlates request/run/cost/output history and dashboard without secrets. All selected alarms are connected and tested or recorded as unaccepted; cancellation is not counted as success, missing data is not a healthy proof, aggregate+subset are not double-counted.

<a id="mx-09"></a>
#### MX-09 · Measure latency, cost and resource behavior without duplicating P1/P2
> **[RE-SCOPED 2026-10-23]** Measure on the new path against the targets in `STANDING-REQUIREMENTS.md` §6. "Without duplicating P1/P2" no longer applies: they are deleted. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.
**Priority / type:** P1 performance qualification; existing owners retain implementation.

**Evidence and root cause:** EX-07 local acknowledgement excludes LB/TLS/Clerk/PG/Temporal/deployed UI, and fresh-task readiness stays UNRUN without a real probe. PR195's historical 164-Core-call median is a measurement baseline, not a promised reduction. Current PR196's focused owner/proxy tests pass in its receipt, but broader paired host gate remains not green.

**Bounded work:** Measure actual Runtime V1 cold start, warm follow-up and idle restore with one recorded clock/sample/source/config protocol. Preserve first-text and acknowledgment targets; report SDK/model TTFT, Core/AWS/DB calls, tokens/cost, queue time, refusals, cancellation and cleanup. No synthetic sleep-as-proof, larger auth deadlines or uncertain effect replay to improve apparent latency.

**Dependencies:** Current Runtime/control owners, MX-08 and native image/capability qualification.

**Acceptance:** Same-hardware/serial base-head source comparisons classify failures; controlled deployed sample meets approved thresholds or remains explicitly blocked. Report failures and refused/slow samples, not only successful timings; no summed overlapping test totals. P1/P2 are historical; no owner/proxy rewrite is created by this ticket.

Verbatim matching master scenario
| E41 | P0 telemetry failure/redaction | Underlying work semantics unchanged; dropped counter/alerts truthful; no secrets/prompt/client identifiers |

Verbatim retained simple-turn requirement
- Within the agreed limits per simple turn (Core calls ≤ 30, Core time ≤ 3 s) at minimum. *Proposed targets:* Core calls ≤ 5 (control, excluding tools the model chooses to call), AWS calls ≤ 10 excluding standard Runtime invocation, DB statements ≤ 300, first delta within about 3 s of `run.running`, the full answer within about 2 s of the model stream ending.

Verbatim supersession register interpretation
**Current target:** [AgentCore Runtime standard V1 with the real Claude Agent SDK](../plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md). This register removes obsolete mechanisms, not native SessionStore, artifacts, current Core checks, required Temporal durability or any accepted feature.
**Principle.** Behaviour and quality stay binding: the E-scenarios, the RG gates, the original release suite and every product acceptance. The mechanisms that existed to protect, measure or speed up the removed layers are superseded. Neo's requirements are in `../STANDING-REQUIREMENTS.md`. The spec that replaces the layers is `../phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`.
| MX-09 latency, cost, resource measurement | **RE-SCOPED** | Measure on the new path against the targets in `../STANDING-REQUIREMENTS.md` §6 | "Without duplicating P1/P2" (they are gone) |
Unlisted Meri tickets (MG, MB, MO except MO-10/11, MF except MF-02/10, MT-13 to MT-15, MM except MM-01/13, MR-03/04/05/10, MX-01/03/04/08 and 10 to 14) are unchanged. MR-04 (routine read consent) must be implemented against the tool gateway's run token.
| **E40** budget / terminal usage missing or contradictory | **SUPERSEDED** | Replaced by: record available canonical SDK usage once, preserve unknown accounting explicitly without fabricated usage or failing a completed answer, and enforce the tenant cap through its existing owner |
| All others | KEEP | |

Named real-path prerequisites, limits and definition of done

Fixtures prove the changed existing owners with deterministic injected I/O; they do not establish real PostgreSQL/AgentCore/provider/SDK lifecycle, all applicable Core-call coverage, authenticated UI-to-run binding or live performance. S1/S2 <=30 Core calls/<=3000ms remains UNMEASURED. Live memory/document/Temporal diagnosis remains with allocated owners. Current live image sources are unchanged; this composition does not deploy current diagnostics as a claimed blocker fix. Root/Release own later release qualification and Acceptance owns separately allocated real behavior.

Return exact base/head/tree, changed paths and accepted-source preservation, one combined command with UTC/exit/pass/fail/skip/cancel counts, reused source/typing/mutation evidence and inherited limits, deletion/no-orphan proof, draft PR and remaining owner/next action. No removed public identifier/resource/test and no test-count decrease is intended; prove old unobserved constructor/unscoped handler forms stay absent without broad searches. Keep private live data out of Git/PR. Commit AND push. Stop after relevant qualification; do not start another campaign.


## Completed composition qualification

The accepted commits replayed cleanly with provenance. Four production files and the other nonoverlapping test file match262 exactly. The overlapping native-files-owner test equals262 plus exactly263's valid memoryCandidates:[] field; no assertions, names or test bodies were removed or changed by Integration. The complete tree is the allocated base plus the accepted six-file composition and this brief: seven changed paths.

The single combined command above ran on source commit `da3f1cdd3f3180d9d38b6a2949187be9ac22c7fc` from 2026-10-25T21:31:51.292991+00:00 to 2026-10-25T21:32:07.181800+00:00, Node v24.22.1, npm11.19.1, exit0: **134 tests /134PASS /0FAIL /0SKIP /0cancel /0todo**. Native-files-owner is included once. The final commit only appends this result to the brief; source/test blob and mode equality to the tested commit is verified. Existing qualified dependencies were reused through four owned checkout junctions; no install or cache edits.

The previous nine STORE_CORRUPT fixture failures are resolved in this combined run by the independently accepted263 insertion. Original262125PASS/9FAIL and263base17PASS/9FAIL receipts remain historical and unaltered. Accepted262 runtime typecheck PASS and13/13 killed mutants are reused, with exact production/dependency preservation. No new executable tests/assertions/mutants were authored by Integration. Historical obsolete objective import and worker SDK dependency entrypoint limitations remain NOT RERUN, not passed. No broader tests, build/image/scan, DB/AWS/browser/model/provider or live performance/acceptance checks ran.

Deletion checks at the tested source: git grep of the old unobserved completion constructor in postgres-store and the old unscoped async candidate handler in agentcore-candidate each returned exit1/zero matches. No public identifier/file/resource/executable test was removed; test count134 is preserved. No temporary diagnostic, flag, contract, dependency or configuration change was introduced. Git whitespace and source preservation checks pass.

Relative links inside verbatim ticket/register extracts retain the original source-document context. The extract owner is docs/handover/20261022/source-of-truth/ and the author-approved MX08/MX09 brief; the current canonical standing document is docs/handover/20261022/STANDING-REQUIREMENTS.md. This brief changes no ticket or live acceptance outcome.

Root owns merge and subsequent gates; Release alone owns any later build/deploy allocation. Memory/document/Temporal blocker work remains separate. This source composition does not establish authenticated feature acceptance, full Core-call coverage, <=30calls/<=3000ms performance or physical SDK/runtime lifecycle completion.
