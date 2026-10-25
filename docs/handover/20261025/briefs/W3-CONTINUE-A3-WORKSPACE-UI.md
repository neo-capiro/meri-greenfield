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

FROM: Root | TO: fresh Hermes A3 Workspace UI author | TYPE: brief | RE: WS-07 saved-version read-only detail and compare

# A3 Workspace UI continuation: saved history

**READY for the bounded independent source assignment.** Source/default/PR metadata refreshed 2026-10-25 15:32–15:36 UTC. Repository `neo-capiro/capiro-frontend`, fresh exact base **`6ea4af20ac539c6da7f31ed657754ca530143f99`**, tree `c0ea185b3d02008638cce9843f9ea558b39a9f16`, accepted PR140 OPEN DRAFT, branch `codex/wave3-a3-workspace-ui-20261025`. Suggested new branch `codex/wave3-ws07-history-continue-20261025`, worktree basename `wave3-ws07-history-continue-20261025`. Stack the new draft on the PR140 source branch. Remote `main` observed `d01ea5544b64008ed0a72ae4e6c5af30d8ba64a1`; it is not this accepted source or the future final integration base.

Read-only Core producer dependency is existing PR127 source `025ae90fc7bf85c91a5f60eaf949cc7effa1d330`; `VersionsService.list` and its authorized snapshot return are unchanged in accepted Domain PR129 `45eaba1b720849e914052fcf3d7003ac73ac27cd`. Reverify this producer method and controller before writing the consumer. Do not adopt PR129's new save/CAS/receipt contracts. Predecessor PR140 navigation/client/document receiver correction is accepted: 59 focused units, two correction mutants plus eight reused prior mutants, and later 5/5 synthetic browser cases at 12:19:44–12:20:16. Older PR prose saying browser NOT RUN is superseded only for those five synthetic cases; full production/deployed acceptance stays open.

## Concrete next work and ownership

Current `WorkspaceDraft.tsx` renders history only as metadata. Existing authenticated `GET /drafts/:draftId/versions` calls `VersionsService.list`, checks current draft role/prospect access and returns saved version rows including immutable snapshot. Frontend `workspace.draft.versions` presently admits only metadata. Extend the existing response schema to the actual bounded snapshot shape and expose read-only saved-version detail and comparison of two exact saved versions. Reuse existing presentation/Modal/StatusPanel; no new editor library is needed for this read-only slice. Never substitute current unsaved editor state for a saved version or treat a version ID as access authority.

Show exact version labels/date/parent identity, safe supported title/section/document content, added/removed/reordered tabs and unknown-content explanation. Preserve unknown JSON without executable rendering or lossy writeback. Malformed or mismatched parent/version receipts refuse display. On access denial, actor/client/resource switch or stale response, clear the affected history detail/compare state; use existing query/session owners and current authorized reads. Navigation may read only. **No restore, save/create/delete, publication, new manual editor or mutation-contract adoption** is allocated. Existing prospect/copy admission and save recovery remain unchanged; copied-Core-brief drafts cannot gain whole-draft restore.

Owned files: ordinary-history portion of `apps/web/src/features/modules/workspace/WorkspaceDraft.tsx`, narrowly named new version-history/view/compare modules beside it, and only needed styling in `workspace.module.css`. Named existing-contract consumer exception: `apps/web/src/shared/capiro/operations/workspace-documents.ts` version response schema and any narrow version-history schema extracted alongside it, using the actual existing producer. Own targeted history unit/browser tests (proposed `apps/web/tests/workspace-version-history.test.tsx` and `apps/web/test/browser/workspace-version-history.spec.ts`, or the established equivalent after discovery). Do not edit `WorkspaceLibrary.tsx`, `workspace-hillday.ts` query filters, Workspace route/navigation behavior, prospect/brief-copy save owners or any citation/Meri conversation files.

This lane remains sole frontend manifest/lockfile/shared-registry/export owner, but this slice expects no dependency change or registry expansion. No install or new library adoption; route any demonstrated shared need to Root before editing. Domain publishes future library query changes independently; you do not consume them here. Citations stays held and needs no shared package change from this assignment.

## Sequence and meaningful planned gates

Inspect current producer snapshots and existing ordinary/prospect/copy test fixtures first. Add validated consumer admission and a read-only detail/compare path, with no write called on open/select/compare. Use producer-shaped synthetic snapshots covering body/config/unknown rich fields, removed/new/reordered tabs, parent/version mismatch, foreign client/denied access, late response after identity/resource change, loading/empty/error/retry and reload. Test the actual mounted component and keyboard interaction rather than only a pure renderer. Mutants that swap saved versions, retain denied data, accept a foreign parent or render raw generated markup must fail intended assertions; restore passing source afterward. Reuse navigation evidence and do not rerun unchanged browser suites without a demonstrated risk.

