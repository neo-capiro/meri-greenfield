import {expectedVerticalBoundary,schemaRelativePath} from './vertical-source-expectations.mjs';
import {fullActionReference} from './backend-execution-expectations.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assertCatalog, resolveOperationContract } from '../retrieval-0.2/validate.mjs';
import { CATALOG_OPERATION_BINDINGS } from '../retrieval-0.2/catalog-validation.mjs';
import { canonicalSha256 } from '../validate.mjs';

const catalog = () => JSON.parse(readFileSync(new URL('../retrieval-0.2/catalog.json', import.meta.url)));
const operation = id => resolveOperationContract({id, version: '0.2.0'});
const added = ['list_upcoming_meetings','read_client_meetings','query_debriefs','query_tasks','search_capiro_data',
  'search_federal_contract_awards','search_federal_subawards','search_contract_vehicles','search_procurement_forecasts','get_district_federal_market'];
const nowMs = Date.parse('2026-01-01T00:00:00.000Z');
const context = {nowMs, actorId: 'reader'};

test('preserves the ten typed additions plus memory read within all139/96/43 boundaries', () => {
  const c = catalog(); assertCatalog(c);
  const ledger = JSON.parse(readFileSync(new URL('../../../docs/coordination/r2/capabilities.json', import.meta.url)));
  assert.deepEqual(c.originals.map(({id,disposition,boundary}) => ({id,disposition,boundary})),
    ledger.records.map(row => ({id:row.fields.ID,disposition:row.acceptedScope.disposition,boundary:expectedVerticalBoundary(row.fields.ID,row.acceptedScope.boundary)})));
  assert.equal(c.operations.length,97); assert.equal(c.originals.filter(row => row.state==='mapped').length,96);
  assert.equal(c.originals.filter(row => row.disposition==='selected' && row.state==='pending').length,0);
  assert.equal(c.originals.filter(row => row.disposition==='deferred').length,43);
  for (const native of added) {
    const mapping = c.originals.find(row => row.id===native);
    const id = native==='list_upcoming_meetings' ? 'meeting.list_upcoming_meetings'
      : native==='read_client_meetings' ? 'meeting.read_client_meetings'
      : native==='query_debriefs' ? 'meeting.query_debriefs' : native;
    assert.deepEqual(mapping.replacement,{id,version:'0.2.0'});
  }
  assert.equal(c.originals.find(row => row.id==='query_action_items').state,'mapped');
  assert.deepEqual(c.originals.find(row => row.id==='query_action_items').replacement,fullActionReference);
});

test('every binding resolves the correct existing definition and exact raw schema hash', () => {
  for (const binding of CATALOG_OPERATION_BINDINGS) {
    const contract=operation(binding.id), raw=readFileSync(new URL(schemaRelativePath(binding.group),import.meta.url));
    const schema=JSON.parse(raw), sha256=createHash('sha256').update(raw).digest('hex');
    assert.ok(Object.hasOwn(schema.$defs,binding.input)); assert.ok(Object.hasOwn(schema.$defs,binding.output));
    assert.deepEqual(contract.descriptor.inputSchema,{id:`${schema.$id}#/$defs/${binding.input}`,sha256});
    assert.deepEqual(contract.descriptor.outputSchema,{id:`${schema.$id}#/$defs/${binding.output}`,sha256});
    assert.ok(Object.isFrozen(contract.descriptor)); assert.ok(Object.isFrozen(contract.descriptor.operation));
  }
});

test('allknown input/output hash, foreign definition and version substitutions refuse', () => {
  for (const descriptor of catalog().operations) {
    for (const field of ['inputSchema','outputSchema']) {
      const c=catalog(); c.operations.find(row=>row.operation.id===descriptor.operation.id)[field].sha256='a'.repeat(64);
      assert.throws(()=>assertCatalog(c),/byte pin/);
      const foreign=catalog(); foreign.operations.find(row=>row.operation.id===descriptor.operation.id)[field].id=foreign.operations.find(row=>row.operation.id!==descriptor.operation.id)[field].id;
      assert.throws(()=>assertCatalog(foreign),/byte pin/);
    }
    const c=catalog(); c.operations.find(row=>row.operation.id===descriptor.operation.id).operation.version='0.2.1';
    assert.throws(()=>assertCatalog(c),/version/);
  }
});

test('missing, foreign and incorrectly remapped registered operations refuse', () => {
  const missing=catalog(); missing.operations.pop(); assert.throws(()=>assertCatalog(missing));
  const foreign=catalog(); foreign.operations.at(-1).operation.id='invented'; assert.throws(()=>assertCatalog(foreign));
  const wrong=catalog(); wrong.originals.find(row=>row.id==='query_tasks').replacement={id:'search_capiro_data',version:'0.2.0'};
  assert.throws(()=>assertCatalog(wrong),/mapping/);
});

