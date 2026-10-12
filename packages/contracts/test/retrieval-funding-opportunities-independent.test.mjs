import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = process.env.FUNDING_REVIEW_ROOT ?? path.resolve(import.meta.dirname, '../../..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'packages/contracts/retrieval-0.2/funding-opportunities.schema.json')));
const { createFundingOpportunitiesValidators } = await import(pathToFileURL(path.join(root, 'packages/contracts/retrieval-0.2/funding-opportunities-validation.mjs')));
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv); ajv.addSchema(schema);
const family = createFundingOpportunitiesValidators({ schema, validateShape(definition, value) {
  const validate = ajv.getSchema(`${schema.$id}#/$defs/${definition}`);
  assert.ok(validate, `missing definition ${definition}`);
  if (!validate(value)) throw new Error(ajv.errorsText(validate.errors));
} });
const OPS = ['search_funding_opportunities', 'get_funding_opportunity_requirements', 'get_funding_opportunity', 'get_opportunity_client_context', 'get_opportunity_government_landscape'];
const CLIENT = '12345678-1234-4234-8234-123456789012';
const RECORD = '87654321-1234-4234-8234-123456789012';
const ASOF = '2026-10-12T12:34:56.000Z';
const options = () => ({ asOf: ASOF });
const input = id => [OPS[0], OPS[3]].includes(id) ? { clientId: CLIENT } : { clientId: CLIENT, source: 'sam_gov', sourceRecordId: RECORD };
const normalize = (id, value = input(id), context = options()) => family.normalizeFundingOpportunitiesInput(id, value, context);
const envelope = (id, state = 'disabled', data = null) => ({ tool: id, state, explanation: 'Synthetic source refusal; no absence or current authority established.', asOf: ASOF, data });
const output = (id, value, request = input(id), context = options()) => family.assertFundingOpportunitiesOutput(id, value, request, context);
const clone = value => JSON.parse(JSON.stringify(value));

for (const id of OPS) {
  test(`${id}: closed immutable input and trusted asOf metadata`, () => {
    const original = input(id), normalized = normalize(id, original);
    assert.ok(Object.isFrozen(normalized)); assert.ok(Object.isFrozen(normalized.input)); assert.ok(Object.isFrozen(normalized.metadata));
    assert.equal(normalized.metadata.asOf, ASOF);
    for (const key of ['authoritative', 'sourceConnected', 'producerQualified', 'absenceEvidence']) assert.equal(normalized.metadata[key], false);
    original.clientId = RECORD; assert.equal(normalized.input.clientId, CLIENT);
    for (const field of ['tenantId', 'actorId', 'authorized', 'asOf', 'unknown']) assert.throws(() => normalize(id, { ...input(id), [field]: ASOF }));
    assert.throws(() => normalize(id, {}));
  });
  test(`${id}: all refusal states remain null-data reports`, () => {
    for (const state of ['disabled', 'denied', 'not_found', 'unsupported_source', 'invalid_request']) {
      assert.doesNotThrow(() => output(id, envelope(id, state)));
      assert.throws(() => output(id, envelope(id, state, {})));
    }
    assert.throws(() => output(id, envelope(id, 'available')));
    assert.throws(() => output(id, envelope(id, 'unavailable')));
    assert.throws(() => output(id, { ...envelope(id), complete: true }));
  });
  test(`${id}: exact operation and trusted instant binding`, () => {
    assert.throws(() => output(id, { ...envelope(id), tool: OPS[(OPS.indexOf(id) + 1) % OPS.length] }));
    assert.throws(() => output(id, { ...envelope(id), asOf: '2026-10-12T12:34:57.000Z' }));
    for (const asOf of [undefined, null, '', 'not-a-time', '2026-10-12T12:34:56Z', '2026-10-12T13:34:56.000+01:00', '2026-12-31T23:59:60.000Z']) {
      assert.throws(() => normalize(id, input(id), { asOf }));
    }
    assert.throws(() => family.normalizeFundingOpportunitiesInput(id, input(id)));
  });
  test(`${id}: hostile request/result observations do not run`, () => {
    let hits = 0; const request = input(id);
    Object.defineProperty(request, 'clientId', { enumerable: true, get() { hits++; return CLIENT; } });
    assert.throws(() => normalize(id, request));
    const result = envelope(id); Object.defineProperty(result, 'state', { enumerable: true, get() { hits++; return 'disabled'; } });
    assert.throws(() => output(id, result));
    assert.throws(() => normalize(id, new Proxy(input(id), { ownKeys() { hits++; return []; } })));
    assert.equal(hits, 0);
  });
}

