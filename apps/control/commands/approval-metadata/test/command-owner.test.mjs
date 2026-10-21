/** Synthetic bounded SQL/policy ports over the unchanged metadata owner/store.
 * No source mutation, approved execution, live DB or provider is exercised. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {fixture,id,NOW} from '../../../test/commands-fixture.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture} from './fixture.mjs';
import {createCommandApprovalMetadataOwner,createTaskCreateApprovalMetadataOwner,
 createTaskUpdateApprovalMetadataOwner,createPostgresApprovalMetadataStore} from '../index.mjs';
import {commandKind} from '../command-kind.mjs';

function setup(action,factory){
 const f=fixture(action),kind=commandKind(action),clock={at:NOW};
 const request=action==='artifact.file'?{...f.context.destination,objects:f.command.attachments}:
  action==='memory.propose'?{content:' Memory ',scope:'firm'}:
  action==='task.update'?{taskId:id(21),title:'Updated',status:'open'}:{title:' Task '};
 const normalized={arguments:f.command.arguments,attachments:f.command.attachments};
 const sql=createMetadataPoolFixture(),store=createPostgresApprovalMetadataStore({pool:sql.pool});
 const policy=createMetadataPolicyFixture({binding:f.binding,scopes:f.scopes,requiredApprover:f.proposal.requiredApprover,
  expiresAt:new Date(NOW+60000).toISOString(),now:()=>clock.at});
 let allocated=0;
 const configuration={store,commandContext:f.context,preparePolicy:policy.preparePolicy,now:()=>clock.at,
  newId:()=>id(100+allocated++)};
 const owner=factory?factory(configuration):createCommandApprovalMetadataOwner(configuration,action);
 const call={operation:kind.operation,action,binding:f.binding,request,input:normalized,
  inputSha256:canonicalSha256(normalized),deadlineMs:NOW+1000,signal:undefined};
 const retained=()=>[...sql.rows.values()][0].payload;
 const readCall=()=>({proposalId:retained().record.proposalId,commandSha256:retained().commandSha256,
  operation:kind.operation,action,binding:f.binding,deadlineMs:clock.at+1000,signal:undefined});
 return {...f,kind,clock,sql,store,policy,configuration,owner,call,retained,readCall,allocated:()=>allocated};
}

test('command codec registry is closed, immutable and rejects inherited/deferred action names',()=>{
 for(const action of ['task.create','task.update','memory.propose','artifact.file']){
  const kind=commandKind(action);assert.equal(Object.isFrozen(kind),true);assert.equal(Object.isFrozen(kind.operation),true);
  for(const field of ['normalize','assertCommand','assertProposal'])assert.equal(typeof kind[field],'function');
 }
 for(const action of ['__proto__','constructor','toString','memory.confirm','artifact.upload','task.create ',undefined,{}])
  assert.throws(()=>commandKind(action),{message:'COMMAND_PREPARATION_REFUSED'});
});

for(const [action,factory] of [['task.create',createTaskCreateApprovalMetadataOwner],['task.update',createTaskUpdateApprovalMetadataOwner]])
 test(`${action}: generic metadata owner preserves the existing task factory payload and policy phases`,async()=>{
  const generic=setup(action),legacy=setup(action,factory);
  assert.deepEqual(await generic.owner.prepare(generic.call),await legacy.owner.prepare(legacy.call));
  assert.deepEqual(generic.retained(),legacy.retained());
  assert.deepEqual(await generic.owner.read(generic.readCall()),await legacy.owner.read(legacy.readCall()));
  assert.deepEqual(generic.policy.calls.map(call=>call.phase),['prepare','before_release','before_read','read_release']);
  assert.deepEqual(generic.retained().record.action,action);assert.equal(generic.state.fetches,0);
 });

for(const action of ['memory.propose','artifact.file']){
 test(`${action}: the concrete shared store retains exact canonical metadata without approval or execution`,async()=>{
  const f=setup(action),record=await f.owner.prepare(f.call),payload=f.retained();
  assert.equal(record.action,action);assert.deepEqual(record.operation,f.kind.operation);
  assert.deepEqual(payload.commandContext,f.context);assert.equal(record.inputSha256,canonicalSha256(f.call.input));
  const expected={contractVersion:f.kind.contractVersion,commandId:record.commandId,binding:f.binding,action,
   arguments:f.command.arguments,attachments:f.command.attachments,scopes:f.scopes,idempotencyKey:record.idempotencyKey};
  assert.equal(payload.commandSha256,canonicalSha256(expected));f.kind.assertCommand(expected,f.context);
  assert.equal(f.sql.rows.size,1);assert.equal(f.allocated(),3);assert.equal(f.state.fetches,0);
  assert.equal(Object.hasOwn(record,'approved'),false);assert.equal(Object.hasOwn(record,'executed'),false);
  const first=await f.owner.read(f.readCall()),second=await f.owner.read(f.readCall());
  assert.deepEqual(first,record);assert.deepEqual(second,record);assert.equal(f.sql.rows.size,1);assert.equal(f.allocated(),3);
  assert.deepEqual(f.policy.calls.map(call=>call.phase),['prepare','before_release','before_read','read_release','before_read','read_release']);
 });

 test(`${action}: model authority, operation/action and normalized-input substitutions refuse before policy or SQL`,async()=>{
  for(const changed of ['binding','operation','action','input','inputSha256','request']){
   const f=setup(action),call=structuredClone(f.call);
   if(changed==='binding')call.binding.actorId='other';
   if(changed==='operation')call.operation.id='create_task';
   if(changed==='action')call.action='task.create';
   if(changed==='input')call.input.attachments=[];
   if(changed==='input'&&action==='memory.propose')call.input.arguments.content='Substituted';
   if(changed==='inputSha256')call.inputSha256='f'.repeat(64);
   if(changed==='request')call.request.approved=true;
   await assert.rejects(f.owner.prepare(call),error=>error.outcome==='NOT_STORED');
   assert.equal(f.sql.calls.length,0);assert.equal(f.policy.calls.length,0);assert.equal(f.allocated(),0);assert.equal(f.state.fetches,0);
  }
 });

 test(`${action}: current policy revocation at preparation or read release cannot produce usable metadata`,async()=>{
  const f=setup(action);f.policy.state.denyPhase='prepare';
  await assert.rejects(f.owner.prepare(f.call),error=>error.outcome==='NOT_STORED');assert.equal(f.sql.rows.size,0);
  f.policy.state.denyPhase=null;await f.owner.prepare(f.call);const saved=structuredClone(f.retained());
  f.policy.state.denyPhase='read_release';await assert.rejects(f.owner.read(f.readCall()),error=>error.outcome==='READ_UNAVAILABLE');
  assert.deepEqual(f.retained(),saved);assert.equal(f.sql.rows.size,1);assert.equal(f.state.fetches,0);
 });

 test(`${action}: policy/fence drift after insertion remains stored but unreleased`,async()=>{
  for(const changed of ['scopes','requiredApprover','proposalExpiresAt','binding']){
   const f=setup(action);f.policy.state.mutate=(receipt,call)=>{
    if(call.phase!=='before_release')return;
    if(changed==='scopes')receipt.scopes=[{...f.scopes[0],policyRevision:'changed'}];
    if(changed==='requiredApprover')receipt.requiredApprover={...receipt.requiredApprover,actorId:'other'};
    if(changed==='proposalExpiresAt')receipt.proposalExpiresAt=new Date(NOW+50000).toISOString();
    if(changed==='binding')receipt.binding={...receipt.binding,writerFence:2};
   };
   await assert.rejects(f.owner.prepare(f.call),error=>error.outcome==='STORED_NOT_RELEASED');
   assert.equal(f.sql.rows.size,1);assert.equal(f.allocated(),3);assert.equal(f.state.fetches,0);
  }
 });

 test(`${action}: lost store acknowledgment remains UNKNOWN with no retry or new identities`,async()=>{
  const f=setup(action),store={...f.store,async insert(payload,check){await f.store.insert(payload,check);throw Error('private acknowledgement lost');}};
  const owner=createCommandApprovalMetadataOwner({...f.configuration,store},action);
  await assert.rejects(owner.prepare(f.call),error=>error.outcome==='UNKNOWN'&&!error.message.includes('private'));
  assert.equal(f.sql.rows.size,1);assert.equal(f.allocated(),3);
  assert.equal(f.sql.calls.filter(call=>typeof call==='object'&&call.text.startsWith('INSERT')).length,1);
  assert.equal(f.policy.calls.some(call=>call.phase==='before_release'),false);assert.equal(f.state.fetches,0);
 });

 test(`${action}: expired authority and caller cancellation refuse without source execution`,async()=>{
  const f=setup(action),controller=new AbortController();controller.abort();
  await assert.rejects(f.owner.prepare({...f.call,signal:controller.signal}),error=>error.outcome==='NOT_STORED');
  assert.equal(f.sql.rows.size,0);assert.equal(f.allocated(),0);
  await f.owner.prepare(f.call);f.clock.at+=60001;
  await assert.rejects(f.owner.read(f.readCall()),error=>error.outcome==='READ_UNAVAILABLE');
  assert.equal(f.sql.rows.size,1);assert.equal(f.state.fetches,0);
 });
}

test('artifact metadata hashes all immutable object fields and rejects substituted retained attachment bytes',async()=>{
 const f=setup('artifact.file');await f.owner.prepare(f.call);
 const row=[...f.sql.rows.values()][0],read=f.readCall();
 assert.equal(f.call.input.attachments.length,1);
 assert.deepEqual(f.retained().record.request.objects,f.command.attachments);
 row.payload.record.request.objects[0].sha256='f'.repeat(64);
 // Even a storage envelope rehash cannot change the separately pinned input/command.
 row.payload_sha256=canonicalSha256(row.payload);
 await assert.rejects(f.owner.read(read),error=>error.outcome==='READ_UNAVAILABLE');
 assert.equal(f.sql.rows.size,1);assert.equal(f.state.fetches,0);
});

test('an owner of another command kind or changed trusted destination cannot replay retained metadata',async()=>{
 const f=setup('artifact.file');await f.owner.prepare(f.call);const read=f.readCall();
 const memory=createCommandApprovalMetadataOwner({...f.configuration,
  commandContext:{binding:f.binding,conversationClientId:f.context.destination.clientId}},'memory.propose');
 await assert.rejects(memory.read({...read,operation:{id:'save_memory',version:'0.2.0'},action:'memory.propose'}),error=>error.outcome==='READ_UNAVAILABLE');
 const moved=createCommandApprovalMetadataOwner({...f.configuration,
  commandContext:{...f.context,destination:{...f.context.destination,clientId:id(90)}}},'artifact.file');
 await assert.rejects(moved.read(read),error=>error.outcome==='READ_UNAVAILABLE');
 assert.equal(f.sql.rows.size,1);assert.equal(f.state.fetches,0);
});
