// Root integration check: actual new fixture through canonical validators only.
// Every database port below is inert; no real-pg loader, native entry or child.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const root = new URL('../../../../../', import.meta.url);
const helper = await import(new URL('apps/gateway/test/postgres-budget-native-fixture.mjs', root));
const { createPostgresToolBudget } = await import(new URL('apps/gateway/budget/postgres-tool-budget.mjs', root));
const { createDurableSourceDisabledGateway } = await import(new URL('apps/gateway/index.mjs', root));
const { limits, requestJson } = await import(new URL('apps/gateway/test/fixtures.mjs', root));
const t0Ms = Date.now();
const config = { host: '127.0.0.1', port: 15432, database: 'meri_qualification_test',
  user: 'qualification_owner', password: 'inert-test-only-no-server',
  systemIdentifier: '1', serverStartTime: new Date(t0Ms).toISOString(), serverVersion: '160015',
  t0Ms, workDeadlineMs: t0Ms + 720000, cleanupDeadlineMs: t0Ms + 900000,
  stateLockSha256: 'a'.repeat(64), migrationSha256: 'b'.repeat(64) };
const raw = JSON.stringify(config);
const admission = helper.parseNativeAdmission({ MERI_BUDGET_PG_TEST_RUN: 'explicit-isolated-engine',
  MERI_BUDGET_PG_TEST_CONFIG: raw, MERI_BUDGET_PG_TEST_CONFIG_SHA256: helper.sha256(raw) });
let scriptedFixtureStatements = 0, connectionAttempts = 0;
const inertPool = {
  query: async () => { scriptedFixtureStatements++; return { rows: [] }; },
  connect: () => { connectionAttempts++; throw new Error('NO_NATIVE_CONNECTION_ALLOWED'); },
};
const fixture = await helper.syntheticCase(inertPool, admission);
const budget = createPostgresToolBudget({ pool: inertPool, allocationJson: fixture.allocationJson });
const invocation = budget.forInvocation(fixture.invocationJson);
assert.equal(typeof invocation.reserve, 'function');
assert.equal(invocation.deadlineMs(), undefined);
const gateway = createDurableSourceDisabledGateway({ pool: inertPool,
  allocationJson: fixture.allocationJson, authorityPorts: fixture.ports, limits,
  now: Date.now, newId: randomUUID });
assert.equal(gateway.sourceEnabled, false);
assert.deepEqual(await gateway.discover(), []);
await assert.rejects(gateway.execute(requestJson, fixture.credential, fixture.invocationJson), /UNAVAILABLE/);
assert.equal(connectionAttempts, 0);
console.log(JSON.stringify({ check: 'new-fixture-through-canonical-contracts', passed: true,
  scriptedFixtureStatements, connectionAttempts, realPoolOrSqlExecuted: false,
  nativeEntryExecuted: false, childModeExecuted: false, runtimeAccepted: false }));
