// Stored docket wire relationships; no query client or service clock inference.
import {snapshotOperationData} from './operation-contracts.mjs';
const fail = message => { throw new Error(message); };
export const REGULATORY_DOCKETS_OPERATION_IDS = Object.freeze(['query_regulatory_dockets']);
const dateKeys = Object.freeze(['postedDate', 'commentStartDate', 'commentEndDate', 'lastModified', 'syncedAt']);
function instant(value) {
  const at = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(at) || new Date(at).toISOString() !== value)
    fail('Regulatory dockets require canonical comparable JSON dates');
  return at;
}
export function createRegulatoryDocketsValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Regulatory docket configuration');
  const definitions = new Set(Object.keys(schema.$defs));
  function regulatoryDocketsInputDefinition(id) {
    if (!REGULATORY_DOCKETS_OPERATION_IDS.includes(id)) fail('Unknown regulatory docket operation');
    return 'RegulatoryDocketsQueryInput';
  }
  function regulatoryDocketsOutputDefinition(id) {
    regulatoryDocketsInputDefinition(id);
    return 'RegulatoryDocketsQueryOutput';
  }
  function validateRegulatoryDocketsShape(definition, value) {
    if (!definitions.has(definition)) fail('Unknown regulatory docket definition');
    const data = snapshotOperationData(value);
    validateShape(definition, data);
    if (definition !== 'RegulatoryDocketsQueryOutput') return value;
    instant(data.generatedAt);
    const upcoming = Object.hasOwn(data, 'windowDays');
    const ids = new Set(), documents = new Set();
    let previous = upcoming ? -Infinity : Infinity, firstEnd;
    if (upcoming && (data.total > 50 || data.results.length > data.total))
      fail('Upcoming docket total is a bounded service window');
    for (const row of data.results) {
      if (ids.has(row.id) || documents.has(row.documentId)) fail('Duplicate regulatory docket identity');
      ids.add(row.id); documents.add(row.documentId);
      for (const key of dateKeys) if (row[key] !== null) instant(row[key]);
      if (upcoming) {
        if (row.withdrawn || row.commentEndDate === null) fail('Invalid upcoming docket projection');
        const end = instant(row.commentEndDate);
        if (end < previous) fail('Upcoming docket end dates must ascend');
        firstEnd ??= end;
        if (end - firstEnd > data.windowDays * 86_400_000)
          fail('Upcoming docket date span exceeds the declared elapsed window');
        previous = end;
      } else if (row.postedDate !== null) {
        const posted = instant(row.postedDate);
        if (posted > previous) fail('Ordinary docket nonnull posted dates must descend');
        previous = posted;
      }
    }
    // The service query clock is not projected. These necessary relationships
    // cannot prove current eligibility or membership in an actual source window.
    // Ordinary null placement and separate count consistency remain adapter work.
    return value;
  }
  function normalizeRegulatoryDocketsInput(id, request) {
    const input = snapshotOperationData(request);
    validateRegulatoryDocketsShape(regulatoryDocketsInputDefinition(id), input);
    input.upcomingOnly = input.upcomingOnly === true;
    input.limit ??= 20;
    if (input.upcomingOnly) input.days ??= 30;
    for (const [key, cap] of [['agencyId', 40], ['documentType', 80]]) {
      const selected = typeof input[key] === 'string' ? input[key].trim().slice(0, cap) : null;
      delete input[key];
      if (selected) input[key] = selected;
    }
    // Supplied branch-irrelevant selectors remain bound in the normalized input;
    // their presence does not make the source apply them to the other branch.
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({
      authoritative: false, sourceConnected: false, producerQualified: false, absenceEvidence: false,
      currentWindowQualified: false, sourceScope: 'stored-regulatory-dockets',
      countScope: input.upcomingOnly ? 'bounded-service-window-before-limit' : 'separate-local-count',
    })});
  }
  function assertRegulatoryDocketsOutput(id, value, request) {
    const {input} = normalizeRegulatoryDocketsInput(id, request);
    const data = snapshotOperationData(value);
    validateRegulatoryDocketsShape(regulatoryDocketsOutputDefinition(id), data);
    if (Object.hasOwn(data, 'windowDays') !== input.upcomingOnly)
      fail('Regulatory docket branch substitution');
    if (input.upcomingOnly) {
      if (data.windowDays !== input.days || data.results.length !== Math.min(data.total, input.limit))
        fail('Upcoming docket window or wrapper limit substitution');
    } else {
      if (data.results.length > input.limit) fail('Ordinary docket limit substitution');
      for (const key of ['agencyId', 'documentType'])
        if (input[key] !== undefined && data.results.some(row => row[key] !== input[key]))
          fail('Ordinary docket filter substitution');
    }
    return value;
  }
  return Object.freeze({regulatoryDocketsSchemaId: schema.$id, REGULATORY_DOCKETS_OPERATION_IDS,
    regulatoryDocketsInputDefinition, regulatoryDocketsOutputDefinition,
    normalizeRegulatoryDocketsInput, validateRegulatoryDocketsShape, assertRegulatoryDocketsOutput});
}
