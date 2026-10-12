import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createPublicDataValidators} from '../retrieval-0.2/public-data-validation.mjs';

// Test-only compilation; the shared production loader remains root's integration.
const schema = JSON.parse(readFileSync(new URL('../retrieval-0.2/public-data.schema.json', import.meta.url)));
const ajv = new Ajv({strict: true, allErrors: true}); addFormats(ajv); ajv.addSchema(schema);
const checks = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({$ref: `${schema.$id}#/$defs/${name}`})]));
const v = createPublicDataValidators({schema, validateShape(name, value) {
  const check = checks.get(name); if (!check?.(value)) throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`);
  return value;
}});
const economic = 'query_economic_data', grants = 'search_federal_grants', awards = 'search_federal_awards';
const off = {evidenceAccuracyMode: 'off'}, enforce = {evidenceAccuracyMode: 'enforce'};
const stamp = '2026-09-10T12:00:00.000Z';
const census = () => ({id: 'synthetic-district', state: 'CA', district: 'AL', congress: 119,
  totalPopulation: null, medianHouseholdIncome: null, medianAge: null, percentBachelorPlus: null,
  percentPoverty: null, unemploymentRate: null, laborForceSize: null, topIndustries: []});
const econ = (source = 'census', data = [census()]) => ({tool: economic, source, generatedAt: stamp, data});
const grant = () => ({id: 'synthetic-grant', title: 'Synthetic grant', agency: 'Synthetic agency', subAgency: null,
  opportunityNumber: null, category: null, awardCeiling: null, awardFloor: null, estimatedFunding: null,
  openDate: null, closeDate: null, deadlineStatus: 'unknown', syncedStatus: 'posted', eligibility: [], url: null});
const grantPage = (data = [grant()]) => ({tool: grants, generatedAt: stamp, asOf: stamp, total: data.length, data});
const unknown = () => ({at: null, dateOnly: null, timeZone: null, basis: 'unknown', daysRemaining: null, status: 'unknown'});
const award = () => ({id: '11111111-1111-4111-8111-111111111111', contractorName: null, awardingAgency: null,
  awardingSubTier: null, amount: null, description: '', peCode: null, recipientState: null, popCongressionalDistrict: null,
  actionDate: null, piid: null, latestActionDate: null, baseAwardSignedDate: null, sourceLastModifiedDate: null,
  popStartDate: null, popEndDate: null, lastSyncedAt: stamp});
const awardPage = (data = [award()]) => ({tool: awards, generatedAt: stamp, total: data.length,
  page: 1, pageSize: 20, hasMore: false, nextPage: null, paginationLimitReached: false, data});
const dates = () => ({latestActionDate: null, baseAwardSignedDate: null, sourceLastModifiedDate: null,
  popStartDate: null, popEndDate: null, capiroSyncedAt: stamp, semantics: 'Reported source date labels, never interchangeable.'});
const normalize = (id, raw, context = {}) => v.normalizePublicDataInput(id, raw, context).input;
const check = (id, output, raw = {}, context = {}) => v.assertPublicDataOutput(id, output, raw, context);

test('standalone operation selection rejects coercive objects before invoking caller code', () => {
  let effects = 0;
  const selector = {[Symbol.toPrimitive]() { effects++; return economic; }};
  assert.throws(() => v.normalizePublicDataInput(selector, {}, {}));
  assert.equal(effects, 0);
  for (const id of [null, 1, true, [], Symbol('operation')]) assert.throws(() => v.publicDataInputDefinition(id));
});

test('standalone shape selection rejects coercive names before invoking caller code', () => {
  let effects = 0;
  const selector = {[Symbol.toPrimitive]() { effects++; return 'PublicEconomicInput'; }};
  assert.throws(() => v.validatePublicDataShape(selector, {source:'census',limit:20}));
  assert.equal(effects, 0);
});

test('economic selectors normalize defaults, exact aliases and supported producer extensions', () => {
  assert.deepEqual(normalize(economic, {}), {source: 'census', limit: 20});
  assert.deepEqual(normalize(economic, {source: ' BEA ', datasetName: ' ', dataset: ' NIPA ', year: '2026', state: 'ca'}),
    {source: 'bea', limit: 20, datasetName: 'NIPA', year: 2026, state: 'CA'});
  assert.deepEqual(normalize(economic, {source: 'bls', seriesId: ' synthetic ', year: 0}),
    {source: 'bls', seriesId: 'synthetic', limit: 20});
  assert.equal(normalize(economic, {source: 'bea', datasetName: 'first', dataset: 'second'}).datasetName, 'first');
});
test('source limit normalization retains clamping and finite scalar coercion without caller mutation', () => {
  const input = {limit: '2.9', query: ' synthetic '};
  assert.deepEqual(normalize(grants, input, off), {limit: 2, query: 'synthetic'});
  assert.deepEqual(input, {limit: '2.9', query: ' synthetic '});
  for (const [value, expected] of [[0, 1], [-1, 1], ['1e3', 50], ['bad', 20], [null, 20], ['', 1]])
    assert.equal(normalize(grants, {limit: value}, off).limit, expected);
});
test('page has separate strict positive integer grammar and upper bound', () => {
  assert.equal(normalize(awards, {page: '2'}, off).page, 2);
  assert.equal(normalize(awards, {page: null}, off).page, 1);
  for (const page of [0, -1, 1.5, 10001, '02', '2.0', ' 2', true, [], ''])
    assert.throws(() => normalize(awards, {page}, off));
});
test('trusted evidence mode is mandatory only for the two policy-dependent reads', () => {
  for (const id of [grants, awards]) {
    for (const context of [{}, {evidenceAccuracyMode: 'auto'}, {...off, tenantId: 'caller'}])
      assert.throws(() => normalize(id, {}, context));
    for (const evidenceAccuracyMode of ['off', 'shadow', 'enforce']) normalize(id, {}, {evidenceAccuracyMode});
    assert.throws(() => normalize(id, {evidenceAccuracyMode: 'enforce'}, off));
  }
  assert.throws(() => normalize(economic, {}, off));
});
test('selectors and authority arguments are closed and malformed year scalars refuse', () => {
  for (const id of [economic, grants, awards]) for (const key of ['tenantId', 'actorId', 'clientId', 'sql', 'fresh'])
    assert.throws(() => normalize(id, {[key]: 'injected'}, id === economic ? {} : off));
  for (const year of ['bad', 1.5, 2147483648, true]) assert.throws(() => normalize(economic, {source: 'bea', year}));
});
test('UTF-16 request truncation and PE normalization are exact', () => {
  assert.equal(normalize(grants, {query: '🧭'.repeat(121)}, off).query.length, 240);
  assert.equal(normalize(awards, {peCode: ' 0604201a '}, off).peCode, '0604201A');
});
test('Census keeps nullable storage facts and opaque inert JSON without invented ranges', () => {
  const row = {...census(), percentPoverty: -1, percentBachelorPlus: 125, totalPopulation: -12,
    topIndustries: {reported: ['opaque', null, 3]}};
  check(economic, econ('census', [row]));
  for (const change of [{totalPopulation: 1.5}, {topIndustries: undefined}, {sourceUpdatedAt: stamp}])
    assert.throws(() => check(economic, econ('census', [{...row, ...change}])));
});
test('Census exact state/district selectors bind only its own variant', () => {
  check(economic, econ(), {state: 'ca', district: 'AL'});
  assert.throws(() => check(economic, econ(), {state: 'NY'}));
  assert.throws(() => check(economic, econ(), {district: '02'}));
});
test('BLS preserves period and value semantics and nested twelve-point ceiling', () => {
  const row = {seriesId: 'series', title: 'Synthetic indicator', surveyName: null, periodType: 'reported-period',
    recentDataPoints: [{year: 2026, period: 'M13', value: -2.5}]};
  check(economic, econ('bls', [row]), {source: 'bls', seriesId: 'series', state: 'NY'});
  assert.throws(() => check(economic, econ('bls', [row]), {source: 'bls', seriesId: 'foreign'}));
  assert.throws(() => check(economic, econ('bls', [{...row, recentDataPoints: Array(13).fill(row.recentDataPoints[0])}]), {source: 'bls'}));
  assert.throws(() => check(economic, econ('bls', [{...row, units: 'invented'}]), {source: 'bls'}));
});
test('BEA nullable values/units and exact dataset/year bind without new unit assumptions', () => {
  const row = {datasetName: 'NIPA', tableName: 'synthetic-table', description: '', year: 2026, period: 'Annual', value: null, units: null};
  check(economic, econ('bea', [row]), {source: 'bea', dataset: 'NIPA', year: 2026});
  assert.throws(() => check(economic, econ('bea', [row]), {source: 'bea', year: 2025}));
  assert.throws(() => check(economic, econ('bea', [{...row, description: '🧭'.repeat(121)}]), {source: 'bea'}));
});
test('unknown economic source retains an error branch and cannot fabricate empty success', () => {
  check(economic, {tool: economic, error: 'Unsupported source selector'}, {source: 'unknown'});
  assert.throws(() => check(economic, econ(), {source: 'unknown'}));
  assert.throws(() => check(economic, {tool: economic, error: 'Unavailable'}, {}));
});
test('economic source, operation, requested window and generated timestamp cannot substitute', () => {
  assert.throws(() => check(economic, econ('bls', []), {}));
  assert.throws(() => check(economic, {...econ(), generatedAt: '2026-02-30T00:00:00.000Z'}));
  assert.throws(() => check(economic, {...econ(), tool: grants}));
  assert.throws(() => check(economic, econ('census', [census(), census()]), {limit: 1}));
});
test('grant wire scalars preserve nulls, negative adjustments and non-URL source text', () => {
  check(grants, grantPage([{...grant(), awardCeiling: -1, awardFloor: 2.25, url: 'unverified source text'}]), {}, off);
  assert.throws(() => check(grants, grantPage([{...grant(), estimatedFunding: '2.5'}]), {}, off));
  const row = grant(); delete row.subAgency;
  assert.throws(() => check(grants, grantPage([row]), {}, off));
});
test('grant count is a separate observation, not a snapshot guarantee', () => {
  check(grants, {...grantPage(), total: 0}, {}, off);
  check(grants, {...grantPage([]), total: 1000}, {}, off);
  assert.throws(() => check(grants, grantPage([grant(), grant()]), {limit: 1}, off));
});
test('grant stored status and generated source anchor are exact', () => {
  check(grants, grantPage(), {status: 'posted'}, off);
  assert.throws(() => check(grants, grantPage(), {status: 'closed'}, off));
  assert.throws(() => check(grants, {...grantPage(), asOf: '2026-09-11T12:00:00.000Z'}, {}, off));
});
test('grant raw close day stays open through Eastern close date', () => {
  const row = {...grant(), closeDate: '2026-09-10T00:00:00.000Z', deadlineStatus: 'open'};
  const page = {...grantPage([row]), generatedAt: '2026-09-11T03:59:59.999Z', asOf: '2026-09-11T03:59:59.999Z'};
  check(grants, page, {}, off);
  assert.throws(() => check(grants, {...page, generatedAt: '2026-09-11T04:00:00.000Z', asOf: '2026-09-11T04:00:00.000Z'}, {}, off));
});
test('trusted enforce requires deadlines, while off and shadow forbid added precision', () => {
  assert.throws(() => check(grants, grantPage(), {}, enforce));
  const page = grantPage([{...grant(), deadline: unknown()}]);
  check(grants, page, {}, enforce);
  for (const evidenceAccuracyMode of ['off', 'shadow']) assert.throws(() => check(grants, page, {}, {evidenceAccuracyMode}));
});
test('text-qualified structured deadlines stay unknown while legacy raw status may remain open', () => {
  const row = {...grant(), closeDate: '2026-09-15T00:00:00.000Z', deadlineStatus: 'open',
    deadline: {...unknown(), rawText: '2026-09-15T12:00:00Z'}};
  check(grants, grantPage([row]), {}, enforce);
  const withoutText = structuredClone(row); delete withoutText.deadline.rawText;
  assert.throws(() => check(grants, grantPage([withoutText]), {}, enforce));
  assert.throws(() => check(grants, grantPage([{...row, deadline: {...row.deadline, status: 'open'}}]), {}, enforce));
});
test('structured date-only grant deadline binds literal day, end-of-day, status and days', () => {
  const row = {...grant(), closeDate: '2026-09-15T00:00:00.000Z', deadlineStatus: 'open',
    deadline: {at: '2026-09-16T03:59:59.999Z', dateOnly: '2026-09-15', timeZone: 'America/New_York',
      basis: 'date_only_end_of_day', daysRemaining: 6, status: 'open'}};
  check(grants, grantPage([row]), {}, enforce);
  for (const change of [{daysRemaining: 5}, {timeZone: null}, {at: '2026-09-16T04:59:59.999Z'}, {rawText: 'TBD'}, {dateOnly: '2026-09-16'}])
    assert.throws(() => check(grants, grantPage([{...row, deadline: {...row.deadline, ...change}}]), {}, enforce));
});
test('Eastern winter end-of-day differs from daylight-saving end-of-day', () => {
  const row = {...grant(), closeDate: '2026-12-10T00:00:00.000Z', deadlineStatus: 'open',
    deadline: {at: '2026-12-11T04:59:59.999Z', dateOnly: '2026-12-10', timeZone: 'America/New_York',
      basis: 'date_only_end_of_day', daysRemaining: 1, status: 'open'}};
  const page = {...grantPage([row]), asOf: '2026-12-10T12:00:00.000Z', generatedAt: '2026-12-10T12:00:00.000Z'};
  check(grants, page, {}, enforce);
  assert.throws(() => check(grants, {...page, data: [{...row, deadline: {...row.deadline, at: '2026-12-11T03:59:59.999Z'}}]}, {}, enforce));
});
test('grant unknown null status and UTC stored date cannot silently normalize malformed values', () => {
  assert.throws(() => check(grants, grantPage([{...grant(), deadlineStatus: 'open'}]), {}, off));
  assert.throws(() => check(grants, grantPage([{...grant(), closeDate: '2026-09-15T01:00:00.000Z', deadlineStatus: 'open'}]), {}, off));
  assert.throws(() => check(grants, grantPage([{...grant(), title: '🧭'.repeat(121)}]), {}, off));
});
test('award wire numbers are already converted and raw date/identity fields remain closed', () => {
  check(awards, awardPage([{...award(), amount: -123.75, actionDate: stamp}]), {}, off);
  for (const change of [{amount: '123.75'}, {clientId: 'injected'}, {latestActionDate: undefined}, {id: 1}])
    assert.throws(() => check(awards, awardPage([{...award(), ...change}]), {}, off));
});
test('legacy award continuation preserves count races and final page boundary', () => {
  const page = {...awardPage([]), total: 500001, page: 10000, pageSize: 50, hasMore: true, nextPage: null, paginationLimitReached: true};
  check(awards, page, {page: 10000, limit: 50}, off);
  for (const change of [{nextPage: 10001}, {paginationLimitReached: false}, {hasMore: false}])
    assert.throws(() => check(awards, {...page, ...change}, {page: 10000, limit: 50}, off));
  check(awards, {...awardPage(), total: 0}, {}, off);
  check(awards, {...awardPage([]), total: 40, hasMore: true, nextPage: 2}, {}, off);
});
test('award page, PE and requested window are bound to normalized selectors', () => {
  check(awards, awardPage([{...award(), peCode: '0604201A'}]), {peCode: '0604201a'}, off);
  assert.throws(() => check(awards, awardPage(), {peCode: '0604201A'}, off));
  assert.throws(() => check(awards, awardPage(), {page: 2}, off));
  assert.throws(() => check(awards, awardPage(), {limit: 1}, off));
});
test('award enforce preserves unknown signing/latest dates and exact sync anchor', () => {
  const row = {...award(), actionDate: '2025-01-01T00:00:00.000Z', dates: dates()};
  check(awards, awardPage([row]), {}, enforce);
  assert.throws(() => check(awards, awardPage([row]), {}, off));
  assert.throws(() => check(awards, awardPage(), {}, enforce));
  for (const change of [{baseAwardSignedDate: row.actionDate}, {latestActionDate: row.actionDate}, {capiroSyncedAt: null}])
    assert.throws(() => check(awards, awardPage([{...row, dates: {...row.dates, ...change}}]), {}, enforce));
});
test('no result family can add runtime, source completeness or approval claims', () => {
  for (const [id, page, context] of [[economic, econ(), {}], [grants, grantPage(), off], [awards, awardPage(), off]])
    for (const field of ['authorized', 'fresh', 'complete', 'approved', 'sourceEnabled'])
      assert.throws(() => check(id, {...page, [field]: true}, {}, context));
});
test('hostile requests, outputs and trusted context refuse without getter/proxy execution', () => {
  let reads = 0;
  const getter = {}; Object.defineProperty(getter, 'query', {enumerable: true, get() {reads++; return 'x';}});
  const proxy = new Proxy({}, {ownKeys() {reads++; return [];}});
  const cycle = {}; cycle.self = cycle;
  const sparse = []; sparse[2] = 'x';
  for (const value of [getter, proxy, cycle, sparse, new Date(), {limit: Infinity}])
    assert.throws(() => normalize(grants, value, off));
  const page = econ(); Object.defineProperty(page, 'hidden', {value: 1});
  assert.throws(() => check(economic, page));
  assert.throws(() => normalize(grants, {}, proxy));
  const row = census(); row.topIndustries = {get bad() {reads++; return 1;}};
  assert.throws(() => check(economic, econ('census', [row])));
  assert.equal(reads, 0);
});
