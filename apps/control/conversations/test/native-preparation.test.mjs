/** Real task-owned PostgreSQL; synthetic authority/task metadata, no AWS calls. */
import test from 'node:test';import assert from 'node:assert/strict';
import pg from '../../../runtime/node_modules/pg/lib/index.js';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {createNativeAllocationAdmission} from '../../../gateway/budget/native-allocation-admission.mjs';
import {productFixture} from '../../../gateway/budget/product-scripted-fixture.mjs';
import {versions} from './store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const check=()=>{},socket='/tmp/meri-broker-pg-socket-20261014';
async function fixture(t){
 const pool=new pg.Pool({host:socket,user:'postgres',database:'postgres',max:8});t.after(()=>pool.end());
 const details=(await pool.query("SELECT version() AS version,current_setting('listen_addresses') AS listen")).rows[0];assert.match(details.version,/^PostgreSQL 16\./);assert.equal(details.listen,'');
 await pool.query('TRUNCATE meri_conversations.conversations CASCADE; TRUNCATE meri_product_budget.budget,meri_product_budget.runs CASCADE');
 const seed=productFixture(),binding=seed.invocation.binding,at=Date.now(),now=()=>at,expiresAtMs=at+8000,allocation=structuredClone(seed.allocation);allocation.schedule.expiresAt=new Date(at+10000).toISOString();
 const q=seed.invocation.qualificationBinding,qualification={attempt:q.attempt,policyRevision:q.policyRevision};
 const grantIntents=[{grantId:seed.invocation.grantId,capabilitySha256:seed.invocation.capabilitySha256,expiresAtMs:at+9000},{grantId:'11111111-1111-4111-8111-000000000099',capabilitySha256:'c'.repeat(64),expiresAtMs:at+8000}];
 const store=createPostgresConversationStore({pool}),createdAt=new Date(at).toISOString(),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:'11111111-1111-4111-8111-000000000066',policyRevision:q.policyRevision}];
 await store.accept({conversation:{conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt,policyRevision:q.policyRevision},run:{binding,state:'queued',scopes,createdAt,policyRevision:q.policyRevision,versions},request:{requestId:'11111111-1111-4111-8111-000000000006',prompt:'/status',skill:null,window:null},event:{contractVersion:'0.1.0',eventId:'11111111-1111-4111-8111-000000000007',binding,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}}},check);
 await pool.query('INSERT INTO meri_product_budget.budget(id,cap_micro_usd) VALUES(1,1000000)');
 const config={pool,allocationJson:JSON.stringify(allocation),grantIntents,qualification,binding,now,limits:{maxRequestMs:3000,maxFactBytes:131072}};
 const original={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'d'.repeat(64),expiresAtMs,versions};
 const intent={binding,allocationKey:original.executionKey,original,allocationSha256:hash(allocation),qualification,grantIntents,taskRequestSha256:'e'.repeat(64),expiresAtMs},key={binding,allocationKey:intent.allocationKey};
 const resource={taskArn:q.workerArn,clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/MeriSynthetic:1',containerName:'worker',createdAtMs:at};
 const restore={binding,restoreKey:'f'.repeat(64),checkpointSha256:'a'.repeat(64),contextSha256:'b'.repeat(64),sourceRequestSha256:'c'.repeat(64),workspaceSha256:'d'.repeat(64),opaqueSessionSha256:'e'.repeat(64),expiresAtMs};
 return{pool,store,config,intent,key,resource,restore,restoreKey:{binding,restoreKey:restore.restoreKey}};
}
test('real PG consumes one allocation claim and actual-ARN admission/readback survives owner reconstruction',async t=>{
 const f=await fixture(t),claims=await Promise.all([f.store.allocations.claim(f.intent,check),f.store.allocations.claim(f.intent,check)]);assert.equal(claims.filter(r=>r.dispatch).length,1);
 const admission=createNativeAllocationAdmission(f.config),active=await admission.admit({taskArn:f.resource.taskArn});
 await f.store.allocations.record({...f.key,state:'ALLOCATED',resource:f.resource},check);
 await f.store.allocations.record({...f.key,state:'ADMITTED',resource:{...f.resource,grantFactsJsons:active.grantFactsJsons}},check);
 assert.equal((await createNativeAllocationAdmission(f.config).read({taskArn:f.resource.taskArn})).state,'ADMITTED');
 assert.equal((await createPostgresConversationStore({pool:f.pool}).allocations.claim(f.intent,check)).dispatch,false);
 assert.equal((await f.pool.query('SELECT count(*) FROM meri_product_budget.grants')).rows[0].count,'2');
 await assert.rejects(admission.admit({taskArn:f.resource.taskArn.replace(/a{32}$/,'b'.repeat(32))}));
 const changed={...f.intent,taskRequestSha256:'0'.repeat(64)};await assert.rejects(f.store.allocations.claim(changed,check),/REPLAY_REFUSED/);
});
test('real PG acknowledged-commit loss requires exact admission readback',async t=>{
 const f=await fixture(t);let lose=true;
 const pool={async connect(){const client=await f.pool.connect();return {query:async(...args)=>{const result=await client.query(...args);if(args[0]==='COMMIT'&&lose){lose=false;throw Error('lost ACK after real COMMIT');}return result;},release:error=>client.release(error)};}};
 await assert.rejects(createNativeAllocationAdmission({...f.config,pool}).admit({taskArn:f.resource.taskArn}),/ACKNOWLEDGEMENT_UNKNOWN/);
 assert.equal((await createNativeAllocationAdmission(f.config).read({taskArn:f.resource.taskArn})).state,'ADMITTED');
 await f.pool.query("UPDATE meri_product_budget.grants SET state='REVOKED' WHERE grant_id=$1",[f.config.grantIntents[0].grantId]);
 await assert.rejects(createNativeAllocationAdmission(f.config).read({taskArn:f.resource.taskArn}));
});
test('real PG original revocation proves absence then retires exact authority even after quarantine',async t=>{
 const f=await fixture(t),o=createNativeAllocationAdmission(f.config);assert.equal((await o.revoke({taskArn:f.resource.taskArn})).authorityAbsent,true);
 await o.admit({taskArn:f.resource.taskArn});await f.pool.query('UPDATE meri_product_budget.budget SET quarantined=true');
 assert.equal((await o.revoke({taskArn:f.resource.taskArn})).revocationProven,true);
 assert.equal((await o.revoke({taskArn:f.resource.taskArn})).revocationProven,true);
 assert.deepEqual((await f.pool.query('SELECT DISTINCT state FROM meri_product_budget.grants')).rows,[{state:'REVOKED'}]);
 await assert.rejects(o.read({taskArn:f.resource.taskArn}));await assert.rejects(o.revoke({taskArn:f.resource.taskArn.replace(/a{32}$/,'b'.repeat(32))}));
});
test('journal refuses malformed intents/proofs and SQL prevents rebinding, lease extension and unproved retirement',async t=>{
 const f=await fixture(t);for(const changed of [{...f.intent,allocationSha256:'bad'},{...f.intent,original:{...f.intent.original,expiresAtMs:f.intent.expiresAtMs+1}},{...f.intent,grantIntents:[...f.intent.grantIntents,f.intent.grantIntents[0]]}])await assert.rejects(f.store.allocations.claim(changed,check));
 await f.store.allocations.claim(f.intent,check);await assert.rejects(f.store.allocations.record({...f.key,state:'ADMITTED',resource:f.resource},check));
 await f.store.allocations.record({...f.key,state:'ALLOCATED',resource:f.resource},check);
 const raw=(await f.pool.query('SELECT record FROM meri_conversations.native_allocations')).rows[0].record;
 for(const next of [{...raw,expiresAtMs:raw.expiresAtMs+1},{...raw,state:'RETIRED'},{...raw,resource:{...raw.resource,taskArn:raw.resource.taskArn.replace(/a{32}$/,'b'.repeat(32))}}])await assert.rejects(f.pool.query('UPDATE meri_conversations.native_allocations SET record=$1,record_sha256=$2',[next,hash(next)]));
 await f.store.allocations.record({...f.key,state:'UNKNOWN',resource:null},check);assert.deepEqual((await f.store.allocations.read(f.key,check)).record.resource,f.resource);
 await f.store.allocations.record({...f.key,state:'RETIRED',resource:{...f.resource,physicalStopProven:true}},check);
 await assert.rejects(f.store.allocations.record({...f.key,state:'ALLOCATED',resource:f.resource},check));
});
test('restoration receipt exactness and uncertain byte-write state stay immutable in real PG',async t=>{
 const f=await fixture(t);await f.store.restorations.claim(f.restore,check);
 await assert.rejects(f.store.restorations.record({...f.restoreKey,state:'RESTORED',receipt:{workspaceSha256:'0'.repeat(64),opaqueSessionSha256:f.restore.opaqueSessionSha256}},check));
 const receipt={workspaceSha256:f.restore.workspaceSha256,opaqueSessionSha256:f.restore.opaqueSessionSha256};
 await f.store.restorations.record({...f.restoreKey,state:'RESTORED',receipt},check);
 assert.equal((await f.store.restorations.claim(f.restore,check)).dispatch,false);
 await assert.rejects(f.store.restorations.record({...f.restoreKey,state:'UNKNOWN',receipt:null},check));
 const saved=(await f.pool.query('SELECT record FROM meri_conversations.native_restorations')).rows[0].record;
 await assert.rejects(f.pool.query('UPDATE meri_conversations.native_restorations SET record=$1,record_sha256=$2',[{...saved,receipt:{...receipt,extra:true}},hash({...saved,receipt:{...receipt,extra:true}})]));
});
test('coherently rehashed malformed resource remains corrupt at canonical read boundary',async t=>{
 const f=await fixture(t);await f.store.allocations.claim(f.intent,check);
 const raw=(await f.pool.query('SELECT record FROM meri_conversations.native_allocations')).rows[0].record,next={...raw,state:'ALLOCATED',resource:{...f.resource,taskArn:f.resource.taskArn.replace('967807252336','000000000000')}};
 await f.pool.query('UPDATE meri_conversations.native_allocations SET record=$1,record_sha256=$2',[next,hash(next)]);
 await assert.rejects(f.store.allocations.read(f.key,check),/CORRUPT/);
});
