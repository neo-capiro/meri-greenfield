import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreConversationManagementOwner,conversationManagementOwnership,createConversationAdmissionRelay,createConversationManagementComposition} from '../conversation-management-composition.mjs';
import {captureRuntimePorts,composeRuntimePorts} from '../product-applications.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {initialInputFixture} from '../../control/conversations/test/initial-input-fixture.mjs';
import {binding,id} from '../../control/conversations/test/store-fixture.mjs';
import {compose,owners} from '../../control/retention/test/fixture.mjs';
import {hash} from '../../control/conversations/boundary.mjs';
const principal={tenantId:binding.tenantId,actorId:binding.actorId},check=()=>{};
const request=operation=>({version:'meri.conversation-management.v1',requestId:id(900),conversationId:binding.conversationId,expectedRevision:'0',operation});
function fixture(){
 const f=initialInputFixture(),retained=compose();owners.set(`${binding.tenantId}:conversation:${binding.conversationId}`,binding.actorId);
 const row={conversationId:binding.conversationId,status:'active',scopeKind:'client',clientId:id(5),revision:'0'};
 const calls=[],prisma={async withTenant(){}};
 const core={
  async readManagedConversationMetadata(p,w,c){assert.equal(p,prisma);assert.deepEqual(w,principal);assert.equal(c,binding.conversationId);calls.push('metadata');return structuredClone(row);},
  async readManagedConversationOwner(p,w){assert.equal(p,prisma);assert.deepEqual(w,{tenantId:principal.tenantId,conversationId:binding.conversationId});calls.push('owner');return binding.actorId;},
  async manageConversation(p,ctx,r,port){assert.equal(p,prisma);assert.deepEqual(ctx,{tenantId:principal.tenantId,userId:principal.actorId});
   return port.withTerminalConversation({principal,...r},async fence=>{calls.push('core');
    if(r.operation==='trash')await fence.suppress({reason:'conversation-trash',requestId:r.requestId,restoreUntil:'2026-11-23T00:00:00.000Z'});
    row.status=r.operation==='trash'?'trashed':r.operation==='archive'?'archived':'active';calls.push('commit');
    if(r.operation==='restore')await fence.release({reason:'conversation-restore',requestId:r.requestId});return structuredClone(row);
   });},
 };
 const owner=createCoreConversationManagementOwner({prisma,core}),store=createPostgresConversationStore({pool:f.pool,now:f.now,conversationManagement:{readMetadata:owner.readMetadata}});
 const runtime=createConversationManagementComposition({owner,store,retention:{startup:{suppression:retained.suppression}}});
 return {...f,row,calls,core,owner,store,runtime,retained};
}
test('trusted Core exports, metadata admission and canonical suppression share the exact store without a second metadata owner',async()=>{
 const f=fixture();assert.equal(f.runtime.state,'composed');const p=await f.proposal();
 await f.runtime.manage({principal,request:request('archive')});await assert.rejects(f.store.initialInputs.claim(p.facts,check),/CONVERSATION_NOT_ACTIVE/);
 await f.runtime.manage({principal,request:request('restore')});await f.runtime.admit(null,binding,check);
 const conversation=p.acceptance.conversation;f.state.conversations.set(`${binding.tenantId}:${binding.conversationId}`,{tenant_id:binding.tenantId,conversation_id:binding.conversationId,owner_actor_id:binding.actorId,projection:conversation,projection_sha256:hash(conversation)});
 await f.runtime.manage({principal,request:request('trash')});assert.equal(await f.retained.suppression.isSuppressed({tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId}),true);
 assert.equal(await conversationManagementOwnership(f.owner).ownerOf({tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId}),binding.actorId);
 await assert.rejects(conversationManagementOwnership(f.owner).ownerOf({tenantId:binding.tenantId,kind:'artifact',subjectId:binding.conversationId}),/UNAVAILABLE/);
});
test('missing metadata or canonical retention owner refuses all new management/admission, with no fallback',async()=>{
 const f=fixture();for(const input of [{store:f.store},{owner:f.owner,store:f.store},{store:f.store,retention:{startup:{suppression:f.retained.suppression}}}]){
  const c=createConversationManagementComposition(input);assert.equal(c.state,'owners-unavailable');
  await assert.rejects(c.admit(null,binding,check),/UNAVAILABLE/);assert.throws(()=>c.manage({principal,request:request('archive')}),/UNAVAILABLE/);
  await assert.rejects(c.port.withTerminalConversation({},()=>assert.fail()),/UNAVAILABLE/);
 }
});
test('initial binding relay refuses before binding and after close; one captured owner cannot be replaced',async()=>{
 const relay=createConversationAdmissionRelay(),f=fixture();await assert.rejects(relay.admit(null,binding,check),/UNAVAILABLE/);
 relay.bind(f.runtime);assert.throws(()=>relay.bind(f.runtime),/CONFIGURATION/);await relay.admit(null,binding,check);
 f.row.status='archived';await assert.rejects(relay.admit(null,binding,check),/CONVERSATION_NOT_ACTIVE/);
 relay.close();await assert.rejects(relay.admit(null,binding,check),/UNAVAILABLE/);assert.throws(()=>relay.bind(f.runtime),/CONFIGURATION/);
});
test('management ports capture original methods inertly and refuse duplicate owner composition',async()=>{
 const f=fixture();let getters=0;
 assert.throws(()=>captureRuntimePorts({conversationManagement:{get readMetadata(){getters++;return ()=>{};}}}));assert.equal(getters,0);
 const ports=captureRuntimePorts({conversationManagement:f.owner});assert.deepEqual(ports.configuredOwners,['conversationManagement']);
 assert.throws(()=>composeRuntimePorts(ports,ports),/PRODUCT_PORTS_CONFIGURATION/);
 f.core.readManagedConversationMetadata=()=>assert.fail('replaced export');assert.equal((await ports.conversationManagement.readMetadata({principal,conversationId:binding.conversationId})).scopeKind,'client');
});
