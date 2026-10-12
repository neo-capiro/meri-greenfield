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
  validateShape,
} from '../retrieval-0.2/validate.mjs';

// Literal synthetic DATA only. No handler, identity, source or client scope is
// exercised; passing structural validation never grants authorization.
const schemaPath = new URL('../retrieval-0.2/federal-market.schema.json', import.meta.url);
const schemaRaw = readFileSync(schemaPath);
const schema = JSON.parse(schemaRaw);
const modulePath = new URL('../retrieval-0.2/federal-market-validation.mjs', import.meta.url);
const canonicalModulePath = new URL('../retrieval-0.2/validate.mjs', import.meta.url);

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
  // The domain factory has no imports or second schema/Ajv owner. The existing
  // canonical composition loads the local schemas and pinned Ajv dependencies.
  const source = readFileSync(modulePath, 'utf8');
  const specifiers = [...source.matchAll(/(?:^|\n)\s*import[^'"]*['"]([^'"]+)['"]/g)].map(match => match[1]).sort();
  assert.deepEqual(specifiers, []);
  assert.doesNotMatch(source, /readFileSync|\bnew\s+Ajv\b/);
  assert.match(source, /export function createFederalMarketValidators/);
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
    `const factory=await import(${JSON.stringify(modulePath.href)});\n` +
    `const mod=await import(${JSON.stringify(canonicalModulePath.href)});\n` +
    `const out=mod.FEDERAL_MARKET_OPERATION_IDS.map(id=>JSON.stringify(mod.normalizeFederalMarketInput(id,id==='get_district_federal_market'?{state:'NY',district:'AL'}:{query:'x'})));\n` +
    `const after=dirs.map(d=>readdirSync(d).sort().join(','));\n` +
    `const names=['FEDERAL_MARKET_OPERATION_IDS','federalMarketInputDefinition','federalMarketSchemaId','normalizeFederalMarketInput','validateFederalMarketShape'];\n` +
    `writeFileSync(1,JSON.stringify({exports:Object.keys(mod).filter(name=>names.includes(name)).sort(),factoryExports:Object.keys(factory).sort(),network,unchanged:before.every((v,i)=>v===after[i]),out}));\n`;
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
  assert.deepEqual(report.factoryExports, ['FEDERAL_MARKET_OPERATION_IDS', 'createFederalMarketValidators']);
});

// ---------------------------------------------------------------------------
// REL-02 result shapes. Literal synthetic DATA only: no handler, identity,
// source, client scope or serialization pipeline is exercised, and passing
// structural validation never grants authorization or proves freshness.
// ---------------------------------------------------------------------------

// The schema is the single owner of the operation-to-output mapping: each output
// definition pins `tool` to its operation ID, so the mapping is derived here
// rather than restated.
const outputDefinitionFor = operationId => Object.entries(schema.$defs)
  .filter(([, definition]) => definition?.properties?.tool?.const === operationId)
  .map(([name]) => name);
const outputDefinition = Object.fromEntries(FEDERAL_MARKET_OPERATION_IDS.map(id => [id, outputDefinitionFor(id)[0]]));
const pagedOutputDefinitions = [
  outputDefinition.search_federal_contract_awards,
  outputDefinition.search_federal_subawards,
  outputDefinition.search_contract_vehicles,
  outputDefinition.search_procurement_forecasts,
];
const pageEnvelopeFields = ['items', 'total', 'page', 'pageSize', 'source', 'asOf', 'generatedAt', 'hasMore', 'nextPage', 'paginationLimitReached', 'tool'];

