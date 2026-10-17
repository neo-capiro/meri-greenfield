/** SYNTHETIC: proposal → user decision → approved execution → durable result → history, over the real intent mount,
 * command preparer, task.create approval-metadata owner, command tool interface, command executor (approval guard, fresh
 * authority, PostgreSQL command journal over a scripted pool, HTTP source over a fake Fetch) and the real product HTTP owner.
 * The decision owner is a synthetic stand-in for Core's `approval/record` + `approval/decision` behind the real native
 * adapter, and the same adapter feeds the executor's approval guard. Nothing here is PostgreSQL, Core or live evidence. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createIntentApprovalOwner} from '../approval.mjs';
import {createIntentApplication,INTENT_PATHS} from '../http.mjs';
import {createNativeIntentApprovals,createCommandJournalOutcomes} from '../native-approvals.mjs';
import {composeIntentApprovals} from '../compose.mjs';
import {ProductError,productFailure} from '../../product-access/errors.mjs';
import {CommandError} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {commandComposition,mount,delivery,NOW} from './fixture.mjs';
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
function setup({approverActorId='actor',enabled=true,issue,optionsFor}={}){
 let c;const clock=()=>c.f.state.now,core=syntheticCore(clock);
 const native=createNativeIntentApprovals({call:core.call,now:clock,maxFactBytes:65536});
 c=commandComposition({approverActorId,approvalStore:{getCurrent:v=>native.getCurrent(v)}});
 const {store,mount:m}=mount({binding:c.binding,preparers:[c.preparer()],now:clock});
 const issued={calls:0};
 const issueExecution=issue??(async({proposal})=>{issued.calls++;return {execution:{...c.f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey},credential:'synthetic',checkedAtMs:clock(),expiresAtMs:NOW+30000};});
 const owner=createIntentApprovalOwner({journal:store.port,decisions:native,issueExecution,commandOptionsFor:optionsFor?async()=>optionsFor(c):async()=>c.commandOptions,
  outcomes:createCommandJournalOutcomes({journal:c.f.journal,contextFor:()=>c.f.context}),now:clock,limits:{maxRequestMs:5000},enabled});
 const principal={tenantId:c.binding.tenantId,actorId:c.binding.actorId,role:'member',permissions:[],clientIds:[],membershipRevision:'m1'};
 const prepare=(n=1)=>m.prepare({operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(n)});
 const request=(proposal,n=1,decision='approved')=>({conversationId:c.binding.conversationId,deliveryId:delivery(n),proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision});
 const decide=(body,who=principal)=>owner.decide({principal:who,request:body});
 const list=(who=principal,extra={})=>owner.list({principal:who,request:{conversationId:c.binding.conversationId,...extra}});
 return {c,core,native,store,m,owner,principal,issued,prepare,request,decide,list};
}
const code=(c,o='NOT_DISPATCHED')=>e=>{const out=e?.message===c&&(o===undefined||productFailure(e)?.outcome===o);if(!out)console.error('got',e?.message,productFailure(e),e?.stack);return out;};
const effects=s=>({fetches:s.c.f.state.fetches,journal:s.c.f.pg.rows.size});

test('approved end to end: one decision recorded by the owner, one effect under fresh authority, durable result in history, replay adds nothing',async()=>{
 const s=setup(),{proposal}=await s.prepare();
 const before=await s.list();assert.equal(before.intents.length,1);assert.equal(before.intents[0].phase,'awaiting_approval');assert.equal(before.intents[0].decision,null);assert.equal(before.intents[0].execution,null);
 assert.deepEqual(effects(s),{fetches:0,journal:0});
 const out=await s.decide(s.request(proposal));
 assert.equal(out.status,'executed');assert.equal(out.decision.decision,'approved');assert.equal(out.outcome.receipt.outcome,'succeeded');assert.equal(out.outcome.receipt.commandId,proposal.command.commandId);
 assert.deepEqual(effects(s),{fetches:1,journal:1});assert.equal(s.core.state.records,1);
 assert.ok(s.core.state.reads>=6,'the executor re-read the current decision at every phase');
 const after=await s.list();assert.equal(after.intents[0].phase,'completed');assert.deepEqual(after.intents[0].execution.outcome,out.outcome);assert.equal(after.intents[0].decision.decision,'approved');
 const again=await s.decide(s.request(proposal));assert.deepEqual(again.outcome,out.outcome);
 assert.deepEqual(effects(s),{fetches:1,journal:1},'the command journal replays; no second effect');assert.equal(s.core.state.records,2,'the owner answered the repeat from its stored decision');
});

test('rejected: recorded by the owner, nothing executes, history says rejected, a later approve cannot flip it',async()=>{
 const s=setup(),{proposal}=await s.prepare(),out=await s.decide(s.request(proposal,1,'rejected'));
 assert.equal(out.status,'rejected');assert.equal(out.decision.decision,'rejected');assert.equal(s.issued.calls,0);assert.deepEqual(effects(s),{fetches:0,journal:0});
 assert.equal((await s.list()).intents[0].phase,'rejected');
 await assert.rejects(s.decide(s.request(proposal)),code('APPROVAL_DECISION_REFUSED','UNKNOWN'));assert.deepEqual(effects(s),{fetches:0,journal:0});
});

test('no execution without an approved, current authority: no owner, revoked decision, revoked capability, stale fence',async()=>{
 {const s=setup(),{proposal}=await s.prepare();
  const bare=createIntentApprovalOwner({journal:s.store.port,commandOptionsFor:async()=>s.c.commandOptions,now:()=>s.c.f.state.now,limits:{maxRequestMs:5000},enabled:true});
  await assert.rejects(bare.decide({principal:s.principal,request:s.request(proposal)}),code('APPROVAL_OWNER_UNAVAILABLE'));assert.deepEqual(effects(s),{fetches:0,journal:0});}
 {const s=setup(),{proposal}=await s.prepare();s.core.state.revoked=true;
  await assert.rejects(s.decide(s.request(proposal)),code('COMMAND_APPROVAL_REFUSED'));assert.deepEqual(effects(s),{fetches:0,journal:0});}
 {const s=setup(),{proposal}=await s.prepare();s.c.f.state.revoked=true;
  await assert.rejects(s.decide(s.request(proposal)),code('COMMAND_REFUSED'));assert.deepEqual(effects(s),{fetches:0,journal:0});}
 {const s=setup(),{proposal}=await s.prepare();s.c.f.state.fence=2;
  await assert.rejects(s.decide(s.request(proposal)),code('COMMAND_REFUSED'));assert.deepEqual(effects(s),{fetches:0,journal:0},'a stale writer fence is refused');}
 {const s=setup({issue:async()=>{throw Error('broker refused');}}),{proposal}=await s.prepare();
  await assert.rejects(s.decide(s.request(proposal)),code('EXECUTION_AUTHORITY_REFUSED'));assert.deepEqual(effects(s),{fetches:0,journal:0});}
});

test('refusals before any owner call: wrong ids, other actor/tenant/conversation, expired, other approver, disabled, not prepared',async()=>{
 const s=setup(),{proposal}=await s.prepare();
 await assert.rejects(s.decide({...s.request(proposal),proposalId:'00000000-0000-4000-8000-000000000999'}),code('INTENT_MISMATCH'));
 await assert.rejects(s.decide({...s.request(proposal),commandSha256:'f'.repeat(64)}),code('INTENT_MISMATCH'));
 await assert.rejects(s.decide(s.request(proposal),{...s.principal,actorId:'intruder'}),code('INTENT_NOT_FOUND'),'another actor never sees this conversation');
 await assert.rejects(s.decide(s.request(proposal),{...s.principal,tenantId:'other'}),code('INTENT_NOT_FOUND'));
 await assert.rejects(s.decide({...s.request(proposal),conversationId:'00000000-0000-4000-8000-000000000998'}),code('INTENT_NOT_FOUND'));
 await assert.rejects(s.decide({...s.request(proposal),decision:'maybe'}),code('INTENT_REQUEST_INVALID',null));
 await assert.rejects(s.decide({...s.request(proposal),tenantId:'other'}),code('INTENT_REQUEST_INVALID',null),'identity never comes from the body');
 assert.equal(s.core.state.records,0);
 s.c.f.state.now=NOW+50000;await assert.rejects(s.decide(s.request(proposal)),code('INTENT_EXPIRED'));s.c.f.state.now=NOW;
 const reviewer=setup({approverActorId:'reviewer'}),p2=(await reviewer.prepare()).proposal;
 await assert.rejects(reviewer.decide(reviewer.request(p2)),code('APPROVER_REFUSED'));assert.equal(reviewer.core.state.records,0);
 const off=setup({enabled:false});await assert.rejects(off.decide(off.request(proposal)),code('INTENT_APPROVALS_DISABLED'));await assert.rejects(off.list(),code('INTENT_APPROVALS_DISABLED'));
 const u=setup(),{proposal:p3}=await u.prepare();const row=[...u.store.rows.values()][0];row.state='UNKNOWN';row.outcome=null;
 await assert.rejects(u.decide(u.request(p3)),code('INTENT_NOT_PREPARED'));assert.equal(u.core.state.records,0);assert.equal((await u.list()).intents[0].state,'unknown');
 assert.deepEqual(effects(s),{fetches:0,journal:0});
});

test('cross-run execution is refused before the executor: the command journal binds a command to its original run',async()=>{
 let c;const s=setup({issue:async({proposal})=>({execution:{...c.f.execution,executorBinding:{...c.f.execution.executorBinding,runId:'00000000-0000-4000-8000-000000000777'},proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey},credential:'x',checkedAtMs:c.f.state.now,expiresAtMs:NOW+30000})});
 c=s.c;const {proposal}=await s.prepare();
 await assert.rejects(s.decide(s.request(proposal)),code('INTENT_CROSS_RUN'));assert.deepEqual(effects(s),{fetches:0,journal:0});
});

test('lost decision acknowledgement is UNKNOWN; repeating the same request executes exactly once',async()=>{
 const s=setup(),{proposal}=await s.prepare();s.core.state.loseRecordAck=true;
 await assert.rejects(s.decide(s.request(proposal)),code('APPROVAL_DECISION_UNKNOWN','UNKNOWN'));assert.deepEqual(effects(s),{fetches:0,journal:0});
 assert.equal((await s.list()).intents[0].phase,'approved','history reads the recorded decision back from its owner');
 assert.equal((await s.decide(s.request(proposal))).status,'executed');assert.deepEqual(effects(s),{fetches:1,journal:1});
});

test('history: creation order, paging, drafts/unknowns, decision owner down reads as unavailable, withheld content on lost client access',async()=>{
 const s=setup();for(const n of [1,2,3])await s.prepare(n);
 const first=await s.list(s.principal,{limit:2});assert.deepEqual(first.intents.map(i=>i.deliveryId),[delivery(1),delivery(2)]);assert.equal(first.next,delivery(2));
 const second=await s.list(s.principal,{limit:2,after:first.next});assert.deepEqual(second.intents.map(i=>i.deliveryId),[delivery(3)]);assert.equal(second.next,null);
 s.core.state.down=true;const down=await s.list();assert.equal(down.intents[0].decision,'unavailable');assert.equal(down.intents[0].phase,'unknown_decision');s.core.state.down=false;
 const row=[...s.store.rows.values()][0];row.outcome.result.proposal.command.scopes=[{tenantId:'tenant',kind:'client',resourceId:'00000000-0000-4000-8000-000000000901',policyRevision:'p1'}];
 const hidden=await s.list();assert.equal(hidden.intents[0].withheld,true);assert.equal(Object.hasOwn(hidden.intents[0],'proposal'),false);
 const visibleTo={...s.principal,clientIds:['00000000-0000-4000-8000-000000000901']};assert.equal((await s.list(visibleTo)).intents[0].kind,'proposal');
 assert.deepEqual((await s.list({...s.principal,actorId:'intruder'})).intents,[]);
});

test('HTTP: membership-gated routes, content-free errors, UNKNOWN outcome on a lost decision acknowledgement',async()=>{
 const s=setup();const {proposal}=await s.prepare();
 const gate={async admit({credential}){if(credential!=='token')throw new ProductError('ACCESS_DENIED');return {principal:s.principal,expiresAtMs:NOW+60000};},async recheck({principal}){return principal;}};
 const app=createIntentApplication({owner:s.owner,gate,now:()=>s.c.f.state.now,limits:{maxRequestMs:5000,maxRequestBytes:4096,maxResponseBytes:262144}});
 const post=(path,body,token='token')=>app.handle(new Request(`http://127.0.0.1${path}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(body)}));
 const listed=await post(INTENT_PATHS.list,{conversationId:s.c.binding.conversationId});assert.equal(listed.status,200);assert.equal((await listed.json()).intents[0].phase,'awaiting_approval');
 const bad=await post(INTENT_PATHS.decide,{...s.request(proposal),decision:'yes'});assert.equal(bad.status,400);assert.deepEqual(await bad.json(),{error:{code:'INTENT_REQUEST_INVALID',field:'decision'}});
 assert.equal((await post(INTENT_PATHS.decide,s.request(proposal),'wrong')).status,403);
 s.core.state.loseRecordAck=true;const lost=await post(INTENT_PATHS.decide,s.request(proposal));assert.equal(lost.status,502);assert.deepEqual(await lost.json(),{error:{code:'APPROVAL_DECISION_UNKNOWN',outcome:'UNKNOWN'}});
 const ok=await post(INTENT_PATHS.decide,s.request(proposal));assert.equal(ok.status,200);const body=await ok.json();assert.equal(body.status,'executed');assert.equal(s.c.f.state.fetches,1);
 assert.equal(ok.headers.get('cache-control'),'no-store');
});

test('an indeterminate executor outcome is UNKNOWN, never success or refusal; the same request then reads the durable result',async()=>{
 let lose=true;
 const s=setup({optionsFor:c=>({...c.commandOptions,executor:{async execute(...call){const out=await c.commandOptions.executor.execute(...call);if(lose){lose=false;throw new CommandError('COMMAND_OUTCOME_UNKNOWN');}return out;}}})});
 const {proposal}=await s.prepare();
 await assert.rejects(s.decide(s.request(proposal)),code('COMMAND_OUTCOME_UNKNOWN','UNKNOWN'));assert.deepEqual(effects(s),{fetches:1,journal:1});
 assert.equal((await s.list()).intents[0].phase,'completed','history shows the durable result although the reply was lost');
 const again=await s.decide(s.request(proposal));assert.equal(again.status,'executed');assert.deepEqual(effects(s),{fetches:1,journal:1});
});

test('composition is inert and disabled by default; the native adapter refuses foreign or absent decisions',async()=>{
 const calls={connect:0,native:0};const pool={connect:async()=>{calls.connect++;throw Error('no');},query:async()=>{throw Error('no');}};
 const gate={async admit(){return {principal:{tenantId:'tenant',actorId:'actor',role:'member',permissions:[],clientIds:[],membershipRevision:'m1'},expiresAtMs:NOW+60000};},async recheck({principal}){return principal;}};
 const c=commandComposition();
 const composed=composeIntentApprovals({pool,native:{call:async()=>{calls.native++;throw Error('no');}},commandJournal:c.f.journal,contextFor:()=>c.f.context,commandOptionsFor:async()=>c.commandOptions,
  issueExecution:async()=>{throw Error('no');},gate,now:()=>NOW,limits:{maxRequestMs:1000,maxRequestBytes:4096,maxResponseBytes:65536,maxFactBytes:65536}});
 assert.deepEqual(calls,{connect:0,native:0});
 const r=await composed.app.handle(new Request('http://127.0.0.1/api/conversations/intents/list',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer t'},body:JSON.stringify({conversationId:c.binding.conversationId})}));
 assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:{code:'INTENT_APPROVALS_DISABLED',outcome:'NOT_DISPATCHED'}});assert.deepEqual(calls,{connect:0,native:0});
 const core=syntheticCore(()=>NOW),native=createNativeIntentApprovals({call:core.call,now:()=>NOW,maxFactBytes:65536});
 const q={proposalId:'00000000-0000-4000-8000-000000000123',commandSha256:'a'.repeat(64),binding:c.binding};
 assert.equal(await native.readDecision(q),null);await assert.rejects(native.getCurrent(q),e=>e.message==='COMMAND_APPROVAL_REFUSED','no decision is never a current approval');
 core.decisions.set(q.proposalId,{proposalId:q.proposalId,commandSha256:'b'.repeat(64),decision:'approved',decidedAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+1000).toISOString(),approver:{tenantId:'tenant',actorId:'actor'},policyRevision:'p1'});
 await assert.rejects(native.readDecision(q),e=>e.message==='APPROVAL_RECEIPT_REFUSED','a decision for other content is refused');
 const bad=createNativeIntentApprovals({call:async()=>({decision:{decision:'approved'},checkedAtMs:NOW,revoked:false}),now:()=>NOW,maxFactBytes:65536});
 await assert.rejects(bad.record({proposal:{},decision:'approved',approver:{},binding:c.binding}),'a malformed decision receipt is refused');
});
