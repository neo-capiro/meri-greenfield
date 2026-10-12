/** Public shape acceptance is distinct from usable gateway authority time. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root = process.env.GATEWAY_FIXTURE_ROOT;
const { fixture, NOW, requestJson } = await import(root
  ? pathToFileURL(`${root}/apps/gateway/test/fixtures.mjs`).href
  : '../../../../apps/gateway/test/fixtures.mjs');

for (const scenario of ['leap-second-issuedAt', 'future-issuedAt', 'issued-after-expiry', 'equal-issued-expiry', 'leap-second-expiry']) {
  test(`gateway refuses unusable capability lifetime: ${scenario}`, async () => {
    const f = fixture();
    if (scenario === 'leap-second-issuedAt') f.claims.issuedAt = '2016-12-31T23:59:60Z';
    if (scenario === 'future-issuedAt') f.claims.issuedAt = new Date(NOW + 1).toISOString();
    if (scenario === 'issued-after-expiry') f.claims.issuedAt = new Date(NOW + 10001).toISOString();
    if (scenario === 'equal-issued-expiry') f.claims.issuedAt = f.claims.expiresAt;
    if (scenario === 'leap-second-expiry') f.claims.expiresAt = '2016-12-31T23:59:60Z';
    let released = false; let failure;
    await f.create().execute(requestJson, 'synthetic-opaque')
      .then(() => { released = true; }, error => { failure = error.message; });
    console.log(JSON.stringify({ scenario, released, failure: failure ?? null, calls: f.calls }));
    assert.equal(released, false, 'shape-valid unusable issuance must never establish authority');
    assert.equal(failure, 'ACCESS_DENIED');
    assert.equal(f.calls.includes('fence'), false, 'invalid claims must stop before currentRun');
    assert.equal(f.calls.includes('reserve'), false); assert.equal(f.calls.includes('handler'), false);
  });
}
