/** Independent synthetic lifecycle controls. No authentic ports or runtime admission. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { fixture, NOW, limits, requestJson } = await import(process.env.GATEWAY_FIXTURE_ROOT
  ? pathToFileURL(`${process.env.GATEWAY_FIXTURE_ROOT}/apps/gateway/test/fixtures.mjs`).href
  : '../../../../apps/gateway/test/fixtures.mjs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const drain = () => new Promise(resolve => setImmediate(resolve));
const stages = [
  { name: 'initial-identity', ordinal: 1, ports: ['currentRun'] },
  { name: 'before-reservation', ordinal: 2, ports: ['currentRun', 'authorizeBusiness', 'authorizeSources'] },
  { name: 'before-effect', ordinal: 3, ports: ['currentRun', 'authorizeBusiness', 'authorizeSources'] },
  { name: 'before-release', ordinal: 4, ports: ['currentRun', 'authorizeBusiness', 'authorizeSources'] },
  { name: 'final', ordinal: 5, ports: ['currentRun', 'authorizeBusiness', 'authorizeSources'] },
];

for (const stage of stages) for (const parkedPort of stage.ports) {
  test(`fresh deadline at ${stage.name} bounds parked ${parkedPort}`, async () => {
    const f = fixture(); let identity = 0; let release; let parkedSignal; let shortened = false;
    const callsAfterPark = []; let parked = false;
    for (const name of Object.keys(f.ports)) {
      const original = f.ports[name];
      f.ports[name] = async (...args) => {
        if (parked) callsAfterPark.push(name);
        if (name === 'verifyCapability') identity++;
        const targeted = identity === stage.ordinal;
        if (targeted && name === 'verifyCapability' && parkedPort === 'currentRun') {
          f.claims.expiresAt = new Date(NOW + 20).toISOString(); shortened = true;
        }
        if (targeted && name === parkedPort && !parked) {
          parked = true;
          parkedSignal = name === 'currentRun' ? args[1].signal : args[0].signal;
          return new Promise(resolve => { release = async () => resolve(await original(...args)); });
        }
        const raw = await original(...args);
        if (targeted && name === 'currentRun' && parkedPort !== 'currentRun') {
          const run = JSON.parse(raw); run.deadlineMs = NOW + 20; shortened = true;
          return JSON.stringify(run);
        }
        return raw;
      };
    }
    const controller = new AbortController();
    let completed = false; let releasedResult = false; let failure;
    const started = performance.now();
    const operation = f.create({ limits: { ...limits, maxCleanupMs: 20 } })
      .execute(requestJson, 'synthetic-opaque', controller.signal)
      .then(() => { releasedResult = true; }, error => { failure = error.message; })
      .finally(() => { completed = true; });
    let observed;
    try {
      await pause(100);
      observed = { stage: stage.name, parkedPort, shortened, parked,
        completedWithin100ms: completed, failure: failure ?? null,
        parkedSignalAborted: parkedSignal?.aborted ?? false,
        releasedResult, uncertaintyCalls: f.calls.filter(x => x === 'uncertain').length,
        elapsedMs: performance.now() - started };
      console.log(JSON.stringify(observed));
    } finally {
      controller.abort(); await operation;
      await release?.(); await drain(); await drain();
    }
    const expectedUncertainty = [3, 4].includes(stage.ordinal) ? 1 : 0;
    assert.equal(shortened, true); assert.equal(parked, true);
    assert.equal(releasedResult, false, 'no result can release after cancellation or late parked port completion');
    assert.deepEqual(callsAfterPark, [], 'late completion must not enter subsequent trusted ports');
    assert.equal(f.calls.filter(x => x === 'uncertain').length, expectedUncertainty);
    assert.equal(observed.completedWithin100ms, true, 'fresh inner deadline must bound the next parked port');
    assert.equal(observed.failure, 'DEADLINE');
    assert.equal(observed.parkedSignalAborted, true);
  });
}
