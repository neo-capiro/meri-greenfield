/** SYNTHETIC: the actual `meri_intents` server → actual control intent mount → actual task.create proposal owners and
 * prepare-only metadata path (fixture.mjs). Real SDK → control → backend qualification is UNRUN. */
import test from 'node:test';import assert from 'node:assert/strict';
import {CommandError} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {intentFixture,mountIntents,SESSION,NOW} from './fixture.mjs';
import {mount} from '../../../../control/intents/test/fixture.mjs';
import {createResearchActionPreparers} from '../../../../control/intents/research-action-preparer.mjs';
import {id} from '../../../../control/conversations/test/store-fixture.mjs';
import {intentDeliveryId,MAX_INTENT_CALLS} from '../server.mjs';
import {bindScheduleTask} from '../schema.mjs';
import {intentFault} from '../../../../control/intents/faults.mjs';
import {DEFERRED_ORIGINALS} from '../../reads/availability.mjs';
import {UNAVAILABLE_INTENT_PORT} from '../../capabilities/mounts.mjs';
import {INTENT_AVAILABILITY_WORKER_MS} from '../../../../../packages/runtime/runner-load-budget.mjs';
const CREATE={operation:'create_task',arguments:{title:'Task'}};
const text=r=>r.content[0].text;
const failed=(r,code)=>{assert.equal(r.isError,true);assert.equal(r.content.length,1);assert.match(text(r),new RegExp(`^${code}: (whether )?mcp__meri_intents__propose_task `,'u'));};
const withPort=(f,change)=>({readAvailability:async v=>change(await f.port.readAvailability(v)),prepare:v=>f.port.prepare(v)});

test('lists only owner-backed intents, never read-only, with descriptor-derived prepare-only descriptions',async()=>{
 const f=intentFixture(),m=await mountIntents(f);
 try{const {tools}=await m.client.listTools();
  assert.deepEqual(tools.map(t=>t.name),['propose_task']);assert.deepEqual([...m.runtime.sdkOptions.allowedTools],['mcp__meri_intents__propose_task']);
  const [t]=tools;assert.equal(t.annotations.readOnlyHint,false);assert.equal(t.annotations.destructiveHint,false);
  assert.ok(t.description.startsWith('Prepare a request for the user\'s approval. This never applies a change'));assert.deepEqual(t.inputSchema.properties.operation.enum,['create_task']);
  // The advertised arguments are the canonical request the owner validates, not an untyped object.
  assert.deepEqual(Object.keys(t.inputSchema.properties.arguments.properties),['title','clientId','dueDate']);
  assert.equal((await m.runtime.sdkOptions.canUseTool('mcp__meri_intents__propose_memory',{},{})).behavior,'deny');assert.equal((await m.runtime.sdkOptions.canUseTool('mcp__meri_intents__propose_task',{},{})).behavior,'allow');
 }finally{await m.close();}
});

test('conversation → proposal only; the existing approval control is required before any effect',async()=>{
 const f=intentFixture(),m=await mountIntents(f);
 try{const r=await m.call('propose_task',CREATE,{toolUseId:'toolu_prepare'});assert.equal(r.isError,undefined);
  const prepared=JSON.parse(text(r));assert.equal(prepared.status,'approval_required');assert.match(r.content[1].text,/^PREPARED PROPOSAL: nothing has been changed\./u);
  assert.equal(f.sql.rows.size,1);
  const [receipt]=m.runtime.receipts();assert.equal(receipt.outcome,'prepared');assert.equal(receipt.reference,prepared.proposal.proposalId);assert.equal(receipt.deliveryId,intentDeliveryId(f.binding,SESSION,'toolu_prepare'));
 }finally{await m.close();}
});

