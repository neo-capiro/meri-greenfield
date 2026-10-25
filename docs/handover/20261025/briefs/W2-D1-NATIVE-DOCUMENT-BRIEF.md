<!-- Authorisation: fresh Hermes Wave 2 D1 native-document author lane, branch hermes/w2-d1-native-document-20261025,
base f9583ab5599ea6f07ccdd281be5ae68cff50d5a2. Body below is byte-identical to the brief supplied to that session
(source W2-HERMES-D1-BRIEF.md, sha256 168f837dc1feb7f6d001d1b21b000bfc016e92aab8617c857d60d033fa3ce7f7, 30712 bytes).
The launcher's outer allocation text (two author lanes; shared-file one-writer rule) is recorded with the handback. -->

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

FROM: Root | TO: fresh Hermes document author | TYPE: brief | RE: D1 native document creation blocker (Wave 2)
# Hermes D1 causal fix and receipt recovery — PROCESS6.1

Neo directly instructed Root: delegate both memory and document blockers to Hermes. You are the sole D1 implementation author; Portfolio Codex is the independent reviewer, not a competing implementer. The existing launcher starts one fresh session at requested xhigh and records the actual model/effort. Root orchestrates integration/gates/merge; Release alone operates AWS/migrations/rollout/rollback; Acceptance owns browser acceptance. No recursive delegation. This current instruction supersedes historical Codex-only/Fable-role wording without changing the product's Claude SDK harness.

## Source, checkout and sequencing

Primary repository neo-capiro/meri-greenfield. Exact remote main freshly checked 2026-10-25: f9583ab5599ea6f07ccdd281be5ae68cff50d5a2. Fresh isolated checkout C:/dev/hermes-w2-d1-20261025, branch hermes/w2-d1-native-document-20261025, at that base; launcher creates it if absent, uses a fresh sibling if occupied, and records actual path. Do not use another owner's checkout. Start now without waiting for pending live metadata; investigate the concrete document schema/owner boundary locally and incorporate the actual result when delivered. Do not silently change base or merge sibling work.

Read C:/dev/AGENTS.md, repository AGENTS.md, applicable nested instructions, docs/handover/20261022/{STANDING-REQUIREMENTS.md,PROCESS.md,WORKFLOW.md,WAVE-2-HANDOVER.md}, plan/FINAL-PLAN-20261021.md, plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md, source-of-truth/{STANDING-RULES.md,SUPERSEDED-BY-ITEM-0.md,Capiro-Meri-Wiring-Closeout-Plan-20261021.md,Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md}. Rules/template/plans were checked at current f958; those documents are unchanged from the preserved docs checkout8acb. Save this full brief inside the fresh checkout before product edits; commit AND push it with the change.

Other repositories, read-only unless Root allocates a proven receiver fix: frontend main90702180dfb6d529745d01601db85a7f09a81369 (treef346e4c3d4d6f8c61a49ca3ff0b1a31d06db55b9); Core's actual default branch is backend-import, HEAD722f094cf60e40b2fb270bb5c1e06bf66d795c42, not a branch named main. Exact remote refs refreshed. If frontend code must change, request a separate isolated checkout at9070 and name affected files first; use the installed Next docs. No Core edit is allocated.

Latest saved deployed pins, refreshed from Release handoff files (no new live query): Core15/source929acd023c29d9073cbf9d5c5105eba8c3252948/image sha256:49722d1332083d97b0df9139a0eed063ba4516d987b67883ace1c819ba0540a4; Meri Control71/Worker67/Schedule4/source09e89db9b57c8fcb5b1aa15a4d1479074c8bbe16/image sha256:876a7267e9ab231769379800a7c487f3f45860d975b8da7349756484534cc6d0, AgentCore Runtime8/preview8/DEFAULT8; FE32/source1dfd5893525ad31b7e6622371b1d4e1ddb6bcbf1/image sha256:8dc0eb6fcc58fcb7d6f651762d98afc2f966d1a9dc6bdde0fb4fe0fb17468bf2. The new9070 FE image sha256:e0385b3f3321976355aa2387828189573d2a95fdad78ce1f42805836c0d52098 was built/scanned/smoked21:17:27Z and is NOT deployed. Source/build/deployment/acceptance are distinct. Root/Release will provide any later deployment delta; do not probe live state yourself.

