import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnTelemetry} from '../../runtime/telemetry/turn-context.mjs';
import {createProductOwnerServiceGate} from './owner-channel.mjs';
import {createOwnerDiagnostics} from './owner-diagnostics.mjs';
import {observeOwnerChannel,runOwnerHttpRequest,finishOwnerChannel} from './owner-request-telemetry.mjs';

const binding={runId:'11111111-1111-4111-8111-111111111111',attemptId:'22222222-2222-4222-8222-222222222222'};
const id=n=>String(n).repeat(32);
function fixture(write){const lines=[];return {lines,telemetry:createTurnTelemetry({service:'owner',environment:'Production',write:write??(line=>lines.push(JSON.parse(line))),now:()=>1000})};}
const sum=record=>Object.values(record).reduce((total,row)=>total+Object.values(row).reduce((a,b)=>a+b,0),0);

test('owner service gate emits its poison transition once, independent of refusal rate limiting',()=>{
 const {lines,telemetry}=fixture(),legacy=[];
 const diagnostics=createOwnerDiagnostics({burst:20,windowMs:60000,write:line=>legacy.push(line),burst:1,telemetry});
 diagnostics.refused('placement','facts',Error('private error'));diagnostics.refused('placement','facts',Error('private error'));
 const gate=createProductOwnerServiceGate({telemetry});const done=gate.begin();gate.poison();gate.poison();done();
 assert.equal(gate.available,false);assert.equal(gate.pending,0);
 const health=lines.filter(line=>line.event==='meri.health');assert.equal(health.length,1);
 assert.equal(health[0].component,'service-gate');assert.equal(health[0].transition,'poisoned');
 assert.equal(health[0]._aws.CloudWatchMetrics[0].Namespace,'Meri/Production');
 assert.deepEqual(legacy,['PRODUCT_OWNER_REFUSED owner=placement step=facts code=REFUSED\n','PRODUCT_OWNER_DIAGNOSTICS_SUPPRESSED\n']);
});

test('owner health telemetry failure leaves poison and legacy diagnostic behavior intact',()=>{
 const {telemetry}=fixture(()=>{throw Error('closed writer');});
 const gate=createProductOwnerServiceGate({telemetry});assert.doesNotThrow(()=>gate.poison());assert.equal(gate.available,false);
 const legacy=[],diagnostics=createOwnerDiagnostics({burst:20,windowMs:60000,write:line=>legacy.push(line),telemetry});
 assert.doesNotThrow(()=>diagnostics.health('facts','quarantined','PRODUCT_OWNER_FACTS_UNAVAILABLE'));
 diagnostics.refused('placement','facts',Error('sensitive'));assert.equal(legacy.length,1);
});

test('owner settlement drains pending run reads once and keeps concurrent model counters separate',async()=>{
 const {lines,telemetry}=fixture();
 telemetry.within(binding,()=>telemetry.recordCore('identity','2xx',4));
 let releaseA;const blocked=new Promise(resolve=>{releaseA=resolve;});
 function channel(requestId,wait){let finished=false;
  return observeOwnerChannel({available:true,async operation(){telemetry.recordDb(2);telemetry.recordCore('context','2xx',3);await wait;finished=true;return requestId;},async open(){},async poll(){},async reply(){}},
   {telemetry,identity:()=>({requestId,binding,settled:finished})});
 }
 const a=channel(id(3),blocked),b=channel(id(4),Promise.resolve());
 async function exchange(c){return runOwnerHttpRequest(telemetry,async()=>{
  telemetry.recordAws('DescribeTasks','success',1);const result=await c.operation();
  telemetry.recordAws('DescribeTasks','success',1);return result;
 });}
 const first=exchange(a);assert.equal(await exchange(b),id(4));releaseA();assert.equal(await first,id(3));
 const counters=lines.filter(line=>line.event==='meri.turn.counters');assert.equal(counters.length,2);
 assert.deepEqual(new Set(counters.map(line=>line.requestId)),new Set([id(3),id(4)]));
 assert.equal(counters.reduce((n,line)=>n+line.db.statements,0),2);
 assert.equal(counters.reduce((n,line)=>n+sum(line.core),0),3);
 assert.equal(counters.reduce((n,line)=>n+sum(line.aws),0),4);
 assert.equal(counters.reduce((n,line)=>n+line.clerkReadsEstimate,0),5);
 // A further poll/reply after settlement must not re-emit the model counters.
 await runOwnerHttpRequest(telemetry,()=>b.reply());assert.equal(lines.filter(line=>line.event==='meri.turn.counters').length,2);
});

test('rejected owner work preserves the error and leaves unknown binding work in the background',async()=>{
 const {lines,telemetry}=fixture(),failure=Error('secret request body');
 await assert.rejects(runOwnerHttpRequest(telemetry,async()=>{telemetry.recordDb(3);throw failure;}),error=>error===failure);
 telemetry.rollup();const rollup=lines.find(line=>line.event==='meri.process.rollup');
 assert.equal(rollup.db.statements,1);assert.equal(lines.some(line=>line.event==='meri.turn.counters'),false);
 assert.equal(JSON.stringify(lines).includes(failure.message),false);
});


test('failed or retired owner channels flush known binding counts once and release their request slots',async()=>{
 const {lines,telemetry}=fixture(),failure=Error('private failed model'),failureId=id(5),retiredId=id(6);
 let failed=false;const channel=observeOwnerChannel({available:true,async operation(){telemetry.recordDb(2);failed=true;throw failure;},async open(){},async poll(){},async reply(){}},
  {telemetry,identity:()=>({requestId:failureId,binding,failed})});
 await assert.rejects(runOwnerHttpRequest(telemetry,()=>channel.operation()),error=>error===failure);
 finishOwnerChannel(channel);finishOwnerChannel(channel);
 const retired=observeOwnerChannel({available:true,async operation(){telemetry.recordDb(3);return 'held';},async open(){},async poll(){},async reply(){}},
  {telemetry,identity:()=>({requestId:retiredId,binding})});
 assert.equal(await runOwnerHttpRequest(telemetry,()=>retired.operation()),'held');
 finishOwnerChannel(retired);finishOwnerChannel(retired);
 const counters=lines.filter(line=>line.event==='meri.turn.counters');assert.equal(counters.length,2);
 assert.deepEqual(counters.map(line=>line.db.statements),[1,1]);
 assert.equal(telemetry.counters(binding,{requestId:failureId}),undefined,'failed slot removed');
 assert.equal(telemetry.counters(binding,{requestId:retiredId}),undefined,'retired slot removed');
 assert.equal(JSON.stringify(lines).includes(failure.message),false);
});