test('replay: a tool use replayed by a later attempt or resumed session gets the same proposal, never a second one',async()=>{
 const f=intentFixture(),first=await mountIntents(f),again=await mountIntents(f),third=await mountIntents(f);
 try{const a=await first.call('propose_task',CREATE,{toolUseId:'toolu_same'});
  assert.match((await first.call('propose_task',CREATE,{toolUseId:'toolu_same'})).denied,/correlation unavailable/u,'one tool use is admitted once per run');
  const b=await again.call('propose_task',CREATE,{toolUseId:'toolu_same'});assert.equal(text(b),text(a));assert.equal(f.metadataCalls.prepare,1);
  const changed=await third.call('propose_task',{operation:'create_task',arguments:{title:'Other'}},{toolUseId:'toolu_same'});failed(changed,'CONFLICT');assert.equal(f.metadataCalls.prepare,1);
  const later={...f.binding,runId:'00000000-0000-4000-8000-000000000072',attemptId:'00000000-0000-4000-8000-000000000073',writerFence:2};
  assert.equal(intentDeliveryId(later,SESSION,'toolu_same'),intentDeliveryId(f.binding,SESSION,'toolu_same'),'run and attempt do not change the delivery');
  for(const other of [{...f.binding,tenantId:'other'},{...f.binding,actorId:'other'},{...f.binding,conversationId:'00000000-0000-4000-8000-000000000099'}])assert.notEqual(intentDeliveryId(other,SESSION,'toolu_same'),intentDeliveryId(f.binding,SESSION,'toolu_same'));
  assert.notEqual(intentDeliveryId(f.binding,'72000000-0000-4000-8000-000000000091','toolu_same'),intentDeliveryId(f.binding,SESSION,'toolu_same'),'a fork (new session) is a new request');
 }finally{await first.close();await again.close();await third.close();}
});

test('UNKNOWN after a lost acknowledgement is shown as UNKNOWN, recorded, and answered UNKNOWN on replay with no new preparation',async()=>{
 const f=intentFixture(),m=await mountIntents(f),again=await mountIntents(f);
 try{f.hooks.prepare=async(v,owner)=>{await owner.prepare(v);throw Object.assign(new CommandError('APPROVAL_METADATA_UNKNOWN'),{outcome:'UNKNOWN'});};
  const r=await m.call('propose_task',CREATE,{toolUseId:'toolu_lost'});failed(r,'UNKNOWN');assert.match(text(r),/Do not repeat this request/u);
  assert.deepEqual(m.runtime.receipts().map(x=>x.outcome),['unknown']);
  f.hooks.prepare=undefined;failed(await again.call('propose_task',CREATE,{toolUseId:'toolu_lost'}),'UNKNOWN');assert.equal(f.metadataCalls.prepare,1);
 }finally{await m.close();await again.close();}
});

test('a timeout after the port call started is UNKNOWN, not "nothing prepared"',async()=>{
 const f=intentFixture();let release;const gate=new Promise(r=>release=r);
 const slow={readAvailability:v=>f.port.readAvailability(v),prepare:async v=>{await gate;return f.port.prepare(v);}};
 const m=await mountIntents(f,{port:slow,timeoutMs:1000});
 try{const pending=m.call('propose_task',CREATE);setTimeout(()=>{f.f.state.now+=2000;},20);
  const r=await pending;failed(r,'UNKNOWN');release();
 }finally{release();await m.close();}
});

