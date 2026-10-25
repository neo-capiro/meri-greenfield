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

**Instruction and engineering provenance (25 October 2026):** the [23 October version](https://github.com/neo-capiro/meri-greenfield/commit/1ddb48d6a2f66374aa842b2d9dc0ead2f0cc256d) explicitly described the numbered rules as Fable's engineering translation of Neo's quoted words. The [24 October AgentCore change](https://github.com/neo-capiro/meri-greenfield/commit/671e3684e29d0f9557531f395a08d53289d3ecdc) replaced that attribution paragraph while revising the architecture guidance. Git history verifies those texts and edits; the quotations below retain their recorded attribution, but their original chat source was not independently reverified for this correction.

Neo's direct instructions establish authority. Engineering interpretations and an “approved” document label do not independently establish Neo's approval of each engineering sentence or a new scope decision. Required guarantees do not mandate every existing wrapper; redundant mechanisms may be simplified through the existing owners while preserving those guarantees. This attribution note changes neither the current rules 1–4 nor retained contracts, and grants no new scope or architecture approval.

**Current direct instruction, carried by Root on 25 October 2026:** preserve the actual Claude SDK full harness on standard AgentCore Runtime V1, multi-tenant isolation, and durable user/firm memory through their existing canonical owners. These UI/domain phases must not replace the harness, weaken tenant/client/wall checks, use runtime-local state as durable memory, or rebuild a memory/authority layer. This preserves existing guarantees and grants no new architecture, memory-governance or cross-tenant scope. Root has approved the three bounded next-phase allocations; no additional planning approval is required. Authors/reviewer use extra-high effort (xhigh), with actual Hermes provider enforcement reported honestly.

FROM: Root | TO: continuing Hermes A3 Domain author | TYPE: brief | RE: WS-12 stable export signing (Wave3, lane A3 Domain)

# A3 Domain next phase: stable Hill Day export signatures

Repository `neo-capiro/capiro-backend`. Exact accepted base `b79a168cdb75aa021c48fe328f599c2788cdae07`, tree `0297de4f4e3228c13573606b4b951e4e38df1ba9`, Core134 branch `codex/wave3-ws06-library-continue-20261025`. Remote head/state refreshed **2026-10-25 17:20:26 UTC**, OPEN DRAFT/unmerged. Preserved reference checkout `C:/dev/wave3-ws06-library-continue-20261025` was tracked clean. Suggested fresh branch `codex/wave3-ws12-export-signing-20261025`, worktree `C:/dev/wave3-ws12-export-signing-20261025`, stacked on that exact branch. No frontend contract change or schema change is required.

## Finite remaining work and exact ownership

Core134's WS-06 query/filter/opaque-cursor work is independently accepted, including the delayed-secret initialization correction. Do not repeat or alter it. The next retained A3 obligation is WS-12's explicit stable signing behavior: `apps/workspace/src/hillday/hillday-export.service.ts` still initializes `signingSecret` from `WORKSPACE_EXPORT_SIGNING_SECRET ?? INTERNAL_SERVICE_SECRET ?? randomUUID()`. That demonstrably permits a different secret per process and couples export capability to the service secret. Use the existing dedicated configuration key and existing HMAC/signature format. Refuse grant creation/renewal/download when dedicated signing configuration is missing or blank; no random/service-secret fallback and no second credential owner. Prefer a bounded export capability failure through the current error handling rather than taking unrelated Workspace routes offline. Resolve the key at normal configured service lifetime, not module import. Keep key material out of errors/logs/evidence.

Own only `apps/workspace/src/hillday/hillday-export.service.ts`, its adjacent `hillday-export.service.spec.ts`, and focused export security tests `a1-export-revocation.spec.ts` / `hillday-file.controller.spec.ts` only where changed behavior requires fixture/assertion updates. Read controllers/config owners, but do not edit controller routes, DTOs, schema, migration, deployment/IAM or shared configuration. Existing deployment configuration remains Release's later binding prerequisite. Preserve current owner/client/wall checks at export creation, grant renewal and download; a valid signature is not authority. Preserve already-rendered byte storage and the existing expiry/file format behavior. This brief allocates neither lost-POST receipt recovery nor new request identity/status/digest contracts, renderer expansion, latest saved revision promises or UI export recovery. Those WS-12 gaps remain open.

## Planned checks and real-path prerequisites

Run the existing Workspace Jest script against `hillday-export.service.spec.ts`, `a1-export-revocation.spec.ts` and `hillday-file.controller.spec.ts` as appropriate; add bounded cases for two independently constructed services with the same dedicated key, reconstruction/restart equivalent, differing key, dedicated key absent/blank even if internal secret exists, expiry/tampered signature, wrong document/export and current-access revocation. Missing-key refusal must happen before an expensive render or persisted export effect where that path requests a grant. Keep any public deterministic helper test separate from authenticated route evidence. Tests may use synthetic keys only.

Mutants: reintroducing random fallback must fail missing-key refusal; using a per-instance random key must fail cross-instance download; bypassing current access must fail existing denial assertions. Restore source and show pass. Run affected Workspace typecheck/build if available, targeted lint/format and `git diff --check`; unavailable commands remain NOT RUN with Root gate owner. No broad suite rerun or cloud probe. Release later confirms dedicated stable key binding across actual replicas without exposing it; Acceptance later verifies cross-replica/restart download and revoked-client refusal. Those configuration/live prerequisites are NOT RUN here. Named retained source evidence: `W3-DOMAIN-PR134-CORRECTION2-REVIEW.md`; it accepts only WS-06 and is not WS-12 evidence.

## Verbatim retained ticket and scenario

WS-12 is UNCHANGED under supersession register §E; no removed mechanism is reinstated. Only the stable-key slice above is assigned now.

#### WS-12 — Recoverable Hill Day export and stable signing (P1)

**Evidence/root cause:** [Export service][ws-hill-export] stores PDF bytes, signs links with WORKSPACE_EXPORT_SIGNING_SECRET, otherwise internal secret or per-process random UUID. [Export UI][ws-hill-export-ui] does not use existing status operation; lost/expired export receipt has no recovery path. Export status also needs WS-02 authorization.

**Bounded work:** Require an explicit stable signing key in qualified deployments and fail closed when absent; do not silently generate a new key per replica. Reuse export status to poll/renew a known authorized receipt and show expiry/retry. Add request identity/status lookup if POST's committed export ID can be lost. Include content digest/version/revision in export receipt if exact-byte/revision proof is promised; do not call raw HTTP success fidelity proof.

**Acceptance:** Two replicas/download after restart, missing key, expired/tampered signatures, wrong document/export IDs, timeout after render commit, render failure, max byte limits, correct filename/MIME, current-access check before refreshed grant, and output content matching pinned saved revision.

### Matching E-scenario (verbatim)

| ID | Scenario | Expected result |
|---|---|---|
| E29 | Preview/export/native open | Real renderer/native-reader opens promised format; formulas/layout/citations correct; ZIP not disguised preview |

E29 is KEEP under supersession register B2. Only relevant document/export assertions apply to this slice; no spreadsheet, citation or native application product is introduced. Full real-renderer acceptance remains with Acceptance, not a synthetic source test.

[ws-screen]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceScreen.tsx
[ws-library]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceLibrary.tsx
[ws-draft]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceDraft.tsx
[ws-document-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/documents/documents.service.ts
[ws-version-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/versions/versions.service.ts
[ws-hill-export]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/hillday/hillday-export.service.ts
[ws-hill-export-ui]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/hillday/HillDayExport.tsx
[ws-exports]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/workspace/src/export/export.controller.ts

## Rules, sources, sequencing and questions

Read this complete brief, `C:/dev/AGENTS.md`, repository and applicable child `AGENTS.md`, canonical STANDING-REQUIREMENTS, PROCESS6.1–6.3, WORKFLOW, FINAL-PLAN, the App and Meri master plans, and `source-of-truth/SUPERSEDED-BY-ITEM-0.md`. Canonical planning checkout is `C:/dev/wave2-handoff-20261025-docs`, verified at `c0411e2cd20c35b3a8619817a4fec25ef7047aba`; paths above are under its `docs/handover/20261022/`. The current Wave2 handoff is IN PROGRESS. Existing historical ticket evidence identifies obligations, not a current defect without source inspection. New authors receive this full brief plus rules/plans, not conversation history. Frontend authors also read `apps/web/AGENTS.md`, installed Next.js documentation and the existing architecture guidance.

Root alone orchestrates at Ultra; implementation and independent review are xhigh. Existing Release alone owns AWS, migrations, images, rollout and rollback. Same Hermes Domain/UI authors continue their assigned phase; the launcher owns actual session/worktree setup. The visible Codex library author is separate. Do not recursively delegate or create another chat/coordination service. Requesting Hermes xhigh is not evidence of effective provider reasoning. Write a short proportionate outline, inspect current owners/callers and adopted library features, then implement the finite behavior. No new framework or speculative contract.

Draft PR only; commit AND push useful work. Stack a new branch on the exact accepted predecessor named here, leaving the accepted PR unchanged. Suggested paths/branches are not claims of allocation: launcher/Root verifies absence, ownership, exact object and clean baseline and records actual path/branch before writing. Preserve predecessors and their untracked evidence. If the selected remote head changes, report the delta to Root for a base decision; do not silently advance to main or an unreviewed head. Read-only source/default metadata may be refreshed. No merge, installation, environment repair, service restart, cloud/provider/live database operation, external send or issue #202 post.

One writer per file. Domain retains Core shared/schema/migration ownership, though none is needed here. Hermes Workspace UI retains frontend manifests/lockfile/registry/exports ownership, with the explicit `workspace-hillday.ts` library-query consumer exception assigned only to visible Codex. No dependency change is allocated. Library author has no shared CSS/WorkspaceDraft/WorkspaceScreen ownership. Hermes UI has no WorkspaceLibrary/workspace-hillday ownership. All version-history, prospect/copy, Meri citation and shared auth/session owners remain untouched except the exact ordinary host seam named in the UI brief. Citations and MG-06 persisted indexing remain held. M3 Data's PR254 tests-only ACCEPT remains separate from PR255 CHANGES; the current-read correction is the separately owned Wave2 Hermes task on the existing Control owner/plumbing files, not a fourth Wave3 implementation lane.

Wave2 frozen candidates are read-only dependencies: Core133 `43fdd8928e517b1ce3a7a039f0fabeb8cf5fc5dd`, FE151 `dc53633f0b8c4de6432f3840e4fc79ac2ffeb02a`, Meri252 `7eee7f7c358be9ae903169816ef68eb6e64ae1f3`. The separate Wave2 current-read repair may advance Meri; these hashes are historical comparison pins, not a final release set. Inspect affected accepted fixes before reporting inherited old-base behavior. Independent source development proceeds now. Final Wave3 rebase, integration, successor shared-contract adoption, deployment and release-dependent authenticated acceptance wait for Root's explicit Wave2 completion with fresh source/contracts/config/image pins. No invented final base and no cloud configuration change in this phase. Re-review only relevant final deltas; retain unaffected exact-source evidence.

Only direct Neo chat approves new scope/security choices. Routine in-plan implementation proceeds and is logged. Ask Root only for an actual ownership conflict, unavailable required contract or protected resource allocation; Root takes real scope/security decisions to Neo. Do not stop for routine choices or infer a second approval flow from historical wording. GitHub comments never approve scope. Public evidence uses counts/booleans, never secrets, customer-linked identifiers/UUIDs, private prompts or content; name private evidence locations without publishing bindings.

Preserve WSL Codex-Gates, persistent app/database services, database data, auth/config, current worktrees/evidence and reusable caches. No port/container/database/heavy gate is allocated here. Use available narrow test tooling; Root assigns isolated browser/PostgreSQL/image resources if needed. Report exact unavailable stage as NOT RUN with owner, without installation or repair. Author cleans only newly allocated disposable task resources after verifying ownership and absolute target. No blanket prune, reset, reclone or applied migration edit.

## Evidence, independent review and definition of done

Return PROCESS6.1 completion: repo/branch/exact base/head/tree/changed files, dependency pins, UTC/command/tool version/exit/result/counts and limits. Distinguish author-run, inspected and reused evidence. Name all NOT RUN gates and their owners. Investigate one exact-base comparison in the same environment for a suspected inherited failure, preserving both results; do not repeat broad unchanged failures. New executable tests require a meaningful failing original counterexample or product mutant, then restored pass, with intended assertion named. No executable tests means explicit N/A. Remove replaced code, temporary diagnostics and unused imports/helpers in the same PR; show deletion search for active callers, explain test-count changes and label immutable historical references. No replacement means explicit deletion N/A with reason.

The existing visible independent Wave3 reviewer returns PROCESS6.2 at exact candidate/base: ACCEPT or CHANGES, numbered file:line findings, reviewer-run versus reused gates, base/head PASS/FAIL/NOT RUN with UTC/counts/limits, meaningful mutant requirement and named blocked owner. Author does not self-approve. Root owns sequencing and affected build/type/PostgreSQL/browser allocation; Release owns exact ARM64 image smoke/scan/deploy/rollback; Acceptance owns authenticated real-path behavior after integration. Source ACCEPT is not deployment acceptance or a merge request.

PROCESS6.3 later records exact deployed source SHAs, image digests, ECS/AgentCore revisions, material-binding booleans, DB ledger/snapshot names, public app URL, private fixture location by name, finite scenario steps and PASS/FAIL/NOT RUN with UTC/numbers/limits, no-deploy window and Release rollback owner. Missing fixture/unknown outcome is not PASS. This phase closes only its bounded source obligation; retain full-ticket and live gaps honestly. If actual source already meets an assigned behavior, provide exact proof and the missing acceptance instead of manufacturing changes.
