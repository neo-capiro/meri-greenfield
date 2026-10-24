import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerRunApplication} from '../worker-http.mjs';
import {binding,scopes,versions} from '../../control/conversations/test/store-fixture.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {ProductError} from '../../control/product-access/errors.mjs';
const input={binding,input:{usage:null,toolsUsed:{tools:[],omitted:0}}};
test('usage HTTP preserves only owned accounting uncertainty for idempotent retry; forged codes stay refused',async()=>{
 let error,calls=0;
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:'usage'},expiresAtMs:Date.now()+60000,runtimeSessionId:'usage-'+('a'.repeat(64))});
 const execution={async authenticate(input){assert.equal(input.credential,'synthetic-task');return {execution:identity,scopes,selectedClientId:scopes[0].resourceId,policyRevision:'policy1'};}};
 const app=createWorkerRunApplication({execution,createService:()=>({async recordUsage(input){assert.equal(input.credential,'synthetic-task');calls++;throw error;}}),configuration:{limits:{requestMs:1000,requestBytes:131072}}});
 const call=body=>app.handle(new Request('https://control.synthetic.invalid/internal/conversations/record-usage',{method:'POST',headers:{authorization:'Bearer synthetic-task','content-type':'application/json'},body:JSON.stringify(body)}));
 {
  for(const [failure,status,code] of [[new ProductError('SDK_USAGE_COMMIT_UNKNOWN','UNKNOWN'),503,'SDK_USAGE_COMMIT_UNKNOWN'],[new ProductError('SDK_USAGE_STORE_UNAVAILABLE','NOT_DISPATCHED'),503,'SDK_USAGE_STORE_UNAVAILABLE'],[Object.assign(Error('private diagnostic'),{code:'SDK_USAGE_COMMIT_UNKNOWN',outcome:'UNKNOWN'}),403,'WORKER_REQUEST_REFUSED'],[new ProductError('OTHER_OWNER_UNKNOWN','UNKNOWN'),403,'WORKER_REQUEST_REFUSED']]){
   error=failure;const response=await call(input);assert.equal(response.status,status);assert.equal((await response.json()).error.code,code);
  }
  assert.equal(calls,4);assert.equal((await call({...input,input:{...input.input,rawResult:'private'}})).status,403);assert.equal(calls,4);
 }
});
