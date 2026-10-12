// Private, unregistered contract candidate for the canonical selected intent
// `search_capiro_data`. All fixtures are literal synthetic DATA. No handler,
// identity, tenant, source connection, provider or client scope is exercised:
// passing any assertion here never grants authorization or proves freshness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  DATA_SEARCH_OPERATION_ID,
  DATA_SEARCH_DOMAINS,
  DATA_SEARCH_QUERY_CLASSES,
  DATA_SEARCH_UNSELECTABLE_QUERY_CLASSES,
  RETRIEVAL_QUERY_CLASSES,
  DATA_SEARCH_DEFAULTS,
  DATA_SEARCH_STRICTER_THAN_FROZEN,
  DATA_SEARCH_FROZEN_BOUNDARY_NOTES,
  RESULT_UNPROVEN_RELATIONS,
  dataSearchSchemaId,
  validateDataSearchShape,
  normalizeDataSearchInput,
  assertDataSearchResult,
  validateShape,
} from '../retrieval-0.2/validate.mjs';

const schemaPath = new URL('../retrieval-0.2/data-search.schema.json', import.meta.url);
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const modulePath = fileURLToPath(new URL('../retrieval-0.2/data-search-validation.mjs', import.meta.url));
const canonicalModulePath = new URL('../retrieval-0.2/validate.mjs', import.meta.url);
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));

// Literal frozen vocabularies, transcribed independently of the module so a
// drift in either place fails the suite.
const FROZEN_DOMAINS = [
  'clients', 'contacts', 'mail', 'meetings', 'tasks', 'monday', 'action_recommendations',
  'outreach', 'strategies_work', 'program_elements', 'legiwatch_bills', 'hearings', 'grants',
  'contracts_opportunities', 'federal_awards', 'directory', 'district_nexus', 'institutional_knowledge',
];
const FROZEN_SELECTABLE_QUERY_CLASSES = [
  'lookup', 'semantic_recall', 'comparison', 'entity_history', 'change_detection',
  'exhaustive_search', 'federal_market_analysis',
];
const FROZEN_RETRIEVAL_QUERY_CLASSES = [
  'lookup', 'semantic_recall', 'entity_history', 'relationship_history', 'temporal_state',
  'change_detection', 'portfolio_scan', 'exhaustive_search', 'comparison', 'federal_market_analysis',
];

const CLIENT_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const MEMORY_UUID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const OTHER_UUID = '0b1a2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

const coverageSource = overrides => ({
  domain: 'mail',
  sourceStatus: 'healthy',
  returned: 1,
  recordsEvaluated: 3,
  requestedEntityCount: 1,
  searchedEntityCount: 1,
  pagesRead: 2,
  hasMore: false,
  truncated: false,
  paginationComplete: true,
  coverageComplete: true,
  stopReason: 'complete',
  ...overrides,
});

// One structurally valid result envelope, derived from the frozen
// RetrievalResponse / CoverageManifest / RetrievalObservability declarations.
const validResult = () => ({
  tool: 'search_capiro_data',
  records: [
    {
      domain: 'mail',
      recordId: 'synthetic-mail-1',
      entityRef: { type: 'client', id: 'synthetic-client-1', metadata: { source: 'synthetic' } },
      canonicalEntityIds: ['synthetic-client-1'],
      occurredAt: '2026-01-02T03:04:05Z',
      updatedAt: null,
      payload: { subject: 'synthetic subject', nested: { list: [1, 'two', false, null] } },
      provenance: { connector: 'synthetic' },
      retrievalSignals: { lexicalExactness: 0.9, temporalValidity: 1 },
    },
  ],
  observability: {
    queryClass: 'lookup',
    requestedDomains: ['mail'],
    queriedDatasets: ['mail'],
    requestedEntityCount: 1,
    queriedEntityCount: 1,
    pagesByDomain: { mail: 2 },
    sourceHealth: { mail: 'healthy' },
    freshnessByDomain: { mail: '2026-01-01T00:00:00Z' },
    coverageComplete: true,
    stopReason: 'complete',
  },
  coverage: {
    requestedDomains: ['mail'],
    searchedDomains: ['mail'],
    requestedEntityCount: 1,
    searchedEntityCount: 1,
    recordsEvaluated: 3,
    recordsReturned: 1,
    paginationComplete: true,
    unavailableSources: [],
    sources: [coverageSource({})],
    complete: true,
    stopReason: 'complete',
  },
});

