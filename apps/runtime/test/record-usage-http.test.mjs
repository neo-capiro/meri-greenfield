import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerRunApplication} from '../worker-http.mjs';
import {applicationFixture,binding,scopes} from '../../control/conversations/test/application-fixture.mjs';
import {ProductError} from '../../control/product-access/errors.mjs';
const input={binding,input:{usage:null,toolsUsed:{tools:[],omitted:0}}};
test('usage HTTP preserves only owned accounting uncertainty for idempotent retry; forged codes stay refused',async()=>{
 const f=await applicationFixture();let error,calls=0;
 const native={async call(_operation,v){const now=Date.now();return {binding,operation:v.operation,inputSha256:v.inputSha256,identityCredential:'synthetic-existing-native',scopes,selectedClientId:scopes[0].resourceId,policyRevision:'policy1',authorizationDecisionId:'synthetic',checkedAtMs:now,expiresAtMs:now+1000};}};
 const app=createWorkerRunApplication({service:{async recordUsage(){calls++;throw error;}},sessions:f.sessions,native,configuration:{limits:{requestMs:1000,requestBytes:131072}}});
 const call=body=>app.handle(new Request('https://control.synthetic.invalid/internal/conversations/record-usage',{method:'POST',headers:{authorization:'Bearer synthetic-task','content-type':'application/json'},body:JSON.stringify(body)}));
 try{
  for(const [failure,status,code] of [[new ProductError('SDK_USAGE_COMMIT_UNKNOWN','UNKNOWN'),503,'SDK_USAGE_COMMIT_UNKNOWN'],[new ProductError('SDK_USAGE_STORE_UNAVAILABLE','NOT_DISPATCHED'),503,'SDK_USAGE_STORE_UNAVAILABLE'],[Object.assign(Error('private diagnostic'),{code:'SDK_USAGE_COMMIT_UNKNOWN',outcome:'UNKNOWN'}),403,'WORKER_REQUEST_REFUSED'],[new ProductError('OTHER_OWNER_UNKNOWN','UNKNOWN'),403,'WORKER_REQUEST_REFUSED']]){
   error=failure;const response=await call(input);assert.equal(response.status,status);assert.equal((await response.json()).error.code,code);
  }
  assert.equal(calls,4);assert.equal((await call({...input,input:{...input.input,rawResult:'private'}})).status,403);assert.equal(calls,4);
 }finally{f.close();}
});
