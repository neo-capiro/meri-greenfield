/** Stored-public-report contracts, without a source client or current authority. */
import {snapshotOperationData} from './operation-contracts.mjs';
const fail = message => { throw new Error(message); };
export const PUBLIC_REPORT_OPERATION_IDS = Object.freeze([
  'search_cbo_cost_estimates', 'search_gao_reports', 'search_crs_reports',
]);
function instant(value, dateOnly = false) {
  const stamp = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString() !== value ||
      dateOnly && !value.endsWith('T00:00:00.000Z'))
    fail('Public report dates require canonical JSON instants, with UTC midnight for stored dates');
  return stamp;
}
function excerpt(value, cap) {
  // Bounds and normalized whitespace describe the existing projection. The
  // source is absent here, so an ellipsis cannot prove what text was omitted.
  if (value.length > cap || value !== value.replace(/\s+/g, ' ').trim())
    fail('Public report excerpt is not a bounded normalized UTF-16 projection');
}
function absentEstimateNote(label) {
  return label === null
    ? 'No CBO cost estimates matched. Say so explicitly — do not estimate or guess a score.'
    : `No CBO cost estimate on record for ${label}. Say so explicitly — do not estimate or guess a score.`;
}
export function createPublicReportsValidators({validateShape,schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Public-report validator configuration');
  const definitions = new Set(Object.keys(schema.$defs));
  const outputs = new Map(Object.entries(schema.$defs)
    .filter(([, value]) => PUBLIC_REPORT_OPERATION_IDS.includes(value.properties?.tool?.const))
    .map(([name, value]) => [value.properties.tool.const, name]));
  if (outputs.size !== 3) fail('Public-report schema operation mismatch');
  function publicReportsOutputDefinition(id) {
    if (!outputs.has(id)) fail('Unknown public-report operation');
    return outputs.get(id);
  }
  function publicReportsInputDefinition(id) { return publicReportsOutputDefinition(id).replace(/Output$/, 'Input'); }
  function validatePublicReportsShape(definition, value) {
    if (!definitions.has(definition)) fail('Unknown public-report definition');
    const data = snapshotOperationData(value);
    validateShape(definition, data);
    if (outputs.get(data?.tool) !== definition) return value;
    instant(data.generatedAt);
    const cbo = data.tool === 'search_cbo_cost_estimates', gao = data.tool === 'search_gao_reports';
    const rows = cbo ? data.estimates : data.data;
    if (cbo && (data.estimatesFound !== rows.length || Object.hasOwn(data, 'note') !== (rows.length === 0)))
      fail('CBO returned-window count and no-estimate note mismatch');
    const ids = new Set();
    let latest = Infinity;
    for (const row of rows) {
      if (ids.has(row.id)) fail('Duplicate stored public-report identity');
      ids.add(row.id);
      const date = cbo ? row.pubDate : gao ? row.publishDate : row.date;
      if (date !== null) {
        const at = instant(date, !cbo);
        if (at > latest) fail('Public report non-null dates are not newest first');
        latest = at;
      }
      if (!cbo) { excerpt(row.title, 240); excerpt(row.summary, 400); }
    }
    // GAO/CRS totals are separate concurrent reads. Neither total >= returned
    // nor total == returned is guaranteed. No snapshot/completeness is inferred.
    return value;
  }
  function normalizePublicReportsInput(id, request) {
    const definition = publicReportsInputDefinition(id), input = snapshotOperationData(request);
    validatePublicReportsShape(definition, input);
    const cbo = id === 'search_cbo_cost_estimates';
    const strings = cbo ? [['billId',40],['query',200]] : [['query',240],...(id === 'search_gao_reports' ? [['reportType',60]] : [])];
    for (const [key, cap] of strings) {
      if (!Object.hasOwn(input, key)) continue;
      const selected = input[key].trim().slice(0, cap);
      if (selected) input[key] = selected;
      else delete input[key];
    }
    const label = cbo ? input.billId ?? null : null;
    if (cbo && input.billId !== undefined) input.billId = input.billId.toLowerCase().trim();
    if (cbo && input.congress === 0) delete input.congress;
    input.limit ??= schema.$defs[definition].properties.limit.default;
    return Object.freeze({input:Object.freeze(input),metadata:Object.freeze({
      authoritative:false,sourceConnected:false,producerQualified:false,absenceEvidence:false,
      sourceScope:'stored-public-reports',countScope:cbo?'returned-window':'separate-local-count',
      ...(cbo ? {cboBillLabel:label} : {}),...(id === 'search_crs_reports' ? {activeOnly:true} : {}),
    })});
  }
  function assertPublicReportsOutput(id, value, request) {
    const {input,metadata} = normalizePublicReportsInput(id, request);
    const data = snapshotOperationData(value);
    validatePublicReportsShape(publicReportsOutputDefinition(id), data);
    const cbo = id === 'search_cbo_cost_estimates', rows = cbo ? data.estimates : data.data;
    if (rows.length > input.limit) fail('Public-report request limit substitution');
    if (cbo) {
      if (rows.length === 0 && data.note !== absentEstimateNote(metadata.cboBillLabel))
        fail('CBO no-estimate disclosure must match the original request label');
      for (const row of rows) {
        if (input.billId !== undefined && row.billId !== input.billId ||
            input.congress !== undefined && row.congress !== input.congress)
          fail('CBO exact filter substitution');
      }
    } else if (id === 'search_gao_reports' && input.reportType !== undefined && rows.some(row => row.reportType !== input.reportType))
      fail('GAO exact report-type filter substitution');
    // Keyword matching, active-only CRS selection and current source permissions
    // belong to the qualified source adapter, not a second retrieval algorithm.
    return value;
  }
  return Object.freeze({publicReportsSchemaId:schema.$id,PUBLIC_REPORT_OPERATION_IDS,
    publicReportsInputDefinition,publicReportsOutputDefinition,normalizePublicReportsInput,
    validatePublicReportsShape,assertPublicReportsOutput});
}
