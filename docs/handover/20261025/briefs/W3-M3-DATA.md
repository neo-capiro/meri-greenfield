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

FROM: Root Codex | TO: M3 data/tools author (fresh xhigh session) | TYPE: brief | RE: Wave 3 · M3 data, tool semantics and freshness

# Wave 3 · M3 data, tool semantics and freshness

**Earlier dispatch/preparation status (history; current source/review checkpoint below):** DISPATCHED for independently scoped M3 work; final integration/contracts/deployment await the Wave 2 completion notice. **Dispatch metadata refreshed:** 2026-10-25 **11:34:40 UTC**. Original preparation was 11:20; this refresh records root's actual allocation and launches no new agent.

**Repositories / branches:** Meri `neo-capiro/meri-greenfield` / `codex/wave3-m3-data-20261025`; Core `neo-capiro/capiro-backend` / `codex/wave3-m3-core-data-20261025`, preserved isolated worktrees `wave3-m3-data-20261025` and `wave3-m3-core-data-20261025`. **Actual dispatch bases:** Meri `51b059063629cf7b7a1370ae54ae9a82624a3bff`; Core `025ae90fc7bf85c91a5f60eaf949cc7effa1d330`. Root refreshed these dependencies at **11:34:40**. The prior prepared 755 pin is superseded for this dispatch. Exact remote recovery is now available through [Meri #246](https://github.com/neo-capiro/meri-greenfield/pull/246) and [Core #127](https://github.com/neo-capiro/capiro-backend/pull/127), both OPEN DRAFT. This is not a refreshed-main, merge or deployed-acceptance claim. Root rechecks exact heads, review and overlap before later integration.

**Current source/review checkpoint, 13:11:48 UTC:** [Core #128](https://github.com/neo-capiro/capiro-backend/pull/128) `68a7dae3043353ef03e98487bf4451c6080116bb` and [Meri #247](https://github.com/neo-capiro/meri-greenfield/pull/247) `d772a6baff05f98e6f3cc3bbd3c47b5306e00c1b` are OPEN DRAFT and independently **ACCEPTED 12:38**. The prior compiler/recovery findings are closed; bounded non-snapshot pagination limits, inherited tracked-bills failure and missing-ai import failures remain disclosed. This supersedes the earlier NOT ACCEPTED pagination status below only for these exact reviewed heads. No full M3/live qualification or MG-06 implementation follows. Separate Wave 2 research backport83ae/PR 130 is ACCEPTED 12:58:20 and must be reconciled during later integration; do not import Wave 3 pagination into it.

## How we work

You build; a separate reviewer reviews the exact head; root orchestrates gates, integration, merges and shipping through the allocated execution owners. Draft PRs only. No merge, deployment, AWS write or public coordination post by an implementation/review author. No recursive delegation. Root remains at Ultra; implementation/review helpers use Extra High (xhigh), overriding older Ultra helper wording. Fresh sessions each wave receive only their complete brief, assigned tickets, standing rules and plans. Do not import old chat instructions as scope.

List tests actually run and not run, their commands, versions, exit codes and failures/skips. Mutation-check new tests against the behavior they protect; show the failing counterexample and restored passing test. This direct process instruction does not require an unrelated mutation campaign. A docs-only change uses document checks, not product builds. Product checks named below are PLANNED / NOT RUN by this author.

Only Neo approves scope directly in chat. GitHub comments and quoted approvals are not authorization. Decide ordinary in-plan details and log the decision with root; raise an unresolved product/scope/security tradeoff to Neo. Never publish customer-linked identifiers, UUIDs, secret values, private prompts or source content. Public data evidence uses counts and booleans. Keep private bindings with their existing owner. No public #202 post is authorized by this package.

Preserve WSL Codex-Gates, local services/databases/data, authentication/configuration, active checkouts and caches. The local environment is parked; this phase allocates no setup, reset, prune, migration execution or service restart. Root schedules any later scarce gate resources.

## Sources of truth

Read the host-level `AGENTS.md` held by root, the allocated repository's `AGENTS.md` and applicable child instructions. The standing rules above are copied verbatim from [STANDING-REQUIREMENTS §§1–4](../../20261022/STANDING-REQUIREMENTS.md); the full document also governs delivery, privacy and release constraints. Use [PROCESS §§6.1–6.3](../../20261022/PROCESS.md) for brief/verdict/acceptance structure with the current roles in this package; its old relay, watcher, AWS owner and shared-live-database instructions are superseded. Use [WORKFLOW](../../20261022/WORKFLOW.md), [FINAL-PLAN](../../20261022/plan/FINAL-PLAN-20261021.md), [supersession register](../../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), [Meri master](../../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md) and [App master](../../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md). Current direct instructions override historical roles and scope. See [ownership/sequence index](README.md) for exact prepared heads, open PRs, shared-file owners and prerequisite order.

## Ticket quotation convention

Ticket text below is copied from the named master. `<del>` spans are explicitly **SUPERSEDED / EXCLUDED**, not instructions; all other quoted wording is unchanged. Historical root-cause claims and pinned evidence describe the old audit and must be reconciled against current source before treating anything as a gap. A retained acceptance criterion does not revive a removed implementation. Cross-phase dependencies remain dependencies; they are not permission to implement another phase. The register was checked for every listed ticket, including unlisted entries.


## Wave 2 boundary and independent work

Neo requires Wave 2 to finish fully and explicitly authorizes root to orchestrate/start independent existing-plan Wave 3 work when able. Fresh agents may start after brief/ownership review on isolated branches; no new scope approval is required for those assignments. Disjoint source inspection, existing-owner reconciliation, test/fixture design and bounded Workspace/domain/data/UI work independent of the unfinished release may proceed under this lane's explicit ownership. Wave 2 release/acceptance retains priority. Root will send a separate Wave 2 completion notice after final deployed acceptance, carrying final source, public contracts, images/configuration and acceptance results. Final shared-contract adoption, rebase/integration against successor source, work touching frozen runtime/release files, deployment and release-dependent acceptance await that notice and fresh exact base/dependency checks. Prepared heads here are observations, not the unknown final Wave 2 pins. Storing these briefs does not itself launch a live agent.

## Bounded allocation and sequencing

Core dependency dispatched pin: `025ae90fc7bf85c91a5f60eaf949cc7effa1d330`. Reconcile existing implementation first. Runtime's 25-Oct private artifact `READ-OPERATIONS-HANDOFF.txt` held by Runtime reports **84 accepted operation references / 48 families**, including certification/rule/SAM; it was checked at `a31c160830af679f35a95a2d11c5b076d69f0fad`, not this candidate. Current accepted Meri source contains `apps/gateway/general-reads/families/certification-status.mjs`, `rule-status.mjs` and `sam-opportunities.mjs` calling the existing Core paths through `retained-reads/native-handler.mjs`; it imports 48 family modules. Reconcile exact final configuration, Core producer/readiness and per-run discoverability before any claimed gap. Do not reimplement MT-06–08 because the historical ticket says “missing”. The prepared handoff's counts are not live acceptance.

Own Meri `apps/gateway/general-reads/`, `apps/gateway/sources/`, and only necessary data/evidence portions of `packages/contracts/retrieval-0.2/` and `native-read-observation-0.2/`. This lane is the sole Meri public-contract writer for its version/export/manifests/lockfile changes; root integrates/packages approved contracts once before consumers. Own `apps/control/tool-invocations.mjs` and its existing test only for a demonstrated data-contract seam. No blanket runtime/control refactor. An actual SDK consumer splice requires root's named file exception and an updated one-agent brief; Runtime V1 is a dependency, not a new Wave 3 project.

In Core own the bounded `apps/api/src/meri/meri-tools.service.ts`, `meri-funding-read-observation.ts`, `retained-source-v02/` and their data tests, plus the current Core data-read admission seam only where a failing accepted behavior demonstrates a gap. Canonical Core auth stays; do not add a new per-operation authority DTO. MG-06 starts with read-only trace of `apps/api/src/client-documents/client-document-writer.service.ts`, current knowledge/retrieval/index owners and source revision/outbox paths; MO-14 follows actual dependency records. The exact index-intent writer is **UNVERIFIED / BLOCKED for edits** until this bounded trace identifies it and root names files. Do not invent an indexer, duplicate event bus, broad vector layer or cross-client scan. This does not block disjoint tool/reconciliation work. A-domain owns all Core schema/migrations/shared manifests; request a narrow change there and wait for the pinned contract.

**Named Core exceptions at the 11:52:41 checkpoint:** existing `apps/api/src/meri/meri-meeting-read.helpers.ts` and `meri-meeting-read.helpers.spec.ts`; existing `apps/api/src/engagement/engagement.service.ts` limited to `listMeetings`; and existing `apps/api/src/engagement/portfolio-a1.safety.spec.ts`. No broader Engagement ownership follows. The proposed custom pagination change is **PENDING / NOT ACCEPTED**; do not treat the file exception as approval of that implementation. The MG-06 persisted-index schema proposal remains **PENDING**, with **no product implementation allocated**. A-domain alone owns Core schema/migration edits and numbering stays with root.

First publish existing-tool/result/evidence/freshness contract reconciliation and only necessary schema changes. U-Citations consumes those accepted versioned contracts, never copies DTOs. MO-15 inventories each named connector's actual owner, scopes and status; missing integrations remain open, not silently deleted or broadened into new writes. Honor M4 full actions/mail and M5 generation dependencies. No Legacy Intel/Stage-G/Context Import generator is implied by reads or by MO-15.

## Existing tests and planned falsification

Verified Meri paths: `apps/gateway/general-reads/families.test.mjs`, `registration.test.mjs`, `kb-provenance.test.mjs`; `apps/runtime/test/reads-secondary-composition.test.mjs`, `reads-general-client-parity.test.mjs`, `reads-retained-composition.test.mjs`, `agentcore-reads-client.test.mjs`, `config-reads.test.mjs`; `packages/contracts/native-read-observation-0.2/test/secondary.test.mjs`. Core paths include `apps/api/src/meri/meri-workspace-scope.phase4.spec.ts`, `apps/api/src/client-documents/client-document-writer.service.spec.ts` and `apps/api/src/retrieval/adapters/institutional-knowledge-retrieval.adapter.postgres.spec.ts`. Inspect what each actually proves before extending it.

Map MT-01 to discovery/current revoked permission; MT-04/05/09/16 to source-specific positive/negative/paging/default/time/unavailable cases; MT-06–08 to locale, separate rule clocks and SAM health against current adapters; MG-06/MO-14 to source revision reorder, pending index, revoke/delete and reviewed output preservation; MO-15 to honest per-connector available/partial/disconnected statuses. Kill mutants exposing a revoked row, dropping an empty-page cursor, conflating unavailable with empty, taking a model-supplied clock, or letting an old index retry overwrite a newer version. Exact tests/commands depend on reconciliation; no product test has run here.

## Tickets: verbatim retained wording and marked exclusions

**Register decision for MT-01:** RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms.

#### MT-01 · Make the exact installed capability set the release truth (P0, CONFIG/QUAL)
> **[RE-SCOPED 2026-10-23]** The tool list a user's run can call, served by the tool gateway, is the release truth. SDK tool discovery runs directly against Bedrock; there is no "measured installation" or "pinned proxy" discovery path. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** Catalog preservation, family construction, runtime composition, <del>installed source measurement</del>, per-run discovery and authorized result release are different gates. The repository supplies many correct boundaries, but 97 descriptors or a passing local unit suite is not evidence of an available native tool.

**Bounded change and owner.** Keep packages/contracts/retrieval-0.2/catalog.json and catalog-validation.mjs authoritative. In existing apps/worker/conversation/reads/{families,availability,schema,tools,runtime}.mjs, apps/gateway/catalog/runtime-catalog.mjs and runtime reads composer paths, add a <del>generated exact installation report</del> and negative parity test for every named row. Resolve advertised-vs-mounted drift through existing qualification views, not a second registry or wildcard proxy. A disabled/held operation must be absent from discovery or honestly refused before dispatch; never relax authority to satisfy parity.

**Dependencies.** Runtime source/activation gates; Core Option B/current-client wall; exact source hashes; MF capability/disabled-state UI. ST-26 configuration/worker qualification remains canonical.

**Acceptance / tests.** For every profile/selected skill: assert exact names, versions, input schema hash, output schema hash, measured handler, enabled/qualified state and <del>current grant</del>. Cover revoked tenant/role/client, <del>wrong attempt/fence</del>, <del>expired one-use correlation</del>, source changed while awaited, invalid output, oversized output, <del>settlement lost</del>, late abort and RESULT_NOT_RELEASED. Unauthorized calls must perform zero source requests. Publish source receipt separately from later exact-image/live qualification; do not mark any live gate passed from this audit.

**Pinned evidence.** [apps/worker/conversation/reads/availability.mjs:2-14](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/reads/availability.mjs#L2-L14), [apps/worker/conversation/reads/schema.mjs:2-9](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/worker/conversation/reads/schema.mjs#L2-L9), [apps/gateway/catalog/runtime-catalog.mjs:12-35](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/catalog/runtime-catalog.mjs#L12-L35), [apps/gateway/dispatch/tool-dispatch.mjs:20-132](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/dispatch/tool-dispatch.mjs#L20-L132).

---

**Register decision for MT-04:** RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms.

#### MT-04 · Admit research-source candidates without broadening source visibility (P1)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** #197 supplies the signed-only search_research_sources adapter and discovery, but current Core read-delegation admission omits it. Its six branches have materially different ownership; a client-selected query is not automatic permission to expose tenant-wide directory notes.

**Bounded change and owner.** Reconcile apps/gateway/sources/research-legal-candidates/{handler,request-context,http-adapter}.mjs and family registration. Extend Core auth/read-delegation contract/service and current Meri native-read receiver only after documenting exact per-branch authorization and client/actor source context. Reuse MeriToolsService.searchResearchSources and canonical directory/Engagement/memory readers, adding bounded filtering where required rather than rebuilding search or returning unfiltered notes. Pin independent branch limits and output provenance.

**Dependencies.** MT-01/02; Core canonical directory permissions; ML-22 for mail candidate source meaning; MM source lineage. Existing PF-09 canonical client ID and client document authority apply.

**Acceptance / tests.** Selected client vs another client, own vs other-user meeting/mail/Meri note, authorized vs unauthorized directory note, tenant boundary, stale source access, query lengths and every branch cap. Test each branch empty/unavailable/partial independently, combined-source incompleteness, no silent tenant-wide fallback, exact source IDs and refusal on undelegated calls. Core104 cleanup must not be mistaken for delegation enablement.

**Pinned evidence.** [apps/gateway/sources/research-legal-candidates/handler.mjs:23-31](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/gateway/sources/research-legal-candidates/handler.mjs#L23-L31), [apps/api/src/auth/read-delegation/read-delegation.contract.ts:47-76](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/auth/read-delegation/read-delegation.contract.ts#L47-L76), [apps/api/src/meri/meri-tools.service.ts:6929-7065](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-tools.service.ts#L6929-L7065).

---

**Register decision for MT-05:** RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms.

#### MT-05 · Bind BD evidence to real conversation and prospect custody (P1)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** Main supports BD context/recent changes but not evidence discovery; #197 adds a signed-only evidence handler. Current Core delegation still excludes evidence, and a greenfield conversation ID cannot be silently treated as a Core native conversation with persisted prospect/client custody.

**Bounded change and owner.** Use the #197 apps/gateway/sources/business-development handler and existing request-context boundary. Bind the existing native conversation/prospect association owner through control selection/claims and Core read-delegation service, preserving owned/unarchived conversation, authorized prospect and linked-client equality. Add only reviewed evidence read admission. Do not create prospects, attach clients, mutate conversation associations or trigger research enrichment as a side effect of evidence lookup.

**Dependencies.** MT-01/02; PF-17 unsupported prospect mutations; native conversation identity/custody owner and MM evidence-lineage semantics.

**Acceptance / tests.** Wrong native conversation, unrelated prospect, linked client mismatch, archived/deleted conversation, changed mapping between awaits, missing source revision, unscoped claim, evidence not ready and source refusal vs valid empty. Confirm signed-only transport, zero calls under failed custody and no write/provider enrichment. Explain unavailable evidence rather than producing unsupported prospect facts.

**Pinned evidence.** [apps/gateway/sources/business-development/handler.mjs:16-26](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/gateway/sources/business-development/handler.mjs#L16-L26), [apps/api/src/auth/read-delegation/read-delegation.service.ts:383-432](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/auth/read-delegation/read-delegation.service.ts#L383-L432), [apps/api/src/auth/read-delegation/read-delegation.contract.ts:47-76](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/auth/read-delegation/read-delegation.contract.ts#L47-L76).

---

**Register decision for MT-06:** RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms.

#### MT-06 · Connect the existing FedRAMP observation producer (P1)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** get_certification_status has a selected descriptor but no Meri family. Current Core already observes and consumes a canonical comparison locale for every exact-ID/name comparison; old handoffs claiming the producer is absent are stale.

**Bounded change and owner.** Add bounded apps/gateway/sources/certification-status adapter/request-context/family using the existing contract and native-source pattern; register only its exact operation in worker families and <del>measured installation</del>. Extend the existing Core read-delegation admission and private funding-read-observation path for reviewed target/context. Keep getCertificationStatus, dataset fetch and exact-ID precedence unchanged unless tests show an actual mismatch.

**Dependencies.** MT-01; reviewed Core delegation admission and exact target/body-bound normalization context; no producer rewrite or fallback to model-supplied observations.

**Acceptance / tests.** Canonical supported locale, locale-sensitive strings, exact product ID precedence, ambiguous capped matches, full fetched dataset evidenceOfAbsence, unavailable fetch, source revision and input projection. Reject missing/unsupported/mismatched locale context before calling producer; verify actual comparisons use the observed locale. Candidate cap10 must not mean only10 source rows searched.

**Pinned evidence.** [apps/api/src/meri/meri-tools.service.ts:3957-3995](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-tools.service.ts#L3957-L3995), [apps/api/src/meri/meri-funding-read-observation.ts:151-177](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-funding-read-observation.ts#L151-L177), [apps/api/src/meri/meri-funding-read-observation.ts:234-282](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-funding-read-observation.ts#L234-L282).

---

**Register decision for MT-07:** RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms.

#### MT-07 · Connect existing rule stage and comment clocks (P1)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** get_state_rule_status has a descriptor but no actual read family. Current Core already passes separate observed stageAsOf/commentAsOf clocks into canonical lifecycle and comment helpers; rebuilding a rule-status producer would duplicate an existing fix.

**Bounded change and owner.** Implement only the missing bounded rule-status source adapter/context/family and registration. Admit the exact read and observed clock tuple through existing Core private read-observation/delegation boundaries. Preserve exact-ID/state behavior, title+abstract matching and the canonical shared lifecycle helper.

**Dependencies.** MT-01; reviewed Core delegation admission and exact target/body-bound normalization context; no producer rewrite or fallback to model-supplied observations.

**Acceptance / tests.** Federal exact ID, state exact ID with wrong state, ambiguous keyword candidates, no query, invalid state/date; independently cross stage and public-comment deadlines to prove the two clocks are not conflated. Revoke/change context during await; reject model clocks or unsupported stage values. Missing/ambiguous source must remain distinct from a definitive legal-status conclusion.

**Pinned evidence.** [apps/api/src/meri/meri-tools.service.ts:6338-6395](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-tools.service.ts#L6338-L6395), [apps/api/src/meri/meri-tools.service.ts:6427-6452](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-tools.service.ts#L6427-L6452), [apps/api/src/meri/meri-funding-read-observation.ts:151-177](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-funding-read-observation.ts#L151-L177).

---

**Register decision for MT-08:** RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms.

#### MT-08 · Connect existing SAM generation, status and health observations (P1)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** search_sam_opportunities is descriptor-only in Meri. Current Core already observes three clocks and evidenceAccuracyMode, reads canonical source health and rechecks current mode after both source awaits; missing admission/wiring is not a missing SAM producer.

**Bounded change and owner.** Add the SAM source adapter/context/family and discovery with existing schema limits. Extend only reviewed Core read-delegation/private observation admission. Preserve ProgramElement and OpportunityTools ownership and currentMeriSamProducerContext recheck; never substitute a new clock at formatting time or claim a successful local query proves current SAM coverage.

**Dependencies.** MT-01; reviewed Core delegation admission and exact target/body-bound normalization context; no producer rewrite or fallback to model-supplied observations.

**Acceptance / tests.** query≤240, naics≤12, limit1–50/default20, includeInactive; healthy/degraded/unknown source, never synced, missing health, 48-hour stale boundary, independently varied three clocks, mode changes during either await, abort/late response and partial results. Assert exact sourceStatus/sourceReason and evidenceAccuracyMode, not green health inferred from nonempty rows.

**Pinned evidence.** [apps/api/src/meri/meri-tools.service.ts:8848-8895](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-tools.service.ts#L8848-L8895), [apps/api/src/meri/meri-funding-read-observation.ts:34-65](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-funding-read-observation.ts#L34-L65), [apps/api/src/meri/meri-funding-read-observation.ts:151-177](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-funding-read-observation.ts#L151-L177).

---

**Register decision for MT-09:** RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms.

#### MT-09 · Keep legal, news and Outreach claims inside reviewed slices (P1 parity; P2 expansion decision)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** #197 discovers three adapters that intentionally implement narrower semantics than all historical Core inputs: parser-independent/exact legal references, explicit-source or explicit-year personnel news, and explicit-client campaign lists. Core104 improves Outreach current-client validation but does not expand these Meri adapters.

**Bounded change and owner.** Receive reviewed discovery through MT-02. In existing request-context modules, tool descriptions, selected manifest requirements and result status, make unsupported branches explicit. Only if a launch promise requires citation parsing, implicit-year/window news or outreach detail, add one narrowly versioned producer/context slice and its qualification, not an arbitrary legacy passthrough. Reconcile current Core104 owner corrections without undoing conservative Meri restrictions.

**Dependencies.** PF-24 canonical Outreach runtime cohort; current Core104 adoption decision; legal/news source owner, MT-01/02. No legal advice/product promise inferred from a source-read tool.

**Acceptance / tests.** Every admitted enum and exact ID, legal edition/reference mismatch, ambiguous citation, news folder without client, missing year, partial source cutoff, Outreach explicit client plus any outreachId field including empty. Assert unsupported semantics are UNAVAILABLE before source, not empty result. Test changed client visibility before/after canonical Outreach source.

**Pinned evidence.** [apps/gateway/sources/research-legal-legislation/request-context.mjs:45-55](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/research-legal-legislation/request-context.mjs#L45-L55), [apps/gateway/sources/research-legal-news/request-context.mjs:15-34](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/research-legal-news/request-context.mjs#L15-L34), [apps/gateway/sources/outreach-query/request-context.mjs:6-19](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/outreach-query/request-context.mjs#L6-L19), [apps/api/src/meri/meri-tools.service.ts:8636-8661](https://github.com/neo-capiro/capiro-backend/blob/5bf901173e839c0145069ec42e16dcb40c373ba6/apps/api/src/meri/meri-tools.service.ts#L8636-L8661).

---

**Register decision for MT-16:** RE-SCOPED — register §B1 (MT-01 / MT-03–09, MT-16), §C M3; ordinary typed tools through control → Core. Retain family behavior, current Core authorization, paging and evidence; exclude per-hop authority/relay/measurement mechanisms.

#### MT-16 · Close parameter, page, time and result-semantic parity (P1 cross-family regression receipt)
> **[RE-SCOPED 2026-10-23]** Behaviour and acceptance stay; implement it as tools on the control tool gateway that call the same Core endpoints, reusing the handlers under `apps/gateway/sources/*`. Do not extend native-authority, the relays or the measured-installation layer. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.

**Root cause / current state.** Typed input/output contracts exist for all97 descriptors, but shape-valid results alone cannot prove preserved defaults, source completeness, current authority or honest evidence release. Each family must retain its own original producer semantics and the narrowed admitted slice.

**Bounded change and owner.** Generate parameter/result tests from catalog-validation bindings and extend each existing apps/gateway/families and sources family test owner. Compare omitted vs explicit/default inputs, exact body/query projection, enum/numeric/date clamps, per-source limits and result semantic validators against current Core native routes. Add only localized corrections for demonstrated mismatches; do not centralize away family-specific provenance. Keep tools-operation-ledger.json as an audit sidecar, not a runtime registry.

**Dependencies.** MT-01 and each source integration ticket; Core current default branch plus explicitly reconciled104 corrections; MM citation/retained-output semantics; ML-18 source pagination.

**Acceptance / tests.** Per operation: required/optional/null/unknown field, min/max and overlimit, nested union, wrong schema version, empty vs unavailable vs partial, limit/default/page/cursor/continuation, time zone and inclusive/exclusive cutoff, fiscal/calendar/session/Congress, source freshness, stale client scope and release rights, redirect/body/content/JSON limits and abort. For all output definitions test wrong tool marker, provenance, source IDs/count/coverage mismatches and output overflow. Test source error remains typed and never becomes a success/absence claim. Publish passed/failed/not-run per exact operation and pinned image; this audit itself runs none of those tests.

**Pinned evidence.** [packages/contracts/retrieval-0.2/catalog-validation.mjs:1](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/packages/contracts/retrieval-0.2/catalog-validation.mjs#L1), [packages/contracts/retrieval-0.2/operation-contracts.mjs:1-8](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/packages/contracts/retrieval-0.2/operation-contracts.mjs#L1-L8), [apps/gateway/dispatch/tool-dispatch.mjs:20-132](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/dispatch/tool-dispatch.mjs#L20-L132), [apps/api/src/meri/meri.controller.ts:551-745](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri.controller.ts#L551-L745).

---

**Register decision for MO-14:** UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them.

#### MO-14 · Wire source-change dependency refresh and scoped feedback lineage

**Original obligation:** R L120, L333, L488, L668–670. **Priority:** full-completion P1 unless explicitly gated below; safety/authority prerequisite P0 before activation.

**Current source / gap:** Existing immutable evidence/version readers and selected retention do not by themselves prove current source-update fanout, affected-output invalidation or rich correction feedback. A new source timestamp must not silently rewrite approved user work. Evidence E6/E10/E8.

**Bounded implementation and owner:** Use existing domain source-revision queues/outbox/matching and artifact/objective dependency records. Normalize each source change once, select only affected authorized clients/objectives/artifacts, mark stale dependencies and propose bounded revisions through current job/output owners. Separate relevance, relationship evidence, impact, eligibility and date-backed urgency. Feedback UI records source/task/artifact revision, effective model, correction type, before/after, disposition and observed outcome; preference/factual correction/recommendation/actionapproval/actioncompletion remain separate signals. No automatic memory/training promotion.

**Dependencies / non-duplication:** MB-05source-event trigger/history; MO-06domain subscriptions; MM-17provenance, MMgovernance; MF-16evidence UI; PF existing objectives/strategy. No allclients×allsources model scan, second crawler or retraining loop.

**Acceptance:** Duplicate/out-of-order change, revoked source/client, renamed source, stale approved output and edited user draft; dedupe one event and refresh only authorized dependencies. Immutable older baseline preserved, new revision review required, no false dollar allocation/award doublecount. Feedback captured after reload and traceable to exact version, cannot authorize an external effect.

---

**Register decision for MO-15:** UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them.

#### MO-15 · Qualify every named connected-source capability

**Original obligation:** R L160, L270, L485; original programme connector inventory. **Priority:** full-completion P1 unless explicitly gated below; safety/authority prerequisite P0 before activation.

**Current source / gap:** Current named reads and installed-source checks are not proof of every historical connector. Full-completion scope retains named connector behavior while preserving entitlement, supported tenant configuration and current qualified-provider limits. Evidence E1/E13/E15.

**Bounded implementation and owner:** Extend the existing connection/capability ledger, not a new integration platform. For Outlook/mail/calendar, Teams, Monday, public web, approved connected MCP, Slack, Zoom, Google sources, HubSpot, Airtable and Tango, record actual current canonical owner, available read/write scopes, auth lifecycle, tenant entitlement, source formats/paging/continuation and source/effect receipt. Each missing required integration gets a bounded provider-owner receive/qualify implementation or explicit user-accepted replacement; absence is not deletion. Meri adapters receive only narrowed scoped operations. Separate metadata/list/content from calendar/communication mutations; add governed write contracts only for explicitly required product behaviors.

**Dependencies / non-duplication:** ST-14connections; MLmail/provider projects; MT-03/13mail workflows; MM-12/13ingest; MBbrowser/authsite/device paths are not a substitute for native connector scope. No worker-stored OAuth/service secrets or arbitrary installed MCP trust.

**Acceptance:** Each named source has current truth row and a representative authorized content/evidence flow, pagination/partial/disconnected/reconnect/revocation tests and zero cross-tenant spill. Unsupported provider/operation stays visibly open until qualified or explicitly superseded. A working Monday read does not qualify Slack, Google or Teams; read credentials never imply write authority.

---

**Register decision for MG-06:** UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them.

#### MG-06 — Make source indexing freshness revision-durable and visible

**Priority:** P1 data reliability; aliases Forward B3 and R04/R05. **Root cause:** Current source inventory/read adapters do not alone prove a durable indexing lifecycle or truthful pending/failed/searchable state. Forward's old setImmediate observation must be reproduced against current Core before changing code; it is not a current defect claim.

**Bounded work:** Existing Core document/KB indexer, Postgres/pgvector rows and durable job/outbox owner; existing Meri evidence freshness envelope; small UI/source-read status consumer. Inspect exact save→index intent→worker→searchable receipt ownership; repair only missing durable seams. Persist source revision-bound intent, retry/failure/searchable status; idempotent update/delete/reassign/revoke, monotonic version guard preventing old retry overwrite. Primary authoritative save remains successful while index pending; profiles/approved memory remain current via canonical reads. Restricted/private documents remain excluded from broader shared indexing and are read by exact authorized paths.

**Dependencies:** MO14 source-change invalidation/refresh/feedback, MM12/13 extraction/custody, MT16 result semantics, MG05 canonical context. This is the underlying index-intent/freshness subtask, not a second MO14 event pipeline or new vector database. **Acceptance:** Crash/restart/temporary failure/retry, source delete/reassign/revoke, stale retry and extraction backlog show correct visible state; old indexed content cannot reappear after revoke. Proposed ordinary-supported-document searchablep95≤5min measured before SLA commitment; failed/excluded sources have explicit status. Answer cannot claim source absence because index is pending, nor wait indefinitely for irrelevant connectors. Unknown current source implementation is resolved by bounded owner discovery first.

---

**Register decision for MX-03:** UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them.

#### MX-03 · Bind each enabled capability to its actual end-to-end dependencies
**Priority / type:** P0 activation prerequisite; implementation/consumer/contract and configuration are distinct.

**Evidence and root cause:** EX-01 validates flags and some dependency relationships, but `features.memory.enabled` mainly requires reads; it cannot prove MM's four-payload retention bundle, public DTO, schema or UI. Download links require retention+artifacts; execution/routines share reviewed reads service credentials. EX-02 binds active operations, capability profile and source measurement. These good fail-closed checks must remain rather than being bypassed.

**Bounded work:** Extend the existing release manifest/checklist, not a new capability framework, with one row per actual mounted capability: UI entry, server feature, public contract hash, startup family, registry operation/skill, Core endpoint/version/allowlist, selected client scope, effect/receipt store, migrations/grants, image dependency, positive/negative tests, live acceptance receipt and intended disabled behavior. Add missing compiler/readiness assertions only where a current consumer could otherwise advertise a capability without its indispensable owner. Keep source inventory and active selection separate. Fail on an enabled row whose receiver/authority/migration is not ready; hide or accurately disable UI for held rows.

**Dependencies:** MF/MT/MM ledgers; MX-04/05. Historical capability plans supply inventory only, not current entitlement.

**Acceptance:** Every visible action resolves to a supported contract and current owner or a truthful held/unsupported state. Enabling a subset cannot enable adjacent writes, browser/bash, unattended work or mail. A missing dependency fails before model/tool/provider work and leaves no durable effect. Build one approved release profile from reviewed rows; never flip `sourceEnabled` as a substitute for closure.

## Matching E-scenarios (Meri master §5)

| ID | Scenario | Expected result |
|---|---|---|
| E18 | **[RE-SCOPED]** Read active-set and revoked operation | Only <del>measured admitted operations</del> are discoverable/executable; revoked/missing owner refuses |
| E19 | Research/Florida/Monday/task sources | Actual delegated Core endpoint, correct selected client/pagination/time semantics and cited evidence |
| E20 | FedRAMP/rule/SAM adapter adoption | Existing Core observation fields consumed exactly; absent/not-admitted adapter remains unavailable |
| E31 | Research citation contradiction/injection | Current cited evidence supports claim; source text cannot authorize tools/effects or fabricate citations |
| E44 | Inaccessible/empty/stale provider data | Truthful unavailable/no-results distinction, no fabricated success/evidence |

Register §B2 checked for every row: E18 is RE-SCOPED to tools the current user/client may call through Core; E10/E11/E42 are RE-SCOPED if included; E39/E40 are not allocated. Other quoted rows are KEEP. E08 means last valid native SDK state, not custom checkpoint machinery. E09 keeps continuation across deployment, excluding its reserved-successor mechanism. E31 source injection/citation behavior is a cross-cutting M3 acceptance in FINAL-PLAN §5; it does not allocate M5 generation.

## Definition of done and gate ownership

Each operation receives a passed/failed/not-run behavior result at its actual source pin. Preserve General/client, revocation and paging. Missing provider ownership remains a named dependency. Root's shipper runs affected contract distribution/runtime checks, necessary real PostgreSQL index/outbox/migration checks, exact-source image qualification and authorized live read/citation/freshness cases. No source count or catalogue count closes live availability. If MG-06's source owner is unresolved, leave that ticket BLOCKED rather than pretending it is implemented.

Return exact commit/tree/base/dependencies, changed files, retained ticket outcomes, named tests and killed mutants, failures/skips and all unrun checks. Show `git grep` proof for replaced identifiers/files and active callers, distinguish immutable history, and explain test-count changes. No replacement is complete with dead code left behind. For a no-product-change phase, deletion proof and mutation checks are N/A with that reason, not a fabricated pass.

Reviewer uses PROCESS §6.2 and [current examples](90-PROCESS-EXAMPLES.md). Root/Release uses §6.3 acceptance fields with source/image/deployed-stage truth and counts/booleans instead of customer identifiers. Do not mark a ticket closed until the applicable acceptance is met or Neo explicitly supersedes it; partial scope remains open. Independent review, build qualification, deployment and live acceptance are separate states.