test('aliases, cycles and forbidden unrestricted query identifiers retain refusal guards', () => {
  const alias=catalog(); alias.operations[3].aliases=['get_email_thread']; assert.throws(()=>assertCatalog(alias),/Ambiguous/);
  const cycle=catalog(); cycle.operations[3].replacement=cycle.operations[4].operation;
  cycle.operations[4].replacement=cycle.operations[3].operation; assert.throws(()=>assertCatalog(cycle),/Cyclic/);
  for(const id of ['query_data','query_sql','execute_sql','raw_sql']) {
    const c=catalog(); c.operations[3].operation.id=id; assert.throws(()=>assertCatalog(c),/forbidden/);
  }
});

test('everycurrent descriptor stays pending/null; fabricated executable metadata cannot expose it', () => {
  for (const row of catalog().operations) {
    assert.equal(row.handler,null); assert.equal(row.availability,'unimplemented');
    assert.equal(row.qualification,'pending'); assert.equal(row.retry.maxRetries,0);
    const c=catalog(), changed=c.operations.find(op=>op.operation.id===row.operation.id);
    changed.availability='enabled'; changed.qualification='qualified';
    changed.handler={module:'synthetic/not-installed.mjs',export:'read',sourceSha256:'a'.repeat(64)};
    assert.throws(()=>assertCatalog(c),/Pending catalog/);
  }
});

test('resolver refuses unknown versions and unsafe references without invoking getters', () => {
  for(const ref of [{id:'unregistered.operation',version:'0.2.0'},{id:'query_action_items',version:'0.1.0'},{id:'query_tasks',version:'1.0.0'},{id:'query_tasks',version:'0.2.0',extra:true}])
    assert.throws(()=>resolveOperationContract(ref));
  let calls=0; const ref={version:'0.2.0'};
  Object.defineProperty(ref,'id',{enumerable:true,get(){calls++;return 'query_tasks';}});
  assert.throws(()=>resolveOperationContract(ref),/accessor/); assert.equal(calls,0);
});

test('family default materialization and argument digest happen before dispatch', () => {
  const federal=operation('search_federal_contract_awards').normalizeInput({query:' bridge ',state:'ca'});
  assert.deepEqual(federal.input,{query:'bridge',state:'CA',page:1,limit:10});
  assert.equal(federal.argumentsSha256,canonicalSha256(federal.input)); assert.notEqual(federal.argumentsSha256,canonicalSha256(federal.request));
  assert.equal(federal.metadata.clientScope.authoritative,false);
  const upcoming=operation('meeting.list_upcoming_meetings').normalizeInput({}, {nowMs});
  assert.deepEqual(upcoming.input,{clientId:null,limit:10,withinDays:30});
  const task=operation('query_tasks').normalizeInput({assignedToMe:true,status:' OVERDUE '},context);
  assert.equal(task.input.ownerUserId,'reader'); assert.equal(task.input.limit,25);
  assert.equal(task.input.dueBefore,'2026-01-01T00:00:00.000Z'); assert.equal(task.input.openOnly,true);
  assert.throws(()=>operation('query_tasks').normalizeInput({},{nowMs}),/actorId/);
  assert.throws(()=>operation('meeting.list_upcoming_meetings').normalizeInput({}),/nowMs/);
});

test('data-search normalized domains, cursors and conditional memory retain canonical behavior', () => {
  const args={query:' q ',domains:['mail','mail'],cursors:{mail:'opaque'}};
  const normalized=operation('search_capiro_data').normalizeInput(args);
  assert.deepEqual(normalized.input.domains,['mail']); assert.equal(normalized.input.pageSize,50);
  assert.equal(normalized.input.queryClass,'lookup'); assert.deepEqual(normalized.metadata.retrievalRequest.cursors,{mail:'opaque'});
  args.cursors.mail='changed'; assert.equal(normalized.request.cursors.mail,'opaque');
  assert.ok(Object.isFrozen(normalized.input.cursors));
  assert.throws(()=>operation('search_capiro_data').normalizeInput({query:'q',domains:['mail'],memoryItemId:'00000000-0000-4000-8000-000000000001'}),/memory/i);
});

test('mail defaults/context and meeting inventory/body modes reuse their original domain rules', () => {
  const list=operation('mail.list_messages').normalizeInput({subject:{kind:'personal'}});
  assert.equal(list.input.folder,'all'); assert.equal(list.input.limit,15); assert.equal(list.input.offset,0);
  assert.throws(()=>operation('mail.list_messages').normalizeInput({subject:{kind:'personal'},offset:1}),/asOf/);
  assert.throws(()=>operation('mail.search_messages').normalizeInput({subject:{kind:'personal'}}),/filter/);
  const inventory=operation('meeting.read_client_meetings').normalizeInput({clientId:'client-a'});
  const body=operation('meeting.read_client_meetings').normalizeInput({clientId:'client-a',meetingId:'meeting-a',sourceKind:'transcript',sourceId:'source-a'});
  assert.equal(inventory.input.sourceId,undefined); assert.equal(body.input.sourceId,'source-a');
  assert.throws(()=>operation('meeting.read_client_meetings').assertOutput({}, {request:inventory.request}),/ClientMeetingInventoryPage/);
  assert.throws(()=>operation('meeting.read_client_meetings').assertOutput({}, {request:body.request}),/ClientMeetingSourceBodyPage/);
});

