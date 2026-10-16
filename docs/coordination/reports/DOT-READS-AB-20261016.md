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

Twelve per-family gateway composition modules reuse existing adapters and derive operation references from the canonical catalog. The lane-owned integration module measures source manifests and returns handlers; it neither creates installation receipts nor enables source access. Fifteen operations join the three existing mail operations, across thirteen constructible families. The three retained reads remain required and unregistered pending the exact missing owners below.

Worker availability adds per-operation required-client checks for `meeting.read_client_meetings` and historical `query_action_items`, alongside required-client families. Personal meetings and actor-bound tasks remain constructible. Canonical schema lookup now resolves the catalog binding group (the meeting schema's ID differs from its filename), preserves `$ref` siblings and supports conservative union/array proof. Conversion that cannot prove equal or narrower admission fails `READ_SCHEMA_CONFIGURATION`; the broad envelope fallback and its dead description branch were removed. Contacts results preserve canonical bytes and hashes, with the deferred-tool notice appended separately.

The gateway continues to persist normalized argument identity, delivery identity, result digest and budget settlement through its existing invocation owner. Duplicate deliveries still return the owner's closed `BUDGET_UNCERTAIN` barrier without another source call or charge; this change does **not** add result replay or weaken UNKNOWN. The worker receipt list remains process-local; it is not a durable conversation history or citation view.

## Development checks (not candidate acceptance)

Node `v24.19.0`, concurrency 1. Dependencies installed using existing locks with lifecycle scripts disabled at root, worker conversations and window-resolution. Lockfiles unchanged.

- Initial two new synthetic test files: **75/82 pass, 7 fail**. Retained at task workspace `reads-initial.tap`. Failures identified fixture empty-coverage assertions, test assumptions that all canonical wrappers carry operation/argument-hash fields, and a test incorrectly assuming Zod drops `uniqueItems`. Those fixtures/expectations were corrected without changing accepted contracts or gateway assertions.
- Subsequent focused development runs are retained separately (`reads-focused.tap`, `reads-focused-2.tap`). Latest: **130/132 pass, 2 failed test-file imports**, caused by missing existing UI-stream `ai` dependency before options/exclusion tests execute. The latest run includes all 97 new synthetic cases (family adapters/authority/durable scripted SQL and worker schemas/availability/MCP notice), existing mail/gateway tests, and **source proof 5/5**. No hashed proof row changed and no manifest was repinned.
- Test invocations used Node's normal test-file subprocess isolation with concurrency 1. In-process MCP and SDK server construction were exercised; no SDK query, native CLI, model, provider, browser or database process was started. Heap/RSS was not measured in these development runs.
- `git diff --check`: pass.

These are working-tree development results; the sealed source candidate still requires its separately bounded exact-pin verification and independent review. Reverted-fix controls, full affected tests and package typechecks remain pending the sole shipping coordinator's resource grant. Further test and install stages are held after the coordinator's explicit scheduling update. Initial failures are preserved.

## Contract, endpoint and migration requests

See [DOT-READS-CONTRACT-REQUESTS-20261016.md](../proposals/DOT-READS-CONTRACT-REQUESTS-20261016.md). No migration ID is requested for these passive family modules. No preview-store source or schema is touched; that remains with the document/qualification owners.

Real native installation/discovery, ordinary no-skill allocation, current source/broker authority, SDK-query → Core qualification, real PostgreSQL durability, typechecks, deployment and live behavior remain **HOLD / UNRUN**. Source registration is not runtime availability. Package-four and candidate-h review remain independent; this branch neither accepts them nor integrates another lane.