test('search defaults, trimming and effective shared page clamp', () => {
  const value = normalize(OPS[0]).input;
  assert.equal(value.query, ''); assert.equal(value.page, 1); assert.equal(value.pageSize, 5); assert.equal(value.activeState, 'active');
  assert.equal(Object.hasOwn(value, 'source'), false);
  const effective = normalize(OPS[0], { clientId: CLIENT, query: '  launch  ', page: 100000 }).input;
  assert.equal(effective.query, 'launch'); assert.equal(effective.page, 10000);
  for (const page of [0, 100001, 1.5, '1']) assert.throws(() => normalize(OPS[0], { clientId: CLIENT, page }));
  for (const pageSize of [0, 6, 1.5, '5']) assert.throws(() => normalize(OPS[0], { clientId: CLIENT, pageSize }));
});
test('search raw query ceiling uses UTF-16 before trimming', () => {
  for (const query of ['a'.repeat(500), '😀'.repeat(250)]) assert.doesNotThrow(() => normalize(OPS[0], { clientId: CLIENT, query }));
  for (const query of ['a'.repeat(501), '😀'.repeat(251), ' '.repeat(501)]) assert.throws(() => normalize(OPS[0], { clientId: CLIENT, query }));
});
test('requirements and detail retain distinct paging defaults and bounds', () => {
  assert.equal(normalize(OPS[1]).input.offset, 0); assert.equal(normalize(OPS[1]).input.limit, 10);
  assert.equal(normalize(OPS[2]).input.summaryOffset, 0); assert.equal(normalize(OPS[2]).input.summaryLimit, 1200);
  for (const [id, field, accepted, denied] of [[OPS[1], 'limit', 25, 26], [OPS[1], 'offset', 1000000, 1000001], [OPS[2], 'summaryLimit', 12000, 12001], [OPS[2], 'summaryOffset', 100000000, 100000001]]) {
    assert.doesNotThrow(() => normalize(id, { ...input(id), [field]: accepted }));
    assert.throws(() => normalize(id, { ...input(id), [field]: denied }));
    assert.throws(() => normalize(id, { ...input(id), [field]: String(accepted) }));
  }
});
test('envelope ceiling is exact serialized UTF-16 characters', () => {
  for (const fill of ['x', '😀']) {
    const value = envelope(OPS[0]); value.explanation = '';
    const room = 24000 - JSON.stringify(value).length;
    value.explanation = fill.repeat(Math.floor(room / fill.length)) + 'x'.repeat(room % fill.length);
    assert.equal(JSON.stringify(value).length, 24000); assert.doesNotThrow(() => output(OPS[0], value));
    value.explanation += 'x'; assert.throws(() => output(OPS[0], value));
  }
});
test('all direct selectors reject prototype aliases and nonread operations', () => {
  for (const id of ['toString', '__proto__', 'constructor', 'review_funding_opportunity', 'build_opportunity_action_plan']) {
    assert.throws(() => family.fundingOpportunitiesInputDefinition(id));
    assert.throws(() => family.fundingOpportunitiesOutputDefinition(id));
  }
});