Planned checks after inspecting actual package scripts: `npm run test --workspace @capiro/web -- <owned-history-test>`, affected web TypeScript, targeted lint/format, `git diff --check`; Root-allocated existing browser harness for keyboard/reload/current-access clearing and accessibility. Inspect installed Next.js docs before app changes. Missing cache exports/tooling are reported with exact failed stage, not repaired. Root gate owner retains unavailable full affected frontend/package build checks; Release owns exact ARM64 image smoke/scan and Acceptance owns real authenticated version read/current denial after final integration. Local fixtures do not establish deployed access. Full WS-07 restore-as-new-version/editor/export acceptance remains open.

## How we work and what this fresh session receives

You are the allocated fresh Hermes author, requested at **xhigh**. Root alone orchestrates and coordinates gates/integration/merges/shipping; a separate visible Codex xhigh reviewer reviews your exact head. Existing Release alone executes AWS/migrations/deploy/rollback. Author publishes a **new draft PR only**, stacked on the exact owned Wave 3 source branch below, and commits AND pushes useful work. Do not modify the accepted predecessor PR or frozen Wave 2 branches. No merge, installation, environment repair, service restart, AWS, provider/model/application action, external send, live DB access or issue #202 post. No recursive delegation. Requesting xhigh does not establish the effective provider reasoning level.

Start from this brief, canonical rules/plans/tickets and referenced accepted evidence only. Read the host `AGENTS.md`, repository/applicable child instructions and implementation standards explicitly; fresh launcher isolation may suppress their automatic injection. Current roles/xhigh/no-install/no-public-post instructions here override historical Ultra/relay/root-AWS/setup instructions. Record a short proportionate outline before substantial code changes; inspect existing owners/callers and adopted libraries first. Keep controllers/routes thin, validate boundary inputs, preserve canonical versioned exports and cohesive modules, and address actual responsibility problems without generic frameworks or cosmetic splitting. Frontend authors must read `apps/web/AGENTS.md`, relevant installed Next.js docs and architecture guidance before writing code. No copied old application implementation.

Use [STANDING-REQUIREMENTS](../../20261022/STANDING-REQUIREMENTS.md), [PROCESS6.1–6.3](../../20261022/PROCESS.md), [WORKFLOW](../../20261022/WORKFLOW.md), [FINAL-PLAN](../../20261022/plan/FINAL-PLAN-20261021.md), [supersession register](../../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), [Meri master](../../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md), [App master](../../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md) and the [dispatch manifest](W3-DISPATCH-MANIFEST.md). The existing [Wave 2 checkpoint](../WAVE-2-HANDOFF.md) is historical at its explicit cutoff and remains IN PROGRESS. This brief supersedes only the old dispatch allocation, not accepted evidence or unfinished full-ticket obligations.

Only direct Neo chat approves scope/security policy changes. In-plan decisions proceed and are logged with Root; GitHub comments never approve scope. Show counts/booleans publicly; never publish secrets, customer-linked IDs, UUIDs, private prompts/content or private evidence bindings, including PR prose. Private evidence locations are named only. Communicate progress/candidate details to Root and the designated separate reviewer through the existing allocation; do not start a second coordination system.

## Shared environment and sequence

Preserve WSL Codex-Gates, shared local app/database services and data, auth/config, all active worktrees/evidence and reusable dependency caches. Existing worktrees include untracked `work/`; they are read-only predecessor references, not clean writable allocations. Before creating a suggested fresh worktree, verify its path/branch are unused, exact base exists and existing worktree ownership/status. Never reset, delete or reuse another writer's checkout. Root/launcher records actual branch/worktree after creation; suggested names below are not claims they exist.

No ports, Docker container, database or heavy gate slot is allocated by this brief. Use already available tooling for narrow synthetic tests; ask Root to schedule any needed isolated PostgreSQL/browser/image resource, then report NOT RUN/BLOCKED until allocated. Do not install or repair missing tooling. The author owns cleanup of only newly allocated task-specific disposable resources, with absolute path/ownership checked before cleanup. Do not prune shared resources. Applied migrations are immutable; no clone/live migration, reset or data drop.

Wave 2 is still in progress. Frozen accepted source candidates: Core PR133 `43fdd8928e517b1ce3a7a039f0fabeb8cf5fc5dd`; frontend PR151 `dc53633f0b8c4de6432f3840e4fc79ac2ffeb02a`; Meri PR252 `7eee7f7c358be9ae903169816ef68eb6e64ae1f3`. These are read-only dependencies, not this branch's base. Core already contains research-wall backport and meeting-cancel/mail-refusal corrections; frontend contains current-access/view-lifetime/connection corrections; Meri contains advancing-clock reads, current tenant/role capability intersection and native-history compatibility/custody corrections. Inspect affected accepted deltas before calling an old-base failure a new defect. Never reimplement or edit those frozen fixes. Root supplied images built/reviewed and AgentCore7 READY/DEFAULT7 while preview6 still serves, final cutover pending; no live readback was performed for these docs.

