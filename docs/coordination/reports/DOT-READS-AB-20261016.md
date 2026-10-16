# READS-A / READS-B source continuation

Base: `eca78d458acb46cbfd54a94cf870841d999ef6b1`, tree `af0fa89750d9ffb8a58b66dfcb6f84cf4300fd49`.
Branch: `dot/meri-reads-ab-20261016`. Package-four source remains under independent review; this branch does not establish acceptance of its base.

## Implementation outline and ownership

- Reuse the existing source adapters and canonical gateway authority, dispatch, installation and budget owners. Each family has one composition module under `apps/gateway/general-reads/families/`. `integration.mjs` is the sole lane-owned registration composition point; registration never supplies a qualification receipt or enables source access.
- Extend the existing worker family metadata and its per-operation client prefilter. Preserve the single `meri_reads` SDK server. Keep argument validation, broker credentials, current authority, trusted dispatch contexts and durable invocation accounting in their existing owners.
- Make schema advertisement fail configuration if conversion cannot prove an equal or narrower schema. Append a separate fixed contacts guidance notice while preserving canonical result bytes and receipt hashes.
- Preserve production defaults and all frozen contracts. Propose retained-read endpoint/dispatch gaps and durable scoped history/citation linkage precisely; do not invent endpoints, receipt events or migration IDs.
- Verify each family with synthetic transport through real gateway authority/dispatch and scripted SQL, plus worker schema/availability/notice checks. These checks establish source behavior only. Real PostgreSQL, SDK query/model, Core HTTPS qualification and deployment remain unrun. Compiler/browser/database suites require the sole coordinator's bounded slot.

Owned shared files: worker `reads/{families,availability,schema,results,server,tools}.mjs`, their focused tests, and new gateway general-read family/integration/test files. No `activity.mjs`, cleanup-finally, runtime startup, contracts, lockfiles, image recipe, historical manifest or migration edits.

No `.agents/` path exists in the verified repository tree. Root `AGENTS.md`, implementation standards, owner decisions, live briefs, package-four handover and the pinned package-three product review were read. The direct human reassignment supersedes historical Fable implementation ownership.

## Implemented source

Fourteen per-family gateway composition modules derive operation references from the canonical catalog. The lane-owned integration module measures source manifests and returns handlers; it neither creates installation receipts nor enables source access. Eighteen operations join the three existing mail operations, across fifteen constructible families. The three retained reads now have the parent-authorized passive typed bridge described below; production current-context/broker bindings and native installation remain unavailable.

