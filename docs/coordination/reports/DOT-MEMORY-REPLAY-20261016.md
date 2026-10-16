# Memory correction replay repair

Base `eca78d458acb46cbfd54a94cf870841d999ef6b1`; independent parent finding: `producer.correct` consulted mutable target eligibility before immutable request custody. This is a source candidate, not live/Core/database acceptance.

The canonical producer now reads the original candidate by **tenant + proposer + idempotency key** before consulting a correction target. It checks current proposer visibility and the original request hash. An identical request returns the original candidate/hash/target pin and Core's current review state even after the target is superseded, forgotten, expired or missing. A lost submit ACK first reconciles the same candidate with Core; no replacement ID or target pin is generated. New requests still require an active eligible target. The conversational keyed-proposal path uses the same ordering.

`postgres-journal.mjs` adds one scoped read over the existing proposed journal table; no DDL, migration or frozen wire changes. `producer.mjs` keeps submission and status ownership together in `submitRecord` and the small `replay` path. Core remains the sole review/publication owner. A key or retained record never grants visibility.

Synthetic evidence: `docs/qualification/candidates/dot-budget-planner-20261016/controls.json` and `memory-*.stdout.txt`.

- Original pinned producer with the five new cases: **0/5 pass, 5/5 fail**, on target eligibility/not-found as expected.
- Repaired producer suite: **16/16 pass**.
- These bounded controls execute the actual producer, eligibility, wire, candidate, Core adapters and scripted journal/transport. The canonical SHA-256 dependency is explicitly mocked as SHA-256 of JSON bytes because exact installed dependencies are unavailable. They do not qualify canonical JSON, contract schemas, Core, PostgreSQL or live policy.
- Exact original source bytes were restored after the negative control; the evidence records the restored SHA-256.

Full dependency-backed producer/command/product HTTP suites, PostgreSQL journal behavior and live Core review remain **UNRUN**. Shipping has not granted a dependency-install/heavy-test slot. New journal read must be present in trusted compositions and test doubles; no adapter compatibility is silently assumed. Existing suite inventory globs already include these tests. Changed h proof rows: **none**; source proof remains 5/5, without repinning a manifest.