Independent source work below may proceed. Final shared-contract adoption, successor rebase/integration, deploy and authenticated release-dependent acceptance wait for Root's explicit Wave 2 completion notice and fresh final pins. No invented final Wave 2 base. Re-review only affected final deltas/dependency changes; retain valid unchanged evidence. Core schema/migrations/shared manifests remain solely A3 Domain; frontend manifests/lockfile/registry/shared exports solely A3 Workspace UI. M3 Data is the sole allocated Meri data-contract writer, but this continuation grants no new public DTO/version change without separate review/Root sequencing. Citations owns no Workspace paths and is held. MG-06 persisted-index proposal stays pending/unallocated. No custom authority, cache, profile-pin, replay or qualification framework; no unsupported feature activation.

## Evidence and definition of done

Report repository/branch/base/head/tree and changed files; exact dependency heads; UTC, command, tool version, exit code, PASS/FAIL/NOT RUN and counts/limits. Separate your tests from inspected/reused predecessor evidence. List tests run AND not run, all failures/skips, and one same-environment exact-base comparison for suspected inherited failures. New executable tests need a meaningful product mutant or original counterexample failing for the intended reason, then restored pass; no new tests means explicit N/A, not invented mutation evidence. Reuse unchanged accepted evidence and avoid broad reruns.

Show deletion `git grep`/`rg` proof for replaced identifiers/files/config and active callers; label immutable historical references, explain any test-count decrease, and delete temporary diagnostics. If no replacement occurred, state deletion N/A with reason. Do not manufacture code changes if the selected remaining obligation is already satisfied; return exact existing proof and genuinely missing acceptance.

Send an exact candidate and concise PROCESS6.1 completion to Root and the separate [reviewer](W3-INDEPENDENT-REVIEW.md); author does not self-approve. The reviewer returns PROCESS6.2 ACCEPT/CHANGES at exact head/base, numbered findings and reviewer-run versus reused gates. Named unrun build/type/PostgreSQL/browser/image/deployed gates remain with Root's allocated gate/Release/Acceptance owners. PROCESS6.3 later requires deployed source/image/revisions/config-binding booleans/DB ledger/snapshot names, UTC, scenario results/limits and rollback owner; source tests do not fill those live fields. Close only your bounded source obligation; full tickets and live acceptance remain open until actually met.

## Verbatim retained ticket

The whole ticket stays binding; only the continuation slice above is assigned now. Historical evidence is not a new defect proof. The register disposition below was checked individually.

**Register decision for WS-07:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-07 — Ordinary document lifecycle, content editing and version use (P1)

**Evidence/root cause:** [Draft editor][ws-draft] exposes title, known sectionContent, save and metadata-only history; arbitrary WsDocument blocks without section names render read-only. Rich formatting/preview/export exists only on prospect branch. [Documents][ws-document-service], [Versions][ws-version-service] and [ExportController][ws-exports] already own much of the missing capability. Backend restore skips removed documents and leaves extra current documents, so it is not an exact whole-draft restore despite earlier “lossless” wording.

**Bounded work:** Add ordinary manual create, safe section/tab create/rename/reorder/remove, section formatting/preview reuse, saved PDF/DOCX export with explicit all/main/tab choice, document status and recoverable delete where product semantics allow. Add version detail and compare using exact saved snapshots, then a clearly defined restore-as-new-version transaction with CAS. Preserve unsupported block JSON without lossy round-trip; show read-only reason until a typed editor exists. Do not enable whole-draft restore on a copied-Core-brief draft.

**Acceptance:** Imported source draft with block bodies, unknown rich fields, formatted/plain content, tab add/delete/reorder, malformed/oversized content, version detail authorization, restore with deleted/new tabs and ordinal changes, export saved vs unsaved warning. No data deletion hidden inside editor hydration.

---

## Matching E-scenarios, verbatim

| ID | Scenario | Expected result |
|---|---|---|
| E45 | Canonical cross-module handoff | Portfolio/Workspace/Settings context preserved with entity IDs; effect appears in receiving module after reload |

[ws-draft]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceDraft.tsx
[ws-document-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/documents/documents.service.ts
[ws-version-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/versions/versions.service.ts
[ws-exports]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/export/export.controller.ts

Register E checks: E45 is KEEP and applies only where existing cross-module identity must survive; this allocation adds no stage/send work. No Meri E-row directly replaces the WS-06/07 ticket acceptance. WS-06/07 are individually UNCHANGED under register section E. Decision11/O143 excludes Workspace approvals.
