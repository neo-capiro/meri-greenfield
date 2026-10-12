import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const root = process.env.PUBLIC_REPORTS_REVIEW_ROOT ?? path.resolve(import.meta.dirname, '../../..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'packages/contracts/retrieval-0.2/public-reports.schema.json')));
const { createPublicReportsValidators } = await import(pathToFileURL(path.join(root, 'packages/contracts/retrieval-0.2/public-reports-validation.mjs')));
const ajv = new Ajv({ strict: true, allErrors: true }); addFormats(ajv); ajv.addSchema(schema);
const family = createPublicReportsValidators({ schema, validateShape(definition, value) {
  const validate = ajv.getSchema(`${schema.$id}#/$defs/${definition}`); assert.ok(validate);
  if (!validate(value)) throw new Error(ajv.errorsText(validate.errors));
} });
const [CBO, GAO, CRS] = ['search_cbo_cost_estimates', 'search_gao_reports', 'search_crs_reports'];
const OPS = [CBO, GAO, CRS], NOW = '2026-10-12T12:34:56.000Z';
const normalize = (id, request = {}) => family.normalizePublicReportsInput(id, request);
const check = (id, value, request = {}) => family.assertPublicReportsOutput(id, value, request);
const cboRow = () => ({ id: 'estimate1', billId: null, congress: 119, billType: 'hr', billNumber: '1', title: 'Stored title', description: null, pubDate: NOW, cboUrl: 'https://example.test/cbo' });
const gaoRow = () => ({ id: 'GAO-1', title: 'Stored report', url: null, publishDate: null, reportType: null, topics: [], agencies: [], summary: '', recommendations: null });
const crsRow = () => ({ id: 'R00001', title: 'Stored report', date: null, authors: [], topics: [], summary: '', pdfUrl: null, htmlUrl: null });
const row = id => id === CBO ? cboRow() : id === GAO ? gaoRow() : crsRow();
const result = (id, rows = [row(id)]) => id === CBO ? { tool: id, generatedAt: NOW, estimatesFound: rows.length, estimates: rows } : { tool: id, generatedAt: NOW, total: rows.length, data: rows };
const noCboNote = 'No CBO cost estimates matched. Say so explicitly — do not estimate or guess a score.';
const cboEmpty = (note = noCboNote) => ({ ...result(CBO, []), note });
for (const id of OPS) {
  test(`${id}: closed inputs, defaults and immutable snapshot`, () => {
    const request = { query: '  report  ' }, got = normalize(id, request);
    assert.equal(got.input.query, 'report'); assert.equal(got.input.limit, id === CBO ? 10 : 20);
    assert.ok(Object.isFrozen(got)); assert.ok(Object.isFrozen(got.input));
    request.query = 'changed'; assert.equal(got.input.query, 'report');
    for (const field of ['tenantId', 'actorId', 'asOf', 'authorized', 'unknown']) assert.throws(() => normalize(id, { [field]: 'synthetic' }));
    for (const limit of [0, -1, 1.2, '2', NaN, Infinity, null, id === CBO ? 26 : 51]) assert.throws(() => normalize(id, { limit }));
    assert.equal(normalize(id, { limit: 1 }).input.limit, 1);
  });
  test(`${id}: hostile data stays inert`, () => {
    let touched = 0; const request = {};
    Object.defineProperty(request, 'query', { enumerable: true, get() { touched++; return 'secret'; } });
    assert.throws(() => normalize(id, request));
    assert.throws(() => normalize(id, new Proxy({}, { ownKeys() { touched++; return []; } })));
    const output = result(id); Object.defineProperty(output, 'generatedAt', { enumerable: true, get() { touched++; return NOW; } });
    assert.throws(() => check(id, output));
    assert.throws(() => check(id, new Proxy(result(id), { get() { touched++; return null; } })));
    assert.equal(touched, 0);
    assert.throws(() => normalize(id, Object.create({ query: 'inherited' })));
    const cyclic = {}; cyclic.query = cyclic; assert.throws(() => normalize(id, cyclic));
  });
  test(`${id}: exact envelope, projection and wire date`, () => {
    assert.doesNotThrow(() => check(id, result(id)));
    for (const generatedAt of ['yesterday', '2026-10-12T12:34:56Z', '2026-10-12T12:34:56.000+00:00', '2026-02-30T12:34:56.000Z', null]) assert.throws(() => check(id, { ...result(id), generatedAt }));
    assert.throws(() => check(id, { ...result(id), tool: OPS[(OPS.indexOf(id) + 1) % 3] }));
    assert.throws(() => check(id, { ...result(id), complete: true }));
    assert.throws(() => check(id, result(id, [{ ...row(id), sourceConnected: true }])));
    for (const field of Object.keys(row(id))) { const value = row(id); delete value[field]; assert.throws(() => check(id, result(id, [value])), field); }
  });
  test(`${id}: row limit follows request without hidden source fields`, () => {
    assert.throws(() => check(id, result(id, [row(id), { ...row(id), id: 'second' }]), { limit: 1 }));
    assert.doesNotThrow(() => check(id, result(id, [row(id)]), { limit: 1 }));
    assert.throws(() => check(id, result(id, [{ ...row(id), fullText: 'not projected' }])));
  });
}
test('CBO: empty record note is mandatory and exact', () => {
  assert.doesNotThrow(() => check(CBO, cboEmpty())); assert.throws(() => check(CBO, result(CBO, [])));
  assert.throws(() => check(CBO, cboEmpty('No records, therefore no cost.')));
  assert.throws(() => check(CBO, { ...result(CBO), note: noCboNote }));
  assert.throws(() => check(CBO, { ...result(CBO), estimatesFound: 99 }));
});
test('CBO: source note label precedes lowercase filtering and cap', () => {
  const label = 'HR-1';
  assert.equal(normalize(CBO, { billId: `  ${label}  ` }).input.billId, 'hr-1');
  assert.doesNotThrow(() => check(CBO, cboEmpty(`No CBO cost estimate on record for ${label}. Say so explicitly — do not estimate or guess a score.`), { billId: `  ${label}  ` }));
  assert.throws(() => check(CBO, cboEmpty('No CBO cost estimate on record for hr-1. Say so explicitly — do not estimate or guess a score.'), { billId: label }));
  assert.doesNotThrow(() => check(CBO, cboEmpty(), { billId: '   ' }));
});
test('CBO: Unicode lowercase expansion and code-unit truncation remain producer compatible', () => {
  const billId = 'İ'.repeat(40), normalized = normalize(CBO, { billId });
  assert.equal(normalized.input.billId, 'i\u0307'.repeat(40));
  assert.doesNotThrow(() => check(CBO, cboEmpty(`No CBO cost estimate on record for ${billId}. Say so explicitly — do not estimate or guess a score.`), { billId }));
  assert.equal(normalize(CBO, { query: '😀'.repeat(101) }).input.query, '😀'.repeat(100));
});
test('CBO: filter relationships and stored projection do not invent scores', () => {
  assert.doesNotThrow(() => check(CBO, result(CBO, [{ ...cboRow(), billId: 'hr-1' }]), { billId: 'HR-1', congress: 119 }));
  assert.throws(() => check(CBO, result(CBO), { billId: 'hr-1' }));
  assert.throws(() => check(CBO, result(CBO), { congress: 118 }));
  assert.throws(() => check(CBO, result(CBO, [{ ...cboRow(), cost: 0 }])));
  assert.doesNotThrow(() => check(CBO, result(CBO, [{ ...cboRow(), title: 'x'.repeat(10000), description: 'y'.repeat(10000) }])));
});
for (const id of [GAO, CRS]) {
  test(`${id}: concurrent totals and nullable storage fields`, () => {
    assert.doesNotThrow(() => check(id, { ...result(id), total: 0 }));
    assert.doesNotThrow(() => check(id, { ...result(id, []), total: 50 }));
    assert.throws(() => check(id, { ...result(id), total: -1 }));
    assert.throws(() => check(id, result(id, [{ ...row(id), summary: null }])));
    assert.throws(() => check(id, result(id, [{ ...row(id), title: null }])));
  });
  test(`${id}: UTF-16 excerpt cap accepts exact literal boundary`, () => {
    assert.doesNotThrow(() => check(id, result(id, [{ ...row(id), title: '😀'.repeat(120), summary: '😀'.repeat(200) }])));
    assert.throws(() => check(id, result(id, [{ ...row(id), title: '😀'.repeat(121) }])));
    assert.throws(() => check(id, result(id, [{ ...row(id), summary: '😀'.repeat(201) }])));
    assert.doesNotThrow(() => check(id, result(id, [{ ...row(id), title: 'a'.repeat(236) + '\ud83d...', summary: 'a'.repeat(397) + '...' }])));
  });
  test(`${id}: excerpt normalization rejects impossible whitespace without trimming stored arrays`, () => {
    for (const title of [' leading', 'trailing ', 'two  spaces', 'line\nfeed', 'tab\there']) assert.throws(() => check(id, result(id, [{ ...row(id), title }])));
    assert.doesNotThrow(() => check(id, result(id, [{ ...row(id), title: 'a'.repeat(236) + ' ...', topics: ['  raw stored topic  ', ''] }])));
    assert.doesNotThrow(() => check(id, result(id, [{ ...row(id), title: '', summary: '' }])));
  });
  test(`${id}: nullable date wire representation`, () => {
    const key = id === GAO ? 'publishDate' : 'date';
    assert.doesNotThrow(() => check(id, result(id, [{ ...row(id), [key]: NOW }])));
    for (const value of ['2026-10-12', '2026-02-30T00:00:00.000Z', new Date(NOW)]) assert.throws(() => check(id, result(id, [{ ...row(id), [key]: value }])));
  });
}
test('GAO: reportType exact filter and declared nullable Int', () => {
  assert.doesNotThrow(() => check(GAO, result(GAO, [{ ...gaoRow(), reportType: ' Test ' }])));
  assert.throws(() => check(GAO, result(GAO), { reportType: 'report' }));
  assert.doesNotThrow(() => check(GAO, result(GAO, [{ ...gaoRow(), reportType: 'report', recommendations: -1 }]), { reportType: ' report ' }));
  assert.throws(() => check(GAO, result(GAO, [{ ...gaoRow(), recommendations: 1.5 }])));
});
test('CRS: active-only source selection is not an invented projected flag', () => {
  assert.throws(() => check(CRS, result(CRS, [{ ...crsRow(), active: true }])));
  assert.doesNotThrow(() => check(CRS, result(CRS, [{ ...crsRow(), authors: [' raw author ', ''], pdfUrl: 'stored opaque URL', htmlUrl: '' }])));
});
