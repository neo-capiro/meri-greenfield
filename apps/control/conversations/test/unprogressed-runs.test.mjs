/** Synthetic (scripted SQL protocol fixture): the hourly settlement pass hands each run nothing can progress to the existing run
 * reconciler, which fences it failed (ATTEMPT_LOST) and proves a claimed invocation stopped, so the conversation's next turn is
 * admitted. The SQL selection itself has its own opt-in PostgreSQL proof (unprogressed-runs-pg.test.mjs). */
import test from 'node:test';import assert from 'node:assert/strict';
import {binding} from './lifecycle-fixture.mjs';
import {fixture,check} from './next-run-recovery-fixture.mjs';
import {hash} from '../boundary.mjs';
import {createRunReconciler,ATTEMPT_LOST} from '../run-reconciler.mjs';
import {createUnprogressedRunSettlement} from '../unprogressed-runs.mjs';
async function settle({list,reconciler}){const lines=[];
 const settlement=createUnprogressedRunSettlement({list,reconciler,write:line=>lines.push(JSON.parse(line))});
 await settlement.start();return lines;}
const lastStatus=async x=>{const head=await x.f.store.read(binding,{after:0,limit:1},check),tail=await x.f.store.read(binding,{after:head.lastSequence-1,limit:1},check);return tail.events[0].data;};

test('a submitted run whose invocation ended before `starting` is fenced ATTEMPT_LOST, stopped, and no longer blocks the next turn',async()=>{const x=await fixture();try{
 await x.first();await x.f.store.executions.record({binding,executionId:hash(binding),phase:'unknown',native:null},check);
 assert.deepEqual(await x.select(),{binding,reserved:false},'the queued run is still the live latest run');
 const stops=[];const reconciler=createRunReconciler({store:x.f.store,stopExecution:async input=>{stops.push(input.runtimeSessionId);return {binding:input.binding,executionId:input.executionId,runtimeSessionId:input.runtimeSessionId,stopped:true};}});
 const lines=await settle({list:async({nowMs})=>{assert.ok(Number.isSafeInteger(nowMs));return [binding];},reconciler});
 assert.deepEqual(lines,[{event:'MERI_RUN_SETTLEMENT',outcome:'completed',candidates:1,reconciled:1,settled:0,unknown:0}]);
 assert.equal(await x.state(),'failed');assert.deepEqual(await lastStatus(x),{state:'failed',reasonCode:ATTEMPT_LOST});assert.equal(stops.length,1);
 const selected=await x.select();assert.equal(selected.reserved,true);assert.equal(selected.binding.writerFence,2);
 // A second pass over the same (now terminal, stopped) run changes nothing.
 assert.deepEqual(await settle({list:async()=>[binding],reconciler}),[{event:'MERI_RUN_SETTLEMENT',outcome:'completed',candidates:1,reconciled:0,settled:1,unknown:0}]);
}finally{x.f.close();}});

test('an admitted run that was never dispatched is fenced without a provider Stop, and a late kickoff can no longer claim it',async()=>{const x=await fixture();try{
 await x.f.service.allocateInput({credential:x.f.credential,input:x.f.input});await x.f.service.admitInput({credential:x.f.credential,input:x.f.input});
 assert.equal(await x.state(),'queued');
 const reconciler=createRunReconciler({store:x.f.store,stopExecution:async()=>assert.fail('nothing was claimed, so nothing is stopped')});
 assert.deepEqual(await settle({list:async()=>[binding],reconciler}),[{event:'MERI_RUN_SETTLEMENT',outcome:'completed',candidates:1,reconciled:1,settled:0,unknown:0}]);
 assert.deepEqual(await lastStatus(x),{state:'failed',reasonCode:ATTEMPT_LOST});
 await assert.rejects(x.allocate(binding),/EXECUTION_NOT_QUEUED/,'a delayed workflow cannot start the fenced run');
 assert.equal((await x.select()).reserved,true);
}finally{x.f.close();}});

test('a pass is single-flight, counts an uncertain or failing reconcile as unknown, and logs counts only',async()=>{
 const gate=Promise.withResolvers(),seen=[],lines=[];
 const reconciler={async reconcile({binding}){seen.push(binding.runId);if(binding.runId==='a')return {outcome:'unknown',state:'failed'};if(binding.runId==='b'){await gate.promise;throw Error('provider down for tenant secret-value');}return {outcome:'settled',state:'failed'};}};
 const settlement=createUnprogressedRunSettlement({list:async()=>[{runId:'a'},{runId:'b'},{runId:'c'}],reconciler,write:line=>lines.push(line)});
 const pass=settlement.start();assert.equal(settlement.start(),null,'a pass in progress is not started twice');
 gate.resolve();await pass;assert.deepEqual(seen,['a','b','c']);
 assert.deepEqual(lines.map(line=>JSON.parse(line)),[{event:'MERI_RUN_SETTLEMENT',outcome:'completed',candidates:3,reconciled:0,settled:1,unknown:2}]);
 assert.ok(!lines[0].includes('secret-value'));
 assert.ok(settlement.start(),'the next hourly pass starts again');await settlement.close();
});

test('an unavailable selection logs one line; close aborts a pass in progress and later candidates are not reconciled',async()=>{
 const lines=[],write=line=>lines.push(JSON.parse(line));
 const down=createUnprogressedRunSettlement({list:async()=>{throw Error('connection refused');},reconciler:{async reconcile(){assert.fail('nothing selected');}},write});
 await down.start();assert.deepEqual(lines,[{event:'MERI_RUN_SETTLEMENT',outcome:'unavailable'}]);
 lines.length=0;const entered=Promise.withResolvers(),seen=[];
 const slow=createUnprogressedRunSettlement({list:async()=>[{runId:'a'},{runId:'b'}],write,reconciler:{async reconcile({binding,signal}){seen.push(binding.runId);entered.resolve();await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}}});
 slow.start();await entered.promise;await slow.close();
 assert.deepEqual(seen,['a']);assert.deepEqual(lines,[{event:'MERI_RUN_SETTLEMENT',outcome:'cancelled'}]);
 assert.throws(()=>createUnprogressedRunSettlement({list:null,reconciler:{reconcile(){}}}),/SETTLEMENT_CONFIGURATION/);
});
