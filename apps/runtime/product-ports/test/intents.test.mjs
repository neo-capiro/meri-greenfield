/** SYNTHETIC: the intents product-port family over a scripted pg pool (only `meri_intents.preparations` statements), a synthetic
 * Core decision owner behind the real native adapter, a fake membership gate, and a real task.create proposal prepared by the
 * real intent mount. Nothing here is PostgreSQL, Core or live evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createProductPortsFactory} from '../index.mjs';
import {createIntentsFamily,intentsComposition,compileIntentsConfiguration,executionOwnerUnavailable} from '../intents.mjs';
import {captureRuntimePorts,composeRuntimePorts} from '../../product-applications.mjs';
import {productReadiness} from '../../product-readiness.mjs';
import {INTENT_PATHS} from '../../../control/intents/http.mjs';
import {productFailure} from '../../../control/product-access/errors.mjs';
import {commandComposition,mount,delivery,NOW} from '../../../control/intents/test/fixture.mjs';
const CREATE={id:'create_task',version:'0.2.0'};
const configuration=(intents,extra={})=>({version:1,profile:'isolated-preview',sourceEnabled:false,limits:{startupMs:1000,shutdownMs:1000,requestMs:5000,requestBytes:65536},
 native:{origin:'https://native.invalid',capabilityFile:'/run/native',loopback:false,maxResponseBytes:262144},...(intents===undefined?{}:{intents}),...extra});
/** Counts every touch of a borrowed owner without running it. */
function untouchable(name,seen){return new Proxy({},Object.fromEntries(['get','has','ownKeys','getOwnPropertyDescriptor','set','apply'].map(t=>[t,()=>{seen.push(name+'.'+t);throw Error('touched '+name);}])));}
function context({intents,pool,native,gate,now=()=>NOW,extra}={}){
 return Object.freeze({configuration:configuration(intents,extra),pool,client:{},native,now,canonicalProductPorts:captureRuntimePorts(gate?{conversationMembership:gate}:{})});
}
const code=c=>e=>e?.code===c;
function syntheticCore(clock){
 const decisions=new Map(),state={calls:[]};
 async function call(operation,input){
  state.calls.push(operation);
  if(operation==='approval/record'){const p=input.proposal;
   if(!decisions.has(p.proposalId))decisions.set(p.proposalId,{proposalId:p.proposalId,commandSha256:p.commandSha256,decision:input.decision,decidedAt:new Date(clock()).toISOString(),
    expiresAt:new Date(Math.min(Date.parse(p.expiresAt),NOW+40000)).toISOString(),approver:input.approver,policyRevision:'p1'});
   return structuredClone({decision:decisions.get(p.proposalId),checkedAtMs:clock(),revoked:false});}
  if(operation==='approval/decision')return structuredClone({decision:decisions.get(input.proposalId)??null,checkedAtMs:clock(),revoked:false});
  throw Error('unexpected operation');
 }
 return {state,call};
}
/** Scripted pg pool over the memory journal rows: only the intent store's BEGIN/SET/SELECT/COMMIT statements are answered. */
function scriptedIntentPool(store){
 const statements=[];
 const rowOf=([tenantId,actorId,conversationId,deliveryId],row,i)=>({delivery_id:deliveryId,created_at:new Date(NOW+i),record:row.record,record_sha256:hash(row.record),state:row.state,outcome:row.outcome});
 const entries=()=>[...store.rows].map(([k,row])=>[JSON.parse(k),row]);
 return {statements,pool:{async connect(){return {async query(text,values){statements.push(text);
  if(/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL)/u.test(text))return {rows:[]};
  if(!text.includes('FROM meri_intents.preparations'))throw Error('unexpected statement: '+text);
  const mine=entries().map(([k,row],i)=>[k,rowOf(k,row,i)]).filter(([k])=>k[0]===values[0]&&k[1]===values[1]&&k[2]===values[2]);
  if(text.startsWith('SELECT delivery_id,created_at'))return {rows:mine.map(([,r])=>r)};
  return {rows:mine.filter(([k])=>k[3]===values[3]).map(([,r])=>({record:r.record,record_sha256:r.record_sha256,state:r.state,outcome:r.outcome}))};
 },release(){}};}}};
}
test('absent or disabled intents configuration composes no port and never touches the pool or the native client',()=>{
 for(const intents of [undefined,{enabled:false}]){
  const seen=[],calls=[];const native={call:async op=>{calls.push(op);throw Error('no');}};
  const c=context({intents,pool:untouchable('pool',seen),native,gate:{admit(){seen.push('admit');},recheck(){seen.push('recheck');}}});
  const family=createIntentsFamily(c);assert.deepEqual(family.ports,{});assert.equal(family.shared.state,'disabled');
  assert.equal(typeof family.shared.approvalStore.getCurrent,'function');assert.equal(typeof family.shared.readDecision,'function');
  assert.deepEqual(createProductPortsFactory({families:[['intents',createIntentsFamily]]})(c),{});
  assert.deepEqual(seen,[]);assert.deepEqual(calls,[]);
  const ports=composeRuntimePorts(c.canonicalProductPorts,captureRuntimePorts(family.ports));
  assert.equal(productReadiness({ports,sourceEnabled:false}).owners.find(o=>o.name==='intents.application').state,'unavailable');
 }
});
test('the composition is memoized per trusted context: one shared approval store for every family',()=>{
 const native={call:async()=>{throw Error('no');}},c=context({native});
 assert.equal(intentsComposition(c),intentsComposition(c));assert.equal(createIntentsFamily(c).shared.approvalStore,intentsComposition(c).approvalStore);
 assert.notEqual(intentsComposition(context({native})).approvalStore,intentsComposition(c).approvalStore);
});
test('malformed intents configuration and context are refused before any composition',()=>{
 const native={call:async()=>{throw Error('no');}};
 for(const intents of [null,[],'on',{},{enabled:'yes'},{enabled:1},{enabled:true,extra:true},Object.defineProperty({},'enabled',{get:()=>true,enumerable:true})])
  assert.throws(()=>createIntentsFamily(context({intents,native})),code('INTENTS_CONFIGURATION'),JSON.stringify(intents));
 assert.throws(()=>compileIntentsConfiguration(Object.defineProperty({},'intents',{get:()=>({enabled:true}),enumerable:true})),code('INTENTS_CONFIGURATION'));
 assert.throws(()=>createIntentsFamily(context({intents:{enabled:true},native,extra:{limits:{requestMs:0,requestBytes:1}}})),code('INTENTS_CONFIGURATION'));
 assert.throws(()=>createProductPortsFactory({families:[['intents',createIntentsFamily]]})(context({intents:{enabled:'true'},native})),code('INTENTS_CONFIGURATION'));
 assert.throws(()=>createIntentsFamily({configuration:{}}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.throws(()=>createIntentsFamily(new Proxy(context({native}),{})),code('PRODUCT_PORTS_CONFIGURATION'));
});
test('enabled without the canonical membership gate stays unavailable and composes no port',()=>{
 const seen=[],c=context({intents:{enabled:true},pool:untouchable('pool',seen),native:{call:async()=>{seen.push('native');}}});
 const family=createIntentsFamily(c);assert.deepEqual(family.ports,{});assert.equal(family.shared.state,'unavailable');assert.equal(family.shared.reason,'MEMBERSHIP_GATE_UNAVAILABLE');assert.deepEqual(seen,[]);
});
test('enabled: list and decide reach the owners; Core records the decision and execution refuses EXECUTION_OWNER_UNAVAILABLE',async()=>{
 let c;const clock=()=>c.f.state.now,core=syntheticCore(clock);
 c=commandComposition({approverActorId:'actor'});
 const {store,mount:m}=mount({binding:c.binding,preparers:[c.preparer()],now:clock});
 const {proposal}=await m.prepare({operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(1)});
 const principal={tenantId:c.binding.tenantId,actorId:c.binding.actorId,role:'member',permissions:[],clientIds:[],membershipRevision:'m1'};
 const admitted=[];const gate={async admit({credential}){admitted.push(credential);return {principal,expiresAtMs:NOW+60000};},async recheck({principal:p}){return p;}};
 const {pool,statements}=scriptedIntentPool(store);
 const ctx=context({intents:{enabled:true},pool,native:{call:core.call},gate,now:clock});
 const ports=createProductPortsFactory({families:[['intents',createIntentsFamily]]})(ctx);
 assert.deepEqual(Object.keys(ports),['intentApplication']);assert.deepEqual(statements,[]);assert.deepEqual(core.state.calls,[]);assert.equal(intentsComposition(ctx).state,'composed');
 const joined=composeRuntimePorts(ctx.canonicalProductPorts,captureRuntimePorts(ports));
 assert.equal(productReadiness({ports:joined,sourceEnabled:false}).owners.find(o=>o.name==='intents.application').state,'composed');
 const post=(path,body)=>joined.intentApplication.handle(new Request('http://127.0.0.1'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer token'},body:JSON.stringify(body)}));
 const listed=await post(INTENT_PATHS.list,{conversationId:c.binding.conversationId});assert.equal(listed.status,200);
 const before=(await listed.json()).intents;assert.equal(before.length,1);assert.equal(before[0].phase,'awaiting_approval');assert.equal(before[0].execution,'unavailable');
 assert.ok(statements.some(s=>s.startsWith('SELECT delivery_id,created_at')),'list read the intent journal');assert.deepEqual(core.state.calls,['approval/decision']);
 const decided=await post(INTENT_PATHS.decide,{conversationId:c.binding.conversationId,deliveryId:delivery(1),proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved'});
 assert.equal(decided.status,503);assert.deepEqual(await decided.json(),{error:{code:'EXECUTION_OWNER_UNAVAILABLE',outcome:'NOT_DISPATCHED'}});
 assert.equal(core.state.calls.filter(op=>op==='approval/record').length,1,'Core recorded the decision');assert.equal(c.f.state.fetches,0,'nothing executed');
 const after=(await (await post(INTENT_PATHS.list,{conversationId:c.binding.conversationId})).json()).intents;assert.equal(after[0].phase,'approved');assert.equal(after[0].decision.decision,'approved');
 assert.ok(statements.every(s=>!s.includes('meri_commands.')),'the command journal is never read without the execution owner');
 assert.deepEqual(admitted,['token','token','token']);
 // The shared approval store reads the SAME Core decision the route recorded (the executor's approval guard input).
 const current=JSON.parse(await intentsComposition(ctx).approvalStore.getCurrent({proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,binding:proposal.command.binding}));
 assert.equal(current.decision.decision,'approved');assert.equal((await intentsComposition(ctx).readDecision({proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,binding:proposal.command.binding})).decision,'approved');
});
test('execution owner refusal is typed and content-free',async()=>{
 const e=executionOwnerUnavailable();assert.equal(e.code,'EXECUTION_OWNER_UNAVAILABLE');assert.deepEqual(productFailure(e),{code:'EXECUTION_OWNER_UNAVAILABLE',outcome:'NOT_DISPATCHED',field:null});
});
