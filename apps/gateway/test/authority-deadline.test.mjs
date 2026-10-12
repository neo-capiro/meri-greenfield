import test from 'node:test';
import assert from 'node:assert/strict';
import { validateShape } from '../../../packages/contracts/validate.mjs';
import { fixture, NOW, limits, requestJson } from './fixtures.mjs';

const stages = [
  { name: 'initial identity', identify: 1, reserved: false, settled: false },
  { name: 'before reservation', identify: 2, reserved: false, settled: false },
  { name: 'before effect', identify: 3, reserved: true, settled: false },
  { name: 'before release', identify: 4, reserved: true, settled: false },
  { name: 'after settlement', identify: 5, reserved: true, settled: true },
];

for (const stage of stages) {
  const cases = stage.identify === 1 ? ['capability expiry'] : ['capability expiry', 'run before business', 'run before source'];
  for (const narrowed of cases) {
    test(`${stage.name}: ${narrowed} immediately bounds the next parked authority port`, async () => {
      const f = fixture(); const controller = new AbortController();
      const parked = Promise.withResolvers(); let releaseValue; let identify = 0;
      const verify = f.ports.verifyCapability; const run = f.ports.currentRun;
      f.ports.verifyCapability = async (...args) => {
        identify++;
        const claims = JSON.parse(await verify(...args));
        if (identify === stage.identify && narrowed === 'capability expiry') claims.expiresAt = new Date(NOW+20).toISOString();
        return JSON.stringify(claims);
      };
      f.ports.currentRun = async (...args) => {
        const row = JSON.parse(await run(...args));
        if (identify === stage.identify && narrowed !== 'capability expiry') row.deadlineMs = NOW+20;
        if (identify === stage.identify && narrowed === 'capability expiry') {
          releaseValue = JSON.stringify(row); return parked.promise;
        }
        return JSON.stringify(row);
      };
      if (narrowed !== 'capability expiry') {
        const name = narrowed === 'run before business' ? 'authorizeBusiness' : 'authorizeSources';
        const original = f.ports[name];
        f.ports[name] = async (...args) => {
          const receipt = await original(...args);
          if (identify === stage.identify) { releaseValue = receipt; return parked.promise; }
          return receipt;
        };
      }
      let timer;
      const outcome = f.create().execute(requestJson, 'synthetic-opaque', controller.signal);
      try {
        await assert.rejects(Promise.race([outcome, new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error('fresh inner authority deadline stayed pending past 100ms')), 100);
        })]), /^GatewayDenied: DEADLINE$/);
        assert.equal(typeof releaseValue, 'string', 'the subsequent port was actually parked');
        assert.equal(f.calls.includes('reserve'), stage.reserved);
        assert.equal(f.calls.includes('settle'), stage.settled);
        assert.equal(f.calls.filter(call => call === 'uncertain').length, stage.reserved && !stage.settled ? 1 : 0);
        const stoppedCalls = [...f.calls];
        parked.resolve(releaseValue); await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(f.calls, stoppedCalls, 'late ignored completion cannot start another port or release output');
      } finally {
        clearTimeout(timer); controller.abort(); await outcome.catch(() => {});
        parked.resolve(releaseValue); await new Promise(resolve => setImmediate(resolve));
      }
    });
  }
}

test('an initial capability completing after cancellation cannot start current-run lookup', async () => {
  const f = fixture(); const parked = Promise.withResolvers();
  f.ports.verifyCapability = () => { f.calls.push('capability'); return parked.promise; };
  try {
    await assert.rejects(f.create({ limits: { ...limits, maxRequestMs: 20 } }).execute(requestJson, 'synthetic-opaque'), /DEADLINE/);
    parked.resolve(JSON.stringify(f.claims)); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls, ['capability']);
  } finally { parked.resolve(JSON.stringify(f.claims)); }
});

test('stale or invalid deadline facts fail closed before the subsequent port', async () => {
  for (const malformed of ['expired capability', 'wrong audience', 'stale run', 'foreign binding', 'invalid deadline']) {
    const f = fixture();
    if (malformed === 'expired capability') f.claims.expiresAt = new Date(NOW).toISOString();
    if (malformed === 'wrong audience') f.claims.audience = 'meri-broker';
    const original = f.ports.currentRun;
    f.ports.currentRun = async (...args) => {
      const row = JSON.parse(await original(...args));
      if (malformed === 'stale run') row.checkedAtMs = NOW-1;
      if (malformed === 'foreign binding') row.binding.tenantId = 'foreign';
      if (malformed === 'invalid deadline') row.deadlineMs = 'later';
      return JSON.stringify(row);
    };
    await assert.rejects(f.create().execute(requestJson, 'synthetic-opaque'), /ACCESS_DENIED/);
    assert.equal(f.calls.includes('policy'), false, malformed);
    assert.equal(f.calls.includes('reserve'), false, malformed);
    if (malformed.includes('capability') || malformed === 'wrong audience') assert.equal(f.calls.includes('fence'), false, malformed);
  }
});

test('a capability issuance timestamp that cannot become an epoch time cannot dispatch', async () => {
  const f = fixture();
  // RFC3339 allows leap seconds; JavaScript Date.parse does not represent them.
  f.claims.issuedAt = '2026-10-11T23:59:60Z';
  validateShape('CapabilityClaims', f.claims);
  await assert.rejects(f.create().execute(requestJson, 'synthetic-opaque'), /ACCESS_DENIED/);
  assert.deepEqual(f.calls, ['capability']);
});
