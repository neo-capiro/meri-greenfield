// Stored-source projections only; source access and identity authority stay external.
import {snapshotOperationData} from './operation-contracts.mjs';

const fail = message => { throw new Error(message); };
const families = Object.freeze({search_state_bills: 'StateBillSearch', get_state_legislator: 'StateLegislator'});
export const STATE_LEGISLATION_OPERATION_IDS = Object.freeze(Object.keys(families));
const text = (value, max) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
const instant = value => {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) fail('Noncanonical state source instant');
};

export function createStateLegislationValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('State legislation validator configuration');
  const definition = (id, kind) => {
    if (typeof id !== 'string' || !Object.hasOwn(families, id)) fail('Unknown state legislation operation');
    return `${families[id]}${kind}`;
  };
  function normalizeStateLegislationInput(id, request, options = {}) {
    const raw = snapshotOperationData(request), context = snapshotOperationData(options);
    if (!context || typeof context !== 'object' || Array.isArray(context) || Object.keys(context).length)
      fail('Stored state reads have no caller context keys');
    validateShape(definition(id, 'Request'), raw);
    const bill = id === 'search_state_bills';
    const numeric = typeof raw.limit === 'number' ? raw.limit : typeof raw.limit === 'string' ? Number(raw.limit) : NaN;
    const input = {limit: Number.isFinite(numeric) ? Math.min(bill ? 50 : 8, Math.max(1, Math.trunc(numeric))) : bill ? 20 : 5};
    const fields = bill ? {query: 240, state: 2, session: 60, status: 30} : {query: 120, state: 2};
    for (const [key, max] of Object.entries(fields)) {
      const value = text(raw[key], max);
      if (value !== null) input[key] = key === 'state' ? value.toUpperCase() : value;
    }
    validateShape(definition(id, 'Input'), input);
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({})});
  }
  function bills(page, input) {
    if (page.data.length > input.limit || Object.hasOwn(page, 'note') !== (page.total === 0))
      fail('State bill window or zero-count note mismatch');
    const labels = schema.$defs.StateBillStatusLabels.const;
    for (const row of page.data) {
      if (row.title.length > 240) fail('State bill title exceeds UTF-16 window');
      for (const key of ['state', 'session', 'status'])
        if (input[key] !== undefined && row[key] !== input[key]) fail('State bill exact selector mismatch');
      const label = row.status === null ? 'Unknown' : Object.hasOwn(labels, row.status) ? labels[row.status] : row.status;
      if (row.statusLabel !== label) fail('State bill status label mismatch');
      if (row.latestActionDate !== null) {
        instant(row.latestActionDate);
        if (!row.latestActionDate.endsWith('T00:00:00.000Z')) fail('State bill SQLDate must serialize at UTC midnight');
      }
    }
  }
  function legislators(page, input) {
    const ambiguous = page.ambiguousLegislator, hasNote = Object.hasOwn(page, 'note');
    if (page.matchesFound !== page.matches.length) fail('Legislator match count mismatch');
    if (!input.query) {
      if (page.matchesFound !== 0 || ambiguous || page.note !== schema.$defs.StateLegislatorMissingNote.const)
        fail('Missing legislator query must retain explicit refusal');
      return;
    }
    if (ambiguous) {
      const expected = `"${input.query}" matches ${ambiguous.length} state legislators — ask the user which (by state/chamber/district) before attributing anything to them.`;
      if (page.matchesFound !== 0 || ambiguous.length > input.limit || page.note !== expected)
        fail('Ambiguous legislator window or clarification mismatch');
      if (input.state && ambiguous.some(row => row.state !== input.state)) fail('Ambiguous legislator state mismatch');
      return;
    }
    if (page.matchesFound === 0) {
      const expected = `No state legislator matched "${input.query}"${input.state ? ` in ${input.state}` : ''}. Say so explicitly — do not fabricate a legislator.`;
      if (page.note !== expected) fail('No-match legislator note mismatch');
      return;
    }
    if (hasNote) fail('Matched legislator cannot carry refusal or ambiguity note');
    const row = page.matches[0];
    if (row.matchedBy === 'name-search') {
      if (input.state && row.state !== input.state) fail('Name-search legislator state mismatch');
    } else if (!row.matchedBy.endsWith('-crosswalk')) fail('Unknown legislator match path');
  }
  const assertions = {search_state_bills: bills, get_state_legislator: legislators};
  function assertStateLegislationOutput(id, value, request, options = {}) {
    const {input} = normalizeStateLegislationInput(id, request, options), page = snapshotOperationData(value);
    validateShape(definition(id, 'Output'), page);
    instant(page.generatedAt);
    assertions[id](page, input);
    return page;
  }
  function validateStateLegislationShape(name, value) {
    if (!Object.hasOwn(schema.$defs, name)) fail('Unknown state legislation shape');
    const data = snapshotOperationData(value); validateShape(name, data); return data;
  }
  return Object.freeze({normalizeStateLegislationInput, assertStateLegislationOutput, validateStateLegislationShape,
    stateLegislationInputDefinition: id => definition(id, 'Input'), stateLegislationOutputDefinition: id => definition(id, 'Output')});
}
