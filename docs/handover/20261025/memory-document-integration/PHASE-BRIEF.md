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

FROM: Root | TO: Integration | TYPE: PROCESS6.1 brief | RE: Accepted shared intent schema, memory and document composition

Repository neo-capiro/meri-greenfield; branch codex/wave2-memory-document-integration-20261025; retained worktree C:/dev/wave2-memory-document-integration-20261025. Refreshed origin/main base `1416f4ade3e576b93cc0a055792969b86f6c5fea`. Accepted PR265 `2fb9195f89b08bda714528607eabda1c118d0176` / tree `20c7236189968ee87446b7794d408272e6f6fafb` and corrected PR266 `2a8fb73dd76e6c115b762d1902ad3d90a2a1da6e` / tree `5b052079fb6a2250d72be2891a3c67794a71a411`, both authored from `f9583ab5599ea6f07ccdd281be5ae68cff50d5a2`. Current main's seven runtime telemetry/fixture/brief paths remain exact; the nine accepted input paths are disjoint from those and each other.

Authority and sequencing

Root orchestrates at Ultra and owns merge/gates; helpers implement/review/gate at xhigh. Portfolio and Tenant Settings independently ACCEPT the exact dependencies. Both Hermes author sessions exited0 with zero owned processes per Root; do not restart them. Integration owns only this new branch and brief, replay of the exact accepted files, and the named docs-only correction to PR265's brief. No competing writer, Fable or Wave3 file collision. Fable is TESTING NOW; Release holds all live changes. Existing Release alone owns any future AWS/build/deploy/migration/rollback allocation. This task publishes a draft PR, not a merge/build/deployment.

Sources: current repository and C:/dev AGENTS, STANDING-REQUIREMENTS1-4 above verbatim, current handoff, PROCESS6.1-6.3, IMPLEMENTATION-STANDARDS, WORKFLOW, item0 and standard AgentCore Runtime V1 plan, FINAL-PLAN and per-ticket supersession register. Only direct Neo chat changes scope/security; routine authorized composition proceeds. No issue202/public coordination post or new author/subagent.

Current anti-overengineering instructions (C:/dev/AGENTS.md, verbatim)

Neo's direct instruction on 24 October 2026 is to do only necessary work and avoid overengineering. Use existing owners and tools, check the changed behavior locally, build the release image once, smoke and scan that image, and verify the deployed behavior. Keep unrelated broad regressions outside the deployment path. Do not add a new packet, replay, fingerprint or approval framework for routine changes; preserve ordinary source, command, result and failure evidence. Authentication, tenant isolation and data integrity remain release requirements. Reuse valid exact-source evidence rather than rerunning unchanged checks.

Check the actual user path early: mounted route, authenticated identity, real service target, capability settings, producer/receiver versions and representative data shape. A healthy service or synthetic success fixture is not integrated acceptance. Diagnose a failing boundary before another build; inspect adjacent wiring in the same flow so deployment does not discover one missing flag at a time. Once affected checks and independent review pass, move forward instead of adding a census, review round or qualification wrapper without a concrete unresolved risk. Use ordinary Git/CI output and a concise existing handoff; do not duplicate evidence inventories. Coverage matrices select relevant tests rather than require every case for every change. Retain strong tests for actual authorization, migrations, grants, transactions and deletion semantics.

Use the preserved local environment first when it can exercise the flow. Report its running source and remaining authenticated integration gaps honestly; installed services and listening ports do not mean local chat is ready. Keep independent feature work moving while one owner fixes the release blocker. Remove obsolete preview restrictions coherently through existing authenticated routing and actual backend configuration, without weakening tenant isolation or adding per-ticket proxy frameworks.

Bounded implementation outline and existing owners

Replay accepted265 then both266 commits with provenance. Preserve all eight executable source/test files exactly: document-preparer owns trusted operation binding/canonical validation; the shared worker intent adapter derives model-facing memory/document fields from the existing canonical contracts and format-admission owner; tools.mjs uses that adapter. Existing MCP server, intent mount/journal, current session/Core admission, artifact/publication/version/result-release and uncertainty owners remain unchanged. This composition introduces no new API, schema, framework, authority, retry, persistence or architecture. It does not expand the accepted adapter's scope or touch the document owner again.

