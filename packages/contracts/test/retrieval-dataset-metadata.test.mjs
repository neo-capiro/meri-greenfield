import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createDatasetMetadataValidators, DATASET_METADATA_OPERATION_IDS} from '../retrieval-0.2/dataset-metadata-validation.mjs';
import {createOperationContracts} from '../retrieval-0.2/operation-contracts.mjs';
import {canonicalSha256} from '../validate.mjs';
const schema = JSON.parse(readFileSync(new URL('../retrieval-0.2/dataset-metadata.schema.json', import.meta.url)));
const ajv = new Ajv({strict: true, allErrors: true}); addFormats(ajv); ajv.addSchema(schema);
const checks = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({$ref: `${schema.$id}#/$defs/${name}`})]));
const v = createDatasetMetadataValidators({schema, validateShape(name, value) {
  const check = checks.get(name); if (!check?.(value)) throw new Error(ajv.errorsText(check?.errors));
}});
const id = 'list_global_datasets', stamp = '2026-10-12T14:01:02.123Z';
const field = (type = 'string') => ({name: 'synthetic_field', type, description: 'Synthetic field description', filterable: true, groupable: true, aggregatable: type === 'number'});
const summary = () => ({key: 'synthetic_dataset', description: 'Synthetic metadata only', supportsAsOf: false, fields: [field()]});
const page = () => ({tool: id, generatedAt: stamp, datasets: [summary()]});