test('pins the schema id and the frozen domain and query-class vocabularies literally', () => {
  assert.equal(dataSearchSchemaId, 'urn:meri:retrieval:data-search:0.2.0');
  assert.equal(schema.$id, dataSearchSchemaId);
  assert.deepEqual(DATA_SEARCH_DOMAINS, FROZEN_DOMAINS);
  assert.equal(DATA_SEARCH_DOMAINS.length, 18);
  assert.deepEqual(schema.$defs.DataSearchDomain.enum, FROZEN_DOMAINS);
  assert.deepEqual(DATA_SEARCH_QUERY_CLASSES, FROZEN_SELECTABLE_QUERY_CLASSES);
  assert.equal(DATA_SEARCH_QUERY_CLASSES.length, 7);
  assert.deepEqual(schema.$defs.DataSearchQueryClass.enum, FROZEN_SELECTABLE_QUERY_CLASSES);
  // The retrieval vocabulary is the ten-class set and is what the RESULT field
  // observability.queryClass is typed as.
  assert.deepEqual(RETRIEVAL_QUERY_CLASSES, FROZEN_RETRIEVAL_QUERY_CLASSES);
  assert.deepEqual(schema.$defs.RetrievalQueryClass.enum, FROZEN_RETRIEVAL_QUERY_CLASSES);
  // The three classes reachable at the retrieval layer but NOT selectable here.
  assert.deepEqual(DATA_SEARCH_UNSELECTABLE_QUERY_CLASSES, ['relationship_history', 'temporal_state', 'portfolio_scan']);
  for (const name of DATA_SEARCH_UNSELECTABLE_QUERY_CLASSES) {
    assert.ok(!DATA_SEARCH_QUERY_CLASSES.includes(name));
    assert.ok(RETRIEVAL_QUERY_CLASSES.includes(name));
  }
  assert.equal(DATA_SEARCH_OPERATION_ID, 'search_capiro_data');
  assert.deepEqual(DATA_SEARCH_DEFAULTS, { queryClass: 'lookup', pageSize: 50 });
});

test('normalizes a minimal selector with the frozen defaults and omits an empty query', () => {
  const normalized = normalizeDataSearchInput({ query: '  bridge work  ', domains: ['mail', 'tasks', 'mail'] });
  assert.equal(normalized.operationId, 'search_capiro_data');
  assert.equal(normalized.input.query, 'bridge work');
  assert.deepEqual(normalized.input.domains, ['mail', 'tasks']);
  assert.equal(normalized.input.queryClass, 'lookup');
  assert.equal(normalized.input.pageSize, 50);
  assert.equal(normalized.input.clientId, null);
  assert.equal(normalized.input.memoryItemId, null);
  assert.deepEqual(normalized.input.cursors, {});
  assert.equal(normalized.input.window, null);
  assert.equal(normalized.retrievalRequest.queryOmitted, false);
  assert.equal(normalized.retrievalRequest.requireComplete, false);
  assert.equal(normalized.retrievalRequest.cursors, null);
  assert.ok(Object.isFrozen(normalized) && Object.isFrozen(normalized.input) && Object.isFrozen(normalized.retrievalRequest));

  const blank = normalizeDataSearchInput({ query: '   ', domains: ['mail'] });
  assert.equal(blank.input.query, '');
  assert.equal(blank.retrievalRequest.queryOmitted, true);
  // The normalized object is the only shape the private schema accepts.
  assert.throws(() => validateDataSearchShape('DataSearchInput', { query: 'x', domains: ['mail'] }), /DataSearchInput/);
  assert.equal(validateDataSearchShape('DataSearchInput', normalized.input), normalized.input);
});

test('normalizes a full selector and derives the frozen retrieval request selectors', () => {
  const normalized = normalizeDataSearchInput({
    query: 'exhaustive portfolio read',
    domains: ['strategies_work', 'action_recommendations'],
    queryClass: 'exhaustive_search',
    pageSize: 100,
    clientId: CLIENT_UUID,
    cursors: { strategies_work: 'opaque-cursor-1' },
    windowStart: '2026-01-01T00:00:00Z',
    windowEnd: '2026-02-01T00:00:00+02:00',
  });
  assert.equal(normalized.input.pageSize, 100);
  assert.equal(normalized.input.queryClass, 'exhaustive_search');
  assert.deepEqual(normalized.input.window, { startInclusive: '2026-01-01T00:00:00Z', endExclusive: '2026-02-01T00:00:00+02:00' });
  // requireComplete is true exactly for exhaustive_search.
  assert.equal(normalized.retrievalRequest.requireComplete, true);
  assert.equal(normalizeDataSearchInput({ query: 'q', domains: ['mail'], queryClass: 'lookup' }).retrievalRequest.requireComplete, false);
  assert.equal(normalizeDataSearchInput({ query: 'q', domains: ['mail'], queryClass: 'semantic_recall' }).retrievalRequest.requireComplete, false);
  // Cursors, window and clientId pass through verbatim; nothing is invented.
  assert.deepEqual(normalized.retrievalRequest.cursors, { strategies_work: 'opaque-cursor-1' });
  assert.equal(normalized.retrievalRequest.windowStart, '2026-01-01T00:00:00Z');
  assert.equal(normalized.retrievalRequest.windowEnd, '2026-02-01T00:00:00+02:00');
  assert.equal(normalized.retrievalRequest.clientId, CLIENT_UUID);
  assert.deepEqual(normalized.retrievalRequest.requestedDomains, ['strategies_work', 'action_recommendations']);
});