Frozen siblings: Meri PR262 headbaf6287048411233953f6c7595faf804182a9160/tree4b816a43969e0de63f17c9422955a24c0b984086 (Runtime telemetry, independently ACCEPT per Root); PR263 head14579f0da3060782e39f9121dc6b7d202a232336/treec2fe29a7b67b260c8191e24a4315dee9ba5b0736 (inventory fixture, independent review). Both remain OPEN drafts at this refresh, basef958. Exclude their files: apps/control/conversations/{completion-journal,postgres-store}.mjs, apps/runtime/{agentcore-candidate,agentcore-execution}.mjs, apps/runtime/test/agentcore-candidate.test.mjs, apps/runtime/artifacts/test/native-files-owner.test.mjs. Do not repair their inherited failures or cherry-pick them; Root composes separately. FE PR164 head4f10476063cd9ef52d341fc597f0a6cdc8c694f7 is frozen accepted guidance, incorporated into the newer FE batch. Prior PR157 saved-run Files fix is already deployed. Neither is an unfinished D1 implementation.

## Actual failure and evidence limits

On25October, Acceptance's fresh nominated-client tab entered /meri?clientId with no conversationId and displayed no saved turns. One explicit Send20:16:48.287Z requested create_word with title “Wave 2 acceptance document” and only body “Synthetic Wave 2 acceptance document”. Running/schema-check text20:17:00.885Z; access unavailable and transcript cleared20:17:26.547Z. Same-tab Files navigation20:17:37.603Z, one Connect20:17:42.702Z, context unverified20:17:50.463Z. One model submission, one REQUESTED creation; tool dispatch/publication/actual effect UNKNOWN. Do not resend, reconnect, create a replacement, label zero effect or consume model budget. Earlier19:49 zero-create Connect is a separate historical event, not this outcome.

The original sealed browser packet contains no typed HTTP/domain error or saved artifact receipt. Runtime's one finite existing-log window20:16:46–20:18:20 captured Core592/Control11/AgentCore8 events; one candidate SDK completion20:17:26.749Z,47 runner owner calls/all2xx. Missing document metrics or successful transport does not prove no effect/success. Initially those logs exposed only run/attempt. Release subsequently recovered exact canonical bindings at21:09:11.993Z: exactly one row for D1, validated RunBinding, immutable owner, captured run/attempt and nominated client scope all match. That is proven ownership metadata; exact prompt join, fresh Core access and effect outcome remain unproven. Actual identifiers stay only in named private evidence, never this brief/PR/log output.

PENDING allocated metadata: Release owns two scalar projections in Portfolio outputs/W2-D1-OUTCOME-METADATA.sql (OCTOBER24 workspace). First execution21:26:52Z failed SQLSTATE42883, transaction rolled back, zero result rows; second SELECT not attempted. Root already authorized routine type repair: both UUID conversation_id predicates use $3::uuid while JSON comparisons retain $3::text. Same current-owner parameters, strict TLS, established non-superuser Control role, read-only transaction, bounded timeouts and rollback, cap9 with ninth overflow. No data/effect inference from this SQL failure. Release corrects and executes; Hermes must not repeat or widen it. Feed the actual result into the causal reproduction when Root provides it; do not delay starting local source work.

Private evidence filenames only: Release work/release-20261025/private/m1-d1-owner-metadata/{verified.json,manifest.json}; private/d1-outcome-metadata/{intent.private.json,intent-query-intent.json,result.json}. Release owns their interpretation/access and supplies sanitized scalars; do not dump files. Runtime work/corrective-runtime-observation/{D1-existing-log-receipt.json,D1-candidate-owner-reference.json}. Acceptance outputs/{corrective-d1-native-access-unavailable.jpg,corrective-d1-native-context-unverified.jpg,m1-d1-forensic-handback.txt}. No credentials or private context in the prompt. Normal domain-content reads require existing current Core/owner/retention gates; operational metadata allocation does not authorize direct SDK/blob/document reads.

## Completed investigations — reuse, do not repeat

Portfolio's26 existing lifecycle/history tests passed at20:34:59Z; four temporary actual-network/observation-loop diagnostic cases passed20:40:26Z. They distinguish clean30s rollover and503 from401/403, abort active private readers on definitive denial, and ignore late401 after caller abort. Existing expiry/renewal tests retain exact binding and distinguish access loss. These did NOT reproduce this live cause and do not eliminate all producer denial paths. Meri already preserves marked transient authority failures separately; do not recreate that old fix or infer TTL from elapsed time.

Native FE has two denial routes: opaque conversation HTTP401/403, and native transcript401/403 or MEMBERSHIP_CHANGED; the latter revokes the same host. Finished-state history refresh is a possible access-check path, not a proven D1 sequence. The latest exact completed canonical run remains readable by its owner; completion alone is not a demonstrated revocation bug. First-chat confirmed conversation hint survives scoped denial cleanup, while run/submit recovery clears; signout/identity change clears all. These browser details are already traced. Do not repeat30s/session/DOM/storage investigations.

