import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const root=process.env.MERI_COMMAND_SOURCE_ROOT;
const moduleUrl=name=>root?pathToFileURL(resolve(root,'apps/control/commands',name)):new URL(`../commands/${name}`,import.meta.url);
const {createPostgresCommandJournal}=await import(moduleUrl('postgres-command-journal.mjs'));
const {CommandCommitUncertain}=await import(moduleUrl('protocol.mjs'));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'review-tenant',actorId:'review-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const payload=()=>({proposal:{command:{commandId:id(5),binding,action:'task.create',arguments:{title:'Review'},attachments:[],scopes:[],idempotencyKey:'delivery-one'}},context:{}});

function poolHarness({dates=true,failAt,releaseThrows=false}={}){
 const calls=[],releases=[];
 let retained;
 const client={async query(sql,values){
  calls.push(sql);
  if(sql===failAt)throw Error('scripted-port-failure');
  if(sql.startsWith('INSERT')){
   const [tenant_id,actor_id,idempotency_key,command_id,command_sha256,proposal_sha256,payload_sha256,payloadJson,executorJson]=values;
   retained={tenant_id,actor_id,idempotency_key,command_id,command_sha256,proposal_sha256,payload_sha256,payload:JSON.parse(payloadJson),executor:JSON.parse(executorJson),state:'CLAIMED',outcome:null};
   if(dates)Object.assign(retained,{created_at:new Date('2026-10-12T00:00:00.000Z'),updated_at:new Date('2026-10-12T00:00:00.000Z')});
   return {rows:[retained]};
  }
  return {rows:[]};
 },release(error){releases.push(error);if(releaseThrows)throw Error('scripted-release-failure');}};
 return {pool:{async connect(){calls.push('CONNECT');return client;}},calls,releases};
}

test('actual journal accepts native pg timestamptz Date rows without exposing mutable driver values',async()=>{
 const h=poolHarness(),journal=createPostgresCommandJournal({pool:h.pool});
 const got=await journal.claim(payload(),binding,()=>{});
 assert.equal(got.claimed,true);assert.equal(got.row.state,'CLAIMED');assert.ok(h.calls.includes('COMMIT'));assert.equal(h.releases.length,1);
});
test('lost COMMIT acknowledgement remains typed uncertainty when release also throws',async()=>{
 const h=poolHarness({dates:false,failAt:'COMMIT',releaseThrows:true}),journal=createPostgresCommandJournal({pool:h.pool});
 await assert.rejects(journal.claim(payload(),binding,()=>{}),CommandCommitUncertain);
 assert.equal(h.calls.filter(x=>x==='COMMIT').length,1);assert.equal(h.calls.includes('ROLLBACK'),false);assert.equal(h.releases.length,1);
});
test('failed BEGIN acknowledgement evicts the borrowed connection rather than returning it healthy',async()=>{
 const h=poolHarness({dates:false,failAt:'BEGIN'}),journal=createPostgresCommandJournal({pool:h.pool});
 await assert.rejects(journal.claim(payload(),binding,()=>{}));assert.equal(h.releases.length,1);assert.ok(h.releases[0]);
 assert.equal(h.calls.some(x=>x.startsWith('INSERT')),false);
});