test('keeps clientId a non-authoritative selector', () => {
  const normalized = normalizeDataSearchInput({ query: 'q', domains: ['clients'], clientId: CLIENT_UUID.toUpperCase() });
  assert.equal(normalized.clientScope.clientId, CLIENT_UUID.toUpperCase());
  assert.equal(normalized.clientScope.authoritative, false);
  assert.equal(normalized.clientScope.resolution, 'server_resolved');
  // A selector value that passes the UUID grammar still carries no authority.
  assert.equal(normalized.retrievalRequest.clientId, CLIENT_UUID.toUpperCase());
  const absent = normalizeDataSearchInput({ query: 'q', domains: ['clients'] });
  assert.equal(absent.clientScope.clientId, null);
  assert.equal(absent.retrievalRequest.clientId, null);
});

test('enforces the conditional memoryItemId rule', () => {
  const accepted = normalizeDataSearchInput({
    query: 'approved memory', domains: ['institutional_knowledge'], queryClass: 'semantic_recall', memoryItemId: MEMORY_UUID,
  });
  assert.equal(accepted.input.memoryItemId, MEMORY_UUID);
  assert.equal(accepted.retrievalRequest.memoryItemId, MEMORY_UUID);
  assert.ok(normalizeDataSearchInput({ query: 'q', domains: ['institutional_knowledge'], queryClass: 'lookup', memoryItemId: MEMORY_UUID }));
  // The frozen parser de-duplicates domains before applying this conditional.
  assert.deepEqual(normalizeDataSearchInput({ query: 'q',
    domains: ['institutional_knowledge', 'institutional_knowledge'], queryClass: 'lookup',
    memoryItemId: MEMORY_UUID }).input.domains, ['institutional_knowledge']);

  const refused = [
    ['non-institutional domain', { query: 'q', domains: ['mail'], queryClass: 'lookup', memoryItemId: MEMORY_UUID }],
    ['two domains', { query: 'q', domains: ['institutional_knowledge', 'mail'], queryClass: 'lookup', memoryItemId: MEMORY_UUID }],
    ['exhaustive query class', { query: 'q', domains: ['institutional_knowledge'], queryClass: 'exhaustive_search', memoryItemId: MEMORY_UUID }],
    ['comparison query class', { query: 'q', domains: ['institutional_knowledge'], queryClass: 'comparison', memoryItemId: MEMORY_UUID }],
    ['non-uuid memoryItemId', { query: 'q', domains: ['institutional_knowledge'], queryClass: 'lookup', memoryItemId: 'not-a-uuid' }],
    ['explicit null memoryItemId', { query: 'q', domains: ['institutional_knowledge'], queryClass: 'lookup', memoryItemId: null }],
  ];
  for (const [label, input] of refused) {
    assert.throws(() => normalizeDataSearchInput(input), /memoryItemId requires a canonical UUID and an institutional_knowledge lookup/, label);
  }
  // The schema itself carries the same conditional rule, independently of the module.
  const conditional = schema.$defs.DataSearchInput.allOf[0];
  assert.deepEqual(conditional.then.properties.domains.items, { const: 'institutional_knowledge' });
  assert.deepEqual(conditional.then.properties.queryClass.enum, ['lookup', 'semantic_recall']);
  assert.throws(
    () => validateDataSearchShape('DataSearchInput', {
      query: 'q', domains: ['mail'], queryClass: 'lookup', pageSize: 50, clientId: null,
      memoryItemId: MEMORY_UUID, cursors: {}, window: null,
    }),
    /DataSearchInput/,
  );
});

