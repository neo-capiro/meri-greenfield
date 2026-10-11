// Candidate federal-market boundary: structural schema validation of the input
// shapes and of the declared-type result shapes, plus explicit fail-closed
// per-tool rules and the narrow paging consistency of a paged result. Importing
// this module reads one local schema file and compiles validators; it performs no
// network, storage, process, timer, source or authorization effect, and it grants
// no access by itself.
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const fail = message => { throw new Error(message); };

// The five distinct selected operation IDs. Each is pinned to one definition in
// federal-market.schema.json; there is no alias, handler or availability mapping.
export const FEDERAL_MARKET_OPERATION_IDS = Object.freeze([
  'search_federal_contract_awards',
  'search_federal_subawards',
  'search_contract_vehicles',
  'search_procurement_forecasts',
  'get_district_federal_market',
]);

// Explicit per-tool rules. Forecasts query global public data. All other
// effective scopes remain server-resolved; a clientId argument grants nothing.
// `paged: false` marks the district geography shape, which has no page/limit.
const RULES = Object.freeze({
  search_federal_contract_awards: Object.freeze({ definition: 'SearchFederalContractAwardsInput', queryScope: 'server_resolved', geography: false, paged: true }),
  search_federal_subawards: Object.freeze({ definition: 'SearchFederalSubawardsInput', queryScope: 'server_resolved', geography: false, paged: true }),
  search_contract_vehicles: Object.freeze({ definition: 'SearchContractVehiclesInput', queryScope: 'server_resolved', geography: false, paged: true }),
  search_procurement_forecasts: Object.freeze({ definition: 'SearchProcurementForecastsInput', queryScope: 'global_public', geography: false, paged: true }),
  get_district_federal_market: Object.freeze({ definition: 'GetDistrictFederalMarketInput', queryScope: 'server_resolved', geography: true, paged: false }),
});

// Fields typed as integers in the contract. A numeric string is refused rather
// than coerced, unlike the legacy advertised boundary.
const INTEGER_FIELDS = Object.freeze(['page', 'limit', 'fiscalYear']);
const TRIMMED_FIELDS = Object.freeze(['query', 'agency', 'recipient']);
const UPPERCASED_FIELDS = Object.freeze(['state', 'district']);
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