Original tabs have no WebMCP tools; documented browser evaluate is DOM-only, no storage/request reader. No hidden-state/fetch/token/cookie/DevTools workaround. Regular /meri?conversationId mounts admission and can reserve a successor; it is not a read-only recovery route. Existing transcript POST is normal current-authorized reading, and verified candidate identity can establish a join without a prior UI join. TenantSettings/Root own that parallel reader identification; do not duplicate it. Source maps and logs are in C:/Users/Administrator/Documents/Codex/2026-10-24/wave2-visible-portfolio/outputs/{W2-D1-NATIVE-ACCESS-BRIEF.txt,W2-ORIGINAL-IDENTITY-RECOVERY.txt,W2-D1-OUTCOME-METADATA.txt}, with test logs in sibling work/. New tests0 for this handoff, mutationN/A. No new model/browser/AWS/DB/document-byte checks run by Portfolio.

## Own the smallest causal document correction

Primary authorized files, only as needed by a concrete reproduction: apps/control/intents/{document-preparer,artifact-draft-result}.mjs and adjacent document-only tests; apps/runtime/artifacts/{intent-preparers,application,core-authority,core-authority-client,core-authority-wire}.mjs and adjacent document tests; apps/control/document-application/{index,current,http,format-admission}.mjs and direct document tests; apps/artifacts/{postgres-service,service}.mjs and direct document delivery tests. Existing storage/publication read owners may be inspected, not redesigned. Identify exact intended edit paths in the brief before edits. Core/memory settings/storage schemas, migrations, credentials, runtime telemetry and frozen fixtures are excluded.

MCP schema/routing files apps/worker/conversation/intents/{catalog,server,schema}.mjs and shared apps/control/intents/{mount,journal,postgres-journal,approval,http}.mjs are shared with the new Hermes MEMORY author: READ them to trace the real schema, but report a concrete required shared edit to Root for one-writer allocation before mutation. Do not build duplicate document tools, auth/currentness/receipt layers, validators, retry loops or operator framework. Shared session/bootstrap and unrelated FE lifecycle paths remain excluded unless an actual causal counterexample earns named ownership. Reuse standard SDK behavior and canonical owners. In-scope choices proceed and are logged; real scope/security conflicts go to Root/Neo.

Trace actual advertised create_word MCP schema -> parsed operation/arguments -> document-preparer request validator -> borrowed current run/session -> document application -> artifact journal/publication -> result release. First make a minimal synthetic local producer-shaped call of the existing actual entry points; preserve each closed code and the boundary reached. Use the actual pending metadata to choose a demonstrated failing boundary, not a broad hypothesis tour. Once proven, fix that owner minimally and retain refusal, isolation, idempotency and unknown-effect fences. If evidence remains insufficient, state the single smallest missing discriminator immediately; do not mask errors with retries or return successful UI copy.

Useful existing outcome owners (not authorization to execute live): outer tool delivery is intentDeliveryId(binding,actualSDKsessionId,actualToolUseId) in apps/worker/conversation/intents/server.mjs:30; it intentionally omits run/attempt. Inner document invocation is 'sdk:'+canonicalSha256({kind:'document-generation',binding:fullCanonicalRunBinding,deliveryId:actualOuterDeliveryId}) in apps/artifacts/postgres-service.mjs:28. readDocumentInvocation at11–15 reads the existing inner journal and deterministic versionId without execute/replay. createPostgresIntentJournalStore.read/list is bounded by owner/conversation/delivery. PREPARED release.binding/result.version.binding can prove the run; FAILED/PENDING/UNKNOWN rows have no retained run binding and stay UNBOUND absent actual delivery correlation. Do not hash an inner ID twice or derive from reduced binding/timestamp.

Normal /api/conversations/intents/list can return pending/unknown/failed(code)/prepared-draft(versionId) under current membership/retention; it does not establish an exact run or byte integrity. Metadata SQL includes only status/code/reference/version/hash and binding booleans. A SQL version projection may follow authoritative publication; absence is not proof of no publication. /api/documents/inspect reads bytes and may recover metadata, so it is outside the current operational metadata allocation. No create/execute replay to discover an unknown result.

## Minimum proof and done