test('scopes opaque cursors to requested domains and bounds their length', () => {
  const ok = normalizeDataSearchInput({ query: 'q', domains: ['mail', 'tasks'], cursors: { mail: 'c1', tasks: 'c2' } });
  assert.deepEqual(ok.input.cursors, { mail: 'c1', tasks: 'c2' });
  assert.deepEqual(ok.retrievalRequest.cursors, { mail: 'c1', tasks: 'c2' });
  // An empty cursor map is accepted by the frozen parser and stays empty here.
  assert.deepEqual(normalizeDataSearchInput({ query: 'q', domains: ['mail'], cursors: {} }).retrievalRequest.cursors, null);

  const boundary = 'x'.repeat(8192);
  assert.equal(normalizeDataSearchInput({ query: 'q', domains: ['mail'], cursors: { mail: boundary } }).input.cursors.mail.length, 8192);

  const refused = [
    ['cursor for a non-requested domain', { query: 'q', domains: ['mail'], cursors: { tasks: 'c' } }],
    ['empty cursor string', { query: 'q', domains: ['mail'], cursors: { mail: '' } }],
    ['oversized cursor', { query: 'q', domains: ['mail'], cursors: { mail: 'x'.repeat(8193) } }],
    ['non-string cursor', { query: 'q', domains: ['mail'], cursors: { mail: 7 } }],
    ['cursor map as an array', { query: 'q', domains: ['mail'], cursors: ['c'] }],
    ['cursor map as null', { query: 'q', domains: ['mail'], cursors: null }],
    ['unknown cursor domain key', { query: 'q', domains: ['mail'], cursors: { unknown_domain: 'c' } }],
    ['prototype-named cursor key', JSON.parse('{"query":"q","domains":["mail"],"cursors":{"__proto__":"c"}}')],
  ];
  for (const [label, input] of refused) {
    assert.throws(() => normalizeDataSearchInput(input), /cursor/i, label);
  }
});

test('bounds the domain list and de-duplicates in first-seen order', () => {
  assert.deepEqual(normalizeDataSearchInput({ query: 'q', domains: ['tasks', 'mail', 'tasks'] }).input.domains, ['tasks', 'mail']);
  // The frozen bound applies to the RAW array before de-duplication.
  const eighteen = Array.from({ length: 18 }, () => 'mail');
  assert.deepEqual(normalizeDataSearchInput({ query: 'q', domains: eighteen }).input.domains, ['mail']);
  const refused = [
    ['empty list', { query: 'q', domains: [] }],
    ['nineteen raw entries', { query: 'q', domains: [...FROZEN_DOMAINS, 'mail'] }],
    ['unsupported domain', { query: 'q', domains: ['unknown_domain'] }],
    ['non-string domain', { query: 'q', domains: [7] }],
    ['domains not an array', { query: 'q', domains: 'mail' }],
    ['domains null', { query: 'q', domains: null }],
  ];
  for (const [label, input] of refused) {
    assert.throws(() => normalizeDataSearchInput(input), /domains must be a nonempty list of supported retrieval domains/, label);
  }
});

test('bounds the query, queryClass, pageSize and window selectors', () => {
  assert.equal(normalizeDataSearchInput({ query: 'x'.repeat(4000), domains: ['mail'] }).input.query.length, 4000);
  assert.throws(() => normalizeDataSearchInput({ query: 'x'.repeat(4001), domains: ['mail'] }), /at most 4000 characters/);
  assert.throws(() => normalizeDataSearchInput({ query: 7, domains: ['mail'] }), /at most 4000 characters/);
  assert.throws(() => normalizeDataSearchInput({ domains: ['mail'] }), /at most 4000 characters/);

  assert.throws(() => normalizeDataSearchInput({ query: 'q', domains: ['mail'], queryClass: 'portfolio_scan' }), /Unsupported retrieval queryClass/);
  assert.throws(() => normalizeDataSearchInput({ query: 'q', domains: ['mail'], queryClass: 'relationship_history' }), /Unsupported retrieval queryClass/);
  assert.throws(() => normalizeDataSearchInput({ query: 'q', domains: ['mail'], queryClass: 'temporal_state' }), /Unsupported retrieval queryClass/);

  // pageSize refuses numeric strings, non-integers and out-of-range values.
  for (const bad of ['50', 0, 101, 1.5, true, []]) {
    assert.throws(() => normalizeDataSearchInput({ query: 'q', domains: ['mail'], pageSize: bad }), /pageSize must be an integer between 1 and 100/, String(bad));
  }
  assert.equal(normalizeDataSearchInput({ query: 'q', domains: ['mail'], pageSize: 1 }).input.pageSize, 1);
  // Frozen nullish default: null behaves exactly like an omitted value.
  assert.equal(normalizeDataSearchInput({ query: 'q', domains: ['mail'], pageSize: null }).input.pageSize, 50);
  assert.equal(normalizeDataSearchInput({ query: 'q', domains: ['mail'], queryClass: null }).input.queryClass, 'lookup');

  const oneSided = [
    ['start only', { query: 'q', domains: ['mail'], windowStart: '2026-01-01T00:00:00Z' }],
    ['end only', { query: 'q', domains: ['mail'], windowEnd: '2026-01-01T00:00:00Z' }],
    ['end equals start', { query: 'q', domains: ['mail'], windowStart: '2026-01-01T00:00:00Z', windowEnd: '2026-01-01T00:00:00Z' }],
    ['end before start', { query: 'q', domains: ['mail'], windowStart: '2026-02-01T00:00:00Z', windowEnd: '2026-01-01T00:00:00Z' }],
    ['no timezone', { query: 'q', domains: ['mail'], windowStart: '2026-01-01T00:00:00', windowEnd: '2026-02-01T00:00:00' }],
    ['oversized instant', { query: 'q', domains: ['mail'], windowStart: `2026-01-01T00:00:00Z${' '.repeat(50)}`, windowEnd: '2026-02-01T00:00:00Z' }],
    ['non-string instant', { query: 'q', domains: ['mail'], windowStart: 7, windowEnd: '2026-02-01T00:00:00Z' }],
  ];
  for (const [label, input] of oneSided) {
    assert.throws(() => normalizeDataSearchInput(input), /ISO timestamp|Supply both windowStart and windowEnd/, label);
  }
});

