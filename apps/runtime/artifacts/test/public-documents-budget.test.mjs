/** The public `/api/documents/*` routes keep control's request budget (25 s in preview, behind the frontend proxy's 30 s) even
 * though the artifact authority's ceiling and the conversation document preparation now allow DOCUMENT_PREPARATION_MS. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeArtifactApplication} from '../application.mjs';
import {DOCUMENT_PREPARATION_MS} from '../../../../packages/runtime/runner-load-budget.mjs';

const NOW=1_000_000,REQUEST_MS=25000;
function route(intent,body={}){
 const text=JSON.stringify(body);
 return new Request('https://meri-control.internal/api/documents/'+intent,{method:'POST',body:text,
  headers:{authorization:'Bearer synthetic-session','content-type':'application/json','content-length':String(Buffer.byteLength(text))}});
}
function app(){
 const seen=[];
 const optionsOwner={async resolve(call){seen.push(call.deadlineMs);return null;}};
 return {seen,app:createRuntimeArtifactApplication({sessions:{},optionsOwner,now:()=>NOW,limits:{maxRequestMs:REQUEST_MS,maxRequestBytes:65536,maxResponseBytes:262144}})};
}

test('a public document route is clipped at control\'s request budget, not the document preparation allowance',async()=>{
 assert.ok(DOCUMENT_PREPARATION_MS>REQUEST_MS);
 for(const intent of ['create','revise','list']){
  const a=app(),response=await a.app.handle(route(intent,{deliveryId:'d'}));
  assert.equal(response.status,503);assert.deepEqual(a.seen,[NOW+REQUEST_MS]);
 }
 // A trusted caller asking for the longer allowance on the same application is still clipped by its own budget.
 const a=app();await a.app.handle(route('create',{deliveryId:'d'}),{deadlineMs:NOW+DOCUMENT_PREPARATION_MS});
 assert.deepEqual(a.seen,[NOW+REQUEST_MS]);
});
