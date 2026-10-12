import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createStateStatusVotesValidators} from '../retrieval-0.2/state-status-votes-validation.mjs';
import {inspectStateBillSelector} from '../retrieval-0.2/state-bill-identity.mjs';
const schema = JSON.parse(readFileSync(new URL('../retrieval-0.2/state-status-votes.schema.json', import.meta.url)));
const ajv = new Ajv({strict: true, allErrors: true}); addFormats(ajv); ajv.addSchema(schema);
const validators = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({$ref: `${schema.$id}#/$defs/${name}`})]));
const v = createStateStatusVotesValidators({schema, validateShape(name, value) {
  const check = validators.get(name); if (!check?.(value)) throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`);
}});
const STATUS = 'get_state_bill_status', VOTES = 'search_state_floor_votes';
const stamp = '2026-10-12T12:00:00.000Z', day = '2026-10-11T00:00:00.000Z', key = 'tx-2025-hb1234';
const normalize = (id, raw = {}, context = {}) => v.normalizeStateStatusVotesInput(id, raw, context);
const check = (id, page, raw = {}, context = {}) => v.assertStateStatusVotesOutput(id, page, raw, context);
const vote = () => ({chamber: null, motion: null, date: null, yeas: -2, nays: 4, nv: -1, absent: 0, passed: null, sourceUrl: null});
const floor = () => ({id: 'arbitrary stored vote id', billKey: key, ...vote()});
const votes = (rows = [floor()]) => ({tool: VOTES, generatedAt: stamp, votesFound: rows.length, votes: rows,
  ...(rows.length ? {} : {note: schema.$defs.NoStateVotesNote.const})});
const found = () => ({tool: STATUS, generatedAt: stamp, found: true, billId: key, state: 'TX', session: '2025', identifier: 'HB 1234', title: 'Synthetic bill', status: null, statusLabel: 'Unknown', statusAt: null, latestAction: {text: null, date: null}, sponsor: {name: null, party: null, count: -1}, recentActions: [], votes: [vote()], companions: [], url: null});
const unresolved = note => ({tool: STATUS, generatedAt: stamp, found: false, note});
const absent = () => ({...unresolved(`No bill ${key} on record in the Capiro database. Say so explicitly — do not describe its status from memory.`), billId: key});
const args = {billId: key};

test('state helper is primitive-only, inert and clock-free', () => {
  let touched = 0; const coercive = {[Symbol.toPrimitive]() { touched++; return key; }};
  assert.throws(() => inspectStateBillSelector(coercive));
  assert.throws(() => inspectStateBillSelector(key, coercive)); assert.equal(touched, 0);
  assert.deepEqual(inspectStateBillSelector(null), {kind: 'missing'});
  assert.deepEqual(inspectStateBillSelector('HB 1234'), {kind: 'invalid'});
});
test('canonical key normalization overrides state hint and retains special-session suffix', () => {
  assert.deepEqual(inspectStateBillSelector(' T.X. - 2025x07 - H.B.001A ', 'NY'), {kind: 'canonical', key: 'tx-2025x07-hb001a'});
  assert.deepEqual(normalize(STATUS, {billId: ' TX-2025-HB1234 ', state: 'NY'}).metadata.selector, {kind: 'canonical', key});
  check(STATUS, found(), {billId: 'TX-2025-HB1234', state: 'NY'});
});
test('designation hint first, prefix fallback and DC hyphen normalization', () => {
  assert.deepEqual(inspectStateBillSelector('H.B. 001A', 'tx'), {kind: 'designation', state: 'TX', billNumber: 'hb001a'});
  assert.deepEqual(inspectStateBillSelector('TX HB 1234', 'NY'), {kind: 'designation', state: 'TX', billNumber: 'hb1234'});
  assert.deepEqual(inspectStateBillSelector('DC B26-0001'), {kind: 'designation', state: 'DC', billNumber: 'b260001'});
  assert.deepEqual(inspectStateBillSelector('XX Z0'), {kind: 'designation', state: 'XX', billNumber: 'z0'});
});
test('status alias precedence and blank/null fallback preserve source selectors', () => {
  assert.deepEqual(normalize(STATUS, {billId: ' ', query: ' TX HB 1234 '}).input, {billId: 'TX HB 1234'});
  assert.equal(normalize(STATUS, {billId: null, query: key}).input.billId, key);
  assert.equal(normalize(STATUS, {billId: key, query: 'NY HB 2'}).input.billId, key);
  const result = normalize(STATUS, {query: key}); assert.ok(Object.isFrozen(result.input)); assert.ok(Object.isFrozen(result.metadata.selector));
});
test('source clamp and UTF16 trimming/caps remain numeric/string compatible', () => {
  for (const [raw, expected] of [['2.9', 2], [-3, 1], ['', 1], ['bad', 10], [null, 10], [30, 25]])
    assert.equal(normalize(VOTES, {limit: raw}).input.limit, expected);
  assert.equal(normalize(STATUS, {query: '🧭'.repeat(40)}).input.billId.length, 60);
  assert.equal(normalize(VOTES, {query: '🧭'.repeat(101), chamber: ' UPPER '}).input.query.length, 200);
  assert.equal(normalize(VOTES, {chamber: ' UPPER '}).input.chamber, 'upper');
  assert.equal(normalize(VOTES, {state: ' ßß '}).input.state, 'ßß');
});
test('closed request and context cannot carry authority or member selectors', () => {
  for (const id of [STATUS, VOTES]) {
    for (const input of [{tenantId: 'x'}, {actorRole: 'admin'}, {session: '2025'}, {memberId: 'x'}, {query: {}}, {billId: 4}])
      assert.throws(() => normalize(id, input));
    assert.throws(() => normalize(id, {}, {resolvedBillKey: key}));
    assert.throws(() => normalize(id, {}, {nowMs: 1}));
  }
  assert.throws(() => normalize(VOTES, {limit: true}));
});
test('hostile getters/proxies/selectors are rejected without execution', () => {
  let calls = 0; const raw = {}; Object.defineProperty(raw, 'billId', {enumerable: true, get() { calls++; return key; }});
  assert.throws(() => normalize(STATUS, raw));
  assert.throws(() => normalize(STATUS, new Proxy({}, {ownKeys() { calls++; return []; }})));
  assert.throws(() => normalize({toString() { calls++; return STATUS; }}, {}));
  assert.throws(() => v.validateStateStatusVotesShape({toString() { calls++; return 'StateBillStatusInput'; }}, {}));
  assert.equal(calls, 0);
});
test('missing and syntactically invalid status cannot return successful data', () => {
  check(STATUS, unresolved(schema.$defs.MissingStateBillNote.const));
  check(STATUS, unresolved('Could not parse "HB 1234" as a state bill designation — specify the state, e.g. "TX HB 1234".'), {query: 'HB 1234'});
  check(STATUS, unresolved('Could not parse "???" as a state bill designation.'), {billId: '???', state: 'TX'});
  assert.throws(() => check(STATUS, found(), {}));
  assert.throws(() => check(STATUS, found(), {billId: '???', state: 'TX'}));
});
test('all four live lookup refusal suffixes retain unavailable versus not-found wording', () => {
  const prefix = 'No bill found matching "TX HB 1234" in TX.';
  for (const suffix of ['', ' A live LegiScan lookup of the current session found no such bill either.',
    ' A live LegiScan lookup was skipped because this month’s lookup budget is used up; say the bill could not be checked.',
    ' A live LegiScan lookup failed; say the bill could not be checked rather than that it does not exist.']) {
    check(STATUS, unresolved(prefix + suffix), {query: 'TX HB 1234'});
    check(VOTES, {...votes([]), note: prefix + suffix}, {billId: 'TX HB 1234'});
  }
  assert.throws(() => check(STATUS, unresolved('Bill does not exist'), {query: 'TX HB 1234'}));
});
test('resolved absent branch and direct canonical key equality', () => {
  check(STATUS, absent(), args);
  check(STATUS, absent(), {query: 'TX HB 1234'});
  assert.throws(() => check(STATUS, absent(), {billId: 'tx-2025-hb5'}));
  assert.throws(() => check(STATUS, unresolved(schema.$defs.MissingStateBillNote.const), args));
  assert.throws(() => check(STATUS, {...absent(), note: 'No current bill'}, args));
});
test('found projection keeps raw nullable fields and no invented key-to-stored-field CHECK', () => {
  check(STATUS, {...found(), state: 'stored-other', session: 'stored label', identifier: '', title: '', url: 'opaque stored value'}, args);
  check(STATUS, found(), {billId: 'HB1234', state: 'tx'});
  assert.throws(() => check(STATUS, found(), {billId: 'NY HB1234'}));
  assert.throws(() => check(STATUS, {...found(), billId: 'tx-2025-hb3'}, args));
});
test('known, empty and unknown labels and inherited-name omission are distinct', () => {
  for (const [status, statusLabel] of [['enacted', 'Enacted'], ['', ''], ['new-status', 'new-status']])
    check(STATUS, {...found(), status, statusLabel}, args);
  const page = {...found(), status: 'constructor'}; delete page.statusLabel; check(STATUS, page, args);
  assert.throws(() => check(STATUS, {...page, statusLabel: 'constructor'}, args));
  assert.throws(() => check(STATUS, {...found(), statusLabel: 'Passed'}, args));
});
test('companions keep missing versus present-null status and inherited label omission', () => {
  const row = {relatedBillKey: 'opaque stored related key', linkType: 'future', identifier: null, status: null, statusLabel: null};
  check(STATUS, {...found(), companions: [row, {...row, identifier: '', statusLabel: 'Unknown'}]}, args);
  const inherited = {...row, identifier: 'HB 2', status: '__proto__'}; delete inherited.statusLabel;
  check(STATUS, {...found(), companions: [inherited]}, args);
  assert.throws(() => check(STATUS, {...found(), companions: [{...row, statusLabel: 'Unknown'}]}, args));
});
test('source caveats follow empty vote history and dead-by-deadline status', () => {
  check(STATUS, {...found(), votes: [], note: schema.$defs.NoBillVotesNote.const}, args);
  const dead = {...found(), status: 'dead_by_deadline', statusLabel: 'Dead — session adjourned sine die', note: schema.$defs.DeadStateBillNote.const};
  check(STATUS, dead, args);
  check(STATUS, {...dead, votes: [], note: schema.$defs.NoBillVotesNote.const + ' ' + schema.$defs.DeadStateBillNote.const}, args);
  assert.throws(() => check(STATUS, {...found(), votes: []}, args));
  assert.throws(() => check(STATUS, {...found(), note: schema.$defs.NoBillVotesNote.const}, args));
});
test('unresolved supplied bill never broadens to state-wide floor votes', () => {
  const input = {billId: '???', state: 'TX'};
  check(VOTES, {...votes([]), note: 'Could not parse "???" as a state bill designation.'}, input);
  assert.throws(() => check(VOTES, votes(), input));
  assert.throws(() => check(VOTES, votes([]), input));
  assert.throws(() => check(VOTES, votes([{...floor(), billKey: 'tx-2025-hb8'}]), {billId: 'TX HB1234'}));
});
test('floor votes bind one selected session without claiming which session is current', () => {
  check(VOTES, votes(), {billId: 'TX HB1234'});
  check(VOTES, votes([{...floor(), billKey: 'tx-2024x3-hb1234'}]), {billId: 'TX HB1234'});
  assert.throws(() => check(VOTES, votes([floor(), {...floor(), billKey: 'tx-2024-hb1234'}]), {billId: 'TX HB1234'}));
  assert.throws(() => check(VOTES, votes([{...floor(), billKey: null}]), args));
});
test('state prefix, effective chamber and query null predicate preserve filter boundaries', () => {
  check(VOTES, votes([{...floor(), chamber: 'upper', motion: 'separate source text'}]), {state: 'tx', chamber: 'UPPER', query: '%'});
  check(VOTES, votes([{...floor(), chamber: 'strange', billKey: null}]), {chamber: 'ignored'});
  assert.throws(() => check(VOTES, votes(), {state: 'NY'}));
  assert.throws(() => check(VOTES, votes(), {chamber: 'upper'}));
  assert.throws(() => check(VOTES, votes(), {query: 'any'}));
  check(VOTES, votes(), {...args, state: 'NY'});
});
test('empty floor search retains precise note and no member outcome claim', () => {
  check(VOTES, votes([])); check(VOTES, votes([]), args);
  assert.throws(() => check(VOTES, {...votes([]), note: 'Passed'}));
  assert.throws(() => check(VOTES, {...votes(), note: schema.$defs.NoStateVotesNote.const}));
});
test('signed Int tallies remain independent and raw IDs/URLs have no invented format', () => {
  check(VOTES, votes([{...floor(), id: '', sourceUrl: '', yeas: -2147483648, nays: 2147483647, passed: false}]));
  assert.throws(() => check(VOTES, votes([{...floor(), yeas: 2147483648}])));
  assert.throws(() => check(VOTES, votes([{...floor(), nays: 1.5}])));
  check(VOTES, votes([floor(), floor()]));
});
test('counts and 15/25 windows are enforced without completeness invention', () => {
  assert.throws(() => check(VOTES, {...votes(), votesFound: 2}));
  assert.throws(() => check(VOTES, votes([floor(), floor()]), {limit: 1}));
  check(VOTES, votes(Array.from({length: 25}, floor)), {limit: 25});
  check(STATUS, {...found(), votes: Array.from({length: 15}, vote)}, args);
  assert.throws(() => check(STATUS, {...found(), votes: Array.from({length: 16}, vote)}, args));
});
test('canonical instants, SQLDate midnight and descending null/tie ordering', () => {
  check(STATUS, {...found(), statusAt: stamp, latestAction: {text: '', date: day}, recentActions: [{date: day, text: '', chamber: null, importance: -1}]}, args);
  check(VOTES, votes([floor(), {...floor(), date: day}, {...floor(), date: day}]));
  assert.throws(() => check(VOTES, votes([{...floor(), date: day}, floor()])));
  assert.throws(() => check(VOTES, votes([{...floor(), date: stamp}])));
  assert.throws(() => check(VOTES, {...votes(), generatedAt: '2026-06-30T23:59:60Z'}));
  assert.throws(() => check(VOTES, {...votes(), generatedAt: '2026-10-12T12:00:00Z'}));
});
test('closed output rejects injected authority, private columns and wrong operation', () => {
  for (const page of [{...found(), complete: true}, {...found(), sourceCheckedAt: stamp}, {...found(), tool: VOTES}])
    assert.throws(() => check(STATUS, page, args));
  assert.throws(() => check(VOTES, votes([{...floor(), providerBillHash: 'hidden'}])));
  const raw = found(); const result = check(STATUS, raw, args); raw.title = 'changed'; assert.equal(result.title, 'Synthetic bill');
});
