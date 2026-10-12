import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { liveFixture, requestFor } from '../../../../../apps/control/qualification-sdk-fixture/service/test/fixture.mjs';
import { CommitUncertain } from '../../../../../apps/control/qualification-sdk-fixture/state/errors.mjs';
const root=process.env.G1_REVIEW_SOURCE_ROOT??resolve('.');
const {createFixtureServiceHandlers}=await import(pathToFileURL(resolve(root,'apps/control/qualification-sdk-fixture/service/handlers.mjs')));
const operations=['authorizeFixturePhase','commitFixtureCheckpoint','loadFixtureCheckpoint','verifyFixtureCheckpoint'];
function fixture() {
 const f=liveFixture(), controller=new AbortController(), events=[], actions=new Map();let clock=Date.now();
 const publication={outcome:'LOADED',receiptId:f.reference.receiptId,receiptSha256:f.reference.receiptSha256,bundleObjectId:f.receipt.bundle.objectId,bundleVersionId:f.receipt.bundle.versionId,bundleSha256:f.receipt.bundle.sha256,bundleBytes:f.receipt.bundle.bytes,workspaceSha256:f.receipt.workspaceSha256};
 const counts=new Map();const run=async(name,result)=>{const n=(counts.get(name)??0)+1;counts.set(name,n);const key=`${name}:${n}`;events.push(key);if(actions.has(key))await actions.get(key)();return result();};
 const registry={authorize:()=>run('authorize',()=>({decision:'AUTHORIZED',checkedAtMs:clock})),publishCommit:()=>run('publish',()=>({outcome:'COMMITTED',identity:f.reference})),readPublication:()=>run('reconcile',()=>({outcome:'COMMITTED',identity:f.reference})),loadCheckpoint:()=>run('load',()=>publication),verifyCheckpoint:()=>run('verify',()=>({outcome:'VERIFIED',...f.reference}))};
 const checkpointStore={prepareCommit:()=>run('prepare',()=>({receipt:f.receipt,readback:f.readback})),load:()=>run('objects',()=>({receipt:f.receipt,bundle:f.bundle,fixtureFile:f.sentinel,readback:f.readback}))};
 const handlers=createFixtureServiceHandlers({registry,checkpointStore,now:()=>clock});
 const input=op=>({peer:{peerId:op==='commitFixtureCheckpoint'?'synthetic-task-a':'synthetic-task-b',credentialId:op==='commitFixtureCheckpoint'?'synthetic-credential-a':'synthetic-credential-b'},context:f.current,producer:f.producer,request:requestFor(f,op),signal:controller.signal});
 return {f,controller,events,actions,handlers,input,expire:()=>{clock=f.current.identity.expiresAtMs;}};
}
for(const operation of operations)test(`independent positive ${operation}`,async()=>{const f=fixture();const result=await f.handlers[operation](f.input(operation));assert.ok(result.status);assert.equal(result.runnerQualified,undefined);});
for(const operation of operations)test(`independent aborted before ${operation} starts zero ports`,async()=>{const f=fixture();f.controller.abort();await assert.rejects(f.handlers[operation](f.input(operation)));assert.deepEqual(f.events,[]);});
const stages={authorizeFixturePhase:['authorize:1'],commitFixtureCheckpoint:['authorize:1','prepare:1','publish:1'],loadFixtureCheckpoint:['load:1','objects:1','load:2'],verifyFixtureCheckpoint:['load:1','objects:1','verify:1']};
for(const [operation,points] of Object.entries(stages))for(const point of points)test(`independent abort after parked ${operation}/${point} causes no next port or success`,async()=>{
 const f=fixture();let release,entered;const enteredPromise=new Promise(r=>entered=r);f.actions.set(point,()=>{entered();return new Promise(r=>release=r);});
 const pending=f.handlers[operation](f.input(operation));await enteredPromise;f.controller.abort();const before=[...f.events];release();await assert.rejects(pending);assert.deepEqual(f.events,before);
});
for(const operation of ['commitFixtureCheckpoint','loadFixtureCheckpoint','verifyFixtureCheckpoint'])test(`independent expiry during final ${operation} port never releases success`,async()=>{const f=fixture();const point=stages[operation].at(-1);f.actions.set(point,f.expire);await assert.rejects(f.handlers[operation](f.input(operation)));assert.equal(f.events.at(-1),point);});
test('independent ambiguous commit aborted before catch starts no reconciliation',async()=>{const f=fixture();f.actions.set('publish:1',()=>{f.controller.abort();throw new CommitUncertain();});await assert.rejects(f.handlers.commitFixtureCheckpoint(f.input('commitFixtureCheckpoint')));assert.deepEqual(f.events,['authorize:1','prepare:1','publish:1']);});
test('independent abort during ambiguity readback never releases reconciled receipt',async()=>{const f=fixture();f.actions.set('publish:1',()=>{throw new CommitUncertain();});f.actions.set('reconcile:1',()=>f.controller.abort());await assert.rejects(f.handlers.commitFixtureCheckpoint(f.input('commitFixtureCheckpoint')));assert.deepEqual(f.events,['authorize:1','prepare:1','publish:1','reconcile:1']);});
test('independent expiry during ambiguity readback never releases reconciled receipt',async()=>{const f=fixture();f.actions.set('publish:1',()=>{throw new CommitUncertain();});f.actions.set('reconcile:1',f.expire);await assert.rejects(f.handlers.commitFixtureCheckpoint(f.input('commitFixtureCheckpoint')));});
test('independent active ambiguous commit still reconciles original identity',async()=>{const f=fixture();f.actions.set('publish:1',()=>{throw new CommitUncertain();});const result=await f.handlers.commitFixtureCheckpoint(f.input('commitFixtureCheckpoint'));assert.equal(result.status,'COMMITTED');assert.deepEqual(f.events,['authorize:1','prepare:1','publish:1','reconcile:1']);});
