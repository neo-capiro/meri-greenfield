import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createQualificationLifecycleBridge,validateQualificationLifecycleConfiguration} from './lifecycle-bridge.mjs';
import {createState} from '../action-host/local-integration/state.mjs';
import {observationFixture} from '../../../infra/native-enforcement/worker-observer.fixture.mjs';
import {createScriptedLifecycleInterpreter} from './lifecycle-bridge.fixture.mjs';
export async function lifecycleFixture(t){
 const interpreterOwner=await createScriptedLifecycleInterpreter(),statePath=interpreterOwner.sqlStatePath,interpreter=interpreterOwner.pythonExecutable,dir=join(interpreter,'..');
 const now=Date.now,s=createState({mode:'synthetic-local',deadlineMs:now()+60000});
 const f=observationFixture({runId:s.binding.runId,policyRevision:s.policy});
 const fixture={mode:'owned-disposable-qualification',fixtureId:'11111111-1111-4111-8111-111111111111',host:'127.0.0.1',port:6543,database:'meri_qualification_test',user:'qualification_owner',systemIdentifier:'123456',serverStartTime:'2026-10-13T00:00:00.000Z',serverVersion:'170011',schemaSha256:'a'.repeat(64)};
 const facts=[s.readFacts,s.commandFacts].map(v=>({...v,qualificationBinding:f.request.qualificationBinding}));
 const config={pythonExecutable:interpreter,connection:{host:'127.0.0.1',port:6543,dbname:'meri_qualification_test',user:'qualification_owner'},fixture,allocationJson:JSON.stringify(s.allocation),grantFactsJsons:facts.map(JSON.stringify),expiresAtMs:s.deadlineMs,originalDeadlineMs:s.deadlineMs,workerObserver:f.make({now}),worker:Object.fromEntries(['probeKind','attemptStartMs','attemptEndMs'].map(k=>[k,f.request[k]])),now,limits:{maxRequestMs:10000,maxFrameBytes:131072,maxCleanupMs:1000}};
 t.after(async()=>{s.identity.close();await interpreterOwner.close();});
 return {config,f,statePath,dir,interpreter,make:extra=>createQualificationLifecycleBridge({...config,...extra}),rows:async()=>JSON.parse(await readFile(statePath,'utf8'))};
}
test('fixed Python bridge invokes real canonical Grants over scripted SQL; recovery reads without reseed',async t=>{
 const f=await lifecycleFixture(t),owner=f.make();assert.equal(owner.status().phase,'NEW');
 const result=await owner.activate();assert.equal(result.status,'ACTIVE');assert.equal(result.evidenceKind,'trusted-read-port-observation');
 const before=await f.rows();assert.deepEqual(Object.values(before.grants).map(g=>g.state),['ACTIVE','ACTIVE']);assert.equal(f.f.calls.length,4);
 await assert.rejects(owner.activate());const recovered=f.make();assert.equal((await recovered.rehydrate()).status,'ACTIVE');assert.deepEqual(await f.rows(),before);
 assert.equal((await recovered.revoke()).status,'REVOKED');assert.deepEqual(Object.values((await f.rows()).grants).map(g=>g.state),['REVOKED','REVOKED']);
 const refused=f.make();await assert.rejects(refused.rehydrate());assert.equal(refused.status().phase,'UNKNOWN');assert.equal(owner.status().ownedChildren,0);assert.equal(recovered.status().physicalExitObserved,true);
});
test('worker refusal leaves PENDING and never auto-activates/reseeds/compensates',async t=>{
 const f=await lifecycleFixture(t);f.f.task.LastStatus='STOPPED';const owner=f.make();await assert.rejects(owner.activate());assert.equal(owner.status().phase,'UNKNOWN');assert.deepEqual(Object.values((await f.rows()).grants).map(g=>g.state),['PENDING','PENDING']);await assert.rejects(owner.activate());await assert.rejects(owner.rehydrate());
});
test('preflight permits only missing schema digest, never returns authority or starts child',async t=>{
 const f=await lifecycleFixture(t),c={...f.config,fixture:{...f.config.fixture,schemaSha256:null}};assert.equal(validateQualificationLifecycleConfiguration(c).schemaPrepared,false);assert.throws(()=>createQualificationLifecycleBridge(c));assert.throws(()=>validateQualificationLifecycleConfiguration({...c,worker:{...c.worker,probeKind:'arbitrary'}}));await assert.rejects(readFile(f.statePath));
});
test('same fixture connection and full grant context required before process',async t=>{
 const f=await lifecycleFixture(t);assert.throws(()=>f.make({connection:{...f.config.connection,port:9999}}));assert.throws(()=>f.make({expiresAtMs:f.config.originalDeadlineMs+1}));
 const facts=JSON.parse(f.config.grantFactsJsons[1]);facts.binding.actorId='other';assert.throws(()=>f.make({grantFactsJsons:[f.config.grantFactsJsons[0],JSON.stringify(facts)]}));await assert.rejects(readFile(f.statePath));
});
test('parked owned process is killed and close observed at original short deadline',async t=>{
 const f=await lifecycleFixture(t);await writeFile(f.interpreter,'#!/usr/bin/python3\nimport time\ntime.sleep(20)\n');const owner=f.make();const start=Date.now();await assert.rejects(owner.activate({deadlineMs:Date.now()+60}));assert(Date.now()-start<1500);assert.equal(owner.status().ownedChildren,0);assert.equal(owner.status().physicalExitObserved,true);assert.equal(owner.status().phase,'UNKNOWN');
});
test('stderr/error content is discarded and no automatic retry follows unknown receipt',async t=>{
 const f=await lifecycleFixture(t);await writeFile(f.interpreter,'#!/usr/bin/python3\nimport sys\nsys.stderr.write("SECRET_NATIVE_CREDENTIAL")\n');const owner=f.make();let error;try{await owner.activate();}catch(e){error=e;}assert.equal(error.message,'QUALIFICATION_LIFECYCLE_UNKNOWN');assert(!JSON.stringify(owner.status()).includes('SECRET'));assert.equal(owner.status().ownedChildren,0);await assert.rejects(owner.activate());
});
test('post-mutation wrong receipt cannot admit or allow reattempt',async t=>{
 const f=await lifecycleFixture(t);const code=await readFile(f.interpreter,'utf8');await writeFile(f.interpreter,code.replace('raise SystemExit(scripted_process(', 'raise SystemExit(scripted_process(').replace("from apps.proxy.qualification.assembly.test_lifecycle import scripted_process", "from apps.proxy.qualification.assembly.test_lifecycle import scripted_process\nimport contextlib,io\nwith contextlib.redirect_stdout(io.StringIO()):\n result=scripted_process("+JSON.stringify(f.statePath)+")\nprint('{\"status\":\"ACTIVE\"}')\nraise SystemExit(0)\n#"));
 const o=f.make();await assert.rejects(o.activate());assert.equal(o.status().phase,'UNKNOWN');assert.equal(Object.keys((await f.rows()).grants).length,2);assert.equal(o.status().ownedChildren,0);
});
for(const stream of ['stdout','stderr'])test('bounded '+stream+' flood closes owned child without releasing content',async t=>{
 const f=await lifecycleFixture(t);await writeFile(f.interpreter,`#!/usr/bin/python3\nimport sys\nwhile True: sys.${stream}.write('SECRET'*65536);sys.${stream}.flush()\n`);
 const o=f.make();await assert.rejects(o.activate(),/^Error: QUALIFICATION_LIFECYCLE_UNKNOWN$/);assert.equal(o.status().ownedChildren,0);assert.equal(o.status().physicalExitObserved,true);
});
test('aborted and extended caller cutoffs cannot refresh constructor original deadline',async t=>{
 const f=await lifecycleFixture(t);const o=f.make();const a=new AbortController();a.abort();await assert.rejects(o.activate({signal:a.signal}));await assert.rejects(readFile(f.statePath));
 const short=f.make({originalDeadlineMs:Date.now()+40,expiresAtMs:Date.now()+35});await writeFile(f.interpreter,'#!/usr/bin/python3\nimport time\ntime.sleep(20)\n');const started=Date.now();await assert.rejects(short.activate({deadlineMs:Date.now()+5000}));assert(Date.now()-started<1200);assert.equal(short.status().ownedChildren,0);
});
test('mapped endpoint and25 declared namespaces cross actual fixed Python bridge unchanged',async t=>{
 const f=await lifecycleFixture(t),fixture={...f.config.fixture,port:55432,serverAddress:'172.17.0.2',serverPort:5432,schemaScope:{mode:'preserve-declared-evidence',namespaces:Array.from({length:25},(_,i)=>({name:`evidence_${i}`,owner:'qualification_owner'}))}},connection={...f.config.connection,port:55432};
 const o=f.make({fixture,connection});assert.equal((await o.activate()).status,'ACTIVE');assert.equal(o.status().ownedChildren,0);assert.equal(Object.keys((await f.rows()).grants).length,2);
 const changed=f.make({fixture:{...fixture,serverPort:5433},connection});assert.notEqual(changed.status().admissionSha256,o.status().admissionSha256);
 const changedScope=f.make({fixture:{...fixture,schemaScope:{...fixture.schemaScope,namespaces:fixture.schemaScope.namespaces.slice(1)}},connection});assert.notEqual(changedScope.status().admissionSha256,o.status().admissionSha256);
 assert.throws(()=>f.make({fixture,connection:{...connection,host:fixture.serverAddress,port:fixture.serverPort}}));
});
test('bridge mapped descriptor refuses partial fields and invalid scope before child',async t=>{
 const f=await lifecycleFixture(t);for(const change of [{serverAddress:'172.17.0.2'},{serverPort:5432},{serverAddress:'db.local',serverPort:5432},{schemaScope:{mode:'preserve-declared-evidence',namespaces:[{name:'public',owner:'qualification_owner'}]}}])assert.throws(()=>f.make({fixture:{...f.config.fixture,...change}}));await assert.rejects(readFile(f.statePath));
});
