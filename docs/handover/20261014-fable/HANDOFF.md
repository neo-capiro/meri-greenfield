# Fable handoff: the new Meri build

This document starts from zero prior context. Meri is a new independent agent application being rebuilt alongside a unified Capiro frontend and a selected backend successor. It is not the legacy Meri service copied into a new repository.

On 14 October 2026, Neo instructed Codex to stop Meri implementation at a safe checkpoint, hand Meri implementation to Fable, and have dot/Codex independently validate Fable's returned work. Fable owns Meri implementation only. Dot continues Core/backend and frontend work, owns integration/acceptance, and coordinates with the sole AWS shipping owner. This human instruction supersedes older OpenAI-only engineering instructions; it does not change the product's Claude Agent SDK architecture, providers or approval boundaries.

## 1. Where everything lives

| Repository | Purpose and owner | Starting source |
| --- | --- | --- |
| https://github.com/neo-capiro/meri-greenfield.git | New Meri trusted control, sole SDK model loop, task broker, Temporal orchestration, governed gateway/skills/memory/actions, artifacts and qualification. Fable implements; dot validates. | PR86, branch `codex/qualification-swc-materialization-repair`, head `c6053e24b465be677cc5980533009b4aab03beab`, tree `ca60051cc73c12d777c825abdd7b5c5e56c7f0de`. |
| https://github.com/neo-capiro/capiro-frontend.git | One Next/React application in `apps/web` hosts Meri, Portfolio and Modules; public versioned Meri contracts/client are receiving boundaries. Dot's frontend owner continues this repository. | PR48 functional Strategy fix `038ee79e93e9b4d1a371a5d38e17dd339b1af859`, based on PR46 `462e7b554200f9b4a96c1589d55b6df7ce4a7df5`. |
| https://github.com/neo-capiro/capiro-backend.git | Selected production-derived domain/auth/API successor. Core and backend migration/image work belong to dot and shipping; do not add Meri model orchestration here. | PR18 source publication `91399fe1a205e37073cbeed2d7eb66a1fafd7fa2`; docs successor `f4f9e1361d92ac0afadd67c1cae3f5faefa829ec`. PR20/21 are separate Core OS/native qualification successors. Default branch is `backend-import`, not `main`. |
| https://github.com/neo-capiro/capirov2.git | Legacy/live reference for schemas, existing identity/domain policy and preserved evidence. Dot owns cleanup. | Do not branch Meri work from it or import its agent, UI, queues, infrastructure or full Engagement implementation. Read only the exact reference pins named by relevant boundary reports. |

Meri and frontend were confirmed **public** through GitHub metadata at this checkpoint; backend and capirov2 are private. Private-repository access must use an already approved GitHub account/credential helper. Never paste tokens, credential files, secret values or private receipt bodies into Git, task briefs, logs or chat. If access is unavailable, ask the owner for access/handoff; do not create tokens, expand scopes or guess alternate identities. Public repository visibility is not permission to publish private source or AWS evidence.

### Recover the current source, not the stale checkout

Meri `main` and the existing `/workspace/meri-greenfield` checkout remain `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`. They are older than the reviewed draft stack. PR86 is the verified runtime base. Fetch exact pins into a new branch/worktree, leaving all existing branches and resources intact.

```sh
git clone https://github.com/neo-capiro/meri-greenfield.git meri-greenfield
git -C meri-greenfield fetch origin c6053e24b465be677cc5980533009b4aab03beab
git -C meri-greenfield worktree add -b fable/meri-first-chat ../meri-first-chat c6053e24b465be677cc5980533009b4aab03beab
git -C ../meri-first-chat rev-parse HEAD
git -C ../meri-first-chat status --short
```

Read this documentation PR first; it adds context/worker-policy only. For implementation, use its reviewed head once dot confirms it, or the exact PR86 runtime base with the latest human handoff. Do not merge a chain of PRs blindly: later heads already contain earlier accepted ancestry. Refresh remote metadata before every integration, record exact head/tree, and retain original candidate/review heads. Repeat the same clone/fetch/worktree pattern for the other repositories only in coordination with their owners.

### Current frontend and branch separation

