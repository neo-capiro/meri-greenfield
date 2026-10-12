import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const target = process.env.MERI_BUDGET_REPO;
assert.equal(typeof target, 'string');
const { PostgresBudgetStore, BudgetStateDenied, BudgetCommitUncertain } = await import(pathToFileURL(`${target}/apps/gateway/budget/postgres-budget-store.mjs`));

function fixture({ failAt, failRollback = false, failRelease = false, failConnect = false } = {}) {
  const events = []; const releases = []; let connections = 0;
  const client = {
    async query(sql) {
      events.push(sql);
      if (sql === failAt || (sql === 'ROLLBACK' && failRollback)) throw new Error('private injected SQL failure');
      return { rows: [] };
    },
    release(error) { releases.push(error); if (failRelease) throw new Error('private release failure'); },
  };
  const pool = { async connect() { connections++; if (failConnect) throw new Error('private connect failure'); return client; } };
  return { store: new PostgresBudgetStore(pool), events, releases, connections: () => connections };
}

test('success uses one transaction and releases one healthy connection', async () => {
  const f = fixture(); assert.equal(await f.store.transact(async () => 42), 42);
  assert.equal(f.connections(), 1); assert.deepEqual(f.releases, [undefined]);
  assert.equal(f.events[0], 'BEGIN'); assert.equal(f.events.at(-1), 'COMMIT');
  assert.equal(f.events.includes('ROLLBACK'), false);
});

test('connect failure starts no transaction and creates no retry', async () => {
  const f = fixture({ failConnect: true });
  await assert.rejects(f.store.transact(async () => assert.fail('unreachable')), BudgetStateDenied);
  assert.equal(f.connections(), 1); assert.deepEqual(f.events, []); assert.deepEqual(f.releases, []);
});

test('ambiguous BEGIN acknowledgement evicts the potentially open transaction', async () => {
  const f = fixture({ failAt: 'BEGIN' });
  await assert.rejects(f.store.transact(async () => assert.fail('unreachable')), BudgetStateDenied);
  assert.equal(f.releases.length, 1); assert.ok(f.releases[0] instanceof Error, 'failed BEGIN must evict, not release as healthy');
  assert.equal(f.events.includes('COMMIT'), false);
});

test('acknowledged rollback preserves domain refusal and can release healthy', async () => {
  const f = fixture();
  await assert.rejects(f.store.transact(async () => { throw new BudgetStateDenied('FROZEN_DOMAIN_REFUSAL'); }), /^Error: FROZEN_DOMAIN_REFUSAL$/);
  assert.equal(f.events.at(-1), 'ROLLBACK'); assert.deepEqual(f.releases, [undefined]);
});

test('failed rollback evicts rather than returning dirty transaction to pool', async () => {
  const f = fixture({ failRollback: true });
  await assert.rejects(f.store.transact(async () => { throw new Error('private domain failure'); }), BudgetStateDenied);
  assert.equal(f.releases.length, 1); assert.ok(f.releases[0] instanceof Error, 'unobserved rollback must evict');
  assert.equal(f.events.includes('COMMIT'), false); assert.equal(f.connections(), 1);
});

test('lost COMMIT acknowledgement remains uncertain and never retries', async () => {
  const f = fixture({ failAt: 'COMMIT' });
  await assert.rejects(f.store.transact(async () => 42), error => error instanceof BudgetCommitUncertain && error.message === 'COMMIT_ACKNOWLEDGEMENT_UNKNOWN');
  assert.equal(f.connections(), 1); assert.equal(f.events.filter(x => x === 'COMMIT').length, 1);
  assert.equal(f.events.includes('ROLLBACK'), false); assert.ok(f.releases[0] instanceof Error, 'unknown COMMIT must evict');
});

test('release failure cannot overwrite lost COMMIT classification', async () => {
  const f = fixture({ failAt: 'COMMIT', failRelease: true });
  await assert.rejects(f.store.transact(async () => 42), error => error instanceof BudgetCommitUncertain && error.message === 'COMMIT_ACKNOWLEDGEMENT_UNKNOWN');
  assert.equal(f.connections(), 1); assert.equal(f.releases.length, 1);
});

test('release failure after acknowledged COMMIT never yields safe retry or success', async () => {
  const f = fixture({ failRelease: true });
  await assert.rejects(f.store.transact(async () => 42), BudgetCommitUncertain);
  assert.equal(f.events.filter(x => x === 'COMMIT').length, 1); assert.equal(f.events.includes('ROLLBACK'), false);
});

test('lock samples authoritative database time after row-lock acknowledgement', async () => {
  const f = fixture(); const events = []; let unlocked;
  const locked = new Promise(resolve => { unlocked = resolve; });
  const client = { async query(sql) {
    events.push(sql);
    if (sql.includes('FOR UPDATE')) { await locked; return { rows: [{ id: 1 }] }; }
    return { rows: [{ now: new Date(1000) }] };
  } };
  const result = f.store.lock(client); await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.length, 1); unlocked(); assert.equal((await result).now.getTime(), 1000);
  assert.equal(events.length, 2); assert.match(events[1], /clock_timestamp/);
});

test('missing budget and invalid database clock fail closed', async () => {
  const f = fixture();
  await assert.rejects(f.store.lock({ async query() { return { rows: [] }; } }), BudgetStateDenied);
  let calls = 0;
  await assert.rejects(f.store.lock({ async query() { return ++calls === 1 ? { rows: [{ id: 1 }] } : { rows: [{ now: new Date(NaN) }] }; } }), BudgetStateDenied);
});
