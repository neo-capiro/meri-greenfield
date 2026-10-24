import test from 'node:test';
import assert from 'node:assert/strict';
import {binding,scopes,versions,id} from './store-fixture.mjs';
import {contentRows} from './retention-content-fixture.mjs';
import {hash} from '../boundary.mjs';
import {decodeConversationInventoryRows} from '../retention-inventory-decode.mjs';
import {createConversationRetentionInventory} from '../retention-inventory.mjs';
import {conversationContentTables} from '../retention-content-rows.mjs';
import {enumerateReferences} from '../../retention/inventory.mjs';
import {makePayload} from '../../commands/approval-metadata/binding.mjs';
import {createExecutionBinding,executionIdentity} from '../execution-boundary.mjs';
import {prepare as prepareLookup,event as lookupEvent} from '../../task-lookup/binding.mjs';
import {createPostgresRetentionJournal} from '../../retention/postgres-journal.mjs';
import {buildCandidate} from '../../memory/candidate.mjs';
const prefix='meri_conversations.',now='2026-10-24T00:00:00.000Z';
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
test('SDK exact 22 entries, substream, parent headers and replay batch all have distinct content-free targets',()=>{
 const f=fixture();sdk(f);const decoded=f.decode(),inventory=enumerateReferences(decoded),targets=inventory.rowTargets.filter(r=>r.className==='sdkSession');
 assert.equal(targets.length,26);assert.equal(targets.filter(r=>r.table.endsWith('.sdk_session_entries')).length,22);
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
 for(const t of conversationContentTables){const found=calls.filter(c=>c.sql.startsWith(`SELECT r.* FROM ${t.name} r `));assert.equal(found.length,1,t.name);assert.deepEqual(found[0].args.slice(0,2),[binding.tenantId,binding.conversationId]);}
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
 for(const t of conversationContentTables)assert.equal(calls.filter(c=>c.sql.startsWith(`SELECT r.* FROM ${t.name} r `)).length,1,t.name);
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
