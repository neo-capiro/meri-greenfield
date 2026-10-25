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

FROM: Root | TO: mechanical Hermes launcher / independent reviewer | TYPE: dispatch manifest | RE: three fresh Wave 3 continuations

# Wave 3 continuation dispatch manifest

**Approved parallel phases, 25 October 2026 (sealed source brief receipts 17:20–17:26 UTC):** preserve the full Claude SDK harness on Runtime V1, direct Bedrock/control gateway/Core, tenant isolation and durable user/firm memory. Root approved the following bounded existing-plan allocations; no broader hosting/orchestration/SDK or interactive Temporal replacement is allocated. Full standalone briefs follow; launcher/Root records actual fresh checkout/base UTC before editing. Existing current-read correction continues independently.

| Full brief | Author / exact starting source / boundary |
|---|---|
| [WS12 stable export signing](W3-NEXT-A3-DOMAIN-EXPORT-SIGNING.md) | Same Hermes Domain author, fresh isolated stack on accepted Core134 `b79a168cdb75aa021c48fe328f599c2788cdae07`; existing export-key owner and named tests only. |
| [WS07 formatting, preview and existing exports](W3-NEXT-A3-WORKSPACE-UI-EXPORT.md) | Same Hermes Workspace UI author, fresh isolated stack on accepted FE153 `33283081866c25de9b71327cb8d7a457e1cf290d`; ordinary draft host/new export modules, no save/CAS/restore adoption. |
| [WS06 library consumer](W3-NEXT-A3-LIBRARY-CONSUMER.md) | New visible xhigh Codex author, separate FE153 stack at `33283081866c25de9b71327cb8d7a457e1cf290d`, accepted Core134 producer; DocumentsLibrary/request schema only, no WorkspaceDraft/shared CSS overlap. |
| [Event polling](W2-EVENT-POLLING-BRIEF.md) | New visible xhigh Codex author; inspected Meri base `7eee7f7c358be9ae903169816ef68eb6e64ae1f3`, Root refreshes exact dispatch base; existing events/observe owner only, preserve current access/cursors/cancellation. |
| [Obsolete owner/proxy/issuer retirement](W2-OWNER-PROXY-ISSUER-RETIREMENT-BRIEF.md) | New visible xhigh Codex author; inspected Meri base `7eee7f7c358be9ae903169816ef68eb6e64ae1f3`, Root refreshes exact dispatch base; inlined candidate list is a search allocation, delete only proved unused owned leaves and prepare Release's concrete plan. Live deletion remains Release-owned and dependency-gated. |

The existing launcher is authorized to continue the same Domain/UI Hermes authors in parallel on these full briefs after publication, without another Root approval. Root creates the three visible Codex author sessions and assigns separate review; private IDs remain private. Requested xhigh is not proof of effective Hermes provider enforcement. Final Wave3 integration/deployment still waits for explicit Wave2 completion and final pins. These allocations do not rewrite the historical dispatch receipts below.

**Separate Wave2 current-read correction, 25 October2026, 17:06 UTC:** [W2-CURRENT-READ-FINAL-RELEASE](W2-CURRENT-READ-FINAL-RELEASE.md) authorizes one fresh Hermes author on an isolated exact7eee branch to refresh current Core visibility through the existing Control owner before final result release. The existing launcher dispatches on publication without another Root signoff; the existing independent reviewer reviews the exact candidate. PR254 ACCEPT and PR255 CHANGES remain unchanged history. No Core change or proven deployed disclosure; no AWS/live probe, broad151 rerun or Wave3 integration is allocated. Private session bindings stay with the launcher.

**Separate Wave2 diagnostic, 25 October 2026:** the [worker startup brief](W2-HERMES-WORKER-STARTUP-DIAGNOSIS.md) allocates exactly one fresh read-only Hermes look using Runtime’s completed handoff. Worker66 recovered unchanged and all three Meri roles were healthy/complete at 16:18:49; cause remains unproven. This is nonblocking and does not reopen release qualification or use a Wave3 author checkout.