1. A causal regression through the affected existing producer/receiver, failing on exact base and passing on fix; actual typed create_word fixture, not mirror assertions. Check valid DOCX, malformed operation/arguments, wrong owner/client/run, revoked access, lost preparation/publication acknowledgment and no duplicate execution as relevant to the changed boundary. Use existing harness/dependencies and isolated synthetic fixtures; no environment rebuild or broad gate census. Node24/npm11; preserved observed Node24.22.1/npm11.19.1. Record any inherited failure rather than repairing excluded PR263 fixtures.
2. Kill meaningful mutants of every newly asserted executable guarantee; remove temporary diagnostics before publication. Run affected tests/typecheck/lint only where appropriate. Record UTC, commands, counts/exits, base-versus-head and NOT RUN. Review400nonblank/file or80/function as design signals, not automatic split. Delete replaced code/flags/tests in this PR and give focused grep evidence; no dead compatibility path.
3. Prove local durable document receipt/version/hash correlation using the existing publication owner and synthetic bytes. Distinguish draft creation, publication, filing and later current access. Original live effect reconciliation remains Release/Acceptance-owned and UNKNOWN until real receipt evidence. Source completion does not close E27.
4. Commit AND push full brief, minimal source/tests and concise evidence; draft PR only against the exact base (include any Root-approved dependency). Return exact head/tree/base, changed paths, proof and remaining blocked owner. Portfolio reviews independently under PROCESS6.2, Root integrates, Release builds/ships once; you do not merge/build release images/deploy/migrate/query live or start another model request. Later explicitly allocated authenticated readback must verify original or newly authorized test document receipt, version/hash, current Files/chat access and bytes without duplicate creation. Do not claim live success from local tests.

Preserve all shared services, WSL, database/data, configuration, caches and other checkouts. Cleanup only your verified disposable test artifacts/processes. No customer-linked IDs/UUIDs, secrets or private text in public Git/PR; no #202 post. Current M1 is a separate Hermes implementation and must not become your scope. Root receives status; launcher mechanics do not grant additional product/security scope.

## Ticket interpretation before verbatim source

The following full ticket text supplies required guarantees, not permission to implement its entire historical roadmap. D1 is the existing create_word path and receipt/readback only; no library redesign, new format/editor/share/preview or blanket six-format qualification. Apply current standing rules and supersession register first: old M197 reception/budget/per-hop authority wording is historical, no removed grant/budget/issuer/wrapper reconstruction. MF-02 retains revoked-access isolation but drops exact-run renewal as a required mechanism. MM08/09/11 and MF14 retained behavior remains binding; current owner evidence supersedes their historical “missing from main” root-cause text. Existing typed document input is self-contained. Matching E cases below select affected guarantees; reuse completed unrelated proof.

## Verbatim applicable tickets

#### MM-08 — Receive and qualify the existing artifact runtime composition (P1; main source gap / PR receiver)

