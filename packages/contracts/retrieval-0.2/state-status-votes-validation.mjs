// DTO projections only. Live lookup, quota reservation and ingestion are unqualified.
import {snapshotOperationData} from './operation-contracts.mjs';
import {inspectStateBillSelector} from './state-bill-identity.mjs';
import existingStateSchema from './state-legislation.schema.json' with {type: 'json'};

const fail = message => { throw new Error(message); };
const families = Object.freeze({get_state_bill_status: 'StateBillStatus', search_state_floor_votes: 'StateFloorVotes'});
export const STATE_STATUS_VOTES_OPERATION_IDS = Object.freeze(Object.keys(families));
const labels = Object.freeze({...existingStateSchema.$defs.StateBillStatusLabels.const});
// Preserve serialized omission for inherited names in the pinned producer's label table.
const label = status => status === null ? 'Unknown' : Object.hasOwn(labels, status) ? labels[status]
  : status && status in labels ? undefined : status;
function assertLabel(row) {
  const expected = label(row.status);
  if (expected === undefined ? Object.hasOwn(row, 'statusLabel') : row.statusLabel !== expected)
    fail('State status label mismatch');
}
const text = (value, max) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
function instant(value, dateOnly = false) {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value ||
      (dateOnly && !value.endsWith('T00:00:00.000Z'))) fail('Invalid canonical state-source date');
  return millis;
}
function descendingDates(rows) {
  let previous = Infinity;
  for (const row of rows) {
    // PostgreSQL DESC defaults NULLS FIRST; equal-day secondary ordering is unspecified.
    const current = row.date === null ? Infinity : instant(row.date, true);
    if (current > previous) fail('State date order mismatch');
    previous = current;
  }
}
function matchesSelection(key, selection) {
  if (typeof key !== 'string') return false;
  if (selection.kind === 'canonical') return key === selection.key;
  if (selection.kind !== 'designation') return false;
  const actual = inspectStateBillSelector(key);
  return actual.kind === 'canonical' && actual.key === key && key.startsWith(`${selection.state.toLowerCase()}-`) &&
    key.slice(key.lastIndexOf('-') + 1) === selection.billNumber;
}

