import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createStateLegislationValidators} from '../retrieval-0.2/state-legislation-validation.mjs';

const schema = JSON.parse(readFileSync(new URL('../retrieval-0.2/state-legislation.schema.json', import.meta.url)));
const ajv = new Ajv({strict: true, allErrors: true}); addFormats(ajv); ajv.addSchema(schema);
const checks = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({$ref: `${schema.$id}#/$defs/${name}`})]));
const v = createStateLegislationValidators({schema, validateShape(name, value) {
  const check = checks.get(name); if (!check?.(value)) throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`); return value;
}});
const bills = 'search_state_bills', people = 'get_state_legislator', stamp = '2026-10-12T12:00:00.000Z';
const normalize = (id, raw = {}, context = {}) => v.normalizeStateLegislationInput(id, raw, context);
const check = (id, page, raw = {}, context = {}) => v.assertStateLegislationOutput(id, page, raw, context);

test('standalone state operation selection refuses coercive objects without executing them', () => {
  let effects = 0;
  const selector = {[Symbol.toPrimitive]() { effects++; return bills; }};
  assert.throws(() => v.normalizeStateLegislationInput(selector, {}, {}));
  assert.equal(effects, 0);
  for (const id of [null, 1, true, [], Symbol('operation')]) assert.throws(() => v.stateLegislationInputDefinition(id));
});
const bill = () => ({id: 'synthetic-bill', state: 'CA', session: '2026', identifier: 'HB 1', title: 'Synthetic',
  chamber: null, subjects: [], status: null, statusLabel: 'Unknown', sponsorName: null, sponsorParty: null,
  sponsorCount: -1, latestActionDate: null, latestActionText: null, stateUrl: null, url: null});
const billPage = (data = [bill()]) => ({tool: bills, generatedAt: stamp, total: data.length, data,
  ...(data.length === 0 ? {note: schema.$defs.StateBillEmptyNote.const} : {})});
const person = () => ({id: 'synthetic-person', name: 'Synthetic', state: 'CA', chamber: null, district: null,
  party: null, committees: {opaque: ['reported', null, 3]}, active: true, matchedBy: 'name-search'});
const personPage = (row = person()) => ({tool: people, generatedAt: stamp, matchesFound: 1, matches: [row]});
const empty = note => ({tool: people, generatedAt: stamp, matchesFound: 0, matches: [], note});
const ambiguous = () => {
  const {committees, active, matchedBy, ...row} = person();
  return {...empty('"Synthetic" matches 2 state legislators — ask the user which (by state/chamber/district) before attributing anything to them.'),
    ambiguousLegislator: [row, {...row, id: 'synthetic-second'}]};
};

test('state requests preserve defaults, blank omission and frozen detached inputs', () => {
  const raw = {query: ' Synthetic ', state: ' ca ', session: ' ', status: null};
  const result = normalize(bills, raw);
  assert.deepEqual(result, {input: {limit: 20, query: 'Synthetic', state: 'CA'}, metadata: {}});
  assert.equal(raw.query, ' Synthetic '); assert.ok(Object.isFrozen(result.input));
  assert.deepEqual(normalize(people), {input: {limit: 5}, metadata: {}});
});
test('finite scalar limit coercion and bounded defaults remain observable', () => {
  for (const [value, expected] of [['2.9', 2], [-5, 1], ['', 1], ['invalid', 20], [null, 20], [100, 50]])
    assert.equal(normalize(bills, {limit: value}).input.limit, expected);
  assert.equal(normalize(people, {limit: 100}).input.limit, 8);
  assert.equal(normalize(people, {limit: null}).input.limit, 5);
});
test('UTF-16 selectors clip exactly and expanded state overflow refuses explicitly', () => {
  assert.equal(normalize(bills, {query: '🧭'.repeat(121)}).input.query.length, 240);
  assert.equal(normalize(people, {query: '🧭'.repeat(61)}).input.query.length, 120);
  assert.equal(normalize(people, {state: 'ß'}).input.state, 'SS');
  assert.throws(() => normalize(bills, {state: 'ßß'}));
});
test('model authority fields, malformed types and extra context refuse', () => {
  for (const id of [bills, people]) {
    for (const field of ['tenantId', 'actorId', 'clientId', 'sql', 'current']) assert.throws(() => normalize(id, {[field]: 'forged'}));
    for (const raw of [{query: 7}, {limit: true}, {state: []}]) assert.throws(() => normalize(id, raw));
    assert.throws(() => normalize(id, {}, {actorId: 'forged'}));
  }
});
test('bill persisted scalar domain keeps nullable and negative count facts', () => {
  check(bills, billPage());
  for (const change of [{sponsorCount: 1.5}, {sponsorCount: 2147483648}, {subjects: [null]}, {privateField: 'hidden'}])
    assert.throws(() => check(bills, billPage([{...bill(), ...change}])));
});
test('known status labels, superseded, free-form unknown and prototype names correlate', () => {
  for (const [status, statusLabel] of Object.entries(schema.$defs.StateBillStatusLabels.const))
    check(bills, billPage([{...bill(), status, statusLabel}]));
  for (const status of ['future-status', '', 'constructor', '__proto__']) check(bills, billPage([{...bill(), status, statusLabel: status}]));
  assert.throws(() => check(bills, billPage([{...bill(), status: 'enacted', statusLabel: 'Failed'}])));
});
test('exact bill filters cannot substitute state/session/status but query is not exact title', () => {
  check(bills, billPage(), {query: 'potential subject', state: 'ca', session: '2026'});
  for (const raw of [{state: 'NY'}, {session: '2025'}, {status: 'introduced'}]) assert.throws(() => check(bills, billPage(), raw));
});
test('bill count/page race admits total0 with rows only with zero-count note', () => {
  check(bills, {...billPage(), total: 0, note: schema.$defs.StateBillEmptyNote.const});
  const {note, ...positiveCountEmptyPage} = billPage([]);
  check(bills, {...positiveCountEmptyPage, total: 17});
});
test('bill note presence follows count and requested window remains bounded', () => {
  assert.throws(() => check(bills, {...billPage(), total: 0}));
  assert.throws(() => check(bills, {...billPage(), note: schema.$defs.StateBillEmptyNote.const}));
  assert.throws(() => check(bills, billPage([bill(), bill()]), {limit: 1}));
});
test('bill title semantic ceiling measures UTF-16 units', () => {
  check(bills, billPage([{...bill(), title: '🧭'.repeat(120)}]));
  assert.throws(() => check(bills, billPage([{...bill(), title: '🧭'.repeat(121)}])));
});
test('bill SQL date keeps UTC midnight and generatedAt remains producer canonical instant', () => {
  check(bills, billPage([{...bill(), latestActionDate: '2026-10-11T00:00:00.000Z'}]));
  for (const latestActionDate of ['2026-10-11T12:00:00.000Z', '2026-10-11', '2026-02-30T00:00:00.000Z'])
    assert.throws(() => check(bills, billPage([{...bill(), latestActionDate}])));
  assert.throws(() => check(bills, {...billPage(), generatedAt: '2026-10-12T12:00:00Z'}));
});
test('missing or blank legislator query keeps explicit non-result branch', () => {
  for (const raw of [{}, {query: ' '}, {query: null}]) check(people, empty(schema.$defs.StateLegislatorMissingNote.const), raw);
  assert.throws(() => check(people, personPage()));
  assert.throws(() => check(people, empty('No records exist')));
});
test('no legislator match correlates original normalized query and optional state', () => {
  check(people, empty('No state legislator matched "Synthetic" in CA. Say so explicitly — do not fabricate a legislator.'), {query: ' Synthetic ', state: 'ca'});
  assert.throws(() => check(people, empty('No state legislator matched "Other". Say so explicitly — do not fabricate a legislator.'), {query: 'Synthetic'}));
});
test('one bounded name result preserves opaque committees and need not prove global uniqueness', () => {
  check(people, personPage(), {query: 'Synthetic', state: 'ca', limit: 1});
  check(people, personPage({...person(), committees: null, active: false}), {query: 'Synthetic'});
  assert.throws(() => check(people, personPage(), {query: 'Synthetic', state: 'NY'}));
});
test('crosswalk namespace may be unknown or empty and ignores state hint', () => {
  for (const matchedBy of ['new-provider-crosswalk', '-crosswalk'])
    check(people, personPage({...person(), matchedBy}), {query: 'external-id', state: 'NY'});
  assert.throws(() => check(people, personPage({...person(), matchedBy: 'authoritative-match'}), {query: 'external-id'}));
});
test('ambiguity preserves candidates with explicit clarification and no attributed match', () => {
  check(people, ambiguous(), {query: 'Synthetic', state: 'CA'});
  assert.throws(() => check(people, ambiguous(), {query: 'Synthetic', limit: 1}));
  assert.throws(() => check(people, ambiguous(), {query: 'Synthetic', state: 'NY'}));
  assert.throws(() => check(people, {...ambiguous(), note: 'Choose the first'}, {query: 'Synthetic'}));
});
test('legislator variants cannot mix match, note or privileged fields', () => {
  for (const page of [{...personPage(), matchesFound: 0}, {...personPage(), note: 'Maybe'}, {...personPage(), ambiguousLegislator: ambiguous().ambiguousLegislator}])
    assert.throws(() => check(people, page, {query: 'Synthetic'}));
  assert.throws(() => check(people, personPage({...person(), email: 'private@example.invalid'}), {query: 'Synthetic'}));
});
test('hostile object graphs refuse before invoking accessors', () => {
  let reads = 0; const raw = {}; Object.defineProperty(raw, 'query', {enumerable: true, get() { reads++; return 'x'; }});
  assert.throws(() => normalize(people, raw)); assert.equal(reads, 0);
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => check(people, personPage({...person(), committees: cycle}), {query: 'Synthetic'}));
});
test('output is detached without modifying caller and no source-authority extension admits', () => {
  const page = personPage(), returned = check(people, page, {query: 'Synthetic'});
  returned.matches[0].name = 'changed'; assert.equal(page.matches[0].name, 'Synthetic');
  assert.throws(() => check(people, {...page, authorization: 'current'}, {query: 'Synthetic'}));
  assert.throws(() => check(bills, {...billPage(), tool: people}));
});
test('family and definition identifiers are closed', () => {
  assert.equal(v.stateLegislationInputDefinition(bills), 'StateBillSearchInput');
  assert.equal(v.stateLegislationOutputDefinition(people), 'StateLegislatorOutput');
  assert.throws(() => normalize('constructor'));
  assert.throws(() => v.validateStateLegislationShape('missing', {}));
});
