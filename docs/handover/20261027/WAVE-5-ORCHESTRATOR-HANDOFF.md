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


# Wave 5 orchestrator handoff — 27 October 2026

**Current authority — user-requested stopping point:** the existing Wave 5 orchestrator `01a17d3b-4cf1-7f21-a8ac-f0aa7cd0380d` now coordinates and finishes the remaining Wave 4 work. Existing Release chat `01a17ae6` remains the sole shared target operator; Hermes Agent app/CLI remains the independent review and acceptance owner. The old Wave 4 root stops product and release work at reviewed source integration. Follow the [Wave 4 to Wave 5 takeover](WAVE4-TO-WAVE5-TAKEOVER.md) for the exact remaining sequence and owner references. Earlier root/Fable assignments below are retained history, not a second active orchestration lane.

Prepared 2026-10-27 and updated at the user-requested Wave 4 source-integration stopping point. **This packet now includes ownership of the remaining Wave 4 work; it is not a Wave 4 completion or Wave 5 shipping claim.** The sibling takeover handoff gives the current exact sequence.

## 1. Stopping point and purpose

The user now asks the old Wave 4 root to stop at reviewed source integration and the existing Wave 5 orchestrator to finish the remaining Wave 4 work. Continue the existing Release and Hermes owners; do not create a second operator or repeat the returned Fable scan. Confirmed M5/M7/MF-19 source allocations may continue independently with their existing file reservations.

The then-pending Wave 4 migrations/deployments completed at 11:51:37.565 UTC on 27 October; section 2 preserves that historical handback. Core PR195 is merged at `8d77e225fe3c16c891190654efeea8050978aaf8`, equal to reviewed `b49f010174de9a2dfaa598f327caf62761138283` tree `360fe212a3ef699ecb2e5cf7359671ede3d4cf32`. Frontend PR252 is merged at `d96087ae977465ccaec8e25f728e2a80acb1ebd4`, equal to reviewed `77987943e56c876e4810a320a8209e61bfa340ef` tree `330e0f1a672a8d0322bad9613624ae9d86495b04` (functional source `cbf9d5bc78b8817ca5f91adee870cbe5dceec53c`). Meri PR296 is merged at `337e54b3ad92bd80eb65eefc72b4245c4f9ff50d`; its qualified ARM64 image is `sha256:7eabf413c51ce089d860b1426836cb1904e665e2483c10c5bf2d12a4e672734b`, not deployed. The DI-07/S15 stored-locator, before/after and correction-impact projections and S14 governed Coverage readback are implemented, independently source-reviewed and merged in these pins. Source, frontend architecture, author gates and the finite IAM/configuration/preserved-edge review PASS. Final Core/frontend image completion and qualification, actual image/material/flag/edge composition, deployment/readback, Hermes live acceptance and the recorded real-corpus gaps remain pending. No new database/schema/migration/package change is introduced by the final projection amendment; do not replay completed migrations or repack immutable Wave 4 artifacts. **Wave 4 remains OPEN.**

The user's instruction to start Wave 5 authorizes its orchestrator to allocate and implement confirmed remaining M5 documents/files and M7 routines/Cowork/skills requirements within these briefs. Reconcile current source, evidence, dependencies and existing ownership, then assign finite slices without waiting for root to approve routine allocations. A5 remains a multiwave contract-intake pool; the historical wave table is not a blanket implementation order.

## 2. Actual release cohort and starting bases

