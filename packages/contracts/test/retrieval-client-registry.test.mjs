import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeClientRegistryInput, assertClientRegistryResult} from '../retrieval-0.2/validate.mjs';

const lda = (id = 12) => ({ldaClientId: id, name: 'Synthetic Registry Entity', state: null,
  description: null, totalFilings: 0, latestFilingYear: null});
const result = () => ({existingClient: null, ldaExactMatch: null, ldaCandidates: [],
  guidance: 'Synthetic compatibility guidance; grants no action authority.'});

test('registry name follows frozen trim and UTF-16 truncation without caller mutation', () => {
  const input = {name: `  ${'x'.repeat(301)}  `};
  assert.deepEqual(normalizeClientRegistryInput(input), {name: 'x'.repeat(300)});
  assert.equal(input.name.length, 305);
  assert.deepEqual(normalizeClientRegistryInput({name: '  Fictional Company  '}), {name: 'Fictional Company'});
  assert.deepEqual(normalizeClientRegistryInput({name: '🧭'.repeat(151)}), {name: '🧭'.repeat(150)});
});

test('registry refuses missing, blank, coerced and unsupported authority arguments', () => {
  for (const input of [{}, {name: ''}, {name: ' \t '}, {name: null}, {name: 12},
    {name: 'X', clientId: 'foreign'}, {name: 'X', tenantId: 'foreign'},
    {name: 'X', skipLdaCheck: true}, {name: 'X', create: true}, [], null])
    assert.throws(() => normalizeClientRegistryInput(input));
});

test('registry input accessors, proxies and hidden fields never run', () => {
  let calls = 0;
  const accessor = {get name() {calls++; return 'X';}};
  const proxy = new Proxy({name: 'X'}, {ownKeys() {calls++; return ['name'];}});
  const hidden = {name: 'X'}; Object.defineProperty(hidden, 'tenantId', {value: 'hidden'});
  for (const value of [accessor, proxy, hidden, Object.assign(Object.create({tenantId: 'inherited'}), {name: 'X'})])
    assert.throws(() => normalizeClientRegistryInput(value));
  assert.equal(calls, 0);
});

test('registry preserves nullable exact, candidate and existing-client branches', () => {
  for (const value of [result(), {...result(), existingClient: {id: 'client-synthetic', name: 'X', website: null}},
    {...result(), ldaExactMatch: lda()}, {...result(), ldaCandidates: [lda()]},
    {...result(), existingClient: {id: 'client-synthetic', name: 'X', website: 'unverified text'},
      ldaExactMatch: lda(), ldaCandidates: [lda(13)]}])
    assert.equal(assertClientRegistryResult(value), value);
});

test('registry candidate bound and exact-ID exclusion do not invent exhaustive enumeration', () => {
  assertClientRegistryResult({...result(), ldaCandidates: Array.from({length: 5}, (_, i) => lda(i + 1))});
  for (const value of [
    {...result(), ldaCandidates: Array.from({length: 6}, (_, i) => lda(i + 1))},
    {...result(), ldaExactMatch: lda(), ldaCandidates: [lda()]},
    {...result(), ldaCandidates: [lda(), lda()]},
  ]) assert.throws(() => assertClientRegistryResult(value));
});

test('registry rows preserve null versus omitted and reject extra private fields', () => {
  for (const field of ['state', 'description', 'latestFilingYear']) {
    const row = lda(); delete row[field];
    assert.throws(() => assertClientRegistryResult({...result(), ldaCandidates: [row]}));
  }
  for (const field of ['email', 'tenantId', 'rawJson', 'totalSpending'])
    assert.throws(() => assertClientRegistryResult({...result(), ldaExactMatch: {...lda(), [field]: 'extra'}}));
  assert.throws(() => assertClientRegistryResult({...result(), existingClient: {id: 'x', name: 'x'}}));
});

test('registry scalar projection preserves numeric IDs and bounded descriptions', () => {
  assertClientRegistryResult({...result(), ldaExactMatch: {...lda(), description: 'x'.repeat(200), latestFilingYear: 2026}});
  for (const change of [{ldaClientId: '12'}, {totalFilings: 1.5}, {latestFilingYear: '2026'},
    {description: 'x'.repeat(201)}, {state: 4}])
    assert.throws(() => assertClientRegistryResult({...result(), ldaExactMatch: {...lda(), ...change}}));
});

test('registry guidance remains inert data and cannot add approval, absence or freshness claims', () => {
  const value = {...result(), guidance: 'Propose create_client; this reported text is not an authorization.'};
  assert.equal(assertClientRegistryResult(value).guidance, value.guidance);
  for (const field of ['approved', 'created', 'complete', 'fresh', 'absenceProven', 'authorized'])
    assert.throws(() => assertClientRegistryResult({...value, [field]: true}));
  assert.throws(() => assertClientRegistryResult({error: 'upstream unavailable'}));
});