const contractRow = (overrides = {}) => ({
  id: 'award-1', awardId: 'AW-1', recipientName: 'Acme', recipientUei: 'ABC123456789', awardingAgency: 'DOT',
  amount: 1000, description: 'bridge', actionDate: '2024-01-01', latestActionDate: null, baseAwardSignedDate: null,
  sourceLastModifiedDate: null, popStartDate: null, popEndDate: null, state: 'CA', district: '07',
  districtKey: 'CA-07', source: 'usaspending', sourceUpdatedAt: null, ...overrides,
});
const subawardRow = (overrides = {}) => ({
  id: 'sub-1', providerKey: 'tango:sub:1', awardKey: 'AW-1', primeRecipientName: 'Prime', primeRecipientUei: null,
  subawardeeName: 'Sub', subawardeeUei: null, awardingAgency: 'DOT', awardingOffice: null, amount: 250,
  description: 'paving', actionDate: '2023-05-05', fiscalYear: 2023, naicsCode: '237310', state: 'NY',
  district: null, districtKey: null, sourceUrl: 'https://example.invalid/subaward/1', source: 'tango',
  sourceUpdatedAt: null, ...overrides,
});
const vehicleRow = (overrides = {}) => ({
  id: 'veh-1', vehicleId: 'GS-00F-0001', name: 'Schedule', solicitationIdentifier: null, vehicleType: 'GSA',
  agency: 'GSA', naicsCode: null, pscCode: null, setAside: null, lastDateToOrder: '2027-09-30', awardeeCount: 3,
  orderCount: null, totalObligated: 100, relationship: 'self', recipientUei: null, source: 'tango',
  sourceUpdatedAt: null, ...overrides,
});
const forecastRow = (overrides = {}) => ({
  id: 'fc-1', forecastId: 'FC-1', title: 'Cloud services', description: null, agency: 'VA', department: null,
  office: null, anticipatedAwardDate: null, estimatedPeriod: null, fiscalYear: 2025, naicsCode: null, pscCode: null,
  setAside: null, contractVehicle: null, placeOfPerformance: null, contactName: null, contactEmail: null,
  status: null, active: null, sourceSystem: null, sourceUrl: null, source: 'tango', sourceUpdatedAt: null, ...overrides,
});
const districtRow = (overrides = {}) => ({
  districtKey: 'NY-01', state: 'NY', district: '01', contractCount: 2, contractAmount: 500, subawardCount: 1,
  subawardAmount: null, ...overrides,
});
const stateSubawardRow = (overrides = {}) => ({
  state: 'NY', subawardCount: 4, subawardAmount: 1200, geographyBasis: 'source_state_place_of_performance', ...overrides,
});
const futureSignalRow = (overrides = {}) => ({
  id: 'sig-1', source: 'sam_gov', title: 'Upcoming', agency: null, state: null, districtKey: null, date: null,
  geographyBasis: 'unresolved', sourceUrl: null, ...overrides,
});
const pageOutput = (operationId, item, overrides = {}) => ({
  items: [item], total: 3, page: 1, pageSize: 10, source: 'tango', asOf: null,
  generatedAt: '2026-10-11T00:00:00.000Z', hasMore: true, nextPage: 2, paginationLimitReached: false,
  tool: operationId, ...overrides,
});
const geographyOutput = (overrides = {}) => ({
  districts: [districtRow()], futureSignals: [futureSignalRow()], awardedMoneyIncludesFutureOpportunities: false,
  warnings: [], tool: 'get_district_federal_market', generatedAt: '2026-10-11T00:00:00.000Z', ...overrides,
});
const positiveOutputs = {
  search_federal_contract_awards: pageOutput('search_federal_contract_awards', contractRow()),
  search_federal_subawards: pageOutput('search_federal_subawards', subawardRow()),
  search_contract_vehicles: pageOutput('search_contract_vehicles', vehicleRow()),
  search_procurement_forecasts: pageOutput('search_procurement_forecasts', forecastRow()),
  get_district_federal_market: geographyOutput(),
};

