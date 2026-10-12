// Stored article excerpts and a separate observed count; no feed or source client.
import {snapshotOperationData} from './operation-contracts.mjs';
const fail = message => { throw new Error(message); };
export const STORED_INTELLIGENCE_OPERATION_IDS = Object.freeze(['search_intel_articles']);
function instant(value) {
  const at = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(at) || new Date(at).toISOString() !== value)
    fail('Stored intelligence requires canonical comparable JSON dates');
  return at;
}
function excerpt(value, cap) {
  if (value.length > cap || value !== value.replace(/\s+/g, ' ').trim())
    fail('Stored intelligence excerpt is not a normalized UTF-16 projection');
}
export function createStoredIntelligenceValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Stored intelligence configuration');
  const definitions = new Set(Object.keys(schema.$defs));
  function storedIntelligenceInputDefinition(id) {
    if (!STORED_INTELLIGENCE_OPERATION_IDS.includes(id)) fail('Unknown stored intelligence operation');
    return 'StoredIntelligenceSearchInput';
  }
  function storedIntelligenceOutputDefinition(id) {
    storedIntelligenceInputDefinition(id);
    return 'StoredIntelligenceSearchOutput';
  }
  function validateStoredIntelligenceShape(definition, value) {
    if (!definitions.has(definition)) fail('Unknown stored intelligence definition');
    const data = snapshotOperationData(value);
    validateShape(definition, data);
    if (definition !== 'StoredIntelligenceSearchOutput') return value;
    instant(data.generatedAt);
    const ids = new Set();
    let latest = Infinity;
    for (const row of data.data) {
      if (ids.has(row.id)) fail('Duplicate stored article identity');
      ids.add(row.id);
      const at = instant(row.publishedAt);
      if (at > latest) fail('Stored articles must be newest first');
      latest = at;
      excerpt(row.title, 240);
      excerpt(row.summary, 400);
    }
    // Count and rows come from separate reads, so no total/length equality or
    // ordering constraint proves complete coverage or a terminal absence.
    return value;
  }
  function normalizeStoredIntelligenceInput(id, request) {
    const input = snapshotOperationData(request);
    validateStoredIntelligenceShape(storedIntelligenceInputDefinition(id), input);
    for (const [key, cap] of [['query', 240], ['source', 60]]) {
      const selected = typeof input[key] === 'string' ? input[key].trim().slice(0, cap) : null;
      delete input[key];
      if (selected) input[key] = selected;
    }
    input.limit ??= 20;
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({
      authoritative: false, sourceConnected: false, producerQualified: false, absenceEvidence: false,
      sourceScope: 'stored-intelligence', countScope: 'separate-local-count',
    })});
  }
  function assertStoredIntelligenceOutput(id, value, request) {
    const {input} = normalizeStoredIntelligenceInput(id, request);
    const data = snapshotOperationData(value);
    validateStoredIntelligenceShape(storedIntelligenceOutputDefinition(id), data);
    if (data.data.length > input.limit) fail('Stored article request limit substitution');
    if (input.source !== undefined && data.data.some(row => row.source !== input.source))
      fail('Stored article exact source substitution');
    // Full title/summary matching may lie outside the returned excerpts;
    // category/topic matching, collation and source authority remain adapter work.
    return value;
  }
  return Object.freeze({storedIntelligenceSchemaId: schema.$id, STORED_INTELLIGENCE_OPERATION_IDS,
    storedIntelligenceInputDefinition, storedIntelligenceOutputDefinition,
    normalizeStoredIntelligenceInput, validateStoredIntelligenceShape, assertStoredIntelligenceOutput});
}
