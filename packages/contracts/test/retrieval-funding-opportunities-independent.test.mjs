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
