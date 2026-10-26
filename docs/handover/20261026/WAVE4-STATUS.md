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
| MT-10 / MT-11 with MF-03/04/05/12/13 | task_approval_author | MF-03 PR228 MERGED at 6a353c380b1cae675cd8fa645b237d4a4178b147. MF-04 PR229 MERGED at df64afaad9f3f309deba6186bb74929788345308. MF-05 same-tab decision-to-run observation implementation active | s3_assessment independently reviews frozen slices; root composes reviewed entries and merges |
| A4 ML-04/05/06/19/20/21/22/23/25, ST-14, PF-25, MO-04, MT-03 | a4_assessment | ML-21 corrected Core PR180 frozen at f1784a16 and paired FE PR232 at fbf01826; independent correction review pending. ML-04 Graph reconciliation and native reply/forward remain open | Focused provider-specific boundary tests, zero real provider calls; task_approval_author reviews paired frozen correction |
| S3 MX-06/MX-09 and bounded M7 groundwork | s3_assessment | Standard V1 reuse, 900-second idle/28,800-second max, native SessionStore and workspace/task-file restore exist; reconcile exact cold/warm/restored lineage and unmeasured Core budget | Distinguish implementation gap from missing cold/warm/restored measurements |
| Shared coordination, integration and merges | root | Own this record, allocations, exact review and integrated source decisions | No product implementation or cloud operation by root |

The task author exclusively owns frontend apps/web/src/shared/meri-intents/access.ts, apps/web/src/features/meri/conversation/intents/useIntentList.ts and focused approval regression tests. Further paths require explicit allocation. Core product code is unchanged: task.create and task.update already use native-task-execution.ts with durable receipts and row locks. Current task.update 0.2 is unconditional_patch for title/status/dueDate; expectedVersion, assignee and date clearing are not added by this slice. Every shared path has one writer. Helpers do not recursively delegate. No new user-owned chats are required.

ML-21 author exclusively owns Core engagement/mail-sender.service.ts, focused mail-send-payload.spec.ts, new mail-send-payload.ts and new microsoft/microsoft-send-payload.ts. The only permitted edit in microsoft-graph-sync.service.ts is extracting/reusing its existing sendMail draft-body serializer; sync/read/token/receipt logic is reserved. The preflight measures the actual provider request envelope with provider-specific caps, before adapter dispatch. The author additionally owns only the single-mail preflight and payload-error preservation sections of engagement.service.ts plus focused single-mail-service.a1.spec.ts regressions, to validate before intent claim. The paired frontend scope is relationships/email/send.ts and email-compose.test.ts: a definite pre-intent size rejection must unlock the attempt and display the existing actionable API error, while uncertain sends remain fenced. No schema or public package change is allocated.

The merged MF-04 slice exclusively changed frontend conversation/intents/useConversationIntents.ts, a bounded useIntentExpiry.ts hook and meri-task-approval-expiry.test.ts. Its source was composed onto merged MF-03 and independently accepted; PR229 merged tree 0af7892d5fb519ae37f9379bd4ddf6e574317516 exactly matches the accepted candidate724c46c75f020ed1a15600666a47e0858773b24f. Scope is deadline/visibility refresh and cleanup only; no decision dispatch, persistence, polling or UI design change.

MF-05 author owns useConversationIntents.ts, ConversationIntents.tsx, ConversationPanels.tsx, MeriLiveConversation.tsx, useLiveRun.ts, useRunObservation.ts and focused meri-task-approval-run-refresh.test.ts. Scope: coalesce a current-lifetime authoritative read after settled decision, then bound observation through delayed continuation without pretending waiting is running or replaying commands. The full ticket also requires manual run refresh in paused/waiting/unknown states and bounded external-reviewer refresh; those remain open beyond this same-tab slice. An inbox remains separate.

## Source and release boundaries

Last accepted source at handover: Core backend-import `4d88a93f75f5b51b2a8caa980d11b27442f0b882`; frontend main `a5cfde83c82e247c6552b8866229b5c3fe3adeb3`; Meri main `6ac9775091997d62ffbc381486783e8c1184b1ac`. All three refs were independently refreshed on 26 October 2026 and match these bases. These are source bases, not deployed versions.

Fable exclusively owns FE222 hearing player, FE225 feedback, Meri280/catalog integration, shared contracts/generated outputs, skills index, package locks/vendor pins and non-Wave4 registry composition until a clear handoff. The accepted isolated frontend preview `0cba013e707c5cf28fa7ceabc9e017ed773db3bd` and combined Meri candidate `7a09fe96df16db6db1d4e8e5f0136b35ea65cd1d` remain reserved. Preserve frozen checkouts, caches, Windows/WSL, persistent databases and private configuration.

