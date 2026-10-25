import test from 'node:test';
import assert from 'node:assert/strict';
import {binding,scopes,versions,id} from './store-fixture.mjs';
import {contentRows} from './retention-content-fixture.mjs';
import {hash} from '../boundary.mjs';
import {decodeConversationInventoryRows} from '../retention-inventory-decode.mjs';
import {createConversationRetentionInventory} from '../retention-inventory.mjs';
import {assertConversationContentTarget,conversationContentTables} from '../retention-content-rows.mjs';
import {enumerateReferences} from '../../retention/inventory.mjs';
import {makePayload,input as commandInput} from '../../commands/approval-metadata/binding.mjs';
import {taskKind} from '../../commands/approval-metadata/task-kind.mjs';
import {conversationPurgeRow,tombstone} from '../../retention/conversation-purge-rows.mjs';
import {createExecutionBinding,executionIdentity} from '../execution-boundary.mjs';
import {prepare as prepareLookup,event as lookupEvent} from '../../task-lookup/binding.mjs';
import {createPostgresRetentionJournal} from '../../retention/postgres-journal.mjs';
import {buildCandidate} from '../../memory/candidate.mjs';
import {standaloneFixture} from '../../../runtime/native-authority/test/standalone-tasks-fixture.mjs';
import {initialInputFixture} from './initial-input-fixture.mjs';
const prefix='meri_conversations.',now='2026-10-24T00:00:00.000Z';
test('content target keys ignore property order and require typed integer values',()=>{
 for(const [table,className,key,numeric] of [
  ['sdk_session_entries','sdkSession',{run_id:id(2),session_id:id(3),subpath:'opaque,\"\u03bb',sequence:1},'sequence'],
  ['initial_run_bindings','conversation',{generation:1},'generation'],
 ]){
  const target={className,table:prefix+table,key,rowSha256:'a'.repeat(64)},reordered={...target,key:Object.fromEntries(Object.entries(key).reverse())};
  assert.deepEqual(assertConversationContentTarget(reordered),target);
  for(const value of ['1','01',true])assert.throws(()=>assertConversationContentTarget({...target,key:{...key,[numeric]:value}}),/STORE_CORRUPT/);
  assert.throws(()=>assertConversationContentTarget({...target,key:{...key,extra:1}}),/INVALID_COMMAND/);
 }
});
function fixture({empty=false}={}){
 const conversation={conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,policyRevision:'policy1',createdAt:now};
 const run={binding,state:'running',scopes,policyRevision:'policy1',versions,createdAt:now},request={requestId:id(90),prompt:'Synthetic private prompt',skill:null,window:null};
 const event={contractVersion:'0.1.0',eventId:id(91),binding,sequence:1,createdAt:now,scopes,type:'run.status',data:{state:'running',reasonCode:null}};
 const tuple={tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId};
 const raw={subject:{tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId,ownerActorId:binding.actorId},
  conversation:{tenant_id:binding.tenantId,conversation_id:binding.conversationId,owner_actor_id:binding.actorId,projection:conversation,projection_sha256:hash(conversation)},
  runs:empty?[]:[{...tuple,projection:run,projection_sha256:hash(run),request_id:request.requestId,request,request_sha256:hash(request),last_sequence:1,sequence_base:0,sequence_end:null}],
  events:empty?[]:[{...tuple,sequence:1,event_id:event.eventId,event,event_sha256:hash(event)}],controls:[],checkpoints:[],completionCheckpoints:[],nextRuns:[],memoryContinuations:[],memoryContextRows:[],memoryCandidates:[],contentRows:contentRows()};
 return {raw,tuple,run,request,decode:()=>decodeConversationInventoryRows(raw)};
}
function initialTask({action='task.create',general=false,explicitClient=false}={}){
 const f=fixture({empty:true}),selectedClientId=general?null:id(5),taskScopes=[{...scopes[0],kind:general?'private-user':'client',resourceId:selectedClientId??binding.actorId}],kind=taskKind(action);
 f.raw.conversation.projection.scopes=taskScopes;f.raw.conversation.projection_sha256=hash(f.raw.conversation.projection);
 const initial={schemaVersion:1,state:'ADMITTED',binding,selectedClientId,policyRevision:'policy1',versions,configurationSha256:'f'.repeat(64),createdAtMs:Date.parse(now)-1000,expiresAtMs:Date.parse(now)+1000};
 const original={...f.tuple,generation:1,record:initial,record_sha256:hash(initial)};
 const request=action==='task.create'?{title:'  Private initial task  ',dueDate:'2026-10-24',...(explicitClient?{clientId:'Client reference'}:{})}:{taskId:id(812),title:'  Private initial task  ',status:'open'};
 const context=action==='task.create'?{binding,clientResolution:explicitClient?{reference:request.clientId,clientId:id(5)}:null}:{binding},input=commandInput(request,context,action);
 const record={operation:kind.operation,action,binding,request,inputSha256:hash(input),commandId:id(202),idempotencyKey:'initial-task-command',proposalId:id(203),scopes:taskScopes,createdAt:now,expiresAt:'2026-10-24T00:10:00.000Z',requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId}};
 const payload=makePayload(record,context),metadata={tenant_id:binding.tenantId,actor_id:binding.actorId,proposal_id:record.proposalId,command_id:record.commandId,idempotency_key:record.idempotencyKey,command_sha256:payload.commandSha256,payload_sha256:hash(payload),payload};
 const command={contractVersion:kind.contractVersion,commandId:record.commandId,binding,action,...input,scopes:taskScopes,idempotencyKey:record.idempotencyKey};
 const proposal={proposalId:record.proposalId,command,commandSha256:hash(command),createdAt:record.createdAt,expiresAt:record.expiresAt,requiredApprover:record.requiredApprover};
 kind.assertCommand(command,context);kind.assertProposal(proposal,context);
 const intentRecord={operation:kind.operation,argumentsSha256:hash({binding,arguments:request})};
 const intent={tenant_id:binding.tenantId,actor_id:binding.actorId,conversation_id:binding.conversationId,delivery_id:'sdk:'+hash({kind:'public-task-preparation',operation:kind.operation,requestId:id(204)}),record:intentRecord,record_sha256:hash(intentRecord),state:'PREPARED',outcome:{result:{status:'approval_required',proposal},release:{binding,scopes:taskScopes,expiresAtMs:initial.expiresAtMs}},outcome_purged_at:null,settled_at:new Date(now)};
 const journalPayload={proposal,context},journal={tenant_id:binding.tenantId,actor_id:binding.actorId,idempotency_key:command.idempotencyKey,command_id:command.commandId,command_sha256:hash(command),proposal_sha256:hash(proposal),payload_sha256:hash(journalPayload),payload:journalPayload,
  executor:{contractVersion:'0.1.0',requestId:id(210),capabilityId:id(211),proposalId:proposal.proposalId,commandSha256:hash(command),idempotencyKey:command.idempotencyKey,executorBinding:binding},state:'OUTCOME',outcome:{status:'observed',result:{title:'Private initial task'}}};
 const rows=f.raw.contentRows;rows[prefix+'initial_run_bindings']=[original];rows['meri_commands.approval_metadata']=[metadata];rows['meri_intents.preparations']=[intent];rows['meri_commands.command_journal']=[journal];
 return {...f,original,metadata,intent,journal,proposal};
}
function sdk(f,{empty=false}={}){
 const key={projectKey:'-workspace-conversation',sessionId:id(800)},owner=structuredClone({binding,scopes,selectedClientId:id(5),policyRevision:'policy1',key,executionSha256:'a'.repeat(64),expiresAtMs:1});
 const tuple={...f.tuple,session_id:key.sessionId},main=empty?[]:Array.from({length:20},(_,i)=>({type:i%2?'assistant':'user',uuid:id(1000+i),message:{content:'Private transcript '+i},opaque:{keep:[null,true,i]}}));
 const parts=empty?[]:[['',main],['subagents/original',[{type:'system',child:{exact:true}},{type:'assistant',uuid:id(1200),text:'Private substream'}]]];
 const entries=parts.flatMap(([subpath,values])=>values.map((entry,i)=>({...tuple,subpath,sequence:String(i+1),entry_uuid:entry.uuid??null,entry,entry_sha256:hash(entry)})));
 f.raw.contentRows[prefix+'sdk_sessions']=[{...tuple,project_key:key.projectKey,owner,owner_sha256:hash(owner),entries_count:String(entries.length),bytes:String(entries.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e.entry)),0))}];
 f.raw.contentRows[prefix+'sdk_session_streams']=parts.map(([subpath,values])=>({...tuple,subpath,last_sequence:String(values.length)}));
 f.raw.contentRows[prefix+'sdk_session_entries']=entries;
 if(!empty){const receipt={binding,key,requestSha256:'c'.repeat(64),committed:true,appendId:id(850),entriesSha256:hash(main),offset:20,added:20};
  f.raw.contentRows[prefix+'sdk_session_batches']=[{...tuple,append_id:receipt.appendId,request_sha256:receipt.requestSha256,receipt,receipt_sha256:hash(receipt)}];}
}
test('genuine zero-run registration enumerates only its actual parent, no fabricated run',()=>{
 const f=fixture({empty:true}),decoded=f.decode(),inventory=enumerateReferences(decoded);
 assert.deepEqual(decoded.runs,[]);assert.deepEqual(decoded.contentRows,[]);assert.equal(inventory.rowTargets.length,1);
 assert.deepEqual(inventory.rowTargets[0],{className:'conversation',table:'conversations',conversationId:binding.conversationId,projectionSha256:decoded.conversation.projectionSha256});
 for(const change of [r=>r.conversation.owner_actor_id='foreign',r=>{r.conversation.projection.owner.actorId='foreign';r.conversation.projection_sha256=hash(r.conversation.projection);},r=>delete r.contentRows]){
  const wrong=structuredClone(f.raw);change(wrong);assert.throws(()=>decodeConversationInventoryRows(wrong),/STORE_CORRUPT/);
 }
});
test('reserved original generation is inventory, not a fabricated accepted run',()=>{
 const f=fixture({empty:true}),record={schemaVersion:1,state:'ADMITTED',binding,selectedClientId:id(5),policyRevision:'policy1',versions,configurationSha256:'f'.repeat(64),createdAtMs:1,expiresAtMs:2};
 f.raw.contentRows[prefix+'initial_run_bindings']=[{...f.tuple,generation:1,record,record_sha256:hash(record)}];
 const allocation={binding,scopes,versions,selectedClientId:id(5),requestId:id(90),inputSha256:'c'.repeat(64),requestSha256:'d'.repeat(64),allocatedAtMs:1,expiresAtMs:2};
 f.raw.contentRows[prefix+'initial_inputs']=[{...f.tuple,request_id:allocation.requestId,allocation,allocation_sha256:hash(allocation),state:'RESERVED',accepted_request_sha256:null}];
 assert.equal(enumerateReferences(f.decode()).rowTargets.length,3);
 const row=f.raw.contentRows[prefix+'initial_inputs'][0];row.state='ACCEPTED';row.accepted_request_sha256=allocation.requestSha256;assert.throws(f.decode,/STORE_CORRUPT/);
});

