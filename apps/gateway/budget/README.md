# Source-only durable tool budget composition

`createDurableToolDispatch({pool, allocationJson, ...dispatchOptions})` concretely composes the existing `createToolDispatch` with `createPostgresToolBudget`. `execute(requestJson, credential, trustedInvocationJson, signal)` receives its server-owned invocation separately from worker tool JSON. Both trusted JSON documents are validated and frozen before awaits. No listener, database connection, migration, grant creation, source activation or model loop starts on import/construction. Default source-disabled behavior is inherited; the canonical fourteen source descriptors remain unavailable.

The trusted runtime owner must use a dedicated pg **8.23.1** pool (existing pin: `apps/control/qualification-sdk-fixture/state/package.json`) configured for the selected qualification database, verified TLS outside loopback, narrowly scoped credentials, finite connection timeout at most five seconds, finite query timeout at most six seconds, bounded pool size and reviewed shutdown/drain ownership. No cross-application private store is imported. The pool is borrowed and never ended here. Its version/configuration are trusted composition prerequisites; an object with a `connect` method does not prove those properties. Runtime pool, database, migration and network qualification are **unrun**. A caller cancellation or query timeout does not prove physical cancellation of server work.

Each transaction borrows one client, begins explicitly, sets server statement/lock timeouts, locks the original aggregate budget row, then reads database time. Acknowledged COMMIT precedes a reserved/settled receipt. Unknown BEGIN, rollback or COMMIT state evicts the client with `release(error)`; an acknowledged rollback can release healthy. Release failure cannot replace an existing commit-uncertainty classification. No retry, pool recreation or in-memory fallback exists. The dispatcher bounds its own wait/cleanup, including a parked connection/statement. A late transaction may still commit UNKNOWN, which is retained. Physical connection teardown remains the trusted pool owner's responsibility.

`allocationJson` binds the actual private0.2 SkillManifest body, its canonical hash, exact canonical budgets, run identity, catalog digest and immutable positive per-operation charge schedule. Schedule operations must occur in that manifest's allowed operations. This validates manifest/body/limits consistency; actual producer authority and catalog/skill availability qualification remain prerequisites. Synthetic manifests in tests do not qualify a production skill. `maxToolCalls` is never inferred from `maxTurns`. The charge is conservative budget accounting, **not provider actual pricing or spend authorization**. Missing/zero/unsupported charges refuse.

`trustedInvocationJson` contains full public RunBinding, distinct explicit qualification RunBinding correlation, exact grant and credential digest, allocation digest and a retained server-owned tool invocation ID. `bindTrustedGrant` is an explicit trusted-owner operation that stores this immutable correlation/allocation only after checking an already ACTIVE exact current grant. It creates/activates no run or grant. The runtime/Temporal owner must persist the same tool identity across retries/replacements; UI skill-invocation IDs and random per-execute reservation IDs are insufficient. Runtime wiring of that producer remains unqualified.

Qualification migration0002 is explicit via Python `PostgresStore.migrate_tool_budget()`, after preserved migration0001. It is never automatic. Existing model accounting now depends on its combined liability view; absence fails closed. Deployment must coordinate the explicit schema upgrade and both source readers before admitting work. No migration was executed. The old real-engine harness adds only the explicit upgrade and new tables to its synthetic reset; all original test assertions remain unchanged. Other frozen Linux assembly/collector identities must be separately reviewed before runtime packaging.

Under the shared budget-row lock, reservations count both model and tool UNKNOWN holds and settled charges, enforce global and installed run caps, and consume a durable tool-call slot before any handler. Every previously used invocation ID refuses redispatch, including across another reservation UUID or worker attempt. Narrower verified capability cost/output/runtime bounds apply. Known schedule expiry is published before the first authority port; validated database grant expiry before any later SQL await. Private run runtime starts at the immutable allocation's database creation time and is published into the existing dispatcher deadline before handler admission. Setup must therefore occur at the trusted run start; installing it late cannot retroactively prove total prior run duration.

Settlement records the full fixed `charged_micro_usd`; it does not claim measured usage. Exact historical settlement remains possible after revocation without authorizing another effect. Cleanup only reads the original exact reservation: UNKNOWN remains UNKNOWN and SETTLED remains terminal. Expiry, abort, missing replies, worker replacement and elapsed time never refund liability. There is no automatic no-dispatch reconciliation path.

Tests with a scripted SQL boundary establish source control flow and outcomes, including the actual dispatcher. They do not establish PostgreSQL atomicity, isolation, SQL execution, driver behavior, restart durability, real trusted identity, Temporal replay, image/runtime or G1 acceptance. Existing Aurora selection and the unknown remainder of the historical $10 allowance are unchanged; no database or paid provider action is authorized by this source.

## Trusted owner accounting readback

`readInvocationOutcome(originalInvocationJson, expectedJson)` is an explicit
internal method on the existing pool/allocation-bound budget owner and durable
gateway composition. `expectedJson` contains exactly `operation` and
`argumentsSha256`. Both inputs are bounded JSON strings snapshotted before any
await. The method adds no worker, UI or HTTP route; exposing it externally would
require separate authorization design and review. Possession of invocation
metadata alone is not an authentication mechanism.