Existing Release is stopped for Fable transfer. Wave 4 has no cloud/deploy operator or release window allocated yet. Disjoint source work and local tests proceed. Root will coordinate one operator and shared release window before any native/cloud deployment work.

Neo explicitly authorized Wave 4 to integrate its reviewed registry entries in response to the ownership question. Root alone composes those reviewed entries in scripts/architecture/reviewed-size-findings.json; this narrow exception leaves Fable's other reservations in place.

## Acceptance boundaries

Use current producer/receiver paths and proportionate positive/negative tests. Task approvals retain immutable input/hash/reviewer, supported field semantics, declared concurrency policy, current access, one canonical effect receipt and read-only UNKNOWN reconciliation. No generic mutation framework, new grant broker or Workspace approval workflow.

All touched UI must use the actual Figma 3.4 library and existing supported components. MF-13 remains conditional on a scoped public inbox owner; no fabricated authority or approve-all control.

No live model submissions are allocated: Wave 3 has zero remaining slots, and its USD16 conservative allocation is not actual spend or available balance. Reconcile canonical USD25 monthly cap and SDK20-turn/USD2-per-query bounds before a finite new allocation. No external mail/provider sends without Neo's specific send instruction. No new OAuth consent or schedule activation. Never replay UNKNOWN writes or turns.

## Evidence and next action

| Slice | Exact accepted or candidate source | Evidence and remaining work |
| --- | --- | --- |
| MF-03 access refusal | PR228 merged 6a353c380b1cae675cd8fa645b237d4a4178b147; tree 7b1dbc653a244df3384bdce63a3fc586bca9324a | Independent source/composition ACCEPT; 59 focused passes, TypeScript/lint/format pass, four mutants killed. Base 22 failures/9 passes. Merged tree equals reviewed candidate4c7595cf |
| MF-04 expiry | PR229 merged df64afaad9f3f309deba6186bb74929788345308; tree 0af7892d5fb519ae37f9379bd4ddf6e574317516 | Independent source/composition ACCEPT; 36 focused passes, TypeScript/lint/format pass, five mutants killed. Base6fail/3pass. Merged tree equals reviewed candidate724c46c7 |
| ML-21 payload size | Draft Core PR180 at f1784a16f0b394fc56f9bb8a6f752880936e0240; tree d6105f203e3bad42825a6ae0e979fe6ee9647967. Paired draft FE PR232 at fbf018267326d44edf92b3c54533bb2da4b307f3; tree b77ecb858ec6699ff5dea00c68fd8bf2fd06bfe0 | Corrected pre-claim preparation and precise error path; Core125/125, FE62/62 focused tests; affected typing passes. Whole API79 and web97 diagnostics identical base/head, none affected; Core lint unavailable. Independent paired correction review pending |
| MF-05 decision and run | Draft FE PR230 corrected head b59f7d6a06990aad906dd4fba83af72465fa5fd4, tree b45a428aecbc8b6117e201fa1fc3e73f4615837d, base df64afaad9f3f309deba6186bb74929788345308 | Initial67/67 focused cases; independent actual composer Stop witness found a queued history read surviving cancellation at first head ad4fe581. Correction retires the queued generation before canonical cancel and rejects late prior completions;32/32 narrow cases/types/lint pass. Exact final review pending. No status inference or command replay |
| S3 MX-06/MX-09 | Meri main6ac9775091997d62ffbc381486783e8c1184b1ac | Existing reuse/idle/restore implementation retained. Bounded S1/S2 saved-receipt reconciliation finished: hashes/settlement joins pass, but all six UI identity fields are null and all four analyses retain mappingConfirmed=false. Exact source-target lineage, classified cold/warm/restored medians and simple-turn Core budget remain unqualified; no runtime rewrite allocated |

Private evidence remains in work/task-approval, work/task-approval-expiry, work/review-mf03, work/review-mf04, work/a4/ml21-evidence and work/s3. Candidate summaries are retained in outputs/W4-TASK-APPROVAL-CANDIDATE.json and W4-TASK-APPROVAL-EXPIRY-CANDIDATE.json. Preserve original setup failures, the mail HTTP timeout and passing same-environment base/head comparison; later passes do not erase those runs.

S3 saved-only follow-up is closed at insufficient owner binding. The first missing record is an authenticated UI alias-to-conversation/run/attempt receipt, followed by the existing source/successor SDK lineage and prefix evidence. Artifact restoration was not exercised and no canonical empty inventory was established. These are evidence gaps, not proof of lost state. No further collection or extra telemetry framework is allocated.

No Wave 4 image build, deployment, authenticated live acceptance, provider send or new SDK model submission has occurred. Next: finish MF-05 and the ML-21 correction, independently review the final deltas, integrate accepted source and coordinate one release operator/window. MF-12/13, native mail reply/forward, Graph receipt reconciliation, other M4 actions and full S3 qualification remain open; Wave 3 obligations stay with Fable.
