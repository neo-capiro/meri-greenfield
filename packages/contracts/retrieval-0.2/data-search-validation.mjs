// Private candidate boundary for the canonical selected intent `search_capiro_data`.
//
// This factory is source-only and unregistered in `retrieval-0.2/catalog.json`.
// The private canonical validator owns schema loading and structural validation;
// this factory owns the unchanged selector and result-envelope rules. It is not
// exported by the public 0.1 package and is not a handler, gateway, source adapter,
// runtime parity claim or authorization. Importing the factory performs no file,
// network, storage, process, timer, source or authorization effect. A passing
// validation grants no access.
//
// Every behavioural rule below is traceable to frozen Git objects at
// `neo-capiro/capirov2@fd8765ec01d292013758606204f2c9d886cd31c1`:
//   apps/api/src/meri/meri-data-search.helpers.ts            (blob 3194549806fa…)
//   apps/api/src/retrieval/retrieval-v2.types.ts             (blob 71f80b0d94d7…)
//   apps/api/src/meri/meri-context-plane.service.ts          (blob 899c23f52350…)
//   apps/api/src/knowledge/knowledge.types.ts                (blob de4957b091de…)
//   apps/api/src/meri/meri-tools.service.ts                  (blob 753b425b3e6b…, advertised schema only)
// The Capiro working tree was never read or modified.
const fail = message => {
  throw new Error(message);
};

export const DATA_SEARCH_OPERATION_ID = 'search_capiro_data';

// Frozen vocabulary, in frozen declaration order. Order is asserted literally
// by the contract test so an accidental reorder or vocabulary drift fails.
export const DATA_SEARCH_DOMAINS = Object.freeze([
  'clients',
  'contacts',
  'mail',
  'meetings',
  'tasks',
  'monday',
  'action_recommendations',
  'outreach',
  'strategies_work',
  'program_elements',
  'legiwatch_bills',
  'hearings',
  'grants',
  'contracts_opportunities',
  'federal_awards',
  'directory',
  'district_nexus',
  'institutional_knowledge',
]);

// The seven tool-selectable classes (MERI_DATA_QUERY_CLASSES).
export const DATA_SEARCH_QUERY_CLASSES = Object.freeze([
  'lookup',
  'semantic_recall',
  'comparison',
  'entity_history',
  'change_detection',
  'exhaustive_search',
  'federal_market_analysis',
]);

// The ten-class retrieval vocabulary. This is the type of the RESULT field
// `observability.queryClass`, so the result may legitimately name a class the
// tool cannot select.
export const RETRIEVAL_QUERY_CLASSES = Object.freeze([
  'lookup',
  'semantic_recall',
  'entity_history',
  'relationship_history',
  'temporal_state',
  'change_detection',
  'portfolio_scan',
  'exhaustive_search',
  'comparison',
  'federal_market_analysis',
]);

// Reachable at the retrieval layer but NOT selectable through this tool.
export const DATA_SEARCH_UNSELECTABLE_QUERY_CLASSES = Object.freeze(
  RETRIEVAL_QUERY_CLASSES.filter(name => !DATA_SEARCH_QUERY_CLASSES.includes(name)),
);

export const DATA_SEARCH_DEFAULTS = Object.freeze({ queryClass: 'lookup', pageSize: 50 });

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;
const MAX_QUERY_LENGTH = 4000;
const MAX_CURSOR_LENGTH = 8192;
const MAX_INSTANT_LENGTH = 64;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// The exact raw keys the frozen parser reads. Anything else is ignored by the
// frozen parser and REFUSED here (see DATA_SEARCH_STRICTER_THAN_FROZEN).
const ACCEPTED_INPUT_KEYS = Object.freeze([
  'query',
  'domains',
  'queryClass',
  'pageSize',
  'clientId',
  'memoryItemId',
  'cursors',
  'windowStart',
  'windowEnd',
]);

