// Explicit reviewed continuation allowlist; historical baseline hashes stay unchanged.
const continuationIds = ["search_cbo_cost_estimates", "search_federal_grants", "search_federal_awards", "search_gao_reports", "search_state_bills", "get_state_legislator", "search_crs_reports", "query_economic_data", "get_district_nexus_context", "get_district_nexus_changes", "read_client_documents", "search_funding_opportunities", "get_funding_opportunity_requirements", "get_funding_opportunity", "get_opportunity_client_context", "get_opportunity_government_landscape", "search_sec_filings", "search_fara_registrations", "search_lda_filings", "search_acquisition_personnel", "get_acquisition_person", "get_bill_status", "search_floor_votes", "search_congress_bills", "read_bill_text", "get_committee_roster", "list_members", "get_pe_contractors", "get_pe_bills", "get_pe_report_language", "get_state_rule_status", "get_certification_status", "search_intel_articles", "list_global_datasets", "get_representation"];
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {resolveOperationContract, assertCatalog} from '../retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../validate.mjs';

const registry = () => resolveOperationContract({id: 'lookup_client_registry', version: '0.2.0'});
const value = () => ({existingClient: null, ldaExactMatch: null, ldaCandidates: [], guidance: 'Inert synthetic compatibility data.'});
const additions = ['lookup_client_registry', 'get_business_development_context',
  'get_business_development_evidence', 'get_business_development_recent_changes',
  'get_research_portfolio', 'get_research_portfolio_changes'];

test('selected read additions preserve every prior descriptor and original accepted boundary', () => {
  // Literal hashes of accepted PR22 catalog content, computed independently of
  // the new registry. Adding descriptors must not silently rewrite old contracts.
  assert.equal(canonicalSha256(catalog.operations.filter(row => !additions.includes(row.operation.id)&&!continuationIds.includes(row.operation.id))),
    '7302157d3d1059774b198b48f47591db55b85fa63a1bf025d2741ec4b1187b2b');
  assert.equal(canonicalSha256(catalog.originals.map(({id, disposition, boundary}) => ({id, disposition, boundary}))),
    '3cdea92ff8d789f30b540af232f92cca5d239412278cb4a1f78374f4a29fe392');
  for (const id of additions) {
    const original = catalog.originals.find(row => row.id === id);
    assert.equal(original.state, 'mapped');
    assert.deepEqual(original.replacement, {id, version: '0.2.0'});
    const {descriptor} = resolveOperationContract(original.replacement);
    assert.equal(descriptor.handler, null); assert.equal(descriptor.availability, 'unimplemented');
    assert.equal(descriptor.qualification, 'pending'); assert.equal(descriptor.sideEffect, 'none');
  }
  assert.equal(catalog.operations.length, 56);
  assert.equal(catalog.originals.filter(row => row.state === 'mapped').length, 55);
  assert.equal(catalog.originals.filter(row => row.disposition === 'selected' && row.state === 'pending').length, 41);
  for (const id of ['query_action_items', 'get_research_evidence']) {
    assert.equal(catalog.originals.find(row => row.id === id).state, 'pending');
    assert.equal(catalog.originals.find(row => row.id === id).replacement, null);
  }
});

test('canonical registry binding hashes the normalized name and preserves original arguments', () => {
  assertCatalog(catalog);
  const request = {name: '  Synthetic  '}, result = registry().normalizeInput(request);
  assert.deepEqual(result.request, request);
  assert.deepEqual(result.input, {name: 'Synthetic'});
  assert.equal(result.argumentsSha256, canonicalSha256({name: 'Synthetic'}));
  assert.notEqual(result.argumentsSha256, canonicalSha256(request));
  assert.equal(result.metadata, null); assert.ok(Object.isFrozen(result.input));
});

test('canonical registry output path requires a valid original request and closed result', () => {
  assert.deepEqual(registry().assertOutput(value(), {request: {name: 'Synthetic'}}), value());
  assert.throws(() => registry().assertOutput(value(), {}));
  assert.throws(() => registry().assertOutput(value(), {request: {name: 'Synthetic', tenantId: 'injected'}}));
  assert.throws(() => registry().assertOutput({...value(), created: true}, {request: {name: 'Synthetic'}}));
  let reads = 0;
  const hostile = {...value(), get guidance() {reads++; return 'execute';}};
  assert.throws(() => registry().assertOutput(hostile, {request: {name: 'Synthetic'}}));
  assert.equal(reads, 0);
});