for(const action of ['task.create','task.update'])for(const general of [false,true])test(`initial ${general?'General':'client'} ${action} metadata, prepared intent and settled command reach existing purge owners without a run`,()=>{
 const f=initialTask({action,general}),decoded=f.decode(),inventory=enumerateReferences(decoded);
 assert.deepEqual(decoded.runs,[]);assert.equal(inventory.rowTargets.length,5);assert.equal(JSON.stringify(inventory).includes('Private initial task'),false);
 assert.equal(f.proposal.command.contractVersion,action==='task.create'?'0.1.0':'0.2.0');
 if(action==='task.create')assert.equal(f.proposal.command.arguments.clientId,null,'selected client does not alter an omitted task client');
 const expected=new Map([[prefix+'initial_run_bindings','identity'],['meri_commands.approval_metadata','approval'],['meri_intents.preparations','intent'],['meri_commands.command_journal','command']]);
 for(const target of decoded.contentRows){const row=f.raw.contentRows[target.table][0],owner=conversationPurgeRow(f.raw.subject,{className:target.className,target});
  assert.equal(owner.mode,expected.get(target.table));owner.verify(row);
  assert.deepEqual(owner.args().slice(0,2),[binding.tenantId,binding.conversationId]);
  if(owner.mode==='identity'){assert.equal(owner.sql,null);assert.equal(owner.erased(row),true);}
  else{assert.equal(owner.erased(row),false);const erased=owner.mode==='intent'?{...row,state:'REDACTED',outcome:null,outcome_purged_at:new Date(now)}:{...row,payload:tombstone(binding.conversationId),...(owner.mode==='command'?{outcome:tombstone(binding.conversationId)}:{})};assert.equal(owner.erased(erased),true);}
 }
});

