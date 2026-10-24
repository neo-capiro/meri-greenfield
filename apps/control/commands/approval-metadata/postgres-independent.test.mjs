import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresApprovalMetadataStore} from './index.mjs';
import {createTransactionalApprovalMetadataStore} from './postgres-store.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {commandToolValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function payload(){
 const binding={tenantId:'tenant-pg-review',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},commandContext={binding,clientResolution:null},request={title:'Independent metadata row'},input=commandToolValidators.normalizeCommandToolInput('task.create',request,{commandContext}).input;
 const record={operation:{id:'create_task',version:'0.2.0'},action:'task.create',binding,request,inputSha256:canonicalSha256(input),commandId:id(100),idempotencyKey:id(101),proposalId:id(102),scopes:[{tenantId:binding.tenantId,kind:'tenant',resourceId:binding.tenantId,policyRevision:'policy'}],createdAt:'2026-10-13T00:00:00.000Z',expiresAt:'2026-10-14T00:00:00.000Z',requiredApprover:{tenantId:binding.tenantId,actorId:'approver'}};
 const command={contractVersion:'0.1.0',commandId:record.commandId,binding,action:'task.create',arguments:input.arguments,attachments:input.attachments,scopes:record.scopes,idempotencyKey:record.idempotencyKey};
 return {record,commandContext,commandSha256:canonicalSha256(command)};
}
function fixture({query=async()=>({rows:[]}),connect}={}){
 const calls=[],releases=[],state={ends:0,connects:0};const client={async query(...args){calls.push(args);return query(...args);},release(error){releases.push(error);}};
 const pool={options:{connectionTimeoutMillis:1000,query_timeout:1000},async connect(){state.connects++;return connect?connect(client):client;},end(){state.ends++;}};
 return {pool,client,calls,releases,state,store:createPostgresApprovalMetadataStore({pool})};
}
test('independent store rejects corrupt immutable payload before connecting',async()=>{
 const t=fixture(),p=payload();p.record.request.title='forged';await assert.rejects(t.store.insert(p,()=>{}));assert.equal(t.state.connects,0);assert.equal(t.state.ends,0);
});
test('independent store refuses unbounded borrowed connection configuration before resources',()=>{
 for(const key of ['connectionTimeoutMillis','query_timeout'])for(const value of [undefined,0,key==='query_timeout'?6001:5001,Infinity]){
  let calls=0;const options={connectionTimeoutMillis:1000,query_timeout:1000};if(value===undefined)delete options[key];else options[key]=value;
  assert.throws(()=>createPostgresApprovalMetadataStore({pool:{options,connect(){calls++;}}}));assert.equal(calls,0);
 }
});
test('independent pre-query refusal owns no write or borrowed pool',async()=>{
 const t=fixture();await assert.rejects(t.store.insert(payload(),()=>{throw new Error('stale');}),e=>e.outcome==='NOT_STORED');assert.equal(t.state.connects,0);assert.equal(t.calls.length,0);assert.equal(t.state.ends,0);
});
test('independent failed connection cannot be reported as stored',async()=>{
 const t=fixture({connect:async()=>{throw new Error('secret-dsn');}});await assert.rejects(t.store.insert(payload(),()=>{}),e=>e.outcome==='NOT_STORED'&&!e.message.includes('dsn'));assert.equal(t.calls.length,0);assert.equal(t.state.ends,0);
});
test('independent late borrowed-client acquisition is released without issuing SQL',async()=>{
 let live=true;const t=fixture({connect:async client=>{live=false;return client;}});await assert.rejects(t.store.insert(payload(),()=>{if(!live)throw Error('expired');}),e=>e.outcome==='NOT_STORED');assert.equal(t.calls.length,0);assert.equal(t.releases.length,1);assert.equal(t.state.ends,0);
});
test('independent autocommit query error is UNKNOWN with one submitted write and no retry',async()=>{
 const t=fixture({query:async()=>{throw Error('database-private-canary');}});await assert.rejects(t.store.insert(payload(),()=>{}),e=>e.outcome==='UNKNOWN'&&!e.message.includes('canary'));assert.equal(t.calls.length,1);assert.equal(t.releases.length,1);assert.ok(t.releases[0]);assert.equal(t.state.ends,0);
 const q=t.calls[0][0];assert.equal(typeof q.text,'string');assert.match(q.text,/^INSERT/u);assert.ok(Array.isArray(q.values));assert.equal(q.query_timeout,1000);
});
test('independent corrupt insert acknowledgment is UNKNOWN without compensating SQL',async()=>{
 const t=fixture({query:async()=>({rows:[{private:'not a canonical row'}]})});await assert.rejects(t.store.insert(payload(),()=>{}),e=>e.outcome==='UNKNOWN');assert.equal(t.calls.length,1);assert.equal(t.releases.length,1);assert.equal(t.state.ends,0);
});
test('independent source store never turns query failure into read absence',async()=>{
 const t=fixture({query:async()=>{throw Error('driver-secret');}});await assert.rejects(t.store.read({tenantId:'tenant-pg-review',actorId:'actor',proposalId:id(102)},()=>{}));assert.equal(t.calls.length,1);assert.equal(t.state.ends,0);
});
test('independent actual empty read is nullable storage data with parameterized tenant and actor',async()=>{
 const t=fixture();assert.equal(await t.store.read({tenantId:'tenant-pg-review',actorId:'actor',proposalId:id(102)},()=>{}),null);assert.equal(t.calls.length,1);assert.match(t.calls[0][0].text,/^SELECT/u);assert.deepEqual(t.calls[0][0].values,['tenant-pg-review','actor',id(102)]);assert.equal(t.releases.length,1);assert.equal(t.state.ends,0);
});
test('independent canonical admitted native pool query timeout6000 is compatible with bounded store',()=>{
 let calls=0;assert.doesNotThrow(()=>createPostgresApprovalMetadataStore({pool:{options:{connectionTimeoutMillis:5000,query_timeout:6000},connect(){calls++;}}}));assert.equal(calls,0);
});
test('independent late returned insert acknowledgment cannot publish metadata',async()=>{
 let active=true;const p=payload(),t=fixture({query:async()=>{active=false;return {rows:[{payload:p,payload_sha256:canonicalSha256(p)}]};}});
 await assert.rejects(t.store.insert(p,()=>{if(!active)throw Error('expired');}),e=>e.outcome==='UNKNOWN');assert.equal(t.calls.length,1);assert.equal(t.releases.length,1);assert.ok(t.releases[0]);
});
test('independent post-insert release failure preserves UNKNOWN without retry or pool closure',async()=>{
 const p=payload(),t=fixture({query:async()=>({rows:[{payload:p,payload_sha256:canonicalSha256(p)}]})});let releaseCalls=0;t.client.release=()=>{releaseCalls++;throw Error('private-release');};
 await assert.rejects(t.store.insert(p,()=>{}),e=>e.outcome==='UNKNOWN'&&!e.message.includes('private'));assert.equal(t.calls.length,1);assert.equal(releaseCalls,1);assert.equal(t.state.ends,0);
});
function transactionalFixture(){
 const state={row:null,working:null,queries:[],releases:[],connects:0,ends:0,fail:null,onInsert:null};
 const pool={options:{connectionTimeoutMillis:25000,query_timeout:25000},async connect(){
  state.connects++;return {async query(q){
   const sql=typeof q==='string'?q:q.text;state.queries.push(q);
   if(state.fail===sql||state.fail==='timeout'&&sql.startsWith('INSERT'))throw Error('private-driver-value');
   if(sql.startsWith('BEGIN'))state.working=state.row;
   if(sql==='ROLLBACK')state.working=state.row;
   if(sql==='COMMIT')state.row=state.working;
   if(sql.startsWith('INSERT')){
    if(state.working)throw Object.assign(Error('unique-conflict'),{code:'23505'});
    const value=JSON.parse(q.values[7]);state.working=value;state.onInsert?.();
    return {rows:[{payload:value,payload_sha256:state.fail==='corrupt'?'f'.repeat(64):canonicalSha256(value)}]};
   }
   if(sql.startsWith('SELECT'))return {rows:state.row?[{payload:state.row,payload_sha256:canonicalSha256(state.row)}]:[]};
   return {rows:[]};
  },release(error){state.releases.push(error);if(state.fail==='release')throw Error('private-release');}};
 },end(){state.ends++;}};
 return {state,pool,store:createTransactionalApprovalMetadataStore({pool})};
}
test('transactional immutable writer uses actual 25s control pool with bounded SQL and canonical readback',async()=>{
 const t=transactionalFixture(),p=payload();assert.deepEqual(await t.store.insert(p,()=>{}),p);
 assert.deepEqual(t.state.queries.filter(q=>typeof q==='string'),['BEGIN',"SET LOCAL statement_timeout = '5s'","SET LOCAL lock_timeout = '2s'",'COMMIT']);
 const insert=t.state.queries.find(q=>typeof q==='object');assert.match(insert.text,/^INSERT INTO meri_commands.approval_metadata/u);assert.doesNotMatch(insert.text,/ON CONFLICT|UPDATE|DELETE/u);
 assert.equal(insert.query_timeout,5000);assert.equal(insert.values[6],canonicalSha256(p));assert.deepEqual(JSON.parse(insert.values[7]),p);
 assert.deepEqual(await t.store.read({tenantId:p.record.binding.tenantId,actorId:p.record.binding.actorId,proposalId:p.record.proposalId},()=>{}),p);
 assert.equal(t.state.ends,0);assert.deepEqual(t.state.releases,[undefined,undefined]);assert.equal(t.pool.options.query_timeout,25000);
});
test('transactional duplicate and conflicting replay roll back and never overwrite immutable metadata',async()=>{
 const t=transactionalFixture(),p=payload();await t.store.insert(p,()=>{});
 for(const candidate of [p,{...p,record:{...p.record,proposalId:id(103)}}]){
  await assert.rejects(t.store.insert(candidate,()=>{}),e=>e.outcome==='UNKNOWN');
  assert.deepEqual(t.state.row,p);assert.equal(t.state.queries.at(-1),'ROLLBACK');
 }
 assert.equal(t.state.queries.filter(q=>typeof q==='object'&&q.text.startsWith('INSERT')).length,3);assert.equal(t.state.ends,0);
});
for(const failure of ['timeout','corrupt','COMMIT','ROLLBACK','release','cancel-after-insert'])test(`transactional writer preserves refusal and cleanup on ${failure}`,async()=>{
 const t=transactionalFixture();let live=true;t.state.fail=failure;
 if(failure==='ROLLBACK'||failure==='cancel-after-insert')t.state.onInsert=()=>{live=false;};
 await assert.rejects(t.store.insert(payload(),()=>{if(!live)throw Error('deadline');}),e=>e.outcome==='UNKNOWN'&&!e.message.includes('private'));
 assert.equal(t.state.queries.filter(q=>typeof q==='object'&&q.text.startsWith('INSERT')).length,1);assert.equal(t.state.releases.length,1);assert.equal(t.state.ends,0);
 if(['timeout','corrupt','ROLLBACK','cancel-after-insert'].includes(failure))assert.equal(t.state.queries.at(-1),'ROLLBACK');
 if(['COMMIT','ROLLBACK'].includes(failure))assert.ok(t.state.releases[0]);
 if(failure!=='release')assert.equal(t.state.row,null);
});
test('transactional writer validates before connecting and owns no SQL after cancelled acquisition',async()=>{
 const t=transactionalFixture(),p=payload();p.record.request.title='forged';await assert.rejects(t.store.insert(p,()=>{}));assert.equal(t.state.connects,0);
 await assert.rejects(t.store.insert(payload(),()=>{throw Error('cancelled');}),e=>e.outcome==='NOT_STORED');assert.equal(t.state.connects,0);
 let live=true,queries=0,releases=0;const store=createTransactionalApprovalMetadataStore({pool:{options:t.pool.options,async connect(){live=false;return {query(){queries++;},release(){releases++;}};}}});
 await assert.rejects(store.insert(payload(),()=>{if(!live)throw Error('cancelled');}),e=>e.outcome==='NOT_STORED');assert.equal(queries,0);assert.equal(releases,1);
});
