import test from 'node:test';import assert from 'node:assert/strict';
import {createUsageOverviewApplication} from '../http.mjs';
import {ProductError} from '../../../product-access/errors.mjs';
import {captureRuntimePorts,createRuntimeProductApplications} from '../../../../runtime/product-applications.mjs';
import {receiveUsageOverviewRequest,receiveUsageOverviewResponse,USAGE_OVERVIEW_PATH} from '@capiro/meri-contracts/conversation-usage';
import {principal,request,response,at} from './fixture.mjs';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
function fixture({runtime=false,omitStore=false,omitGate=false}={}){
 const state={principal:structuredClone(principal),reads:0,rechecks:0,revoked:false};
 const gate={async admit({credential}){if(credential!=='SYNTHETIC')throw new ProductError('UNAUTHENTICATED');return {principal:structuredClone(state.principal),expiresAtMs:at+2000};},async recheck({principal:p}){state.rechecks++;if(state.revoked)throw new ProductError('MEMBERSHIP_REVOKED');if(JSON.stringify(p)!==JSON.stringify(state.principal))throw new ProductError('MEMBERSHIP_CHANGED');}};
 const store={usageOverview:{async read({principal:p},check){assert.deepEqual(p,principal);state.reads++;check();state.afterRead?.();if(state.failure)throw state.failure;return state.value??response();}},history:{async list(){throw Error('no conversation inventory');},async transcript(){throw Error('no transcript');}}};
 const limits={maxRequestMs:1000,maxRequestBytes:4096,maxResponseBytes:131072};
 const app=runtime?createRuntimeProductApplications({configuration:{sourceEnabled:false,limits:{requestMs:1000,requestBytes:4096},native:{maxResponseBytes:131072}},sessions:{},ports:captureRuntimePorts({...(!omitGate?{conversationMembership:gate}:{}),conversationCurrentness:{async assertCurrent(){throw Error('no run/conversation needed');}}}),...(!omitStore?{conversationStore:store}:{}),now:()=>at})
  :createUsageOverviewApplication({store,gate,now:()=>at,limits});
 const read=(body=request,{method='POST',credential='SYNTHETIC'}={})=>app.handle(new Request('https://example.invalid'+USAGE_OVERVIEW_PATH,{method,headers:{authorization:'Bearer '+credential,'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})}));
 return {state,read};
}
test('cold native membership reaches the actual mounted tenant overview without a conversation, session or model',async()=>{
 for(const runtime of [false,true]){const f=fixture({runtime}),r=await f.read();assert.equal(r.status,200,await r.clone().text());const value=await r.json();
  assert.deepEqual(receiveUsageOverviewResponse(200,bytes(value),receiveUsageOverviewRequest(bytes(request))),response());assert.equal(f.state.reads,1);assert.equal(f.state.rechecks,1);assert.equal(r.headers.get('cache-control'),'no-store');}
});
test('uncomposed canonical membership or persistence keeps the public overview unavailable without breaking other mounts',async()=>{
 for(const options of [{omitStore:true},{omitGate:true},{omitStore:true,omitGate:true}]){const f=fixture({runtime:true,...options}),r=await f.read();assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:{code:'USAGE_OVERVIEW_UNAVAILABLE'}});assert.equal(f.state.reads,0);}
});
test('ordinary General member needs no selected client; browser tenant/actor/client selectors and invalid methods never read',async()=>{
 const f=fixture();for(const extra of [{tenantId:'forged'},{actorId:'forged'},{clientId:null},{runId:'forged'}])assert.equal((await f.read({...request,...extra})).status,400);
 assert.equal((await f.read(request,{method:'GET'})).status,405);assert.equal((await f.read(request,{credential:'foreign'})).status,401);assert.equal(f.state.reads,0);
});
test('membership revocation and tenant/actor/client changes after the aggregate read withhold every number',async()=>{
 for(const change of [s=>s.revoked=true,s=>s.principal.tenantId='foreign',s=>s.principal.actorId='foreign',s=>s.principal.clientIds=['foreign']]){
  const f=fixture();f.state.afterRead=()=>change(f.state);const r=await f.read();assert([403,409].includes(r.status));assert.equal(f.state.reads,1);assert.doesNotMatch(await r.text(),/knownCharge|periods|policy|queue/);
 }
});
test('corrupt numeric output and unavailable or uncertain reads have closed public failures, no partial facts',async()=>{
 const bad=fixture();bad.state.value=response();bad.state.value.periods[0].attempts++;assert.equal((await bad.read()).status,500);
 for(const failure of [new ProductError('USAGE_OVERVIEW_UNAVAILABLE'),new ProductError('USAGE_OVERVIEW_UNAVAILABLE','UNKNOWN')]){
  const f=fixture();f.state.failure=failure;const r=await f.read();assert.equal(r.status,503);const value=await r.json();
  assert.deepEqual(receiveUsageOverviewResponse(r.status,bytes(value),receiveUsageOverviewRequest(bytes(request))),value);assert.doesNotMatch(JSON.stringify(value),/periods|knownCharge/);
 }
});
