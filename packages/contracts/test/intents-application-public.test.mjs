/** Actual intent mount, approval owner and product HTTP application (the compositions of apps/control/intents/test/approval.test.mjs) over a SYNTHETIC
 * decision owner, command journal and fixtures. Real handler output is fed to the public receiver; hostile mutations of it are refused.
 * No PostgreSQL, Core, runtime mount, migration or deployment evidence. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {receiveIntentsRequest as request,receiveIntentsResponse as receive,IntentsResponseError,intentsMetadata,intentsPaths} from '../dist/intents-application.mjs';
import {createIntentApprovalOwner} from '../../../apps/control/intents/approval.mjs';
import {createIntentApplication,INTENT_PATHS} from '../../../apps/control/intents/http.mjs';
import {createNativeIntentApprovals,createCommandJournalOutcomes} from '../../../apps/control/intents/native-approvals.mjs';
import {ProductError} from '../../../apps/control/product-access/errors.mjs';
import {CommandError} from '../commands-0.2/execution-boundary.mjs';
import {commandComposition,mount,delivery,id,NOW,canonicalSha256} from '../../../apps/control/intents/test/fixture.mjs';
import {fileURLToPath} from 'node:url';
import * as protocol from '../../../apps/control/intents/application-protocol.mjs';
const CREATE={id:'create_task',version:'0.2.0'};
/** Synthetic Core decision owner: one immutable decision per proposal; repeats answer the stored decision. */
function syntheticCore(clock){
 const decisions=new Map(),state={records:0,reads:0,revoked:false,loseRecordAck:false,down:false};
 async function call(operation,input){
  if(state.down)throw Error('synthetic Core unavailable');
  if(operation==='approval/record'){state.records++;const p=input.proposal;
   if(!decisions.has(p.proposalId))decisions.set(p.proposalId,{proposalId:p.proposalId,commandSha256:p.commandSha256,decision:input.decision,decidedAt:new Date(clock()).toISOString(),
    expiresAt:new Date(Math.min(Date.parse(p.expiresAt),NOW+40000)).toISOString(),approver:input.approver,policyRevision:'p1'});
   const receipt={decision:decisions.get(p.proposalId),checkedAtMs:clock(),revoked:false};
   if(state.loseRecordAck){state.loseRecordAck=false;throw Error('synthetic lost record ACK');}return structuredClone(receipt);}
  if(operation==='approval/decision'){state.reads++;return structuredClone({decision:decisions.get(input.proposalId)??null,checkedAtMs:clock(),revoked:state.revoked});}
  throw Error('unexpected operation');
 }
 return {decisions,state,call};
}
function setup({enabled=true,optionsFor}={}){
 let c;const clock=()=>c.f.state.now,core=syntheticCore(clock),native=createNativeIntentApprovals({call:core.call,now:clock,maxFactBytes:65536});
 c=commandComposition({approverActorId:'actor',approvalStore:{getCurrent:v=>native.getCurrent(v)}});
 const {store,mount:m}=mount({binding:c.binding,preparers:[c.preparer()],now:clock});
 const owner=createIntentApprovalOwner({journal:store.port,decisions:native,commandOptionsFor:optionsFor?async()=>optionsFor(c):async()=>c.commandOptions,
  issueExecution:async({proposal})=>({execution:{...c.f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey},credential:'synthetic',checkedAtMs:clock(),expiresAtMs:NOW+30000}),
  outcomes:createCommandJournalOutcomes({journal:c.f.journal,contextFor:()=>c.f.context}),now:clock,limits:{maxRequestMs:5000},enabled});
 const principal={tenantId:c.binding.tenantId,actorId:c.binding.actorId,role:'member',permissions:[],clientIds:[],membershipRevision:'m1'};
 const gate={async admit({credential}){if(credential!=='token')throw new ProductError('ACCESS_DENIED');return {principal,expiresAtMs:NOW+60000};},async recheck({principal}){return principal;}};
 const app=createIntentApplication({owner,gate,now:clock,limits:{maxRequestMs:5000,maxRequestBytes:4096,maxResponseBytes:262144}});
 const conversationId=c.binding.conversationId,proposalById=new Map(),prepare=async(n=1)=>{const out=await m.prepare({operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(n)});proposalById.set(out.proposal.proposalId,out.proposal);return out;};
 const decideBody=(proposal,n=1,decision='approved')=>({conversationId,deliveryId:delivery(n),proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision});
 /** One real HTTP exchange, returned both raw and as admitted by the public receiver (or the refusal it raised). */
 async function exchange(route,body,{token='token',headers,proposal}={}){
  const response=await app.handle(new Request('http://127.0.0.1'+INTENT_PATHS[route],{method:'POST',headers:{'content-type':'application/json',...(token===null?{}:{authorization:'Bearer '+token}),...headers},body:JSON.stringify(body)}));
  const text=await response.text(),status=response.status;const retained=proposal??proposalById.get(body.proposalId)??[...proposalById.values()][0];return {status,text,json:JSON.parse(text),admitted:await receive(route,status,text,route==='decide'?{request:body,proposal:retained}:{request:body})};
 }
 const listBody=(extra={})=>({conversationId,...extra});
 return {c,core,store,owner,principal,app,prepare,decideBody,exchange,listBody,conversationId};
}
const refused=(code)=>e=>e instanceof IntentsResponseError&&e.code===code;
const clone=value=>structuredClone(value);

