import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  federalMarketSchemaId,
  FEDERAL_MARKET_OPERATION_IDS,
  federalMarketInputDefinition,
  validateFederalMarketShape,
  normalizeFederalMarketInput,
} from '../retrieval-0.2/federal-market-validation.mjs';

// Literal synthetic DATA only. No handler, identity, source or client scope is
// exercised; passing structural validation never grants authorization.
const schemaPath = new URL('../retrieval-0.2/federal-market.schema.json', import.meta.url);
const schemaRaw = readFileSync(schemaPath);
const schema = JSON.parse(schemaRaw);
const modulePath = new URL('../retrieval-0.2/federal-market-validation.mjs', import.meta.url);

const positive = {
  search_federal_contract_awards: { clientId: 'client-synthetic', query: 'bridge', agency: 'DOT', state: 'ca', district: '07', fiscalYear: 2024, recipient: 'Acme', dateFrom: '2024-01-01', dateTo: '2024-12-31', page: 2, limit: 25 },
  search_federal_subawards: { query: 'subaward', state: 'NY', fiscalYear: 2023, recipient: 'Prime', dateFrom: '2023-01-01', dateTo: '2023-06-30' },
  search_contract_vehicles: { query: 'vehicle', agency: 'GSA', state: 'TX', district: 'AL' },
  search_procurement_forecasts: { clientId: 'client-synthetic', query: 'cloud forecast', agency: 'VA', state: 'VA', fiscalYear: 2025 },
  get_district_federal_market: { clientId: 'client-synthetic', state: 'ny', district: 'al', agency: 'HUD' },
};

test('exposes five distinct operation IDs each pinned to one schema definition', () => {
  assert.equal(federalMarketSchemaId, 'urn:meri:retrieval:federal-market:0.2.0');
  assert.equal(FEDERAL_MARKET_OPERATION_IDS.length, 5);
  assert.equal(new Set(FEDERAL_MARKET_OPERATION_IDS).size, 5);
  assert.deepEqual([...FEDERAL_MARKET_OPERATION_IDS].sort(), [
    'get_district_federal_market',
    'search_contract_vehicles',
    'search_federal_contract_awards',
    'search_federal_subawards',
    'search_procurement_forecasts',
  ]);
  const definitions = FEDERAL_MARKET_OPERATION_IDS.map(id => federalMarketInputDefinition(id));
  assert.equal(new Set(definitions).size, 5, 'definitions must stay distinct per operation');
  for (const definition of definitions) assert.ok(Object.hasOwn(schema.$defs, definition), `${definition} missing from schema`);
  assert.throws(() => federalMarketInputDefinition('search_federal_awards'), /Unknown federal-market operation ID/);
  for (const inherited of ['__proto__', 'constructor', 'toString']) {
    assert.throws(() => federalMarketInputDefinition(inherited), /Unknown federal-market operation ID/);
  }
  // The schema documents the same five IDs and stays closed on every input shape.
  assert.deepEqual(schema.$defs.FederalMarketOperationId.enum, [...FEDERAL_MARKET_OPERATION_IDS]);
  for (const definition of definitions) assert.equal(schema.$defs[definition].additionalProperties, false);
});

test('accepts one positive shape for each of the five operation families', () => {
  for (const id of FEDERAL_MARKET_OPERATION_IDS) {
    const result = normalizeFederalMarketInput(id, positive[id]);
    assert.equal(result.operationId, id);
    assert.equal(result.clientScope.authoritative, false);
    assert.ok(Object.isFrozen(result.query));
    assert.equal(validateFederalMarketShape(federalMarketInputDefinition(id), result.query), result.query);
  }
});

test('materializes page/limit defaults only when absent without mutating the caller input', () => {
  const input = { query: 'bridge', state: 'CA' };
  const before = structuredClone(input);
  const result = normalizeFederalMarketInput('search_federal_contract_awards', input);
  assert.equal(result.query.page, 1);
  assert.equal(result.query.limit, 10);
  assert.deepEqual(input, before, 'caller input must not be mutated');
  assert.notEqual(result.query, input);
  const explicit = normalizeFederalMarketInput('search_federal_subawards', { limit: 1, page: 10000 });
  assert.equal(explicit.query.limit, 1);
  assert.equal(explicit.query.page, 10000);
  // Idempotent: re-normalizing an emitted query changes nothing.
  assert.deepEqual(normalizeFederalMarketInput('search_federal_contract_awards', { ...result.query }).query, result.query);
  // The district geography shape has no paging fields at all.
  const district = normalizeFederalMarketInput('get_district_federal_market', { state: 'NY', district: 'AL' });
  assert.equal('page' in district.query, false);
  assert.equal('limit' in district.query, false);
  assert.throws(() => normalizeFederalMarketInput('get_district_federal_market', { state: 'NY', district: 'AL', page: 1 }), /additional properties/);
});