**Data author follow-up, 25 October 2026, 16:18 UTC:** resume the original Hermes Data author with [the standalone MT-09 gateway brief](W3-CONTINUE-M3-DATA-GATEWAY.md). New isolated stacked base is PR254 `4c2171fcca374cfca67b99e755f66793992a1624` (independent verdict PENDING); preserve that PR for review. The sole exception is the existing canonical dispatcher plus one adjacent focused test, after inspecting/reusing accepted frozen Wave2 clock/current-access proof. No duplicate session or broader gateway migration. Earlier dispatch facts below remain historical.

**Prepared and remote PR heads refreshed 2026-10-25 15:41:14 UTC.** Three author lanes are READY for fresh isolated-session dispatch under Root's existing allocation. A fourth citation author is deliberately held. This manifest does not claim an author process/worktree/PR has been created. Root's visible independent review chat **Wave3—HermesIndependentReview** has been created at xhigh and received its complete initial brief. The existing **ScheduleWorker launcher** performs mechanical Hermes launches only. Actual reviewer/launcher chat IDs and reviewer local directory are kept in the private local `wave3-dispatch-private.json` companion, never this public repository.

## Dispatch list and one-writer boundaries

All brief paths below are relative to this directory. The local docs checkout is `C:/dev/wave2-handoff-20261025-docs`, branch `codex/wave2-handoff-20261025-docs`, existing [draft PR245](https://github.com/neo-capiro/meri-greenfield/pull/245). Before editing it was clean at `7f081b8129d6d21ee71a4146735d5aeacb1401c9`, tree `f133cfe9b4ae5628b72d6b70f00b3c773761ef90`; only this docs coordinator writes it. No Wave2 handoff cutoff, release source or unrelated document is changed.

| Lane / complete brief | Suggested fresh branch / worktree | Exact fresh source base | Bounded work and sole owner |
|---|---|---|---|
| [A3 Domain](W3-CONTINUE-A3-DOMAIN.md) | `codex/wave3-ws06-library-continue-20261025` / `C:/dev/wave3-ws06-library-continue-20261025` | Core129 `45eaba1b720849e914052fcf3d7003ac73ac27cd` | WS-06 existing `/hillday/documents` library query; search/owner/type/client filters and only demonstrated paging gaps. Own exact library methods/controller/types/DTO/tests listed in brief. Domain remains sole Core shared/schema/migration writer; none expected here. |
| [A3 Workspace UI](W3-CONTINUE-A3-WORKSPACE-UI.md) | `codex/wave3-ws07-history-continue-20261025` / `C:/dev/wave3-ws07-history-continue-20261025` | FE140 `6ea4af20ac539c6da7f31ed657754ca530143f99` | WS-07 read-only exact saved-version detail/compare through existing authorized version list. Own ordinary history/component/schema/tests only; no library filter consumer, new save/restore/delete mutation or citation path. Sole frontend shared manifest/lock/registry/export owner; no dependency change expected. |
| [M3 Data](W3-CONTINUE-M3-DATA.md) | `codex/wave3-mt09-reads-continue-20261025` / `C:/dev/wave3-mt09-reads-continue-20261025`; conditional Core companion `codex/wave3-mt09-core-continue-20261025` / `C:/dev/wave3-mt09-core-continue-20261025` | Meri247 `d772a6baff05f98e6f3cc3bbd3c47b5306e00c1b`; Core128 `68a7dae3043353ef03e98487bf4451c6080116bb` | MT-09 existing legal/news/Outreach semantics and current-access parity. Finite missing acceptance/demonstrated repairs only. Own three existing source adapter/family/test seams; Core legal/news/Outreach read methods only if needed. No new public DTO without separate review/Root sequence; no indexer, schema, runtime, Engagement writer or Domain paths. |
| [Citation hold](W3-CONTINUE-M3-CITATIONS-HOLD.md) | None; no author process or new worktree | FE141 `7b613a8a3f8472e24296a01f7e8c2758e97f774e` retained | MF-16 accepted presentation preserved. Real current-access source viewer, outcome/usage and hearing contracts/design/media prerequisites remain open. Do not invent contracts or repeat accepted work. |
| [Separate Codex reviewer](W3-INDEPENDENT-REVIEW.md) | Root-created visible chat; allocate isolated exact-head review checkout as candidates arrive | Exact new author head/base/tree supplied on completion | Reviews all three lanes independently with PROCESS6.2, preserves PROCESS6.3 live evidence fields and named unrun owners; no author implementation or changes to docs checkout. |

The launcher verifies suggested branch/path absence and exact base availability, creates fresh isolated worktrees without resetting/reusing writable predecessors, and records actual paths/heads and session IDs privately. If a selected source head changed, stop that affected dispatch and ask Root to reconcile the delta; do not silently use remote main, the frozen Wave2 batch or an unreviewed newer head. No recursive agents. Domain/Workspace/Data can proceed concurrently within their disjoint paths; contract/public-export and heavy shared-resource writes are serialized by Root.

## Observed predecessor worktrees and PR state

Local statuses below were read 15:32–15:36 UTC. They are historical references to preserve, not author allocations. `work/` contains existing untracked owner evidence and is not permission to delete or overwrite it. Remote PR head/state was freshly re-read at 15:41:14; all listed PRs are OPEN DRAFT, unmerged.

| Source | Exact head / tree | Preserved local checkout / status | Accepted result and remaining scope |
|---|---|---|---|
| [Core129](https://github.com/neo-capiro/capiro-backend/pull/129) | `45eaba1b720849e914052fcf3d7003ac73ac27cd` / `bf095e4292ff18e0d3541c028932172edd247e43` | `C:/dev/wave3-a3-domain-20261025`, clean | Partial atomic ordinary save/receipt/CAS and ML24 pre-SES claim accepted. Migration NOT LIVE; full WS06/07/10, paired UI/system-mail/live work open. |
| [FE140](https://github.com/neo-capiro/capiro-frontend/pull/140) | `6ea4af20ac539c6da7f31ed657754ca530143f99` / `c0ea185b3d02008638cce9843f9ea558b39a9f16` | `C:/dev/wave3-a3-workspace-ui-20261025`, tracked clean; untracked `work/` | Navigation/receiver slice accepted: 59 units, two correction mutants, eight reused original mutants, later five synthetic browser cases. Full workflow/live acceptance open. |
| [Meri247](https://github.com/neo-capiro/meri-greenfield/pull/247) | `d772a6baff05f98e6f3cc3bbd3c47b5306e00c1b` / `8b6c44943f2cda7944fc847293dc2be4d73a4a3c` | `C:/dev/wave3-m3-data-20261025`, tracked clean; untracked `work/` | 84/48 reconciliation and actual MCP meeting-cursor recovery accepted. Existing tracked-bills/missing-ai failures retained; full M3/live acceptance open. |
| [Core128](https://github.com/neo-capiro/capiro-backend/pull/128) | `68a7dae3043353ef03e98487bf4451c6080116bb` / `b8c7be43eeb3e8287f22f28be22d142b67c91743` | `C:/dev/wave3-m3-core-data-20261025`, tracked clean; untracked `work/` | Opaque hidden-boundary meeting pagination/compiler correction and research wall filtering accepted. Bounded non-snapshot paging limits retained. Research wall fix already backported into Wave2. |
| [FE141](https://github.com/neo-capiro/capiro-frontend/pull/141) | `7b613a8a3f8472e24296a01f7e8c2758e97f774e` / `c86ce36a8d264166399f68ef74f97fb84184a7d9` | `C:/dev/wave3-m3-citations-20261025`, tracked clean; untracked `work/` | Saved references and incomplete-history outcome-label correction accepted; full MF16 current-access resolution/outcome/usage/hearing/live acceptance open. |

Acceptance provenance: Root supplied independent exact-head ACCEPT for these preceding slices; earlier dated briefs preserve relevant prior reviewer evidence. The fresh GitHub `list_pull_request_reviews` reads returned empty lists, so these are not GitHub formal approvals. FE140/141 PR prose still contains older pending-review/browser states; the accepted exact-source correction/fixture evidence above supersedes those statements only within its documented scope. A passing synthetic browser or source review never means deployed acceptance.

Remote defaults read during preparation: Core `backend-import` `2edec026c912c2f6155a6ac8d04ae08bc70030b3`; frontend `main` `d01ea5544b64008ed0a72ae4e6c5af30d8ba64a1`; Meri `main` `e70dac734ae4efed31ebb3c3bcc5566584a848b5`. Launcher refreshes defaults/dependency/open-PR heads before each send; selected accepted owned Wave3 heads above remain the intended bases unless Root explicitly changes them.

## Wave 2 dependencies and hard holds

Frozen accepted release candidates re-read at 15:41:14:

| Candidate | Exact source | Relevant already accepted fixes / overlap treatment |
|---|---|---|
| [Core133](https://github.com/neo-capiro/capiro-backend/pull/133) | `43fdd8928e517b1ce3a7a039f0fabeb8cf5fc5dd` | Research-wall backport via Core130; six-file batch covers meeting-cancel receipt and mail pre-dispatch refusal. Core API Engagement writers are frozen and outside Data/Domain continuation. |
| [FE151](https://github.com/neo-capiro/capiro-frontend/pull/151) | `dc53633f0b8c4de6432f3840e4fc79ac2ffeb02a` | Nine accepted current-access/session/view lifetime/connection/Mail/Billing/deployment corrections, 42 paths. Workspace history/library source is disjoint; do not edit shared auth/session/deployment/architecture registry. Retained combined unit/browser failures remain failures. |
| [Meri252](https://github.com/neo-capiro/meri-greenfield/pull/252) | `7eee7f7c358be9ae903169816ef68eb6e64ae1f3` | Advancing-clock reads, Settings validation, current tenant/role capability policy and native-history compatibility/custody, 34 paths. Runtime/control owners are frozen; do not fix old-base behavior already corrected here. Two retained combined behavioral failures remain explicit. |

PR descriptions and changed-file lists were inspected for these dependencies; no full product diff review or live acceptance was performed by this docs author. Root's supplied live release observation remains images built/reviewed, AgentCore7 READY/DEFAULT7 but preview6 serving, final services cutover pending. This manifest does not refresh the historical Wave2 handoff cutoff and does not declare Wave2 complete.

**Hard hold:** final successor contract adoption, rebase/integration, deployment and release-dependent live acceptance wait for Root's explicit Wave2 completion notice with final exact source/contracts/config/images/acceptance. There is no final Wave2 integration base to invent. Current independent work must not edit frozen release candidates. Onboard migration `20261025120000_onboard_email_delivery_claim` remains NOT LIVE. Applied migrations immutable. MG06 persisted-index proposal pending/unallocated. No new Workspace approval workflow, P2 read expansion, M4 sender/action or M5 generation scope follows from retained ticket quotations.

## Launcher contract and reporting

The existing launcher reported Hermes `0.21.5+4410.g2ec7703`, configured OpenRouter `deepseek/deepseek-v4.1-flash`, supporting the request `--reasoning xhigh`. **Effective provider reasoning is UNVERIFIED**; do not claim provider enforcement or alter the existing configuration. Fresh query-file/`--in`/`--oneshot`/stream-json/`--pass-session-id` launch only, no resume/continue. The launcher's `--ignore-rules` isolation suppresses automatic AGENTS/SOUL/memory/preloaded skills; the complete brief plus explicit canonical rules/plans/host and applicable repository instructions must be supplied/read. No credentials or model provider calls are authorized to this docs author. Root's mechanical launcher owns the approved execution.

Use the full brief as the session input, not a summary alone. Root authorizes only these three sessions and the separate reviewer; preserve unrelated Hermes processes. Record actual branch/worktree/base, start UTC, local brief SHA-256, fresh session/log name and requested reasoning privately. Model/provider-effectiveness claims require actual evidence and are not inferred from a CLI flag. Do not create a heartbeat/watch service. Stop/report an actual scope/ownership conflict; otherwise ordinary in-plan decisions proceed and are logged.

Authors return exact head/tree/changed files, commands/versions/exits/UTC/results, new-test mutants, base-versus-head failures, deletion grep, not-run gates with named owners, private evidence by name and remaining acceptance. Reviewer uses PROCESS6.2; Root/Release/Acceptance own PROCESS6.3 and integration/deploy. All public data uses counts/booleans; no customer-linked identifiers/UUIDs/secrets. Preserve all shared environment and predecessor evidence. Docs-only preparation added no executable tests: mutations N/A; product tests/build/database/browser/provider/live checks NOT RUN by this author.
