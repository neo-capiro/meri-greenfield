# Owned qualification application

`createQualificationApplication` in `application.mjs` is the explicit executable assembly for an admitted disposable fixture. It reuses the existing six migrations, canonical Python Grants/GrantAdmission, durable tool-budget owners, persisted currentRun, application/session host, typed action query and approved task-create path. It creates no model loop. The Claude Agent SDK remains the sole model loop; production catalog/source activation remains unchanged.

## Native owner supplies the execution inputs

Use the [native fixture packet](../../../docs/coordination/reports/CODEX-QUALIFIED-NATIVE-FIXTURE-REQUEST-20261013.md). The exact engine, owned worker and read authority must be established in that owner's execution environment. Source tests cannot establish them, and a structurally compiled admission's `runtimeEnabled` property is not live-worker proof.

The factory accepts a closed configuration:

- `hostConfiguration`: the existing admitted-host fields, with one identical borrowed pool for `admission.pool`, `lookup.pool`, `metadata.pool`, `command.journalPool` and `command.budgetPool`. `command` has no `source` field; the qualification mount builds that fixed adapter itself. Read/command ports omit `currentRun`, which always comes from persisted admission. Grants, tokens, client and policy are trusted server configuration.
- `source: {read, command}`: fixed HTTP transport configurations with `origin`, `getCredentials`, `fetchImpl`, and optional bounded response/request sizes. Both require an owned `.invalid` or explicit loopback origin; the canonical HTTP adapters enforce their own HTTPS/URL requirements. Trusted fetch implementations own actual IO. No generic handler, gateway override or browser activation flag is accepted.
- `lifecycleConfiguration`: `{pythonExecutable, connection, workerObserver, worker, expiresAtMs, limits}`. `workerObserver` is the concrete branded native-enforcement predicate observer. `worker` is `{probeKind, attemptStartMs, attemptEndMs}`. `limits` is `{maxRequestMs,maxFrameBytes,maxCleanupMs}`. Connection and worker data are frozen before setup.
- `fixture`: the exact engine descriptor and acknowledged schema digest, or `schemaSha256:null` for an explicitly fresh install. Both Python and Node verify the same engine identity before their operations.
- `originalDeadlineMs`, `now`: one immutable overall work cutoff and trusted clock. Setup is also clipped to known grant expiry; schema calls are additionally capped at60seconds. These do not extend the original fixture work/cleanup deadlines.

Construction has no database/process/listener calls. The app refuses requests until setup succeeds:

```js
const application = createQualificationApplication(configuration);
const admission = await application.initialize({prepareSchema: true, signal});
// Retain admission.fixture (including the exact installed schemaSha256).
// Borrow the existing bounded Node HTTP listener only after initialize succeeds.
const server = await listenActionApplication({
  app: application.app, host: '127.0.0.1', port: 0,
  lifetimeMs: Math.min(10_000, configuration.originalDeadlineMs - Date.now()),
});
```

On an already installed fixture, use `initialize({prepareSchema:false,signal})` with its retained digest. This verifies schema before the one-shot activation. Do not derive the digest from source hashes or an invented catalog.

A fresh host over retained state uses the same grants, allocation, binding, expiry and original deadline, a fresh caller-owned pool targeting the exact same engine, and `admission.fixture`:

```js
const recovered = createQualificationApplication(retainedConfiguration);
await recovered.reconstruct({signal});
```

Reconstruction verifies schema, re-observes the worker and performs canonical admission reads. It never migrates, sets a new run, creates/activates grants, rebinds allocation, generates a proposal, or retries a source effect. The persisted proposal and journal determine replay.

`revoke({signal})` invokes the canonical grant owner within the same original cutoff. Ambiguous activation/setup is terminal `UNKNOWN` in that owner instance; there is no automatic retry, refund, reset or compensating mutation. An expired grant cannot be used. Cleanup/late revocation outside the admitted work window belongs to the separately authorized native owner.

Close the listener and call `application.close()` in `finally`. The application closes its own session state and cancels ongoing setup; it never ends borrowed pools, deletes fixture resources or claims that cancellation proves physical stop. Inspect `status().lifecycle` for owned-child cleanup observations. The native owner seals physical process/resource cleanup separately.

## Evidence boundaries

`application.fixture.mjs`, `schema.fixture.mjs`, `lifecycle-bridge.fixture.mjs` and worker-observer fixtures are source-test-only. They exercise the actual typed graph, fixed child bridge and canonical Grants with scripted boundaries; they do not prove PostgreSQL durability, AWS read provenance, a live worker, Clerk identity, browser sandboxing or G1 acceptance. Never import them into a native execution owner.

The source observer returns `trusted-read-port-observation` with `runtimeQualified:false`. The schema receipt identifies catalog observations independently from migration-source hashes. Private native pins, credentials and raw native readbacks remain with the native owner and are not publication inputs.
