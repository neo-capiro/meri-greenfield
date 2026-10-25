/** Existing journal/store/session owners, scripted SQL and identity ports; no model or database engine. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createApprovalMetadataReadback} from '../../../control/commands/approval-metadata/readback.mjs';
import {makePayload,canonicalSha256 as hash} from '../../../control/commands/approval-metadata/binding.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {initialInputFixture} from '../../../control/conversations/test/initial-input-fixture.mjs';
import {binding as seed,versions,id} from '../../../control/conversations/test/store-fixture.mjs';
import {nativeTaskFixture} from '../../../control/intents/test/native-task-fixture.mjs';
import {currentNativeApprovalSession} from '../approval-session.mjs';

const check=()=>{};
async function fixture(t,{general=false,action='task.create'}={}){
 const db=initialInputFixture(),store=db.store(),now=db.now,principal={tenantId:seed.tenantId,actorId:seed.actorId},selectedClientId=general?null:id(5);
 const input={principal,conversationId:seed.conversationId,selectedClientId,policyRevision:'policy1',versions,configurationSha256:'c'.repeat(64),proposedExpiresAtMs:now()+60000};
 const original=(await store.initialBindings.claim(input,check)).record,binding=original.binding;
 const scopes=[{...principal,kind:general?'private-user':'client',resourceId:general?principal.actorId:selectedClientId,policyRevision:'policy1'}].map(({actorId,...scope})=>scope);
 const native=nativeTaskFixture({action,general}),command={...native.proposal.command,binding,scopes};
 const proposal={...native.proposal,command,commandSha256:hash(command),createdAt:new Date(now()).toISOString(),expiresAt:new Date(now()+60000).toISOString()};
 const metadata=makePayload({...native.metadata.record,binding,scopes,createdAt:proposal.createdAt,expiresAt:proposal.expiresAt},{...native.metadata.commandContext,binding});
 assert.equal(metadata.commandSha256,proposal.commandSha256);
 const state={current:original,suppressed:false,retentionChecks:0,retentionHook:null};
 const retention={async assertServable(){state.retentionChecks++;await state.retentionHook?.();if(state.suppressed)throw Error('suppressed');}};
 const sessions=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:8,maxRequestMs:3000,maxTtlMs:30000,maxFactBytes:65536},
  async verifyIdentity(){return {principal,identityRevision:'fixture',checkedAtMs:now(),expiresAtMs:now()+30000};},
  async resolveContext({identity}){return {binding:state.current.binding,scopes,selectedClientId,identitySha256:hash(identity),contextRevision:'fixture',checkedAtMs:now(),expiresAtMs:now()+30000};}});
 const issue=()=>sessions.issue({identityCredential:'synthetic-native'}),session=await issue();t.after(()=>sessions.close());
 const reader=createApprovalMetadataReadback({metadata:{async read(){return metadata;}},store,retention,now});
 const read=()=>reader.read({schemaVersion:1,proposalId:proposal.proposalId,binding});
 const current=()=>currentNativeApprovalSession({store,sessions,retention,proposal,now});
 const rebind=async()=>{state.current=(await store.initialBindings.rebind({...input,proposedExpiresAtMs:now()+60000},check)).record;return issue();};
 return {db,store,now,original,binding,scopes,proposal,metadata,state,sessions,session,read,current,rebind};
}

for(const general of [false,true])for(const action of ['task.create','task.update'])test(`${action} first-use ${general?'General':'client'} reads immutable preparation and attended session without a chat run`,async t=>{
 const f=await fixture(t,{general,action}),before=f.db.bindings.length;
 const result=await f.read();assert.equal(Object.hasOwn(result,'run'),false);
 assert.deepEqual(result.preparation,{kind:'initial-binding',record:f.original,recordSha256:hash(f.original),generation:1,latestGeneration:1,started:false});
 assert.deepEqual(result.metadata,f.metadata);assert.deepEqual((await f.current()).binding,f.binding);
 assert.equal(f.db.bindings.length,before);assert.equal(f.db.state.runs.size,0);assert.equal(f.db.allocations.size,0);
});

for(const general of [false,true])test(`expired and superseded ${general?'General':'client'} task provenance remains recoverable under a fresh session`,async t=>{
 const f=await fixture(t,{general});f.db.advance(60000);
 assert.equal((await f.read()).preparation.generation,1);
 await assert.rejects(f.current());
 await f.rebind();const result=await f.read();
 assert.deepEqual(result.preparation.record.binding,f.binding);assert.equal(result.preparation.latestGeneration,2);assert.equal(result.preparation.started,false);
 const current=await f.current();assert.deepEqual(current.binding,f.state.current.binding);assert.notEqual(current.binding.runId,f.binding.runId);
 assert.equal(current.run,null);assert.equal(f.db.state.runs.size,0);assert.equal(f.db.allocations.size,0);
 const p=await f.db.proposal({context:{binding:current.binding,scopes:f.scopes,selectedClientId:general?null:id(5)}});
 await f.store.initialInputs.claim(p.facts,check);await f.store.initialInputs.accept(p.acceptance,check);
 const afterStart=await f.read();assert.equal(afterStart.preparation.started,true);
 assert.deepEqual(afterStart.preparation.record.binding,f.binding);assert.equal(afterStart.preparation.latestGeneration,2);
});

test('initial task custody switches to the actual accepted run without rewriting metadata',async t=>{
 const f=await fixture(t),p=await f.db.proposal({context:{binding:f.binding,scopes:f.scopes}});
 await f.store.initialInputs.claim(p.facts,check);await f.store.initialInputs.accept(p.acceptance,check);
 const result=await f.read();assert.equal(Object.hasOwn(result,'preparation'),false);
 assert.deepEqual(result.run,p.acceptance.run);assert.deepEqual(result.metadata,f.metadata);
});

for(const failure of ['corrupt','foreign actor','foreign scope','suppressed','started','revoked','release revocation','unavailable history'])test(`initial task current selection refuses ${failure}`,async t=>{
 const f=await fixture(t,{general:true});
 if(failure==='corrupt')f.db.bindings[0].record_sha256='0'.repeat(64);
 if(failure==='foreign actor')f.proposal.command.binding={...f.binding,actorId:'foreign'};
 if(failure==='foreign scope')f.proposal.command.scopes[0].resourceId='foreign';
 if(['foreign actor','foreign scope'].includes(failure))f.proposal.commandSha256=hash(f.proposal.command);
 if(failure==='suppressed')f.state.suppressed=true;
 if(failure==='started')f.db.state.allocations.set('synthetic',{tenant_id:f.binding.tenantId,conversation_id:f.binding.conversationId,run_id:f.binding.runId});
 if(failure==='revoked')f.sessions.revoke(f.session.credential);
 if(failure==='release revocation')f.state.retentionHook=()=>{if(f.state.retentionChecks===2)f.sessions.revoke(f.session.credential);};
 if(failure==='unavailable history'){
  await assert.rejects(currentNativeApprovalSession({store:{...f.store,history:{async transcript(){throw Object.assign(Error('unavailable'),{code:'STORE_UNAVAILABLE'});}}},sessions:f.sessions,proposal:f.proposal,now:f.now}),{code:'STORE_UNAVAILABLE'});
 }else await assert.rejects(f.current());
 assert.equal(f.db.state.runs.size,0);assert.equal(f.db.allocations.size,0);
});

test('retention suppression after initial metadata observation withholds the whole response',async t=>{
 const f=await fixture(t);f.state.retentionHook=()=>{if(f.state.retentionChecks===2)f.state.suppressed=true;};
 await assert.rejects(f.read());
});