test('initial task normalization preserves explicit client resolution even in General custody',()=>{
 const f=initialTask({general:true,explicitClient:true});assert.equal(f.decode().contentRows.length,4);
 assert.equal(f.proposal.command.arguments.clientId,id(5));assert.equal(f.proposal.command.scopes[0].kind,'private-user');
 const wrong=JSON.parse(JSON.stringify(f.raw)),row=wrong.contentRows['meri_commands.approval_metadata'][0];row.payload.commandContext.clientResolution.clientId=id(999);row.payload_sha256=hash(row.payload);
 assert.throws(()=>decodeConversationInventoryRows(wrong),/STORE_CORRUPT/);
});

test('expired and superseded initial task provenance remains inventory after a later generation starts',()=>{
 const f=initialTask(),later=fixture(),newBinding={...binding,runId:id(30),attemptId:id(31),workerId:id(32)},original=structuredClone(f.original);
 original.generation=2;original.run_id=newBinding.runId;original.record.binding=newBinding;original.record.createdAtMs=Date.parse(now)+60000;original.record.expiresAtMs=Date.parse(now)+61000;original.record_sha256=hash(original.record);
 f.raw.contentRows[prefix+'initial_run_bindings'].push(original);
 assert.equal(f.decode().contentRows.length,5,'historical task uses its own initial generation, not the latest');
 later.raw.runs[0].run_id=newBinding.runId;later.raw.runs[0].projection.binding=newBinding;later.raw.runs[0].projection_sha256=hash(later.raw.runs[0].projection);
 later.raw.events[0].run_id=newBinding.runId;later.raw.events[0].event.binding=newBinding;later.raw.events[0].event_sha256=hash(later.raw.events[0].event);
 f.raw.runs=later.raw.runs;f.raw.events=later.raw.events;assert.equal(f.decode().contentRows.length,5);
 assert.deepEqual(f.decode().runs.map(r=>r.runId),[newBinding.runId]);
});

test('initial task custody can coexist with its accepted run, but cannot hide a different original binding on that run',()=>{
 const f=initialTask(),accepted=fixture();f.raw.runs=accepted.raw.runs;f.raw.events=accepted.raw.events;assert.equal(f.decode().contentRows.length,4);
 const changed={...binding,workerId:id(999)};f.raw.runs[0].projection.binding=changed;f.raw.runs[0].projection_sha256=hash(f.raw.runs[0].projection);
 f.raw.events[0].event.binding=changed;f.raw.events[0].event_sha256=hash(f.raw.events[0].event);assert.throws(f.decode,/STORE_CORRUPT/);
});