test('actual list and decide answers are admitted: awaiting, approve, executed, completed history, identical repeat',async()=>{
 const s=setup(),{proposal}=await s.prepare();
 const before=await s.exchange('list',s.listBody());assert.equal(before.status,200);assert.equal(before.admitted.intents[0].phase,'awaiting_approval');assert.equal(before.admitted.intents[0].decision,null);assert.equal(before.admitted.intents[0].execution,null);
 const body=s.decideBody(proposal),done=await s.exchange('decide',body);assert.equal(done.status,200);assert.equal(done.admitted.status,'executed');assert.equal(done.admitted.outcome.receipt.commandSha256,proposal.commandSha256);
 const after=await s.exchange('list',s.listBody());assert.equal(after.admitted.intents[0].phase,'completed');assert.deepEqual(after.admitted.intents[0].execution.outcome,done.admitted.outcome);
 const again=await s.exchange('decide',body);assert.deepEqual(again.admitted.outcome,done.admitted.outcome);assert.equal(s.c.f.state.fetches,1,'identical repeat replays; no second effect');
 assert(Object.isFrozen(done.admitted)&&Object.isFrozen(done.admitted.outcome.receipt)&&Object.isFrozen(after.admitted.intents));
});
test('rejected answer is admitted only for a rejection and history reads rejected',async()=>{
 const s=setup(),{proposal}=await s.prepare(),body=s.decideBody(proposal,1,'rejected'),done=await s.exchange('decide',body);
 assert.equal(done.admitted.status,'rejected');assert.equal(done.admitted.decision.decision,'rejected');assert.equal((await s.exchange('list',s.listBody())).admitted.intents[0].phase,'rejected');
 await assert.rejects(receive('decide',200,done.text,{request:{...body,decision:'approved'},proposal}),refused('INTENTS_CORRELATION'));
});
test('paging cursor, unavailable decision owner and withheld content are admitted; a tampered retained proposal is not',async()=>{
 const s=setup();for(const n of [1,2,3])await s.prepare(n);
 const first=await s.exchange('list',s.listBody({limit:2}));assert.equal(first.admitted.next,delivery(2));
 const second=await s.exchange('list',s.listBody({limit:2,after:first.admitted.next}));assert.equal(second.admitted.next,null);assert.equal(second.admitted.intents.length,1);
 s.core.state.down=true;const down=await s.exchange('list',s.listBody());assert.equal(down.admitted.intents[0].decision,'unavailable');assert.equal(down.admitted.intents[0].phase,'unknown_decision');s.core.state.down=false;
 const row=[...s.store.rows.values()][0],original=clone(row.outcome.result.proposal.command.scopes);
 row.outcome.result.proposal.command.scopes=[{tenantId:'tenant',kind:'client',resourceId:'00000000-0000-4000-8000-000000000901',policyRevision:'p1'}];
 const hidden=await s.exchange('list',s.listBody());assert.equal(hidden.admitted.intents[0].withheld,true);assert.equal(Object.hasOwn(hidden.admitted.intents[0],'proposal'),false);
 // A retained row edited after preparation no longer matches its own hash: the receiver refuses what the server (here) would still serve.
 const visibleTo={...s.principal,clientIds:['00000000-0000-4000-8000-000000000901']};
 const tampered=await s.owner.list({principal:visibleTo,request:s.listBody()});
 await assert.rejects(receive('list',200,JSON.stringify(tampered),{request:s.listBody()}),refused('INTENTS_CORRELATION'));
 row.outcome.result.proposal.command.scopes=original;
 assert.deepEqual((await s.owner.list({principal:{...s.principal,actorId:'intruder'},request:s.listBody()})).intents,[]);
});
test('pending, unknown, failed, draft and schedule-proposal items from the actual journal are admitted',async()=>{
 const s=setup();for(const n of [1,2,3,4,5])await s.prepare(n);
 const rows=[...s.store.rows.values()],scope={tenantId:'tenant',kind:'tenant',resourceId:'tenant',policyRevision:'p1'};
 rows[0].state='PENDING';rows[0].outcome=null;rows[1].state='UNKNOWN';rows[1].outcome=null;rows[2].state='FAILED';rows[2].outcome={code:'REFUSED'};
 rows[3].outcome={result:{status:'draft',version:{versionId:id(700),scopes:[scope]}}};
 rows[4].outcome={result:{status:'approval_required',proposal:{proposalId:id(701)}}};
 const listed=(await s.exchange('list',s.listBody())).admitted.intents,by=Object.fromEntries(listed.map(i=>[i.state+(i.kind?':'+i.kind:''),i]));
 assert.deepEqual(Object.keys(by).sort(),['failed','pending','prepared:draft','prepared:schedule_proposal','unknown']);
 assert.equal(by.failed.code,'REFUSED');assert.equal(by['prepared:draft'].versionId,id(700));assert.equal(by['prepared:schedule_proposal'].proposalId,id(701));
 rows[4].outcome={result:{status:'approval_required',proposal:{}}};
 assert.equal((await s.exchange('list',s.listBody())).admitted.intents.find(i=>i.kind==='schedule_proposal').proposalId,null);
});
test('actual error bodies and statuses are admitted: transport, membership, domain and uncertain outcomes',async()=>{
 const s=setup(),{proposal}=await s.prepare(),body=s.decideBody(proposal),code=r=>r.admitted.error.code;
 assert.equal(code(await s.exchange('decide',body,{token:'wrong'})),'ACCESS_DENIED');
 assert.equal(code(await s.exchange('decide',body,{token:null})),'UNAUTHENTICATED');
 assert.equal(code(await s.exchange('decide',{...body,proposalId:id(997)})),'INTENT_MISMATCH');
 assert.equal(code(await s.exchange('decide',{...body,conversationId:id(996)})),'INTENT_NOT_FOUND');
 s.c.f.state.now=NOW+50000;assert.equal(code(await s.exchange('decide',body)),'INTENT_EXPIRED');s.c.f.state.now=NOW;
 const lost=(s.core.state.loseRecordAck=true,await s.exchange('decide',body));assert.equal(lost.status,502);assert.deepEqual(lost.admitted,{error:{code:'APPROVAL_DECISION_UNKNOWN',outcome:'UNKNOWN'}});
 const repeat=await s.exchange('decide',body);assert.equal(repeat.admitted.status,'executed','identical repeat reconciles the uncertain acknowledgement');
 const off=setup({enabled:false});assert.equal((await off.exchange('list',off.listBody())).admitted.error.code,'INTENT_APPROVALS_DISABLED');
 let lose=true;const u=setup({optionsFor:c=>({...c.commandOptions,executor:{async execute(...call){const out=await c.commandOptions.executor.execute(...call);if(lose){lose=false;throw new CommandError('COMMAND_OUTCOME_UNKNOWN');}return out;}}})});
 const {proposal:p2}=await u.prepare(),b2=u.decideBody(p2),unknown=await u.exchange('decide',b2);assert.equal(unknown.status,502);assert.deepEqual(unknown.admitted,{error:{code:'COMMAND_OUTCOME_UNKNOWN',outcome:'UNKNOWN'}});
 assert.equal((await u.exchange('decide',b2)).admitted.status,'executed');
});

