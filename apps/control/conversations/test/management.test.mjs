/** Scripted PostgreSQL protocol and canonical in-memory retention owner. Native PG gates are separate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialInputFixture} from './initial-input-fixture.mjs';
import {binding,id} from './store-fixture.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {createConversationManagementPort,createConversationAdmissionGuard} from '../management.mjs';
import {compose,owners} from '../../retention/test/fixture.mjs';
import {hash} from '../boundary.mjs';
const principal={tenantId:binding.tenantId,actorId:binding.actorId},check=()=>{};
const command=(operation,expectedRevision='0')=>({version:'meri.conversation-management.v1',principal,conversationId:binding.conversationId,requestId:id(900),operation,expectedRevision,...(operation==='rename'?{title:'Owner title'}:{})});
function fixture(){
 const f=initialInputFixture(),retention=compose();owners.set(`${binding.tenantId}:conversation:${binding.conversationId}`,binding.actorId);
 const metadata={conversationId:binding.conversationId,status:'active',scopeKind:'client',clientId:id(5),revision:'0'};
 let unavailable=false;
 const readMetadata=async request=>{assert.deepEqual(request.principal,principal);if(unavailable)throw Error('Core unavailable');return structuredClone(metadata);};
 const store=createPostgresConversationStore({pool:f.pool,now:f.now,conversationManagement:{readMetadata}});
 const port=createConversationManagementPort({store,suppression:retention.suppression});
 return {...f,retention,metadata,store,port,readMetadata,unavailable(){unavailable=true;}};
}
test('archive excludes a pre-issued original input, restore reopens admission, committed replay remains readable',async()=>{
 const f=fixture(),p=await f.proposal();await f.store.initialInputs.claim(p.facts,check);
 await f.port.withTerminalConversation(command('archive'),async()=>{f.metadata.status='archived';return {revision:'1'};});
 await assert.rejects(f.store.initialInputs.accept(p.acceptance,check),/CONVERSATION_NOT_ACTIVE/);assert.equal(f.state.runs.size,0);
 await f.port.withTerminalConversation(command('restore','1'),async()=>{f.metadata.status='active';return {revision:'2'};});
 await f.store.initialInputs.accept(p.acceptance,check);
 f.metadata.status='archived';assert.equal((await f.store.initialInputs.accept(p.acceptance,check)).replayed,true);
 assert.equal((await f.store.read(binding,{},check)).run.state,'queued');
});
test('archive and new original admission serialize on the same lock; an admitted active run refuses archive',async()=>{
 const f=fixture(),p=await f.proposal();let finish,entered;
 const ready=new Promise(r=>entered=r),block=new Promise(r=>finish=r);
 const archive=f.port.withTerminalConversation(command('archive'),async()=>{entered();await block;f.metadata.status='archived';return null;});
 await ready;const admission=f.store.initialInputs.claim(p.facts,check);finish();await archive;
 await assert.rejects(admission,/CONVERSATION_NOT_ACTIVE/);assert.equal(f.allocations.size,0);
 f.metadata.status='active';await f.store.initialInputs.claim(p.facts,check);await f.store.initialInputs.accept(p.acceptance,check);
 await assert.rejects(f.port.withTerminalConversation(command('archive'),async()=>null),/CONVERSATION_RUN_ACTIVE/);
 assert.equal(await f.port.withTerminalConversation(command('rename'),async()=>true),true);
});
test('Core outage refuses admission and malformed or absent metadata owners cannot enable management',async()=>{
 const f=fixture(),p=await f.proposal();f.unavailable();await assert.rejects(f.store.initialInputs.claim(p.facts,check),/CONVERSATION_MANAGEMENT_UNAVAILABLE/);
 assert.equal(f.allocations.size,0);
 assert.throws(()=>createConversationManagementPort({store:createPostgresConversationStore({pool:f.pool}),suppression:f.retention.suppression}),/CONVERSATION_MANAGEMENT_UNAVAILABLE/);
 for(const metadata of [{conversationId:binding.conversationId,status:'active',scopeKind:'general',clientId:id(5),revision:'0'},{conversationId:binding.conversationId,status:'active',clientId:null,revision:'0'}]){
  const guard=createConversationAdmissionGuard({readMetadata:async()=>metadata});await assert.rejects(guard(null,binding,check),/CONVERSATION_MANAGEMENT_UNAVAILABLE/);
 }
});
test('Trash suppresses before uncertain Core commit; exact Restore retry releases after commit; expired fences refuse',async()=>{
 const f=fixture(),p=await f.proposal();const conversation=p.acceptance.conversation;
 f.state.conversations.set(`${binding.tenantId}:${binding.conversationId}`,{tenant_id:binding.tenantId,conversation_id:binding.conversationId,owner_actor_id:binding.actorId,projection:conversation,projection_sha256:hash(conversation)});let captured;
 await assert.rejects(f.port.withTerminalConversation(command('trash'),async fence=>{captured=fence;await fence.suppress({reason:'conversation-trash',requestId:id(900),restoreUntil:'2026-11-23T00:00:00.000Z'});f.metadata.status='trashed';throw Error('unknown Core commit');}),/unknown Core commit/);
 const subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId};
 await assert.rejects(f.retention.suppression.assertServable(subject),/RETENTION_SUPPRESSED/);
 await assert.rejects(captured.suppress({reason:'conversation-trash',requestId:id(900),restoreUntil:'2026-11-23T00:00:00.000Z'}),/CONVERSATION_MANAGEMENT_REFUSED/);
 await f.port.withTerminalConversation(command('restore'),async fence=>{f.metadata.status='active';await fence.release({reason:'conversation-restore',requestId:id(900)});return null;});
 await f.retention.suppression.assertServable(subject);
 await f.port.withTerminalConversation(command('restore'),async fence=>{await fence.release({reason:'conversation-restore',requestId:id(900)});return null;});
});

test('Core-only Trash refuses before its callback or ledger; missing Meri subject cannot be fabricated',async()=>{
 const f=fixture();let called=false;const before=await f.retention.ledger.replay();
 await assert.rejects(f.port.withTerminalConversation(command('trash'),async()=>{called=true;}),/CONVERSATION_MANAGEMENT_UNAVAILABLE/);
 assert.equal(called,false);assert.deepEqual(await f.retention.ledger.replay(),before);assert.equal(f.state.conversations.size,0);
});

test('terminal history cannot hide an open successor, and closed history does not make an empty range active',async()=>{
 const f=fixture(),p=await f.proposal();await f.store.accept(p.acceptance,check);
 const original=[...f.state.runs.values()][0];original.sequence_end=1;original.projection.state='completed';original.projection_sha256=hash(original.projection);
 const later=structuredClone(original);later.run_id=id(902);later.request_id=id(903);later.request.requestId=later.request_id;later.request_sha256=hash(later.request);later.sequence_end=null;
 later.projection.binding.runId=later.run_id;later.projection.state='queued';later.projection_sha256=hash(later.projection);
 f.state.runs.set(`${binding.tenantId}:${binding.conversationId}:${later.run_id}`,later);
 await assert.rejects(f.port.withTerminalConversation(command('archive'),async()=>true),/CONVERSATION_RUN_ACTIVE/);
 const current=f.state.runs.get(`${binding.tenantId}:${binding.conversationId}:${later.run_id}`);current.projection.state='completed';current.projection_sha256=hash(current.projection);
 assert.equal(await f.port.withTerminalConversation(command('archive'),async()=>true),true);
 f.state.runs.clear();assert.equal(await f.port.withTerminalConversation(command('archive'),async()=>true),true);
 assert.ok(f.state.calls.some(sql=>sql.endsWith('FOR NO KEY UPDATE')));
});
