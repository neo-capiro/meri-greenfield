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


## Durable control delivery and explicit completion reconciliation

`apps/control/tool-invocations.mjs` supplies
`createToolInvocationControl({gatewayOptions, contextJson, producerJson})`, which
constructs the actual canonical source-disabled gateway. Its methods are
`bindTrustedGrant()`, `execute(requestJson, credential, deliveryId, signal)` and
`reconcile(requestJson, deliveryId)`. The trusted control owner prebinds exact
grant/run/task/attempt/fence/policy/capability/allocation context and producer
`{namespace, executionId}` once. Delivery identity is separate from model tool
arguments. It is correlation, not authentication or proof of a genuine SDK event.
The live SDK issuer/Temporal delivery mapping is still unqualified; no new model
loop, worker credential, HTTP route or source-enablement option is introduced.
The internal `bindToolInvocationControl` composes the same methods with a borrowed
actual gateway capability for restricted source integration tests.

The gateway's `prepareInvocation(deliveryJson, requestJson, signal)` persists a
stable `owned_<UUID>` identity under the original aggregate budget lock, unique
by run and trusted producer/delivery digest. `deliveryJson` is exactly
`{context, producer, deliveryId}`; context is the existing grant facts without a
caller-chosen invocation ID. Fresh issue requires the already-bound current
ACTIVE grant and original allocation/runtime budget. Exact identity replay
recovers its original metadata/deadline even when that exact original grant is
now expired/revoked; it grants no effect. Foreign original context and changed
request refuse. `executeOwned` prepares through this owner and enters the same
canonical dispatcher. Legacy execute/forInvocation cannot use the owned_ namespace.
No public owner/control/gateway method returns the private completion-writing
budget ports. The existing nonproduced interfaces retain their behavior.

Raw request identity is the canonical SHA256 of the original request JSON, not
normalized arguments. The actual dispatcher alone computes canonical normalized
arguments after trusted context and authorization. Its original UNKNOWN reservation
and the invocation's reservation/normalized-digest claim are recorded in one
transaction. This remains the sole physical dispatch claim. Simultaneous owners,
retries, restarts and lost claim acknowledgement cannot create a second handler
effect. A prepare-only record is not authorization; the dispatcher still checks
current authority and the original deadline. No original deadline is reset.

After validated output and completed current release-authority checks, only the
canonical dispatcher's captured settlement closure can record immutable completion
metadata. This binds original invocation/reservation/grant/allocation/raw request,
operation/normalized digest, canonical result digest and byte count; no result body
is stored. Marker acknowledgement is a separate recoverable transaction boundary.
Cancellation/expiry after it prevents the next live accounting transaction. The
marker is trusted application provenance, not a provider signature or a claim that
output reached a user. General callers cannot submit completion facts.

`reconcileInvocation(deliveryJson, requestJson)` and control `reconcile` recover
the recorded normalized expectation without callers inventing it. They return
`{stage, invocationId, reservationId, accounting, resultDelivered:false}`. Stages
are ABSENT, PREPARED, UNKNOWN or SETTLED. ABSENT/PREPARED never infer no-dispatch
or permission to retry. UNKNOWN without a marker stays held. With the exact trusted
marker, explicit reconciliation can charge the full original fixed hold once and
make SETTLED terminal; repeated calls do not charge again. This preserves total
liability and explicitly clears the per-grant UNKNOWN block only after confirmed
completion provenance. It never recovers/releases tool results, refunds liability,
redispatches the original invocation or grants new authority. Expiry, revocation,
replacement and quarantine do not suppress exact historical accounting recovery.
Unknown reconciliation COMMIT acknowledgement remains unknown until another exact
read; there is no automatic transaction retry.

The explicit qualification schema sequence is0001→0002→0003. Source method
`PostgresStore.migrate_tool_invocations()` applies only the new0003 file when a
separately authorized operator explicitly invokes it; it is never automatic.
Original migrations and existing native commands remain unchanged. The frozen L1
packet does not expand to include this upgrade or new producer/reconciliation
cases. No migration or SQL has run. Scripted transaction/acknowledgement controls
are source evidence only; pg isolation, driver behavior, cross-process durability,
physical cancellation, genuine SDK/Temporal delivery and runtime acceptance remain
UNRUN. All14 production source descriptors remain unavailable.

Live producer transactions check the immutable minimum of the retained preparation
cutoff, current request cutoff, fresh authority deadlines and canonical allocation/
grant bounds. The minimum only shortens; it does not depend solely on a timer firing.
Preparation also narrows its own cutoff as trusted grant/allocation facts arrive.
The optional store check runs before/after connection acquisition, after each setup
await, and before/after COMMIT; checked SQL ports and accounting writes use the same
live bound. Cancellation after BEGIN allows rollback/release cleanup. Cancellation
or expiry during a COMMIT acknowledgement remains typed uncertainty even after a
late successful ACK. Historical reconciliation and original legacy calls retain
their previous transaction behavior. None of these cooperative checks establishes
physical query interruption or native cleanup.

## Explicit product namespace and atomic current allocation

Trusted constructors accept optional `namespace: "qualification" | "product"`; the omitted default emits existing `meri_qualification` SQL. `product` uses only fixed `meri_product_budget` table identifiers in the same canonical store/accounting/invocation owner. No arbitrary schema, pool rewrite or secondary ledger is accepted. `migrations/0001_product_budget.sql` is empty structure only, never applied by imports/runtime. Native owner must separately admit/apply the fresh isolated namespace and explicitly initialize cap/run/grant/allocation; this source supplies no seed, role, grant activation or permission. Qualification migrations/fixtures/native pins remain unchanged.

`createPostgresAdmittedRunOwner` exposes private `withCurrentAllocation({binding,signal,deadlineMs?},effect)`. A compiled callback receives immutable `{client,current}` under budget→run→allocation→all-grants→all-bindings locks, with current checks before and after. SQL method preserves the native receiver and is closed after the callback; pending unawaited queries refuse. Optional second callback argument `limitDeadline` can only narrow the owned transaction lifetime (used for original producer expiry). Caller must await all parameterized native SQL; no model/serialized function or arbitrary user SQL is admitted. Existing `currentRun`/`currentAllocation` JSON shapes and original authority deadlines remain stable. Every revocation/admission writer must use the same budget-first lock order; actual isolation/deadlock/driver/physical-stop qualification remains pending. COMMIT or release uncertainty yields existing `BudgetCommitUncertain`, never a returned effect result or automatic retry.

`readCompletion(deliveryJson,requestJson,{signal,deadlineMs?})` on the existing budget owner/execution facade reads only exact SETTLED completion provenance under that same current lease. It never prepares, reconciles or redispatches. The immutable result is `{stage:"SETTLED",binding,grantId,allocationSha256,producerKeySha256,deadlineMs,checkedAtMs,...completionMarker}`. The canonical marker contains `invocationId,reservationId,factsSha256,rawRequestSha256,operation,argumentsSha256,resultSha256,outputBytes`. Raw request/delivery and full retained facts must match; normalized arguments digest is the recorded owner value. A caller-supplied body hash cannot mint completion. Original producer/grant/allocation/schedule expiry is enforced through the lease and final COMMIT; uncertain reads release no marker. The stored marker is application provenance, not semantic source truth or proof of native provider qualification.

Do not call a second `readCompletion` transaction from inside `withCurrentAllocation`: the same budget lock would be nested. The selected journal reads the immutable marker first, then obtains its own current allocation lease before storing/releasing matched bytes; native source access and current body checks remain owned by its existing compiler/gateway/runtime.
