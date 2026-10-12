// Stored-source candidate projections only; no source lookup or authorization.
import {snapshotOperationData} from './operation-contracts.mjs';
import {resolveCongressionalBillId} from './congressional-identity.mjs';
import {inspectStateBillSelector} from './state-bill-identity.mjs';

const fail = message => { throw new Error(message); };
export const ENTITY_CANDIDATES_OPERATION_IDS = Object.freeze(['resolve_entity']);
const directMethods = Object.freeze({member: 'bioguide-id', committee: 'system-code', bill: 'bill-id', state_bill: 'state-bill-key'});
const nameOrder = Object.freeze(['member', 'committee', 'state_legislator']);
const crosswalkTypes = Object.freeze(['member', 'state_bill', 'state_legislator']);
const text = (value, max) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
function instant(value, dateOnly = false) {
  const at = Date.parse(value);
  if (!Number.isFinite(at) || new Date(at).toISOString() !== value ||
      (dateOnly && !value.endsWith('T00:00:00.000Z'))) fail('Noncanonical entity-source date');
}
function phase(row) {
  if (Object.hasOwn(directMethods, row.entityType) && row.matchedBy === directMethods[row.entityType]) return 'direct';
  if (crosswalkTypes.includes(row.entityType) && row.matchedBy.endsWith('-crosswalk')) return 'crosswalk';
  if (nameOrder.includes(row.entityType) && row.matchedBy === 'name-search') return 'name';
  fail('Candidate match method is unavailable for this entity type');
}
function stateSelectionMatches(id, selector) {
  if (selector.kind === 'canonical') return id === selector.key;
  if (selector.kind !== 'designation') return false;
  const resolved = inspectStateBillSelector(id);
  return resolved.kind === 'canonical' && resolved.key === id && id.startsWith(`${selector.state.toLowerCase()}-`) &&
    id.slice(id.lastIndexOf('-') + 1) === selector.billNumber;
}

export function createEntityCandidatesValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Entity candidate validator configuration');
  const definition = (operation, kind) => {
    if (operation !== 'resolve_entity') fail('Unknown entity candidate operation');
    return `EntityCandidates${kind}`;
  };
  function normalizeEntityCandidatesInput(operation, request, options) {
    const requestName = definition(operation, 'Request');
    const raw = snapshotOperationData(request), context = snapshotOperationData(options);
    validateShape('EntityCandidatesContext', context); validateShape(requestName, raw);
    const query = text(raw.query, 200)?.trim(), type = text(raw.type, 20)?.toLowerCase();
    const numeric = typeof raw.limit === 'number' ? raw.limit : typeof raw.limit === 'string' ? Number(raw.limit) : NaN;
    const input = {limit: Number.isFinite(numeric) ? Math.max(1, Math.min(10, Math.trunc(numeric))) : 5,
      ...(query ? {query} : {}), ...(type ? {type} : {})};
    validateShape(definition(operation, 'Input'), input);
    const upper = query?.toUpperCase(), lower = query?.toLowerCase();
    const metadata = {defaultCongress: context.defaultCongress,
      bioguideId: upper && /^[A-Z][0-9]{6}$/.test(upper) ? upper : null,
      committeeId: lower && /^[hsj][sc][a-z]{2}[0-9]{2}$/.test(lower) ? lower : null,
      billId: resolveCongressionalBillId(query ?? null, context.defaultCongress),
      stateBillSelector: inspectStateBillSelector(query ?? null), canNameSearch: Boolean(query && /[a-z]/i.test(query))};
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze(metadata)});
  }
  function directIdentity(row, metadata) {
    const expected = row.entityType === 'member' ? metadata.bioguideId
      : row.entityType === 'committee' ? metadata.committeeId : metadata.billId;
    if (row.entityType === 'state_bill') {
      if (!stateSelectionMatches(row.canonicalId, metadata.stateBillSelector)) fail('State candidate selection mismatch');
    } else if (expected === null || row.canonicalId !== expected) fail('Direct candidate identity mismatch');
  }
  function assertEntityCandidatesOutput(operation, value, request, options) {
    const {input, metadata} = normalizeEntityCandidatesInput(operation, request, options);
    const page = snapshotOperationData(value); validateShape(definition(operation, 'Output'), page); instant(page.generatedAt);
    if (page.matchesFound !== page.matches.length || page.matches.length > input.limit) fail('Candidate returned count/window mismatch');
    if (!input.query) {
      if (page.matches.length || page.note !== schema.$defs.EntityCandidatesMissingNote.const) fail('Missing entity query must remain explicit');
      return page;
    }
    if (!page.matches.length) {
      if (page.note !== `No canonical entity matched "${input.query}". Say so explicitly — do NOT fabricate a member, committee, or bill identifier.`)
        fail('Entity no-match note mismatch');
      return page;
    }
    if (Object.hasOwn(page, 'note')) fail('Entity matches cannot carry a missing/no-match note');
    let selectedPhase = null, previousNameFamily = -1, previousDirectFamily = -1;
    const currentSeen = new Map();
    for (const row of page.matches) {
      if (input.type && row.entityType !== input.type) fail('Candidate type selector mismatch');
      const rowPhase = phase(row);
      if (selectedPhase && selectedPhase !== rowPhase) fail('Direct, crosswalk and name phases cannot mix');
      selectedPhase = rowPhase;
      if (rowPhase === 'direct') {
        directIdentity(row, metadata);
        const rank = Object.keys(directMethods).indexOf(row.entityType);
        if (rank <= previousDirectFamily) fail('Direct candidate type cannot repeat or reorder');
        previousDirectFamily = rank;
      } else if (rowPhase === 'name') {
        if (!metadata.canNameSearch) fail('Name lookup requires the source ASCII-letter predicate');
        const rank = nameOrder.indexOf(row.entityType);
        if (rank < previousNameFamily) fail('Entity name family order mismatch');
        previousNameFamily = rank;
        if (currentSeen.get(row.entityType) === false && row.isCurrent) fail('Entity current-first order mismatch');
        currentSeen.set(row.entityType, row.isCurrent);
      }
      if ((row.entityType === 'bill' || row.entityType === 'state_bill') && row.latestActionDate !== null)
        instant(row.latestActionDate, true);
    }
    // Crosswalk lookup existence, hidden lastName/collation ordering and latest
    // state session selection are source facts, not reconstructed from the DTO.
    return page;
  }
  function validateEntityCandidatesShape(name, value) {
    if (typeof name !== 'string' || !Object.hasOwn(schema.$defs, name)) fail('Unknown entity candidate shape');
    const data = snapshotOperationData(value); validateShape(name, data); return data;
  }
  return Object.freeze({normalizeEntityCandidatesInput, assertEntityCandidatesOutput, validateEntityCandidatesShape,
    entityCandidatesInputDefinition: operation => definition(operation, 'Input'),
    entityCandidatesOutputDefinition: operation => definition(operation, 'Output')});
}
