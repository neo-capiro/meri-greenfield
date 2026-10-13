# Local action lookup integration

**ACCEPT_SOURCE; runtime HOLD.** Independently reviewed synthetic identity, current policy, actual gateway composition and real-pool persistence cases are integrated at `f8ee0a61577dcb332559f9c0a152f521846b5331`, on preserved PR39 base `d68615c9861315ac1c6ee616697f7ad0093d9192`. The exact corrected PR39 suite passed **694/694** once; the combined new-source suite passed **131/131**, with zero failures, skips or cancellations. **All six actual PostgreSQL cases remain UNRUN.** Import composition passed without opening a pool or loading a database driver.

## Runnable implementation

[`scripts/local-action/cli.mjs`](../../../scripts/local-action/cli.mjs) now composes a private, hash-pinned fixture admission, the existing native pool/identity guard, a synthetic identity and current-policy producer, the canonical governed gateway and durable action adapter, and a real PostgreSQL persistence runner. The [runner instructions](../../../scripts/local-action/README.md) and [input template](../../../scripts/local-action/input-template.json) specify the exact invocation and fixture-owner inputs. The template deliberately contains null fixture, lifetime and secret fields; it cannot authorize or start a run.

The synthetic issuer retains opaque-token digests and trusted client/run/policy/grant state. Fresh authority checks reject expiry, revocation and policy/fence changes. It is process-local test identity, not a production JWT issuer. The gateway uses the existing canonical authority, durable invocation/budget owner, action contract and adapter. Source responses are synthetic in-process responses; no external service or model is called. The production registry is unchanged and remains unavailable.

The persistence runner accepts a real pool and implements `reconnect`, `concurrent-claim`, `lost-claim-ack`, `lost-dispatch-ack`, `lost-result-ack` and `revoked-read`. It checks exact stored results/events, original provenance, completion markers and historical gateway accounting, and closes only its owned fresh pool. Lost acknowledgment is injected after the actual COMMIT resolves. Reconnect reconstructs application objects and opens a fresh pool; it does not restart PostgreSQL. Source migration hashes and observed schema checks are separate from installation provenance. No database setup, migration, history deletion or schema teardown is included.

## Independent acceptance and evidence

| Component | Exact accepted source | Independent review |
| --- | --- | --- |
| Four identity/gateway/case modules | `351b23190e61b459e94c910da013d1a0ea0a4518` | `b51a6a51c9b2a4a5012d79419b32134cbf811c19` |
| Four persistence modules | `bd3de7dd9f522ef1da8bc055b9f9147e3c9d8dda` | `e50d09954fdadd99030f2e09347dcccd0bcf8a09` |
| Admission and executable CLI | `bd118a04cdf79b2b6d06464f8f794fdd7c101b52` | `b51a6a51c9b2a4a5012d79419b32134cbf811c19` |

The [identity review](CODEX-ACTION-LOCAL-IDENTITY-REVIEW-20261013.md) and [persistence review](CODEX-ACTION-LOCAL-PERSISTENCE-REVIEW-20261013.md) accept source only. Preserved failures include the denied-read error translation, dropped ambient environment guard, fresh-pool cleanup/admission defects and contradictory completion fields. Original negative controls and raw failed output remain in their packets. Reviewer harness failures are identified separately from source defects.

- Full corrected PR39 replay: [`consolidated-final-pr39.json`](../../qualification/candidates/task-slice-20261012/integration/consolidated-final-pr39.json), 694/694, 85.373 seconds. This replaces reliance on the earlier 57 affected checks without rewriting the earlier 691/694 failure evidence.
- New integrated replay: [`combined.json`](../../qualification/candidates/action-local-20261013/integration/combined.json), 131/131, 24.159 seconds, exact integrated source above. This is offline source validation, not real SQL execution. Tests use a cleaned child environment; the parent environment is unchanged.
- Executable imports: [`executable-imports.json`](../../qualification/candidates/action-local-20261013/integration/executable-imports.json), exit 0; actual fixed imports and case factory resolve, no pool or SQL.
- Source preservation: [`source-verification.json`](../../qualification/candidates/action-local-20261013/integration/source-verification.json), **10,030/10,030 PR39 entries byte-identical**, all ten production modules match accepted pins, and all 115 members of four component manifests match. Authored whitespace checks pass; raw failure streams are not normalized.

## Exact remaining input and gates

The [read-only environment inventory](../../qualification/candidates/action-local-20261013/integration/environment.json) found no PostgreSQL server/client binaries, no Docker images or containers, and no materialized canonical `pg@8.23.1`. No existing isolated fixture admission was supplied. The remaining execution input is the native fixture owner's existing synthetic database access and bounded runner configuration, plus that canonical driver. A private admission file must bind the existing fixture's observed identity, lifetime and source pins. This is missing fixture access/materialization, not missing action-store source or a request for generic source permission. No driver/engine installation, image pull, service launch, database connection or migration occurred in this continuation.

The fixture owner retains database teardown responsibility for recorded synthetic row IDs. Actual SQL locking, durable commit behavior, live identity/policy, database crash recovery, physical cancellation and native/G1 acceptance are unproved. External supervision remains required for an admitted run. The separately owned native four-module publication decision does not block this completed source slice.

G0 remains accepted; G1 remains OPEN; G2–G7 remain unentered. Scope remains 139 original capabilities, 96 selected and 43 deferred; all 97 current production operation descriptors remain unavailable with null handlers and no automatic retries. Public 0.1/private 0.2 contracts, canonical registry, original branches/tests, shared frontend, native worker and selected Aurora architecture are preserved. No main merge, cloud/security/network/customer-data change, provider message, paid-model call or infrastructure spend occurred. The prohibited vulnerable image was never launched. Paid allowance reconciliation and affected private host/Hermes policy access remain separate gates.

Owned test groups are absent and only this root worktree's two temporary dependency links were removed; see [`cleanup.json`](../../qualification/candidates/action-local-20261013/integration/cleanup.json). Publication adds evidence only after the tested source freeze. The root packet manifest excludes itself and the subsequent publication receipt.