// Deliberate, documented departures from the frozen boundary. These are
// stricter choices made by this candidate, not claims about frozen behaviour.
export const DATA_SEARCH_STRICTER_THAN_FROZEN = Object.freeze([
  Object.freeze({
    id: 'unknown-input-properties-refused',
    frozen: 'parseCapiroDataSearchInput reads only the keys it knows and silently ignores any other key; the advertised tool schema declares no additionalProperties on the outer object, so the advertised outer object is open.',
    candidate: 'A raw input key outside the nine accepted keys is refused.',
  }),
  Object.freeze({
    id: 'explicit-null-refused-for-optional-selectors',
    frozen: 'clientId and memoryItemId are only accepted as strings; the parser tests `!== undefined`, so an explicit null is refused.',
    candidate: 'The same refusal is preserved, but the NORMALIZED object represents an absent selector as null so the contract shape is closed. Raw null and absent are therefore not interchangeable.',
  }),
  Object.freeze({
    id: 'raw-query-bound-before-trim',
    frozen: 'The 4000-character query bound is applied to the raw string before trimming, so a 4000-character raw value with trailing spaces is accepted.',
    candidate: 'The raw bound is re-applied before trimming (frozen behaviour) AND the normalized, trimmed value is additionally bounded by the schema.',
  }),
  Object.freeze({
    id: 'date-typed-results-modelled-as-json-strings',
    frozen: 'RetrievalRecord.occurredAt/updatedAt, RetrievalSourceCoverage.lastSyncAt and observability.freshnessByDomain are typed as Date in the frozen interface; the frozen source states no wire encoding.',
    candidate: 'They are modelled as JSON date-time strings, which is the ordinary serialization of a Nest response and NOT a frozen-source guarantee.',
  }),
  Object.freeze({
    id: 'declared-result-shapes-are-closed',
    frozen: 'The frozen result shapes are TypeScript interfaces, which are closed only at compile time; the runtime object could carry extra keys.',
    candidate: 'Every result definition sets additionalProperties:false, so a runtime object carrying undeclared keys is refused. This is stricter than the frozen runtime.',
  }),
]);

// Result relations that are deliberately NOT asserted, because the frozen read
// set contains the result TYPES but not the retrieval producer that builds
// them. They are reported as gaps rather than silently enforced or silently
// assumed to hold.
export const RESULT_UNPROVEN_RELATIONS = Object.freeze([
  Object.freeze({
    id: 'records-returned-count',
    relation: 'coverage.recordsReturned === records.length',
    reason: 'The frozen types declare both fields but never relate them. The producer that populates CoverageManifest is outside the frozen read set.',
  }),
  Object.freeze({
    id: 'record-domain-within-requested',
    relation: 'every records[i].domain is one of coverage.requestedDomains',
    reason: 'Plausible but not declared; asserting it would invent a producer invariant.',
  }),
  Object.freeze({
    id: 'complete-implies-all-sources-complete',
    relation: 'coverage.complete === coverage.sources.every(source => source.coverageComplete)',
    reason: 'The frozen comment says returned=0 never implies completeness but states no derivation for the manifest-level flag.',
  }),
  Object.freeze({
    id: 'observability-mirrors-coverage',
    relation: 'observability.requestedDomains/coverageComplete mirror coverage.requestedDomains/complete',
    reason: 'Two separately declared fields with no declared equality.',
  }),
  Object.freeze({
    id: 'cursor-content',
    relation: 'opaque cursor payload contents or authenticity',
    reason: 'Cursor content is opaque and defined nowhere in the frozen read set; this contract bounds only the key domain and the string length.',
  }),
  Object.freeze({
    id: 'freshness-and-authorization',
    relation: 'source freshness, entitlement, tenant access or client authorization',
    reason: 'Coverage and observability report status values; nothing in the frozen read set authenticates a caller or proves freshness. RetrievalCallerContext text is a type, not an enforcement.',
  }),
]);

// Frozen defaults and nullish behaviour, recorded so the advertised grammar and
// the actual parser behaviour are not confused. The advertised tool schema
// (meri-tools.service.ts L966-1003) declares `required: ['query','domains']`,
// `cursors.additionalProperties: false`, no `memoryItemId`, no window ordering
// rule and no `additionalProperties` on the outer object. The parser below is
// what actually runs.
export const DATA_SEARCH_FROZEN_BOUNDARY_NOTES = Object.freeze([
  Object.freeze({
    id: 'nullish-defaults',
    note: 'queryClass and pageSize use `??`, so an explicit null is treated exactly like an omitted value and takes the default (lookup / 50). Absent and null are therefore interchangeable for those two fields only.',
  }),
  Object.freeze({
    id: 'undeclared-memory-item-selector',
    note: 'memoryItemId is accepted by the parser but is not declared in the advertised tool schema properties.',
  }),
  Object.freeze({
    id: 'cursors-advertised-vs-enforced',
    note: 'The advertised schema restricts cursor KEYS to the 18 domains; the parser additionally requires each key to be one of the REQUESTED domains. The candidate keeps the stricter parser rule.',
  }),
  Object.freeze({
    id: 'no-number-coercion',
    note: 'pageSize is refused unless it is a JavaScript number; numeric strings are not coerced (unlike the federal-market tool boundary, which does coerce).',
  }),
  Object.freeze({
    id: 'raw-domain-count-bound',
    note: 'The 18-item bound is applied to the RAW domains array before de-duplication, so duplicates are accepted and then collapsed.',
  }),
]);