const executedFixture=async()=>{const s=setup(),prepared=await s.prepare(),body=s.decideBody(prepared.proposal),done=await s.exchange('decide',body),list=await s.exchange('list',s.listBody());return {s,proposal:list.json.intents[0].proposal,body,done:done.json,list:list.json,listBody:s.listBody()};};
const rehash=item=>{item.proposal.commandSha256=canonicalSha256(item.proposal.command);};
const listMutations={
 'extra property':v=>{v.authorized=true;},'item extra property':v=>{v.intents[0].approved=true;},'foreign conversation':v=>{v.conversationId=id(995);},
 'duplicate delivery':v=>{v.intents.push(clone(v.intents[0]));},'cursor without a full page':v=>{v.next=v.intents[0].deliveryId;},
 'hash does not describe command':v=>{v.intents[0].proposal.command.arguments.title='Other';},'proposal hash replaced':v=>{v.intents[0].proposal.commandSha256='b'.repeat(64);},
 'command in another conversation':v=>{v.intents[0].proposal.command.binding.conversationId=id(994);rehash(v.intents[0]);},
 'scope in another tenant':v=>{v.intents[0].proposal.command.scopes[0].tenantId='other';rehash(v.intents[0]);},
 'approver in another tenant':v=>{v.intents[0].proposal.requiredApprover.tenantId='other';},'lifetime not positive':v=>{v.intents[0].proposal.expiresAt=v.intents[0].proposal.createdAt;},
 'decision for another proposal':v=>{v.intents[0].decision={proposalId:id(993),commandSha256:v.intents[0].proposal.commandSha256,decision:'approved',decidedAt:'2026-10-13T07:00:00.000Z',expiresAt:'2026-10-13T07:01:00.000Z',approver:{tenantId:'tenant',actorId:'actor'},policyRevision:'p1'};v.intents[0].phase='approved';},
 'awaiting phase on a completed intent':v=>{v.intents[0].phase='awaiting_approval';},'completed phase without execution':v=>{v.intents[0].execution=null;v.intents[0].decision=null;v.intents[0].phase='completed';},
 'receipt for another command':v=>{v.intents[0].execution.outcome.receipt.commandId=id(992);},'receipt for another hash':v=>{v.intents[0].execution.outcome.receipt.commandSha256='c'.repeat(64);},
 'unknown phase':v=>{v.intents[0].phase='approved_by_model';},'unknown state':v=>{v.intents[0].state='running';},'non-canonical createdAt':v=>{v.intents[0].createdAt='2026-10-13T07:00:00Z';},
 'withheld with content':v=>{v.intents[0].withheld=true;},
};
for(const [name,mutate] of Object.entries(listMutations))test('list response refuses '+name,async()=>{
 const f=await executedFixture(),value=clone(f.list);mutate(value);
 await assert.rejects(receive('list',200,JSON.stringify(value),{request:f.listBody}),e=>e instanceof IntentsResponseError&&['INTENTS_SHAPE','INTENTS_CORRELATION'].includes(e.code));
});
test('list response refuses more items than the requested limit',async()=>{
 const f=await executedFixture();await assert.rejects(receive('list',200,JSON.stringify({...f.list,intents:[f.list.intents[0],{...clone(f.list.intents[0]),deliveryId:delivery(9)}]}),{request:{...f.listBody,limit:1}}),refused('INTENTS_CORRELATION'));
});
const decideMutations={
 'extra property':v=>{v.approved=true;},'another delivery':v=>{v.deliveryId=delivery(9);},'another proposal':v=>{v.proposalId=id(991);},
 'decision for another hash':v=>{v.decision.commandSha256='d'.repeat(64);},'decision for another proposal':v=>{v.decision.proposalId=id(990);},'rejection decision for an approval':v=>{v.decision.decision='rejected';},
 'rejected status for an approval':v=>{v.status='rejected';delete v.outcome;},'receipt for another hash':v=>{v.outcome.receipt.commandSha256='e'.repeat(64);},
 'executed without an outcome':v=>{delete v.outcome;},'indeterminate with an outcome':v=>{v.status='indeterminate';},
};
for(const [name,mutate] of Object.entries(decideMutations))test('decide response refuses '+name,async()=>{
 const f=await executedFixture(),value=clone(f.done);mutate(value);
 await assert.rejects(receive('decide',200,JSON.stringify(value),{request:f.body,proposal:f.proposal}),e=>e instanceof IntentsResponseError&&['INTENTS_SHAPE','INTENTS_CORRELATION'].includes(e.code));
});
test('an indeterminate acknowledgement is admitted without an outcome, never as execution',async()=>{
 const f=await executedFixture(),value={status:'indeterminate',deliveryId:f.done.deliveryId,proposalId:f.done.proposalId,decision:f.done.decision};
 const out=await receive('decide',200,JSON.stringify(value),{request:f.body,proposal:f.proposal});assert.equal(out.status,'indeterminate');assert.equal(Object.hasOwn(out,'outcome'),false);
});

