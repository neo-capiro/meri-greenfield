// Stored SAM projection relationships only; no source client, clock or query.
import {snapshotOperationData} from './operation-contracts.mjs';
import {fundingInstant, assertFundingBrief} from './funding-envelope-validation.mjs';
const fail = message => { throw new Error(message); };
export const SAM_OPPORTUNITIES_OPERATION_IDS = Object.freeze(['search_sam_opportunities']);
const HOUR = 3_600_000;
function healthReason(source, at) {
  if (!source || source.recordCount === null) return 'source_freshness_unavailable';
  if (source.lastSyncedAt === null) return 'all_federal_source_never_synced';
  if (!source.lastSyncedAt || Number.isNaN(Date.parse(source.lastSyncedAt))) return 'source_freshness_unknown';
  if (source.state !== 'current') return 'latest_source_sync_incomplete';
  return (at - Date.parse(source.lastSyncedAt)) / HOUR >= 48 ? 'source_sync_stale' : null;
}
export function createSamOpportunitiesValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('SAM configuration');
  const definitions = new Set(Object.keys(schema.$defs));
  function samOpportunitiesInputDefinition(id) {
    if (!SAM_OPPORTUNITIES_OPERATION_IDS.includes(id)) fail('Unknown SAM operation');
    return 'SamOpportunitiesInput';
  }
  function samOpportunitiesOutputDefinition(id) {
    samOpportunitiesInputDefinition(id); return 'SamOpportunitiesOutput';
  }
  function validateSamOpportunitiesShape(definition, value) {
    if (!definitions.has(definition)) fail('Unknown SAM definition');
    const data = snapshotOperationData(value); validateShape(definition, data);
    if (definition === 'SamOpportunitiesContext') {
      for (const key of ['asOf', 'sourceStatusAsOf', 'sourceHealthAsOf']) fundingInstant(data[key]);
    }
    if (definition === 'SamOpportunitiesInput') {
      for (const [key, cap] of [['query', 240], ['naics', 12]])
        if (data[key] !== null && (data[key].length > cap || data[key] !== data[key].trim())) fail('SAM effective selector mismatch');
    }
    if (definition === 'SamOpportunitiesOutput') {
      fundingInstant(data.generatedAt);
      const ids = new Set(), notices = new Set(); let previous = Infinity;
      for (const row of data.results) {
        if (ids.has(row.id) || notices.has(row.noticeId)) fail('Duplicate SAM identity');
        ids.add(row.id); notices.add(row.noticeId);
        if (row.postedDate !== null) {
          const at = fundingInstant(row.postedDate);
          if (at > previous) fail('SAM posted date ordering'); previous = at;
        }
        if (row.responseDeadline !== null) fundingInstant(row.responseDeadline);
        if (row.description.length > 300 || row.description !== row.description.replace(/\s+/g, ' ').trim())
          fail('SAM description is not a normalized UTF-16 excerpt');
      }
    }
    return data;
  }
  function normalizeSamOpportunitiesInput(id, request, options) {
    samOpportunitiesInputDefinition(id);
    const raw = validateSamOpportunitiesShape('SamOpportunitiesRequest', request);
    validateSamOpportunitiesShape('SamOpportunitiesContext', options);
    const selected = (key, cap) => typeof raw[key] === 'string' ? raw[key].trim().slice(0, cap).trim() || null : null;
    const number = typeof raw.limit === 'number' ? raw.limit : typeof raw.limit === 'string' ? Number(raw.limit) : NaN;
    const input = {query: selected('query', 240), naics: selected('naics', 12), includeInactive: raw.includeInactive ?? false,
      limit: Number.isFinite(number) ? Math.max(1, Math.min(50, Math.trunc(number))) : 20};
    validateSamOpportunitiesShape('SamOpportunitiesInput', input);
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({sourceConnected: false,
      producerQualified: false, absenceEvidence: false, scope: 'stored-sam-opportunities', countScope: 'separate-local-count'})});
  }
  function assertSamOpportunitiesOutput(id, value, request, options) {
    const {input} = normalizeSamOpportunitiesInput(id, request, options);
    const context = validateSamOpportunitiesShape('SamOpportunitiesContext', options);
    const page = validateSamOpportunitiesShape(samOpportunitiesOutputDefinition(id), value);
    if (page.generatedAt !== context.asOf || page.results.length > input.limit) fail('SAM request or final clock substitution');
    for (const source of page.sourceFreshness) {
      // Raw health timestamps retain the legacy Date.parse interpretation, including
      // invalid text. They are observations, never canonical clock authority.
      const at = source.lastSyncedAt ? Date.parse(source.lastSyncedAt) : NaN;
      const hours = Number.isFinite(at) ? Math.max(0, (fundingInstant(context.sourceHealthAsOf) - at) / HOUR) : null;
      if (source.countsUnavailable !== (source.recordCount === null) || source.neverSynced !== (source.state === 'never_synced') ||
          source.lastRunStatus !== source.state || source.lastRunDegraded !== (source.state !== 'current') || source.hoursSinceLastSuccess !== hours)
        fail('SAM health observation fields disagree');
    }
    const reason = healthReason(page.sourceFreshness[0], fundingInstant(context.sourceStatusAsOf));
    const status = reason === null ? 'healthy' : ['source_freshness_unavailable', 'source_freshness_unknown'].includes(reason) ? 'unknown' : 'degraded';
    if (page.sourceReason !== reason || page.sourceStatus !== status || page.notes.length !== (reason ? 2 : 1)) fail('SAM source status precedence mismatch');
    for (const row of page.results) {
      if (!input.includeInactive && !row.active || input.naics !== null && (row.naicsCode === null || !row.naicsCode.startsWith(input.naics)))
        fail('SAM active or NAICS filter mismatch');
      const enforced = context.evidenceAccuracyMode === 'enforce';
      if (Object.hasOwn(row, 'deadline') !== enforced) fail('SAM trusted deadline mode mismatch');
      if (!enforced) continue;
      assertFundingBrief(row, page.generatedAt);
      if (row.responseDeadline === null) {
        if (row.deadline.basis !== 'unknown') fail('SAM null stored deadline mismatch');
      } else if (row.deadline.basis !== 'explicit_datetime' || row.deadline.at !== row.responseDeadline || row.deadline.dateOnly !== row.responseDeadline.slice(0, 10))
        fail('SAM stored deadline lineage mismatch');
    }
    // Independent counts may race below returned rows. Query matches can be in
    // hidden description text; neither observation establishes corpus absence.
    return page;
  }
  return Object.freeze({samOpportunitiesSchemaId: schema.$id, SAM_OPPORTUNITIES_OPERATION_IDS,
    samOpportunitiesInputDefinition, samOpportunitiesOutputDefinition,
    normalizeSamOpportunitiesInput, validateSamOpportunitiesShape, assertSamOpportunitiesOutput});
}