test('a Research Portfolio request never needs the conversation id: the run binds it, and a refused request is journaled, never an INTERNAL_ERROR without a row',async()=>{
 // The 2 Nov new-conversation runs: the model guessed `conversationId` for manage_research_portfolio; the worker's own
 // management-read check threw on the mismatch before any port call, answered INTERNAL_ERROR ("isn't connecting") and left
 // no journal row, so the conversation showed no card at all.
 const f=intentFixture(),selectedClientId=f.scopes[0].kind==='client'?f.scopes[0].resourceId:null,sent=[];
 const client={async prepare({operation,request,operationKey}){sent.push({operation,request,operationKey});return {proposalId:id(10),request,preview:{label:'Create a Research Portfolio'},createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+60000).toISOString()};},async readManagement(){throw Error('unexpected read');}};
 const preparers=[f.preparer(),...createResearchActionPreparers({binding:f.binding,scopes:f.scopes,selectedClientId,client,now:f.now,deadlineMs:NOW+60000,policyRevision:f.scopes[0].policyRevision,currentRights:async()=>({scopes:f.scopes,expiresAtMs:NOW+60000})})];
 const journal=mount({binding:f.binding,preparers,now:f.now}),m=await mountIntents(f,{port:journal.mount});
 try{
  const create={action:'portfolio_create',parameters:{name:'FY2027 DoD Appropriations tracking'},confirmed:true};
  // Omitted: bound. Wrong: replaced. The owner receives this run's conversation both times and prepares once per delivery.
  const omitted=await m.call('propose_research_portfolio_management',{operation:'manage_research_portfolio',arguments:create},{toolUseId:'toolu_rp_omitted'});
  assert.equal(omitted.isError,undefined,text(omitted));assert.equal(JSON.parse(text(omitted)).proposal.request.conversationId,f.binding.conversationId);
  const wrong=await m.call('propose_research_portfolio_management',{operation:'manage_research_portfolio',arguments:{...create,conversationId:'22222222-2222-4222-8222-222222222222'}},{toolUseId:'toolu_rp_wrong'});
  assert.equal(wrong.isError,undefined,text(wrong));assert.equal(JSON.parse(text(wrong)).proposal.request.conversationId,f.binding.conversationId);
  assert.deepEqual(sent.map(s=>s.request.conversationId),[f.binding.conversationId,f.binding.conversationId]);
  // A request the advertised schema accepts but the canonical validator refuses (a model-supplied derived key) is still sent to
  // the port: the mount journals the refusal with its reason, the model reads INVALID_ARGUMENTS, and the conversation gets a card.
  const refused=await m.call('propose_research_portfolio_management',{operation:'manage_research_portfolio',arguments:{...create,parameters:{name:'x',idempotencyKey:'meri-rp-'+'0'.repeat(64)}}},{toolUseId:'toolu_rp_refused'});
  assert.equal(refused.isError,true);assert.equal(text(refused),'INVALID_ARGUMENTS: mcp__meri_intents__propose_research_portfolio_management refused these arguments (not a canonical request for this conversation: derived keys (the idempotency and operation keys) and identity fields are never supplied); correct the named fields and supply literal arguments matching its input schema. Nothing has been changed.');
  const rows=[...journal.store.rows.values()].map(r=>[r.state,r.outcome?.code??null]);
  assert.deepEqual(rows,[['PREPARED',null],['PREPARED',null],['FAILED','INVALID_ARGUMENTS']]);
  assert.equal(sent.length,2,'the refused request never reached Core');
  assert.deepEqual(m.runtime.receipts().map(r=>r.outcome),['prepared','prepared']);
 }finally{await m.close();}
});

test('a REFUSED answer tells the model who refused and with what; without a detail the plain closed text stands',async()=>{
 const f=intentFixture();let detail='the proposal request was answered before any proposal was created (HTTP 404)';
 const port={readAvailability:v=>f.port.readAvailability(v),prepare:async()=>{throw Object.assign(Error('REFUSED'),{code:'REFUSED',layer:'control',...(detail===undefined?{}:{detail})});}};
 const m=await mountIntents(f,{port});
 try{
  const r=await m.call('propose_task',CREATE,{toolUseId:'toolu_refused'});failed(r,'REFUSED');
  assert.equal(text(r),'REFUSED: mcp__meri_intents__propose_task was refused by its owner (the proposal request was answered before any proposal was created (HTTP 404)). Nothing has been changed.');
  detail=undefined;const plain=await m.call('propose_task',CREATE,{toolUseId:'toolu_refused_plain'});failed(plain,'REFUSED');
  assert.equal(text(plain),'REFUSED: mcp__meri_intents__propose_task was refused by its owner (arguments, permissions or current state). Nothing has been changed.');
  assert.deepEqual(m.runtime.receipts(),[]);
 }finally{await m.close();}
});

test('an INVALID_ARGUMENTS refusal shows the port\'s field-path detail so the model can correct the call; anything else is dropped',async()=>{
 const f=intentFixture();let detail="data must have required property 'title'";
 const port={readAvailability:v=>f.port.readAvailability(v),prepare:async()=>{throw Object.assign(Error('INVALID_ARGUMENTS'),{code:'INVALID_ARGUMENTS',layer:'control',...(detail===undefined?{}:{detail})});}};
 const m=await mountIntents(f,{port});
 try{
  const r=await m.call('propose_task',CREATE,{toolUseId:'toolu_detail'});failed(r,'INVALID_ARGUMENTS');
  assert.equal(text(r),"INVALID_ARGUMENTS: mcp__meri_intents__propose_task refused these arguments (data must have required property 'title'); correct the named fields and supply literal arguments matching its input schema. Nothing has been changed.");
  let n=0;
  for(const odd of [undefined,'','x\n',' y'.repeat(201),7,{path:'/title'}]){
   detail=odd;const o=await m.call('propose_task',CREATE,{toolUseId:'toolu_odd'+n++});failed(o,'INVALID_ARGUMENTS');
   assert.equal(text(o),'INVALID_ARGUMENTS: mcp__meri_intents__propose_task refused these arguments; correct the named fields and supply literal arguments matching its input schema. Nothing has been changed.',JSON.stringify(odd));
  }
  assert.deepEqual(m.runtime.receipts(),[]);
 }finally{await m.close();}
});