test('refuses unknown input properties and non-inert input data', () => {
  // Deliberately STRICTER than the frozen parser, which silently ignores extras.
  assert.throws(() => normalizeDataSearchInput({ query: 'q', domains: ['mail'], extra: 1 }), /Unsupported search_capiro_data argument: extra/);
  assert.throws(() => normalizeDataSearchInput({ query: 'q', domains: ['mail'], domains2: ['mail'] }), /Unsupported search_capiro_data argument: domains2/);
  const stricter = DATA_SEARCH_STRICTER_THAN_FROZEN.map(entry => entry.id);
  assert.ok(stricter.includes('unknown-input-properties-refused'));
  assert.ok(stricter.includes('date-typed-results-modelled-as-json-strings'));
  assert.ok(stricter.includes('declared-result-shapes-are-closed'));
  assert.ok(DATA_SEARCH_FROZEN_BOUNDARY_NOTES.some(entry => entry.id === 'nullish-defaults'));
  assert.ok(DATA_SEARCH_FROZEN_BOUNDARY_NOTES.some(entry => entry.id === 'undeclared-memory-item-selector'));

  class Exotic { constructor() { this.query = 'q'; this.domains = ['mail']; } }
  const withAccessor = { query: 'q', domains: ['mail'] };
  Object.defineProperty(withAccessor, 'pageSize', { get: () => 50, enumerable: true });
  for (const [label, input] of [
    ['null input', null],
    ['array input', ['q']],
    ['string input', 'query'],
    ['class instance', new Exotic()],
    ['accessor property', withAccessor],
    ['non-finite number', { query: 'q', domains: ['mail'], pageSize: Number.NaN }],
  ]) {
    assert.throws(() => normalizeDataSearchInput(input), /Data-search input requires|accessor or hidden property|pageSize/, label);
  }
  const cyclic = { query: 'q', domains: ['mail'] };
  cyclic.self = cyclic;
  assert.throws(() => normalizeDataSearchInput(cyclic), /finite, acyclic JSON data/);
});

