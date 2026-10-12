import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createEntityCandidatesValidators} from '../retrieval-0.2/entity-candidates-validation.mjs';
const schema = JSON.parse(readFileSync(new URL('../retrieval-0.2/entity-candidates.schema.json', import.meta.url)));
const ajv = new Ajv({strict: true, allErrors: true}); addFormats(ajv); ajv.addSchema(schema);
const checks = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({$ref: `${schema.$id}#/$defs/${name}`})]));
const v = createEntityCandidatesValidators({schema, validateShape(name, value) {
  const check = checks.get(name); if (!check?.(value)) throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`);
}});
const op = 'resolve_entity', context = {defaultCongress: 119}, stamp = '2026-10-12T12:00:00.000Z';
const normalize = (raw = {}, ctx = context) => v.normalizeEntityCandidatesInput(op, raw, ctx);
const check = (page, raw = {query: 'Example'}, ctx = context) => v.assertEntityCandidatesOutput(op, page, raw, ctx);
const page = rows => ({tool: op, generatedAt: stamp, matchesFound: rows.length, matches: rows});
const none = query => ({...page([]), note: query ? `No canonical entity matched "${query}". Say so explicitly — do NOT fabricate a member, committee, or bill identifier.` : schema.$defs.EntityCandidatesMissingNote.const});
const member = () => ({entityType: 'member', canonicalIdType: 'bioguide', canonicalId: 'A000001', display: 'Example Person', party: null, state: null, district: null, chamber: 'house', lisId: null, isCurrent: true, matchedBy: 'name-search'});
const committee = () => ({entityType: 'committee', canonicalIdType: 'committee', canonicalId: 'hsag00', display: 'Example Committee', chamber: 'joint', parentSystemCode: null, isCurrent: true, matchedBy: 'name-search'});
const bill = () => ({entityType: 'bill', canonicalIdType: 'billId', canonicalId: '119-hr-1', display: 'Example bill', congress: 119, sponsorName: null, sponsorBioguideId: null, latestActionText: null, latestActionDate: null, matchedBy: 'bill-id'});
const stateBill = () => ({entityType: 'state_bill', canonicalIdType: 'stateBillKey', canonicalId: 'tx-2025-hb1234', display: 'State bill', state: 'TX', session: '2025', sponsorName: null, latestActionText: null, latestActionDate: null, matchedBy: 'state-bill-key'});
const legislator = () => ({entityType: 'state_legislator', canonicalIdType: 'openstatesPersonId', canonicalId: 'opaque state person', display: 'Example Person', state: 'TX', chamber: null, district: null, party: null, isCurrent: true, matchedBy: 'name-search'});

test('operation, shape and context selectors are inert and closed', () => {
  let touched = 0; const bad = {[Symbol.toPrimitive]() { touched++; return op; }};
  assert.throws(() => v.normalizeEntityCandidatesInput(bad, {}, context));
  assert.throws(() => v.entityCandidatesInputDefinition(bad));
  assert.throws(() => v.validateEntityCandidatesShape(bad, {}));
  assert.throws(() => normalize({}, {...context, actorRole: 'admin'}));
  assert.equal(touched, 0);
});
test('trusted defaultCongress is mandatory positive Int32 on every branch', () => {
  for (const ctx of [undefined, {}, null, {defaultCongress: '119'}, {defaultCongress: 0}, {defaultCongress: -1}, {defaultCongress: 1.1}, {defaultCongress: 2147483648}])
    assert.throws(() => v.normalizeEntityCandidatesInput(op, {}, ctx));
  check(none(), {}, {defaultCongress: 2147483647});
  assert.throws(() => normalize({defaultCongress: 119}));
});
test('normalization preserves second query trim, lowercase type and source numeric/string clamp', () => {
  assert.deepEqual(normalize({query: null, type: ' ', limit: '3.9'}).input, {limit: 3});
  assert.deepEqual(normalize({query: ' Example ', type: ' MEMBER '}).input, {limit: 5, query: 'Example', type: 'member'});
  for (const [raw, value] of [[-4, 1], [99, 10], ['', 1], ['nonnumeric', 5], [null, 5]]) assert.equal(normalize({limit: raw}).input.limit, value);
  assert.equal(normalize({query: 'a' + ' '.repeat(210) + 'x'}).input.query, 'a');
});
test('UTF16 query clipping and expanding lowercase preserve unsupported type outcome', () => {
  assert.equal(normalize({query: '🧭'.repeat(101)}).input.query.length, 200);
  const raw = {query: 'Example', type: 'İ'.repeat(20)};
  assert.equal(normalize(raw).input.type.length, 40); check(none('Example'), raw);
  assert.throws(() => check(page([member()]), raw));
});
test('closed typed inputs refuse aliases, coercion objects and caller authority', () => {
  for (const raw of [{q: 'Example'}, {query: 5}, {type: {}}, {limit: true}, {state: 'TX'}, {currentOnly: true}, {tenantId: 'x'}, {asOf: stamp}]) assert.throws(() => normalize(raw));
});
test('getters and proxy traps are not executed at the JSON boundary', () => {
  let touched = 0; const raw = {}; Object.defineProperty(raw, 'query', {enumerable: true, get() { touched++; return 'Example'; }});
  assert.throws(() => normalize(raw));
  assert.throws(() => normalize(new Proxy({}, {ownKeys() { touched++; return []; }})));
  const ctx = {}; Object.defineProperty(ctx, 'defaultCongress', {enumerable: true, get() { touched++; return 119; }});
  assert.throws(() => normalize({}, ctx)); assert.equal(touched, 0);
});
test('normalized input and metadata are detached and frozen without an ambient clock', () => {
  const raw = {query: 'H.R. 1'}, ctx = {defaultCongress: 118}; const result = normalize(raw, ctx);
  raw.query = 'S.2'; ctx.defaultCongress = 119;
  assert.equal(result.input.query, 'H.R. 1'); assert.equal(result.metadata.billId, '118-hr-1');
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.input)); assert.ok(Object.isFrozen(result.metadata)); assert.ok(Object.isFrozen(result.metadata.stateBillSelector));
});
test('missing query has its own refusal even with selectors and rejects candidates', () => {
  check(none(), {}); check(none(), {query: '', type: 'member'});
  assert.throws(() => check(none('Example'), {})); assert.throws(() => check(page([member()]), {}));
});
test('unsupported type returns only the exact no-match envelope', () => {
  check(none('Example'), {query: 'Example', type: 'company'});
  assert.throws(() => check(page([member()]), {query: 'Example', type: 'company'}));
  assert.throws(() => check({...none('Example'), note: 'No person exists'}));
});
test('direct member and committee keys normalize case and bind returned identity', () => {
  check(page([{...member(), matchedBy: 'bioguide-id'}]), {query: 'a000001'});
  check(page([{...committee(), matchedBy: 'system-code'}]), {query: 'HSAG00'});
  assert.throws(() => check(page([{...member(), matchedBy: 'bioguide-id', canonicalId: 'B000001'}]), {query: 'A000001'}));
  assert.throws(() => check(page([{...committee(), matchedBy: 'system-code'}]), {query: 'a name'}));
});
test('canonical federal helper handles explicit Congress and zero-preserving IDs', () => {
  check(page([bill()]), {query: 'H.R. 1'});
  check(page([{...bill(), canonicalId: '118-s-2'}]), {query: 'S. 2 (118th)'});
  check(page([{...bill(), canonicalId: '119-hr-00001'}]), {query: '119-HR-00001'});
  assert.throws(() => check(page([bill()]), {query: 'H.R. 1'}, {defaultCongress: 118}));
  assert.throws(() => check(page([bill()]), {query: 'H.R. 0'}));
});
test('state key/designation dependency is reused without a live lookup or session clock', () => {
  check(page([stateBill()]), {query: 'TX-2025-H.B.1234'});
  check(page([stateBill()]), {query: 'TX HB 1234'});
  check(page([{...stateBill(), canonicalId: 'tx-2024x12-hb1234'}]), {query: 'TX HB 1234'});
  assert.throws(() => check(page([stateBill()]), {query: 'HB 1234'}));
  assert.throws(() => check(page([stateBill()]), {query: 'NY HB 1234'}));
});
test('stored state/session/congress fields are not inferred from canonical keys', () => {
  check(page([{...bill(), congress: -2147483648}]), {query: 'H.R. 1'});
  check(page([{...stateBill(), state: 'stored differently', session: ''}]), {query: 'tx-2025-hb1234'});
  assert.throws(() => check(page([{...bill(), congress: 2147483648}]), {query: 'H.R. 1'}));
});
test('all five variants have precise nulls and currentness placement', () => {
  check(page([member(), committee(), legislator()])); check(page([bill()]), {query: 'H.R. 1'}); check(page([stateBill()]), {query: 'TX HB1234'});
  assert.throws(() => check(page([{...bill(), isCurrent: true}]), {query: 'H.R. 1'}));
  assert.throws(() => check(page([{...member(), district: '1'}])));
  assert.throws(() => check(page([{...legislator(), district: 1}])));
  assert.throws(() => check(page([{...committee(), chamber: null}])));
});
test('stored strings remain unrestricted on name/crosswalk paths and member district remains signed', () => {
  check(page([{...member(), canonicalId: '', display: '', chamber: 'future chamber', district: -7, lisId: ''}]));
  check(page([{...stateBill(), canonicalId: 'noncanonical stored key', matchedBy: '-crosswalk'}]), {query: 'foreign-ID'});
});
test('arbitrary crosswalk namespaces including empty and duplicate canonical IDs survive', () => {
  const row = {...member(), matchedBy: '-crosswalk'};
  check(page([row, {...row, matchedBy: 'custom namespace\nwith text-crosswalk'}, row]), {query: 'external-ID'});
  check(page([{...legislator(), matchedBy: 'legiscan-crosswalk'}, {...stateBill(), matchedBy: 'openstates-crosswalk'}]), {query: 'external-ID'});
});
test('crosswalk does not support committee or federal bill projections', () => {
  assert.throws(() => check(page([{...committee(), matchedBy: 'thomas-crosswalk'}])));
  assert.throws(() => check(page([{...bill(), matchedBy: 'legacy-crosswalk'}])));
});
test('direct crosswalk and name phases cannot mix, while a missed direct ID may fall back', () => {
  assert.throws(() => check(page([{...member(), matchedBy: 'bioguide-id'}, {...member(), matchedBy: 'lis-crosswalk'}]), {query: 'A000001'}));
  assert.throws(() => check(page([{...member(), matchedBy: 'lis-crosswalk'}, legislator()])));
  check(page([{...member(), canonicalId: 'B000001', matchedBy: 'lis-crosswalk'}]), {query: 'A000001'});
  check(page([{...member(), canonicalId: 'C000001', matchedBy: 'name-search'}]), {query: 'A000001'});
});
test('name-family order and current-first are local to each family', () => {
  check(page([{...member(), isCurrent: false}, committee(), {...legislator(), isCurrent: false}]));
  check(page([member(), {...member(), isCurrent: false}, committee()]));
  assert.throws(() => check(page([committee(), member()])));
  assert.throws(() => check(page([{...member(), isCurrent: false}, member()])));
  assert.throws(() => check(page([legislator(), committee()])));
});
test('name lookup preserves the ASCII-letter predicate and hidden lastName match', () => {
  check(page([{...member(), display: 'Displayed value does not contain selector'}]), {query: 'HiddenLastName'});
  for (const query of ['1234', '🧭', 'é']) assert.throws(() => check(page([member()]), {query}));
  check(page([{...member(), matchedBy: 'numeric-crosswalk'}]), {query: '1234'});
});
test('type filter applies across all match paths and no invented current-only restriction', () => {
  check(page([{...member(), isCurrent: false}]), {query: 'Example', type: 'MEMBER'});
  assert.throws(() => check(page([committee()]), {query: 'Example', type: 'member'}));
  assert.throws(() => check(page([{...stateBill(), matchedBy: 'x-crosswalk'}]), {query: 'Example', type: 'member'}));
});
test('returned count and cap do not imply total or corpus coverage', () => {
  assert.throws(() => check({...page([member()]), matchesFound: 2}));
  assert.throws(() => check(page([member(), member()]), {query: 'Example', limit: 1}));
  check(page(Array.from({length: 10}, () => ({...member(), matchedBy: 'x-crosswalk'}))), {query: 'external', limit: 10});
  assert.throws(() => check({...page([member()]), total: 100}));
});
test('only an empty result may carry the correlated no-match note', () => {
  check(none('Example')); assert.throws(() => check(page([])));
  assert.throws(() => check({...page([member()]), note: none('Example').note}));
});
test('finite canonical generatedAt and SQLDate midnight are distinct boundaries', () => {
  check(page([{...bill(), latestActionDate: '2026-01-01T00:00:00.000Z'}]), {query: 'H.R. 1'});
  assert.throws(() => check(page([{...stateBill(), latestActionDate: stamp}]), {query: 'TX HB1234'}));
  assert.throws(() => check({...page([member()]), generatedAt: '2026-06-30T23:59:60Z'}));
  assert.throws(() => check({...page([member()]), generatedAt: '2026-10-12T12:00:00Z'}));
});
test('projection rejects hidden columns, wrong identity type and arbitrary methods', () => {
  for (const row of [{...member(), confidence: 1}, {...member(), email: 'private'}, {...member(), canonicalIdType: 'billId'}, {...member(), matchedBy: 'guess'}, {...legislator(), matchedBy: 'openstates-id'}]) assert.throws(() => check(page([row])));
  assert.throws(() => check({...page([member()]), tool: 'search_members'}));
});
test('accepted output is detached from the caller object', () => {
  const raw = page([member()]); const accepted = check(raw); raw.matches[0].display = 'Changed'; assert.equal(accepted.matches[0].display, 'Example Person');
});