test('enforces the shared page (1-10000) and limit (1-25) bounds', () => {
  for (const [field, values] of [['limit', [0, 26, 1.5]], ['page', [0, 10001, 1.5]]]) {
    for (const value of values) {
      assert.throws(() => normalizeFederalMarketInput('search_federal_subawards', { [field]: value }), new RegExp(field), `${field}=${value} must be refused`);
      assert.throws(() => normalizeFederalMarketInput('search_contract_vehicles', { [field]: value }), new RegExp(field));
    }
  }
  assert.throws(() => normalizeFederalMarketInput('search_federal_contract_awards', { limit: 25, page: 10000, bogus: true }), /additional properties/);
  normalizeFederalMarketInput('search_federal_contract_awards', { limit: 25, page: 1 });
  normalizeFederalMarketInput('search_federal_contract_awards', { limit: 1, page: 10000 });
});

test('bounds fiscalYear to 1900-2200 wherever the shape allows it', () => {
  for (const id of ['search_federal_contract_awards', 'search_federal_subawards', 'search_procurement_forecasts']) {
    for (const fiscalYear of [1899, 2201]) {
      assert.throws(() => normalizeFederalMarketInput(id, { fiscalYear }), /fiscalYear/);
    }
    normalizeFederalMarketInput(id, { fiscalYear: 1900 });
    normalizeFederalMarketInput(id, { fiscalYear: 2200 });
  }
});

test('contract vehicles exclude and explicitly reject fiscalYear', () => {
  assert.equal(Object.hasOwn(schema.$defs.SearchContractVehiclesInput.properties, 'fiscalYear'), false);
  assert.throws(() => normalizeFederalMarketInput('search_contract_vehicles', { fiscalYear: 2020 }), /fiscalYear is not supported for contract vehicles/);
  // A present-but-undefined fiscalYear is non-JSON data and is refused even earlier.
  assert.throws(() => normalizeFederalMarketInput('search_contract_vehicles', { fiscalYear: undefined }), /finite, acyclic JSON data/);
  assert.throws(() => validateFederalMarketShape('SearchContractVehiclesInput', { fiscalYear: 2020 }), /additional properties/);
  assert.throws(() => normalizeFederalMarketInput('get_district_federal_market', { state: 'NY', district: 'AL', fiscalYear: 2020 }), /additional properties/);
});

test('district federal market requires both state and district', () => {
  assert.deepEqual(schema.$defs.GetDistrictFederalMarketInput.required, ['state', 'district']);
  assert.throws(() => normalizeFederalMarketInput('get_district_federal_market', { state: 'NY' }), /state and district are required/);
  assert.throws(() => normalizeFederalMarketInput('get_district_federal_market', { district: 'AL' }), /state and district are required/);
  assert.throws(() => normalizeFederalMarketInput('get_district_federal_market', {}), /state and district are required/);
  assert.equal(normalizeFederalMarketInput('get_district_federal_market', { state: 'NY', district: 'AL' }).query.state, 'NY');
});

test('normalizes state/district casing and refuses malformed or non-string geography', () => {
  assert.equal(normalizeFederalMarketInput('get_district_federal_market', { state: ' ca ', district: ' 00 ' }).query.state, 'CA');
  assert.equal(normalizeFederalMarketInput('get_district_federal_market', { state: 'ca', district: 'al' }).query.district, 'AL');
  assert.equal(normalizeFederalMarketInput('search_federal_subawards', { state: 'ny', district: '7' }).query.district, '7');
  for (const bad of [{ state: 'California', district: 'AL' }, { state: 'C1', district: 'AL' }, { state: 'NY', district: 'ABC' }, { state: 'NY', district: '110' }]) {
    assert.throws(() => normalizeFederalMarketInput('get_district_federal_market', bad));
  }
  // No string-to-number coercion for the district, unlike the legacy advertised boundary.
  assert.throws(() => normalizeFederalMarketInput('get_district_federal_market', { state: 'NY', district: 5 }), /district must be string/);
  assert.throws(() => normalizeFederalMarketInput('search_federal_subawards', { state: 12 }), /state must be string/);
});

test('fails closed on unknown fields and refuses string-to-number coercion', () => {
  for (const id of FEDERAL_MARKET_OPERATION_IDS) {
    assert.throws(() => normalizeFederalMarketInput(id, { ...positive[id], unexpected: true }), /additional properties/);
  }
  for (const [field, value] of [['page', '3'], ['limit', '10'], ['fiscalYear', '2020']]) {
    assert.throws(() => normalizeFederalMarketInput('search_federal_subawards', { [field]: value }), /string coercion is refused/);
  }
  for (const [field, value] of [['page', true], ['limit', null], ['fiscalYear', 2020.5]]) {
    assert.throws(() => normalizeFederalMarketInput('search_federal_subawards', { [field]: value }));
  }
  assert.throws(() => normalizeFederalMarketInput('search_federal_subawards', []), /plain object/);
  assert.throws(() => normalizeFederalMarketInput('search_federal_subawards', null), /plain object/);
  assert.throws(() => normalizeFederalMarketInput('search_federal_subawards', Object.create({ query: 'inherited' })), /plain JSON objects/);
  assert.throws(() => normalizeFederalMarketInput('search_federal_subawards', Object.defineProperty({}, 'query', { get: () => 'x', enumerable: true })), /accessor/);
});

