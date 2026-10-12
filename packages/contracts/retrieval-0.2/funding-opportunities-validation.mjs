/** Private funding projections. Importing this module performs no source I/O. */
import { snapshotOperationData } from './operation-contracts.mjs';
import { fundingInstant, assertFundingEnvelope, assertFundingFacts, assertFundingSearch,
  assertFundingClientContext, assertFundingLandscape } from './funding-envelope-validation.mjs';
import { assertFundingRequirements } from './funding-requirements-validation.mjs';
const fail = message => { throw new Error(message); };
export const FUNDING_OPPORTUNITY_OPERATION_IDS = Object.freeze([
  'search_funding_opportunities', 'get_funding_opportunity_requirements',
  'get_funding_opportunity', 'get_opportunity_client_context', 'get_opportunity_government_landscape',
]);
export function createFundingOpportunitiesValidators({ validateShape, schema }) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Funding validator configuration');
  const definitions = new Set(Object.keys(schema.$defs));
  const outputs = new Map(Object.entries(schema.$defs)
    .filter(([, value]) => FUNDING_OPPORTUNITY_OPERATION_IDS.includes(value.properties?.tool?.const))
    .map(([name, value]) => [value.properties.tool.const, name]));
  if (outputs.size !== 5) fail('Funding schema operation mismatch');
  function fundingOpportunitiesOutputDefinition(id) {
    if (!outputs.has(id)) fail('Unknown funding operation');
    return outputs.get(id);
  }
  function fundingOpportunitiesInputDefinition(id) { return fundingOpportunitiesOutputDefinition(id).replace(/Output$/, 'Input'); }
  function validateFundingOpportunitiesShape(definition, value) {
    if (!definitions.has(definition)) fail('Unknown funding definition');
    const data = snapshotOperationData(value);
    validateShape(definition, data);
    if (outputs.get(data?.tool) === definition) assertFundingEnvelope(data);
    return value;
  }
  function normalizeFundingOpportunitiesInput(id, request, options) {
    const input = snapshotOperationData(request), context = snapshotOperationData(options);
    if (!context || Array.isArray(context) || typeof context !== 'object' ||
        Object.keys(context).length !== 1 || !Object.hasOwn(context, 'asOf')) fail('Explicit trusted funding asOf required');
    fundingInstant(context.asOf);
    validateFundingOpportunitiesShape(fundingOpportunitiesInputDefinition(id), input);
    if (id === 'search_funding_opportunities') {
      if ((input.query?.length ?? 0) > 500) fail('Funding query exceeds 500 UTF-16 characters');
      input.query = (input.query ?? '').trim();
      input.page = Math.min(input.page ?? 1, 10000);
      input.pageSize ??= 5;
      input.activeState ??= 'active';
    } else if (id === 'get_funding_opportunity_requirements') {
      input.offset ??= 0; input.limit ??= 10;
    } else if (id === 'get_funding_opportunity') {
      input.summaryOffset ??= 0; input.summaryLimit ??= 1200;
    }
    return Object.freeze({ input: Object.freeze(input), metadata: Object.freeze({
      asOf: context.asOf, authoritative: false, sourceConnected: false,
      producerQualified: false, absenceEvidence: false,
    }) });
  }
  function assertFundingOpportunitiesOutput(id, value, request, options) {
    const { input, metadata } = normalizeFundingOpportunitiesInput(id, request, options);
    const data = snapshotOperationData(value);
    validateFundingOpportunitiesShape(fundingOpportunitiesOutputDefinition(id), data);
    if (data.asOf !== metadata.asOf) fail('Funding result asOf substitution');
    if (data.state !== 'available') return value;
    const source = input.source;
    if (source !== undefined && !['grants_gov', 'sam_gov'].includes(source)) fail('Unsupported funding source cannot release available data');
    if (id === 'get_funding_opportunity') {
      if (data.truncated || data.data.ref.source !== source || data.data.ref.sourceRecordId !== input.sourceRecordId ||
          data.data.clientId !== input.clientId) fail('Funding opportunity identity substitution');
      assertFundingFacts(data.data, data.asOf, input);
    } else if (id === 'search_funding_opportunities') assertFundingSearch(data.data, data, input);
    else if (id === 'get_funding_opportunity_requirements') assertFundingRequirements(data.data, data, input);
    else if (id === 'get_opportunity_client_context') assertFundingClientContext(data.data, data, input);
    else {
      if (source !== 'sam_gov') fail('Government landscape is SAM-only');
      // The composer validates the UUID after trimming before any source port.
      // Invalid/unsupported request refusal envelopes above remain admissible.
      validateFundingOpportunitiesShape('FundingSamRecordId', input.sourceRecordId.trim());
      assertFundingLandscape(data.data, data, schema.$defs.FundingLandscapeSource.enum);
    }
    return value;
  }
  return Object.freeze({ fundingOpportunitiesSchemaId: schema.$id, FUNDING_OPPORTUNITY_OPERATION_IDS,
    fundingOpportunitiesInputDefinition, fundingOpportunitiesOutputDefinition,
    normalizeFundingOpportunitiesInput, validateFundingOpportunitiesShape, assertFundingOpportunitiesOutput });
}
