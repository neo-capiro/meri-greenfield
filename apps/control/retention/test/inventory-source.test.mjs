import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationPurgeFacts} from '../inventory-source.mjs';
import {hash} from '../boundary.mjs';
import {binding,scopes,id} from '../../conversations/test/store-fixture.mjs';
import {conversationContentTables} from '../../conversations/retention-content-rows.mjs';
const now=1800000000000,day=86400000;
const subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId,ownerActorId:binding.actorId};
function fixture(){
 const conversation={conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,policyRevision:'policy1',createdAt:new Date(now-40*day).toISOString()};
 const row={tenant_id:binding.tenantId,conversation_id:binding.conversationId,owner_actor_id:binding.actorId,projection:conversation,projection_sha256:hash(conversation)};
 const tables=new Set(['meri_memory.candidates',...conversationContentTables.map(t=>t.name),...['runs','events','controls','checkpoints','completion_checkpoints','next_runs','memory_proposal_contexts'].map(t=>'meri_conversations.'+t)]);
 const state={status:'trashed',identity:{ownerActorId:binding.actorId},trashRequestId:id(901),revision:'3',trashedAt:new Date(now-31*day).toISOString(),restoreUntil:new Date(now-day).toISOString(),checkedAtMs:now};
 const calls=[],shared=new Map(),overrides=new Map();
 const journal={async withSnapshot(callback){return callback({async query(sql,args){
  calls.push({sql,args});assert.equal(args[0],subject.tenantId);assert.equal(args[1],subject.subjectId);
  if(sql.includes('jsonb_path_exists'))return {rows:shared.get(sql.match(/FROM ([a-z_.]+)/u)[1])??[]};
  const table=sql.match(/FROM ([a-z_.]+)/u)?.[1];
  if(overrides.has(table))return {rows:overrides.get(table)};
  if(table==='meri_conversations.conversations')return {rows:[row]};
  assert.ok(tables.has(table),`unexpected SQL owner ${table}`);return {rows:[]};
 }});}};
 const core={async read(s){assert.deepEqual(s,subject);return structuredClone(state);}};
 const facts=createConversationPurgeFacts({pool:{connect(){throw Error('second lease');}},journal,core,storage:{async holdsFor(){throw Error('zero-run has no objects');}},keyFor:()=>{throw Error('no locator');},now:()=>now});
 return {facts,calls,shared,overrides,state,row};
}
test('real zero-run snapshot produces its identity target with no invented content or second lease',async()=>{
 const f=fixture();assert.equal((await f.facts.trashFor(subject)).restoreUntilMs,now-day);
 const inventory=await f.facts.inventoryFor(subject);assert.equal(inventory.objects.length,0);assert.equal(inventory.rowTargets.length,1);
 assert.equal(inventory.rowTargets[0].table,'conversations');assert.deepEqual(await f.facts.sharedFor(subject,inventory),[]);
 assert.deepEqual(await f.facts.liabilities(subject),[]);assert.equal(await f.facts.lastActivityFor(subject),now-31*day);
 assert.throws(()=>f.facts.holds({objectId:id(8),versionId:'unobserved'}),/RETENTION_AUTHORITY_UNAVAILABLE/);
 f.state.status='active';await assert.rejects(f.facts.trashFor(subject));await assert.rejects(f.facts.lastActivityFor(subject));
});
test('snapshot corruption, a missing parent and unavailable table refuse complete inventory',async()=>{
 for(const mutate of [f=>f.overrides.set('meri_conversations.conversations',[]),f=>f.row.projection_sha256='f'.repeat(64),f=>f.overrides.set('meri_conversations.sdk_session_entries',null)]){
  const f=fixture();mutate(f);await assert.rejects(f.facts.inventoryFor(subject));
 }
});
test('surviving forks and independently owned artifacts are discovered from actual canonical fields',async()=>{
 const f=fixture(),object={objectId:id(8),versionId:'version-exact',sha256:'b'.repeat(64)},body={files:{entries:[{object}]}};
 f.shared.set('meri_conversations.runs',[{owner_id:id(10),body,digest:hash(body)}]);
 f.shared.set('meri_artifacts.versions',[{owner_id:id(11),body,digest:hash(body)}]);
 const shared=await f.facts.sharedFor(subject,{objects:[object]});
 assert.deepEqual(shared,[{object,heldBy:[`${subject.tenantId}:artifact:${id(11)}`,`${subject.tenantId}:conversation:${id(10)}`],blocking:[]}]);
 assert.equal(f.calls.length,6);assert.ok(f.calls.every(c=>c.sql.includes('LIMIT 1')));
 assert.ok(f.calls.filter(c=>c.sql.includes('meri_conversations.completion_checkpoints')).every(c=>c.sql.includes('proof AS body,proof_sha256 AS digest')));
 assert.ok(f.calls.filter(c=>!c.sql.includes('meri_artifacts.versions')).every(c=>c.sql.includes('conversation_id<>$2')));
 assert.ok(f.calls.every(c=>JSON.parse(c.args[2]).version===object.versionId));
 f.shared.get('meri_artifacts.versions')[0].digest='f'.repeat(64);
 await assert.rejects(f.facts.sharedFor(subject,{objects:[object]}),/RETENTION_AUTHORITY_UNAVAILABLE/);
});
test('an unsettled actual run remains a liability, and corrupt native custody is never treated settled',async()=>{
 const f=fixture(),run={binding,state:'running'};
 f.overrides.set('meri_conversations.runs',[{run_id:binding.runId,projection:run,projection_sha256:hash(run)}]);
 f.overrides.set('meri_conversations.native_executions',[]);
 assert.deepEqual(await f.facts.liabilities(subject),[{runId:binding.runId,kind:'UNSETTLED_EXECUTION'}]);
 f.overrides.set('meri_conversations.native_executions',[{record:{},record_sha256:'b'.repeat(64)}]);
 await assert.rejects(f.facts.liabilities(subject));
});
