import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createStoredIntelligenceValidators, STORED_INTELLIGENCE_OPERATION_IDS} from '../retrieval-0.2/stored-intelligence-validation.mjs';
import {createOperationContracts} from '../retrieval-0.2/operation-contracts.mjs';
import {canonicalSha256} from '../validate.mjs';
const schema = JSON.parse(readFileSync(new URL('../retrieval-0.2/stored-intelligence.schema.json', import.meta.url)));
const ajv = new Ajv({strict: true, allErrors: true}); addFormats(ajv); ajv.addSchema(schema);
const checks = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({$ref: `${schema.$id}#/$defs/${name}`})]));
const v = createStoredIntelligenceValidators({schema, validateShape(name, value) {
  const check = checks.get(name); if (!check?.(value)) throw new Error(ajv.errorsText(check?.errors));
}});
const id = 'search_intel_articles', stamp = '2026-10-12T14:01:02.123Z';
const row = () => ({id: 'stored-synthetic', source: 'synthetic-source', title: 'Stored article', url: 'not a validated URL', author: null, publishedAt: stamp, summary: '', categories: [], topics: []});
const page = (count = 1) => ({tool: id, generatedAt: stamp, total: count, data: Array.from({length: count}, (_, i) => ({...row(), id: `opaque-${i}`}))});

