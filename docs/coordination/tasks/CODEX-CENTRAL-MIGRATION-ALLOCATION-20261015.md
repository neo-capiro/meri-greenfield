# Central source migration allocations - 15 October 2026

Decision date: **2026-10-15 UTC**. Issuer: **dot, parent integration coordinator**, coordination thread `01a0ff18-26cd-7609-beba-87726d0300c6`. This record transcribes the parent's explicit central allocation decision; the delegated source executor does not independently acquire allocator authority.

Repository: `https://github.com/neo-capiro/meri-greenfield.git`. Immutable source baseline: `b5be44d5141ae5fd3830aed789cb7ad525506c4e`, tree `efc4b7bf87480d65fc4e6090c2a83b8e6d9dcf4d`. Decision evidence: [allocation audit at f8897b1b8200b61017d8a83bf90b04c86ebb991a](https://github.com/neo-capiro/meri-greenfield/blob/f8897b1b8200b61017d8a83bf90b04c86ebb991a/docs/coordination/reports/DOT-MIGRATION-ALLOCATION-AUDIT-20261015.md). Coordination parent: `f8897b1b8200b61017d8a83bf90b04c86ebb991a`, tree `77affb58b8c965b957cab5252d0eb35b49815f74`.

## Binding source namespace decisions

| Namespace | Exact repository path | Decision and purpose | Source author ownership |
| --- | --- | --- | --- |
| `meri_conversations` | `apps/control/conversations/migrations/0009_next_runs.sql` | **CONFIRMED** for the existing completion-checkpoint, next-run reservation and conversation sequence-range source already present at the baseline. Retention must not reuse this ID. | Preserve existing source authorship: Fable's original slice A at `324a3e4fd678a0656153fa86bf0822a7ec153ff1`, followed by Codex/Dot amendments at `454fb4020aa07c6d56cbabd02b78afe5ebdb9dcb` and `3532541665c62940cd83d98503b3d1d4a0ae718b`. This decision assigns no new SQL edit. |
| `meri_conversations` | `apps/control/conversations/migrations/0010_retention.sql` | **RESERVED** exclusively for the policy-configured conversation retention work described in the completion packet, including its suppression/recovery corrections and bounded purge controls. | **Fable**, exclusive author ownership of this new migration path within the packet's source scope. |
| `meri_artifacts` | `apps/artifacts/migrations/0002_retention.sql` | **RESERVED** exclusively for the policy-configured artifact retention work described in the completion packet, including exact-version/shared-reference/hold and recovery controls. | **Fable**, exclusive author ownership of this new migration path within the packet's source scope. |
| `meri_conversations` | `apps/control/conversations/migrations/0011_run_issuance.sql` | **RESERVED** exclusively for the durable S1 issuance store: immutable issuance binding/request/original expiry, fenced claim/completion, protected reference metadata, facts hash, exact replay and reconciliation constraints. No raw credentials or second budget ledger. | **Fable**, exclusive source author for this new migration path within the reviewed S1 correction scope. |

Scope reference: [completion instructions at 8bbe8405e03964072ed79be068d2d0a84cf71609](https://github.com/neo-capiro/meri-greenfield/blob/8bbe8405e03964072ed79be068d2d0a84cf71609/docs/coordination/reports/DOT-TO-FABLE-COMPLETION-INSTRUCTIONS-20261015.md), especially sections3 and5. Reservation does not accept revision2 verbatim or remove its required corrections. No cooling period, policy default, storage binding or legal hold decision is supplied here. Production purge remains disabled pending the required policy, bindings and authorization.

The baseline0009 Git blob is `ca24d9dbadc196bac3b194e161f555f8f42e9dd9`, SHA256 `85de8c731a269b00fc8b8f16d95772d56fd70a585431904cbb5049cdc2f8a8ed`. Both retention paths were absent at the audited baseline. Existing occupied IDs and separate namespace reservations enumerated by the audit remain unchanged.

## Effect on historical pending statements

Before this decision,0009's source header and the two handoffs correctly required central confirmation despite already-authored SQL and disposable-PG tests. The audit correctly found no central reservation; retention V2's earlier allocation assertion was unsupported at that pin. **This dated central task record now supplies the missing confirmation and two new reservations.** Historical SQL, handoffs, audit and manifests remain immutable; their earlier pending status is read as of their own dates. No SQL header is edited to conceal that sequence.

This is **source namespace allocation only**. It is not SQL acceptance, migration application, schema execution, data deletion, deployment, image admission, credential issuance or cloud authority. Existing source authorship is preserved. Fable must return reviewable source and independent qualification evidence; the trusted shipping/migration owner separately controls any authorized runtime execution.

## Subsequent central decision: S1 issuance store0011

15 October2026 UTC, final collision recheck at10:58UTC. Parent integration coordinator `01a0ff18-26cd-7609-beba-87726d0300c6` explicitly accepted the collision-checked proposal and directed reservation of `apps/control/conversations/migrations/0011_run_issuance.sql` in `meri_conversations` exclusively for Fable's durable S1 issuance store. This row transcribes that concrete central decision; no inferred allocator permission is used.

Rechecked remote Fable head `f0befe1e486cfda644f1f6170cf3d9d671e5158f`, tree `fb58adeccde7c5c7c48a5562ac3108b888a6d17e`, and prior registry branch head `cc4917ddc53c61b156eae612a8aa5a0e2d8cebd4`: conversations0001 through0010 and artifacts0001/0002 are occupied, no conversation0011 source path exists, and the prior central registry has no0011 reservation. The review/proposal branch remained at `01783ff5e3206e24880f2e284b6c5ed9ef3cffb8` and contained a proposal only. Existing0009/0010/artifacts0002 rows are preserved verbatim. No new namespace is allocated.

This resolves the **numbering dependency only**. It does not accept the existing S1 fixture or the retention/runtime source completion; all correction requirements in the [independent review at01783ff5](https://github.com/neo-capiro/meri-greenfield/blob/01783ff5e3206e24880f2e284b6c5ed9ef3cffb8/docs/coordination/reports/DOT-REVIEW-FABLE-f0befe1-20261015.md) remain. The earlier [proposal](CODEX-S1-ISSUANCE-ALLOCATION-PROPOSAL-20261015.md) and review's pending-number statements are historical as of their publication; this dated decision supersedes only that pending status. No SQL file is created or migration applied by this record. No new credential, cloud resource, TLS/trust change, deletion or live execution authority is granted. Production purge stays disabled.

Use the [single pickup/addendum](../reports/DOT-FABLE-PICKUP-ALLOCATION-ADDENDUM-20261015.md) for both the correction instructions and this reservation.

## Subsequent central direction: conditional result custody0012 paths

15 October2026 UTC. The same parent integration coordinator explicitly directed a fresh collision check and preparation of [conditional path-only ownership for result custody0012](CODEX-STRATEGY-RESULT-STORE-0012-CONDITIONAL-ALLOCATION-20261015.md), assigning Fable sole future author of `apps/control/conversations/migrations/0012_strategy_operation_results.sql`, `apps/control/strategy-operations/postgres-result-store.mjs` and `apps/control/strategy-operations/test/postgres-result-store.test.mjs`. The [four-head inspection](CODEX-STRATEGY-RESULT-STORE-0012-COLLISION-20261015.json) found no relevant path or prior0012 reservation collision.

This is **conditional path ownership, with authoring still blocked** until frozen0011 binding shape, retention-owner receipt/tombstone agreement, reviewed target/time/attempt conformance and explicit release of the authoring hold. No schema detail, SQL implementation/application, new issuer, discovery-command store, runtime action or public wire is allocated. Existing rows above are unchanged; the linked conditional record states the exact scope and remaining gates.

## Subsequent central decision: product tenant budgets 0002

15 October 2026 UTC. The parent integration coordinator explicitly directed a current collision check and reservation in p1b's actual `meri_product_budget` family. **RESERVED exclusively for Fable, source authoring only:** `apps/gateway/budget/migrations/0002_tenant_budgets.sql`, after existing `0001_product_budget.sql`, for tenant-budget policy and per-run reservation tables. The [allocation and boundaries](CODEX-TENANT-BUDGET-0002-ALLOCATION-20261015.md) and [nineteen-head collision record](CODEX-TENANT-BUDGET-0002-COLLISION-20261015.json) supply exact source pins and evidence.

This resolves numbering only. P1b implementation remains HOLD for the reported release/late-settlement liability finding; no current DDL/state machine is accepted. No SQL is authored or applied, gate/link mounted, policy/role/grant seeded, or runtime/cloud action authorized. Conversations 0011 and conditional custody 0012 are separate and unchanged, including 0012's authoring hold. All preceding register content is preserved.
