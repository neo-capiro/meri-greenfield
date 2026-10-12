# Independent G1 durable tool-budget review — 12 October 2026

**ACCEPT_SOURCE** for author commit `d58a2b1c51c43420fa64c1036c509ab14d872996`, tree `6d127cfcd443c748b246e05139533b23350736ed`, against PR14 `1e6d430cf9c239caca4198aea42a762f13021cd5`. **G1 runtime remains HOLD.** Reviewer: Codex `/root/memory_reviewer`, isolated branch `review/meri-g1-durable-budget-20261012`. Source was read and tested in the author's clean worktree at that exact freeze. This review branch changes only this report and its independently owned evidence directory. Source patch SHA256: `fab07c5d1f2d9c35afe9ed963d9430d610bf4c3aca92c5fdae431222d0da42f7`.

The candidate closes the reviewed source gap: the actual single-call dispatcher now has a concrete PostgreSQL-backed tool-budget composition reachable through the canonical gateway entry. Construction performs no SQL. The canonical entry hardcodes source connectivity off and binds the canonical catalog digest. All 14 catalog operations remain unavailable; 139 original capabilities, 96 selected, 43 deferred and 82 unmapped remain unchanged. This does not qualify a producer, connect a source, execute a migration or authorize spending.

## Criteria and implementation

The 12 behavioral criteria were frozen in `review/frozen-criteria.json` before implementation. Root subsequently allocated the explicit migration and narrow fixture/entry additions. `allocated-scope.json` records the approved DB6/DB8 interpretation: positive fixed per-dispatch conservative accounting charges, **not measured provider cost**, pricing approval or a new allowance. No schedule means denial; successful settlement consumes the full fixed charge; UNKNOWN retains the full hold. No automatic retry, refund or timeout release was introduced. Initial discovery HOLD and every failed probe remain in the review commit history and raw packet.

Four gateway modules separate immutable trusted allocation/invocation validation, transaction ownership, tool accounting and composition with the original dispatcher. The dispatcher, current authority implementation and original gateway tests are unchanged. There is no alternative model loop or application-private import. Claude Agent SDK, Temporal and AI SDK/Elements retain their approved responsibilities.

The separate trusted invocation binds the full public tenant/actor/conversation/run/attempt/worker/fence identity, explicit qualification attempt/worker-ARN/policy correlation, grant, credential digest and allocation digest. Its retained invocation ID is accounting identity; a new reservation UUID cannot replay it. The actual private0.2 manifest body must validate, match its canonical hash and exact budgets, and permit every scheduled operation. Trusted bodies are parsed from bounded JSON and frozen before awaits. This consistency validation does not prove issuer authority.

Reservation obtains the same aggregate budget-row lock as the model ledger, samples database time after lock acknowledgement and checks current run/grant/mapping state. The original model-send ledger remains distinct. Qualification migration0002 adds tool tables and a domain-tagged combined view. Model and tool UNKNOWN liabilities and settled consumption are counted once for aggregate and installed per-run caps. Model settlement excludes only its own `(kind='model', slot=...)`; a same-text tool slot remains charged or held. Original model overrun quarantine and snapshot field names are preserved. Missing migration0002 fails closed. Its loader is explicit; migration0001 remains unchanged and never silently upgrades.

Known schedule expiry reaches the dispatch lifetime before the first authority port, database grant expiry immediately after validation and before later SQL, and installed private runtime immediately after its row is read. Existing capability, authority and request ceilings can only be shortened. Parked handler, pool acquisition, allocation read and settlement controls suppress late results. Cancelled waiting does not prove physical query cancellation: late durable UNKNOWN or historical full-charge settlement may still complete. Exact historical settlement after revocation grants no new execution authority.

## Independent failures and repairs

