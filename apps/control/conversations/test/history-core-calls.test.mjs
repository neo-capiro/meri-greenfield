/** Core calls behind one history list, through the actual product HTTP owner, history service and Core currentness client.
 * Live 2026-10-20 a page load paid two full currentness passes (identity + context per saved conversation, serially). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationHistoryService} from '../history/service.mjs';
import {createConversationHistoryApplication} from '../history/http.mjs';
import {createCoreConversationCurrentness} from '../../../runtime/native-authority/conversation-currentness.mjs';
import {applicationAuthorityRoutes} from '../../../../packages/contracts/action-authority-0.2/validate.mjs';

const clientId='22222222-2222-4222-8222-222222222222',rows=20;
const principal={tenantId:'tenant',actorId:'actor',role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:'m1'};
const conversationIdOf=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
function fixture({refuse}={}){
 const now=Date.now,core={identity:0,context:0,inFlight:0,peak:0};
 const currentness=createCoreConversationCurrentness({origin:'https://core.synthetic.invalid',selectedClientId:clientId,now,limits:{maxRequestMs:1000,maxFactBytes:131072},async fetchImpl(url,init){
  const kind=url.endsWith(applicationAuthorityRoutes.identity)?'identity':'context',body=JSON.parse(init.body);core[kind]++;core.inFlight++;core.peak=Math.max(core.peak,core.inFlight);
  try{await new Promise(resolve=>setTimeout(resolve,5));
   const identity={principal:{tenantId:'tenant',actorId:'actor'},identityRevision:'native-r1',checkedAtMs:now(),expiresAtMs:now()+5000};
   if(kind==='context'&&body.conversationId===refuse)return Response.json({error:'archived'},{status:403});
   return Response.json(kind==='identity'?identity:{...identity,identitySha256:body.identitySha256,conversationId:body.conversationId,selectedClientId:clientId,contextRevision:'current-r1'});
  }finally{core.inFlight--;}
 }});
 const conversations=Array.from({length:rows},(_,n)=>({conversationId:conversationIdOf(n),scopes:[{tenantId:'tenant',kind:'client',resourceId:clientId,policyRevision:'p1'}]}));
 const gate={async admit(){return {principal,expiresAtMs:now()+10000};},async recheck(){return principal;}};
 const store={history:{async list(){return {conversations,hasMore:false,nextCursor:null};},async transcript(){throw Error('unused');}}};
 const app=createConversationHistoryApplication({service:createConversationHistoryService({store,gate}),gate,currentness,now,limits:{maxRequestMs:2000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const list=()=>app.handle(new Request('https://meri.invalid/api/conversations/list',{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:'{}'}));
 return {core,list};
}

test('a 20-conversation history list makes one currentness read per row, at most four at once',async()=>{
 const f=fixture(),response=await f.list();
 assert.equal(response.status,200);assert.equal((await response.json()).conversations.length,rows);
 // Before: two passes of identity + context per row, serially (80 Core calls, peak 1).
 assert.deepEqual([f.core.identity,f.core.context],[rows,rows],'one identity + context pair per row');
 assert.ok(f.core.peak<=4&&f.core.peak>1,`bounded concurrent Core reads (peak ${f.core.peak})`);
});

test('one archived row still withholds the whole page, and no started Core read outlives the response',async()=>{
 const f=fixture({refuse:conversationIdOf(5)}),response=await f.list();
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_UNAVAILABLE'}});
 assert.equal(f.core.inFlight,0,'every started read settled before the refusal');
 assert.ok(f.core.context<rows,'no further rows are started after the refusal');
});
