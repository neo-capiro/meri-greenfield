# Reserved memory and settings SQL source

Source authoring only; no PostgreSQL parser, database, migration runner, role, credential or live operation was used. This follows the initial source packet `a2e1829e4cba79069a1f95d5477aa584cf3337e8` and the parent-authorized central allocation `641f298025c4c9f344d9d16f852cb6eb62b21906`, tree `62639e5c224f500104c7d29e06ef9f1dec7cc1c7`, branch `dot/meri-package4-allocations-20261016`. The allocation is source numbering and ownership, not acceptance of DDL or execution.

The central record is `docs/coordination/tasks/CODEX-PACKAGE4-CENTRAL-MIGRATION-ALLOCATIONS-20261016.md` on that branch. This lane exclusively authors:

| Reserved path | Source status |
| --- | --- |
| `apps/control/memory/migrations/0001_memory_candidates.sql` | Authored; review pending |
| `apps/control/settings/migrations/0001_settings.sql` | Authored; review pending |
| `apps/control/intents/migrations/0001_intent_preparations.sql` | Reserved only; not authored; exact design release pending |

That table records the initial allocation packet. The later parent disposition at central `0b0b7abd536a27a74e3b1077ae71eed6e0ba275b` released exact intent DDL source authoring; its focused successor is described in [DOT-CANONICAL-INTENT-JOURNAL-20261016.md](DOT-CANONICAL-INTENT-JOURNAL-20261016.md). It adds no SQL execution or first-chat dependency.

The historical `docs/coordination/proposals/memory-settings-20261016/proposed-memory-settings.sql` remains unchanged. Memory source maps its original `meri_memory.candidates` subsection to the allocated path. Candidate/request hashes and identity columns remain immutable; the proposer-scoped idempotency key stays unique. Source additionally requires a submission timestamp exactly when SUBMITTED and forbids acknowledged review identity replacement, SUBMITTED regression, and SUBMISSION_UNKNOWN regression to PREPARED. It permits the existing same-review acknowledgement refresh. Core continues to own current review status. It adds no memory application, approval or authority.

Settings source maps the historical `meri_settings` subsection exactly, apart from a source-only header. It retains per-user and per-tenant revisioned documents and the existing audit columns for the store's same-transaction CAS/audit writes. Audit UPDATE is forbidden; DELETE remains available to the separately governed retention owner. No automatic deletion or execution is introduced.

Three focused built-in tests inspect these source invariants and the exact settings subsection mapping. They are static assertions, not SQL parsing, trigger execution, PostgreSQL isolation or migration acceptance. They pass in the bounded supplemental run described in [DOT-CANONICAL-INTENT-JOURNAL-20261016.md](DOT-CANONICAL-INTENT-JOURNAL-20261016.md). Real schema/store/concurrency qualification remains UNRUN until one reviewed integration checkpoint receives a bounded heavy-test slot. Neither file is required by this packet's first authenticated chat path. No product-budget 0002, held conversation 0012, historical manifest, lockfile or frozen contract was edited.