Named docs-only exception: correct PR265's brief trace order and add a clearly marked superseding evidence note. Actual full-file counts are base4total/2PASS/1FAIL/1SKIP and head7total/5PASS/1FAIL/1SKIP, with inherited INTENT_CONFIGURATION and POSIX generation skip. Earlier author4/2/2/0 and7/5/2/0 interpretations and all-locally-executable-pass claim are superseded; the parser counted the failing-tests heading and lost skips. Preserve original raw logs and accepted265 Git history. Runtime intent-preparers obtains a native credential, borrows/authenticates/checks session/current state before document-preparer; pre-dispatch INVALID_ARGUMENTS can survive. The synthetic omitted-operation base failure only locates that synthetic refusal before its document write owner. It does not uniquely locate the original live failure before every credential/session/Core check. A candidate argument hash only confirms/excludes that candidate; six rows remain UNBOUND and original D1 effect UNKNOWN.

Owned paths

- apps/control/intents/document-preparer.mjs
- apps/control/intents/test/document-preparer.test.mjs
- docs/handover/20261025/briefs/W2-D1-NATIVE-DOCUMENT-BRIEF.md
- apps/worker/conversation/intents/schema.mjs
- apps/worker/conversation/intents/test/intents.test.mjs
- apps/worker/conversation/intents/test/native-document.test.mjs
- apps/worker/conversation/intents/test/native-memory.test.mjs
- apps/worker/conversation/intents/test/schema.test.mjs
- apps/worker/conversation/intents/tools.mjs

Additional integration brief: docs/handover/20261025/memory-document-integration/PHASE-BRIEF.md. Exactly ten final changed paths expected. Preserve current-main telemetry/fixture files byte-for-byte. Retain author/composition checkouts, all raw logs, services/data/auth and dependency caches. Integration creates no service, database, container or live resource and does not clean another owner's process or files.

Evidence and necessary integration checks

Hash-verify all three formal ACCEPT receipts and existing positive proof. Reviewers' exact266+265 overlay already passed the actual MCP schema/memory/document selection14/14 with zero failures/skips/cancellations at22:22:23.6742543Z. Portfolio's independent22:22:56.918Z actual MCP -> real intent mount -> exact265 preparer -> createPostgresArtifactService/publication owner yields draft, exact bytes/SHA/version, PREPARED journal and prepared receipt/reference/result hash. Execution, object put, publication write and version row each1; remounted same-delivery replay returns the same result with counts still1. Authority, SQL, CAS and TXT executor are scripted. This is positive synthetic TXT receipt evidence, not live generation, native Office/rendering or real PostgreSQL/S3/current customer authorization.

Reuse those exact source proofs, accepted265 three new tests/23 mount-release cases, reviewed adapter/memory causal mutants and current-main134/134 telemetry/fixture gate when relevant blobs/dependencies remain unchanged. Do not duplicate the positive probe, launch another author continuation, rerun the14 tests merely for a new commit, or run broad suites. Necessary combined checks here are exact source/overlay/dependency preservation, full-tree equality, approved docs-only difference, scoped cleanup searches, whitespace, clean commit/push and draft PR base/head/scope. If an actual new executable overlap/dependency change appears, stop to scope its one required check rather than inventing a campaign. Integration adds no executable test/assertion: new mutation N/A.

Retain historical failures, not silently passing them:265full-file1FAIL/1SKIP; author broader intents32total/27PASS/4FAIL/1SKIP and previously recorded worker/control limits;266-alone omitted-operation dependency skip is not combined proof (the accepted overlay includes265 and has zero skips). Current telemetry legacy objective import/worker SDK dependency-load limitations remain historical. No new typecheck/build/scan, live query/model/provider/browser/DB/cloud action or lifecycle/performance acceptance.

Per-ticket scope and supersession

MM03/MM05 retain governed memory candidate/owner/reconciliation guarantees; existing current receivers already exist, so their historical main-gap and generic task-approval implementation wording does not authorize a new authority/proposal store or reimplementation. This accepted change exposes canonical model arguments and preserves pending-review semantics, not saved/published memory. MM08/MM09/MM11/MF14 retain document admission, artifact custody/readback and current-access guarantees; historical M197 reception/budget/per-hop authority instructions do not restore removed mechanisms. MF02 preserves revocation isolation but drops exact-run renewal. Source-only adapter/binding fixes do not complete those tickets or expand to library/UI/native-renderer work. Matching E-scenarios are guarantees selected by the affected path, not a blanket test campaign.