test('cross-tenant: a foreign availability snapshot mounts nothing; a foreign-tenant/actor/conversation or applied result is withheld',async()=>{
 const f=intentFixture();
 assert.equal(await mountIntents(f,{port:withPort(f,s=>({...s,binding:{...s.binding,tenantId:'other'}}))}),null);
 for(const [label,change] of [['foreign tenant',r=>{r.proposal.command.binding.tenantId='other';r.proposal.command.scopes=r.proposal.command.scopes.map(x=>({...x,tenantId:'other'}));r.proposal.requiredApprover.tenantId='other';r.proposal.commandSha256=canonicalSha256(r.proposal.command);return r;}],['foreign actor',r=>{r.proposal.command.binding.actorId='someone-else';r.proposal.commandSha256=canonicalSha256(r.proposal.command);return r;}],['foreign conversation',r=>{r.proposal.command.binding.conversationId='00000000-0000-4000-8000-000000000099';r.proposal.commandSha256=canonicalSha256(r.proposal.command);return r;}],['applied effect',r=>({status:'observed',outcome:{}})],['executed status',r=>({...r,status:'acknowledged'})]]){
  const g=intentFixture(),m=await mountIntents(g,{port:{readAvailability:v=>g.port.readAvailability(v),prepare:async v=>change(structuredClone(await g.port.prepare(v)))}});
  try{failed(await m.call('propose_task',CREATE),'INVALID_RESULT');assert.deepEqual(m.runtime.receipts(),[],label);}finally{await m.close();}
 }
});

test('operations without an owner, deferred names and reads are never registered, whatever the port offers',async()=>{
 const f=intentFixture(),extra=['list_scheduled_tasks',...DEFERRED_ORIGINALS.slice(0,2)].map(id=>({id,version:'0.2.0'}));
 const m=await mountIntents(f,{port:withPort(f,s=>({...s,operations:[...s.operations,...extra]}))});
 try{assert.deepEqual((await m.client.listTools()).tools.map(t=>t.name),['propose_task']);assert.deepEqual(m.runtime.available.map(o=>o.id),['create_task']);}finally{await m.close();}
 assert.equal(await mountIntents(f,{port:withPort(f,s=>({...s,operations:extra.slice(0,7)}))}),null,'nothing owner-backed: no server');
});

test('policy off or an unreadable port mounts nothing; mid-run withdrawal makes a listed intent UNAVAILABLE before any owner call',async()=>{
 const f=intentFixture();let reads=0;
 assert.equal(await mountIntents(f,{policy:{},port:{readAvailability:v=>{reads++;return f.port.readAvailability(v);},prepare:v=>f.port.prepare(v)}}),null);assert.equal(reads,0);
 assert.equal(await mountIntents(f,{port:{readAvailability:async()=>{throw Error('down');},prepare:v=>f.port.prepare(v)}}),null);
 let offered=true;const m=await mountIntents(f,{port:withPort(f,s=>offered?s:{...s,operations:[]})});
 try{offered=false;failed(await m.call('propose_task',CREATE),'UNAVAILABLE');assert.equal(f.metadataCalls.prepare,0);}finally{await m.close();}
});

