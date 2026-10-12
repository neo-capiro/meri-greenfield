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
const envelope = (id, state = 'disabled', data = null) => ({ tool: id, state, explanation: state === 'denied' ? 'Not available for this client.' : 'Synthetic source refusal; no absence or current authority established.', asOf: ASOF, data });
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
    assert.throws(() => output(id, { ...envelope(id, 'denied'), explanation: 'This client exists but has a private wall.' }));
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

const counts = () => ({ activeGrants: null, activeContracts: null, saved: null, pursuing: null, dismissed: null, deadlinesIn30Days: null });
function clientContext() { return { clientId: CLIENT, counts: counts(), nextDeadline: null, missingProfileFields: null, freshness: [], emptyReason: null, emptyExplanation: null, topGrants: [], topContracts: [] }; }
function brief(source = 'sam_gov') { return { ref: { source, sourceRecordId: RECORD }, title: 'Synthetic opportunity', agency: null, kind: source === 'sam_gov' ? 'solicitation' : 'grant', isActive: true, isPursuable: true, responseDeadline: null, responseDeadlineNote: null, relevanceScore: null, eligibility: { state: 'unknown', reason: 'Synthetic scope; source verification absent.' }, recommendation: null, humanDecision: null, workflowStatus: null, sourceUrl: null, sourceUpdatedAt: null }; }
function contextOutput(data, truncated) { const value = envelope(OPS[3], 'available', data); if (truncated) value.truncated = truncated; return output(OPS[3], value); }

test('client context retains nullable counts and current client identity without made-up zeroes', () => {
  const data = clientContext(); assert.doesNotThrow(() => contextOutput(data));
  assert.throws(() => contextOutput({ ...data, clientId: RECORD }));
  const missing = clone(data); delete missing.counts.activeContracts; assert.throws(() => contextOutput(missing));
  assert.throws(() => contextOutput({ ...data, authorized: true }));
});
test('client context separately caps each source at five without claiming complete source coverage', () => {
  const data = clientContext(); data.topGrants = Array.from({ length: 5 }, () => brief('grants_gov')); data.topContracts = Array.from({ length: 5 }, () => brief());
  assert.doesNotThrow(() => contextOutput(data));
  assert.doesNotThrow(() => contextOutput(data, [{ collection: 'topGrants', kept: 5, total: 6 }]));
  assert.throws(() => contextOutput(data, [{ collection: 'topGrants', kept: 4, total: 6 }]));
  data.topContracts.push(brief()); assert.throws(() => contextOutput(data));
});
test('client context keeps grant and contract collections separate and preserves legacy decision null audits', () => {
  const data = clientContext(); const row = brief();
  row.humanDecision = { decision: 'monitor', reason: null, decidedAt: null, decidedByUserId: null, nextAction: null, nextActionDueAt: null };
  data.topContracts = [row]; assert.doesNotThrow(() => contextOutput(data));
  data.topGrants = [brief()]; assert.throws(() => contextOutput(data));
});