APPLICABLE RETAINED TICKETS AND E CASES (VERBATIM)

#### MM-03 — Finish the bounded conversational memory command receiver (P1, blocked by MM-02)

Evidence: [M197 memory metadata L11–48](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/control/memory/approval-metadata.mjs#L11-L48), [M197 execution composer L168–205](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/runtime/native-authority/execution-composition.mjs#L168-L205), [M command source L12–50](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/memory/command-source.mjs#L12-L50).

Root cause: A memory preparer/options owner exists, but shared composition still mounts task-create plus document preparers, and Core native command reception is not qualified for memory.propose. Current commandSourceFor is held without the retention bundle.

Work/files: After MM-02, compose the existing memory preparer/options/source into the existing intent/executor interfaces and add only the action-specific Core approval/execution contract required by the generic command owner. Preserve exact proposal hash, current decision, actor/tenant/stable-run provenance and idempotent Core candidate receipt. Review-only means submitted/pending, never committed memory. Personal content has clientId:null but uses the trusted selected-client session for credential lookup. Explicitly decide a separate unscoped-personal credential contract and firm-wide authority before advertising either; do not derive grants from a model or widen selected-client scope.

Tests: Prepare cannot execute; clientId injection denied; personal/client/firm distinct; lost session/unattended run denied; stale approval, wrong command hash, duplicate decision, retired run, duplicate candidate and uncertainty readback. Dependencies: MM-01/02/05, generic approval/execution/public intents owner. Keep current unavailable registry state until the full path qualifies.

<a id="mm-04"></a>

#### MM-05 — Complete owner review/correction contracts and exact outcome reconciliation (P1; ST-11 complement)

Evidence: [M producer L71–89, L145–186](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/memory/producer.mjs#L71-L89), [Core decision adapter M L1–44](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/memory/core-decisions.mjs#L1-L44), [Core owner items C L20–115](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/memory/memory-owner-items.service.ts#L20-L115), [Core version routes C L44–129](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/memory/memory-version.controller.ts#L44-L129).

Work: ST-11 publishes the exact compatible owner wire DTO and receives F115; do not confuse it with Meri's proposal journal. Correlate Meri candidate/hash/review ID to Core scoped publishedMemoryId; preserve clio: versus item: namespaces and different hash domains. Drain review pages even when decided/suppressed rows yield no visible candidates. After timeout, read exact status instead of recreating a proposal or declaring success. Close the known executor seam where definite post-claim Core refusal is flattened into command UNKNOWN without weakening genuinely uncertain outcomes.

Acceptance/tests: Own versus other owner, activeItemUnchanged pending correction, exact microsecond expectedUpdatedAt, stale target/key collision, correction TTL refused, duplicate approve/reject, immutable conflicting outcome, unavailable Core status versus empty inbox, source suppression before/after decision and no new submission from a read. Bound changes to memory producer/adapters/Core owner DTO and generic executor's typed-refusal seam; no alternate review store.

<a id="mm-06"></a>

| E23 | Memory recall after correction/revocation | Current revision/permission, prior content not reused incorrectly, provenance retained |
| E24 | Memory proposal approved/rejected/lost acknowledgment | Correct owner and durable outcome; four payloads retained/tombstoned coherently |
| E25 | New-surface Memory context | No fake conversation/client authority; held path stays503 until accepted contract exists |
| E36 | Retention suppression→purge→restart/restore | Suppressed data stays inaccessible, class-specific deletion receipts, no restore resurrection |

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

Definition of done and blocked stages

Commit AND push draft PR with exact refreshed base/head/tree and ten-path scope; prove every accepted executable blob/mode and all current-main changes preserved; prove only the named author-brief correction plus this phase brief differ from accepted inputs. Return commands/UTC/results, reused evidence/counts/limits, tests run and NOT RUN, mutationN/A, zero new live effects and root's next action. Source, review, build, deployment and acceptance remain distinct. PR267 remains frozen as-of documentation and is not included in this composition. Original M1/D1 remain UNBOUND/UNKNOWN; D1/E27, authenticated memory/document outcomes, native Office, full Core-call/performance and physical SDK/lifecycle acceptance remain open. Root/Release/Acceptance own later allocation; live changes stay held during Fable testing.
