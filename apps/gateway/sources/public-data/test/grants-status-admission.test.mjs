/** Production-boundary cases for the typed federal-grant selector.
 *
 * The gateway sends the caller's ORIGINAL request bytes to Core (native-handler `current.request`, bound to
 * requestSha256 and the evidence-mode observation), so admission - not a rewritten body - is what decides
 * whether a status can match. Core trims the selector and then applies exact equality over the values its
 * ingestion writes (posted, forecasted, closed, archived). A spelling outside that domain therefore cannot
 * match, and answering it as a successful empty page is the false-empty this file pins down.
 *
 * Uses the canonical readContext authority (the same helper the current family fixtures use), not the legacy
 * mode-handler authority stub, so the real transport and the real boundary are exercised.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readContext} from '../../bill-text/test/fixture.mjs';
import {storedModeCase} from './mode-fixture.mjs';

const GRANTS = 'search_federal_grants';
const CANONICAL = Object.freeze({query: 'synthetic grants', status: 'posted'});

function grantScene() {
  const scene = storedModeCase(GRANTS, {evidenceAccuracyMode: 'off', request: CANONICAL});
  /** `raw` is what the caller asked for and what the wire must carry. The normalized arguments are the ones a
   * caller would hold for that request: computed from the raw bytes whenever the contract still admits them,
   * and from the canonical request otherwise (the corrected admission refuses them, so no call is ever built). */
  const call = (raw = CANONICAL) => {
    let normalized;
    try { normalized = scene.contract.normalizeInput(raw, scene.normalizationContext); }
    catch { normalized = scene.contract.normalizeInput(CANONICAL, scene.normalizationContext); }
    return {request: raw, input: normalized.input, argumentsSha256: normalized.argumentsSha256,
      normalizationContext: scene.normalizationContext, authority: readContext(scene.authority)};
  };
  return {...scene, call, admits: (raw) => { try { scene.contract.normalizeInput(raw, scene.normalizationContext); return true; } catch { return false; } }};
}

test('a status spelling outside the stored domain is refused before any credential or Core call', async () => {
  for (const raw of ['Posted', 'CLOSED', 'open', 'active']) {
    const scene = grantScene();
    const request = {...CANONICAL, status: raw};
    assert.equal(scene.admits(request), false, `${raw} was admitted by the contract`);
    // GatewayDenied carries its closed code as the message; it has no `.code` field.
    await assert.rejects(scene.handler()(scene.call(request)),
      (error) => error?.name === 'GatewayDenied' && error.message === 'INVALID_ARGUMENTS',
      `${raw} was not refused`);
    assert.equal(scene.wire.length, 0, `${raw} reached Core`);
    assert.deepEqual(scene.state.credentialOwnerCalls ?? [], [], `${raw} acquired a credential`);
  }
});

test('every stored status is admitted and carried to Core in the caller\'s own bytes', async () => {
  for (const status of ['posted', 'forecasted', 'closed', 'archived']) {
    const scene = grantScene();
    const request = {...CANONICAL, status};
    const page = JSON.parse(await scene.handler()(scene.call(request))).result;
    assert.equal(scene.wire.length, 1);
    assert.deepEqual(scene.wire[0].body, request, 'the wire must carry the original request unchanged');
    assert.equal(page.data[0].syncedStatus, status);
  }
});

test('surrounding whitespace stays the caller\'s bytes and is not normalized or rewritten', async () => {
  const scene = grantScene();
  const request = {...CANONICAL, status: '  posted  '};
  // Core trims the selector before its exact match, so padded canonical text is a supported selector.
  JSON.parse(await scene.handler()(scene.call(request, {...CANONICAL, status: 'posted'})));
  assert.deepEqual(scene.wire[0].body, request);
});

test('a request without a status filter stays unfiltered', async () => {
  const scene = grantScene();
  const unfiltered = {query: 'synthetic grants'};
  JSON.parse(await scene.handler()(scene.call(unfiltered)));
  assert.equal(scene.wire.length, 1);
  assert.equal(Object.hasOwn(scene.wire[0].body, 'status'), false);
});

test('a genuine empty page is still a successful answer, not a refusal', async () => {
  const scene = grantScene();
  const stamp = new Date(scene.now()).toISOString();
  scene.state.page = {tool: GRANTS, generatedAt: stamp, asOf: stamp, total: 0, data: []};
  const page = JSON.parse(await scene.handler()(scene.call())).result;
  assert.equal(page.total, 0);
  assert.deepEqual(page.data, []);
});