for(const [name,mutate] of Object.entries({
 'missing original':rows=>{rows[prefix+'initial_run_bindings']=[];},
 'unrelated original run':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.run_id=id(999);r.record.binding.runId=r.run_id;r.record_sha256=hash(r.record);},
 'original hash':rows=>{rows[prefix+'initial_run_bindings'][0].record_sha256='0'.repeat(64);},
 'original actor':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.record.binding.actorId='foreign';r.record_sha256=hash(r.record);},
 'original attempt':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.record.binding.attemptId=id(999);r.record_sha256=hash(r.record);},
 'original worker':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.record.binding.workerId=id(999);r.record_sha256=hash(r.record);},
 'original fence':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.record.binding.writerFence=2;r.record_sha256=hash(r.record);},
 'original client':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.record.selectedClientId=id(999);r.record_sha256=hash(r.record);},
 'original policy':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.record.policyRevision='changed-policy';r.record_sha256=hash(r.record);},
 'original versions':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.record.versions={};r.record_sha256=hash(r.record);},
 'original configuration digest':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.record.configurationSha256='invalid';r.record_sha256=hash(r.record);},
 'original admitted after proposal':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.record.createdAtMs=Date.parse(now)+1;r.record_sha256=hash(r.record);},
 'original timestamp string':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.record.createdAtMs=String(r.record.createdAtMs);r.record_sha256=hash(r.record);},
 'original extra field':rows=>{const r=rows[prefix+'initial_run_bindings'][0];r.record.extra=true;r.record_sha256=hash(r.record);},
 'duplicate original run':rows=>{const r=structuredClone(rows[prefix+'initial_run_bindings'][0]);r.generation=2;rows[prefix+'initial_run_bindings'].push(r);},
 'raw request normalization':rows=>{const r=rows['meri_commands.approval_metadata'][0];r.payload.record.request.title='Substituted';r.payload_sha256=hash(r.payload);},
 'intent release attempt':rows=>{rows['meri_intents.preparations'][0].outcome.release.binding.attemptId=id(999);},
 'intent release scopes':rows=>{rows['meri_intents.preparations'][0].outcome.release.scopes[0].policyRevision='changed-policy';},
 'intent command hash':rows=>{rows['meri_intents.preparations'][0].outcome.result.proposal.commandSha256='0'.repeat(64);},
 'intent operation':rows=>{const r=rows['meri_intents.preparations'][0];r.record.operation.id='update_task';r.record_sha256=hash(r.record);},
 'intent result status':rows=>{rows['meri_intents.preparations'][0].outcome.result.status='prepared';},
 'intent extra release field':rows=>{rows['meri_intents.preparations'][0].outcome.release.extra=true;},
 'intent expiry structure':rows=>{rows['meri_intents.preparations'][0].outcome.release.expiresAtMs='expired';},
 'journal command context':rows=>{const r=rows['meri_commands.command_journal'][0];r.payload.context.binding.workerId=id(999);r.payload_sha256=hash(r.payload);},
 'journal context extra field':rows=>{const r=rows['meri_commands.command_journal'][0];r.payload.context.extra=true;r.payload_sha256=hash(r.payload);},
 'journal executor proposal':rows=>{rows['meri_commands.command_journal'][0].executor.proposalId=id(999);},
 'journal executor run':rows=>{rows['meri_commands.command_journal'][0].executor.executorBinding.runId=id(999);},
}))test(`initial task inventory refuses ${name}`,()=>{
 const raw=JSON.parse(JSON.stringify(initialTask().raw));mutate(raw.contentRows);assert.throws(()=>decodeConversationInventoryRows(raw),/STORE_CORRUPT/);
});

for(const [table,states] of [['meri_intents.preparations',['PENDING','UNKNOWN']],['meri_commands.command_journal',['CLAIMED','UNKNOWN']]])for(const state of states)test(`initial task ${state} ${table} remains a purge blocker`,()=>{
 const f=initialTask(),row=f.raw.contentRows[table][0];row.state=state;row.outcome=null;
 const target=f.decode().contentRows.find(t=>t.table===table),owner=conversationPurgeRow(f.raw.subject,{className:target.className,target});
 assert.throws(()=>owner.verify(row),/RETENTION_PURGE_BLOCKED/);assert.equal(owner.erased(row),false);
});

test('initial custody does not substitute for an unrelated document run or intent operation',()=>{
 const f=initialTask(),request={preparationSha256:'a'.repeat(64),artifactRequestSha256:'b'.repeat(64),sourceContextSha256:'c'.repeat(64),baseVersionId:null,title:'Private document',format:'docx'},record={...f.metadata.payload.record,action:'document.draft',operation:{id:'create_word',version:'0.2.0'},request,inputSha256:hash({arguments:request,attachments:[]})};
 const payload=makePayload(record,{binding,scopes});Object.assign(f.metadata,{payload,payload_sha256:hash(payload),command_sha256:payload.commandSha256});assert.throws(f.decode,/STORE_CORRUPT/);
 const g=initialTask();g.intent.record.operation={id:'create_word',version:'0.2.0'};g.intent.record_sha256=hash(g.intent.record);g.intent.state='FAILED';g.intent.outcome={code:'UNAVAILABLE'};assert.throws(g.decode,/STORE_CORRUPT/);
});

for(const state of ['FAILED','REDACTED'])test(`content-free initial task ${state} intent remains retained without inventing a run`,()=>{
 const f=initialTask();f.intent.state=state;f.intent.outcome=state==='FAILED'?{code:'UNAVAILABLE'}:null;if(state==='REDACTED')f.intent.outcome_purged_at=new Date(now);
 const target=f.decode().contentRows.find(t=>t.table==='meri_intents.preparations'),owner=conversationPurgeRow(f.raw.subject,{className:target.className,target});
 owner.verify(f.intent);assert.equal(owner.erased(f.intent),true);assert.deepEqual(f.decode().runs,[]);
});