test('validates the frozen result envelope and the tool envelope', () => {
  const result = validResult();
  assert.equal(assertDataSearchResult(result), result);
  assert.equal(validateDataSearchShape('SearchCapiroDataResult', result), result);

  // A result may legitimately report a query class the tool cannot select.
  const unselectable = validResult();
  unselectable.observability.queryClass = 'portfolio_scan';
  assert.equal(assertDataSearchResult(unselectable), unselectable);

  // Nullable and partial coverage members stay legal.
  const partial = validResult();
  partial.records[0].updatedAt = null;
  partial.records[0].occurredAt = null;
  partial.observability.freshnessByDomain = { mail: null };
  partial.observability.sourceHealth = { mail: 'unauthorized' };
  partial.coverage.unavailableSources = ['mail'];
  partial.coverage.sources = [coverageSource({ sourceStatus: 'unauthorized', coverageComplete: false, lastSyncAt: undefined })];
  partial.coverage.complete = false;
  assert.equal(assertDataSearchResult(partial), partial);

  const adversarial = [
    ['wrong tool id', r => { r.tool = 'search_federal_awards'; }],
    ['missing coverage', r => { delete r.coverage; }],
    ['missing observability', r => { delete r.observability; }],
    ['missing records', r => { delete r.records; }],
    ['extra envelope key', r => { r.status = 'complete'; }],
    ['invented per-domain record field', r => { r.records[0].subject = 'invented'; }],
    ['unknown record domain', r => { r.records[0].domain = 'unknown_domain'; }],
    ['record payload not an object', r => { r.records[0].payload = 'text'; }],
    ['unknown source status', r => { r.coverage.sources[0].sourceStatus = 'fine'; }],
    ['coverage source missing stopReason', r => { delete r.coverage.sources[0].stopReason; }],
    ['observability pages key outside the domain vocabulary', r => { r.observability.pagesByDomain = { unknown_domain: 1 }; }],
    ['reranking status outside the enum', r => { r.observability.reranking = { status: 'maybe', provider: null, model: null, candidateCount: 0, rerankedCount: 0, durationMs: 0, scores: [] }; }],
    ['scoring algorithm other than rrf', r => { r.observability.scoring = { status: 'applied', algorithm: 'bm25', rrfK: 60, candidateCount: 0, scoredCount: 0, applied: true, signalsUsed: [], scores: [] }; }],
    ['scoring signal outside the enum', r => { r.observability.scoring = { status: 'applied', algorithm: 'rrf', rrfK: 60, candidateCount: 1, scoredCount: 1, applied: true, signalsUsed: ['made_up'], scores: [] }; }],
    ['non-finite record signal', r => { r.records[0].retrievalSignals = { lexicalExactness: Number.POSITIVE_INFINITY }; }],
    ['record entityRef missing id', r => { r.records[0].entityRef = { type: 'client' }; }],
  ];
  for (const [label, mutate] of adversarial) {
    const broken = validResult();
    mutate(broken);
    assert.throws(() => assertDataSearchResult(broken), /SearchCapiroDataResult|tool envelope|tool mismatch/, label);
  }
});

test('discloses the result relations that are deliberately not asserted', () => {
  const ids = RESULT_UNPROVEN_RELATIONS.map(entry => entry.id);
  for (const expected of ['records-returned-count', 'record-domain-within-requested', 'complete-implies-all-sources-complete', 'observability-mirrors-coverage', 'cursor-content', 'freshness-and-authorization']) {
    assert.ok(ids.includes(expected), expected);
  }
  for (const entry of RESULT_UNPROVEN_RELATIONS) assert.ok(entry.reason.length > 0);
  // The unproven relations are genuinely NOT enforced: a result whose counts
  // disagree with the record list still validates structurally.
  const inconsistent = validResult();
  inconsistent.coverage.recordsReturned = 99;
  assert.equal(assertDataSearchResult(inconsistent), inconsistent);
});

test('declares every schema reference locally and closes every result shape', () => {
  const refs = [];
  const walk = node => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref') refs.push(value);
      else walk(value);
    }
  };
  walk(schema);
  assert.ok(refs.length > 0);
  for (const ref of refs) {
    assert.ok(ref.startsWith('#/$defs/'), `non-local reference ${ref}`);
    assert.ok(Object.hasOwn(schema.$defs, ref.slice('#/$defs/'.length)), `unresolved reference ${ref}`);
  }
  // Closed declared shapes: every definition with declared properties is closed.
  const closed = Object.entries(schema.$defs).filter(([, def]) => def.properties !== undefined);
  assert.ok(closed.length >= 12);
  for (const [name, def] of closed) assert.equal(def.additionalProperties, false, `${name} must be closed`);
  assert.equal(schema.$defs.SearchCapiroDataResult.additionalProperties, false);
  assert.deepEqual(schema.$defs.SearchCapiroDataResult.required, ['tool', 'records', 'observability', 'coverage']);
  assert.equal(schema.$defs.SearchCapiroDataResult.properties.tool.const, 'search_capiro_data');
  // Required member sets mirror the frozen interface fields exactly.
  assert.deepEqual(schema.$defs.CoverageManifest.required, [
    'requestedDomains', 'searchedDomains', 'requestedEntityCount', 'searchedEntityCount', 'recordsEvaluated',
    'recordsReturned', 'paginationComplete', 'unavailableSources', 'sources', 'complete', 'stopReason',
  ]);
  assert.deepEqual(schema.$defs.RetrievalRecord.required, ['domain', 'recordId', 'payload']);
  assert.deepEqual(schema.$defs.RetrievalObservability.required, [
    'queryClass', 'requestedDomains', 'queriedDatasets', 'requestedEntityCount', 'queriedEntityCount',
    'pagesByDomain', 'sourceHealth', 'freshnessByDomain', 'coverageComplete', 'stopReason',
  ]);
  // No second catalog, alias table or operation registry is introduced.
  assert.equal(Object.hasOwn(schema.$defs, 'Catalog'), false);
  assert.equal(Object.hasOwn(schema.$defs, 'OperationDescriptor'), false);
  // Private catalog registration is pending; it adds no live handler or public export.
  const catalog = JSON.parse(readFileSync(new URL('../retrieval-0.2/catalog.json', import.meta.url), 'utf8'));
  const selected = catalog.originals.find(entry => entry.id === 'search_capiro_data');
  assert.equal(selected?.disposition, 'selected');
  assert.equal(selected?.state, 'mapped');
  assert.deepEqual(selected.replacement, { id: 'search_capiro_data', version: '0.2.0' });
  const descriptor = catalog.operations.find(row => row.operation.id === 'search_capiro_data');
  assert.equal(descriptor.handler, null); assert.equal(descriptor.availability, 'unimplemented');
  assert.equal(descriptor.qualification, 'pending');
  assert.equal(descriptor.inputSchema.id, `${schema.$id}#/$defs/DataSearchInput`);
  assert.equal(descriptor.outputSchema.id, `${schema.$id}#/$defs/SearchCapiroDataResult`);
  assert.equal(JSON.stringify(catalog).includes('data-search.schema.json'), false);
});