const schemaBytes = readFileSync(new URL('./federal-market.schema.json', import.meta.url));
const schema = JSON.parse(schemaBytes);
export const federalMarketSchemaId = schema.$id;

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
ajv.addSchema(schema);
const validators = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` })]));

// Paged result definitions are derived from the schema instead of restated: each
// paged output definition pins `tool` to its operation ID and carries the
// `pageResult` fields, so the schema stays the single owner of the
// operation-to-output mapping and no second registry or alias table is added.
const PAGED_OUTPUT_DEFINITIONS = Object.freeze(Object.entries(schema.$defs)
  .filter(([, definition]) => definition?.properties?.hasMore !== undefined)
  .map(([name]) => name));

// Narrow cross-field invariants that JSON Schema cannot express, taken directly
// from the frozen producer `pageResult` (federal-market-meri-tools.service.ts
// L138-147): `nextPage` continues at `page + 1` only while rows remain and the
// tool page limit has not been reached, and is null otherwise. `hasMore` is
// deliberately NOT re-derived from `total`: the contract asserts no total
// accuracy, so the producer's `page * pageSize < total` relation is recorded as
// a producer fact rather than enforced here.
function assertPagedOutputConsistency(definition, value) {
  const { page, hasMore, nextPage, paginationLimitReached } = value;
  if (hasMore === false && nextPage !== null) fail(`${definition}: nextPage must be null when hasMore is false`);
  if (paginationLimitReached === true && hasMore !== true) fail(`${definition}: paginationLimitReached requires hasMore`);
  if (paginationLimitReached === true && nextPage !== null) fail(`${definition}: nextPage must be null at the pagination limit`);
  if (hasMore === true && paginationLimitReached === false && nextPage !== page + 1) fail(`${definition}: nextPage must continue at page + 1`);
}

// Structural responsibility only: this asserts the JSON Schema shape, plus the
// narrow paging consistency of a paged result definition, and never decides
// authorization, client scope, source availability or freshness.
export function validateFederalMarketShape(definition, value) {
  const check = validators.get(definition);
  if (!check) fail(`Unknown federal-market contract ${definition}`);
  if (!check(value)) fail(`${definition}: ${ajv.errorsText(check.errors)}`);
  if (PAGED_OUTPUT_DEFINITIONS.includes(definition)) assertPagedOutputConsistency(definition, value);
  return value;
}

export function federalMarketInputDefinition(operationId) {
  if (!Object.hasOwn(RULES, operationId)) fail(`Unknown federal-market operation ID: ${String(operationId)}`);
  return RULES[operationId].definition;
}

// Inputs are inert JSON data: no accessors, hidden keys, prototypes or non-finite
// numbers, so nothing at this boundary can trigger coercion or evaluation.
function assertInertData(value) {
  const seen = new Set(), pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (item === null || ['string', 'boolean'].includes(typeof item)) continue;
    if (typeof item === 'number' && Number.isFinite(item)) continue;
    if (typeof item !== 'object' || seen.has(item)) fail('Federal-market input requires finite, acyclic JSON data');
    seen.add(item);
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== (Array.isArray(item) ? Array.prototype : Object.prototype) && prototype !== null) fail('Federal-market input requires plain JSON objects');
    for (const name of Reflect.ownKeys(item)) {
      if (Array.isArray(item) && name === 'length') continue;
      const property = Object.getOwnPropertyDescriptor(item, name);
      if (typeof name !== 'string' || !property.enumerable || !('value' in property)) fail('Federal-market input accessor or hidden property');
      pending.push(property.value);
    }
  }
}

// Boundary entry point. Validates, applies the explicit per-tool rules, and
// returns a normalized result for one of the five operation IDs. Defaults are
// materialized only when a field is absent; the caller's object is never mutated.
export function normalizeFederalMarketInput(operationId, input) {
  if (!FEDERAL_MARKET_OPERATION_IDS.includes(operationId)) fail(`Unknown federal-market operation ID: ${String(operationId)}`);
  const rule = RULES[operationId];
  assertInertData(input);
  if (input === null || typeof input !== 'object' || Array.isArray(input)) fail('Federal-market input requires a plain object');
  if (operationId === 'search_contract_vehicles' && Object.hasOwn(input, 'fiscalYear')) fail('fiscalYear is not supported for contract vehicles');
  for (const field of INTEGER_FIELDS) if (typeof input[field] === 'string') fail(`Federal-market ${field} requires an integer; string coercion is refused`);
  if (rule.geography && (input.state === undefined || input.district === undefined)) fail('state and district are required for the district federal market');

  const normalized = { ...input };
  for (const field of TRIMMED_FIELDS) if (typeof normalized[field] === 'string') normalized[field] = normalized[field].trim();
  for (const field of UPPERCASED_FIELDS) if (typeof normalized[field] === 'string') normalized[field] = normalized[field].trim().toUpperCase();
  validateFederalMarketShape(rule.definition, normalized);
  if (rule.paged) {
    normalized.page = normalized.page ?? DEFAULT_PAGE;
    normalized.limit = normalized.limit ?? DEFAULT_LIMIT;
    validateFederalMarketShape(rule.definition, normalized);
  }

  return Object.freeze({
    operationId,
    queryScope: rule.queryScope,
    // Client scope is a server responsibility. The requested clientId is echoed
    // as inert data and is never reported as authoritative.
    clientScope: Object.freeze({ clientId: typeof normalized.clientId === 'string' ? normalized.clientId : null, authoritative: false }),
    query: Object.freeze(normalized),
  });
}
