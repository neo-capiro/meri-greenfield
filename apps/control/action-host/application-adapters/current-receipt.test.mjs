import test from 'node:test';
import assert from 'node:assert/strict';
import {currentRequest,currentReceipt} from './current-receipt.mjs';
import {createCapiroApplicationAuthorityClient} from './authority-http.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,at=1000;
const receipt=(selectedClientId=null)=>({principal:{tenantId:'tenant',actorId:'actor'},role:'standard_user',permissions:[],clientIds:selectedClientId===null?[]:[selectedClientId],identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:id(1),selectedClientId,checkedAtMs:at,expiresAtMs:at+1000});
test('current wire preserves explicit General scope and empty client membership without inventing a client',()=>{
 assert.deepEqual(currentRequest({conversationId:id(1),clientId:null}),{conversationId:id(1),clientId:null});
 const actual=currentReceipt(receipt());assert.equal(actual.selectedClientId,null);assert.deepEqual(actual.clientIds,[]);assert.ok(Object.isFrozen(actual));
 assert.equal(currentReceipt(receipt(id(2))).selectedClientId,id(2));
});
test('current wire requires explicit selectors and retains client membership refusal',()=>{
 for(const clientId of [undefined,false,'','general',{},[]])assert.throws(()=>currentRequest({conversationId:id(1),clientId}));
 assert.throws(()=>currentRequest({conversationId:id(1)}));
 assert.throws(()=>currentReceipt({...receipt(id(2)),clientIds:[]}),error=>error.status===403);
 for(const change of [{selectedClientId:undefined},{selectedClientId:false},{role:'revoked'},{clientIds:[null]},{clientIds:[id(2),id(2)]},{permissions:['bad permission']},{contextRevision:'missing'},{expiresAtMs:at},{tenantOverride:'foreign'}])assert.throws(()=>currentReceipt({...receipt(),...change}));
 const missing=receipt();delete missing.selectedClientId;assert.throws(()=>currentReceipt(missing));
});
test('General current uses the same authenticated fixed HTTP route, expected revision and definitive Core refusals',async()=>{
 const calls=[];let answer=receipt(),status=200;
 const client=createCapiroApplicationAuthorityClient({origin:'https://core.invalid',enabled:true,now:()=>at,limits:{maxRequestMs:1000,maxResponseBytes:4096},fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(answer,{status});}});
 const input={credential:'actual-user-bearer',conversationId:id(1),clientId:null,expect:{contextRevision:'c'.repeat(64)},deadlineMs:at+1000};
 assert.deepEqual(await client.readCurrent(input),receipt());assert.equal(calls.length,1);
 assert.equal(String(calls[0].url),'https://core.invalid/api/clio/application-authority/current');
 assert.equal(new Headers(calls[0].options.headers).get('authorization'),'Bearer actual-user-bearer');
 assert.deepEqual(JSON.parse(calls[0].options.body),{conversationId:id(1),clientId:null,expect:input.expect});
 answer={...receipt(),contextRevision:'d'.repeat(64)};await assert.rejects(client.readCurrent(input));
 for(status of [401,403,409])await assert.rejects(client.readCurrent(input));
 const count=calls.length;await assert.rejects(client.readContext({credential:input.credential,identitySha256:'a'.repeat(64),conversationId:id(1),clientId:null,deadlineMs:at+1000}));assert.equal(calls.length,count,'the separately versioned context contract remains client-only');
});
