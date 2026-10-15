# Central source migration allocations - 15 October 2026

Decision date: **2026-10-15 UTC**. Issuer: **dot, parent integration coordinator**, coordination thread `01a0ff18-26cd-7609-beba-87726d0300c6`. This record transcribes the parent's explicit central allocation decision; the delegated source executor does not independently acquire allocator authority.

Repository: `https://github.com/neo-capiro/meri-greenfield.git`. Immutable source baseline: `b5be44d5141ae5fd3830aed789cb7ad525506c4e`, tree `efc4b7bf87480d65fc4e6090c2a83b8e6d9dcf4d`. Decision evidence: [allocation audit at f8897b1b8200b61017d8a83bf90b04c86ebb991a](https://github.com/neo-capiro/meri-greenfield/blob/f8897b1b8200b61017d8a83bf90b04c86ebb991a/docs/coordination/reports/DOT-MIGRATION-ALLOCATION-AUDIT-20261015.md). Coordination parent: `f8897b1b8200b61017d8a83bf90b04c86ebb991a`, tree `77affb58b8c965b957cab5252d0eb35b49815f74`.

## Binding source namespace decisions

| Namespace | Exact repository path | Decision and purpose | Source author ownership |
| --- | --- | --- | --- |
| `meri_conversations` | `apps/control/conversations/migrations/0009_next_runs.sql` | **CONFIRMED** for the existing completion-checkpoint, next-run reservation and conversation sequence-range source already present at the baseline. Retention must not reuse this ID. | Preserve existing source authorship: Fable's original slice A at `324a3e4fd678a0656153fa86bf0822a7ec153ff1`, followed by Codex/Dot amendments at `454fb4020aa07c6d56cbabd02b78afe5ebdb9dcb` and `3532541665c62940cd83d98503b3d1d4a0ae718b`. This decision assigns no new SQL edit. |
| `meri_conversations` | `apps/control/conversations/migrations/0010_retention.sql` | **RESERVED** exclusively for the policy-configured conversation retention work described in the completion packet, including its suppression/recovery corrections and bounded purge controls. | **Fable**, exclusive author ownership of this new migration path within the packet's source scope. |
| `meri_artifacts` | `apps/artifacts/migrations/0002_retention.sql` | **RESERVED** exclusively for the policy-configured artifact retention work described in the completion packet, including exact-version/shared-reference/hold and recovery controls. | **Fable**, exclusive author ownership of this new migration path within the packet's source scope. |

Scope reference: [completion instructions at 8bbe8405e03964072ed79be068d2d0a84cf71609](https://github.com/neo-capiro/meri-greenfield/blob/8bbe8405e03964072ed79be068d2d0a84cf71609/docs/coordination/reports/DOT-TO-FABLE-COMPLETION-INSTRUCTIONS-20261015.md), especially sections3 and5. Reservation does not accept revision2 verbatim or remove its required corrections. No cooling period, policy default, storage binding or legal hold decision is supplied here. Production purge remains disabled pending the required policy, bindings and authorization.

The baseline0009 Git blob is `ca24d9dbadc196bac3b194e161f555f8f42e9dd9`, SHA256 `85de8c731a269b00fc8b8f16d95772d56fd70a585431904cbb5049cdc2f8a8ed`. Both retention paths were absent at the audited baseline. Existing occupied IDs and separate namespace reservations enumerated by the audit remain unchanged.

## Effect on historical pending statements

Before this decision,0009's source header and the two handoffs correctly required central confirmation despite already-authored SQL and disposable-PG tests. The audit correctly found no central reservation; retention V2's earlier allocation assertion was unsupported at that pin. **This dated central task record now supplies the missing confirmation and two new reservations.** Historical SQL, handoffs, audit and manifests remain immutable; their earlier pending status is read as of their own dates. No SQL header is edited to conceal that sequence.

This is **source namespace allocation only**. It is not SQL acceptance, migration application, schema execution, data deletion, deployment, image admission, credential issuance or cloud authority. Existing source authorship is preserved. Fable must return reviewable source and independent qualification evidence; the trusted shipping/migration owner separately controls any authorized runtime execution.
