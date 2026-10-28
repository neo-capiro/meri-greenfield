/** Worker serialization boundary; current custody/source checks are exercised by upload activity and source tests. */
import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {binding,scopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
registerHooks({resolve(specifier,context,next){if(specifier==='./config.mjs'&&context.parentURL?.endsWith('/apps/runtime/worker-http.mjs'))return {url:new URL('../../control/conversations/test/load-only-runtime-config-stub.mjs',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
const {createWorkerRunApplication}=await import('../worker-http.mjs');
for(const suppressed of [false,true])test(`upload source ${suppressed?'suppression withholds':'serialization holds'} the final conversation serving fence`,async()=>{
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:'upload-source'},expiresAtMs:Date.now()+30000,runtimeSessionId:'synthetic-'+('a'.repeat(64))});
 let locked=false,serialized=0,releases=0,checks=0;
 const subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId};
 const app=createWorkerRunApplication({execution:{async authenticate(){checks++;return {execution:identity,scopes,selectedClientId:id(5),policyRevision:scopes[0].policyRevision};}},configuration:{retention:{enabled:true},limits:{requestMs:3000,requestBytes:2048}},
  createService(){return {async readUploadSource(){return {toJSON(){assert.equal(locked,true);serialized++;return {fragments:['scripted-current-extraction']};}};}};},
  retention:{async withRelease(subjects,release,{signal,deadlineMs}){assert.deepEqual(subjects,[subject]);assert.ok(deadlineMs>Date.now());releases++;locked=true;try{return await release(signal,async selected=>{assert.deepEqual(selected,subject);if(suppressed)throw Error('RETENTION_SUPPRESSED');});}finally{locked=false;}}},
 });
 const response=await app.handle(new Request('https://control.invalid/internal/conversations/upload-source',{method:'POST',headers:{authorization:'Bearer synthetic-execution','content-type':'application/json'},body:JSON.stringify({binding,input:{selection:{uploadId:id(701),sha256:'a'.repeat(64)},page:0}})}));
 assert.equal(response.status,suppressed?403:200);assert.equal(releases,1);assert.equal(checks,2);assert.equal(serialized,suppressed?0:1);if(suppressed)assert.doesNotMatch(await response.text(),/scripted-current-extraction/);else assert.equal(response.headers.get('cache-control'),'no-store');
});