for(const general of [false,true])test(`actual standalone ${general?'General':'client'} task preparation rows flow through initial retention inventory`,async()=>{
 const db=initialInputFixture(),store=db.store(),producer=standaloneFixture({general}),f=fixture({empty:true});
 const {record}=await store.initialBindings.claim({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId,selectedClientId:general?null:id(5),policyRevision:'policy1',versions,configurationSha256:'a'.repeat(64),proposedExpiresAtMs:db.now()+60000},()=>{});
 producer.state.binding=record.binding;producer.store.initialBindings=store.initialBindings;
 const response=await producer.call('prepare',producer.raw);assert.equal(response.status,200,await response.clone().text());const {proposal}=await response.json();
 assert.equal(producer.state.effects,0);assert.equal(producer.state.decisions,0);assert.equal(db.state.runs.size,0);
 f.raw.conversation.projection.scopes=producer.scopes;f.raw.conversation.projection_sha256=hash(f.raw.conversation.projection);
 f.raw.contentRows[prefix+'initial_run_bindings']=structuredClone(db.bindings);
 f.raw.contentRows['meri_commands.approval_metadata']=[...producer.metadata.rows.values()].map(row=>{
  const r=row.payload.record;return {...row,tenant_id:r.binding.tenantId,actor_id:r.binding.actorId,proposal_id:r.proposalId,command_id:r.commandId,idempotency_key:r.idempotencyKey,command_sha256:row.payload.commandSha256};
 });
 f.raw.contentRows['meri_intents.preparations']=[...producer.sql.state.rows.values()].map(row=>({...row,outcome_purged_at:null}));
 assert.deepEqual(f.raw.contentRows['meri_intents.preparations'][0].outcome.result.proposal,proposal);
 const decoded=f.decode();assert.deepEqual(decoded.runs,[]);assert.equal(enumerateReferences(decoded).rowTargets.length,4);
 for(const target of decoded.contentRows)conversationPurgeRow(f.raw.subject,{className:target.className,target}).verify(f.raw.contentRows[target.table][0]);
 const wrong=structuredClone(f.raw);wrong.contentRows[prefix+'initial_run_bindings']=[];assert.throws(()=>decodeConversationInventoryRows(wrong),/STORE_CORRUPT/);
});

test('zero-run receipt enumeration still requires a pinned snapshot, initial provenance target and allowed content owners',()=>{
 const decoded=initialTask().decode();
 for(const change of [s=>delete s.inventorySha256,s=>s.inventorySha256='0'.repeat(64),s=>s.contentRows[0].rowSha256='0'.repeat(64)]){
  const wrong=structuredClone(decoded);change(wrong);assert.throws(()=>enumerateReferences(wrong),/RETENTION_INVALID_REQUEST/);
 }
 for(const change of [s=>{s.contentRows=s.contentRows.filter(t=>t.table!==prefix+'initial_run_bindings');},s=>{s.contentRows.push({className:'selectedOutputs',table:prefix+'selected_reads',key:{run_id:binding.runId,delivery_sha256:'a'.repeat(64)},rowSha256:'b'.repeat(64)});}]){
  const {inventorySha256:ignored,...wrong}=structuredClone(decoded);change(wrong);assert.throws(()=>enumerateReferences({...wrong,inventorySha256:hash(wrong)}),/RETENTION_INVALID_REQUEST/);
 }
});
test('SDK exact 22 entries, substream, parent headers and replay batch form one complete content-free target',()=>{
 const f=fixture();sdk(f);const decoded=f.decode(),inventory=enumerateReferences(decoded),targets=inventory.rowTargets.filter(r=>r.className==='sdkSession');
 assert.equal(targets.length,1);assert.deepEqual(targets[0].sdk.counts,{sessions:1,streams:2,entries:22,batches:1});
 assert.ok(targets.every(t=>/^[a-f0-9]{64}$/.test(t.rowSha256)));assert.equal(JSON.stringify(inventory).includes('Private transcript'),false);
 const first=decoded.inventorySha256;f.raw.contentRows[prefix+'sdk_session_entries'][0].entry.message.content='Changed private content';f.raw.contentRows[prefix+'sdk_session_entries'][0].entry_sha256=hash(f.raw.contentRows[prefix+'sdk_session_entries'][0].entry);
 f.raw.contentRows[prefix+'sdk_sessions'][0].bytes=String(f.raw.contentRows[prefix+'sdk_session_entries'].reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e.entry)),0));assert.notEqual(f.decode().inventorySha256,first);
});
test('a registered SDK session without streams is real empty content, not missing history',()=>{const f=fixture();sdk(f,{empty:true});assert.equal(f.decode().contentRows.length,1);});
for(const [name,mutate] of Object.entries({
 'missing table':r=>delete r[prefix+'sdk_session_entries'],
 'missing parent':r=>r[prefix+'sdk_sessions']=[],
 'missing stream':r=>r[prefix+'sdk_session_streams'].pop(),
 'duplicate header':r=>r[prefix+'sdk_sessions'].push(structuredClone(r[prefix+'sdk_sessions'][0])),
 'foreign actor':r=>{const row=r[prefix+'sdk_sessions'][0];row.owner.binding.actorId='foreign';row.owner_sha256=hash(row.owner);},
 'count':r=>r[prefix+'sdk_sessions'][0].entries_count='23',
 'bytes':r=>r[prefix+'sdk_sessions'][0].bytes='1',
 'entry hash':r=>r[prefix+'sdk_session_entries'][0].entry_sha256='f'.repeat(64),
 'gap':r=>r[prefix+'sdk_session_entries'][0].sequence='2',
 'foreign stream':r=>r[prefix+'sdk_session_streams'][0].session_id=id(999),
 'batch hash':r=>r[prefix+'sdk_session_batches'][0].receipt_sha256='f'.repeat(64),
 'batch key':r=>{const b=r[prefix+'sdk_session_batches'][0];b.receipt.key.projectKey='foreign';b.receipt_sha256=hash(b.receipt);},
 'batch offset':r=>{const b=r[prefix+'sdk_session_batches'][0];b.receipt.offset=21;b.receipt_sha256=hash(b.receipt);},
 'null count':r=>r[prefix+'sdk_sessions'][0].entries_count=null,
 'boolean sequence':r=>r[prefix+'sdk_session_entries'][0].sequence=true,
 'noncanonical integer':r=>r[prefix+'sdk_session_entries'][0].sequence='01',
}))test(`complete SDK inventory refuses ${name}`,()=>{const f=fixture();sdk(f);mutate(f.raw.contentRows);assert.throws(f.decode,/STORE_CORRUPT/);});

