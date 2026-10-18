/** Synthetic command owner tests. They exercise the real command interface and memory codec; PostgreSQL/Core/live sessions remain
 * separate qualification gates. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256,assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {commandToolValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCommandToolInterface} from '../../commands/tool-interface.mjs';
import {createMemoryApprovalMetadataOwner,MEMORY_COMMAND_OPERATION,memoryMetadataPayload} from '../approval-metadata.mjs';
import {createMemoryCommandOptions} from '../command-options.mjs';
import {createPostgresMemoryApprovalMetadataStore} from '../approval-metadata-store.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const NOW=1900000000000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const context={binding,conversationClientId:id(5)};
const clone=value=>structuredClone(value);
function fixture({retentionError=null,mutatePolicy=null,storeFactory=null}={}){
 let at=NOW,count=100,effects=0,retentionCalls=[],policyCalls=[],stored=null,inserts=0,reads=0;
 const now=()=>at,retention={async assertServable(subject){retentionCalls.push(subject);if(retentionError)throw retentionError;}};
 const store=storeFactory?.()??{async insert(p){inserts++;stored=clone(p);return clone(p);},async read(){reads++;return clone(stored);}};
 const preparePolicy=async call=>{policyCalls.push(call);const receipt={authorized:true,selectionSha256:call.selectionSha256,binding,
  scopes:[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'current'}],requiredApprover:{tenantId:'tenant',actorId:'actor'},
  proposalExpiresAt:new Date(NOW+60000).toISOString(),checkedAtMs:at,expiresAtMs:at+1000};mutatePolicy?.(receipt,call);return receipt;};
 const owner=createMemoryApprovalMetadataOwner({store,commandContext:context,preparePolicy,retention,now,newId:()=>id(count++),maxRequestMs:1000});
 const tool=createCommandToolInterface({operation:MEMORY_COMMAND_OPERATION,action:'memory.propose',outputShape:'MemoryProposeToolResult',
  commandContext:context,validators:commandToolValidators,assertProposal:assertProposalIntegrity,approvalMetadataOwner:owner,
  executor:{async execute(){effects++;return {status:'indeterminate',outcome:null};}},now,limits:{maxRequestMs:1000,maxFactBytes:65536}});
 const request={content:'  Prefers short briefs  ',scope:'personal',key:'briefing'};
 const input=commandToolValidators.normalizeCommandToolInput('memory.propose',request,{commandContext:context}).input;
 const call={operation:MEMORY_COMMAND_OPERATION,action:'memory.propose',binding,request,input,inputSha256:canonicalSha256(input),deadlineMs:at+1000,signal:undefined};
 const readCall=proposal=>({operation:MEMORY_COMMAND_OPERATION,action:'memory.propose',binding,proposalId:proposal.proposalId,
  commandSha256:proposal.commandSha256,deadlineMs:at+1000,signal:undefined});
 return {owner,tool,request,call,readCall,retention,preparePolicy,get stored(){return stored;},get inserts(){return inserts;},get reads(){return reads;},
  get effects(){return effects;},retentionCalls,policyCalls,advance:ms=>{at+=ms;}};
}
test('personal save_memory prepares a pending immutable command with trusted client context and never executes',async()=>{
 const f=fixture(),prepared=await f.tool.prepare(f.request);
 assert.equal(prepared.status,'approval_required');assert.equal(prepared.proposal.command.action,'memory.propose');
 assert.deepEqual(prepared.proposal.command.arguments,{content:'Prefers short briefs',key:'briefing',scope:'personal',clientId:null,ttlDays:null});
 assert.deepEqual(prepared.proposal.command.binding,binding);assert.equal(f.inserts,1);assert.equal(f.effects,0);
 assert.equal(f.stored.commandSha256,prepared.proposal.commandSha256);
 assert.deepEqual(f.policyCalls.map(call=>call.phase),['prepare','before_release']);
 assert.deepEqual(f.retentionCalls,[{tenantId:'tenant',kind:'conversation',subjectId:id(1)},
  {tenantId:'tenant',kind:'conversation',subjectId:id(1)}]);
 const again=await f.owner.read(f.readCall(prepared.proposal));assert.equal(again.commandId,prepared.proposal.command.commandId);
 assert.deepEqual(f.policyCalls.map(call=>call.phase),['prepare','before_release','before_read','read_release']);
});
test('model supplied client cannot override the selected conversation client or inject proposal authority',async()=>{
 const f=fixture();for(const request of [{...f.request,clientId:id(6)},{...f.request,clientId:id(5)},{...f.request,requiredApprover:{tenantId:'tenant',actorId:'other'}},
  {...f.request,scopes:[]},{...f.request,proposalId:id(8)}])await assert.rejects(f.tool.prepare(request));
 assert.equal(f.inserts,0);assert.equal(f.policyCalls.length,0);
});
test('suppression and an unavailable retention gate refuse before policy or metadata write, including readback',async()=>{
 for(const code of ['RETENTION_SUPPRESSED','RETENTION_READ_UNAVAILABLE']){
  const f=fixture({retentionError:Object.assign(Error(code),{code})});
  await assert.rejects(f.owner.prepare(f.call),e=>e?.outcome==='NOT_STORED');
  await assert.rejects(f.owner.read(f.readCall({proposalId:id(9),commandSha256:'a'.repeat(64)})),e=>e?.outcome==='READ_UNAVAILABLE');
  assert.equal(f.inserts,0);assert.equal(f.reads,0);assert.equal(f.policyCalls.length,0);
 }
});
test('post-insert policy change is stored-not-released, and a changed retained payload cannot be read',async()=>{
 const f=fixture({mutatePolicy:(receipt,call)=>{if(call.phase==='before_release')receipt.scopes[0].policyRevision='changed';}});
 await assert.rejects(f.owner.prepare(f.call),e=>e?.outcome==='STORED_NOT_RELEASED');assert.equal(f.inserts,1);
 const good=fixture(),prepared=await good.tool.prepare(good.request);
 const modified=clone(good.stored);modified.record.request.content='Substituted';
 assert.throws(()=>memoryMetadataPayload(modified),/COMMAND_PREPARATION_REFUSED/);
 await assert.rejects(good.owner.read({...good.readCall(prepared.proposal),commandSha256:'a'.repeat(64)}));
});
test('lost insert acknowledgment remains unknown and never retries with a new identity',async()=>{
 let calls=0;
 const f=fixture({storeFactory:()=>({async insert(){calls++;throw Error('private acknowledgment loss');},async read(){return null;}})});
 await assert.rejects(f.owner.prepare(f.call),e=>e?.outcome==='UNKNOWN'&&!e.message.includes('private'));
 assert.equal(calls,1);assert.equal(f.policyCalls.length,1);
});
test('memory command options use the canonical descriptor and require a bound retention owner',()=>{
 const pool={connect(){}},retention={async assertServable(){}},executor={async execute(){}};
 const options=createMemoryCommandOptions({pool,commandContext:context,preparePolicy:async()=>{},retention,executor,now:()=>NOW,newId:()=>id(1),
  limits:{maxRequestMs:1000,maxFactBytes:65536}});
 assert.equal(options.operation.id,'save_memory');assert.equal(options.action,'memory.propose');assert.equal(options.outputShape,'MemoryProposeToolResult');
 assert.throws(()=>createMemoryCommandOptions({...{pool,commandContext:context,preparePolicy:async()=>{},retention,executor,now:()=>NOW,newId:()=>id(1),limits:{maxRequestMs:1000,maxFactBytes:65536}},retention:null}));
});
test('concrete memory metadata store locks the canonical conversation subject before INSERT, reads exact row and refuses suppression',async()=>{
 const calls=[],rows=new Map();let state='RELEASED',ownerActorId='actor',releases=0;
 const pool={async connect(){return {async query(sql,values){const text=typeof sql==='string'?sql:sql.text;calls.push(text);
   if(text.startsWith('SELECT owner_actor_id,state,ledger_sequence')){const projection={state,ownerActorId,ledgerSequence:1,entrySha256:'a'.repeat(64)};
    return {rows:[{owner_actor_id:ownerActorId,state,ledger_sequence:1,entry_sha256:projection.entrySha256,projection,projection_sha256:canonicalSha256(projection)}]};}
   if(text.startsWith('INSERT INTO meri_commands.approval_metadata')){
    const payload=JSON.parse(values[7]),row={payload,payload_sha256:values[6],payload_purged_at:null,memory_conversation_id:values[8]};rows.set(payload.record.proposalId,row);return {rows:[clone(row)]};}
   if(text.startsWith('SELECT payload,payload_sha256,payload_purged_at,memory_conversation_id FROM meri_commands.approval_metadata'))return {rows:rows.has(values[2])?[clone(rows.get(values[2]))]:[]};
   return {rows:[]};},release(){releases++;}};}};
 const store=createPostgresMemoryApprovalMetadataStore({pool}),f=fixture({storeFactory:()=>store});
 const prepared=await f.tool.prepare(f.request),record=await f.owner.read(f.readCall(prepared.proposal));
 assert.equal(record.proposalId,prepared.proposal.proposalId);assert.equal(rows.size,1);assert.equal(releases,2);
 const lock=calls.findIndex(text=>text.includes('pg_advisory_xact_lock(hashtextextended($1,0))'));
 assert.ok(lock>=0&&calls.findIndex(text=>text.startsWith('SELECT owner_actor_id,state,ledger_sequence'))>lock&&
  calls.findIndex(text=>text.startsWith('INSERT INTO meri_commands.approval_metadata'))>lock);
 rows.get(prepared.proposal.proposalId).payload=null;rows.get(prepared.proposal.proposalId).payload_purged_at=new Date(NOW).toISOString();
 await assert.rejects(f.owner.read(f.readCall(prepared.proposal)),e=>e?.outcome==='READ_UNAVAILABLE');
 state='SUPPRESSED';const blocked=fixture({storeFactory:()=>store});
 await assert.rejects(blocked.owner.prepare(blocked.call),e=>e?.outcome==='NOT_STORED');assert.equal(rows.size,1);
 state='RELEASED';ownerActorId='other';const foreign=fixture({storeFactory:()=>store});
 await assert.rejects(foreign.owner.prepare(foreign.call),e=>e?.outcome==='NOT_STORED');assert.equal(rows.size,1);
});
test('an unacknowledged SQL COMMIT is UNKNOWN and no second insert is attempted',async()=>{
 let inserts=0;
 const pool={async connect(){return {async query(sql,values){const text=typeof sql==='string'?sql:sql.text;
  if(text.startsWith('SELECT state FROM meri_conversations.retention_subjects'))return {rows:[]};
  if(text.startsWith('INSERT INTO meri_commands.approval_metadata')){inserts++;return {rows:[{payload:JSON.parse(values[7]),payload_sha256:values[6]}]};}
  if(text==='COMMIT')throw Error('private commit loss');return {rows:[]};},release(){}};}};
 const f=fixture({storeFactory:()=>createPostgresMemoryApprovalMetadataStore({pool})});
 await assert.rejects(f.owner.prepare(f.call),e=>e?.outcome==='UNKNOWN');assert.equal(inserts,1);
});