Evidence: [main CLI M L55–70](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/cli.mjs#L55-L70), [receiver CLI M197 L55–71](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/runtime/cli.mjs#L55-L71), [M197 operation set L39–43](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/runtime/artifacts/run-options.mjs#L39-L43), [M197 intent preparers L28–95](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/runtime/artifacts/intent-preparers.mjs#L28-L95).

Root cause: Main calls composeDocumentsFamily without authorityPorts, leaving the ordinary configured store-only family. PR197 supplies Core current authority, native credential relay, four operation descriptors and derived per-call sessions for document/ZIP intents.

Work: Review the exact current M197 successor under the MX-02 source-reception ticket, preserving its received candidate11 changes. Verify authority.bind, run register/release, exact selected-client/native credential correlation, source/intent flags and actual executor paths together. Use existing S3/PG publication custody and canonical budget namespace. Compose only supported operations; absence must remain specific unavailable readiness, not globally healthy. Connect typed draft receipt into the existing event/history owner; general output is not a task approval.

Tests: Missing inputs yield no generator/IO; cross client/tenant/run, session switch/revoke, invalid grant, budget exhaustion, unknown create/commit, replay, terminal retirement and cleanup; PPTX/ZIP real bytes with exact SHA. Dependencies: shared source/image/DB qualification, MM-09/10/18, tools authority. No live claims from PR receipt.

#### MM-09 — Receive six-format read contracts without widening the writer (P1; WS-23 canonical)

Evidence: [M197 document-access README L1–26](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/packages/contracts/document-access-application/README.md#L1-L26), [M197 format admission L8–20](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/control/document-application/format-admission.mjs#L8-L20).

Work: WS-23 receives matching generated B2 blobs from M197 and F115, checks exact metadata/source hash provenance, and retains frozen create/revise contract. Meri consumer must choose descriptor from the retained version, not browser operation/MIME claims. Distinguish read support (all six) from create/revise control support and PDF renderer admission. Fix public provenance checks at integrated head before publishing a contract; historical PR192 is donor lineage, not another branch to merge.

Acceptance: DOCX/TXT/XLSX/PPTX/PDF/ZIP inspect then download, wrong format/session/client/version/hash/size/MIME/filename denied; download object must come from successful inspect module provenance. nativeOpened/rendered/recalculated remain false unless a separately reviewed future contract genuinely changes them. draft/pending is not preview availability. No PDF/PPTX writer UI enabled merely by importing B2. Dependencies: MM-08/10/11 and exact frontend receiver.

#### MM-11 — Add durable artifact discovery, history and post-run read authority (P1; WS-24 canonical)

Evidence: [run options M L9–28, L89–118](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/artifacts/run-options.mjs#L9-L28), [registry M L88–103](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/prepared-run-registry.mjs#L88-L103), [immutable storage M L16–20](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/artifacts/storage/README.md#L16-L20).

Root cause: Version records persist, but no public list/full-history surface exists; ordinary document options rely on a live in-process run tuple released on retirement. Event/local recent versions are not a library or permanent read authority.

Work: Extend existing artifact owner with bounded owner/client/conversation list, detail, immutable version chain, cursor and exact-current-access DTOs. Define fresh read-only admission for a completed run's artifact or rehydrate the existing qualified read owner without reviving write allocation/old credential. Support reload/deep link/renamed title/retained original provenance. Explicitly define whether archive/delete/share/comments are supported; recipients, role/version visibility, revocation and audit receipts require a real contract. Same-actor authenticated download links are not share links. Reuse Portfolio filing links, not a second Files store.

Acceptance: More than ten versions; restart/terminal origin; no read budget reservation; hidden revoked/suppressed artifacts vanish from list and fail direct known-ID access; old scope facts never authorize; tampered cursor; independent current reader cannot rewrite original provenance. Dependencies: MM-07–10/14, UI consumer and WS-24.

#### MF-14 — Finish artifact library/detail consumers under WS-23/24 (P1)

- **Root cause / evidence:** Live artifact inspector is not file library: known-version input, event-derived versions and last10 local views; rich editor/previews/history/share remain fixtures. Merged PR115 adds all-format read receiver only; this reception is complete on current main.
- **Bounded files/owner:** Canonical WS-23/24 files plus `ConversationArtifacts.tsx`, `files/DocumentVersionPanel.tsx`, `MeriFilesWorkflow.tsx`, new read-only file detail/library views and route helpers. MM owns backend render/custody contracts.
- **Implementation:** Do not reimplement merged PR115 document-access0.1.0; qualify the received reader, then build authorized durable list/version index and deep links with typed source/provenance/status. Render only supported safe preview results; preserve signed-link redemption/hash validation, revoke object URLs and clear bytes on lifetime change. Add compare/revision/history UI only with exact-version contract. Keep edit/share/comments/rename/delete disabled until canonical owners provide semantics; do not fake save via local state.
- **Dependencies / exclusions:** WS-23 received-reader qualification, WS-24 file workspace, MM renderer/PDF/PPTX/ZIP/filing custody, MR writer authority. This ticket is consumer slice, not new duplicate file service.
- **Acceptance:** All six formats correctly discriminate supported preview/download/unsupported; exact bytes/hash checked; link expiry/revocation/cross-client substitution fail closed. Reload/another tab sees durable versions, not local10 list; missing renderer never claims native preview or successful edit.

## Verbatim matching acceptance scenarios

| E01 | Authenticated selected-client first chat | One admission/run, real response, durable transcript and correct current actor/client |
| E02 | Reload/new tab after completion | Same messages/citations/artifacts, correct ordering and no prompt redispatch |
| E03 | Double click and lost submit acknowledgment | Same request identity reconciles to one accepted effect/run; no duplicate |
| E05 | Session expiry and transient Core503 | Retryable unavailable differs from revoked identity; no unauthorized bytes or false success |
| E06 | Sign-out/tenant/client change with stored draft/intent | Old data/credentials/receipts cannot cross the new identity or client |
| E27 | Artifact generation and publication | Valid content+version+hash+evidence; publish once; current Files/chat access |
| E43 | Mixed versions/frontends/contracts | Explicit version/source refusal or accepted backward compatibility; no silently misparsed approvals/output |
| E45 | Canonical cross-module handoff | Portfolio/Workspace/Settings context preserved with entity IDs; effect appears in receiving module after reload |

Brief assembled UTC: 2026-10-25T21:30:38.7014253Z