export function createStateStatusVotesValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('State status/votes validator configuration');
  const definition = (id, kind) => {
    if (typeof id !== 'string' || !Object.hasOwn(families, id)) fail('Unknown state status/votes operation');
    return `${families[id]}${kind}`;
  };
  function normalizeStateStatusVotesInput(id, request, options = {}) {
    const raw = snapshotOperationData(request), context = snapshotOperationData(options);
    if (!context || typeof context !== 'object' || Array.isArray(context) || Object.keys(context).length)
      fail('State status/votes has no trusted context keys');
    validateShape(definition(id, 'Request'), raw);
    const status = id === 'get_state_bill_status';
    const billId = text(raw.billId, 60) ?? (status ? text(raw.query, 60) : null);
    const state = text(raw.state, 2);
    const input = {...(billId === null ? {} : {billId}), ...(state === null ? {} : {state})};
    if (!status) {
      const query = text(raw.query, 200), chamber = text(raw.chamber, 10);
      if (query !== null) input.query = query;
      if (chamber !== null) input.chamber = chamber.toLowerCase();
      const numeric = typeof raw.limit === 'number' ? raw.limit : typeof raw.limit === 'string' ? Number(raw.limit) : NaN;
      input.limit = Number.isFinite(numeric) ? Math.max(1, Math.min(25, Math.trunc(numeric))) : 10;
    }
    validateShape(definition(id, 'Input'), input);
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({selector: inspectStateBillSelector(billId, state)})});
  }
  function unresolvedNotes(input, selector) {
    if (selector.kind === 'missing') return [schema.$defs.MissingStateBillNote.const];
    if (selector.kind === 'invalid') return [input.state
      ? `Could not parse "${input.billId}" as a state bill designation.`
      : `Could not parse "${input.billId}" as a state bill designation — specify the state, e.g. "TX HB 1234".`];
    if (selector.kind !== 'designation') return [];
    const prefix = `No bill found matching "${input.billId}" in ${selector.state}.`;
    return ['', ' A live LegiScan lookup of the current session found no such bill either.',
      ' A live LegiScan lookup was skipped because this month’s lookup budget is used up; say the bill could not be checked.',
      ' A live LegiScan lookup failed; say the bill could not be checked rather than that it does not exist.'].map(suffix => prefix + suffix);
  }
  function statusOutput(page, input, selector) {
    if (!Object.hasOwn(page, 'billId')) {
      if (!unresolvedNotes(input, selector).includes(page.note)) fail('Unresolved state bill reason mismatch');
      return;
    }
    if (!matchesSelection(page.billId, selector)) fail('State status selected bill mismatch');
    if (!page.found) {
      if (page.note !== `No bill ${page.billId} on record in the Capiro database. Say so explicitly — do not describe its status from memory.`)
        fail('Absent state bill reason mismatch');
      return;
    }
    assertLabel(page);
    if (page.statusAt !== null) instant(page.statusAt);
    if (page.latestAction.date !== null) instant(page.latestAction.date, true);
    descendingDates(page.recentActions); descendingDates(page.votes);
    for (const companion of page.companions) {
      // A missing related row emits three nulls; a present row always has an identifier.
      if (companion.identifier === null) {
        if (companion.status !== null || companion.statusLabel !== null) fail('Missing companion enrichment mismatch');
      } else assertLabel(companion);
    }
    const notes = [];
    if (page.votes.length === 0) notes.push(schema.$defs.NoBillVotesNote.const);
    if (page.status === 'dead_by_deadline') notes.push(schema.$defs.DeadStateBillNote.const);
    if (notes.length ? page.note !== notes.join(' ') : Object.hasOwn(page, 'note')) fail('State bill caveat mismatch');
  }
  function votesOutput(page, input, selector) {
    if (page.votesFound !== page.votes.length || page.votes.length > input.limit) fail('State vote window mismatch');
    if (input.billId && (selector.kind === 'invalid' || selector.kind === 'missing')) {
      if (page.votes.length || !unresolvedNotes(input, selector).includes(page.note)) fail('Unresolved bill cannot broaden votes');
      return;
    }
    if (page.votes.length === 0) {
      const accepted = [schema.$defs.NoStateVotesNote.const, ...(input.billId ? unresolvedNotes(input, selector) : [])];
      if (!accepted.includes(page.note)) fail('State vote empty/unresolved reason mismatch');
      return;
    }
    if (Object.hasOwn(page, 'note')) fail('Nonempty state votes cannot carry empty/unresolved note');
    descendingDates(page.votes);
    for (const row of page.votes) {
      if (input.billId) {
        if (!matchesSelection(row.billKey, selector) || row.billKey !== page.votes[0].billKey) fail('State votes selected bill mismatch');
      } else if (input.state && !row.billKey?.startsWith(`${input.state.toUpperCase().toLowerCase()}-`)) fail('State prefix filter mismatch');
      if (['upper', 'lower'].includes(input.chamber) && row.chamber !== input.chamber) fail('State chamber filter mismatch');
      if (input.query && row.motion === null) fail('Queried state vote cannot have null motion');
    }
  }
  function assertStateStatusVotesOutput(id, value, request, options = {}) {
    const {input, metadata} = normalizeStateStatusVotesInput(id, request, options), page = snapshotOperationData(value);
    validateShape(definition(id, 'Output'), page); instant(page.generatedAt);
    if (id === 'get_state_bill_status') statusOutput(page, input, metadata.selector);
    else votesOutput(page, input, metadata.selector);
    return page;
  }
  function validateStateStatusVotesShape(name, value) {
    if (typeof name !== 'string' || !Object.hasOwn(schema.$defs, name)) fail('Unknown state status/votes shape');
    const data = snapshotOperationData(value); validateShape(name, data); return data;
  }
  return Object.freeze({normalizeStateStatusVotesInput, assertStateStatusVotesOutput, validateStateStatusVotesShape,
    stateStatusVotesInputDefinition: id => definition(id, 'Input'), stateStatusVotesOutputDefinition: id => definition(id, 'Output')});
}
