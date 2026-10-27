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


# W5-01 — M5 documents, files and research outputs

FROM: Wave 4 root | TO: Wave 5 orchestrator / allocated M5 owner | TYPE: prospective phase brief

**Allocation:** FINAL-PLAN §5 M5; needs M4; scenarios E26–E31/E45. The historical wave table does not allocate files. The Wave 5 orchestrator assigns and implements finite slices of confirmed remaining requirements after reconciling source/dependencies; routine file allocations do not need root approval.

**Repository/branch/base/dependency heads/worktree:** Meri main, relevant frontend main and Core backend-import only where existing owners are needed. Record fresh exact bases and isolated worktrees after root's release handoff. Do not implement in the owned docs checkout.

**Boundary:** existing artifact/document application, immutable storage, Core access and public contract owners remain canonical. Frontend consumes a matching allocated public contract. Coordinate actual shared schema/migration/catalog/package/registry overlap with root and the affected owner; routine disjoint allocations remain Wave 5's responsibility. Hermes reviews/accepts; Release owns shared target changes.

## Finite sequence

| Slice | Requirements | Reconcile and finish only the remaining gap |
|---|---|---|
| Read/custody and durable discovery | MM-09/10/11, WS-23/24, MF-14, PF-23 | Received six-format reader/provenance, completed-run access, actual preview owner, durable list/version history. Preserve narrower writer. |
| Upload/access/filing | MM-12/13/14, MF-15, WS-24, PF-23 | Existing storage/extraction/current-access/intent owners, exact approved version and destination receipt. Current MIME/limit/scan policy before exposure. |
| Output/revision/evidence | MB-04, MM-15/16/17/18, WS-22, MF-19 completion links | Immutable parent/source evidence, restart/unknown-output recovery, canonical destinations; current SDK skills/compilers. |
| Starters and additional outputs | PF-03, MM-19 | Separate profile/artifact starter workflows; typed ZIP distinct from general analysis/HTML/code. Only a confirmed supported action. |

Wave 4 defects stay with Fable/root/Hermes. Reuse received MM-08 composition and PR115/197 successors; old reception wording is not another merge instruction. MF-19 here is artifact/completion links, not new mail/context scope.

## Required limits and decisions

Six-format read support is not six writers or proof of native open/render/recalculation. MB-04 is immutable full replacement, not MM-20 WYSIWYG editing. WS-24 share/comment/delete needs an actual approved owner. All existing Research Portfolio requirements including MO-05 belong to Fable's Wave 4 closeout; coordinate shared artifact/module/contract work before edits.

Locate current decisions for supported revisions; upload MIME/size/page/time/scan; whitepaper entry and old report history; HTML/code semantics; supported list/share/archive/delete. If absent, flag the precise decision and continue other allocated work. Fixtures are not activation authority; do not erase retained requirements.

## Evidence and done

Use meaningful affected tests and Hermes targeted native/visual acceptance. Reuse retained narrow DOCX/workbook/deck proof within its limits. No repeated benchmark corpus or second output platform; changed renderers/compilers need relevant real bytes and all pages/slides of changed outputs.

Ready PRs report base/head/tree/files, behavior, required deletion search, tests run/not run, inherited failures, Hermes verdict, dependencies and remaining deployment/acceptance. No self-certification or shared target mutation.


## Current ownership and delivery rules

**Wave 5 source-work authority:** the user has asked to start Wave 5. After reconciling current code, evidence and dependencies, the Wave 5 orchestrator may itself assign finite M5/M7 slices and implement confirmed remaining requirements within these briefs. Record the exact base, owned checkout/files, author and affected checks; routine allocations do not need root approval. Coordinate actual shared-file, contract, resource or target overlap with root and the affected owner. Raise only genuinely missing product/scope decisions, and continue other independent work. A5 remains intake-only; all existing Research Portfolio requirements remain Fable's Wave 4 assignment.

**Direct user scope update:** the instruction to finish **all existing Research Portfolio requirements, including MO-05**, supersedes the earlier broader-module deferral. Fable owns that complete existing-spec implementation and bug-fix scope within Wave 4 closeout; see [Research Portfolio requirements](RESEARCH-PORTFOLIO-REQUIREMENTS.md). Root coordinates independent review, merge and deployment, followed by Hermes acceptance. This is not a Wave 5 Research Portfolio assignment. Do not create duplicate module authors; coordinate any shared module, skill, public-contract, catalog, schema or file overlap with root and Fable before edits. The Wave 5 orchestrator may allocate generic M5 artifact and M7 skill work independently within these briefs, coordinating actual overlap with Fable's Research Portfolio ownership. Q07 semantic remains skipped, outreach remains separate and onboarding remains excluded.

**Current direct-user instructions override historical roles:** the Wave 5 Codex orchestrator assigns and coordinates confirmed M5/M7 source work autonomously within these briefs. Fable scans and fixes remaining Wave 4 defects, completes all existing Research Portfolio requirements including MO-05, and returns PRs to the existing Wave 4 root. Root coordinates independent review, merges and ships through the designated release owner. **After deployment Hermes Agent app/CLI performs acceptance as usual.** Hermes remains the independent review and acceptance owner; Fable is not the formal acceptance owner. Root will notify Wave 5 when Wave 4 is actually complete after required Hermes acceptance, not at PR handoff or deployment.