test('exposes one distinct structural output definition per federal-market operation', () => {
  for (const id of FEDERAL_MARKET_OPERATION_IDS) {
    const names = outputDefinitionFor(id);
    assert.equal(names.length, 1, `${id} must map to exactly one output definition`);
    assert.ok(Object.hasOwn(schema.$defs, names[0]));
  }
  assert.equal(new Set(Object.values(outputDefinition)).size, 5, 'output definitions must stay distinct');
  // Each paged family carries the frozen page envelope and the pageResult fields.
  for (const name of pagedOutputDefinitions) {
    assert.equal(schema.$defs[name].additionalProperties, false);
    assert.deepEqual([...schema.$defs[name].required].sort(), [...pageEnvelopeFields].sort());
    assert.equal(schema.$defs[name].properties.page.minimum, 1);
    assert.equal(schema.$defs[name].properties.pageSize.minimum, 1);
  }
  // The geography output keeps its rolling-optional fields out of `required`.
  const geographyRequired = schema.$defs[outputDefinition.get_district_federal_market].required;
  for (const optional of ['stateSubawards', 'futureSignalsAvailability']) {
    assert.equal(geographyRequired.includes(optional), false, `${optional} must not be forced present`);
  }
  // The five input definitions are untouched by the output extension.
  assert.deepEqual(schema.$defs.FederalMarketOperationId.enum, [...FEDERAL_MARKET_OPERATION_IDS]);
  for (const id of FEDERAL_MARKET_OPERATION_IDS) assert.equal(schema.$defs[federalMarketInputDefinition(id)].additionalProperties, false);
  assert.deepEqual(schema.$defs.GetDistrictFederalMarketInput.required, ['state', 'district']);
});

test('accepts one positive structural result for each of the five output families', () => {
  for (const id of FEDERAL_MARKET_OPERATION_IDS) {
    assert.equal(validateFederalMarketShape(outputDefinition[id], positiveOutputs[id]), positiveOutputs[id]);
  }
  // Both optional rolling rails may be present, and each may be absent on its own.
  assert.equal(validateFederalMarketShape(outputDefinition.get_district_federal_market, geographyOutput({
    stateSubawards: [stateSubawardRow()], futureSignalsAvailability: 'unavailable',
  })).stateSubawards.length, 1);
  assert.equal('stateSubawards' in geographyOutput(), false);
  const emptyRails = validateFederalMarketShape(outputDefinition.get_district_federal_market, geographyOutput({
    districts: [], stateSubawards: [], futureSignals: [], futureSignalsAvailability: 'available',
  }));
  assert.deepEqual(emptyRails.districts, []);
});

