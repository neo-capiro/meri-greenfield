/** Actual run-start, conversation, session and completion owners; only SQL and object transports are synthetic. */
import test from 'node:test';import assert from 'node:assert/strict';
import {lifecycleFixture,settleInvocation,id,versions} from '../../control/conversations/test/lifecycle-fixture.mjs';
import {runStartFixture,syntheticObjectivePool,NOW} from '../objective-source/test/run-start-fixture.mjs';
import {createPostgresObjectiveRunStartStore} from '../objective-source/postgres-run-starts.mjs';
import {createObjectiveSelectionOwner} from './selection-owner.mjs';
import {createObjectiveGenerationRuntime} from '../../worker/conversation/objective-generation/runtime.mjs';
import {createObjectiveGenerationReadback} from './retained-result.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../control/conversations/usage.mjs';
import {executionIdentity} from '../../control/conversations/execution-boundary.mjs';
import {result} from '../../../packages/contracts/strategy-operations-candidate/fixture-source.mjs';
import {nativeFileSha256} from '../../../packages/contracts/runtime-0.2/files.mjs';
import {createNativeFileOwner} from '../artifacts/native-files-owner.mjs';
const check=()=>{};
async function fixture(t){t.mock.timers.enable({apis:['Date'],now:NOW});const o=runStartFixture(),scopes=[{tenantId:o.tenantId,kind:'client',resourceId:o.clientId,policyRevision:'policy1'}];
 const state={now:NOW,gets:0,objects:new Map(),suppressed:false,afterGet:null},f=await lifecycleFixture({binding:o.binding,scopes,selectedClientId:o.clientId,retention:{async assertServable(){if(state.suppressed)throw Error('suppressed');}}});t.after(f.close);
 Object.assign(f.input,{requestId:o.acceptedRequest.requestId,prompt:o.acceptedRequest.prompt});await f.running();await f.capture();
 const pg=syntheticObjectivePool(),runStarts=createPostgresObjectiveRunStartStore({enabled:true,pool:pg.pool,now:()=>state.now});await runStarts.putOnce({record:o.record});
 const selection=createObjectiveSelectionOwner({runStarts,store:{read:f.store.read,readModelPolicy:async()=>({maxTurns:20})},now:()=>state.now});
 const execution={async authenticate({binding}){const saved=await f.store.executions.read(binding,check);return {execution:executionIdentity(saved.record),versions,state:saved.run.state,scopes:saved.run.scopes,selectedClientId:o.clientId,policyRevision:saved.run.policyRevision};}};
 const objects={async put(v){const object={objectId:v.objectId,versionId:'synthetic-version',bytes:v.bytes.length,sha256:nativeFileSha256(v.bytes),scopes:v.scopes};state.objects.set(object.objectId,Buffer.from(v.bytes));return object;},async get(object){state.gets++;await state.afterGet?.();return state.objects.get(object.objectId);}};
 const owner=createNativeFileOwner({store:f.store,execution,objects,snapshot:{async readFiles(){throw Error('unused');}},objectiveSelection:selection,now:()=>state.now});
 let bytes;const runtime=createObjectiveGenerationRuntime({selection,now:()=>state.now,writeFile:async v=>{bytes=Buffer.from(v.bytes);}}),prepared=await runtime.prepare({binding:o.binding,request:o.acceptedRequest,versions,scopes,cwd:'/synthetic',model:SDK_MODEL_CONFIGURATION.model,deadlineMs:NOW+30000});
 const sdk={type:'result',subtype:'success',is_error:false,session_id:id(223),structured_output:{operation:'strategy.draft',state:'succeeded',payload:result(o.selection.request).payload,issues:[]}},typedResult=await prepared.capture({sdkResult:sdk});
 const request={binding:o.binding,sessionId:sdk.session_id,typedResult,files:[{path:typedResult.path,executable:false,bytes:bytes.length,sha256:nativeFileSha256(bytes),base64:bytes.toString('base64')}],taskFiles:[]};
 const retention={async assertServable(){if(state.suppressed)throw Error('suppressed');}},reader=createObjectiveGenerationReadback({runStarts,store:f.store,objects,retention,now:()=>state.now});
 const input={schemaVersion:1,generationJobId:o.generationJobId,sourceAdmissionSha256:o.record.sourceAdmissionSha256};
 async function complete(){await owner.complete({credential:'synthetic-execution',request});}
 return {o,f,pg,state,runStarts,objects,retention,reader,input,bytes,request,complete,settle:()=>settleInvocation(f.store,o.binding)};
}
test('acceptance returns the actual immutable job, five-field request and canonical run; no issuance is synthesized',async t=>{
 const x=await fixture(t),r=await x.reader.acceptance(x.input);assert.deepEqual(r.record,x.o.record);assert.deepEqual(r.request,x.o.acceptedRequest);assert.deepEqual(r.run.binding,x.o.binding);assert.equal(x.state.gets,0);
 assert.equal(Object.hasOwn(r,'issuance'),false);assert.equal(r.record.binding.actorId,r.record.selection.sourceAdmission.actorUserId);assert.notEqual(r.record.binding.actorId,r.record.selection.sourceAdmission.clerkUserId);
});
test('completion returns actual committed native proof and exact typed bytes only after SDK settlement',async t=>{
 const x=await fixture(t),input={...x.input,binding:x.o.binding};await x.complete();
 await assert.rejects(x.reader.completion(input));assert.equal(x.state.gets,0);
 await x.settle();const r=await x.reader.completion(input);assert.equal(r.completion.kind,'native-session');assert.equal(r.completion.completionId,x.o.binding.runId);
 assert.deepEqual(Buffer.from(r.file.base64,'base64'),x.bytes);assert.equal(r.file.object.sha256,nativeFileSha256(x.bytes));assert.equal(x.f.state.checkpoints.size,0);
 x.state.now=x.o.record.effectExpiresAtMs+1;assert.deepEqual(await x.reader.completion(input),r,'retained read does not renew or require the expired compute/effect window');
});
for(const change of ['foreign-job','foreign-binding','wrong-admission','supplied-locator','unknown-start','changed-request','suppressed','missing-object','wrong-bytes','suppressed-during-object'])test('readback refuses '+change,async t=>{
 const x=await fixture(t),input={...x.input,binding:x.o.binding};await x.complete();await x.settle();
 if(change==='foreign-job')input.generationJobId=id(99);if(change==='foreign-binding')input.binding={...input.binding,actorId:id(99)};
 if(change==='wrong-admission')input.sourceAdmissionSha256='0'.repeat(64);if(change==='supplied-locator')input.object={objectId:id(99)};
 if(change==='unknown-start'){x.runStarts=Object.freeze({...x.runStarts,readByJob:async()=>({state:'UNKNOWN'})});x.reader=createObjectiveGenerationReadback({runStarts:x.runStarts,store:x.f.store,objects:x.objects,retention:x.retention,now:()=>NOW});}
 if(change==='changed-request'){const read=x.f.store.read;const store={...x.f.store,async read(...args){const r=await read(...args);return {...r,request:{...r.request,prompt:'substituted'}};}};x.reader=createObjectiveGenerationReadback({runStarts:x.runStarts,store,objects:x.objects,retention:x.retention,now:()=>NOW});}
 if(change==='suppressed')x.state.suppressed=true;if(change==='missing-object')x.state.objects.clear();
 if(change==='wrong-bytes')for(const key of x.state.objects.keys())x.state.objects.set(key,Buffer.from('changed'));
 if(change==='suppressed-during-object')x.state.afterGet=()=>{x.state.suppressed=true;};
 await assert.rejects(x.reader.completion(input));
});