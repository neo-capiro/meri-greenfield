# Owned disposable qualification schema

`schema.mjs` exports two explicit operations. Importing it opens no service, reads no migration file and performs no SQL. Neither operation opens or ends a pool, creates a database/role, changes grants, starts a worker, approves a command, or enables a source.

```js
const receipt = await prepareOwnedApplicationSchema({
  pool, // Borrowed pg-compatible pool from the trusted disposable fixture owner.
  fixture: {
    mode: 'owned-disposable-qualification',
    fixtureId, host: '127.0.0.1', port,
    database: 'meri_qualification_test', user: 'qualification_owner',
    systemIdentifier, serverStartTime, serverVersion,
    schemaSha256: null
  },
  deadlineMs, signal, now: Date.now
});
// Retain receipt with the fixture's trusted ownership record, outside model input.
const verified = await verifyOwnedApplicationSchema({
  pool, fixture: {...fixture, schemaSha256: receipt.schemaSha256},
  deadlineMs: reconstructionCutoff, signal, now: Date.now
});
```

`fixtureId` is a lowercase UUID. The system identifier is a decimal string; server version is the exact six-digit PostgreSQL version string; server start is canonical UTC ISO milliseconds. Descriptor equality is a correlation check, **not proof of resource ownership**. The caller must separately own and admit the disposable database and preserve the retained receipt. This module accepts no credentials, arbitrary migration path, SQL, table list, overwrite flag, or source switch.

The original absolute cutoff must be in the future and at most60 seconds from admission. Every asynchronous wait is under the existing shared operation lifetime. Pool connection timeout must be positive and at most5000ms; query timeout must be positive and at most6000ms. Each submitted query uses the minimum of that supplied query timeout,5000ms and remaining time. Cancellation/deadline controls stop later application work; they do not prove physical interruption of an already submitted pg query. The canonical transaction owner releases its acquired client, including a late acquisition, and owns rollback/commit uncertainty. The caller remains responsible for the pool and fixture cleanup.

Installation checks engine identity, fsync/synchronous_commit and an explicit transaction-local `public` search path before DDL. It acquires a fixed transaction advisory lock, requires the target schemas to be absent and public to contain no relations, then forwards these exact six existing files in order:

1. `apps/proxy/qualification/state/migrations/0001_qualification_state.sql`
2. `apps/proxy/qualification/state/migrations/0002_tool_budget.sql`
3. `apps/proxy/qualification/state/migrations/0003_tool_invocations.sql`
4. `apps/control/task-lookup/migrations/0001_task_lookup.sql`
5. `apps/control/commands/approval-metadata/migrations/0001_approval_metadata.sql`
6. `apps/control/commands/migrations/0001_commands.sql`

There is no partial upgrade/adoption path. A fixture that already contains only the first two migrations must use its existing owner or be replaced by a separately authorized fresh disposable fixture; this function never resets or drops it.

The postread checks all13 relations: source-declared column names/order/types/nullability/default presence, constraint cardinalities and validation/deferral state, unique-index counts/validity/predicates, owner, RLS, noninternal triggers and view presence. Full server-rendered constraint/default/index/view definitions are included in a stable ordered JSON signature with the six source hashes. Exact initial DDL bytes plus the fresh transaction establish the initial source binding; the code does not contain a competing PostgreSQL CHECK-expression parser. `schemaSha256` hashes this complete signature. Reconstruction checks those same structural rules and the trusted original hash. It permits retained rows, consumed accounting and quarantine, so a successful schema check is never an authorization or spending-capacity decision.

Initial installation additionally observes zero rows in every application/authority/accounting table except the exact singleton budget (10000000 cap, zero consumed, not quarantined). Receipt fields include `schema:'meri.owned-qualification-schema/1'`, `status:'PASS'`, `operation`, `originalDeadlineMs`, `schemaSha256`, six-key `migrationSha256`, full catalog, engine identity, observed budget, `initialStateVerified`, `runtimeQualified:false`, and `poolClosed:false`. `evidenceKind:'borrowed-pool-catalog-observation'` describes the port observation. A scripted pool is not a native PostgreSQL receipt.