test('stored intelligence exposes one distinct operation and closed definitions', () => {
  assert.deepEqual(STORED_INTELLIGENCE_OPERATION_IDS, [id]);
  assert.equal(v.storedIntelligenceSchemaId, 'urn:meri:retrieval:stored-intelligence:0.2.0');
  assert.equal(v.storedIntelligenceInputDefinition(id), 'StoredIntelligenceSearchInput');
  assert.equal(v.storedIntelligenceOutputDefinition(id), 'StoredIntelligenceSearchOutput');
  for (const bad of ['list_global_datasets', 'constructor', '__proto__', `${id}@0.2.0`]) assert.throws(() => v.normalizeStoredIntelligenceInput(bad, {}));
  assert.throws(() => v.validateStoredIntelligenceShape('unknown', {}));
});
test('selectors preserve optional null/blank, exact case and UTF-16 clipping', () => {
  for (const query of [null, '', ' \n\t ']) assert.deepEqual(v.normalizeStoredIntelligenceInput(id, {query, source: query}).input, {limit: 20});
  const normalized = v.normalizeStoredIntelligenceInput(id, {query: '  '+ 'x'.repeat(239) + '😀extra  ', source: '  '+ 'S'.repeat(59) + '😀extra  '});
  assert.equal(normalized.input.query, 'x'.repeat(239) + '\ud83d');
  assert.equal(normalized.input.source, 'S'.repeat(59) + '\ud83d');
  assert.equal(v.normalizeStoredIntelligenceInput(id, {source: '  Mixed_Case  '}).input.source, 'Mixed_Case');
  for (const query of [2, true, {}, [], undefined]) assert.throws(() => v.normalizeStoredIntelligenceInput(id, {query}));
});
test('strict limit defaults and all admitted boundary values bind returned rows', () => {
  assert.equal(v.normalizeStoredIntelligenceInput(id, {}).input.limit, 20);
  for (const limit of [1, 20, 50]) v.assertStoredIntelligenceOutput(id, page(limit), {limit});
  for (const limit of [0, -1, 51, 1.5, '20', null, true, undefined, NaN, Infinity]) assert.throws(() => v.normalizeStoredIntelligenceInput(id, {limit}));
  assert.throws(() => v.assertStoredIntelligenceOutput(id, page(2), {limit: 1}), /limit substitution/);
});
test('normalization and assertions preserve caller data and deny authority claims', () => {
  const request = {query: ' term ', source: ' synthetic-source '}, saved = structuredClone(request), output = page(), original = structuredClone(output);
  const normalized = v.normalizeStoredIntelligenceInput(id, request);
  assert.deepEqual(request, saved); assert.notEqual(request, normalized.input);
  assert.ok(Object.isFrozen(normalized.input)); assert.ok(Object.isFrozen(normalized.metadata));
  for (const key of ['authoritative', 'sourceConnected', 'producerQualified', 'absenceEvidence']) assert.equal(normalized.metadata[key], false);
  assert.equal(normalized.metadata.countScope, 'separate-local-count');
  assert.equal(v.assertStoredIntelligenceOutput(id, output, request), output); assert.deepEqual(output, original);
});
test('count can race below returned rows and does not imply full corpus', () => {
  for (const total of [0, 1, 3, 1000, Number.MAX_SAFE_INTEGER]) { const p = page(3); p.total = total; v.assertStoredIntelligenceOutput(id, p, {}); }
  for (const total of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, null, '3']) { const p = page(); p.total = total; assert.throws(() => v.assertStoredIntelligenceOutput(id, p, {})); }
  const empty = page(0); empty.total = 5; v.assertStoredIntelligenceOutput(id, empty, {});
});
test('exact stored source filter is bound without pretending excerpts prove query matching', () => {
  const p = page(); v.assertStoredIntelligenceOutput(id, p, {source: ' synthetic-source ', query: 'matching words outside excerpt'});
  assert.throws(() => v.assertStoredIntelligenceOutput(id, p, {source: 'Synthetic-Source'}), /source substitution/);
  v.assertStoredIntelligenceOutput(id, p, {source: null});
});
test('projected strings preserve nullable author, opaque IDs/URLs and repeated array entries', () => {
  const p = page(); Object.assign(p.data[0], {id: '', url: '', author: '', categories: ['', 'topic', 'topic'], topics: ['x', 'x']});
  v.assertStoredIntelligenceOutput(id, p, {});
  p.data[0].author = null; v.assertStoredIntelligenceOutput(id, p, {});
  for (const key of ['title', 'summary', 'url', 'source', 'publishedAt', 'categories', 'topics']) { const bad = page(); bad.data[0][key] = null; assert.throws(() => v.assertStoredIntelligenceOutput(id, bad, {})); }
});
for (const [key, cap] of [['title', 240], ['summary', 400]]) {
  test(`${key} preserves normalized UTF-16 excerpts and does not invent ellipsis/truncation`, () => {
    for (const value of ['', 'x'.repeat(cap), 'x'.repeat(cap - 3) + '...', 'x'.repeat(cap - 4) + '\ud83d...', 'x'.repeat(cap - 1) + '\ud83d']) { const p = page(); p.data[0][key] = value; v.assertStoredIntelligenceOutput(id, p, {}); }
    for (const value of ['x'.repeat(cap + 1), '😀'.repeat(cap / 2 + 1), ' leading', 'trailing ', 'two  spaces', 'line\nbreak', null]) { const p = page(); p.data[0][key] = value; assert.throws(() => v.assertStoredIntelligenceOutput(id, p, {})); }
  });
}
test('dates are comparable JSON instants, without a midnight or ambient-now constraint', () => {
  for (const value of ['0001-01-01T03:00:00.000Z', stamp, '9999-12-31T23:59:59.999Z']) { const p = page(); p.generatedAt = value; p.data[0].publishedAt = value; v.assertStoredIntelligenceOutput(id, p, {}); }
  for (const value of ['2026-06-30T23:59:60Z', '2026-10-12T14:01:02Z', '2026-10-12T16:01:02.123+02:00', '2026-02-30T00:00:00.000Z', '+010000-01-01T00:00:00.000Z', null]) {
    for (const key of ['generatedAt', 'publishedAt']) { const p = page(); (key === 'generatedAt' ? p : p.data[0])[key] = value; assert.throws(() => v.assertStoredIntelligenceOutput(id, p, {})); }
  }
});
test('stored ordering and unique identities preserve ties and refuse substitutions', () => {
  const p = page(3); p.data[1].publishedAt = '2026-10-11T17:00:00.000Z'; p.data[2].publishedAt = p.data[1].publishedAt; v.assertStoredIntelligenceOutput(id, p, {});
  p.data[2].publishedAt = stamp; assert.throws(() => v.assertStoredIntelligenceOutput(id, p, {}), /newest first/);
  const duplicate = page(2); duplicate.data[1].id = duplicate.data[0].id; assert.throws(() => v.assertStoredIntelligenceOutput(id, duplicate, {}), /Duplicate/);
});
test('unknown arguments, unprojected source fields and forged coverage refuse', () => {
  for (const key of ['q', 'actorId', 'tenantId', 'asOf', 'cursor', 'offset', 'page', 'fullText', 'sql']) assert.throws(() => v.normalizeStoredIntelligenceInput(id, {[key]: 'synthetic'}));
  for (const key of ['complete', 'nextCursor', 'absenceEvidence', 'coverage']) { const p = page(); p[key] = true; assert.throws(() => v.assertStoredIntelligenceOutput(id, p, {})); }
  for (const key of ['feedUrl', 'agencies', 'syncedAt', 'rawContent', 'fullText', 'truncated']) { const p = page(); p.data[0][key] = ''; assert.throws(() => v.assertStoredIntelligenceOutput(id, p, {})); }
  const p = page(); p.tool = 'list_global_datasets'; assert.throws(() => v.assertStoredIntelligenceOutput(id, p, {}));
});
test('canonical inert admission refuses hooks, cycles, proxies and hidden fields before access', () => {
  let hooks = 0; const getter = {}; Object.defineProperty(getter, 'query', {enumerable: true, get() { hooks++; return 'x'; }});
  const cycle = {}; cycle.query = cycle; const hidden = {}; Object.defineProperty(hidden, 'query', {value: 'x'});
  const proxy = new Proxy({}, {ownKeys() { hooks++; return []; }});
  for (const request of [getter, cycle, hidden, proxy, new Date(), {query: 1n}, Object.assign(Object.create({}), {query: 'x'})]) assert.throws(() => v.normalizeStoredIntelligenceInput(id, request));
  const p = page(); Object.defineProperty(p.data[0], 'title', {enumerable: true, get() { hooks++; return ''; }}); assert.throws(() => v.assertStoredIntelligenceOutput(id, p, {})); assert.equal(hooks, 0);
});
test('actual canonical resolver binds original request/digest and rejects undeclared context', () => {
  const binding = {id, version: '0.2.0', contextKeys: [], normalize: (_, request) => v.normalizeStoredIntelligenceInput(id, request), outputAssert: (_, value, request) => v.assertStoredIntelligenceOutput(id, value, request)};
  const resolver = createOperationContracts({catalog: {operations: [{operation: {id, version: '0.2.0'}, handler: null, status: 'unavailable'}]}, bindings: [binding], validators: v, assertCatalog() {}, canonicalSha256});
  const contract = resolver.resolveOperationContract({id, version: '0.2.0'}), request = {source: ' synthetic-source ', query: null}, normalized = contract.normalizeInput(request);
  assert.deepEqual(normalized.request, request); assert.ok(Object.isFrozen(normalized.request));
  assert.equal(normalized.argumentsSha256, canonicalSha256({source: 'synthetic-source', limit: 20}));
  assert.equal(normalized.argumentsSha256, contract.normalizeInput({source: 'synthetic-source'}).argumentsSha256);
  contract.assertOutput(page(), {request: normalized.request});
  for (const context of [{actorId: 'x'}, {asOf: stamp}, {nowMs: 1}, {previousPage: {}}]) assert.throws(() => contract.normalizeInput(request, context));
  assert.throws(() => contract.assertOutput(page(), {}));
});