test('registered identity cannot acquire a different client or General scope through original-input facts',()=>{
 const f=fixture({empty:true}),record={schemaVersion:1,state:'ADMITTED',binding,selectedClientId:id(5),policyRevision:'previous-policy',versions,configurationSha256:'f'.repeat(64),createdAtMs:1,expiresAtMs:2};
 f.raw.contentRows[prefix+'initial_run_bindings']=[{...f.tuple,generation:1,record,record_sha256:hash(record)}];
 assert.equal(f.decode().contentRows.length,1,'historical policy metadata is not renewed authority');
 for(const client of [null,id(999)]){record.selectedClientId=client;f.raw.contentRows[prefix+'initial_run_bindings'][0].record_sha256=hash(record);assert.throws(f.decode,/STORE_CORRUPT/);}
});

test('actual task lookup binding and both reserved event slots remain exact while dispatch is uncertain',()=>{
 const f=fixture(),at=Date.parse(now),context={lookupId:id(501),resultReference:id(502),requestId:id(503),binding,scopes,selectedClientId:id(5),
  deliveryJson:JSON.stringify({context:{binding},producer:{namespace:'synthetic',executionId:'task'},deliveryId:'lookup'}),
  slots:{started:{eventId:id(504),sequence:2},terminal:{eventId:id(505),sequence:3}},deadlineMs:at+1000};
 const payload=prepareLookup({limit:20},context,at),row={tenant_id:binding.tenantId,lookup_id:context.lookupId,result_reference:context.resultReference,payload,state:'DISPATCHING',record:null};
 f.raw.contentRows['meri_task_lookup.lookups']=[row];f.raw.contentRows['meri_task_lookup.events']=Object.entries(context.slots).map(([kind,slot])=>({tenant_id:binding.tenantId,run_id:binding.runId,sequence:slot.sequence,event_id:slot.eventId,lookup_id:context.lookupId,kind,event:kind==='started'?lookupEvent(payload,'tool.started',at):null}));
 assert.equal(f.decode().contentRows.length,3);
 for(const change of [r=>r['meri_task_lookup.events'].pop(),r=>r['meri_task_lookup.events'][0].lookup_id=id(999),r=>r['meri_task_lookup.events'][1].sequence=4,
  r=>{r['meri_task_lookup.lookups'][0].payload.context.binding.actorId='foreign';}]){const wrong=structuredClone(f.raw);change(wrong.contentRows);assert.throws(()=>decodeConversationInventoryRows(wrong),/STORE_CORRUPT/);}
});

for(const count of [31,32,33])test(`snapshot pagination retains all ${count} original generations with exact cursor and no duplicate page`,async()=>{
 const f=fixture({empty:true}),calls=[],records=Array.from({length:count},(_,i)=>{const record={schemaVersion:1,state:'ADMITTED',binding:{...binding,runId:id(3000+i)},selectedClientId:id(5),policyRevision:'policy1',versions,configurationSha256:'f'.repeat(64),createdAtMs:1,expiresAtMs:2};return {...f.tuple,run_id:record.binding.runId,generation:i+1,record,record_sha256:hash(record)};});
 const pool={async connect(){return {async query(sql,args){if(sql.startsWith('SELECT * FROM meri_conversations.conversations'))return {rows:[f.raw.conversation]};
  if(sql.startsWith('SELECT r.* FROM meri_conversations.initial_run_bindings')){calls.push(args[2]);return {rows:records.filter(r=>args[2]===null||r.generation>args[2]).slice(0,33)};}return {rows:[]};},release(){}};}};
 const result=await createConversationRetentionInventory({pool}).inventoryForConversation({tenantId:binding.tenantId,conversationId:binding.conversationId,ownerActorId:binding.actorId});
 assert.equal(result.contentRows.length,count);assert.equal(new Set(result.contentRows.map(r=>r.key.generation)).size,count);assert.deepEqual(calls,count>32?[null,32]:[null]);
});

