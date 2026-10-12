/** Late synthetic port completion must not invoke another authority port. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { fixture, limits, requestJson } = await import(process.env.GATEWAY_FIXTURE_ROOT
  ? pathToFileURL(`${process.env.GATEWAY_FIXTURE_ROOT}/apps/gateway/test/fixtures.mjs`).href
  : '../../../../apps/gateway/test/fixtures.mjs');
const drain = () => new Promise(resolve => setImmediate(resolve));

for (const ordinal of [1, 2, 3, 4, 5]) for (const parkedPort of
  ordinal === 1 ? ['verifyCapability', 'currentRun'] : ['verifyCapability', 'currentRun', 'authorizeBusiness', 'authorizeSources']) {
  test(`cancelled identity ${ordinal} parked ${parkedPort} cannot continue after late completion`, async () => {
    const f = fixture(); const controller = new AbortController();
    let identity = 0; let release; let parked = false; let signal; const next = [];
    let started; const entered = new Promise(resolve => { started = resolve; });
    for (const name of Object.keys(f.ports)) {
      const original = f.ports[name];
      f.ports[name] = async (...args) => {
        if (parked) next.push(name);
        if (name === 'verifyCapability') identity++;
        if (identity === ordinal && name === parkedPort && !parked) {
          parked = true; signal = ['verifyCapability', 'currentRun'].includes(name) ? args[1].signal : args[0].signal;
          started(); return new Promise(resolve => { release = async () => resolve(await original(...args)); });
        }
        return original(...args);
      };
    }
    let released = false; let failure;
    const outcome = f.create({ limits: { ...limits, maxCleanupMs: 20 } })
      .execute(requestJson, 'synthetic-opaque', controller.signal)
      .then(() => { released = true; }, error => { failure = error.message; });
    let timeout;
    try {
      await Promise.race([entered, new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('port not reached')), 500); })]);
      controller.abort(); await outcome;
      await release(); await drain(); await drain();
      console.log(JSON.stringify({ ordinal, parkedPort, failure, next, released, signalAborted: signal.aborted,
        uncertaintyCalls: f.calls.filter(x => x === 'uncertain').length }));
      assert.equal(failure, 'CANCELLED'); assert.equal(signal.aborted, true); assert.equal(released, false);
      assert.equal(f.calls.filter(x => x === 'uncertain').length, [3, 4].includes(ordinal) ? 1 : 0);
      assert.deepEqual(next, [], 'a cancelled authority lookup must not start another trusted port');
    } finally { clearTimeout(timeout); controller.abort(); await outcome; await release?.(); await drain(); }
  });
}
