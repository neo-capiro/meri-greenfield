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

# Wave 4 coordination and progress

26 October 2026. IN PROGRESS. Codex is the Wave 4 orchestrator under Neo's latest role split. Fable owns remaining Wave 3 implementation, shipping and acceptance. This supersedes the coordinator wording in the initial Wave 4 plan and historical AGENTS role assignments. Onboarding remains excluded until the rest of the project is live.

## Allocation

| Scope | Owner | Current work | Review and next step |
| --- | --- | --- | --- |
| MT-10 / MT-11 with MF-03/04/05/12/13 | task_approval_author | MF-03 PR228 MERGED at 6a353c380b1cae675cd8fa645b237d4a4178b147. MF-04 expiry refresh implemented at f7d20c4c7fd8dae7e6da1b5eb41f4bdb3ed47ec1; independent review active | s3_assessment independently reviews MF-04; root composes reviewed entries and merges |
| A4 ML-04/05/06/19/20/21/22/23/25, ST-14, PF-25, MO-04, MT-03 | a4_assessment | Assessment complete. Implementing ML-21 aggregate encoded payload preflight in existing sender; paths allocated below. ML-04 Graph reconciliation and native reply/forward remain open | Focused provider-specific boundary tests, zero real provider calls; independent review after frozen head |
| S3 MX-06/MX-09 and bounded M7 groundwork | s3_assessment | Standard V1 reuse, 900-second idle/28,800-second max, native SessionStore and workspace/task-file restore exist; reconcile exact cold/warm/restored lineage and unmeasured Core budget | Distinguish implementation gap from missing cold/warm/restored measurements |
| Shared coordination, integration and merges | root | Own this record, allocations, exact review and integrated source decisions | No product implementation or cloud operation by root |

The task author exclusively owns frontend apps/web/src/shared/meri-intents/access.ts, apps/web/src/features/meri/conversation/intents/useIntentList.ts and focused approval regression tests. Further paths require explicit allocation. Core product code is unchanged: task.create and task.update already use native-task-execution.ts with durable receipts and row locks. Current task.update 0.2 is unconditional_patch for title/status/dueDate; expectedVersion, assignee and date clearing are not added by this slice. Every shared path has one writer. Helpers do not recursively delegate. No new user-owned chats are required.

ML-21 author exclusively owns Core engagement/mail-sender.service.ts, focused mail-send-payload.spec.ts and new microsoft/microsoft-send-payload.ts. The only permitted edit in microsoft-graph-sync.service.ts is extracting/reusing its existing sendMail draft-body serializer; sync/read/token/receipt logic is reserved. The preflight measures the actual provider request envelope with provider-specific caps, before adapter dispatch. No schema or public package change is allocated.

The next MF-04 slice exclusively owns frontend conversation/intents/useConversationIntents.ts, a bounded useIntentExpiry.ts hook and meri-task-approval-expiry.test.ts. It is stacked on the frozen MF-03 candidate in a fresh checkout. Scope is deadline/visibility refresh and cleanup only; no decision dispatch, persistence, polling or UI design change.

## Source and release boundaries

Last accepted source at handover: Core backend-import `4d88a93f75f5b51b2a8caa980d11b27442f0b882`; frontend main `a5cfde83c82e247c6552b8866229b5c3fe3adeb3`; Meri main `6ac9775091997d62ffbc381486783e8c1184b1ac`. All three refs were independently refreshed on 26 October 2026 and match these bases. These are source bases, not deployed versions.

Fable exclusively owns FE222 hearing player, FE225 feedback, Meri280/catalog integration, shared contracts/generated outputs, skills index, package locks/vendor pins and non-Wave4 registry composition until a clear handoff. The accepted isolated frontend preview `0cba013e707c5cf28fa7ceabc9e017ed773db3bd` and combined Meri candidate `7a09fe96df16db6db1d4e8e5f0136b35ea65cd1d` remain reserved. Preserve frozen checkouts, caches, Windows/WSL, persistent databases and private configuration.

Existing Release is stopped for Fable transfer. Wave 4 has no cloud/deploy operator or release window allocated yet. Disjoint source work and local tests proceed. Root will coordinate one operator and shared release window before any native/cloud deployment work.

Neo explicitly authorized Wave 4 to integrate its reviewed registry entries in response to the ownership question. Root alone composes those reviewed entries in scripts/architecture/reviewed-size-findings.json; this narrow exception leaves Fable's other reservations in place.

## Acceptance boundaries

Use current producer/receiver paths and proportionate positive/negative tests. Task approvals retain immutable input/hash/reviewer, supported field semantics, expected version, current access, one canonical effect receipt and read-only UNKNOWN reconciliation. No generic mutation framework, new grant broker or Workspace approval workflow.

All touched UI must use the actual Figma 3.4 library and existing supported components. MF-13 remains conditional on a scoped public inbox owner; no fabricated authority or approve-all control.

No live model submissions are allocated: Wave 3 has zero remaining slots, and its USD16 conservative allocation is not actual spend or available balance. Reconcile canonical USD25 monthly cap and SDK20-turn/USD2-per-query bounds before a finite new allocation. No external mail/provider sends without Neo's specific send instruction. No new OAuth consent or schedule activation. Never replay UNKNOWN writes or turns.

## Evidence and next action

The initial plan and Wave 3 continuation handoff were read from the outgoing orchestrator outputs and published commit `0c74a5670e59a6d66b06bf2a61b2e03806068322` on `codex/wave2-handoff-20261025-docs`. Canonical standing requirements, process, workflow, supersession, phase table and exact first-slice tickets were read from the retained documentation checkout.

Implementation has started with three bounded assignments. MF-03 [frontend PR228](https://github.com/neo-capiro/capiro-frontend/pull/228) is published at head 734094ae0683f44bbc3fbc77a92b931f88b6759b, tree afacfd0abf909d665dbad65712a4da94313f71ac, base a5cfde83c82e247c6552b8866229b5c3fe3adeb3. The author reports 59 focused passes, whole-web TypeScript and changed-file ESLint pass, formatting/diff pass and four killed mutants. Retained base regression: 22 failures / 9 passes. Independent behavior and final composition review ACCEPT. MF-03 behavior is independently ACCEPT. Root composed the exact reviewed architecture entry at 4c7595cf19954f29f6b926a0e1f261fa7aca5dd0, tree 7b1dbc653a244df3384bdce63a3fc586bca9324a; source-union confirmation is ACCEPT. PR228 merged as 6a353c380b1cae675cd8fa645b237d4a4178b147; refreshed remote merged tree exactly equals the accepted candidate. No Wave 4 source is yet built, deployed or accepted live. Next: finish independent MF-04 expiry and ML-21 mail-size reviews and merge passing source without disturbing Wave 3 release composition. MF-04 author reports 36 focused passes, TypeScript/lint/format pass and five killed mutants; its three authored blobs are composed onto current main for review, with the registry entry still pending. Required focused checks cover denied list/decision, stale completion, current identity retirement and retryable transport failure. MF-04/05/12/13 remain separately open after current-source reconciliation.