test('clientId is inert data and never authority', () => {
  const foreign = normalizeFederalMarketInput('search_federal_contract_awards', { clientId: 'client-somewhere-else' });
  assert.equal(foreign.clientScope.clientId, 'client-somewhere-else');
  assert.equal(foreign.clientScope.authoritative, false);
  assert.ok(Object.isFrozen(foreign.clientScope));
  // Structural validation of a foreign clientId still succeeds: it decides no scope.
  assert.equal(validateFederalMarketShape('SearchFederalContractAwardsInput', { clientId: 'client-somewhere-else' }).clientId, 'client-somewhere-else');
  assert.equal(normalizeFederalMarketInput('search_federal_subawards', {}).clientScope.clientId, null);
  assert.throws(() => normalizeFederalMarketInput('search_federal_subawards', { clientId: '' }), /clientId/);
  assert.equal(Object.hasOwn(positive, 'authorizationDecisionId'), false);
});

test('keeps the forecast global-query boundary explicit', () => {
  const forecast = normalizeFederalMarketInput('search_procurement_forecasts', { clientId: 'client-synthetic', query: 'cloud' });
  assert.equal(forecast.queryScope, 'global_public');
  // clientId is echoed as data only; it is not authority and does not scope a match.
  assert.equal(forecast.clientScope.authoritative, false);
  for (const id of ['search_federal_contract_awards', 'search_federal_subawards', 'search_contract_vehicles', 'get_district_federal_market']) {
    assert.equal(normalizeFederalMarketInput(id, positive[id]).queryScope, 'server_resolved');
  }
});

test('module is a pure import with no network or storage effects', () => {
  // Static surface: only a local schema read plus the pinned Ajv dependencies.
  const source = readFileSync(modulePath, 'utf8');
  const specifiers = [...source.matchAll(/(?:^|\n)\s*import[^'"]*['"]([^'"]+)['"]/g)].map(match => match[1]).sort();
  assert.deepEqual(specifiers, ['ajv-formats', 'ajv/dist/2020.js', 'node:fs'].sort());
  assert.match(source, /readFileSync\(new URL\('\.\/federal-market\.schema\.json', import\.meta\.url\)\)/);
  for (const forbidden of ['node:net', 'node:http', 'node:https', 'node:dns', 'node:child_process', 'writeFileSync', 'node:worker_threads']) {
    assert.equal(source.includes(forbidden), false, `module must not use ${forbidden}`);
  }

  // Behavioral surface: a fresh process imports and exercises the module and
  // reports no network call, no created file and no stray output.
  const script = `import{readdirSync,readFileSync,writeFileSync}from'node:fs';\n` +
    `import net from'node:net';\n` +
    `let network=false;\n` +
    `for(const k of['connect','createConnection'])if(typeof net[k]==='function')net[k]=()=>{network=true;throw new Error('network forbidden')};\n` +
    `const dirs=[${JSON.stringify(fileURLToPath(new URL('../retrieval-0.2', import.meta.url)))},${JSON.stringify(fileURLToPath(new URL('.', import.meta.url)))}];\n` +
    `const before=dirs.map(d=>readdirSync(d).sort().join(','));\n` +
    `const mod=await import(${JSON.stringify(modulePath.href)});\n` +
    `const out=mod.FEDERAL_MARKET_OPERATION_IDS.map(id=>JSON.stringify(mod.normalizeFederalMarketInput(id,id==='get_district_federal_market'?{state:'NY',district:'AL'}:{query:'x'})));\n` +
    `const after=dirs.map(d=>readdirSync(d).sort().join(','));\n` +
    `writeFileSync(1,JSON.stringify({exports:Object.keys(mod).sort(),network,unchanged:before.every((v,i)=>v===after[i]),out}));\n`;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, TEMP: process.env.TEMP }, shell: false, timeout: 15000, maxBuffer: 262144, windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr.toString());
  const report = JSON.parse(result.stdout.toString());
  assert.equal(report.network, false);
  assert.equal(report.unchanged, true);
  assert.equal(report.out.length, 5);
  assert.deepEqual(report.exports, ['FEDERAL_MARKET_OPERATION_IDS', 'federalMarketInputDefinition', 'federalMarketSchemaId', 'normalizeFederalMarketInput', 'validateFederalMarketShape']);
});