function facts(source = 'sam_gov') {
  const sam = source === 'sam_gov';
  return { ...brief(source), clientId: CLIENT, sourceReference: null, subAgency: null, office: null, status: null, kindRaw: null, baseKind: null, closeOrArchiveDate: null, postedDate: null,
    summary: 'A😀B', summaryIsLink: false, naicsCodes: [], pscCodes: [], setAside: null, setAsideCode: null, setAsideDescription: null, eligibleApplicantTypes: [], fundingInstrument: null, category: null, assistanceListings: [],
    grantFunding: sam ? null : { estimatedProgramFunding: 1000000.25, awardFloor: 1000, awardCeiling: 25000.75, expectedAwardCount: null, costSharingRequired: null },
    contractValue: sam ? { estimatedValue: null, basis: 'not_stated_by_source' } : null,
    placeOfPerformance: null, acquisitionPosition: null, missingProfileFields: null, matchedSignals: [], districtKey: null, districtBasis: null,
    evidence: { recordRef: `${source}:${RECORD}`, recommendationConfidence: null, confidenceMeaning: 'Canonical recommendation evidence quality, not likelihood of winning or verified eligibility.', disqualifiers: [],
      missingFields: ['sourceUrl', 'sourceUpdatedAt', 'responseDeadline', 'placeOfPerformance', ...(!sam ? ['eligibleApplicantTypes'] : [])], requirements: { state: sam ? 'not_requested' : 'notice_body', tool: sam ? OPS[1] : OPS[2] } },
    summaryRead: { state: 'available', offset: 0, totalCharacters: 4, returnedCharacters: 4, truncated: false, nextOffset: null, sourceUpdatedAt: null } };
}
function detailOutput(data, request = input(OPS[2])) { return output(OPS[2], envelope(OPS[2], 'available', data), request); }
function searchData(rows = []) {
  const criteria = { schemaVersion: 2, mode: 'matched', clientId: CLIENT, query: '', sources: ['grants_gov', 'sam_gov'], types: [], lifecycle: ['active'], deadlineWindow: 'any', deadlineFrom: null, deadlineTo: null, sort: 'deadline', direction: 'asc', page: 1, pageSize: 5 };
  for (const key of ['agencies','sectors','naicsCodes','pscCodes','setAsideCodes','eligibility','posted','geography','applicantTypes','funding','costShare','methods','disbursement','grantPrerequisites','codes']) criteria[key] = [];
  return { clientId: CLIENT, counts: counts(), freshness: [], emptyReason: null, emptyExplanation: null, missingProfileFields: null, criteria, total: rows.length, totalIsCapped: false, page: 1, pageSize: 5,
    generatedAt: '2026-10-12T12:34:58.000Z', opportunities: rows, hasMore: false, nextPage: null,
    coverage: { sources: ['grants_gov', 'sam_gov'], pageCoversMatchedResults: false, totalIsCapped: false, explanation: 'Synthetic queried scope only.', procurementForecasts: { state: 'separate_tool', tool: 'search_procurement_forecasts' } } };
}
function searchOutput(data, request = input(OPS[0])) { return output(OPS[0], envelope(OPS[0], 'available', data), request); }

