# Retention release fence: bounded pool follow-up

Status: source-only correction to Meri PR180 at
`a1876afaeaa59d9da47729487d490cba8cfc9d9c`; release qualification remains
held. PR175 and the PR180 owner branch are unchanged.

## Implementation outline

The published whole-response fence holds a PostgreSQL session lease and shared
subject transition locks until response serialization. Its final retention
read calls `journal.tx` through a watermarked read, borrowing a second lease
from the same pool. With a single-connection pool, a disposable reproduction
timed out as `RETENTION_READ_UNAVAILABLE` after 81 ms with two checkout
attempts and one queued. Enough concurrent pages can exhaust a larger pool.

Keep the existing canonical owners and release order. The PostgreSQL journal
will lend a callback-scoped projection reader on its already held lease,
restricted to subjects locked for that response. It will hold shared recovery
exclusion during final authorization and synchronous response serialization,
then unlock recovery and subjects before returning a clean lease. The
watermarked journal will use that reader for the same joined
projection/watermark statement, preserving ledger-head and projection-sequence
checks. The retention gate will give history a scoped `assertServable` inside
the release callback; earlier checks still use the ordinary gate. No new pool,
global ambient state, migration, feature gate, or authority is introduced.

Add a finite-pool regression that fails against the parent at capacity one,
then two concurrent responses at capacity two, suppression-before/after
publication ordering, and success/error/cancel cleanup. Run only focused
retention, history and product release checks, syntax, provenance if needed,
and source whitespace review. The standard 32 failures and 3/18 TypeScript
diagnostics recorded on PR180 remain separate release gates.

## Source result and focused verification

The callback now receives a reader limited to the already locked subjects and
the lifetime of the callback. Its joined projection/watermark SELECT runs on
the held PostgreSQL lease after the session acquires shared recovery exclusion.
The watermarked journal still checks the current external ledger head and the
projection sequence before the response is released. The gate refuses a key
outside the locked set or a captured reader used after unlock. All earlier
retention reads and suppression decisions retain their normal owner paths.

The two canonical history releases at pool capacities one and two failed on
the exact PR180 parent with `CONVERSATION_UNAVAILABLE` after its second checkout
queued. The repaired source passes the five new bounded-pool cases plus the
scoped-reader lifetime case. The final focused five-file run passed **112/112**
across history, product release, retention release, scheduled conversation
history and history-source contracts. The scheduled tests include immutable
occurrence custody without a Core conversation. The history-only generator and its
check agree; only the source fingerprint metadata changed. Syntax and diff
whitespace checks passed.

One wider retention-watermark file still has its independently inventoried
PR179/PR180 fixture failure at line 50: its synthetic journal omits the
already required `withTransition` port and raises `RETENTION_CONFIGURATION`.
The other 13 tests in that file, including the atomic SQL snapshot cases,
passed. The PR180 standard 32 test failures and 3/18 TypeScript diagnostics
are inherited gates, not qualified by this focused result. No real PostgreSQL
server or bounded production database pool was exercised. This source fix
does not provide an atomic final decision with independent Core writes; that
requires a separate Core-owned batch authorization contract.