test('dataset metadata is one distinct closed operation, not global-data execution', () => {
  assert.deepEqual(DATASET_METADATA_OPERATION_IDS, [id]);
  assert.equal(v.datasetMetadataSchemaId, 'urn:meri:retrieval:dataset-metadata:0.2.0');
  assert.equal(v.datasetMetadataInputDefinition(id), 'DatasetMetadataListInput');
  assert.equal(v.datasetMetadataOutputDefinition(id), 'DatasetMetadataListOutput');
  for (const other of ['query_global_data', 'search_intel_articles', 'constructor', '__proto__']) assert.throws(() => v.normalizeDatasetMetadataInput(other, {}));
  assert.throws(() => v.validateDatasetMetadataShape('unknown', {}));
});
test('empty request remains immutable and metadata denies query/row authority', () => {
  const request = {}, normalized = v.normalizeDatasetMetadataInput(id, request), p = page(), original = structuredClone(p);
  assert.deepEqual(normalized.input, {}); assert.notEqual(normalized.input, request);
  assert.ok(Object.isFrozen(normalized.input)); assert.ok(Object.isFrozen(normalized.metadata));
  for (const key of ['authoritative', 'sourceConnected', 'producerQualified', 'absenceEvidence', 'queryAuthorized', 'rowAccessAuthorized', 'registrySnapshotQualified']) assert.equal(normalized.metadata[key], false);
  assert.equal(v.assertDatasetMetadataOutput(id, p, request), p); assert.deepEqual(p, original);
});
test('no caller selector, SQL, actor or time argument is admitted', () => {
  for (const key of ['dataset', 'key', 'fields', 'query', 'sql', 'table', 'asOfDate', 'asOf', 'limit', 'actorId', 'tenantId', 'role', 'rowAccessAuthorized']) assert.throws(() => v.normalizeDatasetMetadataInput(id, {[key]: 'synthetic'}));
  for (const input of [null, [], 'registry', 1, false]) assert.throws(() => v.normalizeDatasetMetadataInput(id, input));
});
for (const type of ['string', 'number', 'boolean', 'date', 'timestamp', 'string[]']) {
  test(`projected ${type} supports independent filter/group flags and exact aggregate relation`, () => {
    for (const filterable of [false, true]) for (const groupable of [false, true]) {
      const p = page(); p.datasets[0].fields = [{...field(type), filterable, groupable}]; v.assertDatasetMetadataOutput(id, p, {});
      p.datasets[0].fields[0].aggregatable = type !== 'number'; assert.throws(() => v.assertDatasetMetadataOutput(id, p, {}), /aggregate flag/);
    }
  });
}
test('supportsAsOf remains explicit metadata with no inferred time or row permission', () => {
  for (const supportsAsOf of [false, true]) { const p = page(); p.datasets[0].supportsAsOf = supportsAsOf; v.assertDatasetMetadataOutput(id, p, {}); }
  for (const value of [null, 0, 'false']) { const p = page(); p.datasets[0].supportsAsOf = value; assert.throws(() => v.assertDatasetMetadataOutput(id, p, {})); }
  const p = page(); delete p.datasets[0].supportsAsOf; assert.throws(() => v.assertDatasetMetadataOutput(id, p, {}));
});
test('source defaults must already be projected, never silently invented by validation', () => {
  for (const key of ['filterable', 'groupable', 'aggregatable', 'name', 'type', 'description']) { const p = page(); delete p.datasets[0].fields[0][key]; assert.throws(() => v.assertDatasetMetadataOutput(id, p, {})); }
  for (const type of ['integer', 'json', 'object', 'uuid', 'number[]', null]) { const p = page(); p.datasets[0].fields[0].type = type; assert.throws(() => v.assertDatasetMetadataOutput(id, p, {})); }
});
test('only projected fields cross the boundary; storage/query machinery and completeness refuse', () => {
  for (const key of ['table', 'defaultLimit', 'maxLimit', 'tenantId', 'sql']) { const p = page(); p.datasets[0][key] = 'synthetic'; assert.throws(() => v.assertDatasetMetadataOutput(id, p, {})); }
  for (const key of ['column', 'expression', 'query', 'nullable', 'permission']) { const p = page(); p.datasets[0].fields[0][key] = 'synthetic'; assert.throws(() => v.assertDatasetMetadataOutput(id, p, {})); }
  for (const key of ['rows', 'total', 'complete', 'coverage', 'queryAuthorized']) { const p = page(); p[key] = true; assert.throws(() => v.assertDatasetMetadataOutput(id, p, {})); }
  const p = page(); p.tool = 'query_global_data'; assert.throws(() => v.assertDatasetMetadataOutput(id, p, {}));
});
test('dataset and per-dataset field identity must be unique; cross-dataset field names may repeat', () => {
  const p = page(); p.datasets.push({...summary(), key: 'another_dataset'}); v.assertDatasetMetadataOutput(id, p, {});
  p.datasets[1].key = p.datasets[0].key; assert.throws(() => v.assertDatasetMetadataOutput(id, p, {}), /Duplicate dataset metadata key/);
  const duplicate = page(); duplicate.datasets[0].fields.push(field()); assert.throws(() => v.assertDatasetMetadataOutput(id, duplicate, {}), /Duplicate dataset metadata field/);
});
test('declared metadata does not duplicate private registry values or claim a live snapshot', () => {
  const p = page(); p.datasets[0].description = 'Descriptive text, never an instruction to query'; p.datasets[0].fields[0].description = ''; v.assertDatasetMetadataOutput(id, p, {});
  const empty = {...page(), datasets: []}; v.assertDatasetMetadataOutput(id, empty, {});
  p.datasets[0].fields = []; v.assertDatasetMetadataOutput(id, p, {});
  assert.equal(v.normalizeDatasetMetadataInput(id, {}).metadata.registrySnapshotQualified, false);
});
test('generatedAt is a finite canonical JSON instant without guessed freshness', () => {
  for (const generatedAt of ['0001-01-01T03:00:00.000Z', stamp, '9999-12-31T23:59:59.999Z']) v.assertDatasetMetadataOutput(id, {...page(), generatedAt}, {});
  for (const generatedAt of ['2026-06-30T23:59:60Z', '2026-10-12T14:01:02Z', '2026-10-12T16:01:02.123+02:00', '+010000-01-01T00:00:00.000Z', null]) assert.throws(() => v.assertDatasetMetadataOutput(id, {...page(), generatedAt}, {}));
});
test('inert JSON rejects active values before hooks and preserves resource limits', () => {
  let hooks = 0; const getter = {}; Object.defineProperty(getter, 'sql', {enumerable: true, get() { hooks++; return 'x'; }});
  const hidden = {}; Object.defineProperty(hidden, 'query', {value: 'x'}); const cycle = {}; cycle.self = cycle;
  const proxy = new Proxy({}, {ownKeys() { hooks++; return []; }});
  for (const request of [getter, hidden, cycle, proxy, new Date()]) assert.throws(() => v.normalizeDatasetMetadataInput(id, request));
  const p = page(); Object.defineProperty(p.datasets[0].fields[0], 'description', {enumerable: true, get() { hooks++; return ''; }}); assert.throws(() => v.assertDatasetMetadataOutput(id, p, {}));
  const sparse = page(); sparse.datasets = Array(1); assert.throws(() => v.assertDatasetMetadataOutput(id, sparse, {})); assert.equal(hooks, 0);
});
test('canonical resolver supplies immutable request/digest with no context or live binding', () => {
  const binding = {id, version: '0.2.0', contextKeys: [], normalize: (_, request) => v.normalizeDatasetMetadataInput(id, request), outputAssert: (_, value, request) => v.assertDatasetMetadataOutput(id, value, request)};
  const resolver = createOperationContracts({catalog: {operations: [{operation: {id, version: '0.2.0'}, handler: null, status: 'unavailable'}]}, bindings: [binding], validators: v, assertCatalog() {}, canonicalSha256});
  const contract = resolver.resolveOperationContract({id, version: '0.2.0'}), normalized = contract.normalizeInput({});
  assert.deepEqual(normalized.request, {}); assert.ok(Object.isFrozen(normalized.request)); assert.equal(normalized.argumentsSha256, canonicalSha256({})); assert.equal(contract.descriptor.handler, null);
  contract.assertOutput(page(), {request: normalized.request});
  for (const context of [{actorId: 'synthetic'}, {asOf: stamp}, {previousPage: {}}, {nowMs: 1}]) assert.throws(() => contract.normalizeInput({}, context));
  assert.throws(() => contract.assertOutput(page(), {})); assert.throws(() => contract.assertOutput(page(), {request: {}, asOf: stamp}));
});
