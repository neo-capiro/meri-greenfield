/** Private frozen read projections; no producer, policy, source or watch owner.
 * The canonical loader owns Ajv, and the operation resolver owns inert JSON
 * admission/snapshots/hashing. This factory validates domain relationships only.
 */
import { types } from 'node:util';

const fail = message => { throw new Error(message); };
export const BUSINESS_DEVELOPMENT_OPERATION_IDS = Object.freeze([
  'get_business_development_context',
  'get_business_development_evidence',
  'get_business_development_recent_changes',
]);

// The producer requires this selector even though its advertised schema did not
// mark it required. No trimming, case conversion or model-supplied scope exists.
function inputData(value) {
  if (!value || typeof value !== 'object' || types.isProxy(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('Business-development input must be inert JSON');
  const fields = Object.getOwnPropertyDescriptors(value), result = {};
  for (const name of Reflect.ownKeys(fields)) {
    const field = fields[name];
    if (typeof name !== 'string' || !field.enumerable || !Object.hasOwn(field, 'value') ||
        !['conversationId', 'limit'].includes(name)) fail('Unknown or non-data business-development input field');
    if (typeof field.value !== 'string' && !(typeof field.value === 'number' && Number.isFinite(field.value)))
      fail('Business-development input refuses coercion and non-JSON values');
    result[name] = field.value;
  }
  return result;
}

export function createBusinessDevelopmentValidators({ validateShape, schema }) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Business-development validator configuration');
  const definitions = new Set(Object.keys(schema.$defs));
  // Projection tool constants are the operation/definition owner, not a second
  // handler catalog. Unknown aliases and prototype property names are refused.
  const outputs = new Map(Object.entries(schema.$defs)
    .filter(([, value]) => BUSINESS_DEVELOPMENT_OPERATION_IDS.includes(value.properties?.tool?.const))
    .map(([name, value]) => [value.properties.tool.const, name]));
  if (outputs.size !== 3) fail('Business-development schema operation mismatch');
  const descriptive = new Set(schema.$defs.BizDevDescriptiveFactKey.enum);
  const excerpt = '…[truncated]';

  function businessDevelopmentOutputDefinition(id) {
    if (!outputs.has(id)) fail('Unknown business-development operation');
    return outputs.get(id);
  }
  function businessDevelopmentInputDefinition(id) {
    return businessDevelopmentOutputDefinition(id).replace(/Output$/, 'Input');
  }
  function countWindow(total, returned, truncated, rows, cap) {
    if (returned !== rows.length || returned !== Math.min(total, cap) || truncated !== (total > returned))
      fail('Business-development count/window mismatch');
  }
  function instant(value) {
    if (!Number.isFinite(Date.parse(value))) fail('Business-development generated instant is not comparable');
  }
  function assertFacts(row) {
    const omitted = row.factsOmitted ?? [], truncated = row.factsTruncated ?? [];
    if (Object.hasOwn(row, 'factsOmittedNote') !== (omitted.length > 0)) fail('Evidence omission note mismatch');
    for (const key of omitted) {
      if (descriptive.has(key) || Object.hasOwn(row.facts, key)) fail('Omitted evidence fact still present or descriptive');
    }
    for (const [key, value] of Object.entries(row.facts)) {
      if (!descriptive.has(key)) {
        if (JSON.stringify(value).length > 600) fail('Oversized exact evidence fact must be omitted');
        continue;
      }
      const values = Array.isArray(value) ? value : [value];
      if (Array.isArray(value) && value.length > 12) fail('Descriptive fact array exceeds producer cap');
      for (const item of values) if (typeof item === 'string' && item.length > 600) {
        if (item.length !== 600 + excerpt.length || !item.endsWith(excerpt) || !truncated.includes(key))
          fail('Descriptive excerpt requires exact bound and marker');
      }
    }
    for (const key of truncated) {
      if (!Object.hasOwn(row.facts, key)) fail('Truncated evidence fact is absent');
      const value = row.facts[key], values = Array.isArray(value) ? value : [value];
      if (!(Array.isArray(value) && value.length === 12) && !values.some(item =>
        typeof item === 'string' && item.length === 600 + excerpt.length && item.endsWith(excerpt)))
        fail('Truncation marker does not describe an excerpt or capped array');
    }
    if (row.id !== (row.recordId ?? row.originalSourceId ?? '') || row.url !== row.locator)
      fail('Evidence citation alias substitution');
  }
  function consistency(definition, value) {
    if (!outputs.has(value?.tool) || outputs.get(value.tool) !== definition) return;
    instant(value.generatedAt);
    if (definition === 'BusinessDevelopmentContextOutput') {
      countWindow(value.history.total, value.history.returned, value.history.truncated, value.history.entries, 20);
      let last = Infinity;
      for (const row of value.history.entries) {
        instant(row.at);
        const stamp = Date.parse(row.at);
        if (stamp > last) fail('Context history is not newest first');
        last = stamp;
      }
    } else if (definition === 'BusinessDevelopmentEvidenceOutput') {
      const { evidence, coverage } = value;
      countWindow(evidence.total, evidence.returned, evidence.truncated, value.data, 24);
      const sections = value.sectionStates.map(row => row.section);
      if (new Set(sections).size !== sections.length) fail('Duplicate evidence section state');
      for (const row of value.data) assertFacts(row);
      const partial = evidence.truncated || value.data.some(row => row.factsTruncated || row.factsOmitted) ||
        value.sectionStates.some(row => !['available', 'empty_in_queried_scope'].includes(row.status));
      if (coverage.complete !== (evidence.total <= 24) || coverage.partial !== partial)
        fail('Evidence coverage flags do not match the producer projection');
      if ((value.identityBasis === 'unresolved_prospect') !== (value.canonicalEntityId === null && value.canonicalName === null) ||
          (value.canonicalEntityId === null) !== (value.canonicalName === null)) fail('Dossier identity basis mismatch');
    } else {
      if (value.alerts.returned !== value.alerts.items.length || value.alerts.returned > value.alerts.limit)
        fail('Recent changes returned/limit mismatch');
      // No total, continuation token, bid/win assertion or completeness is
      // inferred from this first-page projection or from the unread count.
    }
  }
  function validateBusinessDevelopmentShape(definition, value) {
    if (!definitions.has(definition)) fail('Unknown business-development definition');
    validateShape(definition, value);
    consistency(definition, value);
    return value;
  }
  function normalizeBusinessDevelopmentInput(id, request) {
    const definition = businessDevelopmentInputDefinition(id), input = inputData(request);
    validateBusinessDevelopmentShape(definition, input);
    if (id === 'get_business_development_recent_changes' && !Object.hasOwn(input, 'limit')) input.limit = 10;
    return Object.freeze({ input: Object.freeze(input), metadata: Object.freeze({
      conversationId: input.conversationId, authoritative: false, sourceConnected: false,
      producerQualified: false, absenceEvidence: false,
      scope: 'server-resolved-prospect-conversation', providerCalls: 'unqualified',
    }) });
  }
  function assertBusinessDevelopmentOutput(id, value, request) {
    const { input } = normalizeBusinessDevelopmentInput(id, request);
    validateBusinessDevelopmentShape(businessDevelopmentOutputDefinition(id), value);
    if (id === 'get_business_development_recent_changes' && value.alerts.limit !== input.limit)
      fail('Recent changes request limit substitution');
    return value;
  }
  return Object.freeze({ businessDevelopmentSchemaId: schema.$id, BUSINESS_DEVELOPMENT_OPERATION_IDS,
    businessDevelopmentInputDefinition, businessDevelopmentOutputDefinition,
    normalizeBusinessDevelopmentInput, validateBusinessDevelopmentShape, assertBusinessDevelopmentOutput });
}
