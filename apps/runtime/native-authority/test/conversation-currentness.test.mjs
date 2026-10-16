import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreConversationCurrentness} from '../conversation-currentness.mjs';
import {productFailure} from '../../../control/product-access/errors.mjs';
import {applicationAuthorityRoutes} from '../../../../packages/contracts/action-authority-0.2/validate.mjs';

const conversationId='11111111-1111-4111-8111-111111111111',clientId='22222222-2222-4222-8222-222222222222',otherClientId='33333333-3333-4333-8333-333333333333',at=1760000000000;
const principal=Object.freeze({tenantId:'tenant',actorId:'actor',role:'standard_user',permissions:[],clientIds:[clientId,otherClientId],membershipRevision:'m1'});
const scope=resourceId=>({tenantId:'tenant',kind:'client',resourceId,policyRevision:'p1'});
function fixture(change=()=>undefined){
 const calls=[],identity={principal:{tenantId:'tenant',actorId:'actor'},identityRevision:'native-r1',checkedAtMs:at,expiresAtMs:at+5000};
 const owner=createCoreConversationCurrentness({origin:'https://core.synthetic.invalid',selectedClientId:clientId,now:()=>at,limits:{maxRequestMs:1000,maxFactBytes:131072},async fetchImpl(url,init){
  calls.push({url,init});const body=JSON.parse(init.body),kind=url.endsWith(applicationAuthorityRoutes.identity)?'identity':'context';
  const value=kind==='identity'?identity:{...identity,identitySha256:body.identitySha256,conversationId,selectedClientId:clientId,contextRevision:'current-r1'};
  return change(kind,value)??Response.json(value);
 }});
 return {owner,calls,call:{credential:'synthetic-native-bearer',principal,conversationId,scopes:[scope(otherClientId),{tenantId:'tenant',kind:'tenant',resourceId:'tenant',policyRevision:'p1'},scope(clientId)],deadlineMs:at+1000}};
}
const unavailable=error=>productFailure(error)?.code==='CONVERSATION_UNAVAILABLE';

test('multi-client and tenant-scoped saved currentness reads configured Core context using the request bearer only',async()=>{
 const f=fixture();await f.owner.assertCurrent(f.call);
 assert.deepEqual(f.calls.map(c=>new URL(c.url).pathname),[applicationAuthorityRoutes.identity,applicationAuthorityRoutes.context]);
 assert.ok(f.calls.every(c=>c.init.headers.authorization==='Bearer synthetic-native-bearer'&&c.init.method==='POST'&&c.init.cache==='no-store'));
 const contextRequest=JSON.parse(f.calls[1].init.body);
 assert.deepEqual(Object.keys(contextRequest).sort(),['clientId','conversationId','identitySha256']);
 assert.match(contextRequest.identitySha256,/^[a-f0-9]{64}$/u);
 assert.equal(contextRequest.conversationId,conversationId);assert.equal(contextRequest.clientId,clientId);
});
test('foreign membership scope and foreign native identity refuse before Core context',async()=>{
 const scope=fixture();await assert.rejects(scope.owner.assertCurrent({...scope.call,principal:{...principal,clientIds:[]}}),unavailable);assert.equal(scope.calls.length,0);
 const missing=fixture();await assert.rejects(missing.owner.assertCurrent({...missing.call,scopes:[{...missing.call.scopes[0]}]}),unavailable);assert.equal(missing.calls.length,0);
 const foreign=fixture((kind,value)=>kind==='identity'?Response.json({...value,principal:{tenantId:'other',actorId:'actor'}}):undefined);
 await assert.rejects(foreign.owner.assertCurrent(foreign.call),unavailable);assert.equal(foreign.calls.length,1);
});
test('archived and unavailable Core context both withhold the saved conversation',async()=>{
 for(const status of [403,503]){const f=fixture(kind=>kind==='context'?new Response('',{status}):undefined);
  await assert.rejects(f.owner.assertCurrent(f.call),unavailable);assert.equal(f.calls.length,2);}
});
test('changed native context identity or client never validates the saved conversation',async()=>{
 for(const delta of [{identityRevision:'different'}, {selectedClientId:otherClientId}, {conversationId:'44444444-4444-4444-8444-444444444444'}]){
  const f=fixture((kind,value)=>kind==='context'?Response.json({...value,...delta}):undefined);
  await assert.rejects(f.owner.assertCurrent(f.call),unavailable);
 }
});