test('exact row preflight requires actual retained rows and refuses an unavailable store before any effect',async()=>{
 const f=fixture();sdk(f);let calls=0;const journal=createPostgresRetentionJournal({pool:{async connect(){calls++;throw Error('no database allowed');}}});
 const rowSteps=enumerateReferences(f.decode()).rowTargets.map(target=>({className:target.className,target}));
 await assert.rejects(journal.rows.preflight(`${binding.tenantId}:conversation:${binding.conversationId}`,{rowSteps}),/RETENTION_STORE_UNAVAILABLE/);assert.equal(calls,1);
});
test('actual immutable document approval payload is bound to its canonical run and exact command identity',()=>{
 const f=fixture(),request={preparationSha256:'a'.repeat(64),artifactRequestSha256:'b'.repeat(64),sourceContextSha256:'c'.repeat(64),baseVersionId:null,title:'Private selected title',format:'docx'};
 const record={operation:{id:'create_word',version:'0.2.0'},action:'document.draft',binding,request,inputSha256:hash({arguments:request,attachments:[]}),commandId:id(202),idempotencyKey:'synthetic-command',proposalId:id(203),scopes,createdAt:now,expiresAt:'2026-10-24T00:10:00.000Z',requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId}};
 const payload=makePayload(record,{binding,scopes}),row={tenant_id:binding.tenantId,actor_id:binding.actorId,proposal_id:record.proposalId,command_id:record.commandId,idempotency_key:record.idempotencyKey,command_sha256:payload.commandSha256,payload_sha256:hash(payload),payload};
 f.raw.contentRows['meri_commands.approval_metadata']=[row];const d=f.decode();assert.equal(d.contentRows[0].table,'meri_commands.approval_metadata');assert.equal(JSON.stringify(d).includes(request.title),false);
 for(const mutate of [r=>r.actor_id='foreign',r=>r.command_sha256='f'.repeat(64),r=>r.proposal_id=id(999),r=>{r.payload.record.scopes[0].resourceId=id(999);r.payload_sha256=hash(r.payload); }]){
  const wrong=structuredClone(f.raw);mutate(wrong.contentRows['meri_commands.approval_metadata'][0]);assert.throws(()=>decodeConversationInventoryRows(wrong),/STORE_CORRUPT/);}
 const command={contractVersion:'0.2.0',commandId:record.commandId,binding,action:'document.draft',arguments:request,attachments:[],scopes,idempotencyKey:record.idempotencyKey};
 const proposal={proposalId:record.proposalId,command,commandSha256:hash(command),createdAt:record.createdAt,expiresAt:record.expiresAt,requiredApprover:record.requiredApprover},journalPayload={proposal,context:{binding,scopes}};
 const journal={tenant_id:binding.tenantId,actor_id:binding.actorId,idempotency_key:command.idempotencyKey,command_id:command.commandId,command_sha256:hash(command),proposal_sha256:hash(proposal),payload_sha256:hash(journalPayload),payload:journalPayload,
  executor:{contractVersion:'0.1.0',requestId:id(210),capabilityId:id(211),proposalId:proposal.proposalId,commandSha256:hash(command),idempotencyKey:command.idempotencyKey,executorBinding:binding},state:'UNKNOWN',outcome:null};
 f.raw.contentRows['meri_commands.command_journal']=[journal];assert.equal(f.decode().contentRows.length,2,'unknown command outcome is retained, never declared settled');
 for(const field of ['proposalId','commandSha256','idempotencyKey']){const wrong=structuredClone(f.raw);wrong.contentRows['meri_commands.command_journal'][0].executor[field]=field==='proposalId'?id(999):'f'.repeat(64);assert.throws(()=>decodeConversationInventoryRows(wrong),/STORE_CORRUPT/);}
});
test('native execution, selected text and intent outcome are exact distinct targets, with unknown retained',()=>{
 const f=fixture(),c=f.raw.contentRows,{versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{runtime:'synthetic'},expiresAtMs:10,runtimeSessionId:'conversation-'+hash(binding)}),record={...identity,phase:'settled',native:{state:'completed'}};
 c[prefix+'native_executions']=[{...f.tuple,execution_key:identity.executionKey,execution_id:identity.executionId,record,record_sha256:hash(record)}];
 c[prefix+'selected_reads']=[{...f.tuple,delivery_sha256:'a'.repeat(64),selector:{synthetic:true},allocation_sha256:'b'.repeat(64),stage:'RETAINED',result_text:'Private selected read',completion:{synthetic:true}}];
 const prepared={recipe:'original-selected-output-retention/1',request:f.request,pending:{sourceBinding:binding,preparationSha256:'a'.repeat(64)},prepared:{context:{binding,scopes,assets:[]}},reads:[]};
 c[prefix+'selected_outputs']=[{...f.tuple,preparation_sha256:'a'.repeat(64),projection:prepared,projection_sha256:hash(prepared)}];
 const intent={operation:{id:'create_word',version:'0.2.0'},argumentsSha256:'d'.repeat(64)};
 c['meri_intents.preparations']=[{tenant_id:binding.tenantId,actor_id:binding.actorId,conversation_id:binding.conversationId,delivery_id:'sdk:'+'d'.repeat(64),record:intent,record_sha256:hash(intent),state:'UNKNOWN',outcome:null,outcome_purged_at:null}];
 assert.equal(f.decode().contentRows.length,4);assert.equal(enumerateReferences(f.decode()).rowTargets.length,7);
 const before=f.decode().inventorySha256;c[prefix+'selected_reads'][0].result_text='Changed';assert.notEqual(f.decode().inventorySha256,before);
 c['meri_intents.preparations'][0].actor_id='foreign';assert.throws(f.decode,/STORE_CORRUPT/);
});

test('closed redacted intent remains inventory while malformed redaction refuses',()=>{
 const f=fixture(),record={operation:{id:'create_word',version:'0.2.0'},argumentsSha256:'d'.repeat(64)};
 const row={tenant_id:binding.tenantId,actor_id:binding.actorId,conversation_id:binding.conversationId,delivery_id:'sdk:'+'d'.repeat(64),record,record_sha256:hash(record),state:'REDACTED',outcome:null,outcome_purged_at:new Date(now),settled_at:new Date(now)};
 f.raw.contentRows['meri_intents.preparations']=[row];assert.equal(f.decode().contentRows.length,1);
 for(const change of [r=>r.outcome={},r=>r.outcome_purged_at=null,r=>r.outcome_purged_at='invalid',r=>r.settled_at=null,r=>{r.record.extra=true;r.record_sha256=hash(r.record);},r=>r.delivery_id='foreign']){
  const raw=structuredClone(f.raw);change(raw.contentRows['meri_intents.preparations'][0]);assert.throws(()=>decodeConversationInventoryRows(raw),/STORE_CORRUPT/);
 }
});