- `store-before.*`: 6 pass / 4 fail. Unknown BEGIN, failed ROLLBACK and unknown COMMIT incorrectly returned a reusable client; a release error could replace commit uncertainty. The unchanged 10-case independent store probe now passes. Acknowledged rollback remains reusable; ambiguous state is evicted.
- `known-expiry-before.*`: 0 pass / 2 fail. Known grant and schedule expiry did not bound a parked handler before the longer gateway deadline. Both repaired cases now pass without changing their assertions.
- `expanded-before.*`: 16 pass / 1 fail. Validated grant expiry was published only after an allocation SQL read. A parked read exceeded the known expiry. Publication now precedes that await; the unchanged case passes.
- `deadline-mutant.*`: intentional 0 pass / 2 fail after removing deadline publication from an isolated temporary copy. Handler/settlement probes detect the missing behavior. Production source was untouched and the temporary mutant removed.
- `dispatch-before.*` retained 3 pass / 7 fail from a reviewer fixture missing newly required manifest and stored-row fields. Assertions were retained while supplying the allocated contract. `first-authority-fixture-error.*` retained 28 pass / 1 fail from trying to modify the original frozen authority fixture; injecting an override corrected the setup. These were fixture errors, not production defects. Original assertions and negative controls were not weakened.

## Exact freeze checks

All final commands exited zero, with no skipped or cancelled cases:

| Check | Result |
| --- | --- |
| Independent actual-dispatch / transaction-store controls | 19 + 10 = 29 passing |
| Independent actual Python model-ledger accounting controls | 5 passing |
| Author's actual model-ledger source cases independently rerun | 7 passing |
| Complete gateway suite including original 101 cases | 139 passing |
| Root contracts / session checks | 244 passing |
| Public generation comparison / TypeScript / public cases | pass / pass / 7 passing |
| Independent exact-byte preservation checks | 107 passing |

Independent scripted SQL controls exercise the real JS adapter/dispatcher and Python ledger methods: one handler/debit under replay/contention, lost reserve COMMIT acknowledgement, late reservation, shared global/run exact caps, typed identity collision, revoked/expired/stale denial, immutable binding, manifest mismatch, early deadline publications and terminal uncertainty. They are **not an SQL engine** and do not prove real atomicity or durability. Python source tests use scripted SQL/test transport seams without provider SDK, driver, native runner or database execution.

`final-preservation.json` verifies 85 protected originals byte-for-byte, including the complete contracts package, dependency manifests/locks, original gateway tests/dispatcher/authority/catalog and migration0001. Only four existing paths change. The entire original gateway entry remains an exact prefix. Removing the approved explicit-loader addition reproduces the original Python store bytes. Removing the explicit migration call and three synthetic-reset tables reproduces the original real-engine fixture bytes; all 23 original test-method ASTs are exact. New source paths stay allocated. All 13 author source-manifest entries match frozen Git and current worktree hashes.

Raw commands, exits, stdout/stderr, source patch, final hashes and immutable before-results are under `docs/qualification/candidates/g1-durable-budget-20261012/review/`. `final-receipt.json` binds this report and the complete review packet. Preserve the full review commit sequence when integrating, including criteria and HOLD/failure commits. This acceptance does not replace those failures.

## Remaining gates and cleanup

Real PostgreSQL DDL application, original real-engine suite, JS/Python cross-process contention, driver serialization/TLS, row-lock behavior, connection eviction, crash/reconnect/WAL durability and physical cancellation are **UNRUN**. The borrowed pool must meet the documented bounded configuration/teardown contract; this source tests its pg-compatible seam. Runtime packaging, current context/collector source identities and coordinated explicit migration require review before execution. No shared packaging pins were edited.

Trusted manifest/schedule issuer qualification, invocation IDs retained through Temporal recovery, complete task/grant lifecycle, real task-A/B checkpoints/stale-worker rejection, supported patched image, sandboxed browser/renderer, egress/watchdog/teardown and artifact inspection remain runtime gates. Installing an allocation late cannot prove elapsed time before its database start; the runtime owner must establish it at run start. SDK turn/recovery budgets remain the SDK/manifest-runtime owner's responsibility.

Existing Aurora selection is unchanged. The historical $10 aggregate remainder is unknown. No database, cloud, native, paid model, provider, customer-data, frontend or Hermes action occurred. No dependency install, production edit, source publication or background service was performed by this review. Bounded captured check children exited and were reaped; no reviewer-owned work remains running. Integration remains the parent's separate responsibility.