The read uses the canonical aggregate budget lock, stored allocation, retained
grant correlation and original grant/reservation rows. It compares full original
binding, grant/capability, operation, digest and redundant row identifiers, and
validates conservative charge, output limits and state-specific timestamps/nulls.
Original expiry, revocation, replacement, schedule expiry and budget quarantine
do not hide accounting. These are historical integrity checks, not fresh effect
admission; the method neither checks nor grants current tool permission.

The frozen result contains `invocationId`, `reservationId`, `state`, `operation`,
`argumentsSha256`, `holdMicrousd`, `chargedMicrousd`, `outputBytes`, and
`observedAtMs`. Amounts are exact decimal strings, output bytes a safe number;
nonexistent fields are null. `ABSENT` means no row was observed under that lock:
an already-issued transaction may still commit afterward. `UNKNOWN` retains the
full hold; `SETTLED` records conservative accounting, not source-result completion
or provider actual usage. The observation never permits retry, refund, result
release, new dispatch or grant creation. It performs no ledger writes and does
not automatically reconcile an execute failure. Database/COMMIT/release failures
remain content-free refusal or `BudgetCommitUncertain`; no failure is converted
to ABSENT. The borrowed pool remains owned by its caller.

Scripted source tests cover the actual disabled production facade and canonical
adapter/transaction path. PostgreSQL execution/isolation, native replay and a
trusted durable invocation producer remain unqualified. The existing separate
native test suite is unchanged and still UNRUN.

## Explicit real-pg test source (UNRUN)

The separate source suite `../test/postgres-budget.integration.mjs` consumes
actual `pg.Pool`8.23.1 from the existing fixture-state package lock. It preserves
canonical `createDurableSourceDisabledGateway`: only explicit grant binding uses
SQL; execution remains UNAVAILABLE without additional SQL. Reservations and
settlements exercise the actual existing budget adapter. At most three child
Node processes each use their own real pool. Test-only forwarding can throw
**after an acknowledged real COMMIT**; that is synthetic acknowledgement loss,
not a proved network failure or PostgreSQL server-crash/restart drill. SQL row
readback is evidence, not a production outcome/reconciliation API.

Only the following offline check is admitted by the source-authoring task:

```sh
node --test apps/gateway/test/postgres-budget-admission.test.mjs
```

Future real-engine command, **not currently authorized and never auto-chained**:

```sh
MERI_BUDGET_PG_TEST_RUN=explicit-isolated-engine \
MERI_BUDGET_PG_TEST_CONFIG='<EXACT_PRIVATE_OWNER_JSON>' \
MERI_BUDGET_PG_TEST_CONFIG_SHA256='<SHA256_OF_EXACT_UTF8_JSON>' \
<ADMITTED_NODE> --test --test-concurrency=1 apps/gateway/test/postgres-budget.integration.mjs
```

The closed JSON has exactly: `host` (`127.0.0.1`), integer `port`, `database`
(`meri_qualification_test`), `user` (`qualification_owner`), nonempty synthetic
`password`, decimal-string `systemIdentifier`, timestamp-string `serverStartTime`,
exact six-digit-string `serverVersion`, safe integer `t0Ms`, `workDeadlineMs`
(`t0Ms+720000`), `cleanupDeadlineMs` (`t0Ms+900000`), and SHA256 strings
`stateLockSha256` / `migrationSha256` for the existing state package lock and
`0002_tool_budget.sql`. Values/password/config stay private; never print the
config or put credentials in command history. The template denotes separately
bound environment values, not permission to mint a role/password. Nonempty
PG*, provider, NODE_OPTIONS and NODE_PATH overrides refuse. Children inherit
only the bounded test configuration and a minimal operating-system environment.

These names, opt-in, digest and SQL identity checks are **partial binding**, not
host authority. A separately reviewed action packet must admit the actual host,
Node/pg/PostgreSQL executable and library provenance, fresh cluster system ID,
postmaster PID/start time/listeners, ownership, isolated role/HBA/configuration,
no-provider/no-egress controls and external watchdog with original work/cleanup
cutoffs. `pg_control_system()` read privilege must already be separately admitted;
the suite never grants it. It requires a fresh empty pre-migrated0001+0002 schema,
fsync and synchronous_commit enabled. It never provisions, migrates, resets,
truncates, drops, stops or restarts a server. Existing L1 command/action scope is
unchanged; this suite requires its own reviewed inclusion before execution.

Bounds: real pools max3 clients each, connect5s/query6s, transaction statement5s/
lock2s; each child group max3 children,30s within the original work cutoff,
8KiB combined output per child, TERM then owned-child KILL/reap fallback within
5s and the original cleanup cutoff. Only owned ChildProcess handles are signaled;
unknown exit/stream closure stays failure. The external supervisor must bound
all work and final pool/client teardown; JavaScript timers do not prove physical
cleanup. Pool ownership stays with the test owner, which ends it in teardown;
the borrowed production adapter never ends it. All integration cases, cross-process
behavior, actual SQL/pg-client release and database durability remain UNRUN.
