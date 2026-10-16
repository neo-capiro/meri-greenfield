# Package-four migration allocation proposal

**PROPOSED ONLY. No allocation, SQL authoring or execution.** Parent approval must name the final paths and release any design/authoring holds. Recheck current owner heads immediately before authoring; this does not cover unpublished work.

Inspected exact package-four `eca78d458acb46cbfd54a94cf870841d999ef6b1`, audit `f8d1816eda48347eeca4c0c25308870f2885c1f5`, central-registry `e6e3016e215126dfaf4cb4aa8ed13cd5a1bee4f7`, strategy-v3 `a631e22f6f8e2283c40140dd5fec147f1a487fa7`, tenant-allocation `7606375dd30bafcde2a6a002efffbcf1c311bc66`, and current main `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`. Remote dot-ref inventory confirms the named registry heads. The source inventory records every migration path at each head and checks all proposed paths for collisions.

Existing occupied source families: conversations0001–0011; artifacts0001–0002; product-budget0001–0002; proxy qualification0001–0003; task-lookup0001; schedules0001; qualification SDK fixture0001; command journal0001; approval metadata0001: **23 SQL files at package four**. Presence does not establish application or acceptance.

**Conversation0012 is already conditional custody ownership, AUTHORING BLOCKED.** Preserve `0012_strategy_operation_results.sql` and its adapter/test path holds, frozen0011/retention/target/time/attempt conditions and explicit-release requirement. It is unavailable to retention, intents, budgets or Planner continuation by implication. Product budget0002 already exists at its reserved `0002_tenant_budgets.sql`; allocate no replacement.

One collision-free proposed record:

| Namespace | Proposed exact source path | Purpose / authoring condition |
| --- | --- | --- |
| meri_conversations | apps/control/conversations/migrations/0013_retention_recovery_watermark.sql | Recovered watermark only. |
| meri_conversations | apps/control/conversations/migrations/0014_retention_row_targets.sql | Row targets/delete admission; primary-key mapping, tombstone and retention receipt agreement first. |
| meri_intents (new schema proposal) | apps/control/intents/migrations/0001_intent_preparations.sql | P-INT-M1 durable preparation journal. Original request uses unqualified meri_intent_preparations; parent must explicitly decide schema/table and adapter binding before authoring. |
| meri_memory | apps/control/memory/migrations/0001_memory_candidates.sql | M1 immutable producer outbox, not review/publication authority. |
| meri_settings | apps/control/settings/migrations/0001_settings.sql | M1 user/tenant settings and immutable audit in same transaction. |
| meri_artifacts | apps/artifacts/migrations/0003_previews.sql | P2 durable preview records; preview claim/orphan custody and retention inventory agreement first. |
| meri_schedules | apps/control/schedules/migrations/0002_occurrences.sql | P-R4-1 occurrence UNKNOWN barrier. No schedule worker registration or placement approval. |
| command journal | apps/control/commands/migrations/0002_retention.sql | Receipt deletion amendment only after exact subject/receipt mapping. |
| approval metadata | apps/control/commands/approval-metadata/migrations/0002_retention.sql | Same condition; preserve existing immutable identity. |
| meri_task_lookup | apps/control/task-lookup/migrations/0002_retention.sql | Same condition; actor-keyed receipt linkage is not assumed conversation identity. |

Each path is absent at every inspected head and unique within this proposal. The last three rows are conditional per-family extensions required by retention request B; they do not invent mappings or grant purge activation. No existing migration is amended. Allocation numbers repeat only across independent source families.

No new migration is currently requested by startup/history or reads. Planner continuation remains a separate unallocated design request pending Core application/publication receipts; do not assign it0012 or invent endpoints. Schedule-subject retention needs its own design/table pair and is not silently included in occurrence0002. Memory/settings split the supplied combined proposed SQL into namespace-owned migrations only after approval; retain the historical proposal byte-exact.