test('local memory candidate is a content-free exact target distinct from external Core memory',()=>{
 const f=fixture(),{candidate,candidateSha256}=buildCandidate({candidateId:id(950),principal:{tenantId:binding.tenantId,actorId:binding.actorId},scope:'client',clientId:id(5),content:'Private local memory',key:null,ttlDays:null,sources:[],origin:{kind:'conversation',conversationId:binding.conversationId,runId:binding.runId,commandId:id(951),commandSha256:'a'.repeat(64)},idempotencyKey:'candidate-fixture',createdAt:now});
 const row={tenant_id:binding.tenantId,proposer_actor_id:binding.actorId,origin_kind:'conversation',origin_conversation_id:binding.conversationId,candidate_id:candidate.candidateId,candidate,candidate_sha256:candidateSha256,candidate_purged_at:null,request_sha256:'b'.repeat(64),scope:candidate.scope,client_id:candidate.clientId,idempotency_key:candidate.idempotencyKey};
 f.raw.memoryCandidates=[row];const decoded=f.decode(),inventory=enumerateReferences(decoded);
 assert.deepEqual(inventory.rowTargets.filter(t=>t.className==='meriMemoryCandidates'),[{className:'meriMemoryCandidates',key:candidate.candidateId}]);
 assert.equal(JSON.stringify(decoded).includes('Private local memory'),false);assert.equal(inventory.rows.some(r=>r.className==='memoryProposals'),false);
 for(const change of [r=>r.proposer_actor_id='foreign',r=>r.origin_conversation_id=id(952),r=>r.candidate_sha256='f'.repeat(64),r=>{r.candidate.origin.runId=id(953);r.candidate_sha256=hash(r.candidate);}]){
  const raw=structuredClone(f.raw);change(raw.memoryCandidates[0]);assert.throws(()=>decodeConversationInventoryRows(raw),/STORE_CORRUPT/);
 }
});

test('actual snapshot owner exhausts all fixed table scans in its one accounted read-only transaction',async()=>{
 const f=fixture({empty:true}),calls=[],releases=[];
 const pool={async connect(){return {async query(sql,args){calls.push({sql,args});
  if(sql.startsWith('SELECT * FROM meri_conversations.conversations'))return {rows:[f.raw.conversation]};
  if(sql.startsWith('SELECT')||sql.startsWith('BEGIN')||sql.startsWith('SET')||sql==='COMMIT')return {rows:[]};throw Error('unexpected SQL');},release(error){releases.push(error);}};}};
 const result=await createConversationRetentionInventory({pool}).inventoryForConversation({tenantId:binding.tenantId,conversationId:binding.conversationId,ownerActorId:binding.actorId});
 assert.deepEqual(result,f.decode());assert.equal(calls[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(calls.at(-1).sql,'COMMIT');
 for(const t of conversationContentTables){const found=calls.filter(c=>c.sql.includes(`FROM ${t.name} r `));assert.ok(found.length>0,t.name);assert.deepEqual(found[0].args.slice(0,2),[binding.tenantId,binding.conversationId]);}
 assert.deepEqual(releases,[undefined]);
});

test('actual zero-run snapshot and retention transition share one connection without nested acquisition',async()=>{
 const f=fixture({empty:true}),calls=[];let connects=0,released;
 const pool={async connect(){assert.equal(++connects,1,'no second pool lease while transition owns the only connection');return {
  async query(sql,args){calls.push({sql,args});
   if(sql.startsWith('SELECT * FROM meri_conversations.conversations'))return {rows:[f.raw.conversation]};
   if(sql.startsWith('SELECT pg_advisory_unlock'))return {rows:[{unlocked:true}]};
   return {rows:[]};},release(error){released=error;}};}};
 const journal=createPostgresRetentionJournal({pool}),owner=createConversationRetentionInventory({pool,withSnapshot:journal.withSnapshot});
 const subject=`${binding.tenantId}:conversation:${binding.conversationId}`;
 await journal.withTransition(subject,async()=>{
  const decoded=await owner.inventoryForConversation({tenantId:binding.tenantId,conversationId:binding.conversationId,ownerActorId:binding.actorId});
  assert.deepEqual(decoded,f.decode());assert.equal(enumerateReferences(decoded).rowTargets.length,1);
 });
 assert.equal(connects,1);assert.equal(released,undefined);
 for(const t of conversationContentTables)assert.ok(calls.some(c=>c.sql.includes(`FROM ${t.name} r `)),t.name);
});
test('a missing content table or denied SELECT fails the whole snapshot; no empty-table fallback',async()=>{
 const f=fixture({empty:true}),seen=[];let released;
 const pool={async connect(){return {async query(sql){seen.push(sql);if(sql.includes('FROM meri_intents.preparations'))throw Object.assign(Error('permission denied'),{code:'42501'});return {rows:sql.startsWith('SELECT * FROM meri_conversations.conversations')?[f.raw.conversation]:[]};},release(error){released=error;}};}};
 await assert.rejects(createConversationRetentionInventory({pool}).inventoryForConversation({tenantId:binding.tenantId,conversationId:binding.conversationId,ownerActorId:binding.actorId}),/permission denied/);
 assert.equal(seen.at(-1),'ROLLBACK');assert.equal(seen.includes('COMMIT'),false);assert.equal(released,undefined);
});
test('canonical enumeration refuses content target tampering and duplicate supplemental rows',()=>{
 const f=fixture();sdk(f);const d=f.decode();
 for(const change of [r=>r.contentRows[0].rowSha256='f'.repeat(64),r=>r.contentRows[0].table='public.unrelated',r=>r.contentRows.push(r.contentRows[0])]){const wrong=structuredClone(d);change(wrong);assert.throws(()=>enumerateReferences(wrong));}
 assert.throws(()=>enumerateReferences({...d,sdkSessionEntries:[{entryId:id(22),runId:binding.runId,sessionId:id(800),subpath:'',sequence:1}]}));
});
