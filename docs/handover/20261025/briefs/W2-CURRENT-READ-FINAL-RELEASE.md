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

FROM: Root | TO: fresh Wave 2 Hermes current-read final-release author, through the existing ScheduleWorker launcher | TYPE: brief | RE: canonical current-client check before final result release (Wave 2, Runtime/Data boundary)

# Wave 2 current-read final-release correction

**READY TO LAUNCH under Root's existing allocation.** Create exactly one fresh Hermes author session at requested **xhigh**; effective provider reasoning is **UNVERIFIED**. The existing visible ScheduleWorker launcher owns mechanical launch and handback. This is a standalone PROCESS6.1 brief: read only this brief, its named accepted evidence, canonical rules/plans/tickets and applicable host/repository instructions, not unrelated chat history. No additional Root signoff or Neo permission question is needed for the allocated in-plan fix. A separately assessed architecture attachment does not freeze this existing-owner correction or authorize architecture expansion.

## Repository, immutable base and isolated ownership

Repository `neo-capiro/meri-greenfield`. Fresh remote metadata **2026-10-25 17:06:32 UTC** confirms [Meri PR252](https://github.com/neo-capiro/meri-greenfield/pull/252) **OPEN DRAFT, unmerged**, branch `codex/wave2-batch-meri-20261025`, exact head **`7eee7f7c358be9ae903169816ef68eb6e64ae1f3`**, tree **`a87135487d6c48d579b3fdfc3845e975b1d56567`**, parent base `51b059063629cf7b7a1370ae54ae9a82624a3bff`. That accepted source is the supplied deployed Meri pin, not a new default-branch or Wave 3 integration base. Root/Release's deployment receipt supplies live provenance; this author makes no live probe.

Create branch **`codex/wave2-current-read-release-20261025`** in a fresh isolated worktree, suggested **`C:/dev/wave2-current-read-release-20261025`**, **based exactly on 7eee**. Launcher verifies branch/path absence, commit/tree availability and current instructions, records the actual clean base/path, and preserves all existing checkouts. If a suggested path already exists, do not reset/reuse another writer's checkout; use a fresh owned path and report it. Refresh source metadata before launch but do not silently move the immutable base; report an actual changed dependency to Root. Draft PR targets `codex/wave2-batch-meri-20261025`; no merge, amend/force-push of PR252, or edit to the frozen release checkout.

**Production ownership is limited to:**

- `apps/runtime/read-context/owner.mjs`: existing canonical Control read-context owner, primary fix location.
- `apps/gateway/dispatch/native-read-context.mjs` and `apps/gateway/dispatch/tool-dispatch.mjs`: only the explicit final-release plumbing actually needed to request that existing owner's fresh observation. Fewer files are preferred when the same behavior is demonstrated; no duplicate handler checks.
- Focused test allocation: `apps/gateway/test/mt09-outreach-current-access.test.mjs` (create the meaningful composition regression on the 7eee base; PR255 remains untouched), and only necessary assertions in existing `apps/runtime/test/reads-native-families.test.mjs` for changed clock/expiry/current-policy behavior. Reuse existing fixtures read-only; keep new bounded synthetic setup local to the focused test. A demonstrated need outside these paths goes to Root with the exact owner/counterexample before editing it.

No Core change, new public DTO/contract/schema/migration, lockfile/dependency/config/credential change, new roster cache/profile pin, generic per-hop framework, source-family expansion, P2 semantics or unrelated gateway-test migration. Preserve the current canonical producer access checks and one writer per shared file. The existing Wave3 Data author is not a concurrent writer to these Wave2 files; its PR254/255 evidence and worktrees remain separate.

## How we work and required sources

Author builds and runs focused checks; the existing separate **Wave3—HermesIndependentReview** Codex chat reviews the exact correction independently using PROCESS6.2. Root is the sole **Ultra orchestrator** for gates/integration/merges; helper author/reviewer/gate sessions use **xhigh**. Existing Release alone operates AWS/migrations/rollout/rollback; Acceptance/Runtime own deployed PROCESS6.3 observations. No recursive agents or extra reviewer/session framework. Neo authorized delegated coordination: launcher may deliver the saved author handback to Root and that reviewer. Actual chat/session IDs remain in the private dispatch companion, never public docs/PR prose.

Read [STANDING-REQUIREMENTS](../../20261022/STANDING-REQUIREMENTS.md), [PROCESS6.1–6.3](../../20261022/PROCESS.md), [WORKFLOW](../../20261022/WORKFLOW.md), [current in-progress handoff](../WAVE-2-HANDOFF.md), [FINAL-PLAN](../../20261022/plan/FINAL-PLAN-20261021.md), [supersession register](../../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), the [Meri master](../../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md) and [App master](../../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md). Explicitly read `C:/dev/AGENTS.md`, repository/applicable child AGENTS and implementation standards; launch isolation can suppress automatic instruction injection. Current roles and bounded no-install/no-operation allocation override historical relay/Ultra/setup instructions.

The primary private evidence is **`wave3-hermes-independent-review` / `outputs` / `W3-DATA-PR255-OWNER-ADDENDUM.md`** and **`W3-DATA-PR255-REVIEW.md`**. The launcher supplies the actual private location. Read the addendum first: it supersedes the initial review's missing-ajv frozen-run limitation with a successful exact-7eee synthetic witness. Root's existing source/deployment evidence remains distinct from that review. No fresh broad review or new live observation is required to start.

Preserve WSL Codex-Gates, shared databases/services/data, authentication/configuration, all current worktrees/evidence and reusable caches. No installation, environment repair, resource launch, service restart, PostgreSQL, browser, provider/model/API application request, AWS, deployment, merge or #202 post. Use already available Node24 tooling and local synthetic ports only. No credential extraction, customer-linked IDs/UUIDs, raw private prompts/content or secret/binding values in public evidence. Only the launcher initiates the authorized fresh Hermes session; the author does not initiate model/provider experiments.

## Demonstrated gap and smallest existing-owner correction

The reviewer exercised the actual `createControlReadsComposer` → reads runtime → `createToolDispatch` → canonical Outreach handler → retained transport and output validators with supported explicit-client `query_outreach` and valid producer-shaped data. Its synthetic Core `/api/clio/application-authority/current` port uses the real response shape. Removing the selected client from that current roster **after the source value is constructed, while run scopes/identity remain unchanged**, returns HTTP200 with a released result. Unchanged roster returns200; loss before source returns403/ACCESS_DENIED with zero source calls. Each scenario made one Core current read. The same three-scenario witness ran at exact PR255, its base4c217, and **exact deployed-source7eee**, with Node24.22.1/exit0 in a separate reviewer-owned checkout. This is a demonstrated source-boundary gap, not a live disclosure probe.

The source fixture returns stored synthetic JSON after its `afterSource` callback. It does **not** execute real Core database/Engagement policy. At supplied Core **`43fdd8928e517b1ce3a7a039f0fabeb8cf5fc5dd`**, `EngagementService.listCampaigns` already checks before query, scopes the query, then re-reads readable client IDs after rows and filters before returning to Meri. That post-row-read protection and its regression exist. **No missing Core check or deployed customer disclosure is established.** Do not alter Core or equate a200 filtered empty response with a denied-row leak.

The existing Control owner holds native client context for a call and rechecks execution currentness on later observations. Thus the dispatcher's existing final release observation can reuse the held Core roster despite unchanged run scopes. Fix **final release through that existing canonical owner**: refresh current Core context at the explicit final result-release boundary, validate the selected client under existing authority, and withhold the source result if access was lost. Use the existing current-context client and selected-client admission. No per-family policy copy, new credential service, cache, authority layer or repeated checks at every hop. Do not force changes to unrelated valid safety checks to make a mutant fail.

Preserve all accepted7eee behavior: advancing local `checkedAtMs` without extending original authority expiry; current tenant/role operation intersection at discovery, dispatch and release; exact binding/subject/request/run identity; original deadlines, cancellation, output caps and held input interpretation. A later fresh Core receipt must never renew the call's original expiry or enlarge authority. Preserve truthful unsupported/empty/source-failure distinctions and existing safe failure projection. Read actual callers before choosing minimal plumbing and record a proportionate outline.

## Sequence and evidence to reuse

1. Confirm the fresh exact7eee worktree and read the addendum plus current owner/callers. Reuse accepted clock/current-policy source and evidence from PR248 `0f26dd2c4f598c5b02b52b72f377db1052c0b648` and PR251 `8ce4f49ce612f9963a1e5f05283f82a0d9683376`, already composed in7eee. Do not port older Wave3 owner/fixture blobs over them.
2. Reproduce the narrow roster-only after-source counterexample through actual composition on this base; unchanged scopes are an explicit assertion, not a scope-revocation substitute. Establish the positive/pre-source controls in the same focused test. Existing reviewer witness may be reused for baseline provenance; do not run another broad census.
3. Implement the smallest correction in the allocated owner and only necessary final-release plumbing. New tests exercise actual changed behavior; no copied dispatcher or mocked-away release observation. Preserve expired/cancelled/current-policy refusal and clock behavior with selected directly affected existing cases only.
4. Mutation-check the new final-release regression, restore exact source, and verify the focused result. Publish a meaningful draft PR on the7eee branch, with exact base/head/tree and clear inherited limits. Send one concise handback to launcher/Root/reviewer. Reviewer reviews only this exact delta with unchanged evidence reused; no author implementation by reviewer.

PR254 **`4c2171fcca374cfca67b99e755f66793992a1624`** remains bounded **ACCEPT16:22:03** for nine fixture/test files, reviewer151/151; this is not wholeMT09 acceptance. PR255 **`f11bd906b2289b11393ac8c02a64ef92f2694e8f`**, tree `4cc84ac1f14f8b8655eee3903a065ca69ccfc0a5`, base4c217, remains **CHANGES**: its scope-change witnesses do not establish roster-only loss and all proposed relevant mutants survived. Preserve both PRs/worktrees/reports unchanged. Their synthetic fixtures are references, not a new integration base. Do not rerun the151-case family suite or adopt unrelated Wave3 source to address this gap.

This is an allocated **Wave2 fix**, so implementation and exact-head independent review may proceed now. The active no-deploy window remains protected; Root/Release decide later integration/image/deployment sequencing. Wave3 integration still waits for Root's explicit Wave2 completion notice. No new source acceptance, merge or live qualification is inferred from this allocation.

## Focused gates, falsification and limits

The meaningful regression must prove: authorized unchanged roster still releases exactly the intended result; selected-client loss before source makes **zero source calls**; loss after the source value is produced but before final Control release, with unchanged run scopes, yields **no result release/retain** at the intended current-access boundary. Test unavailable/malformed final observation if the changed path introduces that failure surface; fail closed without fabricating empty success. A refusal from unrelated INVALID_ARGUMENTS, a broken fixture or changed run scopes is not the intended proof.

Run the focused Node test with the existing module flags/configuration and only directly affected selected clock/expiry/policy checks. Record exact command, Node/tool version, UTC, exit, case counts and limits. Preserve the old expiry even if the refreshed receipt is newer; demonstrate the unchanged positive control with advancing time where relevant. Prefer a direct meaningful behavior case over broad count-only evidence.

**Required mutant:** remove/bypass the new final-release Core refresh while retaining the rest of the real path. The roster-only post-source test must fail by releasing the previously held result; the unchanged-roster positive control must still pass. If it does not fail for that intended reason, the test is incomplete: fix the witness within scope, do not call a survivor a kill or add a broad mutation campaign. Restore source exactly and rerun the focused suite. Other new executable assertions need proportionate meaningful falsification; reused tests do not require a repeated campaign.

Retain inherited evidence honestly: PR254's adjacent four contract failures and three other-consumer failures, PR255's disclosed missing-package attempts and surviving mutants, and7eee's combined257 PASS/2 inherited product-mount FAIL remain historical. They are not reasons to repair unrelated suites or claim a green repository. The initial frozen ajv attempt is historical and superseded only by the successful isolated addendum witness; do not repair the protected snapshot.

**NOT RUN / not allocated:** broad151/whole-repository suites, full build/type/lint where not directly required, database, provider, browser, image/ARM64, AWS or authenticated deployed revocation. These remain named gate/Release/Acceptance obligations if required by the actual correction. No real application/Core request or permission mutation is authorized. PROCESS6.3 source/image/revision/config/ledger/snapshot/live fields must say NOT RUN/retained owner evidence, not synthetic PASS. Full MT09/E18/E19/E31/E44 and whole Wave2 remain open beyond this bounded fix.

## Definition of done and question policy

The actual roster-only source witness fails on the original7eee behavior and passes with the minimal existing-owner correction; the positive and pre-source controls remain correct; the final-refresh bypass mutant fails its intended assertion and restored source passes. Preserve all clock/expiry/current-policy/identity/deadline/cap protections. No unrelated product or public contract changes.

Delete everything this correction makes obsolete in the same PR, including replaced comments/tests/plumbing; do not remove active lower-layer protections. Remove temporary diagnostics before handback. Supply targeted `git grep`/`rg` proof of replaced names/callers and distinguish active retained helpers from immutable historical references. Explain test-count changes. If a category has no replacement, state deletion N/A with a concrete reason; do not claim blanket N/A while replacing executable paths.

Commit **and push**, open **draft PR only**, and return PROCESS6.1 completion: exact repo/branch/worktree/base/head/tree/changed files; plain explanation of gap/fix; commands/versions/UTC/exits/counts; tests run AND not run; base/head comparison; reused versus author-run evidence; mutant failures/restored result; deletion proof; named BLOCKED gate/owner/next action; remaining security/live limits and private evidence by name. Attach the PR using the available app tool when supported. The separate reviewer returns PROCESS6.2 ACCEPT/CHANGES for that exact candidate; no merge or deploy approval is requested from the author.

Ordinary in-plan choices proceed and are logged. This exact ownership exception is already authorized; do not ask again. An actual new scope/security-policy or outside-owner requirement goes to Root with the concrete counterexample and decision for Neo's direct chat; GitHub comments do not approve scope. No #202 post. Preserve accepted evidence, the ongoing release and other agents' work.

## Retained ticket and register disposition

This operationally allocated Wave2 correction implements the retained **MT-09 before/after canonical Outreach visibility obligation**, not a newly invented ticket or P2 expansion. Whole-ticket completion is not claimed. Register checked individually at preparation: §B1 marks MT-03–MT-09/MT-16 **RE-SCOPED** to the existing tool gateway/Core owners; behavior/acceptance retained, per-hop authority/relay/measurement mechanisms excluded. E18 is RE-SCOPED to current Core-allowed tools; E19/E31/E44 are KEEP under the register's all-others rule. The following ticket and scenario rows are copied **verbatim from the current Meri master**; historical mechanism language is interpreted only through that register.

#### MT-09 · Keep legal, news and Outreach claims inside reviewed slices (P1 parity; P2 expansion decision)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** #197 discovers three adapters that intentionally implement narrower semantics than all historical Core inputs: parser-independent/exact legal references, explicit-source or explicit-year personnel news, and explicit-client campaign lists. Core104 improves Outreach current-client validation but does not expand these Meri adapters.

**Bounded change and owner.** Receive reviewed discovery through MT-02. In existing request-context modules, tool descriptions, selected manifest requirements and result status, make unsupported branches explicit. Only if a launch promise requires citation parsing, implicit-year/window news or outreach detail, add one narrowly versioned producer/context slice and its qualification, not an arbitrary legacy passthrough. Reconcile current Core104 owner corrections without undoing conservative Meri restrictions.

**Dependencies.** PF-24 canonical Outreach runtime cohort; current Core104 adoption decision; legal/news source owner, MT-01/02. No legal advice/product promise inferred from a source-read tool.

**Acceptance / tests.** Every admitted enum and exact ID, legal edition/reference mismatch, ambiguous citation, news folder without client, missing year, partial source cutoff, Outreach explicit client plus any outreachId field including empty. Assert unsupported semantics are UNAVAILABLE before source, not empty result. Test changed client visibility before/after canonical Outreach source.

**Pinned evidence.** [apps/gateway/sources/research-legal-legislation/request-context.mjs:45-55](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/research-legal-legislation/request-context.mjs#L45-L55), [apps/gateway/sources/research-legal-news/request-context.mjs:15-34](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/research-legal-news/request-context.mjs#L15-L34), [apps/gateway/sources/outreach-query/request-context.mjs:6-19](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/outreach-query/request-context.mjs#L6-L19), [apps/api/src/meri/meri-tools.service.ts:8636-8661](https://github.com/neo-capiro/capiro-backend/blob/5bf901173e839c0145069ec42e16dcb40c373ba6/apps/api/src/meri/meri-tools.service.ts#L8636-L8661).

## Matching E-scenarios, verbatim

| ID | Scenario | Expected result |
|---|---|---|
| E18 | **[RE-SCOPED]** Read active-set and revoked operation | Only measured admitted operations are discoverable/executable; revoked/missing owner refuses |
| E19 | Research/Florida/Monday/task sources | Actual delegated Core endpoint, correct selected client/pagination/time semantics and cited evidence |
| E31 | Research citation contradiction/injection | Current cited evidence supports claim; source text cannot authorize tools/effects or fabricate citations |
| E44 | Inaccessible/empty/stale provider data | Truthful unavailable/no-results distinction, no fabricated success/evidence |

Only the bounded current-client final-release behavior is allocated here. These retained scenarios do not authorize all-family expansion, new effects or a broad scenario matrix.
