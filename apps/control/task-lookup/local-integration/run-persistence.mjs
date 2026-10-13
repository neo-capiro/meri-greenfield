/** Explicit local qualification: actual store/gateway over a caller-admitted real pg pool. */
import assert from 'node:assert/strict';
import {types} from 'node:util';
import {createTaskLookupDelivery,createPostgresTaskLookupStore} from '../index.mjs';
import {options,method,data,code,prepare,canonicalSha256,uuid} from '../binding.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {assertLocalDescriptor,verifyFixture,readCaseRows} from './fixture-checks.mjs';
import {createCommitAckFault} from './commit-ack-fault.mjs';
import {createFreshPoolOwner} from './fresh-pool.mjs';
const failure=c=>Object.assign(new Error(c),{code:c});
const names=Object.freeze(['reconnect','concurrent-claim','lost-claim-ack','lost-dispatch-ack','lost-result-ack','revoked-read']);
const safeCode=e=>['DEADLINE','CANCELLED','ACCESS_DENIED','LOOKUP_REPLAY','LOOKUP_UNAVAILABLE','LOCAL_CASE_FAILED'].includes(code(e))?code(e):'LOCAL_CASE_FAILED';
async function rejected(work,expected){let error;try{await work();}catch(e){error=e;}assert(error,'expected refusal');if(expected)assert.equal(code(error),expected);return error;}
function assertResultRows(rows,c,read){
 const b=prepare(c.lookup.request,c.lookup.context,c.lookup.context.deadlineMs-1);
 assert.equal(rows.lookups.length,1);assert.equal(rows.lookups[0].state,'RESULT');assert.deepEqual(rows.lookups[0].payload,b);
 const stored=rows.lookups[0].record;assert.deepEqual(stored.observation,read.observation);assert.equal(stored.resultSha256,read.resultSha256);
 assert.equal(read.classification,'recommendations');assert.equal(read.acceptedTasks,false);
 assert.equal(read.resultSha256,canonicalSha256(read.observation));assert.deepEqual(stored.events,read.events);
 assert.equal(rows.events.length,2);
 for(const [i,kind]of ['started','terminal'].entries()){
  const row=rows.events[i],event=read.events[i],slot=c.lookup.context.slots[kind];
  assert.equal(row.kind,kind);assert.equal(row.sequence,String(slot.sequence));assert.equal(row.event_id,slot.eventId.toLowerCase());assert.deepEqual(row.event,event);
  assert.deepEqual(event.binding,c.lookup.context.binding);assert.deepEqual(event.scopes,c.lookup.context.scopes);
 }
 assert.equal(read.events[0].type,'tool.started');assert.equal(read.events[1].type,'tool.completed');assert.equal(read.events[1].data.resultReference,c.lookup.context.resultReference);
 assert.equal(rows.invocations.length,1);assert.equal(rows.reservations.length,1);
 const inv=rows.invocations[0],res=rows.reservations[0];
 assert.equal(inv.invocation_id,res.invocation_id);assert.equal(inv.reservation_id,res.reservation_id);assert(inv.completion);
 assert.equal(inv.completion.invocationId,inv.invocation_id);assert.equal(inv.completion.reservationId,inv.reservation_id);
 assert.equal(String(inv.completion.outputBytes),res.output_bytes);
 assert.deepEqual(inv.delivery,JSON.parse(c.lookup.context.deliveryJson));
 assert.deepEqual(inv.facts,{...inv.delivery.context,invocationId:inv.invocation_id});
 assert.equal(inv.raw_request_sha256,canonicalSha256(b.request));assert.deepEqual(inv.operation,b.request.operation);
 assert.deepEqual(inv.completion,{invocationId:inv.invocation_id,reservationId:inv.reservation_id,factsSha256:canonicalSha256(inv.facts),rawRequestSha256:inv.raw_request_sha256,operation:inv.operation,argumentsSha256:b.argumentsSha256,resultSha256:read.resultSha256,outputBytes:Number(res.output_bytes)});
 assert.equal(inv.arguments_sha256,b.argumentsSha256);assert.equal(inv.completion.argumentsSha256,b.argumentsSha256);
 // Both accepted owners hash the complete governed result through canonicalSha256.
 assert.equal(inv.completion.resultSha256,read.resultSha256);
 assert.equal(res.state,'SETTLED');assert.equal(res.hold_micro_usd,String(c.expectedChargeMicroUsd));assert.equal(res.charged_micro_usd,String(c.expectedChargeMicroUsd));
 assert(Number.isSafeInteger(Number(res.output_bytes))&&Number(res.output_bytes)>0);
}
export async function runLocalActionPersistence(configuration){
 const {descriptor,pool,openFreshPool,createCase}=options(configuration,['descriptor','pool','openFreshPool','createCase']);
 const d=assertLocalDescriptor(descriptor);method(pool,'connect');const query=method(pool,'query');
 assert.equal(typeof openFreshPool,'function');assert.equal(typeof createCase,'function');
 const lifetime=createOperationLifetime({deadlineMs:d.deadlineMs,now:Date.now,errorFactory:failure});
 const run=fn=>lifetime.run(fn),receipts=[],ownedRows=[],owned=new Set();let fixture,initialConsumed,lastConsumed,activeCase='fixture',activeStage='fixture-verification',caseDispose;
 const fresh=createFreshPoolOwner({openFreshPool,originalPool:pool,deadlineMs:d.deadlineMs,signal:lifetime.signal});
 const report={schema:'meri.local-action-persistence/1',status:'HOLD',cases:receipts,ownedRows,realEngineExecutionRequired:true,runtimeQualified:false,sourceTransport:'synthetic-in-process',databaseRestartTested:false,cleanup:{borrowedPoolClosed:false,ownedFreshPoolsClosed:0,ownedRowsDeleted:false,syntheticCasesDisposed:0,unsettledOperations:0,physicalStopProven:false}};
 async function newCase(name){
  activeStage='case-seed';const value=await run(()=>createCase({pool,name,deadlineMs:Math.min(d.deadlineMs,Date.now()+45000)}));
  const c=options(value,['gateway','authorize','lookup','readContext','sourceCalls','revokeRead','expectedChargeMicroUsd'],['identity','ownedRows','dispose']);
  if(c.dispose!==undefined){assert.equal(typeof c.dispose,'function');caseDispose=c.dispose;}
  c.lookup=data(c.lookup);c.readContext=data(c.readContext);
  assert.equal(typeof c.authorize,'function');assert.equal(typeof c.sourceCalls,'function');assert.equal(typeof c.revokeRead,'function');
  assert(Number.isSafeInteger(c.expectedChargeMicroUsd)&&c.expectedChargeMicroUsd>0);
  const b=prepare(c.lookup.request,c.lookup.context,Date.now());assert(b.context.deadlineMs<=d.deadlineMs);
  assert.equal(c.sourceCalls(),0);const delivery=JSON.parse(b.context.deliveryJson);
  const ids=[b.context.binding.runId,b.context.lookupId,b.context.resultReference,b.context.slots.started.eventId,b.context.slots.terminal.eventId];
  for(const id of ids){const key=id.toLowerCase();assert(!owned.has(key),'case identity reuse');owned.add(key);}
  const idsRecord=data({name,tenantId:b.context.binding.tenantId,runId:b.context.binding.runId,grantId:delivery.context.grantId,lookupId:b.context.lookupId,resultReference:b.context.resultReference,eventIds:[b.context.slots.started.eventId,b.context.slots.terminal.eventId]});
  if(c.ownedRows!==undefined)assert.deepEqual(data(c.ownedRows),idsRecord);ownedRows.push(idsRecord);
  // Producer only seeds runs/grants and allocation; the delivery has not begun.
  activeStage='empty-case-readback';const before=await readCaseRows(pool,c,run);assert.deepEqual([before.lookups.length,before.events.length,before.invocations.length,before.reservations.length],[0,0,0,0]);return c;
 }
 const control=(c,storePool=pool)=>createTaskLookupDelivery({gateway:c.gateway,store:createPostgresTaskLookupStore({pool:storePool}),authorize:c.authorize});
 const lookup=(api,c)=>run(signal=>api.lookup({...c.lookup,signal}));
 const read=(api,c)=>run(signal=>api.read({resultReference:c.lookup.context.resultReference,context:c.readContext,signal}));
 const consumed=async()=>{
  const r=await run(()=>query('SELECT consumed_micro_usd::text,quarantined FROM meri_qualification.budget WHERE id=1'));
  assert.equal(r.rows.length,1);assert.equal(r.rows[0].quarantined,false);assert.match(r.rows[0].consumed_micro_usd,/^[0-9]+$/);return BigInt(r.rows[0].consumed_micro_usd);
 };
 try{
  fixture=await verifyFixture(pool,d,run);report.fixture=fixture;initialConsumed=lastConsumed=await consumed();
  for(const name of names){
   activeCase=name;const c=await newCase(name),phase=name==='lost-claim-ack'?'claim':name==='lost-dispatch-ack'?'dispatch':name==='lost-result-ack'?'result':null;
   const fault=phase?createCommitAckFault({pool,phase}):null,api=control(c,fault?.pool??pool);let delivered,readback;activeStage='lookup';
   if(name==='concurrent-claim'){
    const results=await run(signal=>Promise.allSettled([api.lookup({...c.lookup,signal}),api.lookup({...c.lookup,signal})]));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
    assert.equal(code(results.find(r=>r.status==='rejected').reason),'LOOKUP_REPLAY');delivered=results.find(r=>r.status==='fulfilled').value;
   }else if(phase){const e=await rejected(()=>lookup(api,c),'LOOKUP_UNAVAILABLE');assert.equal(e.outcome,'UNKNOWN');assert(fault.receipt().fired);assert.equal(fault.receipt().evictions,1);}
   else delivered=await lookup(api,c);
   if(phase==='claim'||phase==='dispatch'){
    assert.equal(c.sourceCalls(),0);activeStage='retained-row-assertions';const rows=await readCaseRows(pool,c,run);
    assert.equal(rows.lookups.length,1);assert.equal(rows.lookups[0].state,phase==='claim'?'CLAIMED':'ERROR');
    assert.deepEqual(rows.lookups[0].payload,prepare(c.lookup.request,c.lookup.context,c.lookup.context.deadlineMs-1));
    assert.equal(rows.invocations.length,0);assert.equal(rows.reservations.length,0);assert.equal(rows.events.length,2);
    assert.equal(rows.events[0].event.type,'tool.started');assert.equal(rows.events[1].event?.type??null,phase==='claim'?null:'run.error');
    await rejected(()=>lookup(control(c),c),'LOOKUP_REPLAY');assert.equal(c.sourceCalls(),0);
   }else{
    assert.equal(c.sourceCalls(),1);
    if(name==='reconnect'){
     // New pool and control/store instances: application reconstruction, not server restart.
     activeStage='fresh-pool-acquire';const freshPool=await run(()=>fresh.acquire());
     activeStage='fresh-pool-verification';await verifyFixture(freshPool,d,run);activeStage='fresh-pool-readback';readback=await read(control(c,freshPool),c);
     activeStage='fresh-pool-cleanup';await fresh.close();assert.equal(fresh.state().freshPoolCleanupUnknown,false);
    }else{activeStage='authorized-readback';readback=await read(control(c),c);}
    if(delivered)assert.deepEqual({...readback,observation:undefined},{...delivered,observation:undefined});
    activeStage='retained-row-assertions';const rows=await readCaseRows(pool,c,run);assertResultRows(rows,c,readback);
    activeStage='historical-accounting-owner';
    const inv=rows.invocations[0],res=rows.reservations[0];
    const accounting=await run(()=>method(c.gateway,'readInvocationOutcome')(JSON.stringify(inv.facts),JSON.stringify({operation:inv.operation,argumentsSha256:inv.arguments_sha256})));
    assert.equal(accounting.state,'SETTLED');assert.equal(accounting.invocationId,inv.invocation_id);assert.equal(accounting.reservationId,inv.reservation_id);
    assert.deepEqual(accounting.operation,inv.operation);assert.equal(accounting.argumentsSha256,inv.arguments_sha256);
    assert.equal(accounting.holdMicrousd,res.hold_micro_usd);assert.equal(accounting.chargedMicrousd,res.charged_micro_usd);assert.equal(accounting.outputBytes,Number(res.output_bytes));
    activeStage='replay-refusal';await rejected(()=>lookup(control(c),c),'LOOKUP_REPLAY');assert.equal(c.sourceCalls(),1);
    if(name==='revoked-read'){activeStage='revoked-read-refusal';await run(()=>c.revokeRead());await rejected(()=>read(control(c),c),'ACCESS_DENIED');assert.equal(c.sourceCalls(),1);}
   }
   activeStage='charge-assertion';const after=await consumed(),charge=(phase==='claim'||phase==='dispatch')?0:c.expectedChargeMicroUsd;
   assert.equal(after-lastConsumed,BigInt(charge));lastConsumed=after;
   if(caseDispose){activeStage='case-dispose';await run(()=>caseDispose());caseDispose=undefined;report.cleanup.syntheticCasesDisposed++;}
   receipts.push(data({name,status:'PASS',sourceCalls:c.sourceCalls(),chargedMicroUsd:charge,resultRetained:!(phase==='claim'||phase==='dispatch'),...(fault?{fault:fault.receipt()}:{} )}));
  }
  report.status='PASS';report.initialConsumedMicroUsd=String(initialConsumed);report.finalConsumedMicroUsd=String(lastConsumed);
 }catch(error){
  report.failure={code:safeCode(error),case:activeCase,stage:activeStage};
  // Only the case owner's closed nonsecret identity receipt is retained on partial setup.
  try{if(!error||types.isProxy(error))throw Error();const row=data(Object.getOwnPropertyDescriptor(error,'ownedRows')?.value);
   const r=options(row,['name','tenantId','runId','grantId','lookupId','resultReference','eventIds']);
   assert.equal(r.name,activeCase);assert.equal(typeof r.tenantId,'string');assert(r.tenantId.length>0&&r.tenantId.length<=128);
   for(const key of ['runId','grantId','lookupId','resultReference'])uuid(r[key]);
   assert.equal(r.eventIds.length,2);r.eventIds.forEach(uuid);
   if(!ownedRows.some(v=>v.lookupId.toLowerCase()===r.lookupId.toLowerCase()))ownedRows.push(row);
  }catch{}
 }
 finally{
  lifetime.close();
  if(caseDispose){const cleanup=createOperationLifetime({deadlineMs:Date.now()+5000,now:Date.now,errorFactory:failure});try{await cleanup.run(()=>caseDispose());report.cleanup.syntheticCasesDisposed++;}catch{report.status='HOLD';report.cleanup.syntheticCaseDisposeUnknown=true;}finally{cleanup.close();}}
  await fresh.close();Object.assign(report.cleanup,fresh.state());
  report.cleanup.unsettledOperations=lifetime.pendingOperations();
  if(report.cleanup.unsettledOperations||report.cleanup.acquisitionPending||report.cleanup.freshPoolCleanupUnknown)report.status='HOLD';
 }
 return data(report);
}

export {assertResultRows as assertLocalResultRows};
