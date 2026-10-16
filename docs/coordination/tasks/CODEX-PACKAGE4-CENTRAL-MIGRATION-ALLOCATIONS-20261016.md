# Central package-four source migration allocations

Decision: **2026-10-16 UTC**, issued by the parent integration coordinator in thread `01a0ff18-26cd-7609-beba-87726d0300c6`. This record transcribes the parent's explicit acceptance of the ten exact paths in [the proposal at acc9bc88368869d2d06f7fb78c30911b13982087](https://github.com/neo-capiro/meri-greenfield/blob/acc9bc88368869d2d06f7fb78c30911b13982087/docs/coordination/proposals/DOT-PACKAGE4-MIGRATION-ALLOCATION-PROPOSAL-20261016.md). The delegated qualification coordinator does not acquire independent allocator authority.

**All ten paths below are RESERVED source IDs.** This is numbering and exclusive source ownership only: no SQL acceptance, migration execution, live database access, purge activation, deployment, new credential, schedule placement/registration or release approval. Preserve existing migrations and all historical proposals/manifests. Each authored change needs a focused commit, meaningful tests and exact independent source review; heavyweight tests still require Shipping's separate slot.

## Exclusive owners

- **A — retention/artifact owner:** `01a14248-3e19-713a-9cc0-a13e3242e0d4`, existing `dot/meri-artifact-safety-20261016` lane. Retention and preview core claims were confirmed by this owner; the three receipt amendment paths share this retention owner and remain design-held, with canonical command/approval/task-lookup maintainers consulted on exact mappings.
- **B — memory/settings/intents owner:** `01a14242-1d17-77a6-aad8-34c9c6ebe0c4`, existing `dot/live-budget-planner-20261016` lane. All three paths and the canonical intent adapter were explicitly confirmed. This does not allocate a second implementation or journal.
- **C — startup/schedule-composition owner:** `01a14241-cbba-7531-9aba-71299cd430d7`, existing `dot/meri-startup-history-20261016` lane. Bounded occurrence SQL/source-test ownership was explicitly accepted; no current owner conflict was identified. Placement stays unapproved.

## Binding reservation table

| Namespace / responsibility | Exact reserved path | Sole owner | Authoring status |
| --- | --- | --- | --- |
| meri_conversations: recovered watermark | `apps/control/conversations/migrations/0013_retention_recovery_watermark.sql` | A | Source authoring may proceed against reviewed invariants. |
| meri_conversations: row targets/delete admission | `apps/control/conversations/migrations/0014_retention_row_targets.sql` | A | **AUTHORING HOLD** pending exact identity/delete/tombstone/receipt design review. |
| meri_intents.preparations: canonical preparation journal | `apps/control/intents/migrations/0001_intent_preparations.sql` | B | Namespace/table decided; exact adapter/DDL state and release-payload design review pending (see below). |
| meri_memory.candidates: producer outbox | `apps/control/memory/migrations/0001_memory_candidates.sql` | B | Source authoring may proceed against reviewed invariants. |
| meri_settings: user/tenant documents and audit | `apps/control/settings/migrations/0001_settings.sql` | B | Source authoring may proceed against reviewed invariants. |
| meri_artifacts: preview persistence/custody | `apps/artifacts/migrations/0003_previews.sql` | A | Parent released bounded source authoring against the conditionally accepted design at `338a04ec82626382045f8b944a4b7ed4dd48ab27`; required invariants below. No live adapter activation or SQL execution. |
| meri_schedules: occurrence UNKNOWN journal | `apps/control/schedules/migrations/0002_occurrences.sql` | C | Source authoring may proceed against canonical openOccurrence/settleOccurrence/P-R4-1 invariants. |
| canonical command receipts: retention amendment | `apps/control/commands/migrations/0002_retention.sql` | A | **AUTHORING HOLD** pending exact subject/receipt identity and deletion design review. |
| canonical approval metadata: retention amendment | `apps/control/commands/approval-metadata/migrations/0002_retention.sql` | A | **AUTHORING HOLD** on the same exact mapping/deletion review. |
| meri_task_lookup receipts: retention amendment | `apps/control/task-lookup/migrations/0002_retention.sql` | A | **AUTHORING HOLD** on the same exact mapping/deletion review. |

Do not amend an existing migration to absorb this work. Numbers repeat only across independent source families. No default policy, retention period, role, grant or seed is allocated by this record.

## Intent name mapping and remaining design choice

