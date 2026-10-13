# Persisted admitted-run application composition

`createPostgresAdmittedRunOwner` (public gateway export) supplies the existing `currentRun(binding, {signal})` contract from persisted canonical admission. It performs no admission, activation, replacement, revocation, accounting write, refund or migration. Its constructor opens no connection; callers own the pg-compatible pool.

```js
const current = createPostgresAdmittedRunOwner({
  pool, allocationJson, grantFactsJsons, now: Date.now,
  limits: {maxRequestMs: 1000, maxFactBytes: 131072}
});
const receiptJson = await current.currentRun(exactBinding, {signal});
```

`allocationJson` is the existing immutable budget allocation. Each configured grant JSON is the canonical immutable facts object (`grantId`, `binding`, `qualificationBinding`, `capabilitySha256`, `allocationSha256`), without an invocation ID or credential. One to sixteen unique grants must share the exact full binding, qualification mapping and allocation. Every configured grant must be ACTIVE and current; revoking any one makes this combined reader unavailable. This is an explicit availability restriction for the configured set, not a replacement for per-operation capability, business or source authorization.

The reader uses the existing budget transaction/global lock and database clock. It checks quarantine, current run attempt/worker/fence/policy, full immutable facts, redundant grant/run/allocation identifiers and budgets. The returned deadline is the minimum of stored allocation start plus runtime, schedule expiry and all configured grant expiries. Each known shorter deadline clips the pending operation before another SQL call. `checkedAtMs` is the local receipt clock after acknowledged transaction completion; database time controls persisted expiry. Capacity and UNKNOWN liabilities remain the existing reservation/accounting owner's responsibility. Current-state reads do not assert available spending capacity or erase liability. Lost COMMIT acknowledgement releases no authority. Bounded awaiting/cancellation prevents new late SQL after a cutoff; it does not prove a physically cancelled in-flight database command.

## Application mount

`createAdmittedActionHost` in `mount.mjs` composes the persisted reader, canonical read/command authorities, generic retained-result authorizer, durable lookup/metadata/command owners, and the existing session/application mount. Both authority port groups omit `currentRun`; the same concrete persisted function is installed in all three paths. No prebuilt services, gateway, executor, authority, factory or source toggle is accepted.

```js
const host = createAdmittedActionHost({
  admission: {pool: budgetPool, allocationJson, grantFactsJsons},
  readPorts: {verifyCapability: verifyRead, authorizeBusiness: authorizeRead, authorizeSources},
  commandPorts: {verifyCapability: verifyCommand, authorizeBusiness: authorizeCommand, authorizeSources},
  lookup: {pool: lookupPool, credential: readCredential, scopes: selectedClientScopes},
  metadata: {pool: metadataPool, preparePolicy},
  command: {journalPool, budgetPool, producerContext, approvalStore, source, contracts, descriptor},
  commandContext, client: applicationAuthorityClient, hostPorts,
  now: Date.now, newId: randomUUID,
  limits: {maxRequestMs: 1000, maxRequestBytes: 65536, maxResponseBytes: 131072,
    maxFactBytes: 131072, maxCleanupMs: 100},
  sessionLimits: {maxSessions: 50, maxRequestMs: 1000, maxTtlMs: 30000, maxFactBytes: 131072},
  enabled: true
});
const listener = await listenActionApplication({app: host.app, host: '127.0.0.1', port: 0, lifetimeMs: 30000});
// Existing session POST and action routes share this listener. Never log tokens.
// Finally: await listener.close(); host.close(); caller disposes its pools separately.
```

The mount requires exactly two distinct configured grants: lookup credential digest matches the read grant, and immutable command producer facts match the command grant. Reader, gateway and command accounting share the exact same borrowed budget pool. Other domain pools may differ. The scope is exactly the server-selected client with the configured policy revision. Returned reservation delivery facts and returned read/command credential digests must remain in that watched set; canonical host/executor checks still validate receipt identity, deadlines, approvals and current authorization.

`enabled` only exposes the browser application; defaults to false. All production sources remain disabled. Whole-host disabled responses are 503 UNAVAILABLE/NOT_DISPATCHED. An authenticated source-off query currently reaches the accepted durable-service refusal and yields 502 UNAVAILABLE/UNKNOWN; this is the existing conservative application outcome, while the constructed canonical source/delivery/budget owners do not dispatch. The supplied reserveLookup and issueLookupCredential ports are still called; their physical effects retain their own owner semantics. The synthetic fixture observed zero source/task effects and unchanged accounting. It must not be reported as a successful query or silently relabelled NOT_DISPATCHED.

`close()` closes only the owned process-local session registry. Reconstructing this owner/mount over the same persisted rows preserves original deadlines; browser sessions require fresh issuance. Restart loses opaque sessions. Native credentials and browser tokens remain distinct. Browser hints never admit a run/grant or create worker/fence/policy identity. Same-origin frontend transport is unchanged; no permissive CORS is added.

## Source and deployment boundary

The existing persistence is explicitly `meri_qualification` schema and its canonical qualification worker mapping; these names and constraints remain intact. This concrete source reader does **not** close product persistence, verified live worker activation, general run lifecycle, or native database qualification. Upstream `Grants` activation remains an independent trusted owner. No FixtureRegistry/qualification experiment is promoted. The Capiro application-authority endpoints and current native-session verification still require their separate implementation/qualification. Approval metadata and approval decisions retain their existing owners. No live DB, native worker, cloud or provider action was exercised.

Executable synthetic test fixture: `test/fixture.mjs` exports `admittedFixture()`; set `MERI_REVIEW_SOURCE_ROOT` to the exact checkout. It borrows existing canonical scripted SQL owners and synthetic policy/transport fixtures. Its receipts are source tests, not native database observations. `make()` builds the actual source-disabled mount, and `h.state()` exposes test-only persisted rows for revocation/corruption controls. Production modules do not import these fixtures.