Errors expose only `code:'QUALIFICATION_SCHEMA_REFUSED'`, fixed `stage`, `outcome`, and pending-operation count. Before any DDL submission the installation outcome is `NOT_INSTALLED`. After submission any failure is conservatively `UNKNOWN`, including validation failure, cancellation, uncertain COMMIT or client release. There is no automatic lookup/retry that turns UNKNOWN into success. Verification errors use `READ_UNAVAILABLE`. Never automatically reapply an unknown installation.

The transaction-local search path controls these six migration applications only. It **does not secure later pool connections** used by existing unqualified metadata/journal SQL, nor prevent another connection's temporary relation from shadowing public. The application assembly must establish that separate resolution boundary; this module does not alter those owners.

Canonical owner dependencies are `PostgresBudgetStore`, `createOperationLifetime` and the existing inert command/data boundary. No additional packages or installation are needed for the focused source test:

```sh
node --test apps/control/qualified-application/schema.test.mjs
```

The test uses explicitly scripted SQL ports. It is not a PostgreSQL parser, schema installation test or native qualification. Actual fixture preparation, trusted worker observation/activation, authority, approval and application execution retain their separate owners.

`schema.fixture.mjs` exposes the same test-only observations for composition tests: `createScriptedSchemaFixture({fixture: descriptorOverrides, ...faultOptions})`, `fixtureSchemaDescriptor(overrides)`, `fixtureMigrationBytes`, and `fixtureCatalog()`. The returned fixture is `{pool,f,log,releases,state,args}`. Its target identity can match another source-test process; it does not open or impersonate an actual database. Production modules never import it. The original author test assertions remain intact after extracting these helpers.

### Mapped endpoint and declared evidence namespaces

The trusted fixture owner may supply the optional paired server observation and
an explicit evidence namespace allowlist. The names below are illustrative;
actual names/owners are supplied privately by that owner, never learned from a
refusal or an observed database:

```js
{
  mode: 'owned-disposable-qualification',
  fixtureId: '<existing lowercase UUID>',
  host: '127.0.0.1', port: 55432,
  serverAddress: '172.17.0.2', serverPort: 5432,
  database: 'meri_qualification_test', user: 'qualification_owner',
  systemIdentifier: '<trusted decimal identifier>',
  serverStartTime: '<canonical UTC timestamp>', serverVersion: '170011',
  schemaSha256: null,
  schemaScope: {
    mode: 'preserve-declared-evidence',
    namespaces: [{name: 'example_evidence', owner: 'qualification_owner'}]
  }
}
```

Pool options must exactly match `host`, `port`, `database`, `user`. Python's
connection uses the same dial tuple. SQL `inet_server_addr/port` instead match
the explicit `serverAddress/serverPort` pair, or the legacy dial tuple when the
pair is omitted. All other engine checks remain mandatory. No identity is
inferred and no networking is configured here.

Without `schemaScope`, strict unrelated-namespace refusal is unchanged. With it,
all non-system namespaces must be exactly the supplied set (maximum128) plus the
two canonical namespaces after installation. Canonical namespace ownership is
checked. All public relations must still be absent before installation, and the
two public target row-type names must not collide. This is not a general public
schema installer. Retain the returned `schemaSha256` in the exact same fixture
for reconstruction; do not rerun prepare or reset a failed/uncertain fixture.

`schema-preservation.mjs` reads catalog metadata only for declared namespaces:
namespace OID/owner/ACL; ordinary tables, views, indexes, sequences; columns, defaults,
constraints, index metadata, view rewrite definitions, automatic composite/array
types, sequence parameters, internal triggers, dependencies, comments and labels.
It refuses custom routines/types, partitions/inheritance, foreign/materialized
relations, extension objects, row policies, user triggers and non-view rules,
and other namespace-dependent catalog classes. Unsupported classes need an
explicitly scoped follow-up; they are never silently ignored. Ordinary relation
statistics/freeze counters, sequence current values, physical TOAST storage,
external dependency definitions and row contents are excluded. No function body
is read. Catalog OIDs intentionally bind this same database's retained metadata.

Only fingerprint/count/coverage is returned, not the evidence metadata itself.
The before/after fingerprint and exact allowlist bind the schema hash, checked
again at reconstruction. New mapped fields also bind that hash; legacy descriptors
keep their prior hash algorithm. A fingerprint is a metadata observation, not row
data, concurrency isolation, native qualification or live authority proof. The
six migration bytes and existing transaction/deadline/unknown-ACK behavior are
unchanged; no migration, drop, reset or unrelated-schema DDL is added.