test('federal output uses actual family paging invariants and retains unproven total relation', () => {
  const contract=operation('search_federal_contract_awards'); const normalized=contract.normalizeInput({});
  const page={tool:'search_federal_contract_awards',items:[],total:999,page:1,pageSize:10,source:'synthetic',asOf:null,
    generatedAt:'synthetic-time',hasMore:false,nextPage:null,paginationLimitReached:false};
  assert.deepEqual(contract.assertOutput(page,{request:normalized.request}),page);
  assert.throws(()=>contract.assertOutput({...page,hasMore:true,nextPage:2,paginationLimitReached:true},{request:normalized.request}),/paginationLimitReached/);
});

test('real calendar DTO validates only with its original request and explicit trusted clock', () => {
  const contract=operation('meeting.list_upcoming_meetings'), prepared=contract.normalizeInput({}, {nowMs});
  const id='11111111-1111-4111-8111-111111111111';
  const page={kind:'meeting-upcoming-page',contractVersion:'0.2.0',operation:{id:'meeting.list_upcoming_meetings',version:'0.2.0'},
    requestId:id,traceId:id,binding:{tenantId:'fixture',actorId:'reader',conversationId:id,runId:id,attemptId:id,workerId:id,writerFence:1},
    subject:{kind:'personal',entityType:'user',entityIds:['reader'],tenantId:'fixture',actorId:'reader',authorizationDecisionId:id,policyRevision:'policy-v1',scopes:[{tenantId:'fixture',kind:'private-user',resourceId:'reader',policyRevision:'policy-v1'}],rosterVersionId:null},
    window:{basis:'unbounded'},argumentsSha256:canonicalSha256({clientId:null,limit:10,withinDays:30}),appliedFilters:[],
    sources:[{sourceId:'calendar',authority:'authoritative',snapshotVersionId:null,adapterVersion:'0.2.0',status:'partial',synchronizedAt:null,asOf:null,retrievedAt:'2026-01-01T00:00:00.000Z',freshness:'unknown'}],
    coverage:{sourcesRequested:['calendar'],sourcesChecked:['calendar'],sourcesUnavailable:[],enumeration:'unknown',enumerableTotal:null,returnedCount:0,truncated:false,historySupport:'bounded',limitations:['Synthetic pending calendar; no live authority.']},
    selection:{clientId:null,limit:10,withinDays:30},continuation:{cursor:null,requiredReads:[],remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'},
    order:'startsAt-asc_nulls-and-ties-unspecified',snapshotVersionId:null,
    calendarWindow:{from:'2026-01-01T00:00:00.000Z',to:'2026-01-31T00:00:00.000Z',withinDays:30},meetings:[],count:0};
  assert.deepEqual(contract.assertOutput(page,{request:prepared.request,nowMs}),page);
  assert.throws(()=>contract.assertOutput(page,{request:prepared.request}),/nowMs/);
  assert.throws(()=>contract.assertOutput({...page,evidenceReady:true},{request:prepared.request,nowMs}),/evidence|constant/);
});

test('normalizer data ownership prevents accessor/proxy/toJSON effects and caller mutation', () => {
  const contract=operation('search_federal_contract_awards'); let effects=0;
  const getter={}; Object.defineProperty(getter,'query',{enumerable:true,get(){effects++;return 'q';}});
  const proxy=new Proxy({query:'q'},{get(){effects++;return 'q';},getPrototypeOf(){effects++;return Object.prototype;}});
  for(const value of [getter,proxy,{query:'q',toJSON(){effects++;return {query:'changed'};}}])
    assert.throws(()=>contract.normalizeInput(value),/inert|accessor/);
  assert.equal(effects,0);
  const request={query:'q'}, normalized=contract.normalizeInput(request); request.query='changed';
  assert.equal(normalized.request.query,'q'); assert.equal(normalized.input.query,'q');
  assert.ok(Object.isFrozen(normalized.request)); assert.ok(Object.isFrozen(normalized.metadata.clientScope));
});

test('private JSON admission bounds deep, wide and oversized values before family execution', () => {
  const contract = operation('search_federal_contract_awards');
  let deep = null;
  for (let i = 0; i < 70; i++) deep = {nested: deep};
  const wide = Array(100001).fill(null);
  for (const value of [deep, wide]) assert.throws(() => contract.normalizeInput(value), /JSON structure limit/);
  assert.throws(() => contract.normalizeInput({query: 'x'.repeat(16 * 1024 * 1024 + 1)}), /JSON byte limit/);
  assert.deepEqual(contract.normalizeInput({query: 'safe'}).input, {query: 'safe',page: 1,limit: 10});
});