The parent explicitly selected **`meri_intents.preparations`**. It is the only table for the existing canonical preparation-journal adapter, behind `createIntentJournal`; the existing owner B claims `apps/control/intents/postgres-journal.mjs` for that adapter. No parallel journal and no public-schema fallback are permitted.

The historical P-INT-M1 proposal's unqualified `meri_intent_preparations` is mapped to `meri_intents.preparations` by this dated decision. Preserve the old proposal bytes and its original pending status as historical evidence; do not rewrite it or create a compatibility table/view/search-path fallback.

Owner B supplied the proposed adapter invariants: tenant+actor+conversation+delivery primary key; immutable record/hash; atomic insert-or-read claim; PENDING-only matching-record settlement; exact PREPARED result plus original release binding/scopes/expiry; closed FAILED code; PENDING/UNKNOWN without payload; no retry/delete/remint after uncertainty; lost COMMIT remains UNKNOWN; bounded transactions and borrowed-pool cleanup. These are **design input, not independently accepted new schema/wire**. The parent's explicit may-author list names recovered watermark, memory outbox, settings/audit and occurrence journal. This record therefore does not infer a separate intent-DDL authoring release: obtain the exact adapter/state/release-payload design disposition before SQL authoring. The canonical fresh result-release authorizer/composition remains a separate local proposal; namespace selection does not accept it.

## Preserved prior reservations and conflicts

The accepted proposal's collision inventory inspected package four `eca78d458acb46cbfd54a94cf870841d999ef6b1`, audit `f8d1816eda48347eeca4c0c25308870f2885c1f5`, registry `e6e3016e215126dfaf4cb4aa8ed13cd5a1bee4f7`, strategy-v3 `a631e22f6f8e2283c40140dd5fec147f1a487fa7`, tenant allocation `7606375dd30bafcde2a6a002efffbcf1c311bc66` and current main `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`. No ten-path collision was found; existing feature owners confirmed the assignments above. Recheck current owner heads immediately before each authored source commit; an unexpected competing reservation returns to the parent, never silently changes ID or owner.

**Conversation0012 is not available:** `apps/control/conversations/migrations/0012_strategy_operation_results.sql` and its associated adapter/tests retain the separate conditional custody ownership and authoring hold recorded in [the prior conditional allocation](https://github.com/neo-capiro/meri-greenfield/blob/f8d1816eda48347eeca4c0c25308870f2885c1f5/docs/coordination/tasks/CODEX-STRATEGY-RESULT-STORE-0012-CONDITIONAL-ALLOCATION-20261015.md). Its actual0011 binding, retention receipt/tombstone, target/time/attempt conformance and explicit-release conditions remain unchanged. The user's reassignment changes the implementation executor, not those conditions. Planner continuation cannot use0012 by implication; no Planner schema or invented Core endpoint is allocated.

Existing `apps/gateway/budget/migrations/0002_tenant_budgets.sql` and product-budget0001 remain unchanged under their existing reservation. Conversation0009/0010/0011, artifact0001/0002, qualification proxy0001–0003 and the other existing families remain occupied and unmodified. Historical AGENTS/proposal text predating these dated central allocations is not rewritten to conceal its earlier state.

The original ten-path proposal remains byte-identical at acc9 and on this branch. This record creates no SQL, adapter or feature implementation. Candidate h remains HOLD, frozen f is unchanged, and all live/image/test-resource gates remain separate.

## Subsequent explicit parent releases, 2026-10-16

The parent conditionally accepted preview custody design at `338a04ec82626382045f8b944a4b7ed4dd48ab27` and released **A only** to author reserved `apps/artifacts/migrations/0003_previews.sql`. The source schema must include explicit tenant/source foreign keys, immutable claim identity and known physical-version custody; preserve potential-orphan UNKNOWN barriers, current-authority replay checks and restore/tombstone invariants. No live adapter activation, migration execution or purge is authorized. This release does not release conversation0014 or the held receipt amendments. Retention behavior remains HOLD for the independently reproduced restore windows after `journal.set` before watermark advancement and after the watermark read before projection retrieval; passing candidate hashes do not resolve them.

The parent separately selected the **control-service domain with a separately supervised Temporal worker process** for schedules, never the HTTP request thread. C may compose/register the existing queue and handlers in source behind explicit configuration and the canonical owner; provisioning, credentials and live activation remain unauthorized. This later source-placement decision supersedes the earlier placement-unapproved note without widening the occurrence0002 SQL reservation.
