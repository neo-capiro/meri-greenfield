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

FROM: Root | TO: existing Hermes M3 Data author, resumed by the existing launcher | TYPE: brief | RE: MT-09 canonical Outreach before-source and after-source current-client visibility

# M3 Data follow-up: canonical gateway evidence

**READY for this named in-plan exception. Resume the original Hermes Data author; do not create a duplicate session.** Requested reasoning remains xhigh; effective provider reasoning remains UNVERIFIED. This is a complete standalone follow-up input, not permission to import unrelated prior chat history. Root authorized this bounded assignment; no new Neo permission question is needed.

## Repository, fresh base and review sequence

Repository `neo-capiro/meri-greenfield`. Remote metadata and the source branch were refreshed **2026-10-25 16:17:39–16:18:10 UTC**: [PR254](https://github.com/neo-capiro/meri-greenfield/pull/254) remains **OPEN DRAFT**, head **`4c2171fcca374cfca67b99e755f66793992a1624`**, tree **`53c61d387298058cdd9757f9a2dc9c0c3005041a`**, branch `codex/wave3-mt09-reads-continue-20261025`, base `d772a6baff05f98e6f3cc3bbd3c47b5306e00c1b` / `codex/wave3-m3-data-20261025`. **Independent verdict for PR254 is PENDING. This candidate is not accepted.** Its accepted predecessor PR247 remains accepted only within its own exact-source scope.

Use a **new isolated stacked branch/worktree based exactly on 4c2171fcca374cfca67b99e755f66793992a1624**: suggested branch `codex/wave3-mt09-gateway-continue-20261025`, worktree `C:/dev/wave3-mt09-gateway-continue-20261025`. Launcher/author verifies branch/path absence and exact base before creating it, records the actual path and checks current instructions. Preserve PR254 unchanged for its ongoing review; do not amend, force-push or reuse its checkout as the follow-up writer. Existing predecessor checkout `C:/dev/wave3-mt09-reads-continue-20261025` was clean at the candidate head during preparation. Recheck remote head before starting; if it changes, Root reconciles the affected dependency rather than silently choosing another base.

No product patch is required by default. If accepted existing evidence satisfies the obligation, return that exact proof and a no-change disposition. If new direct behavior tests or a demonstrated narrow production correction are necessary, commit/push only meaningful changes on the new branch and open a stacked draft PR targeting `codex/wave3-mt09-reads-continue-20261025`. A dependency on an unaccepted candidate remains explicit. The separate visible Codex reviewer reviews this follow-up delta independently and receives PR254's pending/final verdict without reopening unchanged evidence.

## How we work, sources and preservation

Author implements/tests; the existing **Wave3—HermesIndependentReview** Codex chat reviews at xhigh; Root remains sole orchestrator and coordinates gates/integration/merges/shipping. Existing Release alone operates AWS/migrations/deployment/rollback. The existing ScheduleWorker launcher resumes/delivers this brief and forwards the saved author handback to Root/reviewer if Hermes has no authorized messaging tool. Actual chat IDs stay in the private dispatch companion, never public docs/PR prose. No recursive agents, new coordination framework, monitor or duplicate session.

Read this full brief and its verbatim ticket/scenarios, [STANDING-REQUIREMENTS](../../20261022/STANDING-REQUIREMENTS.md), [PROCESS6.1–6.3](../../20261022/PROCESS.md), [WORKFLOW](../../20261022/WORKFLOW.md), [FINAL-PLAN](../../20261022/plan/FINAL-PLAN-20261021.md), [supersession register](../../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), [Meri master](../../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md), [App master](../../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md), [original Data continuation](W3-CONTINUE-M3-DATA.md), [reviewer brief](W3-INDEPENDENT-REVIEW.md) and [manifest](W3-DISPATCH-MANIFEST.md). Explicitly read host/repository/applicable child AGENTS and implementation standards; launcher isolation may suppress automatic instruction injection. Current roles/xhigh/protected-operation limits override historical relay/Ultra/install instructions. Record only a proportionate outline, reuse existing canonical owners and keep entry points cohesive.

Preserve WSL Codex-Gates, shared databases/services/data, authentication/configuration, existing worktrees/evidence and caches. No installs, environment repair, service restart, provider/model/browser/PostgreSQL/AWS operation, live application action, resource launch, merge or #202 post. Run only bounded synthetic Node checks with already available tooling; no new scarce-resource allocation. Never reset/delete another checkout or repair the whole broken gateway suite. Applied migrations remain immutable; no schema/DTO/lockfile/dependency change. Public reports use counts/booleans and names of private evidence only: no secrets, customer-linked IDs, UUIDs, private prompts/content or bindings.

## Exact remaining obligation and first action

The private **HERMES-WAVE3-DATA-RESULT.txt**, sections **9 and 11**, identifies one unproven obligation: “changed client visibility before/after the canonical Outreach source.” PR254's synthetic handler contexts and client-subject/resource checks do **not** prove changing current access around a source await. Its section7 adapter mutant is not evidence that the canonical dispatch effect/release fence runs. The current owner is `apps/gateway/dispatch/tool-dispatch.mjs`: it obtains `effect` before `entry.execute`, obtains `release` after source/result validation, checks current identity/read context and `sameContext`, then retains/releases. Source preparation inspected that actual current flow. This is an evidence gap, not an established production bug.

**FIRST inspect/reuse frozen accepted Wave2 source and proof before writing:** Meri [PR252](https://github.com/neo-capiro/meri-greenfield/pull/252) exact `7eee7f7c358be9ae903169816ef68eb6e64ae1f3` / tree `a87135487d6c48d579b3fdfc3845e975b1d56567`, including [PR248](https://github.com/neo-capiro/meri-greenfield/pull/248) `0f26dd2c4f598c5b02b52b72f377db1052c0b648` and [PR251](https://github.com/neo-capiro/meri-greenfield/pull/251) `8ce4f49ce612f9963a1e5f05283f82a0d9683376`. Root's accepted evidence governs acceptance provenance; historical PR prose may predate the final verdict.

PR248 updates the existing `apps/runtime/read-context/owner.mjs` observation timestamp without extending original authority expiry; its accepted evidence includes 71 new advancing-clock cases, ten General/client registry cases, existing foreign-identity/client negatives and post-source revocation denial. PR251 resolves the existing current tenant/role capability policy and intersects operations at discovery, dispatch and release; its evidence includes stale dispatch/after-source narrowing, role downgrade/revocation and 13 operation-narrowing regressions with meaningful mutants. These current-policy/clock changes already belong to their accepted existing owners. Inspect their actual source/test assertions and exact operation/path coverage, including `apps/runtime/test/reads-native-families.test.mjs`, the relevant retained composition tests and `apps/runtime/product-ports/test/capability-policy.test.mjs`. The docs author inspected their published change/evidence descriptions; the frozen commit object was unavailable in the candidate checkout, so no local exact-source diff of 7eee is claimed. Read the exact frozen source through its existing owner/read-only checkout or published source before relying on it.

Decide whether this retained evidence already exercises the actual canonical Outreach before-source and after-source current-client boundary. If yes, cite exact test/assertions/source pins and explain the coverage; do not manufacture another patch. If it covers only a different operation/boundary, add the smallest direct missing witness below. If an old-base failure is already fixed by the frozen clock/current-access deltas, identify it as that dependency and wait for later integration; do not port/reimplement it under this assignment.

## Named ownership exception and exclusions

Root grants the same Data author this exact exception only:

- `apps/gateway/dispatch/tool-dispatch.mjs`, the existing read-effect/read-release owner: **read-only unless a concrete behavior counterexample demonstrates a necessary narrow fix at this owner**.
- One narrowly named adjacent test, proposed `apps/gateway/test/mt09-outreach-current-access.test.mjs`, with minimal fixture setup inline or reuse of existing fixtures read-only. This is the sole new test/fixture path allocation; no broad migration of `gateway.test`, `next-read-adapters` or other broken gateway suites.

Use the real canonical dispatcher and existing Outreach catalog/contract/source adapter with synthetic current-context and bounded source ports. Do not copy the dispatcher into a test, mock away the effect/release observations, add checks to family handlers, redesign auth/policy, or create another authority/cache/profile-pin mechanism. No Core change, source-family rewrite, schema/DTO/version/lockfile, P2 citation parsing/news window/Outreach detail/write or provider expansion. All other ownership remains as in the original Data brief; that broader allocation does not override this narrowly scoped follow-up. A needed change outside these two files is returned to Root with exact counterexample and canonical owner, not implemented by implication.

## Minimal checks and falsification

If existing proof is insufficient, demonstrate an authorized unchanged-current-client positive control, loss of current client access before source with **zero source calls**, and loss/change while the canonical Outreach source is awaited with **no result release/retain**. Use the actual accepted context shape and source result validators; assert refusal at the intended current-access boundary rather than accepting unrelated INVALID_ARGUMENTS or fixture errors. Keep any source-call/retain counters local to this bounded fixture; no new telemetry or framework. Honest valid-empty and source-refusal semantics already proved by PR254 stay unchanged.

Run only the new focused Node24 file and directly affected existing checks needed for any actual production edit, with existing required module flags. Record the exact command, Node version, UTC, exit, counts and result. Meaningful new-test mutants bypass the relevant pre-source current-access observation or the post-source effect/release fence and must fail intended assertions while retaining the positive control; restore exact source and rerun the focused test. A source counterexample must distinguish a genuine current-head defect from already accepted frozen Wave2 behavior. Do not mutate PR254's checkout. No new executable tests means mutation N/A with reason.

Retain predecessor author evidence as **author-reported, pending independent review**: PR254's 151/151 owned tests, exact-base 56/150 passes and 94 failures, five killed mutants plus its disclosed normalization-context classification survivor; four inherited contract failures and three inherited business-development failures remain. Do not call these all-green repository gates or relabel synthetic family contexts as authenticated access. The broader gateway test failures reported in the handback remain inherited/unassigned; do not repair them wholesale. Reuse accepted PR247/128 and frozen Wave2 proof within their original limits rather than rerunning broad inventories.

NOT RUN by this documentation preparation and not allocated to the author: full repository/build/typecheck/image gates, PostgreSQL, browser, provider/model, AWS and deployed authenticated current-access acceptance. Root's existing gate/Release/Acceptance owners retain those gates when relevant; identify exact unavailable check/owner/next action instead of fabricating a pass. Full MT09/M3 and E18/E19/E31/E44 live acceptance remain open.

## Definition of done, return and question policy

Return a concise PROCESS6.1 completion with (a) existing proof sufficient/no patch, or (b) exact new stacked PR/branch/base/head/tree/changed files and demonstrated missing coverage/fix; source pins and UTC; commands/tool versions/exits/results; tests run AND not run; reused versus author-run evidence; mutation counterexamples/restored result; inherited failures and remaining acceptance. Delete anything the change replaces, remove temporary diagnostics, and provide targeted `git grep`/`rg` proof for replaced identifiers/active callers with immutable historical references distinguished. Explain test-count changes; if no replacement occurred, deletion N/A with reason. Commit AND push meaningful changes; a no-change evidence result needs no empty commit or fake PR.

Save the handback for the existing launcher to deliver to Root and the separate reviewer; preserve the original PR254 evidence and pending exact-head review. Reviewer uses PROCESS6.2 ACCEPT/CHANGES for the exact new delta/base, with reviewer-run/inspected/reused gates and numbered concrete findings. PROCESS6.3 source/image/deployed revision/config/DB/snapshot and live scenario fields remain with Release/Acceptance, not this synthetic source assignment.

Final shared-contract adoption, successor rebase/integration, deployment and release-dependent acceptance still wait for Root's explicit Wave2 completion notice and fresh exact pins. The frozen 7eee source is a read-only dependency, not a newly invented integration base. Keep PR254 independent review pending until its actual verdict. Ordinary in-plan details proceed/log with Root. Only direct Neo chat approves a real scope/security-policy change; GitHub comments never approve scope. Root already approved this named exception, so no repeated permission question is required.

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