test('error statuses form one closed table: exact status, optional field except on 502, closed outcomes',async()=>{
 const f=await executedFixture(),expect={request:f.body,proposal:f.proposal};
 for(const [code,status] of Object.entries(intentsMetadata.errorStatuses)){
  assert.deepEqual(await receive('decide',status,JSON.stringify({error:{code}}),expect),{error:{code}});
  await assert.rejects(receive('decide',status===500?501:status+1,JSON.stringify({error:{code}}),expect),refused('INTENTS_STATUS'));
  if(status===502)await assert.rejects(receive('decide',status,JSON.stringify({error:{code,field:'decision'}}),expect),refused('INTENTS_STATUS'));
  else assert.equal((await receive('decide',status,JSON.stringify({error:{code,field:'decision'}}),expect)).error.field,'decision');
  for(const outcome of intentsMetadata.errorOutcomes)assert.equal((await receive('decide',status,JSON.stringify({error:{code,outcome}}),expect)).error.outcome,outcome);
 }
 for(const bad of [{error:{code:'NOT_A_CODE'}},{error:{code:'INTENT_EXPIRED',outcome:'DONE'}},{error:{code:'INTENT_EXPIRED',field:'1bad'}},{error:{code:'INTENT_EXPIRED',detail:'x'}},{error:{}},{}])
  await assert.rejects(receive('decide',409,JSON.stringify(bad),expect),e=>e instanceof IntentsResponseError&&['INTENTS_SHAPE','INTENTS_STATUS'].includes(e.code));
 await assert.rejects(receive('decide',200,JSON.stringify({error:{code:'INTENT_EXPIRED'}}),expect),refused('INTENTS_SHAPE'));
 await assert.rejects(receive('decide','409',JSON.stringify({error:{code:'INTENT_EXPIRED'}}),expect),refused('INTENTS_STATUS'));
});
test('the captured request is mandatory, closed and accessor-free',async()=>{
 const f=await executedFixture(),text=JSON.stringify(f.done);
 for(const bad of [undefined,null,{},{request:f.body},{proposal:f.proposal},{request:f.body,proposal:f.proposal,extra:1},{request:f.body,proposal:{...f.proposal,extra:1}},{request:f.body,extra:1},{request:{...f.body,decision:'maybe'}},{request:{...f.body,tenantId:'other'}},[],'x'])
  await assert.rejects(receive('decide',200,text,bad),e=>e instanceof IntentsResponseError&&['INTENTS_EXPECTATION','INTENTS_SHAPE'].includes(e.code));
 let reads=0;await assert.rejects(receive('decide',200,text,{get request(){reads++;return f.body;}}),refused('INTENTS_EXPECTATION'));assert.equal(reads,0);
 await assert.rejects(receive('decide',200,text,{request:Object.create({decision:'approved'})}),refused('INTENTS_EXPECTATION'));
 await assert.rejects(receive('list',200,JSON.stringify(f.list),{request:f.body}),refused('INTENTS_SHAPE'),'a decide request is not a list request');
 await assert.rejects(receive('approve',200,text,{request:f.body}),refused('INTENTS_ROUTE'));await assert.rejects(receive(undefined,200,text,{request:f.body}),refused('INTENTS_ROUTE'));
});
test('requests are closed objects with literal ids; identity never travels in the body',async()=>{
 const f=await executedFixture(),json=JSON.stringify;
 assert.deepEqual(await request('list',json({conversationId:f.s.conversationId})),{conversationId:f.s.conversationId});
 assert.deepEqual(await request('list',json({conversationId:f.s.conversationId,after:null,limit:50})),{conversationId:f.s.conversationId,after:null,limit:50});
 assert.deepEqual(await request('decide',json(f.body)),f.body);
 for(const bad of [{...f.body,tenantId:'t'},{...f.body,actorId:'a'},{...f.body,decision:'approve'},{...f.body,deliveryId:'sdk:short'},{...f.body,proposalId:'A0000000-0000-4000-8000-000000000001'},{...f.body,commandSha256:'A'.repeat(64)},{conversationId:f.s.conversationId},{...f.body,extra:1}])
  await assert.rejects(request('decide',json(bad)),refused('INTENTS_SHAPE'));
 for(const bad of [{},{conversationId:'x'},{conversationId:f.s.conversationId,limit:0},{conversationId:f.s.conversationId,limit:51},{conversationId:f.s.conversationId,limit:1.5},{conversationId:f.s.conversationId,after:'x'},{conversationId:f.s.conversationId,tenantId:'t'}])
  await assert.rejects(request('list',json(bad)),refused('INTENTS_SHAPE'));
 for(const bad of [undefined,null,'{',json(null),'[]','{"__proto__":{}}','\ud800'])await assert.rejects(request('list',bad),e=>e instanceof IntentsResponseError&&['INTENTS_JSON','INTENTS_SHAPE'].includes(e.code));
 await assert.rejects(request('list',' '.repeat(intentsMetadata.limits.requestBytes+1)),refused('INTENTS_LIMIT'));
 await assert.rejects(request('approve',json(f.body)),refused('INTENTS_ROUTE'));
});