test('enforces declared result fields, nullability and row source literals', () => {
  const def = outputDefinition.search_federal_subawards;
  const withItem = item => pageOutput('search_federal_subawards', item);
  // Missing required envelope field and missing required row field.
  for (const drop of ['total', 'asOf', 'hasMore', 'nextPage', 'paginationLimitReached', 'tool']) {
    const value = pageOutput('search_federal_subawards', subawardRow());
    delete value[drop];
    assert.throws(() => validateFederalMarketShape(def, value), /required/, `${drop} must be required`);
  }
  const missingRowField = subawardRow();
  delete missingRowField.providerKey;
  assert.throws(() => validateFederalMarketShape(def, withItem(missingRowField)), /required/);
  // Declared nullability: `| null` fields accept null and their non-null type, and refuse anything else.
  validateFederalMarketShape(def, withItem(subawardRow({ amount: null, fiscalYear: null, sourceUpdatedAt: null })));
  assert.throws(() => validateFederalMarketShape(def, withItem(subawardRow({ amount: '250' }))), /number/);
  assert.throws(() => validateFederalMarketShape(def, withItem(subawardRow({ fiscalYear: 2023.5 }))), /integer/);
  // A declared non-nullable field stays non-nullable.
  assert.throws(() => validateFederalMarketShape(def, withItem(subawardRow({ id: null }))), /string/);
  assert.throws(() => validateFederalMarketShape(def, withItem(subawardRow({ providerKey: null }))), /string/);
  // Declared row source literals are per family and never interchangeable.
  assert.throws(() => validateFederalMarketShape(def, withItem(subawardRow({ source: 'usaspending' }))), /constant/);
  assert.throws(() => validateFederalMarketShape(outputDefinition.search_federal_contract_awards, pageOutput('search_federal_contract_awards', contractRow({ source: 'tango' }))), /constant/);
  assert.throws(() => validateFederalMarketShape(outputDefinition.search_procurement_forecasts, pageOutput('search_procurement_forecasts', forecastRow({ source: 'sam_gov' }))), /constant/);
  // Declared tri-state/enum row fields.
  validateFederalMarketShape(outputDefinition.search_procurement_forecasts, pageOutput('search_procurement_forecasts', forecastRow({ active: true })));
  assert.throws(() => validateFederalMarketShape(outputDefinition.search_procurement_forecasts, pageOutput('search_procurement_forecasts', forecastRow({ active: 'yes' }))), /boolean/);
  assert.throws(() => validateFederalMarketShape(outputDefinition.search_contract_vehicles, pageOutput('search_contract_vehicles', vehicleRow({ relationship: 'child' }))), /allowed values/);
  validateFederalMarketShape(outputDefinition.search_contract_vehicles, pageOutput('search_contract_vehicles', vehicleRow({ relationship: null })));
  // Closed declared rows refuse an undeclared field.
  assert.throws(() => validateFederalMarketShape(def, withItem(subawardRow({ extra: 1 }))), /additional properties/);
  // The contract-award row is a declared-type candidate whose serializer is
  // outside the frozen file set, so an unestablished extra field stays open.
  const serialized = contractRow({ serializedBaseAwardDate: '2024-01-01' });
  validateFederalMarketShape(outputDefinition.search_federal_contract_awards, pageOutput('search_federal_contract_awards', serialized));
  assert.equal(schema.$defs.FederalContractMarketRow.additionalProperties, true);
  assert.match(schema.$defs.FederalContractMarketRow.description, /DECLARED-TYPE CANDIDATE/);
  // A wrong-family item is refused by the row reference.
  assert.throws(() => validateFederalMarketShape(def, withItem(contractRow())), /required/);
});

test('keeps the state-only subaward rail separate from district attribution', () => {
  const def = outputDefinition.get_district_federal_market;
  // A state rail row is not a district row and vice versa: both shapes are closed.
  assert.throws(() => validateFederalMarketShape(def, geographyOutput({ districts: [stateSubawardRow()] })), /required/);
  assert.throws(() => validateFederalMarketShape(def, geographyOutput({ stateSubawards: [districtRow()] })), /required/);
  assert.throws(() => validateFederalMarketShape(def, geographyOutput({ stateSubawards: [stateSubawardRow({ districtKey: 'NY-01' })] })), /additional properties/);
  assert.throws(() => validateFederalMarketShape(def, geographyOutput({ districts: [districtRow({ geographyBasis: 'source_state_place_of_performance' })] })), /additional properties/);
  // The rail literal is required and fixed.
  assert.throws(() => validateFederalMarketShape(def, geographyOutput({ stateSubawards: [stateSubawardRow({ geographyBasis: 'inferred_from_city' })] })), /constant/);
  const missingBasis = stateSubawardRow();
  delete missingBasis.geographyBasis;
  assert.throws(() => validateFederalMarketShape(def, geographyOutput({ stateSubawards: [missingBasis] })), /required/);
  // The frozen composer drops statewide/non-voting sentinel districts.
  for (const sentinel of ['90', '98', 'ZZ']) {
    assert.throws(() => validateFederalMarketShape(def, geographyOutput({ districts: [districtRow({ district: sentinel })] })), /NOT be valid/);
  }
  validateFederalMarketShape(def, geographyOutput({ districts: [districtRow({ district: '00' }), districtRow({ district: 'AL' })] }));
  // Awarded dollars never include future opportunities, and the rail status is source-only.
  assert.throws(() => validateFederalMarketShape(def, geographyOutput({ awardedMoneyIncludesFutureOpportunities: true })), /constant/);
  assert.throws(() => validateFederalMarketShape(def, geographyOutput({ futureSignalsAvailability: 'unknown' })), /allowed values/);
  assert.throws(() => validateFederalMarketShape(def, geographyOutput({ futureSignals: [futureSignalRow({ source: 'tango' })] })), /allowed values/);
  assert.throws(() => validateFederalMarketShape(def, geographyOutput({ futureSignals: [futureSignalRow({ geographyBasis: 'district_inferred' })] })), /allowed values/);
  validateFederalMarketShape(def, geographyOutput({ futureSignals: [futureSignalRow({ source: 'agency_forecast', geographyBasis: 'state_text', date: null })] }));
  assert.throws(() => validateFederalMarketShape(def, geographyOutput({ warnings: [1] })), /string/);
});

