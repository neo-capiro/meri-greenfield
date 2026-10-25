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

FROM: Root | TO: fresh Hermes A3 Domain author | TYPE: brief | RE: WS-06 authorized library filters and paging

# A3 Domain continuation: existing library query

**READY for the bounded independent source assignment.** Source/default/PR metadata refreshed 2026-10-25 15:32–15:36 UTC. Core repository `neo-capiro/capiro-backend`, fresh exact base **`45eaba1b720849e914052fcf3d7003ac73ac27cd`**, tree `bf095e4292ff18e0d3541c028932172edd247e43`, accepted PR129 OPEN DRAFT, branch `codex/wave3-a3-domain-20261025`. Suggested new branch `codex/wave3-ws06-library-continue-20261025`, worktree basename `wave3-ws06-library-continue-20261025` under the preserved development root. Stack the new draft on the PR129 source branch; integration default is `backend-import`, freshly observed `2edec026c912c2f6155a6ac8d04ae08bc70030b3`, not a branch named main. Recheck remote heads before dispatch and publication.

Accepted predecessor work is partial WS-05/WS-15 atomic save receipts/CAS and ML-24 pre-SES delivery claim, with 177 distinct Workspace tests including four PostgreSQL cases, 19 Onboard tests including three native claim/migration cases, app typechecks/builds and 13 mutants reported. Root supplied independent ACCEPT; GitHub has no submitted review record. Do not redo those slices. Migration `20261025120000_onboard_email_delivery_claim` is NOT LIVE. Full WS-06/07/10 and UI/provider/live work remain open.

## Concrete next work and ownership

The current frontend `workspace.documents` operation reaches Workspace `GET /hillday/documents`, not `DraftsService.list`. `HillDayController.listDocuments` forwards client/status/kind/cursor/limit into `HillDayDocumentService.listDocuments`. The current service already merges safe Hill Day/draft metadata, orders by updatedAt/id, applies canonical current access and advances the scanned window across denied rows. Preserve that accepted existing behavior; do not replace pagination merely because an older ticket describes a defect. Current search/owner/type controls are local frontend filters over one 50-row page, while the backend has no search/owner selectors and kind only selects Hill Day versus merged.

Extend this existing authorized library query with bounded search, owner/scope and supported type filters plus canonical clientId. Validate inputs and retain deterministic paging and useful empty-page continuation. Inspect same-timestamp mixed-kind ties, filter-bound cursor semantics and current permission changes; repair only demonstrated gaps using existing owner/query conventions. No raw-table unified library, fabricated shared identity, hidden source-row details, new indexer, cache or schema is allocated. Existing prospect-origin exclusion and held legacy-client recovery stay intact. Return the exact producer input/output contract for later frontend adoption; do not edit frontend files or enable a consumer before review/Wave2 sequencing permits.

Owned production files are `apps/workspace/src/hillday/hillday.controller.ts` (library GET only), `hillday-document.service.ts` (listDocuments/library helpers only), `hillday.types.ts` (library query/result only), and an existing/new narrow library query DTO under `apps/workspace/src/hillday/dto/` if existing validation requires it. Owned tests: `hillday-library-access.spec.ts`, library cases in `hillday-document.service.spec.ts`, and a proposed adjacent `hillday-library-query.spec.ts` if needed. No hillday generation/export/cancellation/wizard or Core `apps/api/src/meri`/data-reader edits. No broad controller refactor.

Domain retains sole ownership of necessary Core schema/shared manifests/migrations; **none is preallocated or expected for this query slice**. Any demonstrated need is brought to Root before changing a shared file or reserving a migration number. Existing generation/document-agent CAS and Onboard lifecycle exceptions belong to the accepted predecessor only and are not renewed by this brief. Data never edits Domain files; Workspace UI works only in version history and does not implement the library consumer concurrently.

## Sequence and meaningful planned gates

First inspect controller/query/caller and existing library tests on the exact base, record a concise outline, then add the smallest authorized query changes and producer-shaped tests. Run existing affected library/access suites plus new cases: a matching item beyond the first two pages, owner/type/client combinations, empty authorized page with nextCursor, stable equal-time ordering, malformed/stale/filter-changed cursor, duplicate names, moved/revoked client, foreign tenant and prospect exclusion. Mutants must remove the new server filter, bypass a current-access predicate or break continuation and fail the intended assertion. Preserve existing passing cases and explain any intentional cursor behavior change.

Planned commands, after inspecting actual scripts: existing Workspace Jest runner for those `src/hillday/*.spec.ts` paths, Workspace typecheck/Nest build, changed-file lint/format and `git diff --check`. New tests involving actual database query semantics should use Root-allocated isolated PostgreSQL16; never the shared clone. If the existing cache cannot run a command, report the exact missing dependency/tool and NOT RUN; no installation. Root's gate owner runs unavailable affected app/PostgreSQL gates; Release owns exact ARM64 image smoke/scan and Acceptance owns real authenticated page3/current-access behavior after integration. No gate is claimed run by the docs author.

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

**Register decision for WS-06:** UNCHANGED — register §E, checked individually. Context means tenant/client/entity context, not a competing authority token. Decision 11 / O143 still excludes Workspace approvals.

#### WS-06 — Complete library semantics and durable navigation (P1)

**Evidence/root cause:** [Library][ws-library] filters the current 50-row response locally; older pages replace current data. [Screen][ws-screen] opens Hill Day/current draft in local state. Rich newsletters and Meri artifacts have separate libraries, and prospect drafts intentionally are not name-matched.

**Bounded work:** Move search/owner/type/client filters to the authorized library query with stable cursor semantics; include canonical clientId from WS-04. Add durable document and Hill Day wizard/job URLs with unambiguous resource kind. Provide explicit links/tabs to rich-newsletter and Meri libraries before attempting any aggregation. If a unified list is desired, aggregate only each owner's safe metadata projection with resource kind and authoritative route, not raw tables or fabricated shared IDs.

**Acceptance:** Search hit on page3, empty authorized page with nextCursor, filter changes resetting cursor, duplicate names, reload/back/forward, direct URLs, malformed/conflicting params, moved client scope and no unauthorized rows. Existing prospect-origin exclusion remains.

---

## Matching E-scenarios, verbatim

| ID | Scenario | Expected result |
|---|---|---|
| E45 | Canonical cross-module handoff | Portfolio/Workspace/Settings context preserved with entity IDs; effect appears in receiving module after reload |

[ws-screen]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceScreen.tsx
[ws-library]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/WorkspaceLibrary.tsx

Register E checks: E45 is KEEP and applies only where existing cross-module identity must survive; this allocation adds no stage/send work. No Meri E-row directly replaces the WS-06/07 ticket acceptance. WS-06/07 are individually UNCHANGED under register section E. Decision11/O143 excludes Workspace approvals.
