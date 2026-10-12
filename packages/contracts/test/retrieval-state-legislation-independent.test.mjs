import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createStateLegislationValidators, STATE_LEGISLATION_OPERATION_IDS} from '../retrieval-0.2/state-legislation-validation.mjs';

// Independent synthetic fixtures and test-only compiler. No source adapter runs.
const schema = JSON.parse(readFileSync(new URL('../retrieval-0.2/state-legislation.schema.json', import.meta.url)));
const ajv = new Ajv({strict: true, allErrors: true}); addFormats(ajv); ajv.addSchema(schema);
const checks = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({$ref: `${schema.$id}#/$defs/${name}`})]));
const v = createStateLegislationValidators({schema, validateShape(name, value) {
  const check = checks.get(name);
  if (!check?.(value)) throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`);
  return value;
}});
const bills = 'search_state_bills', legislator = 'get_state_legislator';
const at = '2026-10-12T16:00:00.000Z';
const bill = (changes = {}) => ({id: 'xx-session-hb1', state: 'XX', session: 'Synthetic session',
  identifier: 'HB 1', title: 'Synthetic bill', chamber: null, subjects: [], status: null,
  statusLabel: 'Unknown', sponsorName: null, sponsorParty: null, sponsorCount: 0,
  latestActionDate: null, latestActionText: null, stateUrl: null, url: null, ...changes});
const billPage = (changes = {}) => ({tool: bills, generatedAt: at, total: 1, data: [bill()], ...changes});
const match = (changes = {}) => ({id: 'ocd-person/synthetic', name: 'Synthetic Person', state: 'XX',
  chamber: null, district: null, party: null, committees: [], active: false, matchedBy: 'name-search', ...changes});
const ambiguous = (changes = {}) => ({id: 'ocd-person/synthetic', name: 'Synthetic Person', state: 'XX',
  chamber: null, district: null, party: null, ...changes});
const single = (changes = {}) => ({tool: legislator, generatedAt: at, matchesFound: 1, matches: [match()], ...changes});
const absent = (changes = {}) => ({tool: legislator, generatedAt: at, matchesFound: 0, matches: [], note: 'Synthetic observed no match.', ...changes});
const multiple = (changes = {}) => absent({ambiguousLegislator: [ambiguous(), ambiguous({id: 'ocd-person/other'})], ...changes});
const request = {query: 'Synthetic'};
const check = (id, value, input = id === bills ? {} : request) => v.assertStateLegislationOutput(id, value, input);
const refuse = (id, value, input) => assert.throws(() => check(id, value, input));

test('state independent: only two operation definitions, no live resolver aliases', () => {
  assert.deepEqual([...STATE_LEGISLATION_OPERATION_IDS], [bills, legislator]);
  assert.equal(v.stateLegislationInputDefinition(bills), 'StateBillSearchInput');
  assert.equal(v.stateLegislationOutputDefinition(bills), 'StateBillSearchOutput');
  assert.equal(v.stateLegislationInputDefinition(legislator), 'StateLegislatorInput');
  assert.equal(v.stateLegislationOutputDefinition(legislator), 'StateLegislatorOutput');
  for (const id of ['get_state_bill_status', 'search_state_floor_votes', 'constructor', '__proto__', '']) {
    assert.throws(() => v.stateLegislationInputDefinition(id));
    assert.throws(() => v.stateLegislationOutputDefinition(id));
    assert.throws(() => v.normalizeStateLegislationInput(id, {}));
  }
});

for (const [id, fallback, maximum] of [[bills, 20, 50], [legislator, 5, 8]]) {
  test(`${id} independent: numeric/string/null clamp and default`, () => {
    for (const [value, expected] of [[null, fallback], ['not-numeric', fallback], ['', 1], ['  ', 1],
      ['2.9', 2], [2.9, 2], [-99, 1], [0, 1], [999, maximum], ['1e2', maximum]])
      assert.equal(v.normalizeStateLegislationInput(id, {limit: value}).input.limit, expected);
    assert.equal(v.normalizeStateLegislationInput(id, {}).input.limit, fallback);
    for (const value of [true, false, {}, [], Infinity, NaN])
      assert.throws(() => v.normalizeStateLegislationInput(id, {limit: value}));
  });
  test(`${id} independent: unknown authority and nonempty context refused`, () => {
    for (const key of ['actorId', 'tenantId', 'clientId', 'source', 'sql', 'live', 'apiKey', 'authorizationDecisionId'])
      assert.throws(() => v.normalizeStateLegislationInput(id, {[key]: 'synthetic'}));
    for (const options of [{actorId: 'synthetic'}, {nowMs: 0}, {authorized: true}, null, []])
      assert.throws(() => v.normalizeStateLegislationInput(id, {}, options));
  });
  test(`${id} independent: selectors are copied and immutable`, () => {
    const original = {query: '  Synthetic  ', state: ' xx '}, saved = structuredClone(original);
    const normalized = v.normalizeStateLegislationInput(id, original);
    assert.deepEqual(original, saved);
    assert.notEqual(normalized.input, original);
    assert.equal(normalized.input.query, 'Synthetic'); assert.equal(normalized.input.state, 'XX');
    assert.ok(Object.isFrozen(normalized)); assert.ok(Object.isFrozen(normalized.input));
    assert.ok(Object.isFrozen(normalized.metadata));
    assert.equal(normalized.metadata.sourceConnected, false);
    assert.equal(normalized.metadata.producerQualified, false);
    assert.equal(normalized.metadata.absenceEvidence, false);
    assert.throws(() => {normalized.input.state = 'YY';}, TypeError);
  });
}

test('state independent: UTF-16 truncation, then uppercase with explicit overflow refusal', () => {
  for (const [id, cap] of [[bills, 240], [legislator, 120]]) {
    assert.equal(v.normalizeStateLegislationInput(id, {query: '🧭'.repeat(cap)}).input.query, '🧭'.repeat(cap / 2));
    assert.equal(v.normalizeStateLegislationInput(id, {query: 'x'.repeat(cap - 1) + '🧭'}).input.query, 'x'.repeat(cap - 1) + '\ud83e');
    assert.equal(v.normalizeStateLegislationInput(id, {state: 'abcd'}).input.state, 'AB');
    assert.equal(v.normalizeStateLegislationInput(id, {state: 'ß'}).input.state, 'SS');
    assert.throws(() => v.normalizeStateLegislationInput(id, {state: 'aß'}));
  }
  const value = v.normalizeStateLegislationInput(bills, {session: 'x'.repeat(70), status: 'x'.repeat(40)}).input;
  assert.equal(value.session.length, 60); assert.equal(value.status.length, 30);
});

test('state independent: hostile requests never execute accessors or proxies', () => {
  let reads = 0;
  const trap = () => {reads++; throw new Error('must not execute');};
  const hidden = {}; Object.defineProperty(hidden, 'query', {value: 'X'});
  const proxy = new Proxy({}, {get: trap, ownKeys: trap, getPrototypeOf: trap});
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  for (const value of [{get query() {return trap();}}, proxy, revoked.proxy, hidden,
    {[Symbol('field')]: 'x'}, Object.create({query: 'X'}), {query: undefined}, {toJSON: trap}])
    for (const id of [bills, legislator]) assert.throws(() => v.normalizeStateLegislationInput(id, value));
  assert.equal(reads, 0);
});

test('state bills independent: nullable projection and opaque stored strings survive', () => {
  const value = billPage({data: [bill({id: '', state: 'not-a-code', session: '', identifier: '', title: '',
    chamber: '', sponsorName: '', sponsorParty: '', latestActionText: '', url: 'stored-relative-link', stateUrl: '',
    subjects: ['', 'duplicated', 'duplicated'], sponsorCount: -2147483648})]});
  const saved = structuredClone(value); assert.equal(check(bills, value), value); assert.deepEqual(value, saved);
  check(bills, billPage({data: [bill({sponsorCount: 2147483647})]}));
});

test('state bills independent: all thirteen stored status labels and unknown/null labels', () => {
  const pairs = [['superseded', 'Laid on table — companion substituted'], ['introduced', 'Introduced'],
    ['committee', 'In committee'], ['reported', 'Reported out of committee'], ['floor', 'On the floor'],
    ['passed_chamber', 'Passed a chamber'], ['resolving', 'Resolving differences'], ['to_governor', 'Sent to the governor'],
    ['enacted', 'Enacted'], ['vetoed', 'Vetoed'], ['veto_overridden', 'Veto overridden'], ['failed', 'Failed'],
    ['dead_by_deadline', 'Dead — session adjourned sine die'], [null, 'Unknown'], ['', ''],
    ['constructor', 'constructor'], ['__proto__', '__proto__'], ['new-source-value', 'new-source-value']];
  for (const [status, statusLabel] of pairs) {
    check(bills, billPage({data: [bill({status, statusLabel})]}));
    refuse(bills, billPage({data: [bill({status, statusLabel: 'wrong label'})]}));
  }
});

test('state bills independent: count races and count-conditioned note, no absence/completeness claim', () => {
  for (const [total, data] of [[0, []], [0, [bill()]], [1, []], [90, [bill()]]]) {
    const value = billPage({total, data, ...(total === 0 ? {note: 'Synthetic no-record note.'} : {})});
    check(bills, value);
    const altered = structuredClone(value);
    if (total === 0) delete altered.note; else altered.note = 'Unsupported note branch';
    refuse(bills, altered);
  }
  refuse(bills, billPage({complete: true})); refuse(bills, billPage({absenceProven: true}));
});

test('state bills independent: request bounds and literal filter consistency', () => {
  check(bills, billPage(), {state: ' xx ', session: ' Synthetic session '});
  for (const input of [{state: 'YY'}, {session: 'Other session'}, {status: 'introduced'}]) refuse(bills, billPage(), input);
  const data = [bill(), bill({id: 'other'})];
  check(bills, billPage({data}), {limit: 2}); refuse(bills, billPage({data}), {limit: 1});
  // Summary search may have matched unreturned/full title text; no new substring proof.
  check(bills, billPage(), {query: 'not present in bounded projection'});
});

test('state bills independent: text UTF-16 and integer bounds are enforced', () => {
  check(bills, billPage({data: [bill({title: '🧭'.repeat(120)})]}));
  refuse(bills, billPage({data: [bill({title: '🧭'.repeat(121)})]}));
  for (const sponsorCount of [-2147483649, 2147483648, 0.5, '1', null])
    refuse(bills, billPage({data: [bill({sponsorCount})]}));
  for (const total of [-1, 0.5, '1', null]) refuse(bills, billPage({total}));
});

test('state bills independent: SQL dates are serialized canonical UTC midnight', () => {
  check(bills, billPage({data: [bill({latestActionDate: '2024-02-29T00:00:00.000Z'})]}));
  for (const latestActionDate of ['2026-02-30T00:00:00.000Z', '2026-10-12', '2026-10-12T01:00:00.000Z',
    '2026-10-12T00:00:00Z', '2026-10-12T00:00:00.000+00:00', new Date(at)])
    refuse(bills, billPage({data: [bill({latestActionDate})]}));
});

test('state legislator independent: three exact projection variants and bounded observation', () => {
  for (const value of [single(), absent(), multiple()]) {
    const saved = structuredClone(value); assert.equal(check(legislator, value), value); assert.deepEqual(value, saved);
  }
  check(legislator, single(), {query: 'Synthetic', limit: 1});
  refuse(legislator, multiple(), {query: 'Synthetic', limit: 1});
  check(legislator, absent(), {}); check(legislator, absent(), {query: ' \t '});
  refuse(legislator, single(), {}); refuse(legislator, multiple(), {});
});

test('state legislator independent: crosswalk precedence ignores state hints; name mode does not', () => {
  for (const matchedBy of ['legiscan_people-crosswalk', 'future namespace-crosswalk', '-crosswalk'])
    check(legislator, single({matches: [match({state: 'YY', matchedBy})]}), {query: 'external id', state: 'XX'});
  refuse(legislator, single({matches: [match({state: 'YY'})]}), {query: 'Synthetic', state: 'XX'});
  refuse(legislator, multiple({ambiguousLegislator: [ambiguous(), ambiguous({id: 'other', state: 'YY'})]}), {query: 'Synthetic', state: 'XX'});
  for (const matchedBy of ['crosswalk', 'name-search-other', ''])
    refuse(legislator, single({matches: [match({matchedBy})]}));
});

test('state legislator independent: committees remain opaque inert JSON', () => {
  for (const committees of [null, true, 3.14, 'not an array', [], {}, [{arbitrary: [1, null, false]}],
    JSON.parse('{"__proto__":{"label":"inert"}}')])
    check(legislator, single({matches: [match({committees})]}));
  const cycle = {}; cycle.self = cycle;
  const sparse = []; sparse.length = 1;
  for (const committees of [cycle, sparse, NaN, undefined, new Date(at), () => {}, new Map()])
    refuse(legislator, single({matches: [match({committees})]}));
});

test('state legislator independent: union variants cannot be combined or fabricated', () => {
  for (const value of [single({note: 'extra'}), single({ambiguousLegislator: [ambiguous(), ambiguous()]}),
    single({matchesFound: 0}), single({matches: []}), single({matches: [match(), match()]}),
    absent({matchesFound: 2}), absent({note: undefined}), multiple({ambiguousLegislator: []}),
    multiple({ambiguousLegislator: [ambiguous()]}),
    multiple({ambiguousLegislator: [ambiguous({committees: []}), ambiguous({id: 'other'})]})])
    refuse(legislator, value);
});

test('state independent: required projection fields and unsupported private facts refused', () => {
  for (const key of Object.keys(bill())) {const row = bill(); delete row[key]; refuse(bills, billPage({data: [row]}));}
  for (const key of Object.keys(match())) {const row = match(); delete row[key]; refuse(legislator, single({matches: [row]}));}
  for (const key of ['email', 'sourceEvidence', 'syncedAt', 'apiKey', 'statusSource', 'fresh', 'authorized', 'absenceEvidence']) {
    refuse(bills, billPage({data: [bill({[key]: 'not projected'})]}));
    refuse(legislator, single({matches: [match({[key]: 'not projected'})]}));
  }
});

test('state independent: operation identity, serialized instants and output context are closed', () => {
  refuse(bills, billPage({tool: legislator})); refuse(legislator, single({tool: bills}));
  for (const generatedAt of ['not a date', '2026-02-30T00:00:00.000Z', '2026-10-12T16:00:00Z',
    '2026-10-12T16:00:00.000+00:00']) {
    refuse(bills, billPage({generatedAt})); refuse(legislator, single({generatedAt}));
  }
  assert.throws(() => v.assertStateLegislationOutput(bills, billPage(), {}, {actorId: 'caller'}));
  assert.throws(() => v.validateStateLegislationShape('constructor', {}));
});

test('state independent: hostile nested output does not invoke user code', () => {
  let called = 0;
  const row = match({committees: {get field() {called++; return 'not inert';}}});
  refuse(legislator, single({matches: [row]}));
  const proxy = new Proxy({}, {get() {called++; throw new Error('not inert');}});
  refuse(legislator, single({matches: [match({committees: proxy})]}));
  assert.equal(called, 0);
});
