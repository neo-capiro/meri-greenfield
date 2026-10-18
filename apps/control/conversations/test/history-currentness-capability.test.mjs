/** A Core-only history owner may never receive the retention session's scheduled-origin read capability. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationHistoryService} from '../history/service.mjs';
import {createConversationHistoryApplication} from '../history/http.mjs';

test('Core currentness receives only its request value during final fenced release',async()=>{
 const now=Date.now,principal={tenantId:'tenant-a',actorId:'actor-a'};
 const conversation={conversationId:'11111111-1111-4111-8111-111111111111',scopes:[{tenantId:'tenant-a',kind:'client',resourceId:'22222222-2222-4222-8222-222222222222',policyRevision:'p1'}]};
 const gate={async admit(){return {principal,expiresAtMs:now()+10000};},async recheck(){return principal;}};
 let releaseReads=0,coreCalls=0;
 const retention={async assertServable(){},withRelease(_subjects,release){return release(undefined,async()=>{},async()=>{releaseReads++;return [];});}};
 const store={history:{async list(){return {conversations:[conversation],hasMore:false,nextCursor:null};},async transcript(){throw Error('unused');}}};
 const service=createConversationHistoryService({store,gate,retention});
 const currentness={async assertCurrent(call){assert.equal(arguments.length,1);assert.equal(call.conversationId,conversation.conversationId);coreCalls++;}};
 const app=createConversationHistoryApplication({service,gate,currentness,now,limits:{maxRequestMs:1000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const response=await app.handle(new Request('https://meri.invalid/api/conversations/list',{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:'{}'}));
 assert.equal(response.status,200);assert.equal(coreCalls,2);assert.equal(releaseReads,0);
 assert.deepEqual((await response.json()).conversations.map(c=>c.conversationId),[conversation.conversationId]);
});