Use the [Wave4 deployment handoff](WAVE-4-HANDOFF.md#2-deployed-components-database-and-recovery) in this same published documentation commit. Root's launch message records the verified publication commit/PR. Product release sources and current development branch heads are distinct; fetch the latter before creating an owned source branch.

| Field | Actual startup record |
|---|---|
| Backend source | Core/Workspace/Strategy `cae35473ceae6e53e0a302a174d2a8791d4465bc`; Intel-only successor `c5b99db7238a5e29600e5c976806b0d1d1802f6d`; PR base `backend-import`. |
| Meri source | `651bdf370d13a715736ea7bce32cdd8f3a4b88d0`; PR base `main`. Documentation publication may advance main without a product image change. |
| Frontend source | `050df52492a912be004877a857d4b2db13c60713`; PR base `main`. |
| Healthy deployment | Core21/Workspace8/Strategy4/Intel4; Meri79/75/12; frontend45; named preview READY17/DEFAULT17. Exact images and component timestamps are in Wave4 section2. |
| Material/routes | Contracts0.1.20/UI-stream0.1.7/catalog0.2.22/96reads; all three material initializers exit0 and exact live-version bindings. Edge74rules/85resources/14outputs; final frontend dependencies PASS11:51:15Z. |
| Migration/readiness | Both final migrations ran once, exit0;700ledger/0unfinished/698prior+9exceptions preserved. After02 public8/private14/15views PASS11:24:27.586Z; ledger freshness expired11:54:27.586Z and reader admission expires15:24:27.586Z. Future gated actions refresh read-only, never replay migrations. |
| Handback/recovery | Release-owner target/browser idle and no release commands at11:51:37.565Z; snapshot, predecessor definitions/images/material and immutable evidence retained. No cleanup deletion required. Shared target operations remain coordinated through Wave4 root/Release. |
| Formal acceptance | OPEN for later Hermes after Fable fixes deploy. Operational health is not product acceptance or Wave4 completion. |

Wave 5 now coordinates remaining Research Portfolio/Wave 4 closure from the merged reviewed pins. Begin independently allocated source work from current heads, respecting actual shared ownership; do not reset another lane’s checkout or duplicate completed authoring.

## 3. Remaining Wave 4 work and handoff sequence

Fable returned the static scan; its 33 numbered findings and native controls are reconciled and source-reviewed, and the final DI-07/S15/S14 projection amendment is now reviewed and merged. The existing Wave 5 orchestrator owns the remaining Wave 4 image/composition/deployment/corpus and Hermes acceptance coordination through the [takeover handoff](WAVE4-TO-WAVE5-TAKEOVER.md). Source PASS, merge and image build are not completion. No duplicate scan, module author or acceptance queue is needed.

Keep with Wave 4: all existing Research Portfolio requirements including MO-05, sharing section 16H and the admin/Meri approval flow; branding/publish; FR16.36/source-permission row 11; F09 public/private query/current walls and Workspace/Strategy traversal; F10 task/approval/effect/reload/UNKNOWN; F11 mail/Timeline/Connections and LegiWatch/client/profile/brief/document/note effects; F12 required runtime/Core/storage observations. Follow fresh root statuses and reuse passed evidence; do not create a second Wave 5 acceptance queue.

Row11 remains required. Its interpretation is resolved to canonical qualified public evidence; the Core source correction is independently PASS. Live named-widget refusal and full16H still await deployment/acceptance. Do not reopen a private-source ACL or duplicate the existing evidence owner.

## 4. Prospective scope and source allocation

| Brief | Canonical allocation | Provenance / dependency | First action |
|---|---|---|---|
| W5-01 M5 | MM-09–19, MB-04; MF-14/15 and MF-19 completion links; PF-03/23; WS-22–24 | FINAL-PLAN §5 M5; needs M4 | Compare actual artifact/file path and accepted evidence; select smallest remaining coherent slice with explicit ownership. No reimplementation of merged readers. |
| W5-02 M7 | MR-03/04/10, MB-05, MT-12/13, MO-01/02/10; MF-11/18; ST-15–17 | FINAL-PLAN §5 M7; needs M4+M5 | Reconcile schedule/run/skill behavior in parallel; only independently allocated slices with real dependencies may proceed. |
| W5-03 A5 | PF-04/05/06/08/15/17/19/20, X-07, WS-25, ST-21/22/23/29 | FINAL-PLAN §5 A5; needs A2 | Bounded owner/contract/product-decision intake, not implementation of all 14 items. |

Historical §6 also mentions A4 and later L1. Reconcile A4 with already shipped/source-complete Wave 4 work before proposing anything; no fresh blanket A4 assignment. L1 production/cutover/tenant migration is not authorized here. M6, M8 and MM-20 full Office WYSIWYG remain later allocations.

## 5. Execution, ownership and parallelism

Before each finite source slice record repository, exact base, dependency heads, behavior, files, author, Hermes reviewer, release owner, affected checks and cleanup owner. The Wave 5 orchestrator assigns routine M5/M7 slices itself within these briefs. Coordinate actual ownership/resource overlap and raise only genuinely missing product/scope decisions; keep other independent work moving.

Parallelize the authorized isolated **M5 reader**, **M7 existing-session management** and **MF-19 completion-link** source slices. MF-19 owns only its three allocated intent UI files outside the Wave4 checkout. The two existing M5 document/application access metadata distributions are published at `98e8a53a`, with reported checks PASS. Root has checked competing claims and allocates **contracts0.1.22** to the next isolated Wave5 M5 producer. This permits source/package preparation and finite review, not an unreviewed merge or deployment. Preserve immutable Wave4 contracts0.1.21/UI-stream0.1.8/catalog0.2.23 and their physical archives; no blanket shared schema/catalog/lock ownership transfers. A5 remains intake-only. **No Wave5 shipment is claimed.**

Frontend consumers use the agreed public contract. One writer owns each shared schema/catalog/migration/lockfile/UI entry/architecture registry. Coordinate actual overlap rather than blocking unrelated authorized work; no broad upgrade or recontracting is needed to reorganize lanes.

Wave 5 coordinates exact-head PR integration and existing Release use for remaining Wave 4 and its separately authorized source slices. The old Wave 4 root has stopped product/release work. Preserve full SDK harness, Runtime V1, Core access, existing Temporal and immutable artifact owners; no new provider loop, proxy, grant machinery, scheduler, file platform or permission framework.

## 6. Qualification and completion

Separate implemented, reviewed, built, deployed and accepted. Reuse unchanged exact-source evidence; repeat only affected checks or an uncovered crossing. Previous DOCX/workbook/deck observations do not prove full M5, but must not be repeated just to create another receipt.

Hermes owns independent review/acceptance. For visual work supply actual Figma source and implemented routes for proper Playwright/browser review in its allocated context. Reuse the existing setup and valid evidence; this document does not assert a fresh credential check. Wave 5 coordinates the exact deployed cohort and no-deploy acceptance window with existing Release.

Select meaningful affected checks; label inherited failures against the same base. Old matrices are not mandatory repeated paid runs, natural-aging waits or broad benchmark campaigns. Apply current qualification interpretation while preserving access, idempotency, unknown-effect and data-integrity guarantees.

## 7. Decisions, exclusions and traps

- Q07 semantic/index is SKIPPED; do not revive it as a dependency without a direct scope decision.
- The earlier broader Research Portfolio/MO-05 deferral is SUPERSEDED. The complete existing scope remains Wave 4 closeout, now coordinated by Wave 5. Reuse the reviewed merged module and coordinate M5 artifact, M7 skill and shared contract overlap through the existing owners.
- Outreach backend189/frontend245/Meri288 remains separate PR-only/unshipped; no silent merge, release or completion.
- Onboarding remains excluded; ST-22 intake cannot reopen provisioning/import implementation.
- Read support is not writer activation, rendered preview, filing, sharing or Office editing.
- All-14-skills completion remains a requirement, but installed assets do not prove workflows. Preserve admitted versions and Q07's skipped disposition; coordinate any Research Portfolio skill workflow with Fable instead of duplicating its Wave 4 assignment.
- Historical PR/source snippets and grant/pool/lease/reservation text are superseded where the register says so; never rebuild removed machinery.
- Reuse current decisions before escalating missing revision-format, upload-limit, whitepaper/history, HTML/code, source-event, launcher, notification-map or A5-priority choices.
- No production cutover, shared live DB migration, external send, live webhook or recurring automation follows from a plan ticket.

## 8. Resources, evidence and cleanup

Preserve the shared environment and other owners' resources. Root's private inventory is C:/dev/LOCAL-DEVELOPMENT-ENVIRONMENT.md; private release/Hermes fixtures are referenced by name only. Never publish customer-linked identifiers, credentials, tokens or fixture URLs.

Use existing records, not a new evidence framework. Clean only task-owned disposable resources. No blanket Docker prune, checkout deletion, DB reset or authentication cleanup; retain reusable caches/services.

## 9. First actions and deliverables

1. Read completed deployment stopping point and Fable handoff; preserve missing Hermes acceptance as open.
2. Resolve actual bases and active file ownership. Reconcile named M5/M7 requirements against current code/evidence, not a broad audit.
3. Assign and record finite M5/M7 allocations from the phase briefs, then implement confirmed independent slices without routine root approval. Coordinate actual overlaps; raise only genuinely missing scope/product decisions.
4. Finish the takeover’s remaining Wave 4 release/evidence steps through existing Release and Hermes; report exact source/image/deployed pins, outcomes, limitations and next owner. Keep independent Wave 5 source work within its allocated briefs.
5. At Wave 5's actual end, commit and push the dated nine-section handoff with canonical requirements, exact evidence/exclusions and remaining work. This startup packet is not that end-of-wave handoff.


## Current ownership and delivery rules

**Wave 5 source-work authority:** parallel M5/M7/MF-19 source allocations remain authorized within their existing briefs and file reservations. M5 metadata `98e8a53a` is published/checks PASS; contracts0.1.22 remains allocated to the next isolated M5 producer. Preserve immutable Wave 4 contracts0.1.21/UI-stream0.1.8/catalog0.2.23 and shared single-writer coordination. No unreviewed merge/deployment or Wave 5 shipment follows from that allocation. Wave 5 now also coordinates the remaining Wave 4 closeout under the takeover; A5 remains intake-only.

**Direct user scope update:** all existing Research Portfolio requirements, including MO-05, remain Wave 4 closure scope. Fable’s scan and the resulting source work have returned and are reviewed/merged. Wave 5 now coordinates the remaining delivery and evidence rather than duplicating RP implementation. Any new concrete defect uses the existing domain owner with focused checks and Hermes review. Q07 semantic stays skipped, Outreach separate and onboarding excluded.

**Current direct-user instructions override historical roles:** the existing Wave 5 orchestrator finishes remaining Wave 4 and continues its bounded M5/M7 source allocations. The old Wave 4 root stops product/release work at reviewed source integration. Release alone performs shared target changes; after deployment Hermes Agent app/CLI performs acceptance. Wave 5 records actual completion only after applicable evidence or an explicit user disposition; Fable is not the formal acceptance owner.

Do not inherit old Fable/dot relay rules, an old prohibition on Fable participating, historical model settings, per-run Fargate, source-only holds or recurring issue watchers. Use the new session's configured default model. No public issue #202 post or external message is authorized by this document.

Reuse the existing owner and unchanged evidence. Check the affected real path early, make the smallest coherent change, run meaningful affected tests, obtain independent exact-head review, and build each candidate once when release needs it. Do not add a framework, generic abstraction, benchmark campaign, broad census or speculative capability to close a narrow ticket. Report tests run and not run; new executable tests need a meaningful failure witness/mutation where required by the existing process. Docs-only work has no executable tests and mutation N/A.

Existing Release retains sole cloud/database/deploy/rollback operation and the coordinated authenticated browser window; Wave 5 now owns orchestration. An isolated checkout does not isolate ports, Docker, schemas, catalogs, packages or authentication. Preserve one writer per shared path, the WSL environment, services/data, caches and other owners’ checkouts. Target operations remain outside source implementation briefs.

## Authoritative source map

The authoritative sources were read from C:/dev/w4-final-handoff-20261027 at Meri commit 651bdf370d13a715736ea7bce32cdd8f3a4b88d0. That checkout is owned by another lane and must remain untouched.

- [Standing requirements](../20261022/STANDING-REQUIREMENTS.md), particularly necessary qualification, environment retention and direct-user overrides.
- [Process current templates](../20261022/PROCESS.md#6-current-templates); exact source tickets are copied below.
- [Final plan §5 and §6](../20261022/plan/FINAL-PLAN-20261021.md); §5 contains M5, M7 and A5. §6 explicitly calls the dated wave schedule historical sequencing, not a current calendar or source allocation.
- [Supersession register](../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md); full Claude SDK, direct Bedrock, Core gateway and Runtime V1 remain canonical.
- Meri/application master path, section, line and durable source link accompany each original ticket.
- The [Wave 4 to Wave 5 takeover](WAVE4-TO-WAVE5-TAKEOVER.md) and latest direct user instruction supersede older role text. Wave 5 owns remaining Wave 4 coordination and its finite M5/M7 allocations; Release operates targets and Hermes accepts independently.

The canonical prefix is copied verbatim, including source-relative links. The authoritative standing-requirements link above resolves those source paths.
