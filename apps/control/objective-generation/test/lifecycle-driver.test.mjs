import test from 'node:test';
import assert from 'node:assert/strict';
import {driveObjectiveGeneration,OBJECTIVE_GENERATION_POLL_MS,OBJECTIVE_GENERATION_RETRY_MS} from '../lifecycle-driver.mjs';
const NOW=1792065600000,sha=c=>c.repeat(64);
const ready={kind:'ready',sourceAdmissionSha256:sha('a'),requestSha256:sha('b'),effectExpiresAtMs:NOW+600000};

function harness({source=[ready],start=[{kind:'started'}],run=[{kind:'state',state:'running'},{kind:'state',state:'completed'}],
 complete=[{kind:'completed',strategyId:'s',strategyVersionId:'v',objectiveReceiptSha256:sha('c')}],stopAt=Infinity}={}){
 const state={now:NOW,calls:[],views:[],waits:[]};
 const step=(name,queue)=>async value=>{state.calls.push({name,value});const next=queue.length>1?queue.shift():queue[0];if(next instanceof Error)throw next;return next;};
 const ports={source:step('source',source),startRun:step('startRun',start),readRun:step('readRun',run),complete:step('complete',complete),
  wait:async ms=>{state.waits.push(ms);state.now+=ms;},publish:v=>state.views.push(v.phase),stopped:()=>state.calls.length>=stopAt,now:()=>state.now};
 const input={generationJobId:'00000000-0000-4000-8000-000000000021',binding:{tenantId:'t'},notAfterMs:NOW+3600000};
 return {state,ports,input,run:()=>driveObjectiveGeneration(input,ports)};
}
const names=h=>h.state.calls.map(c=>c.name);

test('happy path: admit, start one run, observe it to completion, then complete with Core',async()=>{
 const h=harness(),out=await h.run();
 assert.equal(out.phase,'completed');assert.deepEqual(out.result,{strategyId:'s',strategyVersionId:'v',objectiveReceiptSha256:sha('c')});
 assert.deepEqual(names(h),['source','startRun','readRun','readRun','complete']);
 assert.deepEqual(h.state.waits,[OBJECTIVE_GENERATION_POLL_MS]);
 assert.equal(h.state.calls[1].value.mode,'effect');assert.equal(h.state.calls[1].value.requestSha256,sha('b'));
 assert.equal(h.state.calls[4].value.sourceAdmissionSha256,sha('a'));
 assert.equal(JSON.stringify(out).includes('prompt'),false);
});

test('an unconfirmed run start is never repeated as an effect; only read-back follows',async()=>{
 const h=harness({start:[{kind:'unconfirmed'},{kind:'absent'},Error('lost'),{kind:'started'}]}),out=await h.run();
 assert.equal(out.phase,'completed');
 assert.deepEqual(h.state.calls.filter(c=>c.name==='startRun').map(c=>c.value.mode),['effect','read','read','read']);
 assert.deepEqual(h.state.waits.slice(0,3),[OBJECTIVE_GENERATION_RETRY_MS,OBJECTIVE_GENERATION_RETRY_MS,OBJECTIVE_GENERATION_RETRY_MS]);
});

test('a definite not-started answer may be retried as an effect',async()=>{
 const h=harness({start:[{kind:'not-started'},{kind:'started'}]});await h.run();
 assert.deepEqual(h.state.calls.filter(c=>c.name==='startRun').map(c=>c.value.mode),['effect','effect']);
});

test('Core source and completion are retried (Core replays both by job) and bounded by effect expiry',async()=>{
 const h=harness({source:[{kind:'unconfirmed'},Error('lost'),ready],complete:[{kind:'unconfirmed'},{kind:'completed',strategyId:'s',strategyVersionId:'v',objectiveReceiptSha256:sha('c')}]});
 assert.equal((await h.run()).phase,'completed');assert.equal(names(h).filter(n=>n==='source').length,3);assert.equal(names(h).filter(n=>n==='complete').length,2);
 const never=harness({complete:[{kind:'unconfirmed'}]}),out=await never.run();
 assert.equal(out.phase,'completion_unconfirmed');assert.ok(never.state.now>=ready.effectExpiresAtMs);
});

test('failed or cancelled runs never call Core completion',async()=>{
 for(const state of ['failed','cancelled']){
  const h=harness({run:[{kind:'state',state}]}),out=await h.run();assert.equal(out.phase,'run_'+state);assert.equal(names(h).includes('complete'),false);
 }
});

test('stop before a run start ends without starting; after a start the outcome is still accounted',async()=>{
 const h=harness({stopAt:1,source:[{kind:'unconfirmed'}]});assert.equal((await h.run()).phase,'stopped');assert.equal(names(h).includes('startRun'),false);
 const later=harness({stopAt:2});assert.equal((await later.run()).phase,'completed');
});

test('missing server bound refuses; an unbounded wait is impossible',async()=>{
 const h=harness();h.input.notAfterMs=undefined;assert.equal((await h.run()).phase,'refused');assert.equal(h.state.calls.length,0);
 const slow=harness({source:[{kind:'unconfirmed'}]});slow.input.notAfterMs=NOW+OBJECTIVE_GENERATION_RETRY_MS*3;
 assert.equal((await slow.run()).phase,'expired');
 const stuck=harness({run:[{kind:'state',state:'running'}]});assert.equal((await stuck.run()).phase,'expired_unconfirmed');
});

test('a refused effect start (publication mismatch, nothing written) ends the lifecycle',async()=>{
 const h=harness({start:[{kind:'refused'}]}),out=await h.run();assert.equal(out.phase,'refused');assert.deepEqual(names(h),['source','startRun']);
});