test('enforces the paged-result paging boundary established by the frozen pageResult', () => {
  for (const def of pagedOutputDefinitions) {
    const tool = schema.$defs[def].properties.tool.const;
    const item = positiveOutputs[tool].items[0];
    const value = overrides => pageOutput(tool, item, overrides);
    // With no further rows, the continuation is null.
    assert.throws(() => validateFederalMarketShape(def, value({ hasMore: false, nextPage: 2 })), /nextPage must be null/);
    assert.equal(validateFederalMarketShape(def, value({ hasMore: false, nextPage: null })).nextPage, null);
    // The page-limit flag is exactly the producer's hasMore && page >= 10000.
    assert.throws(() => validateFederalMarketShape(def, value({ hasMore: false, nextPage: null, paginationLimitReached: true })), /must match the page limit/);
    assert.throws(() => validateFederalMarketShape(def, value({ page: 4, nextPage: null, paginationLimitReached: true })), /must match the page limit/);
    assert.throws(() => validateFederalMarketShape(def, value({ page: 10000, nextPage: 10001, paginationLimitReached: false })), /must match the page limit/);
    assert.throws(() => validateFederalMarketShape(def, value({ page: 10000, nextPage: 10001, paginationLimitReached: true })), /nextPage must be null/);
    assert.equal(validateFederalMarketShape(def, value({ page: 10000, nextPage: null, paginationLimitReached: true })).paginationLimitReached, true);
    // While rows remain below the limit, the continuation is exactly page + 1.
    assert.equal(validateFederalMarketShape(def, value({ page: 4, nextPage: 5 })).nextPage, 5);
    assert.throws(() => validateFederalMarketShape(def, value({ page: 4, nextPage: 4 })), /page \+ 1/);
    assert.throws(() => validateFederalMarketShape(def, value({ page: 4, nextPage: 6 })), /page \+ 1/);
    assert.throws(() => validateFederalMarketShape(def, value({ hasMore: true, paginationLimitReached: false, nextPage: null })), /page \+ 1/);
    // No total accuracy is asserted: an inconsistent-looking total is not derived from.
    assert.equal(validateFederalMarketShape(def, value({ total: 0, hasMore: true, nextPage: 2 })).total, 0);
    assert.throws(() => validateFederalMarketShape(def, value({ hasMore: 'yes' })), /boolean/);
  }
  // The geography family has no paging envelope at all.
  assert.equal('hasMore' in schema.$defs[outputDefinition.get_district_federal_market].properties, false);
  assert.throws(() => validateFederalMarketShape(outputDefinition.get_district_federal_market, geographyOutput({ hasMore: false })), /additional properties/);
});

