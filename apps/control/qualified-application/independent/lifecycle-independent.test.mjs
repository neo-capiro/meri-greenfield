import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createQualificationLifecycleBridge,validateQualificationLifecycleConfiguration} from '../lifecycle-bridge.mjs';
import {createScriptedLifecycleInterpreter} from '../lifecycle-bridge.fixture.mjs';
import {createState} from '../../action-host/local-integration/state.mjs';
import {observationFixture} from '../../../../infra/native-enforcement/worker-observer.fixture.mjs';
import {consumeQualificationWorkerObservation} from '../../../../infra/native-enforcement/worker-observer.mjs';

async function scenario(t){
 const driver=await createScriptedLifecycleInterpreter(),s=createState({mode:'synthetic-local',deadlineMs:Date.now()+25000});
 t.after(async()=>{s.identity.close();await driver.close();});
 const observed=observationFixture({runId:s.binding.runId,policyRevision:s.policy}),facts=[s.readFacts,s.commandFacts].map(f=>({...f,qualificationBinding:observed.request.qualificationBinding}));
 const fixture={mode:'owned-disposable-qualification',fixtureId:'11111111-1111-4111-8111-111111111111',host:'127.0.0.1',port:6543,database:'meri_qualification_test',user:'qualification_owner',systemIdentifier:'123456',serverStartTime:'2026-10-13T00:00:00.000Z',serverVersion:'170011',schemaSha256:'a'.repeat(64)};
 const config={pythonExecutable:driver.pythonExecutable,connection:{host:fixture.host,port:fixture.port,dbname:fixture.database,user:fixture.user},fixture,allocationJson:JSON.stringify(s.allocation),grantFactsJsons:facts.map(JSON.stringify),expiresAtMs:s.deadlineMs,originalDeadlineMs:s.deadlineMs,workerObserver:observed.make({now:Date.now}),worker:Object.fromEntries(['probeKind','attemptStartMs','attemptEndMs'].map(k=>[k,observed.request[k]])),now:Date.now,limits:{maxRequestMs:10000,maxFrameBytes:131072,maxCleanupMs:1000}};
 return {driver,s,observed,facts,config,make:extra=>createQualificationLifecycleBridge({...config,...extra})};
}
test('actual fixed child creates pending then independently observes both grants before activation and reconstructs without writes',async t=>{
 const f=await scenario(t),o=f.make();await assert.rejects(f.driver.readState());assert.equal(o.status().ownedChildren,0);
 const receipt=await o.activate();assert.equal(receipt.status,'ACTIVE');assert.equal(receipt.evidenceKind,'trusted-read-port-observation');assert.equal(f.observed.calls.length,4);
 const original=await readFile(f.driver.sqlStatePath,'utf8');assert.deepEqual(Object.values(JSON.parse(original).grants).map(g=>g.state),['ACTIVE','ACTIVE']);
 const reconstructed=f.make();assert.equal((await reconstructed.rehydrate()).status,'ACTIVE');assert.equal(await readFile(f.driver.sqlStatePath,'utf8'),original);assert.equal(f.observed.calls.length,6);
 await reconstructed.revoke();const after=await f.driver.readState();assert.deepEqual(Object.values(after.grants).map(g=>g.state),['REVOKED','REVOKED']);await assert.rejects(f.make().rehydrate());assert.equal(o.status().physicalExitObserved,true);
});
test('second worker refusal preserves one active and one pending grant, terminal unknown never compensates or retries',async t=>{
 const f=await scenario(t),original=f.observed.reads.describeTasks;let reads=0;f.observed.reads.describeTasks=async(...args)=>{if(++reads===2)f.observed.task.LastStatus='STOPPED';return original(...args);};
 const o=f.make({workerObserver:f.observed.make({now:Date.now})});await assert.rejects(o.activate());const state=await f.driver.readState();assert.deepEqual(Object.values(state.grants).map(g=>g.state),['ACTIVE','PENDING']);assert.equal(o.status().phase,'UNKNOWN');await assert.rejects(o.activate());await assert.rejects(o.rehydrate());assert.deepEqual(await f.driver.readState(),state);assert.equal(o.status().ownedChildren,0);
});
test('committed prepare with lost acknowledgement remains pending, content-free unknown and no automatic reattempt',async t=>{
 const f=await scenario(t),script=await readFile(f.driver.pythonExecutable,'utf8');
 const changed=script.replace('raise SystemExit(scripted_process(', 'result=scripted_process(').replace(/\)\)\s*$/,' )\nraise SystemExit(2)\n');
 await writeFile(f.driver.pythonExecutable,changed);const o=f.make();await assert.rejects(o.activate(),e=>e.message==='QUALIFICATION_LIFECYCLE_UNKNOWN'&&e.outcome==='UNKNOWN');assert.deepEqual(Object.values((await f.driver.readState()).grants).map(g=>g.state),['PENDING','PENDING']);assert.equal(f.observed.calls.length,0);await assert.rejects(o.activate());assert.equal(o.status().physicalExitObserved,true);
});
test('short observation validity clips the actual activation child before delayed SQL can mutate',async t=>{
 const f=await scenario(t),script=await readFile(f.driver.pythonExecutable,'utf8');
 const prelude="import io,json,time\nraw=sys.stdin.buffer.read()\nrequest=json.loads(raw)\nsys.stdin=io.TextIOWrapper(io.BytesIO(raw))\nif request['operation']=='activate': time.sleep(0.4)\n";
 await writeFile(f.driver.pythonExecutable,script.replace('raise SystemExit(',prelude+'raise SystemExit('));
 const o=f.make({workerObserver:f.observed.make({now:Date.now,maxRequestMs:180})});await assert.rejects(o.activate());assert.deepEqual(Object.values((await f.driver.readState()).grants).map(g=>g.state),['PENDING','PENDING']);assert.equal(o.status().ownedChildren,0);assert.equal(o.status().physicalExitObserved,true);
});
test('pre-aborted operation starts no child and consumes no worker observation',async t=>{
 const f=await scenario(t),o=f.make();await assert.rejects(o.activate({signal:AbortSignal.abort()}));await assert.rejects(f.driver.readState());assert.equal(f.observed.calls.length,0);assert.equal(o.status().ownedChildren,0);
});
test('preflight is inert and rejects foreign connection, alias grants and fabricated observer',async t=>{
 const f=await scenario(t);assert.equal(validateQualificationLifecycleConfiguration({...f.config,fixture:{...f.config.fixture,schemaSha256:null}}).schemaPrepared,false);
 for(const change of [{connection:{...f.config.connection,port:1}},{grantFactsJsons:[f.config.grantFactsJsons[0],f.config.grantFactsJsons[0]]},{workerObserver:{observe:async()=>({verified:true})}}])assert.throws(()=>f.make(change));
 await assert.rejects(f.driver.readState());assert.equal(f.observed.calls.length,0);
});
test('observer token is one-use and exact expected binding, never transferable approval',async t=>{
 const f=await scenario(t),o=f.observed.make({now:Date.now}),token=await o.observe(f.observed.request,{deadlineMs:Date.now()+1000});assert.throws(()=>consumeQualificationWorkerObservation(o,token,{...f.observed.request,qualificationBinding:{...f.observed.request.qualificationBinding,fence:2}},{now:Date.now}));assert.throws(()=>consumeQualificationWorkerObservation(o,token,f.observed.request,{now:Date.now}));await assert.rejects(f.driver.readState());
});
test('constructor snapshots grant and connection data before deferred child execution',async t=>{
 const f=await scenario(t),o=f.make(),ids=f.facts.map(x=>x.grantId);f.config.grantFactsJsons.splice(0,2,'{}','{}');f.config.connection.port=1;f.config.worker.probeKind='invalid';f.config.limits.maxFrameBytes=1;const result=await o.activate();assert.deepEqual(result.grantIds,ids);assert.equal(o.status().ownedChildren,0);
});
