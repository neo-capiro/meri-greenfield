# Independent local action persistence source review

**ACCEPT_SOURCE** for `bd3de7dd9f522ef1da8bc055b9f9147e3c9d8dda`, author packet `3e62a3a97c887044e0d2ef70248f5ddb38b7e84a`. The final focused replay passed **73/73** (42 independent plus 31 author), without skips, cancellation or timeout. The independent Git/data audit passed **99/99**. All **10,030** original PR39 tracked entries remain identical. The six new runner/helper/test/README files match the exact reviewed source and final author packet.

This verdict covers source for the real-pool coordinator, fixed readback, acknowledgment-fault wrapper and fresh-pool ownership. **All six actual PostgreSQL cases are UNRUN; runtime remains HOLD.** The root CLI/admission and separate synthetic identity/gateway producer require their own integration review and an admitted real fixture. No database was installed, started, connected, migrated, queried or torn down by this review. Offline tests used port spies and the existing pure assertion, not a SQL simulator. Root's separate 694/694 receipt is not counted as validation of this new runner.

## Scope and actual call path

Criteria were committed at `018fc50b254eb0448424a4c5657e1796d0e64bf6` before candidate inspection. The dedicated review branch preserves initial `cd5c16c8`, first repairs `65ef9458`/`67d40a43`, final `bd3de7dd` and final author metadata. Reviewer edits are confined to four independent test files, the review task/report and this evidence directory.

The runner calls the existing `createTaskLookupDelivery` and concrete `createPostgresTaskLookupStore`, using a supplied real governed gateway and current-read authorizer. The fault wrapper forwards unchanged arguments to the real client's query and awaits the selected successful COMMIT before withholding one acknowledgment. It neither retries SQL nor changes rows or other budget transactions. Tests cover phase isolation, reset, error forwarding and release ownership. A lost acknowledgment is an injected caller-observation fault, not evidence of a physical network failure or PostgreSQL crash.

Readback compares exact original lookup payload, result hash, two reserved UI events, binding/scopes, invocation and reservation IDs, full delivery/facts/raw-request/operation, completion marker and charged bytes. The runner also calls the existing gateway `readInvocationOutcome` for canonical historical accounting validation. It does not invent a new budget or authority owner. Concurrent-claim, lost-ACK and current-read-revocation assertions are implemented in the six real cases, but their actual database behavior has not been observed here.

The descriptor is correlation data, not connection permission. The fixed read-only preflight checks source migration hashes, database/user/address/port/server identity, durability settings and required columns. It explicitly does not establish installation provenance or full schema equivalence. No migration or destructive SQL is added. Source transport remains synthetic in-process; production's 97 unavailable descriptors and runtime gates are unchanged.

## Preserved failures and repairs

| Exact check | Result | Disposition |
| --- | --- | --- |
| Initial fault forwarding | 13/13 pass | Same initial source, bounded source-only controls |
| Initial ownership/marker controls | 6 pass / 6 fail | Six actual source defects retained and repaired |
| Initial preflight refusal controls | 10/10 pass | No live SQL; port spies only |
| First repaired independent suite | 35/35 pass | Original six negative controls unchanged |
| Expanded final first replay | 72 pass / 1 fail | Reviewer VM realm incompatibility, preserved |
| Corrected final replay | 73/73 pass | Same source, no assertion changes |

The six defects were: a malformed but closable owned wrapper lost its cleanup callback; expired and pre-cancelled acquisition still called the factory; and contradictory completion invocation ID, reservation ID or output-byte count could pass retained-row validation. The repaired owner retains a safe known close before validating other wrapper fields, refuses before acquisition when already expired/cancelled, and never closes the identified borrowed pool. The repaired readback binds every completion field to original stored facts and exact reservation bytes. The six failed controls and raw initial output remain in Git and the packet.

The expanded provenance fixture adds only newly required original database columns. Its prior bytes and explicit hash comparison are retained. The subsequent 72/1 result arose because the original reviewer VM isolation caused `JSON.parse` to allocate different-realm prototypes, which Node's strict equality rejects even for equivalent data. The harness now imports the same newly exported pure `assertLocalResultRows`; it invokes no runner or SQL. Every fixture and behavioral assertion after `function values()` is byte-identical across that loading correction. This is a reviewer harness failure, not an additional production defect.

Original author test bodies are intact: only three imports and appended regressions were added. Failed source versions and raw output are not overwritten. The initial missing standards path and a sparse-checkout missing working-tree file are separately identified as harmless read-only discovery errors, resolved using canonical paths or exact Git blobs.

## Ownership and remaining execution limits

The initial pool is borrowed. The single owned reconnect wrapper closes once, including eventual acquisition after cancellation/closure. Failed or pending acquisition/close stays uncertain. The shared lifetime bounds waiting; it cannot prove native SQL cancellation or pool/process death. The fixture owner must supply finite connection/query timeouts, sufficient concurrency and isolated synthetic state. Retained rows and accounting are not deleted by this runner. Reconnect creates new application objects and a fresh pool; it does not restart the database or prove power-loss durability.

The author manifest SHA256 is `bc7093756e04fc383dd440874f1f7a2e405a085fbf92c0bd9c924aa2844da620`. The independent audit binds each author member and all six reviewed source identities. All six reviewer process groups were observed absent; no timeout or group kill was needed. Cleanup removed only this worktree's seven copied dependency directories (1,374,227 bytes). Donor dependencies, source, evidence, branches and other owners were preserved.

The smallest remaining execution input is the existing exact native fixture/admission materialization, supplied through the root-owned boundary with its admitted driver and already-created isolated database. No new setup/spend/security approval is inferred. The six real cases, real locking/durability, installed-migration provenance, database restart, physical cancellation and G1 runtime acceptance remain unproved.
