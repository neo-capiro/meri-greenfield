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

# Wave3 meri accepted-source composition

FROM: Integration | TO: Wave3 Root / independent reviewer | TYPE: status/handoff | RE: accepted deltas on current default

Prepared 2026-10-26T01:16:01.081375+00:00. Branch `codex/wave3-meri-integration-20261026`; exact base `9535c4760bba03a41a19331c5e6089d0d57072a0`. Product composition head `1319e2d3c1acf2b7159fd59b82fa765e86ab90b1`, tree `29d663eb9018d579c8977021d2feb3b5ff97187d` before this brief/registry/status commit; final PR head/tree are supplied in the task handoff. Author commits remain in the per-PR provenance commit messages. Draft only; source composition is not independent integrated acceptance or release qualification.

## Source and ownership

- [247](https://github.com/neo-capiro/meri-greenfield/pull/247): `51b059063629cf7b7a1370ae54ae9a82624a3bff` → `d772a6baff05f98e6f3cc3bbd3c47b5306e00c1b`.
- [254](https://github.com/neo-capiro/meri-greenfield/pull/254): `d772a6baff05f98e6f3cc3bbd3c47b5306e00c1b` → `4c2171fcca374cfca67b99e755f66793992a1624`.

All18 accepted paths, including removal of kb-provenance.test.mjs, exactly match their accepted owner blobs. Both deltas are disjoint from current-default changes. Current256 access rechecks and current runtime, memory, document and telemetry fixes remain intact; stale255 and other historical branch ancestors are not replayed. No lockfile, schema, shared contract, runtime harness or deployment configuration changed.

Reuse247's accepted84-operation/48-family reconciliation and meeting recovery evidence; inherited tracked-bills/missing-ai failures retain their original limitations. Reuse254 independent151PASS for nine test files; no unchanged fixture rerun. A git grep over affected active read source finds no kb-provenance.test.mjs, measurementKey or measuredInstallation references. Retired source-measurement assertions were replaced by canonical request-context/handler/availability coverage in the accepted owner changes. Test accounting remains in docs/handover/20261025/W3-M3-DATA-RECONCILIATION.md and the254 review; no newly written executable test here.

Actual Wave3 takeover is recorded as O260 in the existing decision log after reading O259 at current main. It preserves CLOSED WITH CARRYOVERS / CHANGES, sole Release ownership, Fable exclusivity, uncertain effects and current source/deployment separation. It is a normal composition/status update, not a new product acceptance decision. Full MT09/MF16/MG06/current-access live evidence and other Wave3 obligations remain with the allocated owners.

## Checks and limits

Integration ran ordinary Git base/head/path and blob comparisons, explicit overlap comparisons, current-default preservation checks and `git diff --check`, all PASS. Source proof uses Git blobs and does not normalize away product differences. No product behavior test was newly executed; accepted unchanged owner evidence is reused. No new executable product test, so mutation N/A for this composition. Source/record inspection scripts are task-local, not a new repository qualification framework. The exact commands and source comparison output remain in the existing Integration work/output directories.

No dependency install, service/cache mutation, shared port, build, PostgreSQL, migration, image, cloud, model call, provider operation or deployment occurred. Existing environments/checkouts remain preserved. Required affected integration review is NOT RUN at this new head; Root allocates the existing independent reviewer and necessary gate owner. Release owns build/image/smoke/scan, protected database actions, deployed configuration, rollout and rollback; Acceptance owns bounded authenticated real-path checks. Missing or unknown observations are not PASS. No external send or public coordination comment is requested.

Standing requirements, current Wave3 brief/lane plan, PROCESS6.1–6.3, implementation standards, supersession and actual WS05/06/07/12, ML24, MT09 and MF16 tickets/scenarios were read. Item0 removes obsolete per-hop authority mechanisms; Decision11/O143 removes Workspace approvals while retaining sharing/current authorization and durable receipts. Root remains the sole orchestrator; helpers xhigh. In-scope decisions proceed without new approval ceremony. Full SDK/RuntimeV1/Core walls, durable session/artifact/user/firm memory and retained Temporal guarantees remain intact.

## Changed paths

- `apps/gateway/general-reads/families.test.mjs`
- `apps/gateway/general-reads/kb-provenance.test.mjs`
- `apps/gateway/general-reads/registration.test.mjs`
- `apps/gateway/general-reads/test/family-cases.mjs`
- `apps/gateway/sources/meetings/http-adapter.mjs`
- `apps/gateway/sources/outreach-query/test/fixture.mjs`
- `apps/gateway/sources/outreach-query/test/handler.test.mjs`
- `apps/gateway/sources/research-legal-legislation/test/fixture.mjs`
- `apps/gateway/sources/research-legal-legislation/test/handler.test.mjs`
- `apps/gateway/sources/research-legal-legislation/test/search-completion.test.mjs`
- `apps/gateway/sources/research-legal-legislation/test/selectors.test.mjs`
- `apps/gateway/sources/research-legal-news/test/fixture.mjs`
- `apps/gateway/sources/research-legal-news/test/handler.test.mjs`
- `apps/gateway/sources/research-legal-news/test/selectors.test.mjs`
- `apps/runtime/test/reads-general-client-parity.test.mjs`
- `apps/worker/conversation/reads/results.mjs`
- `apps/worker/conversation/reads/test/availability.test.mjs`
- `docs/handover/20261025/W3-M3-DATA-RECONCILIATION.md`
- `docs/handover/20261022/decision-log/DECISION-LOG.md` — actual takeover O260.
- `docs/wave3-integration-20261026/BRIEF.md` — this source handoff.