test('a profile mount whose offer fails reports the closed failure once and tells the model the write path could not be checked, not disabled',async()=>{
 const f=intentFixture(),reported=[],diagnostic=failure=>reported.push(failure);
 const down={readAvailability:async()=>{throw Object.assign(Error('DEADLINE'),{code:'DEADLINE',layer:'control'});},prepare:v=>f.port.prepare(v)};
 const m=await mountIntents(f,{mount:'profile',port:down,diagnostic});
 try{assert.deepEqual(reported,[{code:'DEADLINE',layer:'control',elapsedMs:0}]);assert.deepEqual(m.runtime.available,[]);
  const instructions=m.client.getInstructions();assert.match(instructions,/could not be checked right now/u);assert.match(instructions,/not a disabled capability; ask the user to try again/u);assert.doesNotMatch(instructions,/No write request can be prepared|write path|\btool\b/u);
  const r=await m.call('propose_task',CREATE);failed(r,'UNAVAILABLE');assert.match(text(r),/^UNAVAILABLE: mcp__meri_intents__propose_task could not check whether this request can be prepared right now: .*not a disabled capability; ask the user to try again in a new message\. Nothing has been changed\.$/u);
  assert.doesNotMatch(text(r),/write path|\btool\b/u);assert.equal(f.metadataCalls.prepare,0);assert.deepEqual(m.runtime.receipts(),[]);
 }finally{await m.close();}
 // A decided refusal (a port the run never had, revoked access) is reported too but keeps the honest "not available" answer.
 for(const [port,failure] of [[UNAVAILABLE_INTENT_PORT,{code:'INTENT_PORT_UNAVAILABLE',layer:'worker',elapsedMs:0}],[{readAvailability:async()=>{throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED',layer:'control'});},prepare:v=>f.port.prepare(v)},{code:'ACCESS_DENIED',layer:'control',elapsedMs:0}]]){
  const decided=await mountIntents(f,{mount:'profile',port,diagnostic});
  try{assert.deepEqual(reported.at(-1),failure);assert.match(decided.client.getInstructions(),/No write request can be prepared in this conversation right now/u);
   assert.match(text(await decided.call('propose_task',CREATE)),/^UNAVAILABLE: mcp__meri_intents__propose_task is not available in this conversation\./u);
  }finally{await decided.close();}
 }
 // A port offering nothing is an honest empty offer, not a failure.
 const empty=await mountIntents(f,{mount:'profile',port:withPort(f,s=>({...s,operations:[]})),diagnostic:()=>assert.fail('an empty offer is not a failure')});
 try{assert.match(empty.client.getInstructions(),/No write request can be prepared in this conversation right now/u);
  assert.match(text(await empty.call('propose_task',CREATE)),/^UNAVAILABLE: mcp__meri_intents__propose_task is not available in this conversation\./u);
 }finally{await empty.close();}
 assert.equal(await mountIntents(f,{port:down,diagnostic:()=>assert.fail('an available mount reports nothing; it mounts no server')}),null);
});

test('a mid-run offer loss is reported; a transient one answers "could not check" for that call, a decided one "not available"',async()=>{
 const f=intentFixture(),reported=[];let failWith=null;
 const port={readAvailability:async v=>{if(failWith)throw Object.assign(Error(failWith.code),failWith);return f.port.readAvailability(v);},prepare:v=>f.port.prepare(v)};
 const m=await mountIntents(f,{mount:'profile',port,diagnostic:failure=>reported.push(failure)});
 try{assert.deepEqual(m.runtime.available.map(o=>o.id),['create_task']);assert.deepEqual(reported,[]);
  failWith={code:'DEADLINE',layer:'control'};const lost=await m.call('propose_task',CREATE);failed(lost,'UNAVAILABLE');assert.match(text(lost),/could not check whether this request can be prepared right now/u);
  failWith={code:'ACCESS_DENIED',layer:'control'};const revoked=await m.call('propose_task',CREATE);failed(revoked,'UNAVAILABLE');assert.match(text(revoked),/^UNAVAILABLE: mcp__meri_intents__propose_task is not available in this conversation\./u);
  failWith=null;assert.equal((await m.call('propose_task',CREATE)).isError,undefined,'the offer was never widened or narrowed, only unanswered');
  assert.deepEqual(reported,[{code:'DEADLINE',layer:'control',elapsedMs:0},{code:'ACCESS_DENIED',layer:'control',elapsedMs:0}]);assert.equal(f.metadataCalls.prepare,1);
 }finally{await m.close();}
});

test('an offer that takes 4 s is admitted within the shared worker bound; past it the worker is the layer that answered',async()=>{
 const f=intentFixture(),advance=ms=>({readAvailability:async v=>{f.f.state.now+=ms;return f.port.readAvailability(v);},prepare:v=>f.port.prepare(v)});
 const m=await mountIntents(f,{port:advance(4000)});
 try{assert.deepEqual(m.runtime.available.map(o=>o.id),['create_task']);}finally{await m.close();}
 const reported=[],late=await mountIntents(f,{mount:'profile',port:advance(INTENT_AVAILABILITY_WORKER_MS+1),diagnostic:failure=>reported.push(failure)});
 try{assert.deepEqual(reported,[{code:'DEADLINE',layer:'worker',elapsedMs:INTENT_AVAILABILITY_WORKER_MS+1}]);assert.deepEqual(late.runtime.available,[]);}finally{await late.close();}
});

test('per-run write-request limit, operation/tool mismatch and token tampering are refused before the port',async()=>{
 const f=intentFixture(),m=await mountIntents(f);
 try{for(let i=0;i<MAX_INTENT_CALLS;i++)assert.equal((await m.call('propose_task',{operation:'create_task',arguments:{title:'Task'}})).isError,undefined);
  assert.match((await m.call('propose_task',CREATE)).denied,/^RESOURCE_LIMIT/u);assert.equal(f.metadataCalls.prepare,MAX_INTENT_CALLS);
 }finally{await m.close();}
 const g=intentFixture(),n=await mountIntents(g);
 try{assert.ok((await n.call('propose_task',{operation:'update_task',arguments:{title:'Task'}})).denied);
  failed(await n.client.callTool({name:'propose_task',arguments:{operation:'create_task',arguments:{title:'Task'},_meriInvocation:'forged'}}),'ACCESS_DENIED');
  const d=await n.hook({hook_event_name:'PreToolUse',session_id:SESSION,tool_name:'mcp__meri_intents__propose_task',tool_use_id:'toolu_swap',tool_input:CREATE},undefined,{signal:new AbortController().signal});
  failed(await n.client.callTool({name:'propose_task',arguments:{...d.hookSpecificOutput.updatedInput,arguments:{title:'Swapped'}}}),'ACCESS_DENIED');
  assert.equal(g.metadataCalls.prepare,0);
 }finally{await n.close();}
});

test('a schedule request needs only cadence, day, time and time zone: the run completes the canonical routine request before the port',async()=>{
 // 2 Nov: schedule_task advertised an open record; the model assembled three policy shapes and the routine owner refused each
 // ("backend needs a more precisely structured request"). The plain fields are advertised and completed here, and the control
 // mount admits the completed request against the canonical schema before the owner is called.
 const f=intentFixture(),sent=[];
 const preparer={binding:f.binding,owner:'schedule',operation:{id:'schedule_task',version:'0.2.0'},async prepare({arguments:request}){sent.push(request);throw intentFault('REFUSED','none','the routine was not accepted this time','ROUTINES_TEST');}};
 const journal=mount({binding:f.binding,preparers:[f.preparer(),preparer],now:f.now}),m=await mountIntents(f,{port:journal.mount});
 try{
  const {tools}=await m.client.listTools(),tool=tools.find(t=>t.name==='propose_schedule');
  assert.deepEqual(Object.keys(tool.inputSchema.properties.arguments.properties),['taskInstruction','cadence','day','time','timezone']);
  assert.match(tool.description,/cadence \("daily", "weekdays", "weekly" or "monthly"\)/u);assert.match(tool.description,/the trusted run completes these into canonical input schema/u);
  const args={taskInstruction:'Summarize new committee activity for the selected client.',cadence:'weekly',day:'monday',time:'09:00',timezone:'America/New_York'};
  const answer=await m.call('propose_schedule',{operation:'schedule_task',arguments:args},{toolUseId:'toolu_sched_ok'});
  assert.equal(answer.isError,true);assert.match(text(answer),/^REFUSED: /u);assert.match(text(answer),/the routine was not accepted this time/u);
  assert.deepEqual(sent,[bindScheduleTask(args)],'the owner receives the completed canonical request, admitted by the mount');
  assert.equal(sent[0].destinationReference,'meri-inbox');assert.deepEqual(sent[0].policy.spec.calendars[0].dayOfWeek,[{start:'MONDAY',end:'MONDAY',step:1}]);
  assert.deepEqual([...journal.store.rows.values()].map(r=>[r.state,r.outcome?.code]),[['FAILED','REFUSED']]);
  // A guessed policy shape is refused by the advertised fields before any correlation or port call; an incomplete cadence
  // is refused here with the field named. Neither reaches the owner or the journal.
  const guessed=await m.call('propose_schedule',{operation:'schedule_task',arguments:{taskInstruction:'x',policy:{spec:{calendars:[]}}}},{toolUseId:'toolu_sched_guess'});
  assert.match(text(guessed),/Invalid arguments for tool propose_schedule/u);assert.match(text(guessed),/"cadence"/u);
  const {day:_omitted,...noDayArgs}=args;
  const noDay=await m.call('propose_schedule',{operation:'schedule_task',arguments:noDayArgs},{toolUseId:'toolu_sched_noday'});
  assert.equal(noDay.isError,true);assert.match(text(noDay),/^INVALID_ARGUMENTS: mcp__meri_intents__propose_schedule refused these arguments \(day: a weekly routine names its weekday\)/u);
  assert.equal(sent.length,1);assert.equal(journal.store.rows.size,1);
 }finally{await m.close();}
});