Do not inherit old Fable/dot relay rules, an old prohibition on Fable participating, historical model settings, per-run Fargate, source-only holds or recurring issue watchers. Use the new session's configured default model. No public issue #202 post or external message is authorized by this document.

Reuse the existing owner and unchanged evidence. Check the affected real path early, make the smallest coherent change, run meaningful affected tests, obtain independent exact-head review, and build each candidate once when release needs it. Do not add a framework, generic abstraction, benchmark campaign, broad census or speculative capability to close a narrow ticket. Report tests run and not run; new executable tests need a meaningful failure witness/mutation where required by the existing process. Docs-only work has no executable tests and mutation N/A.

Wave 4 root/release retains the cloud, database, deploy/rollback and shared authenticated browser lock while Wave 4 closes. An isolated checkout does not isolate ports, Docker, schemas, catalogs, public packages or authentication. One writer per path; reserve shared contracts, migration IDs, lockfiles, architecture registry and build configuration before edits. Do not reset, move or clean another owner's checkout. Preserve WSL Codex-Gates, persistent services/data, caches and authentication. Shared target migrations/deploys are outside implementation briefs.

## Sources

The authoritative sources were read from C:/dev/w4-final-handoff-20261027 at Meri commit 651bdf370d13a715736ea7bce32cdd8f3a4b88d0. That checkout is owned by another lane and must remain untouched.

