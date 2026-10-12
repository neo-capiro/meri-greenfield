# Client-scoped action item source review — 2026-10-12

Independent action reviewer gateway_reviewer. Base `5b1b5985bc73cbfe901c17e65acf9fd50b3d7e33` in dedicated `review/meri-capability-action-20261012`. Read AGENTS, implementation standards, adopted R2 ownership, successor task and actual canonical operation resolver, operational-read validators, catalog, runtime catalog, dispatcher and result-lineage owner. `.agents` is absent. Own only the two newly allocated independent test files, this report and `capability-successor-20261012/action-review/**`; no production or author-test edits and no nested delegation.

## Criteria frozen before author freeze

1. Connect the existing private ActionItemReadInput/ActionItemClientScopedPage validators through the sole operation registry/resolver and actual dispatch/authority pipeline. No new schema, raw DTO, handler loader, source adapter, loop, store, gateway production edit or public0.1 export. A positive test must use actual canonical resolver and dispatcher with explicit synthetic trusted ports, not a fake contract.
2. Preserve all139 original rows/96 selected/43 deferred. query_action_items remains pending with null replacement; exactly14 mapped and82 selected unmapped. Add one explicit partial client-scoped typed binding, yielding15 operations. Existing14 descriptors remain byte-equivalent. Catalog must refuse upgrading the native row, compatibility aliases, executable handler/availability/qualification or retry semantics. All actual production discovery and execution remain unavailable/zero effects.
3. Canonical defaults, trimming, closed fields, cursor limits and digest must derive from existing family normalization; retain immutable original request and cursor metadata. Client-less pending mode must refuse before reserve/handler, including omitted/null client, exact ID and cursor variants. No invented current subject/window or cursor authenticity; opaque cursors and page completeness retain the existing truth limitations.
4. Resolver admission must reject getters/proxies/toJSON, hidden/symbol keys, exotic/cyclic/oversized input and forged context without property effects. Trusted actor comes from current identity; raw actor/tenant/fence/policy injection never becomes authority. Output actor, full binding, subject/policy/decision and operation/digest/selection must match current trusted facts and canonical request.
5. Exercise positive nonempty recommendation output through the existing source-proof validator. Wrong record/client/version/content hash or linked-source provenance, exact-ID substitution/duplicates and scope/cursor/page substitution must fail. Outcome/status remains recommendation-only: no accepted/native completed task, delivery or acceptance claim. Preserve evidenceReady:false, negativeAssertion:none, unknown enumeration, null snapshot, unavailable freshness and pending limitations; do not promote bounded page absence to source-wide proof.
6. Actual current authority and existing deadline/budget owner remain controlling. Independently challenge stale fence, revoked/missing grant, disabled source, authority drift before effect/release, cancellation/expiry around parked effect or settlement and malformed/uncertain acknowledgements. No handler after pre-effect refusal, no invalid/late result release, no refund or invented settled success; uncertainty remains conservative. These are inert source checks, not real budgets/runtime/source proof.
7. Preserve original schemas/validators/contracts/locks/tests and all failures except root-allocated additive operation-count characterization edits with original receipts retained. Review exact author freeze/source hashes and scope. Return ACCEPT_SOURCE/HOLD with passed/failed/unrun checks, owned-process cleanup and remaining G1/live-adapter/partial-parity limits. No proxy/runtime/scripts/infra/customer/SQL/cloud/model/paid actions or network package acquisition.

Initial gap: raw family input validation intentionally describes client-less legacy pending mode, while the canonical resolver currently has no action-item binding. Admission of that mode is not permission to dispatch it. The new binding must refuse it explicitly. Gateway generic context includes nowMs and actorId, but action family context accepts actorId only; binding must forward only the required actor fact.

## Exact decision

**ACCEPT_SOURCE** for author `59a2b629cda0d3838ec1b5235d2a8d64aadf3402`, tree `2f58dc3a7fda1dee62820a71f13030638ede24fa`. This accepts the private, client-scoped partial binding and its disabled dispatch composition only. Runtime, source connectivity, native parity and G1 remain HOLD. No production defect remained after exact-source review.

Criteria were committed at `d2ab1d5f5177959dc220bbbb4ec374cbdf604d9b`; independent controls and their failing baseline were committed at `84eec598098a0025bf8c66ffe426217bcb03be12`, before the author freeze. The exact author commit was then merged into this isolated review branch for replay. Root should integrate the author commit and the ordered review-only commits, excluding review merge `7f04c15`.