export function createDataSearchValidators({ validateShape, schema }) {
  const dataSearchSchemaId = schema.$id;
  const definitions = new Set(Object.keys(schema.$defs));

  // Structural responsibility only: asserts the JSON Schema shape of one private
  // definition and never decides authorization, client scope, source availability
  // or freshness.
  function validateDataSearchShape(definition, value) {
    if (!definitions.has(definition)) fail(`Unknown data-search contract ${definition}`);
    validateShape(definition, value);
    return value;
  }

  // Inputs are inert JSON data: no accessors, hidden keys, exotic prototypes,
  // cycles or non-finite numbers, so nothing at this boundary can trigger
  // coercion or evaluation.
  function assertInertData(value) {
    const seen = new Set();
    const pending = [value];
    while (pending.length) {
      const item = pending.pop();
      if (item === null || ['string', 'boolean'].includes(typeof item)) continue;
      if (typeof item === 'number' && Number.isFinite(item)) continue;
      if (typeof item !== 'object' || seen.has(item)) fail('Data-search input requires finite, acyclic JSON data');
      seen.add(item);
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== (Array.isArray(item) ? Array.prototype : Object.prototype) && prototype !== null) {
        fail('Data-search input requires plain JSON objects');
      }
      for (const name of Reflect.ownKeys(item)) {
        if (Array.isArray(item) && name === 'length') continue;
        const property = Object.getOwnPropertyDescriptor(item, name);
        if (typeof name !== 'string' || !property.enumerable || !('value' in property)) {
          fail('Data-search input accessor or hidden property');
        }
        pending.push(property.value);
      }
    }
  }

  function parseInstant(input, name) {
    if (typeof input !== 'string' || input.length > MAX_INSTANT_LENGTH || !INSTANT_PATTERN.test(input)) {
      fail(`${name} must be an ISO timestamp with a timezone, at most ${MAX_INSTANT_LENGTH} characters`);
    }
    const value = new Date(input);
    if (!Number.isFinite(value.getTime())) fail(`${name} is invalid`);
    return input;
  }

  // Frozen boundary entry point. Mirrors parseCapiroDataSearchInput's defaults,
  // de-duplication and refusals, then materializes an explicit, closed normalized
  // selector. The caller's object is never mutated.
  function normalizeDataSearchInput(rawInput) {
    assertInertData(rawInput);
    if (rawInput === null || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
      fail('Data-search input requires a plain object');
    }
    for (const key of Object.keys(rawInput)) {
      if (!ACCEPTED_INPUT_KEYS.includes(key)) fail(`Unsupported search_capiro_data argument: ${key}`);
    }

    if (typeof rawInput.query !== 'string' || rawInput.query.length > MAX_QUERY_LENGTH) {
      fail(`query must be a string containing at most ${MAX_QUERY_LENGTH} characters`);
    }
    if (!Array.isArray(rawInput.domains) || !rawInput.domains.length ||
        rawInput.domains.length > DATA_SEARCH_DOMAINS.length ||
        rawInput.domains.some(domain => !DATA_SEARCH_DOMAINS.includes(domain))) {
      fail('domains must be a nonempty list of supported retrieval domains');
    }
    const domains = [...new Set(rawInput.domains)];

    const queryClass = rawInput.queryClass ?? DATA_SEARCH_DEFAULTS.queryClass;
    if (!DATA_SEARCH_QUERY_CLASSES.includes(queryClass)) fail('Unsupported retrieval queryClass');

    const pageSize = rawInput.pageSize ?? DATA_SEARCH_DEFAULTS.pageSize;
    if (typeof pageSize !== 'number' || !Number.isInteger(pageSize) ||
        pageSize < MIN_PAGE_SIZE || pageSize > MAX_PAGE_SIZE) {
      fail(`pageSize must be an integer between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}`);
    }

    if (rawInput.clientId !== undefined && (typeof rawInput.clientId !== 'string' || !UUID_PATTERN.test(rawInput.clientId))) {
      fail('clientId must be a client UUID');
    }
    if (rawInput.memoryItemId !== undefined &&
        (typeof rawInput.memoryItemId !== 'string' || !UUID_PATTERN.test(rawInput.memoryItemId) ||
         domains.length !== 1 || domains[0] !== 'institutional_knowledge' ||
         !['lookup', 'semantic_recall'].includes(String(queryClass)))) {
      fail('memoryItemId requires a canonical UUID and an institutional_knowledge lookup');
    }

    let cursors = {};
    if (rawInput.cursors !== undefined) {
      if (!rawInput.cursors || typeof rawInput.cursors !== 'object' || Array.isArray(rawInput.cursors)) {
        fail('cursors must map requested domains to their returned cursor');
      }
      for (const [domain, cursor] of Object.entries(rawInput.cursors)) {
        if (!domains.includes(domain) || typeof cursor !== 'string' || !cursor || cursor.length > MAX_CURSOR_LENGTH) {
          fail(`Each cursor must belong to a requested domain and contain at most ${MAX_CURSOR_LENGTH} characters`);
        }
        cursors[domain] = cursor;
      }
    }

    const windowStart = rawInput.windowStart === undefined ? null : parseInstant(rawInput.windowStart, 'windowStart');
    const windowEnd = rawInput.windowEnd === undefined ? null : parseInstant(rawInput.windowEnd, 'windowEnd');
    if ((windowStart === null) !== (windowEnd === null)) {
      fail('Supply both windowStart and windowEnd with end after start');
    }
    if (windowStart !== null && new Date(windowEnd) <= new Date(windowStart)) {
      fail('Supply both windowStart and windowEnd with end after start');
    }

    const query = rawInput.query.trim();
    const normalized = {
      query,
      domains,
      queryClass,
      pageSize,
      clientId: rawInput.clientId === undefined ? null : rawInput.clientId,
      memoryItemId: rawInput.memoryItemId === undefined ? null : rawInput.memoryItemId,
      cursors,
      window: windowStart === null ? null : { startInclusive: windowStart, endExclusive: windowEnd },
    };
    validateDataSearchShape('DataSearchInput', normalized);

    const freezeCursors = Object.freeze({ ...cursors });
    return Object.freeze({
      operationId: DATA_SEARCH_OPERATION_ID,
      // clientId is a SELECTOR. searchToolData (frozen meri-context-plane.service.ts
      // L93-96) recomputes the server security envelope and refuses a clientId
      // outside it, so a valid selector value grants nothing by itself.
      clientScope: Object.freeze({ clientId: normalized.clientId, authoritative: false, resolution: 'server_resolved' }),
      input: Object.freeze({
        ...normalized,
        domains: Object.freeze([...domains]),
        cursors: freezeCursors,
        window: normalized.window === null ? null : Object.freeze({ ...normalized.window }),
      }),
      // Derived from the frozen searchCapiroData request construction (L92-103):
      // an empty query is omitted, memoryItemId/clientId pass through only when
      // explicitly supplied, and requireComplete is true exactly for
      // exhaustive_search.
      retrievalRequest: Object.freeze({
        query,
        queryOmitted: query === '',
        queryClass,
        requestedDomains: Object.freeze([...domains]),
        pageSize,
        cursors: Object.keys(freezeCursors).length === 0 ? null : freezeCursors,
        windowStart,
        windowEnd,
        memoryItemId: normalized.memoryItemId,
        clientId: normalized.clientId,
        requireComplete: queryClass === 'exhaustive_search',
      }),
    });
  }

  // Structural validation of one search_capiro_data tool result. It asserts the
  // declared RetrievalResponse-derived envelope and the tool envelope only. The
  // relations in RESULT_UNPROVEN_RELATIONS are deliberately not asserted.
  function assertDataSearchResult(value) {
    validateDataSearchShape('SearchCapiroDataResult', value);
    const keys = Object.keys(value).sort();
    if (keys.join(',') !== 'coverage,observability,records,tool') {
      fail(`search_capiro_data result must carry exactly the tool envelope; found ${keys.join(',')}`);
    }
    if (value.tool !== DATA_SEARCH_OPERATION_ID) fail('search_capiro_data result tool mismatch');
    return value;
  }

  return Object.freeze({
    DATA_SEARCH_OPERATION_ID, DATA_SEARCH_DOMAINS, DATA_SEARCH_QUERY_CLASSES,
    RETRIEVAL_QUERY_CLASSES, DATA_SEARCH_UNSELECTABLE_QUERY_CLASSES, DATA_SEARCH_DEFAULTS,
    DATA_SEARCH_STRICTER_THAN_FROZEN, RESULT_UNPROVEN_RELATIONS, DATA_SEARCH_FROZEN_BOUNDARY_NOTES,
    dataSearchSchemaId, validateDataSearchShape, normalizeDataSearchInput, assertDataSearchResult,
  });
}
