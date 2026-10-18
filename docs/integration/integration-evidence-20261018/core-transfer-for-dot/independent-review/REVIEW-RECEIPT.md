# Core native identity read-only receipt

Core work stopped when the user assigned exclusive integration to **dot**, roster `b5071e8156899c1a5d01c19e64d647cb44e40789`. This receipt preserves observations already gathered; it grants no publication or integration approval.

- Published baseline: `78ceaf9bdfe00c8f013aac15eb8483312ae4f803`.
- Middleware: exact approved **65 additions / 2 deletions**; actual bytes equal both approved proposed file and immutable Meri proposal. SHA-256 `d9931a98db2de9ca10cbd2aa161983747c159773e30bbc04bcb36474530095e0`; patch SHA-256 `9f4ded7f8a111154cf32dea7888fb145c7bcb72b73b4eef1d7f3870a6e7f4043`.
- Other seven baseline source/test files match the immutable published manifest exactly.
- Independent focused reproduction: **34/34 pass**, original baseline **2 pass / 32 fail**, unchanged published source/batch tests **10/10 pass**, zero skipped.
- Normal local TypeScript lookup is unavailable in this partial materialization. The successful focused run used the existing exact TypeScript 5.9.3 module via the test's explicit absolute override, Node24.19.0 and --experimental-vm-modules. No install occurred.

The new test normally reads neighboring repository middleware/authority/batch/wire/leaf files. Its private WeakMap seeding is appended only inside the VM test module; production has no seed export. A separate test runs the actual ordinary use() admission to create provenance, with external services stubbed.

Source inspection preserves exact native request/context/membership provenance, fixed POST target, denial of marked-control/impersonated requests, explicit tenant/actor SQL predicates, ordered FOR SHARE row locks, fresh online observation and local reads through the same caller transaction. The existing default withSystem/impersonation path and control-credential route set are unchanged; the only use() path change adds no-store coverage. No controller/route/credential change was present in the inspected production patch.

Limits: this is an eight-source-file materialization, not a full Core Git checkout; semantic typechecking is unsupported/unrun, and transpilation proves syntax only. Real Nest route/application integration, live Clerk freshness, PostgreSQL locking/snapshot conflicts/RLS/pool behavior remain unverified. No source edit, install, publication or remote mutation by this reviewer.

Exact hashes, copied test hash and log counts are in REVIEW-RECEIPT.json. Logs: actual-focused.tap, baseline-focused.tap, published-focused.tap; the normal-resolution failure is preserved in normal-lookup-blocked.tap.