test('detail binds exact client/source/record and disclosed source update identity', () => {
  const data = facts(); assert.doesNotThrow(() => detailOutput(data));
  for (const patch of [{ clientId: RECORD }, { ref: { source: 'sam_gov', sourceRecordId: CLIENT } }, { sourceUpdatedAt: ASOF }]) assert.throws(() => detailOutput({ ...data, ...patch }));
  assert.throws(() => detailOutput({ ...data, rawProviderPayload: {} }));
});
test('detail UTF-16 paging and beyond-end clamp preserve the original full text length', () => {
  const data = facts(); data.summary = '😀'; data.summaryRead = { ...data.summaryRead, offset: 1, returnedCharacters: 2, truncated: true, nextOffset: 3 };
  assert.doesNotThrow(() => detailOutput(data, { ...input(OPS[2]), summaryOffset: 1, summaryLimit: 2 }));
  data.summaryRead.returnedCharacters = 1; assert.throws(() => detailOutput(data, { ...input(OPS[2]), summaryOffset: 1, summaryLimit: 2 }));
  data.summary = ''; data.summaryRead = { ...data.summaryRead, offset: 4, returnedCharacters: 0, truncated: true, nextOffset: null };
  assert.doesNotThrow(() => detailOutput(data, { ...input(OPS[2]), summaryOffset: 100 }));
  data.summaryRead.offset = 100; assert.throws(() => detailOutput(data, { ...input(OPS[2]), summaryOffset: 100 }));
});
test('detail grant program totals and individual ceilings stay distinct from contract estimates', () => {
  const grant = facts('grants_gov'), request = { ...input(OPS[2]), source: 'grants_gov' };
  assert.doesNotThrow(() => detailOutput(grant, request));
  assert.notEqual(grant.grantFunding.estimatedProgramFunding, grant.grantFunding.awardCeiling);
  grant.contractValue = { estimatedValue: 25000.75, basis: 'source_backed' }; assert.throws(() => detailOutput(grant, request));
  const contract = facts(); contract.grantFunding = facts('grants_gov').grantFunding; assert.throws(() => detailOutput(contract));
  contract.grantFunding = null; contract.contractValue.estimatedValue = 0; assert.throws(() => detailOutput(contract));
  contract.contractValue.basis = 'source_backed'; assert.doesNotThrow(() => detailOutput(contract));
});
test('detail missing facts and eligibility evidence cannot be promoted to verified eligibility or win likelihood', () => {
  const data = facts(); data.eligibility = { state: 'ineligible', reason: 'Synthetic canonical restriction.' };
  assert.throws(() => detailOutput(data));
  data.evidence.disqualifiers = [{ basis: 'canonical_eligibility', reason: data.eligibility.reason }]; assert.doesNotThrow(() => detailOutput(data));
  data.evidence.disqualifiers[0].reason = 'Unrelated reason'; assert.throws(() => detailOutput(data));
  const absent = facts(); absent.evidence.missingFields.pop(); assert.throws(() => detailOutput(absent));
  const promoted = facts(); promoted.evidence.confidenceMeaning = 'Verified eligibility and predicted award likelihood.'; assert.throws(() => detailOutput(promoted));
});
test('search successful raw projection uses its own generation clock and exact request criteria', () => {
  const data = searchData([facts()]); assert.doesNotThrow(() => searchOutput(data));
  assert.notEqual(data.generatedAt, ASOF);
  for (const patch of [{ clientId: RECORD }, { query: 'hidden filter' }, { sources: ['sam_gov'] }, { lifecycle: ['closed'] }, { agencies: ['agency'] }, { queryMatch: 'keywords' }]) {
    assert.throws(() => searchOutput({ ...data, criteria: { ...data.criteria, ...patch } }));
  }
  const alien = clone(data); alien.opportunities[0].clientId = RECORD; assert.throws(() => searchOutput(alien));
});
test('search effective page10000 binds after shared clamp and can report nextPage10001', () => {
  const data = searchData(); data.page = data.criteria.page = 10000; data.total = 50001; data.hasMore = true; data.nextPage = 10001;
  assert.doesNotThrow(() => searchOutput(data, { clientId: CLIENT, page: 100000 }));
  data.criteria.page = 100000; assert.throws(() => searchOutput(data, { clientId: CLIENT, page: 100000 }));
});
test('search five-row cap, null totals and truncation do not imply complete source coverage', () => {
  const data = searchData(Array.from({ length: 5 }, () => facts())); data.total = null; data.hasMore = true; data.nextPage = 2;
  assert.doesNotThrow(() => searchOutput(data));
  data.coverage.pageCoversMatchedResults = true; assert.throws(() => searchOutput(data));
  data.coverage.pageCoversMatchedResults = false; data.opportunities.push(facts()); assert.throws(() => searchOutput(data));
  const capped = searchData(); capped.totalIsCapped = capped.coverage.totalIsCapped = true; capped.coverage.pageCoversMatchedResults = true;
  assert.throws(() => searchOutput(capped));
});
test('context asOf is an inert exact input, not a getter, inherited value or model-selected timestamp', () => {
  let hits = 0; const context = {};
  Object.defineProperty(context, 'asOf', { enumerable: true, get() { hits++; return ASOF; } });
  assert.throws(() => normalize(OPS[0], input(OPS[0]), context)); assert.equal(hits, 0);
  assert.throws(() => normalize(OPS[0], input(OPS[0]), Object.create({ asOf: ASOF })));
  assert.throws(() => normalize(OPS[0], input(OPS[0]), { asOf: ASOF, authorized: true }));
});

test('requirements short page cannot invent an extra-row continuation without a supporting total', () => {
  for (const total of [null, 0, 1]) {
    const data = requirements([requirement()], { pagination: { offset: 0, limit: 10, total, hasMore: true, nextOffset: 1 } });
    assert.throws(() => requirementsOutput(data));
  }
  const plausible = requirements([requirement()], { pagination: { offset: 0, limit: 10, total: 2, hasMore: true, nextOffset: 1 } });
  assert.doesNotThrow(() => requirementsOutput(plausible));
});