The source change connects the existing ActionItemReadInput and ActionItemClientScopedPage validators through the canonical registry. It requires an explicit trusted actor, filters family context to actorId, and refuses client-less `unscoped_legacy_pending` requests. It retains canonical defaults, cursor metadata and normalized argument digest. The catalog's partial-coverage branch requires the original native row to stay pending with null replacement and prohibits aliases. Existing unavailable-handler and zero-retry checks still apply. There is no new schema, live adapter, authorization engine or alternate dispatch path.

Exact production hashes:

| File | SHA256 |
| --- | --- |
| `packages/contracts/retrieval-0.2/catalog-validation.mjs` | `66b852422060cbde0411c49001cb818666d369aacf804a5d9fcd871203e64d96` |
| `packages/contracts/retrieval-0.2/catalog.json` | `65b586ef1070100a77fe490ddb6b8f3dce1555b7b9602132bd644d223390b8d8` |

## Independent verification and retained failures

The unchanged independent suite contains 25 grouped checks. Its baseline passed the literal nonempty recommendation/outcome family fixture and failed the 24 checks requiring the missing binding or registration. Both raw streams and exit1 remain in `action-review/baseline.*`; this is expected missing-implementation evidence, not an accepted baseline. No test or fixture assertions were edited between baseline and final replay.

Exact candidate replay passed **25/25** with exit0. It exercises the actual resolver, current authority and dispatcher with explicit synthetic trusted ports: positive recommendation and outcome rows; client-less refusal; inert input admission; trusted actor, full RunBinding, subject, operation and digest lineage; source-proof/content/linked-source substitutions; stale fence, revocation, missing grant and disabled source; malformed budget acknowledgements; cancellation around parked effect/settlement; and freshly shortened release deadlines. Catalog mutants cannot promote the partial native mapping, enable handlers, add aliases or change schema pins. Actual production gateway discovery/execution remains unavailable with zero effects.

The bounded empty first page retains its existing page-level absence disclosure, while outer negativeAssertion remains none, evidenceReady remains false and enumeration remains unknown. An opaque cursor is not an authenticated snapshot. Reported outcomes remain recommendations and do not establish task completion, delivery or acceptance. These limits are tested rather than replaced with stronger claims.

The read-only preservation audit passed **44/44** checks. It independently verifies the exact author tree and manifest hashes, unchanged frozen controls, raw evidence hashes, all seven original snapshots, and 4,886/4,893 unchanged original tracked files. Only two catalog files and five allocated characterization tests changed among originals. The five test diffs adjust operation/profile registration expectations; prior source-proof and refusal assertions are retained. All139 original capability rows, all14 previous descriptors, schemas/family validators, public contracts, lockfiles, gateway production, proxy/runtime/scripts and infrastructure files are unchanged. The resulting ledger is 96 selected/43 deferred, 14 mapped/82 selected unmapped, 15 unavailable typed operations, with one partial binding whose native row remains pending/null.

Commands, from the repository root:

```sh
python3 docs/qualification/candidates/capability-successor-20261012/action-review/run-check.py exact-freeze node --test packages/contracts/test/retrieval-action-item-independent.test.mjs apps/gateway/test/action-item-context-independent.test.mjs
python3 docs/qualification/candidates/capability-successor-20261012/action-review/run-check.py preservation python3 -I -B -S docs/qualification/candidates/capability-successor-20261012/action-review/audit-preservation.py
```

The author reports 515/515 combined source tests and public generated/type checks plus7/7 distribution tests PASS. Those exact receipts and the initial131/132 and163/169 failed characterizations were inspected and preserved; this review did not duplicate the broad/public runs. Root owns the integrated replay.

## Cleanup and remaining gates

Reviewer baseline, exact replay and preservation groups `122541`, `123052` and `124343` are absent according to their own bounded subreaper receipts; no timeout occurred and no orphan descendant required reaping. The author's distinct cleanup result remains **FAIL_EXITED_ZOMBIES_ADOPTED_BY_PID1**: five exited esbuild children across groups122072/122071, with zero live jobs reported. Passing tests do not erase that failure. This reviewer did not touch PID1, those adopted processes or any other owner's work; later root subreaper checks cannot retroactively reap them.

All checks here are offline source behavior or local Git/file audits. No real source policy, database budget, adapter, provider, model, native task, browser/renderer, Temporal server or cloud runtime was exercised. Synthetic business/source ports do not prove live tenant/client/RLS/memory-wall authorization. No source or availability flag changed, and no runtime acceptance follows. Client-less action parity, actual source policy and connectivity, native durability/recovery, supported image and all remaining G1 gates stay open. No paid, network acquisition, customer-data, frontend or infrastructure action occurred in this review.
