// Private stored directory projections. No source lookup, identity authority or freshness proof.
import {snapshotOperationData} from './operation-contracts.mjs';

const fail = message => { throw new Error(message); };
const families = Object.freeze({get_committee_roster: 'CommitteeRoster', list_members: 'MemberList'});
export const LEGISLATIVE_DIRECTORY_OPERATION_IDS = Object.freeze(Object.keys(families));
const clipped = (value, maximum) => typeof value === 'string' && value.trim() ? value.trim().slice(0, maximum) : null;
const sameRow = (left, right) => left === null || right === null ? left === right :
  Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([key, value]) => right[key] === value);

export function createLegislativeDirectoryValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Legislative directory validator configuration');
  const definition = (id, suffix) => {
    if (typeof id !== 'string' || !Object.hasOwn(families, id)) fail('Unknown legislative directory operation');
    return `${families[id]}${suffix}`;
  };
  const constant = name => schema.$defs[name].const;
  const states = constant('DirectoryStateNames');
  const rolePatterns = Object.fromEntries(Object.entries(constant('DirectoryRolePatterns')).map(([key, pattern]) => [key, new RegExp(pattern, 'u')]));
  const stateName = value => {
    if (!value) return null;
    const code = value.toUpperCase();
    if (value.length === 2) return Object.hasOwn(states, code) ? states[code] : null;
    return Object.values(states).find(name => name.toLowerCase() === value.toLowerCase()) ?? null;
  };
  function normalizeLegislativeDirectoryInput(id, request, options = {}) {
    const requestDef = definition(id, 'Request');
    const raw = snapshotOperationData(request), context = snapshotOperationData(options);
    if (!context || typeof context !== 'object' || Array.isArray(context) || Object.keys(context).length)
      fail('Legislative directory reads have no caller context keys');
    validateShape(requestDef, raw);
    const input = {};
    if (id === 'list_members') {
      const scalar = typeof raw.limit === 'number' ? raw.limit : typeof raw.limit === 'string' ? Number(raw.limit) : NaN;
      input.limit = Number.isFinite(scalar) ? Math.max(1, Math.min(100, Math.trunc(scalar))) : 100;
      const state = clipped(raw.state, 40), chamber = clipped(raw.chamber, 10)?.toLowerCase();
      if (state) input.state = stateName(state) ?? state;
      if (chamber === 'house' || chamber === 'senate') input.chamber = chamber;
    } else {
      for (const [key, maximum] of Object.entries({committee: 200, jurisdiction: 10, chamber: 10, state: 2})) {
        const value = clipped(raw[key], maximum);
        if (value === null) continue;
        input[key] = key === 'state' ? value.toUpperCase() : key === 'committee' ? value : value.toLowerCase();
        if (input[key].length > maximum) fail('Directory case normalization exceeds typed selector bound');
      }
    }
    validateShape(definition(id, 'Input'), input);
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({})});
  }
  function assertMembers(page, input) {
    const state = stateName(input.state), chamber = input.chamber ?? null;
    if ((input.state && !state) || (!state && !chamber)) {
      const expected = input.state && !state
        ? `"${input.state}" is not a recognized US state or territory — say so explicitly, do not guess a roster.`
        : constant('DirectoryMemberSelectionNote');
      if (Object.hasOwn(page, 'filter') || page.members.length || page.note !== expected)
        fail('Directory member selection must retain exact refusal');
      return;
    }
    if (!page.filter || page.filter.state !== state || page.filter.chamber !== chamber ||
        page.matchesFound !== page.members.length || page.members.length > input.limit)
      fail('Directory member filter, count or window mismatch');
    for (const row of page.members) {
      if (state && row.state?.toLowerCase() !== state.toLowerCase()) fail('Directory member state mismatch');
      if (chamber && row.chamber !== chamber) fail('Directory member chamber mismatch');
      if (row.chamber !== 'house' && row.district !== null) fail('Non-House member cannot carry a district');
    }
    const label = state ? chamber ? `${state}-${chamber}` : state : chamber;
    const expected = page.members.length
      ? `Current members from the Capiro congressional roster (congress_member, is_current). Cite as [S:list_members:${label}]. Note every state has exactly 2 senators; if a senate query returns fewer than 2, the roster is incomplete for that state — say so rather than inventing a name.`
      : `No current members found for "${label}" in the Capiro roster — say so explicitly; do not guess names.`;
    if (page.note !== expected) fail('Directory member provenance note mismatch');
  }
  function assertRoster(page, input) {
    const federal = input.jurisdiction === 'federal', state = input.jurisdiction === 'state';
    let refusal = null;
    if (!input.committee || (!federal && !state)) refusal = constant('DirectorySelectionNote');
    else if (state && !input.state) refusal = constant('DirectoryStateNote');
    if (refusal !== null) {
      if (page.committee !== null || page.note !== refusal) fail('Directory roster selection must retain exact refusal');
      return;
    }
    if (page.committee === null) {
      const expected = federal
        ? `No federal committee matched "${input.committee}"${input.chamber ? ` in ${input.chamber}` : ''} — say so explicitly, do not guess.`
        : `No ${input.state} committee matched "${input.committee}"${input.chamber ? ` in the ${input.chamber} chamber` : ''} — say so explicitly, do not guess.`;
      if (page.note !== expected) fail('Directory unresolved roster note mismatch');
      return;
    }
    const committee = page.committee;
    if (committee.jurisdiction !== input.jurisdiction || (input.chamber && committee.chamber !== input.chamber))
      fail('Directory committee namespace or chamber mismatch');
    if ((committee.matchedBy === 'code' && committee.id !== input.committee) ||
        (committee.matchedBy === 'id' && committee.id.toLowerCase() !== input.committee.toLowerCase()))
      fail('Directory committee identifier lineage mismatch');
    const title = federal ? 'title' : 'role';
    for (const role of federal ? ['chair', 'viceChair', 'rankingMember'] : ['chair', 'viceChair']) {
      const expected = page.members.find(row => typeof row[title] === 'string' && rolePatterns[role].test(row[title].trim().toLowerCase())) ?? null;
      if (!sameRow(page[role], expected)) fail('Directory leadership must match first reported role row');
    }
    if (federal) {
      for (let index = 1; index < page.members.length; index++)
        if ((page.members[index - 1].rank ?? 999) > (page.members[index].rank ?? 999)) fail('Federal directory rank order mismatch');
    }
    const expected = !page.members.length ? constant('DirectoryEmptyRosterNote') : federal ? constant('DirectoryFederalRosterNote') : null;
    if (page.note !== expected) fail('Directory roster scope note mismatch');
  }
  const assertions = {get_committee_roster: assertRoster, list_members: assertMembers};
  function assertLegislativeDirectoryOutput(id, value, request, options = {}) {
    const {input} = normalizeLegislativeDirectoryInput(id, request, options), page = snapshotOperationData(value);
    validateShape(definition(id, 'Output'), page);
    if (new Set(page.members.map(row => row.id)).size !== page.members.length) fail('Duplicate directory member identity');
    const stamp = Date.parse(page.generatedAt);
    if (!Number.isFinite(stamp) || new Date(stamp).toISOString() !== page.generatedAt) fail('Noncanonical directory generatedAt');
    assertions[id](page, input);
    return page;
  }
  function validateLegislativeDirectoryShape(name, value) {
    if (typeof name !== 'string' || !Object.hasOwn(schema.$defs, name)) fail('Unknown legislative directory shape');
    const data = snapshotOperationData(value); validateShape(name, data); return data;
  }
  return Object.freeze({normalizeLegislativeDirectoryInput, assertLegislativeDirectoryOutput, validateLegislativeDirectoryShape,
    legislativeDirectoryInputDefinition: id => definition(id, 'Input'), legislativeDirectoryOutputDefinition: id => definition(id, 'Output')});
}