Worker availability adds per-operation required-client checks for `meeting.read_client_meetings` and historical `query_action_items`, alongside required-client families. Personal meetings and actor-bound tasks remain constructible. Canonical schema lookup now resolves the catalog binding group (the meeting schema's ID differs from its filename), preserves `$ref` siblings and supports conservative union/array proof. Conversion that cannot prove equal or narrower admission fails `READ_SCHEMA_CONFIGURATION`; the broad envelope fallback and its dead description branch were removed. Contacts results preserve canonical bytes and hashes, with the deferred-tool notice appended separately.

The gateway continues to persist normalized argument identity, delivery identity, result digest and budget settlement through its existing invocation owner. Duplicate deliveries still return the owner's closed `BUDGET_UNCERTAIN` barrier without another source call or charge; this change does **not** add result replay or weaken UNKNOWN. The worker receipt list remains process-local; it is not a durable conversation history or citation view.

## Development checks (not candidate acceptance)

Node `v24.19.0`, concurrency 1. Dependencies installed using existing locks with lifecycle scripts disabled at root, worker conversations and window-resolution. Lockfiles unchanged.

- Initial two new synthetic test files: **75/82 pass, 7 fail**. Retained at task workspace `reads-initial.tap`. Failures identified fixture empty-coverage assertions, test assumptions that all canonical wrappers carry operation/argument-hash fields, and a test incorrectly assuming Zod drops `uniqueItems`. Those fixtures/expectations were corrected without changing accepted contracts or gateway assertions.
- Subsequent focused development runs are retained separately (`reads-focused.tap`, `reads-focused-2.tap`). Latest: **130/132 pass, 2 failed test-file imports**, caused by missing existing UI-stream `ai` dependency before options/exclusion tests execute. The latest run includes all 97 new synthetic cases (family adapters/authority/durable scripted SQL and worker schemas/availability/MCP notice), existing mail/gateway tests, and **source proof 5/5**. No hashed proof row changed and no manifest was repinned.
- Test invocations used Node's normal test-file subprocess isolation with concurrency 1. In-process MCP and SDK server construction were exercised; no SDK query, native CLI, model, provider, browser or database process was started. Heap/RSS was not measured in these development runs.
- `git diff --check`: pass.

These are working-tree development results; the sealed source candidate still requires its separately bounded exact-pin verification and independent review. Reverted-fix controls, full affected tests and package typechecks remain pending the sole shipping coordinator's resource grant. Further test and install stages are held after the coordinator's explicit scheduling update. Initial failures are preserved.

Follow-up source inspection found that the appended contacts guidance was outside the worker's byte accounting. Accounting now includes every model-visible text block while the canonical result digest still covers only the unchanged canonical source result. A focused negative output-bound regression was added. It and the updated 98-case focused source set are **UNRUN**, preserving the coordinator's test-stage hold. This follow-up is not covered by the earlier development passes.

## Contract, endpoint and migration requests

### Retained-three source outline (parent-authorized successor)

Use only the verified Core producers: `GET /api/research-portfolios/:id`, its `/changes` route and `POST /api/clio/tools/get_florida_budget_project`. The seven supplied Core handoff artifacts were SHA-verified; source reference `016e79b585c14f20d13669e13c987c01e3dd29dd` / `cd3c51e940f14e1b2a1040b0ffa445e85d68b332`. No Core source is imported or modified.

Add separate research-portfolio and Florida source/family modules, reuse bounded JSON transport and dispatch lifetimes, and register only in this lane's integration module. Canonical schemas and normalization own projection/defaults. Portfolio results retain the canonical binding/subject wrapper; Florida uses the existing private dispatch lineage wrapper outside its unchanged domain DTO. Florida `asOf` labels observation time only; preserve the producer's distinct project/document/recent-amount/exact-amount/event query windows.

A narrow injected current-context port must corroborate the full run binding, current subject, operation, raw-request digest, policy and source tuple before reservation/effect/release. A task-bound credential broker must bind that same tuple plus normalized input, context and recipient origin. Absent trusted ports are explicitly `UNAVAILABLE`; construction supplies no credentials, grants, qualification or availability. These local binding shapes remain proposals for production composition. No migrations or frozen-contract changes are needed for this passive source bridge.

Shared edits: `dispatch/{operation-context,read-result-envelope}.mjs`, `general-reads/mount.mjs`, and the narrow `tool-dispatch.mjs` optional-port/observation seam. Budget explicitly confirmed no overlapping edits/claims before this change. All reserve/settle/uncertain logic stays with the existing owner. Startup `activity.mjs` and artifact paths remain untouched.

Exact `5eec8597fe729578fb5e5117649bd2d9cd699315` / tree `f1e82ff0f74e9a9c17b52dfaa1119db7e47363bf` synthetic check: corrected saved supervisor completed **97/98 pass**, primary exit 1, cleanup 0, 3.974 seconds, observed peak working set 212,303,872 bytes (not a guarantee). The first supervisor attempt left empty logs and no execution receipt; its outcome remains **UNCERTAIN**. The failing contacts output-bound fixture spent the tested allocation while measuring its baseline; measurement is now isolated in a separate fixture. Earlier failures and exact logs remain preserved outside Git.

See [DOT-READS-CONTRACT-REQUESTS-20261016.md](../proposals/DOT-READS-CONTRACT-REQUESTS-20261016.md). No migration ID is requested for these passive family modules. No preview-store source or schema is touched; that remains with the document/qualification owners.

Real native installation/discovery, ordinary no-skill allocation, current source/broker authority, SDK-query → Core qualification, real PostgreSQL durability, typechecks, deployment and live behavior remain **HOLD / UNRUN**. Source registration is not runtime availability. Package-four and candidate-h review remain independent; this branch neither accepts them nor integrates another lane.
