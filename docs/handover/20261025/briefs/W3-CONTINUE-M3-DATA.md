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

FROM: Root | TO: fresh Hermes M3 Data author | TYPE: brief | RE: MT-09 existing legal/news/Outreach read semantics

# M3 Data continuation: truthful supported read slices

**READY for one finite remaining MT-09 source/consumer qualification and demonstrated repairs.** Source/default/PR metadata refreshed 2026-10-25 15:32–15:36 UTC. Meri repository `neo-capiro/meri-greenfield`, fresh base **`d772a6baff05f98e6f3cc3bbd3c47b5306e00c1b`**, tree `8b6c44943f2cda7944fc847293dc2be4d73a4a3c`, accepted PR247 OPEN DRAFT, source branch `codex/wave3-m3-data-20261025`. Core companion base **`68a7dae3043353ef03e98487bf4451c6080116bb`**, tree `b8c7be43eeb3e8287f22f28be22d142b67c91743`, accepted PR128 OPEN DRAFT, source branch `codex/wave3-m3-core-data-20261025`. Suggested new Meri branch/worktree basename `codex/wave3-mt09-reads-continue-20261025` / `wave3-mt09-reads-continue-20261025`; Core `codex/wave3-mt09-core-continue-20261025` / `wave3-mt09-core-continue-20261025` only if a scoped Core change is demonstrated. Stack draft PRs on their respective accepted Wave3 source branches. Remote defaults observed: Meri main `e70dac734ae4efed31ebb3c3bcc5566584a848b5`, Core backend-import `2edec026c912c2f6155a6ac8d04ae08bc70030b3`; neither is the selected fresh base.