test('imports and runs with no filesystem, network or process side effect', () => {
  const source = readFileSync(modulePath, 'utf8');
  for (const forbidden of ['writeFile', 'appendFile', 'createWriteStream', 'child_process', 'setTimeout(', 'setInterval(', 'globalThis.fetch', 'process.env', 'eval(', 'new Function(', 'require(']) {
    assert.equal(source.includes(forbidden), false, `module source must not contain ${forbidden}`);
  }
  assert.equal(source.includes('readFileSync'), false, 'the factory must not load its own schema');
  assert.equal(source.includes('new Ajv'), false, 'the factory must not compile a second validator');
  assert.ok(source.includes('export function createDataSearchValidators'));
  const importSpecifiers = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map(match => match[1]).sort();
  assert.deepEqual(importSpecifiers, []);

  // Dynamic check under the Node permission model: filesystem writes are denied
  // by the runtime, and live prototype/global guards record any socket or fetch
  // attempt. `--allow-net` does not exist in this Node build, so network denial
  // is not claimed from the permission model; the guards are the evidence.
  const dependencyRoot = realpathSync(fileURLToPath(new URL('../../../node_modules', import.meta.url)));
  const childScript = `
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
const effects = [];
const realConnect = net.Socket.prototype.connect;
const realFetch = globalThis.fetch;
net.Socket.prototype.connect = function () { effects.push('net.Socket.prototype.connect'); throw new Error('blocked'); };
globalThis.fetch = function () { effects.push('fetch'); throw new Error('blocked'); };
let guardLive = false;
try { net.Socket.prototype.connect(); } catch { guardLive = true; }
effects.length = 0;
const envBefore = JSON.stringify(process.env);
const factory = await import(${JSON.stringify(new URL('../retrieval-0.2/data-search-validation.mjs', import.meta.url).href)});
const mod = await import(${JSON.stringify(canonicalModulePath.href)});
const normalized = mod.normalizeDataSearchInput({ query: 'probe', domains: ['mail'] });
let writeDenied = false;
try { fs.writeFileSync(path.join(${JSON.stringify(repositoryRoot)}, 'data-search-probe.tmp'), 'x'); }
catch (error) { writeDenied = error.code === 'ERR_ACCESS_DENIED'; }
net.Socket.prototype.connect = realConnect;
globalThis.fetch = realFetch;
console.log(JSON.stringify({
  effects,
  guardLive,
  writeDenied,
  schemaId: mod.dataSearchSchemaId,
  domain: normalized.input.domains[0],
  queryClass: normalized.input.queryClass,
  envStable: envBefore === JSON.stringify(process.env),
  factoryPresent: typeof factory.createDataSearchValidators === 'function',
}));
`;
  const child = spawnSync(process.execPath, [
    '--permission',
    `--allow-fs-read=${repositoryRoot}`,
    `--allow-fs-read=${dependencyRoot}`,
    '--input-type=module',
    '-e',
    childScript,
  ], { encoding: 'utf8' });
  assert.equal(child.status, 0, `child failed: ${child.stderr}`);
  const report = JSON.parse(child.stdout.trim().split('\n').pop());
  assert.deepEqual(report.effects, []);
  assert.equal(report.guardLive, true, 'the guard must be proven live');
  assert.equal(report.writeDenied, true, 'the permission model must deny the probe write');
  assert.equal(report.schemaId, 'urn:meri:retrieval:data-search:0.2.0');
  assert.equal(report.domain, 'mail');
  assert.equal(report.queryClass, 'lookup');
  assert.equal(report.envStable, true);
  assert.equal(report.factoryPresent, true);
  assert.equal(child.stderr.includes('ERR_ACCESS_DENIED'), false);
});

