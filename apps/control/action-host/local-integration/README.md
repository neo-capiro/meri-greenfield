# Shared-pool local application case

This explicit synthetic case composes canonical host/application, lookup, approval metadata, command journal/executor and durable budget owners. It uses one immutable run allocation for `actions.query@0.2.0` and `create_task@0.2.0`, with distinct read and command grants/capability tokens. The local gateway still dispatches only actions.query; no global catalog handler or production source is enabled. Source responses, session identity, current policy and explicit reviewer decisions are synthetic in-process components. They are not native JWT or live source qualification.

The caller supplies an already admitted disposable PostgreSQL-compatible pool. Construction is inert. Setup is explicit, creates fresh synthetic run/grant rows, and binds both grants to one allocation using existing owners. Any setup error/uncertain acknowledgement makes that case terminal; do not retry setup. Errors retain nonsecret `ownedRows`. No schema, driver, database, pool or service is installed, opened, migrated or dropped by the case.

```js
import {createLocalApplicationCase} from './case.mjs';
import {runLocalApplication} from './run.mjs';
const caseOwner = createLocalApplicationCase({
  mode: 'synthetic-local', deadlineMs: Date.now() + 60000
});
try {
  await caseOwner.setup({pool: admittedBorrowedPool, signal});
  const receipt = await runLocalApplication({
    caseOwner, initialPool: admittedBorrowedPool, signal,
    deadlineMs: Date.now() + 30000,
    openFreshPool: async ({signal, deadlineMs}) => {
      // Caller/native owner supplies an independently opened admitted pool.
      // Return {pool, close}; close disposes only this acquired pool.
      return admittedPoolOwner.openFresh({signal, deadlineMs});
    }
  });
} finally { caseOwner.close(); }
```

`caseOwner.openHost({pool,closeGraph?})` returns `{app,credential,closeGraph?}` with a newly constructed accepted service/host graph. It never reseeds, changes the allocation/producer or regenerates the prepared proposal. `approve(proposal)` is an explicit synthetic reviewer action outside HTTP; it does not add an approval endpoint. `revoke()` invalidates the synthetic session/read identity. `stats()` is process-local instrumentation, not a database receipt. `close()` invalidates owned in-process identity and never ends a borrowed pool or deletes retained accounting.

The runner uses the existing three-host HTTP choreography and unconditionally invokes the reviewed public `receiveActionResponse` from the package's committed distribution. Host1 reads a nonempty recommendation and prepares an immutable task proposal, then verifies unapproved refusal. Host2 rereads and executes the same explicitly approved proposal once. Host3 replays the same proposal without another effect and then verifies revocation. Each fresh pool must be distinct from the initial pool and prior fresh pools. Host/listener and graph cleanup occur on success/refusal; late acquisition is closed after it arrives, and cleanup waits are bounded. This is cooperative cleanup, not proof a parked driver physically stopped.

The original absolute runner cutoff (at most30s) covers graph opening, HTTP, approval/revocation and final accounting. The existing runner's legacy default decoder remains unchanged for its independent lifecycle fixtures; only its trusted optional `receiveResponse` seam is new. The new shared-pool runner supplies the public receiver without exposing a caller override. Direct `readLocalApplicationAccounting` is also bounded (default3s, optional earlier absolute deadline/signal) and checks before/after query waits.

Required existing schemas, applied only by the native fixture owner in its existing admitted environment:

- `apps/proxy/qualification/state/migrations/0001_qualification_state.sql`
- `apps/proxy/qualification/state/migrations/0002_tool_budget.sql`
- `apps/proxy/qualification/state/migrations/0003_tool_invocations.sql`
- `apps/control/task-lookup/migrations/0001_task_lookup.sql`
- `apps/control/commands/approval-metadata/migrations/0001_approval_metadata.sql`
- `apps/control/commands/migrations/0001_commands.sql`

The existing driver pin is pg8.23.1. Verify relation/search-path resolution for unqualified `meri_approval_metadata` and `meri_command_journal`; source hashes are not installation evidence. There are no new migration IDs.

`readLocalApplicationAccounting({pool,ownedRows,deadlineMs?,signal?})` takes the canonical budget lock and observes one allocation/hash, both grant bindings and exactly two settled10microUSD reservations. The returned `kind:'database-readback'` describes the query projection only: our test supplies a scripted pool, so it is **not native database evidence**. Root's standalone receipt identifies `poolEvidence:'scripted-shared-state'`. The nested existing recovery receipt keeps `nativeDatabase:false`.

For a native receipt, its owner must separately capture initial/final real aggregate budget counters (delta20microUSD for one query+one task), allocation and grant facts/hashes, exact lookup/result/event and command journal records, same-proposal replay with no additional reservation/effect/charge, and fresh pool identities/closure. Retain row IDs and native failure/uncertainty observations for fixture-owned teardown. Reconstructed objects over retained SQL do not prove process or database restart. No native receipt, credentials or private fixture values belong in this source packet.

Focused ordinary source check (existing minimal dependencies only):

`MERI_REVIEW_SOURCE_ROOT="$PWD" node --test apps/control/action-host/local-integration/local.test.mjs`

`test-pool.mjs` is test-only and never imported by `case.mjs`/`run.mjs`. It routes canonical SQL to one shared budget harness and separate table-specific fixtures for lookup/metadata/journal; it contains no second budget ledger. No real SQL engine was exercised here.
