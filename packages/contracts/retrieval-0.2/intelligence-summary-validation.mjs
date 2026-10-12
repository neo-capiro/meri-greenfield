// Opaque stored-read prose only. No query, synthesis, provider or authority owner.
import {snapshotOperationData} from './operation-contracts.mjs';
const fail = message => { throw new Error(message); };
export const INTELLIGENCE_SUMMARY_OPERATION_IDS = Object.freeze(['query_intelligence']);
export function createIntelligenceSummaryValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Intelligence summary configuration');
  const definitions = new Set(Object.keys(schema.$defs));
  function intelligenceSummaryInputDefinition(id) {
    if (!INTELLIGENCE_SUMMARY_OPERATION_IDS.includes(id)) fail('Unknown intelligence summary operation');
    return 'IntelligenceSummaryInput';
  }
  function intelligenceSummaryOutputDefinition(id) {
    intelligenceSummaryInputDefinition(id);
    return 'IntelligenceSummaryOutput';
  }
  function validateIntelligenceSummaryShape(definition, value) {
    if (!definitions.has(definition)) fail('Unknown intelligence summary definition');
    const data = snapshotOperationData(value);
    validateShape(definition, data);
    if (definition === 'IntelligenceSummaryOutput') {
      const at = Date.parse(data.generatedAt);
      if (!Number.isFinite(at) || new Date(at).toISOString() !== data.generatedAt)
        fail('Intelligence summary requires a canonical JSON date');
    }
    return data;
  }
  function normalizeIntelligenceSummaryInput(id, request, options = {}) {
    const input = validateIntelligenceSummaryShape(intelligenceSummaryInputDefinition(id), request);
    validateIntelligenceSummaryShape('IntelligenceSummaryContext', options);
    const selected = typeof input.clientName === 'string' ? input.clientName.trim().slice(0, 200) : null;
    delete input.clientName;
    if (selected) input.clientName = selected;
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({
      sourceConnected: false, producerQualified: false, absenceEvidence: false,
      scope: 'opaque-stored-intelligence-summary',
    })});
  }
  function assertIntelligenceSummaryOutput(id, value, request, options = {}) {
    normalizeIntelligenceSummaryInput(id, request, options);
    // Failed or omitted source branches and count failures are not distinguishable
    // from this prose. No availability, completeness or absence claim is inferred.
    return validateIntelligenceSummaryShape(intelligenceSummaryOutputDefinition(id), value);
  }
  return Object.freeze({intelligenceSummarySchemaId: schema.$id, INTELLIGENCE_SUMMARY_OPERATION_IDS,
    intelligenceSummaryInputDefinition, intelligenceSummaryOutputDefinition,
    normalizeIntelligenceSummaryInput, validateIntelligenceSummaryShape, assertIntelligenceSummaryOutput});
}
