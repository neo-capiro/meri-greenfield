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

FROM: Root | TO: one fresh Hermes runtime startup diagnostic session | TYPE: brief | RE: recovered worker66 startup failures, bounded independent look

# Wave 2 worker startup diagnosis

Neo explicitly requested Hermes to troubleshoot “the starter”; in this allocation that means the **Meri temporal-worker startup failures during the current rollout**. Provide one bounded independent look using Runtime's completed handoff and saved evidence. **There is no persistent worker blocker now. Do not delay release, force a defect, propose a fix without evidence, or repeat Runtime's investigation.** Existing evidence may support only “transient failure recovered; cause unproven; no change.” That is a complete useful outcome.

## Exact source, session and current state

Fresh diagnostic Hermes session, requested reasoning **xhigh**; effective provider reasoning **UNVERIFIED**. The existing launcher starts exactly one fresh diagnostic session, not a resumed Wave3 author. Use an isolated **read-only** source snapshot at Meri **`7eee7f7c358be9ae903169816ef68eb6e64ae1f3`**, tree **`a87135487d6c48d579b3fdfc3845e975b1d56567`**, exact ARM64 image **`sha256:478bac75949e7c5707b2f3896925a3489fd6bc18469a48c546044e47c1003ca6`**. Repository is `neo-capiro/meri-greenfield`, release source branch `codex/wave2-batch-meri-20261025` / [PR252](https://github.com/neo-capiro/meri-greenfield/pull/252). Remote PR source remained at that head on 25 October 16:17:39; local release checkout source/tree/clean status were freshly verified at 16:21 UTC. Launcher rechecks exact source before send, uses the existing pinned source archive or a fresh detached read-only checkout, and records actual location privately. Suggested snapshot basename `wave2-hermes-worker-startup-7eee-20261025`; no product branch or PR is expected. Never use a Wave3 author's checkout or modify the release checkout.

The accepted final deployment manifest SHA-256 is `381eac895a8df56859c342ad8bd7b1a5d43935ce4a48e0f3fd76bd74e8e2ccde`; Supporting's ACCEPT at **15:48:41 UTC** already closed its review. Existing source/image/material qualification stays closed and reused. This is operational diagnosis, not requalification or a new release gate.

### Facts supplied by Release/Root and saved Runtime handoff

| UTC / observation | Established scope |
|---|---|
| Rollout sequence | Coherent transition from Control69/Worker65/Schedule2 plus preview6 to Control70/Worker66/Schedule3 plus preview7. Order: Core14 → preview7 → all three Meri roles → frontend. One shared control capability rotates across the three bundles; Control's download-signing key also rotates. This transition is not atomic. |
| 16:13:07.764 start / 16:13:21.952 stopping; 16:14:32.968 start / 16:14:48.699 stopping | Two worker66 attempts exited3 / EssentialContainerExited. Each material-init exited0; each saved CloudWatch stream contains exactly one `RUNTIME_UNAVAILABLE` line with no underlying error or stage. Preserve both failures. |
| 16:15:47 | Release observed Control70 RUNNING/HEALTHY with both 8080/8082 targets healthy; Schedule3 healthy. Control70 had been pending during earlier failures. This snapshot is not proof of the exact readiness-transition instant. |
| 16:15:49.855 start; saved current receipt 16:17:55 | Replacement worker66 RUNNING/HEALTHY, init0, exact image; sole worker service running1/pending0, only PRIMARY. Ordinary ECS replacement recovered **without source/material/config change or manual task retry**. |
| 16:18:49 latest Release report relayed by Root | Entire Meri app UPDATE_COMPLETE; Control70/Worker66/Schedule3 each sole COMPLETED, desired1/running1/pending0, healthy/init0 and exact image/bundles. Core source `43fdd8928e517b1ce3a7a039f0fabeb8cf5fc5dd` is revision14 healthy; frontend `dc53633f0b8c4de6432f3840e4fc79ac2ffeb02a` exact reviewed set is now executing its rollout. No later frontend/live acceptance is asserted here. |

Runtime's completed **worker66-startup-diagnosis/RESULT.txt**, dated **16:21:20.361 UTC**, and adjacent sanitized **EVIDENCE.json** are the takeover handoff. Runtime proposes **no fix** and has stopped. The launcher provides these existing artifacts; do not request a duplicate HERMES-STARTUP-HANDOFF copy or restart the original investigation. Runtime's conclusion is timing-consistent transient startup/dependency failure, **not proven control readiness or capability mismatch**. Generic logs cannot identify which startup operation failed, and material-init0 does not prove every application-level configuration.

## Sources, authority and scope

Read this complete brief, the two Runtime handoff artifacts, saved sanitized startup metadata/logs and [STANDING-REQUIREMENTS](../../20261022/STANDING-REQUIREMENTS.md), [PROCESS6.1–6.3](../../20261022/PROCESS.md), [WORKFLOW](../../20261022/WORKFLOW.md), [FINAL-PLAN](../../20261022/plan/FINAL-PLAN-20261021.md), [supersession register](../../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), [Meri master](../../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md) and [AgentCore Runtime plan](../../20261022/plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md). Explicitly read host/repository/applicable child AGENTS; the launcher's isolated input may suppress automatic rules/memory. Use only this context, canonical sources and referenced accepted evidence, not unrelated history. Current Root/Release roles and xhigh supersede historical relay/Ultra instructions.

Root is the sole orchestrator. **Release is the sole AWS/operator owner** and continues the already-authorized rollout. Runtime is the existing code owner/collaborator and has handed off the completed analysis. Hermes only diagnoses read-only. The existing **Wave2 Independent Review** owner is relevant only if Root later allocates a proposed change; this session must not reopen its accepted release verdict. Root separately assigns implementation if warranted. No recursive agents, new reviewer session, monitor or parallel investigation.

This is an operational diagnostic derived from the existing release/readiness owner, **not a new ticket**. Relevant retained ticket MX-06 is quoted below verbatim and checked against register B1: RE-SCOPED to standard Runtime V1 readiness/control scale, with obsolete pair/issuer/warm-pool mechanisms excluded. Its historical evidence paragraph does not authorize rebuilding those mechanisms. Full ticket acceptance and live scenarios are not allocated to this diagnostic.

## Read-only evidence and code boundary

Private locations are supplied by the existing launcher/private companion **by binding outside this public brief**. Named artifacts: `worker66-startup-diagnosis/RESULT.txt` and `EVIDENCE.json`; `assembly7eee/startup/worker66-current.json`, stopped-task receipts and the two worker log files; the 16:15:47 Control health snapshot; `meri-7eee/source-pins.json` and `source.zip`; **FINAL-DEPLOYMENT-DELTA.txt** for coherent sequence/rollback. The deployment delta is the earlier 15:45 plan and its “unexecuted” live state is historical, superseded only by the timed observations above. It may contain private bindings: use only its sequence/rollback facts; never copy ARNs, IDs, raw task names or private material to a public report. Do not read secret values or raw secret bundles. Use sanitized counts/booleans and exact source/image hashes.

At exact7eee, `apps/runtime/temporal-worker.mjs` `startTemporalWorker` reads TLS/material, constructs the existing native client, then **awaits `native.readiness` before `NativeConnection.connect`, Worker.create and poller startup**. `apps/runtime/cli.mjs` catches runtime errors, prints `RUNTIME_UNAVAILABLE` and returns3; that generic message does not expose the cause. Inspect only these existing owners and necessary `native-client.mjs`, `temporal-tls.mjs`, configuration validation, `http-server.mjs` or cleanup-fence call sites to identify possible throw/stage boundaries. No product edits, diagnostics, wrapper, retry framework, auth/policy redesign, capability exception or configuration change.

Use Runtime's existing exact-source/receipt findings first. State what the saved evidence supports or rules out about: (1) Control dependency readiness during replacement; (2) shared capability/material transition; (3) Temporal connection/poller creation; (4) a persistent configuration/product defect. Distinguish explicit evidence from inference. If the generic log cannot discriminate, say so and stop. Do not infer the exact failing stage merely because native readiness occurs first or because recovery follows a healthy Control snapshot.

## Allowed checks, prohibited actions and stopping rule

No AWS/API/network/provider/model/application request, live polling, service action, manual retry, restart, deployment, database/PostgreSQL/browser operation, installation/environment repair, resource launch or code/config edit. Do not query CloudWatch/ECS or requalify the image/source. No raw secrets. Preserve WSL Codex-Gates, shared DB/services/data, authentication/configuration, current checkouts/caches/evidence and immutable applied migrations. Any required live read belongs to Release under a separate Root allocation; none is requested now because recovery is established.

Existing proof is expected to be sufficient. Only if one concrete local uncertainty remains may you perform a tiny code-local synthetic check with existing tooling that cannot contact any service and answers that exact question. Do not run the full startup/runtime suites or create a test file in product source. Existing `apps/runtime/test/temporal-worker-startup.test.mjs` may be inspected for already-proved startup ordering/cleanup; inspection is not a new test pass. List all checks actually run and NOT RUN, with UTC/command/tool version/exit/result; no executable tests added means mutation N/A. No source replacement means deletion N/A. Do not invent diagnostics or a mutation campaign for a read-only analysis.

Stop after one bounded examination of the existing handoff and exact source. Healthy unchanged replacement removes the currently observed blocker; it does not prove the historical cause. Do not keep investigating merely to produce certainty the evidence cannot support. Release proceeds independently. Recommend the smallest corrective action **only if** a concrete recurrent flaw is established; otherwise “no change” is appropriate. A future discriminating observation may be identified as a limit without requesting a live retry now.

## Return, rollback and definition of done

Return a concise PROCESS6.1 diagnostic handback to Root/Release through the existing launcher: exact source/tree/image and evidence names; established failure/recovery facts with UTC; exact known throw boundary versus unproven originating stage; supported/rule-out hypotheses; no-change conclusion or smallest evidence-backed recommendation and existing owner; checks run/not run, limitations, no resource/code changes. Do not issue a source ACCEPT/CHANGES verdict for unchanged release code. Save one ordinary result for forwarding; no new evidence framework or duplicate handoff copy.

Rollback remains **Release-only**: existing coherent prior Meri template/material set plus preview6, frontend30 and Core13 baselines described in the accepted deployment delta. Preserve failed/uncertain receipts; never automatically repost effects. Rotation means old signed links may require fresh authorized issuance; no permanent historical rollback availability is promised. No rollback is requested by this recovered startup event. Root/Release own stable-window/complete-rollout handoff and separate authenticated Acceptance; worker health alone is not full Wave2 completion.

Only direct Neo chat approves a real scope/security-policy change; GitHub comments never approve scope. This diagnostic is already directly authorized. Ordinary in-scope analysis proceeds without another permission request. No #202/public coordination post. Public prose contains no customer-linked identifiers/UUIDs/secrets or private prompts/content. Keep actual launcher/reviewer IDs and evidence directories in the private companion only.

## Relevant retained ticket, verbatim

Register checked individually: **MX-06 RE-SCOPED**, B1. Only the read-only operational question above is allocated, not the full qualification obligations.

#### MX-06 · Prove topology, readiness and control scale assumptions
> **[RE-SCOPED 2026-10-24]** Qualify actual Runtime V1 conversation/session topology, readiness and control scale. Remove the Fargate warm-pool, model pair and custom issuer mechanisms; preserve their required behavior through existing standard owners.
**Priority / type:** P0 activation gate; operational evidence absent from this audit.

**Evidence and root cause:** EX-04's shipment gates require exactly one control task, distinct private/public health targets and owner/proxy/issuer sequencing. The general manifest README describes process-local poststart challenge custody and disallows overlapping control targets during a handshake. A `/health/live` response proves process liveness, not Core current identity, configured capabilities or a working model path.

**Bounded work:** Root reconciles the existing infrastructure and control owners into the Runtime V1 release. Verify authenticated ingress, intended routes, least-privilege runtime IAM/network access, immutable session scope, truthful dependency readiness and required Temporal namespaces/queues/TLS. Use supported service lifecycle settings. Do not build a new nonce/proof service to preserve obsolete Fargate topology.

**Dependencies:** MX-03/05/07; Core/FE routing under previous X-02–06.

**Acceptance:** Positive authenticated traffic reaches exactly the intended service/version; unsigned, foreign, malformed, neighboring, trailing-slash, absolute-form and wrong-method private requests fail before privileged work. Readiness reports unavailable dependencies truthfully without minting authority. Multi-replica launch cannot be accidentally selected by a manifest that relies on process-local challenge state. Live network readbacks require the operator's approved scope.

## Contextual E-scenarios, verbatim

These retained deployment/continuity rows provide context only; this diagnostic does not run or pass them. Register B2: E09 KEEP means conversation continuity across deploy; its historical reserved-successor mechanism is excluded. E10 is RE-SCOPED to Stop/clean closure or resume without obsolete pins. No in-flight effect, model call or continuation exercise is allocated.

| ID | Scenario | Expected result |
|---|---|---|
| E09 | Image-only release after completed turn | Existing conversation and pending reserved successor continue under candidate11-compatible rules |
| E10 | **[RE-SCOPED]** Deploy/rotation while old original is in flight | Historical Stop/retirement can close old work safely; current execution checks are not weakened |