function requirement(overrides = {}) {
  return { id: RECORD, attachmentId: null, requirementType: 'eligibility', statement: 'Synthetic statement', sourceExcerpt: 'A😀B', excerptStart: 2, excerptEnd: 6, sourcePage: null, fileName: null, extractionMethod: 'future_reader', extractionModel: 'synthetic-model', confidence: 'future_confidence', reviewStatus: 'pending', supersededAt: null, ...overrides };
}
function requirements(rows = [], overrides = {}) {
  return { source: 'sam_gov', sourceRecordId: RECORD, requirements: rows, coverage: rows.length ? 'available' : 'no_documents', coverageExplanation: 'Synthetic observed coverage only.', documentTextStatus: [], generatedAt: ASOF,
    pagination: { offset: 0, limit: 10, total: rows.length, hasMore: false, nextOffset: null }, ...overrides };
}
function requirementsOutput(data, request = input(OPS[1])) { return output(OPS[1], envelope(OPS[1], 'available', data), request); }

test('requirements nullable provenance, declared read vocabulary and review status remain separate', () => {
  for (const reviewStatus of ['pending', 'accepted', 'rejected']) {
    assert.doesNotThrow(() => requirementsOutput(requirements([requirement({ reviewStatus, requirementType: 'future_type' })])));
  }
  assert.throws(() => requirementsOutput(requirements([requirement({ reviewStatus: 'approved_by_model' })])));
  assert.doesNotThrow(() => requirementsOutput(requirements([requirement({ supersededAt: '2026-10-10T01:00:00.000Z', reviewStatus: 'rejected' })])));
  const extra = requirement({ isApprovedEvidence: true }); assert.throws(() => requirementsOutput(requirements([extra])));
});
test('requirements content span counts UTF-16 and forbids malformed or substituted spans', () => {
  assert.doesNotThrow(() => requirementsOutput(requirements([requirement()])));
  for (const patch of [{ excerptEnd: 5 }, { excerptStart: -1 }, { excerptEnd: 2 }, { excerptStart: 1.5 }]) {
    assert.throws(() => requirementsOutput(requirements([requirement(patch)])));
  }
});
test('requirements bind exact source, record, generation instant, offset and limit', () => {
  const good = requirements([requirement()]); assert.doesNotThrow(() => requirementsOutput(good));
  for (const patch of [{ source: 'grants_gov' }, { sourceRecordId: CLIENT }, { generatedAt: '2026-10-12T12:34:57.000Z' }]) assert.throws(() => requirementsOutput({ ...good, ...patch }));
  for (const patch of [{ offset: 1 }, { limit: 9 }, { nextOffset: 1 }]) assert.throws(() => requirementsOutput({ ...good, pagination: { ...good.pagination, ...patch } }));
});
test('requirements stale or unavailable total does not erase retained rows or extra-row continuation', () => {
  const data = requirements([requirement()], { pagination: { offset: 8, limit: 1, total: 0, hasMore: true, nextOffset: 9 } });
  const request = { ...input(OPS[1]), offset: 8, limit: 1 };
  assert.doesNotThrow(() => requirementsOutput(data, request));
  data.pagination.total = null; assert.doesNotThrow(() => requirementsOutput(data, request));
  data.pagination.nextOffset = 10; assert.throws(() => requirementsOutput(data, request));
});
test('empty exhausted requirements can remain available with an independent positive total', () => {
  const data = requirements([], { coverage: 'available', pagination: { offset: 10, limit: 10, total: 5, hasMore: false, nextOffset: null } });
  assert.doesNotThrow(() => requirementsOutput(data, { ...input(OPS[1]), offset: 10 }));
  data.pagination.hasMore = true; data.pagination.nextOffset = 10;
  assert.throws(() => requirementsOutput(data, { ...input(OPS[1]), offset: 10 }));
});
test('requirements retain nonavailable coverage states without claiming absence beyond observed documents', () => {
  for (const coverage of ['no_documents', 'no_text', 'read_none_found']) {
    const data = requirements([], { coverage });
    assert.doesNotThrow(() => requirementsOutput(data));
    assert.throws(() => requirementsOutput({ ...data, complete: true }));
  }
});
test('requirements page max25 and paging row count are actual request constraints', () => {
  const rows = Array.from({ length: 25 }, (_, i) => requirement({ id: `row-${i}` }));
  const data = requirements(rows, { pagination: { offset: 0, limit: 25, total: 25, hasMore: false, nextOffset: null } });
  assert.doesNotThrow(() => requirementsOutput(data, { ...input(OPS[1]), limit: 25 }));
  data.requirements.push(requirement()); data.pagination.total = 26;
  assert.throws(() => requirementsOutput(data, { ...input(OPS[1]), limit: 25 }));
});