The shared preview hostname is [https://portfolio-preview.app.capiro.ai/](https://portfolio-preview.app.capiro.ai/). Meri lives under `/meri`, Portfolio under `/portfolio`, Modules under `/modules`; all use the same frontend service. Parent/shipping reports PR48 **LIVE on task revision 7**, proposals GET 200, and successful identity/tenant checks. These are delegated live-preview facts, not this executor's independent browser or AWS readback, and do not establish live Meri chat.

PR47 `882c7b51d79c6d20ace685fb32b5c76a1ef312bf` (`repair/capiro-desktop-content-20261014`) adds desktop task fields/sections on PR46. PR49 `7d7bf4c550e8d906c6ef3498ff79327820519daa` (`repair/capiro-desktop-detail-content-20261014`) adds desktop TaskDetail/Engagement presentation on PR47. PR48 is a sibling functional Strategy branch on PR46, not a replacement for PR47/49. Their runtime/test files are disjoint; `scripts/architecture/reviewed-size-findings.json` overlaps and integration must retain both review sets and rerun architecture checks. PR47/49 do not gate the functional preview/Strategy release. Fable must not take their files or duplicate the separately owned Engagement reporting implementation.

The current preview uses normal existing Clerk login and tenant permissions. Neo superseded the older three-GET/zero-write preview scope for his own established account/tenant; this does not authorize new memberships, identity rebinding, privilege expansion, other tenants, overwrites/deletes, provider sends or paid model calls. No preview-specific tenant protection or new auth layer is requested. Old PR39 receiving reports remain useful contract provenance, but their preview-read-only flag and source pointer are historical.

## 2. Architecture and canonical owners

The product uses **Claude Agent SDK as the only model orchestration loop**; AI SDK/AI Elements provide UI transport and presentation. Temporal provides durable deterministic orchestration. Current product provider/model/proxy binding must be supplied by the owner; a synthetic model string is not a provider choice.

| Area | Existing implementation owner | Required boundary |
| --- | --- | --- |
| Trusted runtime assembly | `apps/runtime` and `apps/runtime/native-authority` | Explicit inert constructors, closed configuration, owned startup/shutdown, borrowed pool/native/session owners. No arbitrary config-loaded factory or parallel runtime. |
| Conversation state and lifecycle | `apps/control/conversations`, `apps/control/admitted-runs` | Current authority, exact request/run IDs, durable transcript/event sequence, allocations, fences, uncertain outcomes and immutable replay. |
| Physical task/native SDK execution | `apps/worker/conversation` plus native broker/supervisor | Fresh isolated task per active conversation; real native registration, original expiry, one retained SDK Query, physical retirement before replacement. |
| Workflow execution | Canonical conversation workflows and Temporal worker | Workflow determinism; SDK work inside activities/broker tasks, not workflow code; exact namespace/queue/TLS and worker compatibility. |
| Data/tools/memory/skills | `apps/gateway`, `packages/contracts`, `packages/skills` | One typed catalog, actual domain authority, no arbitrary SQL/free-text query escape hatch; source connections disabled until separately qualified. |
| Artifact generation/publication | `apps/artifacts`, `apps/artifacts/storage`, `apps/runtime/artifacts` | Original skills, exact versions, governed output grants, durable accounting, immutable S3/PG state, structural/render/human checks. |
| UI and event receiving | `capiro-frontend/apps/web` and public Meri client/contracts | Dot's owner supplies the fixed current proxy/session bindings; browser arguments never establish authority. |
| Source identity/domain APIs | Selected capiro-backend canonical owners | Keep current authentication, membership/client walls and narrow domain reads; no legacy Meri model loop or duplicate Engagement service import. |

The backend authority bridge remains POST `/api/clio/application-authority/identity` and `/context`. Native actor means the canonical backend user ID, not a guessed Clerk subject. The context joins the current owned conversation/client/walls and original identity expiry; raw `/me`, a UUID or an unverified JWT claim cannot replace it. Preserve required ordinary authorization records even if their historical name contains `clio` or Meri. Coordinate any replacement mapping with dot.

The selected backend extraction preserves only the specific authority handlers and shared auth/domain owners needed by rebuilt Meri. It does not keep the old planner, agent loop, semantic gateway, tools dispatcher, queue or old Office generators. Source adapters have explicit endpoint maps; do not guess absent endpoints or silently add/remove `/api` prefixes. New conversation/task/session/budget/SDK/Temporal/artifact ownership stays in Meri.

## 3. Safe checkpoint and evidence levels

No CVE remediation, package/lock change, Dockerfile change, model/provider call, database write, migration execution, new AWS action or deployment was performed by this stopped workstream. Before this handoff, its only uncommitted file was the intake document under `docs/qualification/candidates/image-scan-remediation-20261014/`. The exact runtime base stayed PR86. The unstarted remediation branch is retained. The intake contains private AWS reference identifiers, so it is retained byte-exact locally outside the public Git tree; SAFE-STOP records its checksum and publication disposition.

Two independent source inspections found all 45 current source rows equal their expected hashes, and the existing source-proof test suite passed 3/3. This is static source evidence, not another image/native acceptance run. Exact safe-stop and document checks accompany this handoff.

| Evidence layer | Current fact | What remains unproved |
| --- | --- | --- |
| Source/local tests | Many accepted exact source slices, retained negative controls and local SQL/process/document tests exist. Prepared-kickoff FINAL-QUALIFICATION records actual isolated PostgreSQL16 and canonical journals, with other ports explicitly scripted. | Real authority/issuer, production DB/resource bindings, native provider calls and full R2 behavior are not supplied by fixtures. |
| PR86 image/native qualification | Shipping/observer reports exact PR86 image source/native/Temporal checks passed; scanner matched all 99 finding rows to the checksum-verified sealed receipt. | The image is inadmissible: 2 Critical + 48 High; native mechanics do not pass security or G1. |
| Frontend live preview | Parent reports PR48 task revision 7, proposals GET 200, current identity/tenant checks passed. | Meri conversation/model/documents are not thereby live; all 337 frontend native acceptance rows remain open. |
| Full release | G0 historically accepted for discovery/planning. | G1 OPEN; G2–G7 unaccepted. No whole-plan release, staging or production acceptance is inferred. |

Older PR20 roadmap, PR59 whole-plan audit and PR39 frontend pointers are historical, not current source/activation instructions. The PR59 audit checked 53 original whole-plan records, leaving 51 open at that time (8 implemented/unqualified, 27 missing, 10 external-runtime, 6 deferred). Those numbers describe that dated audit, not an automatically refreshed status at PR86. Its original copied record-hash serialization/object provenance remains unavailable; exact current plan/row joins were verified. Do not promote unverified historic hashes to a new immutable oracle or treat its 53 records as the 12 R2 requirement rows.

The context index preserves every governing plan, R2 workbook/manifest/stored-cell source, requirement/gate/ticket/capability/skill/audit index, current first-run/prepared-kickoff/native reports and local FINAL-QUALIFICATION. Read those receipts at their own exact source/version; do not sum overlapping test counts as independent release evidence.

## 4. Image scan and native invariants

The public-safe scan status and investigated vendor remedies are in [SCAN-STATUS](SCAN-STATUS.md); [SHIPPING-APPENDIX](SHIPPING-APPENDIX.md) records only relayed approved facts. Exact private receipt references remain with the shipping owner. Raw private receipt contents and detailed private AWS inventory stay with the shipping owner; this public repository contains no ZIP, credentials, customer rows or raw private AWS finding attributes.

Preserve Node 24.21.0 on Linux x64/glibc, Claude SDK 0.3.295 / native CLI 2.1.295, Temporal 1.24.0 and SWC 1.16.18 until a separately reviewed compatible change is accepted. Runtime `RuntimeVersions` and public contract versions are distinct version domains: Meri's public contracts currently 0.1.5, frontend receiving SDK 0.1.3, UI stream 0.1.0, private runtime/checkpoint wire domains have their own pins. No blanket version alignment or handwritten duplicate DTOs.

Docker requires an explicit reviewed `NODE_IMAGE` digest, with no floating default. Build-only SWC materialization runs `RUN --network=none node apps/runtime/build/materialize-swc.mjs` after source COPY and before USER node. It uses the pinned upstream loader, verifies ELF/target/containment/hash, installs observed raw bytes atomically, removes its private cache and proves a fresh independent load. Never use cache-security skipping, checksum disabling, fake SWC, alternate bundlers or writable/executable runtime mounts to make native tests pass.

All45 proof paths are mandatory, including 16 exact test-source paths for provenance. Tests are not automatically run at app startup. Dockerfile itself is one of 45; a recipe edit must retain the original receipt and create a complete fresh candidate manifest while leaving unrelated 44 rows unchanged. A base-argument-only fix can preserve all 45 source bytes. Package/lock owners are outside that45-row set but still require complete archive/lock/image binding. Preserve sourceHead/publicationSource and archive/file-count/byte-total provenance; stale or unsealed source cannot be admitted.

Image qualification retains non-root UID 1000, read-only root, deliberately bounded writable task workspace, non-executable/nosuid/nodev tmp, capability/no-new-privileges/PID/memory limits and network-none zero-provider native probes. Native CLI resolution and real upstream Temporal workflow bundling remain mandatory. Admission requires **zero High and zero Critical findings**; do not waive scanner rows because exploitability appears low.

Do not blanket omit dev dependencies: root Ajv/Ajv formats/canonicalize serve real runtime contracts/worker options, and UI stream's AI SDK serves its built producer. Python/Office/browser capabilities require actual dependency tracing; no stripped base or package deletion was chosen here.

## 5. First usable authenticated chat: shortest valid milestone

This is a deliberately smaller acceptance milestone than full R2. It does not require Office rendering, browser workflows, governed mutations, HA/autoscaling, all 139 capability mappings, or optional disabled Decisions/JEV experiments first. It still requires real authority, supported native execution, durable conversation evidence and qualified isolation.

1. Dot/shipping provide an admitted exact source/image and genuine dedicated control/runner/provider origins. Repair/admit the scan first; native-tested but scan-failing image is not deployable.
2. Bind existing canonical backend identity/context to the user's current Clerk session, backend actor, tenant, owned conversation, selected client/walls and original expiry. Do not rebind identities or issue memberships/grants to make a test pass.
3. Bind the approved Meri product PostgreSQL pool and current allocation/grant/fence/lease state through the existing admitted-run owner. The same owner supplies currentRun and withCurrentAllocation. Prepare/source-review canonical migrations 0001–0008 plus product-budget0001; execution requires its separate trusted owner approval.
4. Bind the actual dedicated Temporal endpoint, namespace, task queue and TLS/persistence. Native GetSystemInfo readiness alone does not establish namespace authorization or workflow durability.
5. Supply genuine current task-capability verification, supervising owner, independent native init/main registration reader, authenticated process/event/original-expiry binding, task broker and physical isolation. Worker callbacks, fixture keys, hashes, fake ready/runtime responses and UUIDs do not constitute authority.
6. Bind the approved model/proxy/provider route and budgets. Workers receive short-lived task capabilities, not account/provider/database/Temporal administration credentials. Use the single retained native SDK Query and exact execution ID; do not start a second loop or retry UNKNOWN launch.
7. Dot's frontend owner binds the existing opaque issuance/proxy surfaces to Meri control. Validate one authenticated plain conversation end to end: accepted request, real native session registration, real model response, ordered durable events/transcript, history/reconnect, current authority, bounded stop/cancel and positively observed owned task cleanup.

Current serving defaults remain explicitly unavailable/source-disabled until those bindings exist. Health saying releaseAcceptance held is truthful, not activation. The first-chat proof should identify which additional tests remain unrun; it must not declare G1 or full R2 closed.

## 6. Conversation, stream and recovery work Fable must finish/qualify

Reuse the current public owners rather than adding new APIs:
- POST `/api/action-followthrough/session` issues the opaque current Meri session from verified identity. Browser hints are selectors only.
- POST `/api/conversations/submit`, `/history`, `/cancel`, `/events`; GET `/api/conversations/events/{conversationId}/stream`.
- Lifecycle control and checkpoint inspection remain their existing public owners; task/session/preparation routes are private and never browser destinations.

Submit carries requestId/prompt/windowRequest?/skill?; history after?/limit?; cancel an empty object. The opaque session chooses the run. Reconnect is bodyless GET with `x-meri-resume-sequence`; do not substitute Last-Event-ID, extra selectors, query or Content-Type. The stable published UI event sequence is conversation-wide. Retain immutable event IDs/payloads, duplicate idempotence, conflict refusal, gap/cursor behavior and current session/scopes on replay and release. Browser detach stops observation; it must not silently cancel durable work.

Qualify real multi-run lifecycle: durable submit/start/request replay, execution claim and fence, terminal/error states, concurrent runs, delayed ACK, orphan/unknown outcomes, budget accounting, cancellation/revocation, original-controller reconstruction and clean shutdown. Correlation IDs do not authorize; timeout or a resolved promise does not prove physical cancellation. UNKNOWN remains explicit without automatic redispatch, refund, result-release or fake success.

Qualify durable SDK SessionStore plus complete workspace/checkpoint state, not session text alone. Capture/read back immutable bytes and actual SDK registration; restore to a fresh admitted task, retire the original physically before replacement, recheck current grant/expiry/context/version hashes and source lineage. Cover pause, steer, approval wait, resume, fork, worker loss and stale/conflicting/corrupt/partial checkpoints. Borrowed pools, controllers, sessions and lifecycle owners remain caller-owned; cleanup must close only positively identified owned resources.

## 7. Full R2 work remains in scope

Keep all 139 original capability IDs:96 selected and 43 deferred. Deferred items stay visible with reasons; selected IDs need real implementation and behavior/policy evidence. R2 has 12 requirement records, 12 RG gates, 9 REL ticket records, 14 skill intents and 10 audit-findings records. Do not replace their provenance with a new informal feature list.

The 14 original quick-action skill intents are Research Company, Relationship Brief, Client Changes, Portfolio Changes, Portfolio Overlap, Mail History, Meeting Prep, Commitments & Deliverables, PE Deep Dive, Funding Opportunity Match, Representation Lookup, Bill Watch, Hearing Watch and Regulatory Docket Brief. Preserve stable IDs/versioned manifests, typed subject/window parameters, required evidence, allowed operations, approval/completion rules and budgets. Ordinary questions do not automatically trigger a comprehensive workflow. The original read-only Commitments skill remains part of Meri R2; Neo's abandoned Quick log Commitment/We owe/They owe/counterparty UI is a different excluded frontend workflow and must not be resurrected or used to justify deleting shared task functionality.

| Workstream | What Fable must deliver or obtain | Acceptance focus |
| --- | --- | --- |
| W00–W01 / REL01–02 | Reconcile exact R2 plan/workbook and current code, source/authority catalog, selected/deferred/replacement IDs, shared wire/manifests and evidence contracts. | No schema/handler drift, hidden scope loss, duplicate service or unverified historical serialization claims. |
| W02 / G1 | Compatible SDK/native image/provider/discovery/Temporal/browser/Office component evidence and concrete owner inputs. | Supported native APIs; real proxy/header/reference/stream/compaction behavior; security/license/isolation gates. |
| W03 / G2 | Reviewed dedicated infrastructure/bindings plan, persistence, CI/OIDC/IAM/keys/logs/retention and rollback action packet for sole shipping owner. | Separate VPC/cluster/roles/DB/buckets/secrets; exact image/config; no worker admin credentials; no automatic deployment. |
| W04 / G3 / REL03,06 | Authorized source adapters, entity/scope/window/FY/version binding, exact counts/status/history, candidate search, full decisive evidence, coverage/freshness/paging and memory. | Two-tenant and within-tenant revocation/wall/mailbox cases; no false absence from partial results; source activation progressive and explicitly owned. |
| W05 / durability | Product journals/budgets, real Temporal history/replay, task fencing/registration/checkpoint/restore, schedules/approvals and uncertain outcomes. | No duplicate mutations/retry after uncertain delivery; original deadlines/authority retained; recovery and physical cleanup. |
| W06 / UI integration | Propose and bind real Meri conversation/skill/evidence/activity/file/approval controls through dot's existing frontend owner. | Real states and APIs; history/stream/stop/steer/resume/fork; 337 native UI rows still open; desktop-first/current deferrals coordinated. |
| W07 / artifacts/browser | Actual editable native file create/revise/inspect/preview/download/filing and authenticated browser flows through existing owners. | Exact versions, native opens/render/formulas/quality, original preservation, browser AND renderer isolation and revocation. |
| W08 / G5 | Approved memory proposals/review, task creation and artifact filing with current authority and durable receipts. | Exact immutable approval/expiry, reauthorization, idempotency and no unintended provider/source side effects. |
| W09 / REL09 / G6 | Independent held-out reliability/policy/evidence/UI/artifact/recovery/load suites and complete requirement-to-evidence mapping. | Real labelled truth/oracles, all failed evidence retained, no fixture promotion or skipped native gate. |
| W10–W11 / G6–G7 | Exact immutable candidate, shipping-owner action packet, canary/restore/rollback/in-flight compatibility and release decision. | Only separately authorized deployment/canary; no inferred staging environment or production cutover. |

Optional Decisions/JEV classifiers/judges remain disabled/shadow until their separately frozen benefit/calibration/latency tests pass. They cannot replace the SDK loop, authorize, suppress mandatory evidence or block a qualified baseline.

## 8. Documents, storage and browser/renderer

The current document owners already implement governed create/revise/inspect/download and completed-delivery replay. Read the document drafting/replay reports and runtime/artifact/storage READMEs. Earlier native DOCX/XLSX outputs and rendered pages are local-artifact evidence, not live user output.

Reuse approved Python/docx, XlsxWriter/openpyxl, PptxGenJS, LibreOffice/PDF.js and qualified parsing/rendering packages; preserve original skill licensing. Obtain actual supported executor/library paths, renderer resources and current output/source grants. Separate explicitly approved output run follows the plain chat milestone. Do not generate/send documents or paid model output solely because the frontend account can read/write ordinary APIs.

Bind dedicated versioned/encrypted S3 objects and canonical PostgreSQL artifact versions through existing adapters; preserve immutable parent/replacement IDs, retained-byte hashes, original ticket/accounting and current grant/session/context checks before effects and release. Exact completed-delivery replay recovers the original verified artifact without regenerating/recharging. Unpublished/object-only/corrupt/revoked or uncorrelated results stay UNKNOWN.

For each output, retain the original file before inspection; reopen and render it; inspect every page/slide, supported formulas/reference totals, clipping/corruption and human quality. Test selected-version revisions/downloads, signed URL expiry/revocation, lineage, restart/ACK loss and deletion/retention. Structural parse or a screenshot alone cannot establish native editable quality.

Browser and renderer must both pass the approved dedicated host sandbox, non-root operation, restricted egress/metadata denial, task/conversation isolation, watchdog/cancel/restart and positive teardown checks. D005's measured Fargate browser limitation permits a dedicated isolated browser host; it does not move the whole control application or waive sandbox/isolation. Never introduce another browser framework or reuse hosts/tasks across tenants.

## 9. Database, infrastructure and shipping responsibilities

Meri product state belongs to its dedicated trusted stack. Current conversation migrations are 0001 conversations, 0002 lifecycle, 0003 selected outputs, 0004 SDK sessions, 0005 selected reads, 0006 native executions, 0007 native preparation, 0008 prepared launch. Product-budget0001 and artifact-version0001 are distinct owners; command/approval and qualification schemas have separate allocation histories. Preserve exact SQL/IDs and obtain central allocation before new migration source.

This handoff authorizes **no production migration**, ledger repair, database reset/reseed, new credentials, resource grants, networking changes, paid build/model calls or deployment. Workers do not apply migrations. Existing protected qualification fixtures, stopped processes, other worktrees and evidence are not disposable. Do not delete legacy Meri or production Capiro as part of Fable's work.

The sole existing shipping owner performs any separately approved AWS build/resource/deployment action. Fable prepares exact reviewed source/action packets, supports diagnostics and returns code; it must not start an independent AWS shipper. Historical dedicated-resource inventory must be labelled historical and freshly read back by shipping before any action. A descriptor, stack output or existing secret reference does not prove current reachability, authority, available capacity or permission to retrieve/mount it.

Outstanding owner bindings include dedicated product DB/migration/grant state; Temporal persistence/address/namespace/queue/TLS; immutable admitted image and measured runner; public/private Meri HTTPS/TLS/bootstrap routing; genuine broker/verifier/independent registration reader; model/proxy/provider/short-lived credential/budget pin; authoritative backend origin/identity/current context; object bucket/prefix/version/KMS/output grant and renderer/browser resources. Shipping's public-safe appendix confirms that existing dedicated qualification resources are historical only, the scan-blocked PR86 image has no product deployment, and all listed product bindings remain unbound. Exact private IDs/receipts stay with that owner. No shipping-thread read tool was available here; this handoff uses the owner's relayed public-safe facts, without newly refreshing AWS inventory. Do not fabricate hostnames or use legacy resources as substitutes.

## 10. Precise full-plan acceptance

The governing plan remains authoritative; these are retained thresholds, not current results:
- Authorized 75-real-request seed and at least 200 labelled cases; at least 60 representative end-to-end tasks, 90% successful completion and 95% checked factual correctness.
- Zero unauthorized disclosure/mutation across at least 100 cross-tenant adversarial cases; 100% within-tenant policy fixtures, current stored-context revocation and agreed numeric propagation deadline (target at most 30 seconds, frozen before G3).
- 100% agreed selected source coverage and deterministic count/status/comparison/window/FY/version fixtures; zero false absence on partial/unavailable/stale coverage.
- 100% benchmark files open, supported formulas/reference totals correct; at least 95% human quality rubric, zero critical corruption/clipping, originals preserved.
- 100% restart/retry suite, recovery within 2 minutes on healthy infrastructure, zero duplicate mutations; all failed/cancelled/retried usage measured.
- At 10 concurrent runs: p95 UI request ACK at most 2 seconds and fresh-task readiness at most 90 seconds. Warm simple lookup proposed RG09 p95 at most 15 seconds; retain original ordinary-answer8 second cohort if applicable, never redefine unfinished streaming tokens as answers.
- 100% distinct accepted visible controls mapped to real behavior, authority, states and tests; 100% design baseline classification, documented deferrals, keyboard/focus/contrast/scrolling and reviewed visuals.
- Freeze RG01–09/RG12 definitions/denominators/cohorts before acceptance: routing at least 95%; deterministic subject/window and count/status/comparison 100%; answer-bearing Recall@10 at least 95% for eligible units; required evidence/skills/current authorization/full-read/reconnect/recovery all pass. Optional RG10 classifier requires at least 25% relative error reduction plus measured no-regression; RG11 JEV needs its own frozen improvement/calibration/abstention criteria.
- Retention/deletion across transcripts/events/uploads/browser state/workspaces/previews/artifacts/telemetry/backups; authorized restores must not revive revoked/deleted access. Exact candidate, restore/rollback and in-flight workflow compatibility require independent evidence.

Keep G0 historical acceptance separate from these unclosed gates. Source tests, local fixtures, image-native mechanics and a usable first chat each answer different questions.

## 11. What Fable returns to dot/Codex

For each bounded slice return exact base/branch/commit/tree, complete diff and owned paths, intended behavior and interfaces, dependency/license/lock/image changes, requirements/REL/RG/capability/skill IDs, exact tests/commands/environment/outputs with failures and rerun reasons, independent review findings, unrun native/live gates, cleanup/resource ownership and rollback/compatibility notes. Include a requirement-to-evidence matrix separating ACCEPT_SOURCE, local-artifact, image-qualified/admissible and live acceptance.

Dot reviews actual code and all affected callers/owners, verifies source/hash/contract/package boundaries and meaningful adversarial controls, repeats required independent checks at the exact returned commits, and records ACCEPT or HOLD before integration or shipping. A Fable model report, process exit, fixture receipt, PR publication or green syntax check is not acceptance. Do not overwrite existing branches or discard failed evidence. Cross-repository changes are proposals to their current dot owners, not permission for Fable to import or take over those implementations.

Start with first usable authenticated chat and its real owner bindings; continue the full approved plan in dependency order without reducing scope to the CVE fix.
