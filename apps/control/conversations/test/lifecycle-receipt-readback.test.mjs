/** MR-06: real journal/service over scripted SQL. No PostgreSQL, Core, provider or physical-stop proof is claimed. The internal
 * reader consumes trusted fresh identity pins; public authentication/currentness/retention release and its contract are a handoff. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {lifecycleFixture,binding,scopes,id} from './lifecycle-fixture.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {hash} from '../boundary.mjs';

const check=()=>{},principal={tenantId:binding.tenantId,actorId:binding.actorId},selectedClientId=id(5),pauseId=id(901),controlId=id(902);
const pins=(control=controlId)=>({principal,binding,scopes,selectedClientId,controlId:control});
const expected=(p)=>({controlId:p.input.controlId,intent:p.input.intent,state:p.state,sourceBinding:p.sourceBinding,targetBinding:p.target?.binding??null,
 checkpointId:p.checkpointId,admissionReceiptId:p.target?.admissionReceiptId??null,retirementReceiptId:p.retirement?.retirementReceiptId??null});
function reader(f){
 const statements=[],pool={async connect(){const c=await f.pool.connect();return {async query(sql,p=[]){statements.push(sql);assert.doesNotMatch(sql,/^(INSERT|UPDATE|DELETE)/u,'receipt reads cannot write');return c.query(sql,p);},release:reason=>c.release(reason)};}};
 // A fresh journal without transition authority proves readback cannot dispatch or borrow execution-currentness authority.
 return {journal:createPostgresConversationStore({pool}).lifecycle,statements};
}
const row=(f,id=controlId)=>f.state.controls.get(`${binding.tenantId}:${id}`);
const put=row=>{row.projection_sha256=hash(row.projection);};
async function resumed(t,mode='resume',{unknown=false}={}){
 const f=await lifecycleFixture();t.after(f.close);await f.running();await f.control({controlId:pauseId,intent:'pause'});await f.claim(pauseId);await f.checkpoint(pauseId);
 const proof=f.proofs.get(id(220)),input={controlId,intent:mode,checkpointId:proof.checkpoint.checkpointId,checkpointSha256:proof.checkpointSha256};
 if(unknown){f.state.startUnknown=true;await assert.rejects(f.control(input),{code:'LIFECYCLE_EFFECT_UNKNOWN'});}
 else assert.equal((await f.control(input)).state,'APPLIED');
 return {...f,input};
}
const durable=f=>structuredClone(Object.fromEntries(Object.entries(f.state).filter(([,value])=>value instanceof Map)));
const counts=f=>({starts:f.state.starts,continued:f.state.continued,signals:f.state.signals,admissions:f.state.admissions,retirements:f.state.retirements,runs:f.state.runs.size,controls:f.state.controls.size});

test('readReceipt returns each durable worker control state with identifiers only and no write',async t=>{
 const f=await lifecycleFixture();t.after(f.close);await f.running();const r=reader(f);
 for(const [n,state] of ['PENDING','DISPATCHING','APPLIED','UNKNOWN'].entries()){
  const key=id(920+n),input={controlId:key,intent:'steer',text:'private steer text'};await f.control(input);
  if(state!=='PENDING'){
   const claimed=await f.claim(key);
   if(state!=='DISPATCHING')await f.service.ackControl({credential:f.credential,binding,input:{controlId:key,commandSha256:claimed.control.commandSha256,outcome:state,...(state==='APPLIED'?{sdkUserMessageId:key}:{})}});
  }
  const before=counts(f),saved=durable(f),receipt=await r.journal.readReceipt(pins(key),check);
  assert.deepEqual(receipt,expected(row(f,key).projection));assert.equal(receipt.state,state);assert.doesNotMatch(JSON.stringify(receipt),/private steer|Hello|sourceRequest|inputSha256|contextSha256/u);
  assert.deepEqual(counts(f),before);assert.deepEqual(durable(f),saved);
 }
});

for(const mode of ['resume','fork'])test(`${mode} receipt survives effect expiry, target cancellation and a new journal without restoring dispatch authority`,async t=>{
 const f=await resumed(t,mode),p=row(f).projection,target=p.target.binding;
 // Stored receipts have elapsed: their original dispatch deadlines are not renewed by reading their durable outcome.
 p.target.expiresAtMs=1;if(p.retirement)p.retirement.expiresAtMs=1;put(row(f));
 await f.store.append(target,{eventId:id(930),createdAt:new Date().toISOString(),type:'run.status',data:{state:'cancelled',reasonCode:'USER_CANCELLED'}},check);
 const before=counts(f),saved=durable(f),r=reader(f),receipt=await r.journal.readReceipt(pins(),check);
 assert.deepEqual(receipt,expected(p));assert.equal(receipt.state,'APPLIED');assert.deepEqual(counts(f),before);assert.deepEqual(durable(f),saved);
 await assert.rejects(f.store.lifecycle.readTransition({sourceBinding:binding,controlId,deadlineMs:Date.now()+1000},check));
 assert.deepEqual(counts(f),before);
});

test('UNKNOWN continuation stays UNKNOWN after a target completes and never replays an effect',async t=>{
 const f=await resumed(t,'resume',{unknown:true}),p=row(f).projection,target=p.target.binding;
 for(const [n,state] of ['starting','running','completed'].entries())await f.store.append(target,{eventId:id(940+n),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},check);
 const before=counts(f),saved=durable(f),r=reader(f),receipt=await r.journal.readReceipt(pins(),check);
 assert.equal(receipt.state,'UNKNOWN');assert.deepEqual(receipt,expected(p));assert.deepEqual(counts(f),before);assert.deepEqual(durable(f),saved);
});

test('readReceipt rejects foreign principal, client, scope, control and full source binding selectors',async t=>{
 const f=await resumed(t),r=reader(f),before=counts(f);
 const wrong=[{principal:{...principal,tenantId:'other-tenant'}},{principal:{...principal,actorId:'other-actor'}},{selectedClientId:id(999)},{scopes:[{...scopes[0],resourceId:id(999)}]},
  {scopes:[{...scopes[0],policyRevision:'e'.repeat(64)}]},{binding:{...binding,workerId:id(999)}},{binding:row(f).projection.target.binding},{controlId:id(999)}];
 for(const patch of wrong)await assert.rejects(r.journal.readReceipt({...pins(),...patch},check));
 await assert.rejects(r.journal.readReceipt({...pins(),principal:undefined},check));assert.deepEqual(counts(f),before);
});

test('readReceipt refuses recomputed-hash source, target and conversation custody corruption',async t=>{
 for(const kind of ['source-request','source-binding','target-envelope','target-binding','source-conversation','target-conversation','retirement-source','target-range']){
  const f=await resumed(t,'fork'),p=row(f).projection,target=[...f.state.runs.values()].find(r=>r.run_id===p.target.binding.runId),source=[...f.state.runs.values()].find(r=>r.run_id===binding.runId);
  if(kind==='source-request'){source.request.prompt='coherently changed';source.request_sha256=hash(source.request);}
  if(kind==='source-binding'){source.projection.binding.workerId=id(950);put(source);}
  if(kind==='target-envelope'){target.continuation.continuation.contextSha256='e'.repeat(64);target.continuation_sha256=hash(target.continuation);}
  if(kind==='target-binding'){target.projection.binding.workerId=id(951);put(target);}
  if(kind.endsWith('conversation')){const b=kind==='source-conversation'?binding:p.target.binding,c=f.state.conversations.get(`${b.tenantId}:${b.conversationId}`);c.projection.owner.actorId='other-actor';put(c);}
  if(kind==='retirement-source'){p.retirement={binding,retirementReceiptId:id(952),expiresAtMs:1};put(row(f));}
  if(kind==='target-range')target.sequence_base=99;
  const before=counts(f);await assert.rejects(reader(f).journal.readReceipt(pins(),check),kind);assert.deepEqual(counts(f),before);
 }
});

test('readReceipt caller cancellation withholds a receipt before and during discovery',async t=>{
 const f=await resumed(t),r=reader(f),cancelled=Object.assign(Error('cancelled'),{code:'CANCELLED'});
 await assert.rejects(r.journal.readReceipt(pins(),()=>{throw cancelled;}),{code:'CANCELLED'});assert.equal(r.statements.length,0);
 let checks=0;await assert.rejects(r.journal.readReceipt(pins(),()=>{if(++checks===8)throw cancelled;}),{code:'CANCELLED'});
 assert.equal(row(f).projection.state,'APPLIED');
});
