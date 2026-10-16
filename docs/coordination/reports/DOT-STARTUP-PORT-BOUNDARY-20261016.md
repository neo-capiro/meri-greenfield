# Startup capture correction — source review candidate

Base: `cfb89a3b` on `dot/meri-startup-history-20261016` (package-four base `eca78d458acb46cbfd54a94cf870841d999ef6b1`). Parent review found that default/direct `startControl` captured ports twice and rejected its own derived `configuredOwners` field. This was a regression in the L3 candidate, not a missing production owner.

The runtime capture now recognizes only the exact frozen object it previously captured, using process-private WeakSet provenance. Unknown keys remain forbidden. Caller-authored or copied `configuredOwners` cannot establish readiness. No product owner or authority is invented.

Synthetic regression controls call the real `startControl` for default, direct, factory and prepared startup; SQL, Temporal, secrets, native provider, listener and preparation-path compiler are borrowed doubles. No sockets or external services. The compiler double isolates the Windows source-composition test from separately qualified Linux preparation paths.

Before correction: 2 pass / 3 fail (default, direct and capture identity failures). After correction plus existing product-mount suite: **11 pass / 0 fail / 0 skipped**, Node heap 192MiB, concurrency 1, 2.92s. The earlier prepared fixture failure was Windows/Linux path validation; retained here, corrected by the explicit compiler double rather than weakening production validation.

Command: `node --max-old-space-size=192 --experimental-test-module-mocks --test --test-concurrency=1 apps/runtime/test/start-control-port-boundary.test.mjs apps/runtime/test/product-mount.test.mjs`.

Prepared-candidate startup still has only its existing identity composition. Additional canonical first-chat owners and a separately scoped readiness proposal remain pending; this correction makes no live readiness or integration claim. No historical manifest, lockfile, frozen contract or migration changed.
