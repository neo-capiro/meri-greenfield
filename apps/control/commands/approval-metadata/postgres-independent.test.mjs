import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresApprovalMetadataStore} from './index.mjs';
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