test('asserts no freshness, coverage, authorization or date format on result shapes', () => {
  const outputDefs = Object.values(outputDefinition).map(name => schema.$defs[name]);
  const keywordNames = new Set();
  const collect = node => {
    if (Array.isArray(node)) { for (const item of node) collect(item); return; }
    if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) { keywordNames.add(key); collect(value); }
  };
  for (const definition of outputDefs) collect(definition);
  assert.equal(keywordNames.has('format'), false, 'no date/other format may be asserted');
  const forbiddenKeys = ['authorizationDecisionId', 'authorized', 'grants', 'coverage', 'freshness', 'sourceAuthority', 'eligible', 'deadline'];
  for (const definition of outputDefs) {
    for (const key of Object.keys(definition.properties)) assert.equal(forbiddenKeys.includes(key), false, `${key} must not be claimed`);
  }
  // Nullable rolling fields stay unformatted text, so no parseable date is promised.
  assert.deepEqual(schema.$defs.FederalMarketNullableText.anyOf, [{ type: 'string' }, { type: 'null' }]);
  assert.equal(schema.$defs[outputDefinition.search_federal_subawards].properties.asOf.$ref, '#/$defs/FederalMarketNullableText');
  assert.equal(schema.$defs.FederalMarketFutureSignal.properties.date.$ref, '#/$defs/FederalMarketNullableText');
  // Private output bindings add no public export or live handler availability.
  assert.equal(Object.hasOwn(schema.$defs, 'FederalMarketOutputOperationId'), false);
  const catalog = JSON.parse(readFileSync(new URL('../retrieval-0.2/catalog.json', import.meta.url)));
  assert.equal(JSON.stringify(catalog).includes('SearchFederalContractAwardsOutput'), true);
  for (const id of FEDERAL_MARKET_OPERATION_IDS) {
    const descriptor = catalog.operations.find(row => row.operation.id === id);
    assert.equal(descriptor.outputSchema.id, `${schema.$id}#/$defs/${outputDefinition[id]}`);
    assert.equal(descriptor.handler, null); assert.equal(descriptor.availability, 'unimplemented');
    assert.equal(descriptor.qualification, 'pending');
    const mapping = catalog.originals.find(row => row.id === id);
    assert.equal(mapping.state, 'mapped');
    assert.deepEqual(mapping.replacement, { id, version: '0.2.0' });
  }
});

test('canonical structural owner resolves federal definitions without widening the federal family', () => {
  for (const id of FEDERAL_MARKET_OPERATION_IDS) {
    const input = normalizeFederalMarketInput(id, positive[id]).query;
    assert.equal(validateShape(federalMarketInputDefinition(id), input), input);
    assert.equal(validateShape(outputDefinition[id], positiveOutputs[id]), positiveOutputs[id]);
    assert.throws(() => validateShape(outputDefinition[id], { ...positiveOutputs[id], tool: 'foreign_tool' }), /constant/);
  }
  const unrelated = { basis: 'unbounded' };
  assert.equal(validateShape('WindowRequest', unrelated), unrelated);
  assert.throws(() => validateFederalMarketShape('WindowRequest', unrelated), /Unknown federal-market contract WindowRequest/);
  assert.throws(() => validateShape('InventedFederalInput', {}), /Unknown R2 contract InventedFederalInput/);
  assert.throws(() => normalizeFederalMarketInput('search_capiro_data', {}), /Unknown federal-market operation ID/);
});

test('canonical structural checks compose with federal paging rules rather than replacing them', () => {
  for (const def of pagedOutputDefinitions) {
    const tool = schema.$defs[def].properties.tool.const;
    const item = positiveOutputs[tool].items[0];
    // Structural validation alone cannot decide the producer's cross-field rule.
    const inconsistent = pageOutput(tool, item, {
      page: 10000, hasMore: true, nextPage: 10001, paginationLimitReached: false,
    });
    assert.equal(validateShape(def, inconsistent), inconsistent);
    assert.throws(() => validateFederalMarketShape(def, inconsistent), /must match the page limit/);
    const terminal = pageOutput(tool, item, {
      page: 10000, hasMore: true, nextPage: null, paginationLimitReached: true,
    });
    assert.equal(validateShape(def, terminal), terminal);
    assert.equal(validateFederalMarketShape(def, terminal), terminal);
  }
});