Accepted predecessors already reconcile 84 operation/version keys across 48 families, fix opaque hidden-boundary meeting pagination and real MCP restart guidance, and enforce research client walls. Reuse those exact accepted slices. Core helper 6/6 and corrected ES2022 comparison, Meri actual composition/worker 49/49 with three correction mutants, earlier 41/41 registration/secondary checks and two mutants are retained evidence. The inherited tracked-bills failure and missing-ai import failures remain; no full M3/live qualification was claimed. [Accepted reconciliation](https://github.com/neo-capiro/meri-greenfield/blob/d772a6baff05f98e6f3cc3bbd3c47b5306e00c1b/docs/handover/20261025/W3-M3-DATA-RECONCILIATION.md) explicitly leaves exhaustive MT-09 source/consumer acceptance open. MT-06–08 adapters already exist; do not rebuild them. MG-06 stays unallocated.

## Concrete next work and ownership

Inspect the existing MT-09 request-context/handler/family path and its real Core producer. It already deliberately limits legal references, news and Outreach to supported slices. Prove the remaining public result behavior is truthful and current-access safe end to end through the existing adapter result path, then fix only concrete counterexamples. Do not broaden product promises or add a provider. An already satisfied case is reused evidence, not a reason to add redundant tests or a cosmetic patch. End this finite assignment with a clear outcome if no new product defect is found.

Owned Meri paths: `apps/gateway/sources/research-legal-legislation/`, `research-legal-news/`, `outreach-query/` and their adjacent tests; their three exact family modules in `apps/gateway/general-reads/families/` only for description/result mismatch. Existing contracts under `packages/contracts/retrieval-0.2/` are read-only by default: this continuation grants **no new public DTO/version/schema/lockfile change** without independent review and Root sequencing. No `apps/runtime`, control lifecycle, current-capability/clock owner, workers, shared authority, meeting pagination or citation UI edits. No new public source viewer/outcome/usage contract implied.

Core read-only inspection uses `apps/api/src/meri/meri-tools.service.ts` and the canonical legal/news/Outreach delegated owners. A necessary demonstrated repair may touch only the legal/news/Outreach read methods in that existing service and a narrowly named adjacent test; no `apps/api/src/engagement/engagement.service.ts`, mail/cancel writers, auth-policy reimplementation, Core shared contract/schema/migration/manifest or Domain Workspace path. If the actual fix belongs to another canonical owner, report exact file/counterexample and obtain a named Root allocation; do not bypass it or introduce a second owner. Domain alone owns all Core shared/schema work. Preserve frozen Wave2 research-wall/current-access corrections, inspecting their accepted source rather than reproducing an old-base deficiency.

## Sequence and meaningful planned gates

First map the existing selector/handler tests to the literal MT-09 acceptance below. Inspect supported legal exact-ID/edition/reference behavior and ambiguous citation refusal; news folder-without-client, missing year, explicit-source partial cutoff; Outreach explicit client and every `outreachId` presence including empty. Unsupported semantics must be UNAVAILABLE before source; valid empty results and source failures differ. Check changed client access before/after source await and no source requests under refusal. Use real producer-shaped outputs at the existing handler boundary; don't only unit-test a copied selector or fabricate permissions in a fixture. No network provider/model calls.

Reuse existing `research-legal-legislation/test/{selectors,handler,search-completion,citation-precedence}.test.mjs`, `research-legal-news/test/{selectors,handler}.test.mjs`, and `outreach-query/test/{handler,name-correction}.test.mjs`. Add only missing behavior coverage. Planned commands use Node24's existing test/module flags and these named paths, related exact family/contract checks if changed, targeted static checks and `git diff --check`; inspect repository scripts before running. A Core edit uses existing API Jest/typecheck/lint/build selection for its exact test file. Root schedules isolated PostgreSQL only if actual changed DB semantics require it. Mutants must expose unsupported input, conflate unavailable/empty or release a result after access loss and fail the intended assertion. Do not reopen broad 84/48 discovery qualification.

Root's gate owner runs unavailable affected build/DB gates; Release owns exact ARM64 image qualification and Acceptance owns authenticated current-access/legal/news/Outreach cases after completion notice. Real provider/source qualification remains NOT RUN here. Preserve the distinction between accepted source parity and MT-09/full M3 deployed acceptance. P2 citation parsing, implicit news windows, Outreach details/new writes and provider expansion require a separate product decision and are not allocated.

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

**Register decision for MT-09:** RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms.

#### MT-09 · Keep legal, news and Outreach claims inside reviewed slices (P1 parity; P2 expansion decision)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** #197 discovers three adapters that intentionally implement narrower semantics than all historical Core inputs: parser-independent/exact legal references, explicit-source or explicit-year personnel news, and explicit-client campaign lists. Core104 improves Outreach current-client validation but does not expand these Meri adapters.

**Bounded change and owner.** Receive reviewed discovery through MT-02. In existing request-context modules, tool descriptions, selected manifest requirements and result status, make unsupported branches explicit. Only if a launch promise requires citation parsing, implicit-year/window news or outreach detail, add one narrowly versioned producer/context slice and its qualification, not an arbitrary legacy passthrough. Reconcile current Core104 owner corrections without undoing conservative Meri restrictions.

**Dependencies.** PF-24 canonical Outreach runtime cohort; current Core104 adoption decision; legal/news source owner, MT-01/02. No legal advice/product promise inferred from a source-read tool.

**Acceptance / tests.** Every admitted enum and exact ID, legal edition/reference mismatch, ambiguous citation, news folder without client, missing year, partial source cutoff, Outreach explicit client plus any outreachId field including empty. Assert unsupported semantics are UNAVAILABLE before source, not empty result. Test changed client visibility before/after canonical Outreach source.

**Pinned evidence.** [apps/gateway/sources/research-legal-legislation/request-context.mjs:45-55](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/research-legal-legislation/request-context.mjs#L45-L55), [apps/gateway/sources/research-legal-news/request-context.mjs:15-34](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/research-legal-news/request-context.mjs#L15-L34), [apps/gateway/sources/outreach-query/request-context.mjs:6-19](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/outreach-query/request-context.mjs#L6-L19), [apps/api/src/meri/meri-tools.service.ts:8636-8661](https://github.com/neo-capiro/capiro-backend/blob/5bf901173e839c0145069ec42e16dcb40c373ba6/apps/api/src/meri/meri-tools.service.ts#L8636-L8661).

---

## Matching E-scenarios, verbatim

| ID | Scenario | Expected result |
|---|---|---|
| E18 | **[RE-SCOPED]** Read active-set and revoked operation | Only <del>measured admitted operations</del> are discoverable/executable; revoked/missing owner refuses |
| E19 | Research/Florida/Monday/task sources | Actual delegated Core endpoint, correct selected client/pagination/time semantics and cited evidence |
| E31 | Research citation contradiction/injection | Current cited evidence supports claim; source text cannot authorize tools/effects or fabricate citations |
| E44 | Inaccessible/empty/stale provider data | Truthful unavailable/no-results distinction, no fabricated success/evidence |


Register E checks: E18 is RE-SCOPED to tools Core currently permits for the actor/client; E19/E31/E44 are KEEP. These rows apply only to the MT-09 slice; they do not allocate all other read families or M5 generation.
