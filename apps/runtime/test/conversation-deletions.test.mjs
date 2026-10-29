/** Mounted product/history routes and real Core transport. Remote authority is
 * synthetic; PostgreSQL identity and receipt scrub have separate Core tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreConversationManagement} from '../native-authority/conversation-management.mjs';
import {createConversationHistoryService} from '../../control/conversations/history/service.mjs';
import {createConversationHistoryApplication} from '../../control/conversations/history/http.mjs';
import {ProductError} from '../../control/product-access/errors.mjs';
import {MANAGEMENT_VERSION} from '../../../packages/contracts/conversation-history/protocol.mjs';
import {receiveConversationHistoryRequest,receiveConversationHistoryResponse} from '../../../packages/contracts/dist/conversation-history.mjs';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const reference={requestId:id(3),conversationId:id(4),revision:'1',createdAt:'2026-09-01T00:00:00.000Z',restoreUntil:'2026-10-01T00:00:00.000Z'};
function fixture(){
 const principal={tenantId:id(1),actorId:id(2),clientIds:[],membershipRevision:'m1'},state={calls:[],revoked:false,change:false,stale:false,privateField:false,proof:true},now=Date.now;
 const management=createCoreConversationManagement({origin:'https://core.synthetic.invalid',getServiceSecret:async()=>'service',policyRevision:'p',now,maxRequestMs:1000,
  async fetchImpl(url,init){
   assert.equal(init.headers.authorization,'Bearer native');assert.equal(init.headers['x-internal-service-secret'],'service');const path=new URL(url).pathname;state.calls.push(path);
   return Response.json(path.endsWith('/list')?{version:MANAGEMENT_VERSION,requests:[reference],olderRequestsUnavailable:false,nextBefore:null}:
    {version:MANAGEMENT_VERSION,...reference,metadataState:state.change?'superseded':'absent',checkedAtMs:now()-(state.stale?6000:0),...(state.privateField?{title:'private'}:{})});
  }});
 const gate={async admit(){return {principal,expiresAtMs:now()+10000};},async recheck(){if(state.revoked)throw new ProductError('MEMBERSHIP_REVOKED');state.onRecheck?.();}};
 const deletionStatus={async withStatus({principal:p,reference:r},publish){assert.equal(p,principal);assert.equal(r.requestId,reference.requestId);state.onStatus?.();
  return publish({state:'completed',reasons:[],checkedAtMs:now(),retainedSharedCopies:false},async()=>{if(!state.proof)throw Error('restore during release');});}};
 const store={history:{list(){throw Error('no content read');},transcript(){throw Error('no content read');}}};
 const service=createConversationHistoryService({store,gate,deletionStatus}),app=createConversationHistoryApplication({service,gate,management,currentness:{assertCurrent(){throw Error('no content grant');}},now,limits:{maxRequestMs:2000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const post=async(route,body)=>{const req=receiveConversationHistoryRequest(route,new TextEncoder().encode(JSON.stringify(body))),path=route==='deletions'?'list':'status';
  const r=await app.handle(new Request('https://meri.invalid/api/conversations/deletions/'+path,{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:JSON.stringify(body)}));
  const value=await receiveConversationHistoryResponse(route,r.status,new Uint8Array(await r.arrayBuffer()),req);return {status:r.status,value};};
 return {state,post};
}
test('mounted deletion list/status work after content removal and after client access withdrawal',async()=>{
 const f=fixture();
 assert.equal((await f.post('deletions',{version:MANAGEMENT_VERSION,before:null})).status,200);
 const r=await f.post('deletionStatus',{version:MANAGEMENT_VERSION,requestId:reference.requestId});
 assert.equal(r.status,200);assert.equal(r.value.state,'completed');assert.equal('metadataState'in r.value,false);
 assert.deepEqual(f.state.calls,['/api/clio/conversations/management/deletions/list','/api/clio/conversations/management/deletions/read','/api/clio/conversations/management/deletions/read']);
});
test('revoked membership, superseded request, changed retention proof and bad Core readbacks cannot release completion',async()=>{
 for(const change of [s=>{s.onStatus=()=>{s.revoked=true;};},s=>{s.onStatus=()=>{s.change=true;};},s=>{s.onRecheck=()=>{s.proof=false;};},s=>{s.stale=true;},s=>{s.privateField=true;}]){
  const f=fixture();change(f.state);const r=await f.post('deletionStatus',{version:MANAGEMENT_VERSION,requestId:reference.requestId});assert.notEqual(r.status,200);assert.ok('error'in r.value);
 }
});