const LANDSCAPE_SOURCES = ['program_element', 'budget_movement', 'client_facility', 'congressional_district', 'legislation', 'hearing', 'regulation', 'committee', 'acquisition_personnel', 'reviewed_relationship', 'client_priority'];
const WIRED = new Set(['program_element', 'client_facility', 'congressional_district']);
function landscape(items = [], total = items.length) {
  const sources = LANDSCAPE_SOURCES.map(source => ({ source, state: source === 'program_element' && total ? 'available' : WIRED.has(source) ? 'empty' : 'not_wired', itemCount: source === 'program_element' ? total : 0, explanation: 'Synthetic source coverage.' }));
  return { fingerprint: items.length ? 'a'.repeat(64) : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', coverage: { available: total ? 1 : 0, wired: 3, declared: 11 }, sources, items };
}
function landscapeItem(i = 0) { return { source: 'program_element', sourceId: `pe-${i}`, label: 'Synthetic program', basis: 'source_backed', matchedOn: 'synthetic-code', evidenceRef: null, asOf: null }; }
function landscapeOutput(data, truncated) { const value = envelope(OPS[4], 'available', data); if (truncated) value.truncated = truncated; return output(OPS[4], value); }

test('landscape keeps all11 declared sources and distinguishes three wired empty sources', () => {
  const data = landscape(); assert.doesNotThrow(() => landscapeOutput(data));
  for (const patch of [{ available: 1 }, { wired: 11 }, { declared: 10 }]) assert.throws(() => landscapeOutput({ ...data, coverage: { ...data.coverage, ...patch } }));
  const duplicate = clone(data); duplicate.sources[1] = clone(duplicate.sources[0]); assert.throws(() => landscapeOutput(duplicate));
});
test('landscape pre-truncation counts and retained fingerprint need not equal returned40-row slice', () => {
  const items = Array.from({ length: 40 }, (_, i) => landscapeItem(i));
  const data = landscape(items, 41);
  assert.doesNotThrow(() => landscapeOutput(data, [{ collection: 'items', kept: 40, total: 41 }]));
  assert.throws(() => landscapeOutput(data));
  assert.throws(() => landscapeOutput(data, [{ collection: 'items', kept: 39, total: 41 }]));
  assert.throws(() => landscapeOutput(data, [{ collection: 'items', kept: 40, total: 40 }]));
  data.items.push(landscapeItem(40)); assert.throws(() => landscapeOutput(data, [{ collection: 'items', kept: 41, total: 42 }]));
});
test('landscape never upgrades unknown provenance or inferred basis to stronger source evidence', () => {
  const data = landscape([landscapeItem()]); data.items[0].basis = 'inferred';
  assert.doesNotThrow(() => landscapeOutput(data));
  data.items[0].basis = 'verified'; assert.throws(() => landscapeOutput(data));
  data.items[0].basis = 'inferred'; data.items[0].approvedEvidence = true; assert.throws(() => landscapeOutput(data));
});
test('landscape fingerprint grammar and unknown packet authority fields refuse', () => {
  const data = landscape();
  for (const fingerprint of ['', 'a'.repeat(63), 'g'.repeat(64)]) assert.throws(() => landscapeOutput({ ...data, fingerprint }));
  assert.throws(() => landscapeOutput({ ...data, clientId: CLIENT }));
  assert.throws(() => landscapeOutput({ ...data, generatedAt: ASOF }));
});