test('canonical structural ownership preserves the closed data-search definition boundary', () => {
  const input = normalizeDataSearchInput({ query: 'canonical probe', domains: ['mail'] }).input;
  assert.equal(validateShape('DataSearchInput', input), input);
  assert.equal(validateDataSearchShape('DataSearchInput', input), input);
  assert.equal(validateShape('SearchCapiroDataResult', validResult()).tool, 'search_capiro_data');
  assert.throws(() => validateShape('DataSearchInput', { query: 'q', domains: ['mail'] }), /DataSearchInput/);
  // The global owner knows this federal definition; the data-search family must
  // refuse it before delegation instead of accepting every canonical contract.
  const federalInput = {};
  assert.equal(validateShape('SearchFederalSubawardsInput', federalInput), federalInput);
  for (const definition of ['SearchFederalSubawardsInput', 'MailListInput', 'MissingDefinition', 'constructor', '__proto__']) {
    assert.throws(() => validateDataSearchShape(definition, federalInput), /Unknown data-search contract/);
  }
});

test('canonical composition retains selector relations beyond generic structural shape checks', () => {
  const input = normalizeDataSearchInput({ query: 'q', domains: ['mail'] }).input;
  const foreignCursor = { ...input, cursors: { tasks: 'opaque-task-cursor' } };
  assert.equal(validateShape('DataSearchInput', foreignCursor), foreignCursor);
  assert.throws(() => normalizeDataSearchInput({ query: 'q', domains: ['mail'], cursors: { tasks: 'opaque-task-cursor' } }), /cursor/);
  const reversedWindow = {
    ...input, window: { startInclusive: '2026-02-01T00:00:00Z', endExclusive: '2026-01-01T00:00:00Z' },
  };
  assert.equal(validateShape('DataSearchInput', reversedWindow), reversedWindow);
  assert.throws(() => normalizeDataSearchInput({
    query: 'q', domains: ['mail'], windowStart: reversedWindow.window.startInclusive,
    windowEnd: reversedWindow.window.endExclusive,
  }), /Supply both windowStart and windowEnd with end after start/);
  const inconsistent = validResult();
  inconsistent.coverage.recordsReturned = 99;
  assert.equal(assertDataSearchResult(inconsistent), inconsistent, 'composition must not invent an unproven count relation');
});

test('raw query and domain bounds still precede normalization without mutating callers', () => {
  assert.throws(() => normalizeDataSearchInput({ query: 'x' + ' '.repeat(4000), domains: ['mail'] }), /at most 4000 characters/);
  assert.equal(normalizeDataSearchInput({ query: 'x' + ' '.repeat(3999), domains: ['mail'] }).input.query, 'x');
  const emojiBoundary = '\u{1f600}'.repeat(2000);
  assert.equal(emojiBoundary.length, 4000);
  assert.equal(normalizeDataSearchInput({ query: emojiBoundary, domains: ['mail'] }).input.query, emojiBoundary);
  assert.throws(() => normalizeDataSearchInput({ query: emojiBoundary + '\u{1f600}', domains: ['mail'] }), /at most 4000 characters/);
  assert.throws(() => normalizeDataSearchInput({ query: 'q', domains: Array(19).fill('mail') }), /domains must be a nonempty list/);
  const raw = {
    query: '  q  ', domains: ['tasks', 'mail', 'tasks'], cursors: { mail: 'cursor' },
    windowStart: '2026-01-01T00:00:00Z', windowEnd: '2026-02-01T00:00:00Z',
  };
  const before = structuredClone(raw);
  const normalized = normalizeDataSearchInput(raw);
  assert.deepEqual(raw, before);
  assert.notEqual(normalized.input.domains, raw.domains);
  assert.notEqual(normalized.input.cursors, raw.cursors);
  assert.deepEqual(normalized.input.domains, ['tasks', 'mail']);
  assert.ok(Object.isFrozen(normalized.input.domains));
  assert.ok(Object.isFrozen(normalized.input.cursors));
  assert.ok(Object.isFrozen(normalized.input.window));
});