/** Review corrections (dot, PR191): decide answers bind to the request conversation and retained proposal; receipts and task results follow the canonical
 * executor outcome check; timestamps follow the producers' accepted spellings; the generated bundle does not depend on the checkout layout. */
const outcomeMutations={
 'receipt conversation':o=>{o.receipt.binding.conversationId=id(993);},'receipt tenant':o=>{o.receipt.binding.tenantId='other';},'receipt actor':o=>{o.receipt.binding.actorId='other';},
 'receipt run':o=>{o.receipt.binding.runId=id(992);},'receipt idempotency key':o=>{o.receipt.idempotencyKey='other-key';},'receipt scopes':o=>{o.receipt.scopes[0].policyRevision='other';},
 'receipt command id':o=>{o.receipt.commandId=id(991);},'receipt command hash':o=>{o.receipt.commandSha256='c'.repeat(64);},
 'failed receipt':o=>{o.receipt.outcome='failed';},'indeterminate receipt':o=>{o.receipt.outcome='indeterminate';},'source transaction':o=>{o.receipt.sourceTransactionId='tx-1';},
 'receipt completedAt spelling':o=>{o.receipt.completedAt=o.receipt.completedAt.replace(/\.\d{3}Z$/u,'Z');},
 'result title':o=>{o.result.title='Other title';},'result client':o=>{o.result.clientId=id(990);},'result due date':o=>{o.result.dueDate='2026-10-14T00:00:00.000Z';},
};
const bounded=e=>e instanceof IntentsResponseError&&['INTENTS_SHAPE','INTENTS_CORRELATION'].includes(e.code);
for(const [name,mutate] of Object.entries(outcomeMutations)){
 test('executed decide answer refuses '+name,async()=>{const f=await executedFixture(),value=clone(f.done);mutate(value.outcome);await assert.rejects(receive('decide',200,JSON.stringify(value),{request:f.body,proposal:f.proposal}),bounded);});
 test('completed history refuses '+name,async()=>{const f=await executedFixture(),value=clone(f.list);mutate(value.intents[0].execution.outcome);await assert.rejects(receive('list',200,JSON.stringify(value),{request:f.listBody}),bounded);});
}
test('attempt, worker and fence may differ from the original binding; the stable binding may not',async()=>{
 const f=await executedFixture(),value=clone(f.done),binding=value.outcome.receipt.binding;binding.attemptId=id(989);binding.workerId=id(988);binding.writerFence=7;
 assert.equal((await receive('decide',200,JSON.stringify(value),{request:f.body,proposal:f.proposal})).status,'executed');
 const history=clone(f.list),b=history.intents[0].execution.outcome.receipt.binding;b.attemptId=id(989);b.workerId=id(988);b.writerFence=7;
 assert.equal((await receive('list',200,JSON.stringify(history),{request:f.listBody})).intents[0].phase,'completed');
});
test('decide answers are bound to the request conversation and the retained proposal',async()=>{
 const f=await executedFixture(),text=JSON.stringify(f.done),ok={request:f.body,proposal:f.proposal};
 assert.equal((await receive('decide',200,text,ok)).status,'executed');
 // Only the captured request's conversation changes: the reply is not for that request.
 await assert.rejects(receive('decide',200,text,{request:{...f.body,conversationId:id(995)},proposal:f.proposal}),refused('INTENTS_CORRELATION'));
 // A retained proposal for another proposal or hash cannot stand in for the request's.
 const other=clone(f.proposal);other.proposalId=id(984);await assert.rejects(receive('decide',200,text,{request:f.body,proposal:other}),refused('INTENTS_CORRELATION'));
 const hashed=clone(f.proposal);hashed.commandSha256='d'.repeat(64);await assert.rejects(receive('decide',200,text,{request:f.body,proposal:hashed}),refused('INTENTS_CORRELATION'));
 // The retained proposal must itself be coherent.
 const foreign=clone(f.proposal);foreign.command.binding.conversationId=id(983);foreign.commandSha256=canonicalSha256(foreign.command);
 await assert.rejects(receive('decide',200,text,{request:{...f.body,commandSha256:foreign.commandSha256},proposal:foreign}),refused('INTENTS_CORRELATION'));
});
test('rejected and indeterminate replies are bound by the retained proposal: approver, time and approvable action',async()=>{
 const s=setup(),prepared=await s.prepare(),proposal=prepared.proposal,body=s.decideBody(proposal,1,'rejected'),done=await s.exchange('decide',body),ok={request:body,proposal};
 assert.equal((await receive('decide',200,done.text,ok)).status,'rejected');
 const another=clone(done.json);another.decision.approver={tenantId:'tenant',actorId:'someone-else'};await assert.rejects(receive('decide',200,JSON.stringify(another),ok),refused('INTENTS_CORRELATION'));
 const early=clone(done.json);early.decision.decidedAt='2000-01-01T00:00:00Z';await assert.rejects(receive('decide',200,JSON.stringify(early),ok),refused('INTENTS_CORRELATION'));
 const approve={...body,decision:'approved'},reply={status:'indeterminate',deliveryId:done.json.deliveryId,proposalId:done.json.proposalId,decision:{...done.json.decision,decision:'approved'}};
 assert.equal((await receive('decide',200,JSON.stringify(reply),{request:approve,proposal})).status,'indeterminate');
 const wrong=clone(reply);wrong.decision.approver={tenantId:'tenant',actorId:'someone-else'};await assert.rejects(receive('decide',200,JSON.stringify(wrong),{request:approve,proposal}),refused('INTENTS_CORRELATION'));
 // The handler never records a decision for an action it cannot approve, so no 200 may describe one.
 const held=clone(proposal);held.command.action='memory.propose';held.commandSha256=canonicalSha256(held.command);
 await assert.rejects(receive('decide',200,done.text,{request:{...body,commandSha256:held.commandSha256},proposal:held}),refused('INTENTS_CORRELATION'));
});
for(const action of ['memory.propose','artifact.file'])test('a task result is never interpreted for a '+action+' proposal',async()=>{
 const f=await executedFixture(),value=clone(f.list),item=value.intents[0];item.proposal.command.action=action;
 const hash=canonicalSha256(item.proposal.command);item.proposal.commandSha256=hash;item.execution.outcome.receipt.commandSha256=hash;
 await assert.rejects(receive('list',200,JSON.stringify(value),{request:f.listBody}),refused('INTENTS_CORRELATION'));
 const retained=clone(f.proposal);retained.command.action=action;retained.commandSha256=hash;const done=clone(f.done);done.outcome.receipt.commandSha256=hash;
 await assert.rejects(receive('decide',200,JSON.stringify(done),{request:{...f.body,commandSha256:hash},proposal:retained}),refused('INTENTS_CORRELATION'));
});
test('a task.create proposal must carry canonical, normalized arguments and no attachments',async()=>{
 const f=await executedFixture();
 for(const mutate of [item=>{item.proposal.command.arguments.title=' padded ';},item=>{item.proposal.command.arguments.extra=true;},item=>{item.proposal.command.attachments=[{objectId:id(982),versionId:'v1',sha256:'a'.repeat(64),bytes:1,scopes:item.proposal.command.scopes}];}]){
  const value=clone(f.list),item=value.intents[0];mutate(item);item.proposal.commandSha256=canonicalSha256(item.proposal.command);item.execution.outcome.receipt.commandSha256=item.proposal.commandSha256;
  await assert.rejects(receive('list',200,JSON.stringify(value),{request:f.listBody}),bounded);
 }
});
test('owner-valid timestamps without milliseconds are admitted; impossible or offset dates are refused',async()=>{
 const f=await executedFixture(),plain=iso=>iso.replace(/\.\d{3}Z$/u,'Z'),later=iso=>plain(new Date(Date.parse(iso)+1500).toISOString());
 const done=clone(f.done);done.decision.decidedAt=later(done.decision.decidedAt);done.decision.expiresAt=later(done.decision.expiresAt);
 assert.equal((await receive('decide',200,JSON.stringify(done),{request:f.body,proposal:f.proposal})).status,'executed');
 const history=clone(f.list),item=history.intents[0];item.proposal.createdAt=plain(item.proposal.createdAt);item.proposal.expiresAt=plain(item.proposal.expiresAt);item.decision.decidedAt=plain(item.decision.decidedAt);item.decision.expiresAt=plain(item.decision.expiresAt);
 assert.equal((await receive('list',200,JSON.stringify(history),{request:f.listBody})).intents[0].phase,'completed');
 for(const bad of ['2026-13-45T07:00:00Z','2026-10-13T25:00:00Z','not-a-date','2026-10-13T07:00:00+00:00','2026-10-13']){
  const value=clone(f.done);value.decision.decidedAt=bad;await assert.rejects(receive('decide',200,JSON.stringify(value),{request:f.body,proposal:f.proposal}),e=>e instanceof IntentsResponseError);
  const proposalBad=clone(f.list);proposalBad.intents[0].proposal.createdAt=bad;await assert.rejects(receive('list',200,JSON.stringify(proposalBad),{request:f.listBody}),e=>e instanceof IntentsResponseError);
 }
});
test('journal createdAt is read exactly: an impossible calendar day cannot roll into the next month',async()=>{
 const f=await executedFixture();
 for(const bad of ['2026-02-30T07:00:00.000Z','2026-02-29T07:00:00.000Z','2026-04-31T07:00:00.000Z','2026-13-01T07:00:00.000Z','2026-10-13T24:00:00.000Z']){
  assert.ok(!Number.isNaN(Date.parse(bad))||bad.startsWith('2026-13')||bad.includes('T24'),'the producer-side parse alone would not catch '+bad);
  const value=clone(f.list);value.intents[0].createdAt=bad;await assert.rejects(receive('list',200,JSON.stringify(value),{request:f.listBody}),e=>e instanceof IntentsResponseError&&['INTENTS_SHAPE','INTENTS_CORRELATION'].includes(e.code),bad);
 }
 const good=clone(f.list);good.intents[0].createdAt='2028-02-29T07:00:00.000Z';assert.equal((await receive('list',200,JSON.stringify(good),{request:f.listBody})).intents.length,1,'a real leap day is admitted');
});
test('generated bundle is independent of the checkout layout',async()=>{
 const source=await readFile(new URL('../dist/intents-application.mjs',import.meta.url),'utf8'),metadata=JSON.parse(await readFile(new URL('../dist/intents-application.metadata.json',import.meta.url),'utf8'));
 // A drive letter is a lone letter before `:\` or `:/` (not the end of a URL scheme such as `http://`).
 const layout=/\.\.\/|(?<![A-Za-z0-9])[A-Za-z]:[\\/](?!\/)|\/(?:home|Users)\/|wt-/u;
 assert(!layout.test(source),'no parent-relative, drive-letter, home or worktree path anywhere in the bundle');
 const labels=[...source.matchAll(/^\/\/ (.+)$/gmu)].map(m=>m[1]).filter(label=>/\.m?js$/u.test(label));
 assert(labels.length>=5&&labels.every(label=>/^(?:node_modules\/|intents-generated:\.\/generated-|(?:intents-application|document-application)\/|artifacts-0\.2\/artifact-formats\.mjs$)/u.test(label)),labels.join(', '));
 assert(metadata.browserInputs.every(entry=>!layout.test(entry)));
});
test('metadata, paths and vocabularies are the handlers\' own, and approval authority is not widened',async()=>{
 assert.deepEqual(intentsPaths,INTENT_PATHS);assert.deepEqual(intentsMetadata.routes,{list:{method:'POST',path:'/api/conversations/intents/list',response:'json'},decide:{method:'POST',path:'/api/conversations/intents/decide',response:'json'}});
 assert.deepEqual(intentsMetadata.errorStatuses,protocol.INTENTS_ERROR_STATUSES);assert.deepEqual(intentsMetadata.approvableActions,protocol.INTENTS_APPROVABLE_ACTIONS);assert.deepEqual(intentsMetadata.approvableActions,['task.create','document.draft']);assert.deepEqual(intentsMetadata.failureCodes,protocol.INTENTS_FAILURE_CODES);
 assert.deepEqual(intentsMetadata.errorOutcomes,['NOT_DISPATCHED','UNKNOWN','RESULT_NOT_RELEASED']);assert.equal(Object.keys(intentsMetadata.routes).length,2,'no approve/execute route exists in this contract');
 assert(Object.isFrozen(intentsMetadata)&&Object.isFrozen(intentsMetadata.errorStatuses));
 const schema=JSON.parse(await readFile(new URL('../dist/intents-application.schema.json',import.meta.url),'utf8')),text=JSON.stringify(schema);
 assert.equal(schema.$id,'urn:meri:intents-application:0.1.0');assert(!/"\$ref":"(?!#)/u.test(text),'every reference is local to the distribution');
 const commandActions=schema.$defs[Object.keys(schema.$defs).find(name=>name.startsWith('Canonical_Command_'))].properties.action.enum;assert.deepEqual(commandActions,['memory.propose','task.create','artifact.file']);
});
/** Real memory.propose and artifact.file proposals from their actual preparers, listed and decided through the actual owner and HTTP application
 * with no decision or outcome owner (as before those Core extensions exist): they are admitted as prepared and answer INTENT_NOT_APPROVABLE. */
test('actual memory.propose and artifact.file proposals are admitted as held: listed, never approvable',async()=>{
 // These two fixtures load the independent budget harness, which needs an explicit source root (an explicit caller setting wins).
 process.env.MERI_REVIEW_SOURCE_ROOT??=fileURLToPath(new URL('../../../',import.meta.url)).replaceAll(String.fromCharCode(92),'/').replace(/\/$/u,'');
 const {memoryComposition}=await import('../../../apps/control/intents/test/memory-fixture.mjs'),{attachmentFilingFixture}=await import('../../../apps/control/intents/test/attachment-filing-execution-fixture.mjs');
 const memory=memoryComposition({scope:'client'}),filing=await attachmentFilingFixture();
 const cases=[['memory.propose',memory.f.binding,memory.f.state,memory.intentStore,async()=>(await memory.prepare()).proposal],['artifact.file',filing.f.binding,filing.f.state,filing.mounted.store,async()=>(await filing.prepare()).proposal]];
 for(const [action,binding,clock,store,prepare] of cases){
  const proposal=await prepare(),owner=createIntentApprovalOwner({journal:store.port,commandOptionsFor:async()=>{throw Error('never called');},now:()=>clock.now,limits:{maxRequestMs:5000},enabled:true});
  const principal={tenantId:binding.tenantId,actorId:binding.actorId,role:'member',permissions:[],clientIds:[id(9)],membershipRevision:'m1'},at='http://127.0.0.1';
  const gate={async admit(){return {principal,expiresAtMs:NOW+60000};},async recheck({principal}){return principal;}};
  const app=createIntentApplication({owner,gate,now:()=>clock.now,limits:{maxRequestMs:5000,maxRequestBytes:4096,maxResponseBytes:262144}});
  const post=async(route,body)=>{const r=await app.handle(new Request(at+INTENT_PATHS[route],{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer t'},body:JSON.stringify(body)}));const text=await r.text();return {status:r.status,admitted:await receive(route,r.status,text,route==='decide'?{request:body,proposal}:{request:body})};};
  const listed=await post('list',{conversationId:binding.conversationId}),item=listed.admitted.intents.find(entry=>entry.proposal?.proposalId===proposal.proposalId);
  assert.equal(item.proposal.command.action,action);assert.equal(item.decision,'unavailable');assert.equal(item.execution,'unavailable');assert.ok(['unknown_decision','expired'].includes(item.phase));
  assert.equal(item.proposal.commandSha256,proposal.commandSha256);
  const refusal=await post('decide',{conversationId:binding.conversationId,deliveryId:item.deliveryId,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved'});
  assert.equal(refusal.status,409);assert.deepEqual(refusal.admitted,{error:{code:'INTENT_NOT_APPROVABLE',outcome:'NOT_DISPATCHED'}});
 }
});
test('distribution is self-contained and its recorded sources bind the handler owners',async()=>{
 const source=await readFile(new URL('../dist/intents-application.mjs',import.meta.url),'utf8'),metadata=JSON.parse(await readFile(new URL('../dist/intents-application.metadata.json',import.meta.url),'utf8'));
 assert.deepEqual(metadata.browserImports,[]);assert(!/(?:^|\n)\s*import\s/u.test(source));assert(!/from ['"](?:node:|ajv|canonicalize)/u.test(source));
 for(const path of ['../../apps/control/intents/application-protocol.mjs','../../apps/control/intents/http.mjs','../../apps/control/intents/approval.mjs','../../apps/control/intents/faults.mjs','../../apps/control/product-access/http.mjs','../../apps/control/product-access/errors.mjs','commands-0.2/task-create.schema.json','meri.schema.json'])assert(metadata.sources.some(entry=>entry.path===path),path);
 assert.deepEqual(metadata.phases,['awaiting_approval','approved','rejected','expired','executing','completed','unknown','unknown_decision']);
});
