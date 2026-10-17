/** Synthetic Core transport and run owner only. The real decoded Core client and
 * closed reply decoders run; no Core, credential, database or Temporal server. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreObjectiveGenerationClient} from '../../control/objective-generation/core-client.mjs';
import {coreRepliesFixture,NOW} from '../../control/objective-generation/test/core-replies-fixture.mjs';
import {createObjectiveGenerationActivities} from './lifecycle-activities.mjs';

function harness({replies={},runs:runOptions={},withRuns=true,withClient=true}={}){
 const x=coreRepliesFixture(),calls=[],runState={run:runOptions.existing??null,starts:[]};
 const queue={admit:[x.replies.admit()],publish:[x.replies.publication()],accept:[],readAdmission:[x.replies.admissionRead()],readRequest:[x.replies.publication()],
  complete:[x.replies.completion()],readCompletion:['unavailable'],...replies};
 const transport={available:()=>true,...Object.fromEntries(Object.keys(queue).map(m=>[m,async value=>{calls.push(m);
  const next=queue[m].length>1?queue[m].shift():queue[m][0];if(next===undefined||next==='unavailable')return {kind:'unavailable'};return {kind:'unqualified-response',status:200,value:structuredClone(next)};}]))};
 const clientFor=source=>{assert.deepEqual(source,x.source);return createCoreObjectiveGenerationClient({transport,source,executionSelection:x.executionSelection,now:()=>NOW});};
 const runs={async start(value){runState.starts.push(value);if(runOptions.startFails)throw Error('lost');runState.run={state:'queued'};return runOptions.startAnswer??{kind:'started'};},
  async read(){if(runOptions.readFails)throw Error('down');return runState.run;}};
 const activities=createObjectiveGenerationActivities({...(withClient?{clientFor}:{}),...(withRuns?{runs}:{}),context:()=>({cancellationSignal:new AbortController().signal}),now:()=>NOW});
 const input={generationJobId:x.source.generationJobId,binding:x.source.binding,notAfterMs:NOW+3600000};
 return {x,calls,runState,activities,input};
}

test('source admits then publishes and returns digests and the effect bound only',async()=>{
 const h=harness(),out=await h.activities.objectiveGenerationSource(h.input);
 assert.deepEqual(out,{kind:'ready',sourceAdmissionSha256:h.x.sourceAdmissionSha256,requestSha256:h.x.replies.publication().requestSha256,effectExpiresAtMs:h.x.admission.effectExpiresAtMs});
 assert.deepEqual(h.calls,['admit','publish']);assert.equal(JSON.stringify(out).includes(h.x.executionContext.prompt),false);
 assert.deepEqual(await harness({withClient:false}).activities.objectiveGenerationSource(h.input),{kind:'unconfirmed'});
 assert.deepEqual(await harness({replies:{publish:['unavailable']}}).activities.objectiveGenerationSource(h.input),{kind:'unconfirmed'});
});

test('run start re-reads Core, passes the published prompt and decoded selection to the run owner once',async()=>{
 const h=harness(),requestSha256=h.x.replies.publication().requestSha256;
 assert.deepEqual(await h.activities.objectiveGenerationStartRun({...h.input,mode:'effect',requestSha256}),{kind:'started'});
 assert.deepEqual(h.calls,['readAdmission','readRequest']);assert.equal(h.runState.starts.length,1);
 const s=h.runState.starts[0];assert.equal(s.acceptedRequest.prompt,h.x.executionContext.prompt);assert.equal(s.acceptedRequest.requestId,h.x.admission.generationRequestId);
 assert.equal(s.selection.queuedType,'appropriations');assert.equal('executionSelection' in s.selection,false,'Meri issues the model selection at preparation');
 assert.deepEqual(await h.activities.objectiveGenerationStartRun({...h.input,mode:'read',requestSha256}),{kind:'started'});assert.equal(h.runState.starts.length,1);
});

test('run start outcomes: absent owner/client and Core read failures are definite no-ops; a lost start is unconfirmed',async()=>{
 const x=coreRepliesFixture(),requestSha256=x.replies.publication().requestSha256,start=h=>h.activities.objectiveGenerationStartRun({...h.input,mode:'effect',requestSha256});
 assert.deepEqual(await start(harness({withRuns:false})),{kind:'not-started'});
 assert.deepEqual(await start(harness({withClient:false})),{kind:'not-started'});
 const coreDown=harness({replies:{readRequest:['unavailable']}});assert.deepEqual(await start(coreDown),{kind:'not-started'});assert.equal(coreDown.runState.starts.length,0);
 assert.deepEqual(await start(harness({runs:{startFails:true}})),{kind:'unconfirmed'});
 const mismatch=harness();assert.deepEqual(await mismatch.activities.objectiveGenerationStartRun({...mismatch.input,mode:'effect',requestSha256:'0'.repeat(64)}),{kind:'refused'});
 assert.equal(mismatch.runState.starts.length,0);
 const missing=harness();assert.deepEqual(await missing.activities.objectiveGenerationStartRun({...missing.input,mode:'read',requestSha256}),{kind:'absent'});
});

test('run state reads only the run owner projection',async()=>{
 const h=harness({runs:{existing:{state:'running'}}});assert.deepEqual(await h.activities.objectiveGenerationReadRun(h.input),{kind:'state',state:'running'});
 assert.deepEqual(await harness({runs:{existing:{state:'bogus'}}}).activities.objectiveGenerationReadRun(h.input),{kind:'unconfirmed'});
 assert.deepEqual(await harness({runs:{readFails:true}}).activities.objectiveGenerationReadRun(h.input),{kind:'unconfirmed'});
 assert.deepEqual(await harness({withRuns:false}).activities.objectiveGenerationReadRun(h.input),{kind:'unconfirmed'});
});

test('completion reads back first, then posts the Core completion and returns its decoded receipt digests',async()=>{
 const h=harness(),out=await h.activities.objectiveGenerationComplete({...h.input,sourceAdmissionSha256:h.x.sourceAdmissionSha256});
 assert.equal(out.kind,'completed');assert.equal(out.strategyId,h.x.admission.canonical.canonicalStrategyId);
 assert.deepEqual(h.calls,['readAdmission','readRequest','readCompletion','complete']);
 const replay=harness({replies:{readCompletion:[coreRepliesFixture().replies.completion()],complete:['unavailable']}});
 assert.equal((await replay.activities.objectiveGenerationComplete({...replay.input,sourceAdmissionSha256:replay.x.sourceAdmissionSha256})).kind,'completed');
 assert.equal(replay.calls.includes('complete'),false,'an existing saved generation is not posted again');
 const unaccepted=harness({replies:{readAdmission:[coreRepliesFixture().replies.admissionRead(null)]}});
 assert.deepEqual(await unaccepted.activities.objectiveGenerationComplete({...unaccepted.input,sourceAdmissionSha256:unaccepted.x.sourceAdmissionSha256}),{kind:'unconfirmed'});
 assert.deepEqual(await h.activities.objectiveGenerationComplete({...h.input,sourceAdmissionSha256:'0'.repeat(64)}),{kind:'unconfirmed'});
});

test('inputs are closed and configuration must be complete',async()=>{
 const h=harness();
 await assert.rejects(h.activities.objectiveGenerationSource({...h.input,prompt:'x'}));
 await assert.rejects(h.activities.objectiveGenerationStartRun({...h.input,mode:'other',requestSha256:'0'.repeat(64)}));
 assert.throws(()=>createObjectiveGenerationActivities({runs:{start(){}}}));assert.throws(()=>createObjectiveGenerationActivities({maxRequestMs:0}));
});
