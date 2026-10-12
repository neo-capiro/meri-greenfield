import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const root = process.env.ACQUISITION_REVIEW_ROOT ?? path.resolve(import.meta.dirname, '../../..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'packages/contracts/retrieval-0.2/acquisition-personnel.schema.json')));
const { createAcquisitionPersonnelValidators } = await import(pathToFileURL(path.join(root, 'packages/contracts/retrieval-0.2/acquisition-personnel-validation.mjs')));
const ajv = new Ajv({ strict: true, allErrors: true }); addFormats(ajv); ajv.addSchema(schema);
const v = createAcquisitionPersonnelValidators({ schema, validateShape(definition, value) {
  const fn = ajv.getSchema(`${schema.$id}#/$defs/${definition}`); assert.ok(fn);
  if (!fn(value)) throw new Error(ajv.errorsText(fn.errors));
} });
const [LIST, DETAIL] = ['search_acquisition_personnel', 'get_acquisition_person'];
const OPS = [LIST, DETAIL], UUID = '12345678-abcd-0123-0456-123456789abc', OTHER = '87654321-abcd-0123-0456-123456789abc';
const NOW = '2026-10-12T12:00:00.000Z', OLD = '2026-10-11T12:00:00.000Z';
const STANDARD = { actorRole: 'standard_user' }, ADMIN = { actorRole: 'capiro_admin' };
const request = id => id === LIST ? {} : { id: UUID };
const normalize = (id, input = request(id), context = STANDARD) => v.normalizeAcquisitionPersonnelInput(id, input, context);
const check = (id, output, input = request(id), context = STANDARD) => v.assertAcquisitionPersonnelOutput(id, output, input, context);
const core = () => ({ id: UUID, fullName: 'Synthetic Person', service: null, organization: null, title: null, role: null, pePrimary: null, peSecondary: [], emailDomain: null, email: null, phone: null, parentOffice: null, department: null, publicProfileUrl: null, confidence: 0.5, status: 'reported-status', firstSeenAt: NOW, lastSeenAt: OLD });
const listRow = () => ({ ...core(), headshotUrl: null, sourceCount: 0 });
const mention = () => ({ id: OTHER, source: 'Synthetic source', sourceUrl: null, snippet: null, observedAt: NOW, confidence: -5, metadata: null });
const person = () => ({ ...core(), nameKey: 'synthetic person', programOfRecord: null, metadata: null, sources: [] });
const result = id => id === LIST ? { tool: id, generatedAt: NOW, data: [listRow()], total: 1, page: 1, limit: 20 } : { tool: id, generatedAt: NOW, person: person() };
const subject = (id, output) => id === LIST ? output.data[0] : output.person;
for (const id of OPS) {
  test(`${id}: current role required, exact and model independent`, () => {
    assert.throws(() => v.normalizeAcquisitionPersonnelInput(id, request(id)));
    for (const actorRole of [undefined, null, '', 'admin', 'administrator', 'CAPiRO_ADMIN', 'capiro_admin ']) assert.throws(() => normalize(id, request(id), { actorRole }));
    for (const key of ['actorRole', 'tenantId', 'actorId', 'authorized', 'asOf']) assert.throws(() => normalize(id, { ...request(id), [key]: 'capiro_admin' }));
    for (const actorRole of ['capiro_admin', 'user_admin', 'standard_user', 'client_portal_user']) assert.doesNotThrow(() => check(id, result(id), request(id), { actorRole }));
    assert.throws(() => normalize(id, request(id), { ...STANDARD, authorized: true }));
  });
  test(`${id}: only exact current capiro_admin admits each contact field`, () => {
    for (const field of ['email', 'phone', 'parentOffice', 'department']) {
      const output = result(id); subject(id, output)[field] = field === 'email' ? 'synthetic@example.invalid' : 'Reported value';
      if (id === DETAIL && field !== 'email') output.person.metadata = { uploadedDirectoryContact: { [field]: 'Reported value' } };
      assert.doesNotThrow(() => check(id, output, request(id), ADMIN));
      for (const actorRole of ['user_admin', 'standard_user', 'client_portal_user']) assert.throws(() => check(id, output, request(id), { actorRole }));
    }
  });
  test(`${id}: hostile request/context/result objects are inert`, () => {
    let hooks = 0;
    const context = Object.defineProperty({}, 'actorRole', { enumerable: true, get() { hooks++; return 'capiro_admin'; } });
    assert.throws(() => normalize(id, request(id), context));
    assert.throws(() => normalize(id, request(id), new Proxy(ADMIN, { ownKeys() { hooks++; return []; } })));
    const output = result(id); Object.defineProperty(subject(id, output), 'email', { enumerable: true, get() { hooks++; return null; } });
    assert.throws(() => check(id, output));
    const input = request(id); Object.defineProperty(input, 'toJSON', { value() { hooks++; return {}; } });
    assert.throws(() => normalize(id, input)); assert.equal(hooks, 0);
  });
  test(`${id}: immutable normalized snapshot and closed projections`, () => {
    const input = request(id), out = normalize(id, input);
    assert.ok(Object.isFrozen(out)); assert.ok(Object.isFrozen(out.input)); assert.ok(Object.isFrozen(out.metadata));
    for (const flag of ['authoritative', 'sourceConnected', 'producerQualified', 'absenceEvidence']) assert.equal(out.metadata[flag], false);
    for (const extra of ['approved', 'complete', 'auditWritten']) assert.throws(() => check(id, { ...result(id), [extra]: true }));
    for (const key of Object.keys(subject(id, result(id)))) { const output = result(id); delete subject(id, output)[key]; assert.throws(() => check(id, output), key); }
    assert.throws(() => check(id, { ...result(id), tool: OPS.find(other => other !== id) }));
  });
  test(`${id}: finite dates, unconstrained stored status/confidence and no invented first-last order`, () => {
    const output = result(id); subject(id, output).confidence = -12.5;
    assert.doesNotThrow(() => check(id, output));
    subject(id, output).confidence = 100; assert.doesNotThrow(() => check(id, output));
    subject(id, output).confidence = Infinity; assert.throws(() => check(id, output));
    for (const key of ['firstSeenAt', 'lastSeenAt']) { const bad = result(id); subject(id, bad)[key] = '2026-02-30T00:00:00.000Z'; assert.throws(() => check(id, bad)); }
    assert.throws(() => check(id, { ...result(id), generatedAt: '2026-10-12T12:00:00Z' }));
  });
}
test('list: defaults, strict page/limit and no owner-only model selectors', () => {
  const out = normalize(LIST); assert.equal(out.input.page, 1); assert.equal(out.input.limit, 20);
  for (const page of [0, 101, '2', null, 1.1]) assert.throws(() => normalize(LIST, { page }));
  for (const limit of [0, 51, '2', null, 1.1]) assert.throws(() => normalize(LIST, { limit }));
  for (const key of ['include_superseded', 'pe_aligned', 'sort', 'pe_code']) assert.throws(() => normalize(LIST, { [key]: true }));
  const output = result(LIST); output.page = 2; assert.throws(() => check(LIST, output));
  output.page = 1; output.limit = 2; assert.throws(() => check(LIST, output));
});
test('list: query precedence and UTF-16 normalization', () => {
  const canonical = normalize(LIST, { query: '  wanted  ', q: 'ignored' }).input;
  assert.equal(canonical.query ?? canonical.q, 'wanted');
  const fallback = normalize(LIST, { query: ' \n ', q: ' fallback ' }).input;
  assert.equal(fallback.query ?? fallback.q, 'fallback');
  for (const [field, cap] of [['query', 240], ['service', 60], ['organization', 200], ['role', 60], ['peCode', 32]]) {
    const out = normalize(LIST, { [field]: ' ' + 'a'.repeat(cap - 1) + '😀 rest ' }).input;
    assert.equal(out[field], 'a'.repeat(cap - 1) + '\ud83d');
  }
});
test('list: fuzzy total is paged candidate count, no-query count can race', () => {
  assert.doesNotThrow(() => check(LIST, { ...result(LIST), total: 0 }));
  const out = { ...result(LIST), page: 100, limit: 1, total: 1 };
  assert.doesNotThrow(() => check(LIST, out, { query: 'person', page: 100, limit: 1 }));
  assert.throws(() => check(LIST, { ...out, total: 2 }, { query: 'person', page: 100, limit: 1 }));
  assert.throws(() => check(LIST, { ...out, total: 0 }, { query: 'person', page: 100, limit: 1 }));
  assert.doesNotThrow(() => check(LIST, { ...out, data: [], total: 1 }, { query: 'person', page: 100, limit: 1 }));
  assert.throws(() => check(LIST, { ...out, hasMore: true }, { query: 'person', page: 100, limit: 1 }));
});
test('list: exact scalar and either-PE filter binding with independent role authority', () => {
  const out = result(LIST); Object.assign(out.data[0], { service: 'Army', role: 'capiro_admin', peSecondary: ['PE-1'] });
  assert.doesNotThrow(() => check(LIST, out, { service: ' Army ', role: 'capiro_admin', peCode: 'PE-1' }));
  assert.throws(() => check(LIST, out, { service: 'Navy' }));
  assert.throws(() => check(LIST, out, { role: 'other' }));
  assert.throws(() => check(LIST, out, { peCode: 'PE-2' }));
  out.data[0].email = 'synthetic@example.invalid'; assert.throws(() => check(LIST, out, { role: 'capiro_admin' }));
});
test('list: headshot preserves untyped JSON values without URL or privacy fiction', () => {
  for (const headshotUrl of [null, '', false, 0, [], ['untyped'], { uploadedDirectoryContact: { phone: 'opaque' } }]) {
    const out = result(LIST); out.data[0].headshotUrl = headshotUrl; assert.doesNotThrow(() => check(LIST, out));
  }
  const out = result(LIST); out.data[0].headshotUrl = { deep: undefined }; assert.throws(() => check(LIST, out));
});
test('list: uploaded contact fields are trimmed nonempty strings, email stays stored', () => {
  const out = result(LIST); out.data[0].email = ''; assert.doesNotThrow(() => check(LIST, out, {}, ADMIN));
  for (const key of ['phone', 'parentOffice', 'department']) for (const value of ['', ' x ', '\t', 5, {}]) {
    const valueOut = result(LIST); valueOut.data[0][key] = value; assert.throws(() => check(LIST, valueOut, {}, ADMIN));
  }
});
test('detail: UUID normalization has no version/variant assumption and binds returned person', () => {
  assert.equal(normalize(DETAIL, { id: ` ${UUID.toUpperCase()} ` }).input.id, UUID);
  assert.doesNotThrow(() => check(DETAIL, result(DETAIL), { id: UUID.toUpperCase() }));
  const nil = '00000000-0000-0000-0000-000000000000', out = result(DETAIL); out.person.id = nil;
  assert.doesNotThrow(() => check(DETAIL, out, { id: nil }));
  assert.throws(() => check(DETAIL, result(DETAIL), { id: OTHER }));
  assert.throws(() => check(DETAIL, { ...result(DETAIL), person: null }));
  for (const id of ['', 'not-uuid', null, 123]) assert.throws(() => normalize(DETAIL, { id }));
});
test('detail: non-admin object metadata must omit both protected keys regardless of value', () => {
  for (const key of ['uploadedDirectoryContact', 'uploadedDirectoryPrevious']) for (const value of [null, {}, [], '', false, 0]) {
    const out = result(DETAIL); out.person.metadata = { [key]: value };
    assert.throws(() => check(DETAIL, out));
    assert.doesNotThrow(() => check(DETAIL, out, request(DETAIL), ADMIN));
  }
});
test('detail: established redaction is shallow and preserves nonobject/source metadata', () => {
  for (const metadata of [null, false, 0, '', 'opaque', [], [{ uploadedDirectoryContact: 'opaque' }], { nested: { uploadedDirectoryPrevious: 'opaque' } }]) {
    const out = result(DETAIL); out.person.metadata = metadata; out.person.sources = [{ ...mention(), metadata: { uploadedDirectoryContact: { phone: 'opaque' } } }];
    assert.doesNotThrow(() => check(DETAIL, out));
  }
});
test('detail: admin uploaded contact projection corresponds exactly to raw metadata', () => {
  for (const key of ['phone', 'parentOffice', 'department']) {
    const out = result(DETAIL); out.person.metadata = { uploadedDirectoryContact: { [key]: '  Contact value  ' } }; out.person[key] = 'Contact value';
    assert.doesNotThrow(() => check(DETAIL, out, request(DETAIL), ADMIN));
    out.person[key] = 'different'; assert.throws(() => check(DETAIL, out, request(DETAIL), ADMIN));
    out.person[key] = null; assert.throws(() => check(DETAIL, out, request(DETAIL), ADMIN));
  }
  for (const contact of [null, [], 'x', false, { phone: '' }, { phone: {} }]) {
    const out = result(DETAIL); out.person.metadata = { uploadedDirectoryContact: contact }; assert.doesNotThrow(() => check(DETAIL, out, request(DETAIL), ADMIN));
  }
});
test('detail: no invented source cap, chronology/identity stays meaningful', () => {
  const out = result(DETAIL); out.person.sources = Array.from({ length: 51 }, (_, i) => ({ ...mention(), id: `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000` }));
  assert.doesNotThrow(() => check(DETAIL, out));
  out.person.sources[1].id = out.person.sources[0].id; assert.throws(() => check(DETAIL, out));
  out.person.sources = [{ ...mention(), observedAt: OLD }, { ...mention(), id: UUID, observedAt: NOW }]; assert.throws(() => check(DETAIL, out));
  out.person.sources.reverse(); assert.doesNotThrow(() => check(DETAIL, out));
});