- [Standing requirements](../20261022/STANDING-REQUIREMENTS.md), particularly necessary qualification, environment retention and direct-user overrides.
- [Process current templates](../20261022/PROCESS.md#6-current-templates); exact source tickets are copied below.
- [Final plan §5 and §6](../20261022/plan/FINAL-PLAN-20261021.md); §5 contains M5, M7 and A5. §6 explicitly calls the dated wave schedule historical sequencing, not a current calendar or source allocation.
- [Supersession register](../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md); full Claude SDK, direct Bedrock, Core gateway and Runtime V1 remain canonical.
- Meri/application master path, section, line and durable source link accompany each original ticket.
- Root's final Wave 4 handoff and current decision log supersede dated operational draft facts. Root owns the current release receipt and Wave 4 ownership; Wave 5 assigns its own finite M5/M7 source slices within these briefs.

The canonical prefix is copied verbatim, including source-relative links. The authoritative standing-requirements link above resolves those source paths.

## Verbatim integrated scenarios

Source: Meri master, Minimum integrated regression scenarios. Select affected proof; this does not require repeating unchanged evidence or every negative case live.

| ID | Scenario | Required observation |
|---|---|---|
| E26 | Attachment upload/read/file | Bytes/hash/MIME/size/scan/current custody tied to exact actor/client; rejected file never appears usable |
| E27 | Artifact generation and publication | Valid content+version+hash+evidence; publish once; current Files/chat access |
| E28 | Six-format inspect/download | DOCX/TXT/XLSX/PPTX/PDF/ZIP exact receiver/MIME; invalid/expired/foreign references refuse |
| E29 | Preview/export/native open | Real renderer/native-reader opens promised format; formulas/layout/citations correct; ZIP not disguised preview |
| E30 | Selected research output restart/lost ack | Durable prepare/completion recover without duplicate file/effect; unpublished state not labelled completed |
| E31 | Research citation contradiction/injection | Current cited evidence supports claim; source text cannot authorize tools/effects or fabricate citations |
| E45 | Canonical cross-module handoff | Portfolio/Workspace/Settings context preserved with entity IDs; effect appears in receiving module after reload |

## Verbatim source tickets

The bodies preserve historical evidence. They are requirements and provenance, not current-head assertions. Apply scope limits and the supersession register first; never recreate retired mechanisms or re-merge old donors.

Source: [MM-09](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mm-09), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3746.

#### MM-09 — Receive six-format read contracts without widening the writer (P1; WS-23 canonical)

Evidence: [M197 document-access README L1–26](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/packages/contracts/document-access-application/README.md#L1-L26), [M197 format admission L8–20](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/control/document-application/format-admission.mjs#L8-L20).

Work: WS-23 receives matching generated B2 blobs from M197 and F115, checks exact metadata/source hash provenance, and retains frozen create/revise contract. Meri consumer must choose descriptor from the retained version, not browser operation/MIME claims. Distinguish read support (all six) from create/revise control support and PDF renderer admission. Fix public provenance checks at integrated head before publishing a contract; historical PR192 is donor lineage, not another branch to merge.

Acceptance: DOCX/TXT/XLSX/PPTX/PDF/ZIP inspect then download, wrong format/session/client/version/hash/size/MIME/filename denied; download object must come from successful inspect module provenance. nativeOpened/rendered/recalculated remain false unless a separately reviewed future contract genuinely changes them. draft/pending is not preview availability. No PDF/PPTX writer UI enabled merely by importing B2. Dependencies: MM-08/10/11 and exact frontend receiver.

Source: [MM-10](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mm-10), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3755.

#### MM-10 — Connect qualified PDF conversion and preview custody end to end (P0/P1)

Evidence: [runtime composer M L25–45](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/artifacts/composition.mjs#L25-L45), [preview owner M L1–79](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/artifacts/preview/service.mjs#L1-L79), [renderer qualification M L36–94](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/artifacts/renderer-qualification.mjs#L36-L94).

Root cause: Preview and renderer owners are implemented, but production documentsFamily does not supply the qualified renderer/PDF admission/preview-custody composition. Current six-format public package has no preview routes.

Work: Existing artifact/isolated-host owners bind actual qualified renderer port, preview record/custody store and explicit PDF admission to runtime options. Parent host owner proves same-image non-root/no-network/RO-root/no-new-privileges/cap-drop/private-workspace/resource-limit/no-credentials observations. Publish a bounded preview request/response contract and separate publish(write)/read actions. Preserve durable preview claims, exact-object versions, source digest and lost-ack recovery; don't change immutable ArtifactVersion.previewStatus to fake readiness.

Tests: DOCX/XLSX/PPTX conversion and PDF self-preview; TXT/ZIP unsupported; renderer absent/failed; all-page byte/render verification; duplicate/unknown claim never redispatches; source suppression/revocation before render/commit/release; restore/orphan preview recovery. Dependencies: MM-08/09, WS-24, shared host/image/migrations. Merely installing LibreOffice or toggling PDF is insufficient.

Source: [MM-11](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mm-11), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3766.

#### MM-11 — Add durable artifact discovery, history and post-run read authority (P1; WS-24 canonical)

Evidence: [run options M L9–28, L89–118](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/artifacts/run-options.mjs#L9-L28), [registry M L88–103](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/prepared-run-registry.mjs#L88-L103), [immutable storage M L16–20](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/artifacts/storage/README.md#L16-L20).

Root cause: Version records persist, but no public list/full-history surface exists; ordinary document options rely on a live in-process run tuple released on retirement. Event/local recent versions are not a library or permanent read authority.

Work: Extend existing artifact owner with bounded owner/client/conversation list, detail, immutable version chain, cursor and exact-current-access DTOs. Define fresh read-only admission for a completed run's artifact or rehydrate the existing qualified read owner without reviving write allocation/old credential. Support reload/deep link/renamed title/retained original provenance. Explicitly define whether archive/delete/share/comments are supported; recipients, role/version visibility, revocation and audit receipts require a real contract. Same-actor authenticated download links are not share links. Reuse Portfolio filing links, not a second Files store.

Acceptance: More than ten versions; restart/terminal origin; no read budget reservation; hidden revoked/suppressed artifacts vanish from list and fail direct known-ID access; old scope facts never authorize; tampered cursor; independent current reader cannot rewrite original provenance. Dependencies: MM-07–10/14, UI consumer and WS-24.

Source: [MM-12](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mm-12), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3777.

#### MM-12 — Establish greenfield upload, extraction and evidence custody (P1/P0 before exposure)

Evidence: [retention uploads owner M L29–32](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/retention/data-classes.mjs#L29-L32), [Core legacy upload C L939–961](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri.controller.ts#L939-L961), [accepted upload isolation M deployment L99–102](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/docs/plans/MERI-DEPLOYMENT.md#L99-L102).

Root cause: Greenfield upload class exists with owner:null; Core's existing attachment endpoint/text resolution is neither a scoped Meri object reference nor a safe greenfield ingestion receipt.

Work: WS-24's owner defines initiate/complete/status/read/remove contract; server owns tenant/actor/conversation/client and exact object version/hash. Add bounded size/MIME/magic validation, quarantine/scanning policy, extraction states and byte/format/page provenance. Feed only authorized extracted data into SDK Read and source evidence after durable receipt. Keep uploaded .claude/settings/plugins/instructions inert data, never runtime discovery. Register raw and extracted derivatives in existing retention inventory, finalization replay and cleanup; no browser-provided grants or trusted URLs.

Tests: Interrupted/multipart/duplicate completion; mismatched hash/type/size; unsupported/encrypted/corrupt files; zip bombs/macros/external links; scan failure; extraction timeout/partial OCR; permission revoked mid-upload; cross-thread reference; exact raw+derived deletion and restore. Dependency: authoritative storage policy and native extraction sandbox. The original plan requires adopted pypdf/native Office reads and Tesseract scanned-image OCR where required, with file/page/time bounds, OCR uncertainty and source-scoped citations; do not silently treat a scan as empty text. Product must fix supported MIME/limits, not erase the OCR requirement or infer the new contract from the old 10MB route.

Source: [MM-13](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mm-13), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3788.

#### MM-13 — Receive prior-chat attachment reads through canonical delegated authority (P1)
> **[RE-SCOPED 2026-10-23]** Attachment reads stay scoped to the current actor, client and permissions. Core decides on each tool call; there is no authority-receipt layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

Evidence: [Core strict attachment envelope C L58–92](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-chat-attachment-transport.ts#L58-L92), [Core source entry C L685–719](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri.controller.ts#L685-L719), [read owner C](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-chat-attachment-read.service.ts).

Root cause: Existing Core current-turn owner enforces conversation/user/client and source provenance; read_chat_attachments lacks a greenfield selected family and modern Core delegated-read allowlist path (cross-checked with tools audit). A native bearer + free JSON is not a substitute.

Work: Add one fixed adapter and action-specific Core delegated receiver using the existing signed target/body/current-task authority conventions. Receive the exact trusted currentTurn envelope server-side, normalizing returned attachment/content-state coverage and evidence. Preserve source attachment versus Meri artifact namespaces. Scope reads to currently accessible material, including source-client rechecks and unavailable extracted content. Use modern delegated claims; never copy the service secret or browser bearer into worker inputs.

Tests: Wrong conversation/owner/selected client, stale source after prior upload, reused credential or changed request bytes, partial/failed extraction, revoked filed attachment, large bodies/pagination, forged text/provenance, no model-supplied currentTurn. Dependencies: MM-12 when new uploads are supported, tools source/registry owner, Core receiver contract. Do not call this wired because the old Core route is mounted.

Source: [MM-14](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mm-14), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3800.

#### MM-14 — Complete exact-version attachment filing, not an alternate uploader (P1)

Evidence: [M filing resolver L1–50](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/artifacts/filing.mjs#L1-L50), [M197 filing preparation L18–82](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/control/intents/attachment-filing-preparation.mjs#L18-L82), [M197 services L1–29](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/control/intents/attachment-filing-services.mjs#L1-L29).

Root cause: Artifact resolver and prepare-only proposal exist; genuine current destination identity, source attachment-registration broker, action-specific native approval/execution reception and durable filed receipt remain required.

Work: Bind the existing immutable object/version lookup, canonical download and destination policy into the one command path. Core's owner registers exactly those bytes and returns attachmentId/hash/size/expiry; after approval/execution recheck source and destination, then record exact filed destination/attachment/version receipt and UI link. Preserve original source scopes rather than rewriting them to destination. Define recovery for partial registration/file outcome and orphan cleanup; no blind re-upload/re-file. A prepared proposal is not a saved file.

Tests: Foreign object, wrong version/digest/size, stale destination, suppression during registration, duplicate request and reused approval, first registration success/second fail, lost registration/file ACK and post-effect revocation. UNKNOWN remains UNKNOWN until exact readback. Dependencies: MM-08/11/12 as needed, shared command/Core receipt owner, WS-24/PF-23. Keep save_chat_attachments unavailable until qualified.

Source: [MM-15](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mm-15), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3811.

#### MM-15 — Finish research output approval, durable completion and history (P1)

Evidence: [selected runtime M README L5–17](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/selected/README.md#L5-L17), [worker output M L10–34](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/skills/output.mjs#L10-L34), [selected retention M L12–32, L51–99](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/conversations/skills/retention.mjs#L12-L32).

Root cause: Real compilers/journals exist, but preparation/completion handles in selected/control are process-local; restart/lost prepare or finish ACK fails closed. Durable output exists only after publication. Retained recipe supports only relationship_brief and commitments_audit, and worker output is DOCX-only.

Work: With runtime continuity and generic selected-skill owners, persist the minimum immutable completion/preparation/receipt identity in the existing journal before success release; recover exact compiler identity from retained authorized reads, not rerun unknown reads/model work. Wire current native installation/task/admission and publication owners. Keep explicit awaiting-output-approval and separate approved output run/grant/source-access bridge; record pending, approved, generating, published/held/unknown artifact states in history/UI. Extend recipe support only per accepted installed skill, with exact schema/provenance, not a generic brand bypass.

Acceptance: Close/reload/restart between prepare/read/finish/publish/approval; duplicate ACK; expired original read grant with fresh authorized output; source revocation; rejected/expired approval; exact original and revised DOCX/hash; no artifact ID while pending; no implicit task creation from commitments. Dependencies: MM-08–11/17/18, generic skills and continuity tickets.

Source: [MM-16](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mm-16), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3822.

#### MM-16 — Admit congressional and report deliverables as actual workflows (P1/P2)

Evidence: [congressional recipe M L1–16](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/document-application/research-brief/README.md#L1-L16), [Core report export C L928–954](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-research.service.ts#L928-L954), [Core job deliverable routes C L19–55](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-job-deliverables.controller.ts#L19-L55).

Root cause: Private congressional compiler produces real editable DOCX and exact citations but explicitly cannot claim installed manifest/runtime qualification. Generic Word does not establish a named whitepaper research workflow. Core legacy job reports/export/file routes use different session/artifact authority.

Work: Choose the accepted original recipe/entry for congressional brief, long-form report/whitepaper and each task deliverable; publish only that bounded selection/input/output/evidence contract. Bind current source adapters, complete evidence and canonical selected output/approval/history. Preserve Congress/session/bill version/FY/asOf and funding-stage distinctions. If legacy reports must remain accessible, build a read-only current-authority bridge with explicit source identity/held-report rules, never a second model loop or a silent legacy activation.

Acceptance: Exact UTF-16 excerpts/UTF-8 hash, renamed/latest bill ambiguity, FY/stage mismatch, stale/asOf rollback, conflicting passage disclosure, missing/partial/denied corpus, revision parent and source revocation at export/file. Unknown: desired whitepaper entry/template and which old job history is in migration scope. An explicit held decision remains open, not falsely completed. Dependencies: MM-15/17/18 and tools source coverage.

Source: [MM-17](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mm-17), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3833.

#### MM-17 — Preserve source evidence through generated artifact and later access (P0/P1 integrity)

Evidence: [generic run options M L15–23, L112–118](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/artifacts/run-options.mjs#L15-L23), [selected retention M L14–36, L64–99](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/conversations/skills/retention.mjs#L14-L36), [selected output responsibility M L5–18](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/document-application/selected-output/IMPLEMENTATION.md#L5-L18).

Root cause: Source-aware compiler paths retain exact evidence, but generic document runOptions intentionally supplies evidence/assets empty. Model-written citations or an empty evidence array must not masquerade as a verified research deliverable.

Work: Define per-output distinction among user text, model-authored uncited prose and source-backed report. Feed source-backed products only through existing authorized compiler/source receipt owners with exact source IDs/versions/text ranges/read hashes, coverage/freshness and immutable preparation pins. Preserve those facts through artifact spec/version, output approval, revision, public citation projection and filing. Recheck current source access for protected reads; show withheld provenance without leaking private snippets when access is removed. No arbitrary URL or browser JSON becomes authority.

Tests: Wrong source/record/text/hash, stale source access, missing full text, misleading complete-negative result, duplicate citation, user-edit versus source-derived text, parent revision provenance, suppressed source on later inspect/download/file. Dependency: MM-15/16, canonical read/evidence and UI source panel. Do not fabricate sources to fill generic document evidence.

Source: [MM-18](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mm-18), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3844.

#### MM-18 — Qualify native output quality separately from structural inspection (P1 release gate)

Evidence: [public read semantics M197 L15–19](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/packages/contracts/document-access-application/README.md#L15-L19), [native checks M L1–10, L44–71](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/artifacts/native/checks.mjs#L1-L10), [accepted quality M L409–415, L451–453](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/docs/plans/MERI-DEPLOYMENT.md#L409-L415).

Work: Keep the adopted python-docx/XlsxWriter/openpyxl/PptxGenJS/LibreOffice stack. Qualify exact native image/tool/library/font/corpus pins and real bytes, not only JSON containers. Test DOCX paragraphs/tables/headers/sections, XLSX formulas/charts/reference totals/caches, PPTX every slide/text/image layout, PDF every page/source DOCX lineage and ZIP data/chart correctness. Retain original and revised bytes before rendering; inspect every page/slide for clipping/corruption and compare immutable parent. Preserve unsupported feature refusals; LibreOffice recalc is not universal Excel equivalence.

Acceptance: 100% benchmark native files open, formulas/reference totals correct for declared support, no critical clipping/corruption, accepted human rubric and preserved originals; native flags remain truthful. Failure/skip receipts stay visible; PR197's Windows and provenance failures need integrated follow-up, not a blanket green claim. Dependencies: MM-08–10 and shared native host qualification. Tests are to run only under later implementation/qualification authorization.

Source: [MM-19](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mm-19), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:3853.

#### MM-19 — Bound general analysis, HTML and code output contracts (P1/P2)

Evidence: [M197 document admission L8–17](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/control/document-application/format-admission.mjs#L8-L17), [sandbox boundary M L4–29](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/artifacts/sandbox-analysis.mjs#L4-L29), [accepted native output scope M L24–31](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/docs/CAPABILITY-SCOPE.md#L24-L31).

Root cause: Typed table ZIP is available in M197 source, but it is not arbitrary code execution. General sandbox returns inspectionStatus/publicationStatus pending and requires exact native image/manifest/receipt/current verifier. Canonical document application admits no HTML/code artifact format.

Work: Receive typed ZIP independently. For general analysis use the approved isolated native owner, exact program/input object references, output allowlist and bounded resource/current authority, then inspect and publish outputs through existing immutable custody. Decide safe HTML/code MIME/render/sandbox/download semantics and add only approved artifact schema/receiver extensions; no generic eval or executable web preview. If held for first release, retain explicit backlog/unsupported states rather than counting ZIP as completion.

Tests: Program/input scope/hash tamper, image/manifest mismatch, unexpected output name/type, oversize/missing/duplicate outputs, cancellation/process absence, external network/credentials denial, deterministic receipt and unknown replay. HTML script/network/navigation isolation and code displayed as data must be qualified if accepted. Dependencies: shared native sandbox ticket, MM-10–12/18 and public contract owner.

Source: [MB-04](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mb-04), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:1141.

#### MB-04 · Complete natural-language revision of a selected immutable artifact version (P1 required v1)

**Requirement/evidence.** P17 M6 L344–352 and original Greenfield L159 require agent-driven revision preserving the original, separate from Office WYSIWYG. Existing [typed revise route and immutable full replacement](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/document-application/README.md#L16-L32) are real. But M197 [document intent preparer](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/control/intents/document-preparer.mjs#L14-L30) fixes baseVersionId:null, and [runtime intent adapter](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/runtime/artifacts/intent-preparers.mjs#L71-L88) routes to create. This is a missing conversational revision bridge, not a missing version store.

**Bounded implementation.** Extend existing typed document intent and trusted runtime adapter with an explicit revision subject: selected immutable artifact/version, original source/spec hashes, current permitted reader/writer and exact requested change. Resolve/read original bytes/spec through canonical current-access owners; never let a model/browser supply authority or reinterpret an arbitrary filename as selection. Use the same SDK query to produce the supported full replacement request, then invoke existing /api/documents/revise with exact baseVersionId and stable delivery identity. Preserve original bytes, original/revised source provenance, parent/CAS and current scope. Distinguish human instruction/user-authored content from source-backed compiler assertions. Publish new receipt/version into conversation/history/UI; allow preview/inspect/download/version switch after refresh. On stale head, surface conflict and require explicit new base selection, never silently overwrite/rebase.

**Files/owners.** Existing control/intents/document-preparer and runtime/artifacts/intent-preparers; existing public intent/document contracts and selected-version UI request builder; document-application/revise route and artifact storage remain canonical. Reuse MM-08/11/17/18 and WS-24, not MM-20 editor integration or a new document generator. Core filing remains a separate approved MM-14 action.

**Acceptance/tests.** Select older/newest version, wrong tenant/client/format, suppressed original, concurrent revisions, lost receipt after successful write, retry same delivery, revision cancellation, original bytes unchanged, exact-parent identity, unsupported workbook feature refusal, current-source revocation and all-page/slide/native quality. Reload must show the exact new version once; unknown write must reconcile without regeneration. User can request another change from the resulting version. No original version is destroyed and no revised file is auto-filed/shared.

**Dependencies/unknowns.** MM-08–11/15/17/18; MF-14/16; MT governed intent owner; public schema compatibility. Product decides supported revisions per format without lowering preservation/fidelity. Initial full typed replacement is valid; manual Office editing remains later MM-20.

Source: [MF-14](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mf-14), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2395.

#### MF-14 — Finish artifact library/detail consumers under WS-23/24 (P1)

- **Root cause / evidence:** Live artifact inspector is not file library: known-version input, event-derived versions and last10 local views; rich editor/previews/history/share remain fixtures. Merged PR115 adds all-format read receiver only; this reception is complete on current main.
- **Bounded files/owner:** Canonical WS-23/24 files plus `ConversationArtifacts.tsx`, `files/DocumentVersionPanel.tsx`, `MeriFilesWorkflow.tsx`, new read-only file detail/library views and route helpers. MM owns backend render/custody contracts.
- **Implementation:** Do not reimplement merged PR115 document-access0.1.0; qualify the received reader, then build authorized durable list/version index and deep links with typed source/provenance/status. Render only supported safe preview results; preserve signed-link redemption/hash validation, revoke object URLs and clear bytes on lifetime change. Add compare/revision/history UI only with exact-version contract. Keep edit/share/comments/rename/delete disabled until canonical owners provide semantics; do not fake save via local state.
- **Dependencies / exclusions:** WS-23 received-reader qualification, WS-24 file workspace, MM renderer/PDF/PPTX/ZIP/filing custody, MR writer authority. This ticket is consumer slice, not new duplicate file service.
- **Acceptance:** All six formats correctly discriminate supported preview/download/unsupported; exact bytes/hash checked; link expiry/revocation/cross-client substitution fail closed. Reload/another tab sees durable versions, not local10 list; missing renderer never claims native preview or successful edit.

Source: [MF-15](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mf-15), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2404.

#### MF-15 — Wire attachments and governed filing only after custody contract (P1 if composer attachments promised)

- **Root cause / evidence:** Text composer explicitly has maxFiles0 and disabled attach. Upload/extraction/Capiro picker/filing approval screens are fixtures.
- **Bounded files/owner:** `MeriComposer.tsx`, new `conversation/attachments/*`, existing file picker/extraction/filing views adapted narrowly; fixed proxy routes after contract publication.
- **Implementation:** Implement real upload selection and bounded transport only through MM owner: size/MIME/signature limits, scan/extraction status, signed scoped attachment reference, admission to exact conversation input, cancellation semantics, duplicates/expiry and retry/reconcile. Capiro files must come from authorized canonical selector. Filing must create reviewed intent and consume receipt, never copy between clients on local click. Preserve text draft if upload fails.
- **Dependencies / exclusions:** MM upload/read_chat_attachments/filing custody, WS-24; public input schema must admit refs. No base64 prompt workaround or arbitrary URL fetch.
- **Acceptance:** Partial/oversized/unsafe/expired/cross-tenant file rejected; reload restores only durable admissible uploads; submit cannot attach pending/foreign refs; remove/cancel has defined durability; filing awaits proper approval and receipt links canonical file.

Source: [MF-19](../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#mf-19), docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md:2440.

#### MF-19 — Unify cross-module context and completion links (P1/P2, shared contract)

- **Root cause / evidence:** Client-scoped home links exist but PF Ask/Create and Workspace/Mail object handoffs require richer canonical context; action outcomes do not uniformly link canonical records.
- **Bounded files/owner:** One canonical context DTO/route helper owned with PF-02/03, WS-22–24, ST-28 and ML-06; Meri entry parser, composer starter and receipt link components.
- **Implementation:** Carry only canonical IDs and user-approved draft/context through links or validated bootstrap; re-read source under current identity, show selected client/object/evidence and permit explicit scope correction. Preserve exact mail sender/thread/connection via ML contract, not a freeform prompt. Link completed task/file/research results to original canonical object. Back/forward/client switch must retire stale pending context and not resubmit.
- **Dependencies / exclusions:** PF-02/03, WS22–24/tasks, ST-28, ML05/06 and relevant MM/MT contracts. Do not duplicate those projects or embed sensitive source text in URLs.
- **Acceptance:** Portfolio client→Meri→task/file→canonical detail roundtrip survives reload; invalid/foreign/stale IDs fail closed; mail actions retain exact reviewed connection/thread; new client selection cannot dispatch prior client proposal; no auto-send merely by opening a deep link.

Source: [PF-03](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#pf-03), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:499.

#### PF-03 · P1/P2 · “Create with Meri” profile and Files starters are not implemented

**Evidence:** [CreateProfileDialog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/CreateProfileDialog.tsx#L139); [FilesPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/FilesPage.tsx#L127).

**Root cause:** Generic Meri presence does not define a safe profile-creation proposal or a generated client-bound artifact.

**Bounded work:** Allocate two bounded workflows, not one broad enable flag: (a) draft-only profile proposal with schema, provenance, duplicate/capacity preflight and explicit user apply into existing intake service; (b) client-bound Workspace/artifact starter returning an immutable saved draft/revision and current access metadata, then an explicitly reviewed attach/save to Files. Reuse ordinary profile and document persistence owners. Keep generation separate from client creation, attachment sharing and mail sending. Add retained request IDs, terminal result/unknown states and cancellation receipts.

**Dependencies:** PF-02 context; Workspace canonical client binding PF-09; runtime artifact contract PF-23; billing capacity owner. A generic chat link is not closure.

**Acceptance:** Declined/cancelled generation has no client/file side effect; duplicate submit produces one proposal; changed schema/capacity/client denies apply; file is correctly typed, client-scoped and readable after reload; all unsupported formats and missing capabilities remain explicit.

Source: [PF-23](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#pf-23), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:763.

#### PF-23 · P1 cross-owner / open PR · Meri-generated document access is not equivalent to Portfolio Files access

**Evidence:** PR115 contains a six-format Meri document-access consumer at its actual head, while Files has independent attachment preview/navigation. See [navigation.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/navigation.ts), [FilePreview.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/FilePreview.tsx), [PR115](https://github.com/neo-capiro/capiro-frontend/pull/115).

**Root cause:** A runtime artifact receipt, a saved Workspace revision and an Engagement attachment are distinct identities/permission authorities. Current main versus PR115 source reception and live runtime qualification must not be collapsed.

**Bounded work:** Workspace/Meri owner reconciles the exact public runtime document-access contract and PR115 source adoption. Portfolio consumer receives typed current artifact/attachment mapping only through the owning bridge; supports allowed MIME/format, current authorization, download/preview semantics and source version. No raw storage-key construction or generic URL pass-through.

**Acceptance:** Six-format contract tests plus native authenticated access, changed artifact version/permissions, expired link and content disposition; Files source must not be confused with a generated artifact. Native rendering and deployed API acceptance remain unverified. Canonical implementation belongs to Workspace/Meri workstream.

Source: [WS-22](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#ws-22), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:1742.

#### WS-22 — General document generation and agent consumers, with correct owner (P1 missing consumer / intentional AI hold)

**Evidence/root cause:** [Document-agent][ws-agent] has catalog/recommend, initialize/state/messages, brief edit/synthesize/approve/reopen, context recommend/analyze/resolve/approve, outline generate/edit/revise/approve, proposal accept/reject, generation status/retry/cancel and quality/fix routes. [Two-step intake][ws-intake] already aggregates authorized source IDs into an idempotent durable run. The new general Workspace screen does not consume these; legacy generation/refinement is not automatically the greenfield Meri contract.

**Bounded work:** Choose and document the existing approved execution owner for each advertised action before adding operations. For Workspace-owned intake/manual phases, reuse current state-machine/revision and run-worker APIs with typed controls and exact request recovery. For greenfield Meri actions, publish/adopt only supported public contracts; do not import private runtime types or turn on old provider handlers to make the button look wired. Add only the missing feature panels and state transitions, not a parallel agent platform. Respect capability flag and explicit paid-generation intent.

**Acceptance:** Capability off, missing credentials, wrong source IDs/current scope, duplicate intake key/payload mismatch, brief/context/outline approval pins, stale proposal, source revoked between plan/run, cancel/retry preserving successful units, unknown provider outcome and no execution merely by reading the editor. Review quality route ACL before exposing it: controller passes tenant/draft without actor to evaluator.

Source: [WS-23](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#ws-23), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:1752.

#### WS-23 — Receive current all-format artifact access correctly (P1, open-PR supplemental)

**Evidence/root cause:** Main [artifact access][ws-meri-access]/[transport][ws-meri-transport] consumes frozen document-application read shapes for docx/txt/xlsx. Actual PR115 head switches inspect/download to public document-access-application 0.1.0 (donor provenance Meri PR192, already received by current Meri PR197 at `cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a`) and supports docx/txt/xlsx/pptx/pdf/zip. Writer remains the narrower contract.

**Bounded work:** Review/receive the existing coordinated frontend PR115 and Meri PR197 changes after current-head checks and public-contract acceptance; do not reimplement the adapter, merge historical donor94, or separately merge donor192. Pin the generated public artifact provenance/hash/version, verify byte equivalence at the chosen PR197 receiver, and qualify that receiver’s actual runtime mounting/configuration against the matching read application. Keep create/revise on the existing write contract and preserve unknown/runtime-held states. Inspect/download is not native rendered preview or successful creation qualification.

**Acceptance:** All six formats, old3 compatibility, wrong version/client/session, bad SHA/size/MIME, expired link, unavailable nativeOpen/render/recalc flags remain unavailable, and no new write operations enabled. Check PR head changed files, not stale body prose. Production remains unqualified until separately evidenced.

Source: [WS-24](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#ws-24), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:1762.

#### WS-24 — Meri file workspace/upload/preview/history consumer boundary (P1 missing consumers; intentional holds)

**Evidence/root cause:** [Meri Files][ws-meri-files] creates/revises typed documents, shows recent local versions or a known ID, and verifies inspect/download; no published workspace-wide artifact list, upload/extraction, file-to-client, share or full history consumer. [Preview implementation][ws-meri-preview-owner]/[runtime][ws-meri-runtime] already supports publish/read via qualified renderer/custody with session/retention checks. Those private/opt-in owners are not automatically a public frontend contract. Fixture save/share/comment sheets are not production handlers.

**Bounded work:** Inventory current public contract gaps per action; extend the Meri public application surface only for list/history/preview/upload/file/share actually approved for product. Reuse immutable artifact storage, retention, signed downloads, existing preview renderer/custody and exact-parent revisions. Expose explicit preview publication (a write) separately from read. Upload/extraction requires scoped storage/object ownership, allowlisted MIME/limits, scanning/extraction receipt and provenance before use as evidence. No browser-supplied tenant grants or fake conversion. Graduate fixture controls only after these contracts; otherwise keep clearly unavailable.

**Acceptance:** Retention suppressed/revoked artifacts disappear from list and fail direct history/preview/download; preview source digest matches exact version; renderer unavailable/unsupported TXT honest; read never reserves generation budget; upload cannot cross client or become trusted model instruction; no local dialog suggests durable save/share. Broader PDF/PPTX generation requires its own qualified owner, not merely a read-format expansion.

### Source reference definitions

[ws-agent]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/document-agent/document-agent.controller.ts
[ws-intake]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/quick-draft/two-step-draft.controller.ts
[ws-meri-access]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/meri-documents/artifact-access.ts
[ws-meri-transport]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/meri-documents/workflow-transport.ts
[ws-meri-files]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/meri/files/MeriFilesWorkflow.tsx
[ws-meri-preview-owner]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/control/document-application/preview-route.mjs
[ws-meri-runtime]: https://github.com/neo-capiro/meri-greenfield/blob/3c56c3e981ba868a2af103c4cae9f65a0d47458d/apps/runtime/artifacts/composition.mjs

#### Additional mandatory MT-13/MM-15 acceptance from the original plan

Commitments & Deliverables keeps commitments_audit, requiresClient:true, readOnly:true and general/client scopes; even a general launch requires a selected client. Audit authorized mail/meetings/transcripts/debriefs/tasks/actions/documents/Monday with real continuation and older promises. Deduplicate promises versus decisions/questions/proposals, retain linked record IDs, evidenced owner/due date or unknown, dependencies and acceptance evidence. Exactly completed, in progress, or no record of action are audit statuses; native task status is separate. Completion needs delivery/acceptance evidence. Monday coverage is exactly checked, disconnected, unavailable, or not mapped, with partial pages explicit. No unread page proves absence. Audit performs zero task/message/memory mutations; a later requested action uses its own immutable approved operation and observed receipt. Preserve CD-01–CD-07 semantics through focused fixtures, not seven automatic paid runs. All14 launchers retain exact client/scope metadata from Remaining Plan L172–195 and every selected procedure/version is traced.