test('registry mapping leaves creation deferred and cannot advertise an executable operation', () => {
  const descriptor = registry().descriptor;
  assert.equal(descriptor.handler, null); assert.equal(descriptor.availability, 'unimplemented');
  assert.equal(descriptor.qualification, 'pending'); assert.equal(descriptor.sideEffect, 'none');
  assert.equal(descriptor.approvalBoundary, 'none'); assert.equal(descriptor.retry.maxRetries, 0);
  const creation = catalog.originals.find(row => row.id === 'create_client');
  assert.equal(creation.disposition, 'deferred'); assert.equal(creation.replacement, null);
});

const uuid = '11111111-1111-4111-8111-111111111111';
const resolve = id => resolveOperationContract({id, version: '0.2.0'});
const portfolioContext = () => ({
  binding: {tenantId: 'synthetic', actorId: 'reader', conversationId: uuid, runId: uuid,
    attemptId: uuid, workerId: uuid, writerFence: 1},
  subject: {kind: 'entity', entityType: 'research-portfolio', entityIds: ['portfolio-one'],
    tenantId: 'synthetic', actorId: 'reader', authorizationDecisionId: uuid,
    policyRevision: 'policy-one', rosterVersionId: null,
    scopes: [{tenantId: 'synthetic', kind: 'tenant', resourceId: 'synthetic', policyRevision: 'policy-one'}]},
});

test('business bindings select their own contract and materialize only the changes limit', () => {
  for (const id of additions.filter(id => id.startsWith('get_business_development_'))) {
    const contract = resolve(id), selected = contract.normalizeInput({conversationId: uuid});
    assert.deepEqual(selected.input, id.endsWith('recent_changes') ? {conversationId: uuid, limit: 10} : {conversationId: uuid});
    assert.equal(selected.argumentsSha256, canonicalSha256(selected.input));
    assert.equal(selected.metadata.authoritative, false); assert.equal(selected.metadata.producerQualified, false);
    assert.equal(selected.metadata.providerCalls, 'unqualified');
    assert.ok(Object.isFrozen(selected.metadata));
    assert.throws(() => contract.normalizeInput({conversationId: uuid, prospectId: uuid}));
    assert.throws(() => contract.assertOutput({}, {request: {conversationId: uuid}}));
  }
  const context = resolve('get_business_development_context');
  const output = {tool: 'get_business_development_context', generatedAt: '2026-10-12T00:00:00.000Z',
    prospect: {id: uuid, displayName: 'Synthetic prospect', ownerUserId: null, stage: 'reported-stage',
      serviceHypothesis: null, geography: null, nextAction: null, canonicalEntityId: null, linkedClientId: null},
    firmPreferences: {practiceServiceAreas: [], agenciesIssues: [], geographies: []},
    history: {entries: [], total: 0, returned: 0, truncated: false}};
  assert.deepEqual(context.assertOutput(output, {request: {conversationId: uuid}}), output);
  for (const id of ['get_business_development_evidence', 'get_business_development_recent_changes'])
    assert.throws(() => resolve(id).assertOutput(output, {request: {conversationId: uuid}}));
});

test('portfolio bindings require canonical trusted context and bind the normalized selection digest', () => {
  const context = portfolioContext();
  for (const id of ['get_research_portfolio', 'get_research_portfolio_changes']) {
    const contract = resolve(id);
    assert.throws(() => contract.normalizeInput({}));
    assert.throws(() => contract.normalizeInput({portfolioId: 'injected'}, context));
    const selected = contract.normalizeInput({}, context);
    assert.equal(selected.input.conversationId, uuid); assert.equal(selected.input.portfolioId, 'portfolio-one');
    assert.equal(selected.argumentsSha256, canonicalSha256(selected.input));
    assert.equal(selected.metadata, null); assert.ok(Object.isFrozen(selected.input));
    assert.throws(() => contract.normalizeInput({}, {...context, actorId: 'injected'}));
  }
  const contract = resolve('get_research_portfolio_changes');
  const output = {...structuredClone(context), data: {items: [], nextCursor: null}};
  assert.deepEqual(contract.assertOutput(output, {...context, request: {}}), output);
  const foreign = structuredClone(output); foreign.binding.writerFence++;
  assert.throws(() => contract.assertOutput(foreign, {...context, request: {}}));
  assert.throws(() => contract.assertOutput(output, {request: {}}));
  assert.throws(() => resolve('get_research_portfolio').assertOutput(output, {...context, request: {}}));
});
