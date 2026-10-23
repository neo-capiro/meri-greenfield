/** Core calls behind one history list, through the actual product HTTP owner, history service and Core currentness client.
 * Live 2026-10-20 a page load paid two full currentness passes (identity + context per saved conversation, serially). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationHistoryService} from '../history/service.mjs';
import {createConversationHistoryApplication} from '../history/http.mjs';
import {createCoreConversationCurrentness} from '../../../runtime/native-authority/conversation-currentness.mjs';


const clientId='22222222-2222-4222-8222-222222222222',rows=20;
const principal={tenantId:'tenant',actorId:'actor',role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:'b'.repeat(64)};
const conversationIdOf=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
function fixture({refuse,status=403,drift=false}={}){
 const now=Date.now,core={current:0,identity:0,context:0,inFlight:0,peak:0,calls:[]};let admitted=principal;
 const currentness=createCoreConversationCurrentness({origin:'https://core.synthetic.invalid',selectedClientId:clientId,now,limits:{maxRequestMs:1000,maxFactBytes:131072},async fetchImpl(url,init){
  const path=new URL(url).pathname,body=JSON.parse(init.body);assert.equal(path,'/api/clio/application-authority/current');core.current++;core.calls.push({body,credential:init.headers.authorization});core.inFlight++;core.peak=Math.max(core.peak,core.inFlight);
  try{await new Promise(resolve=>setTimeout(resolve,5));
   const identity={principal:{tenantId:admitted.tenantId,actorId:admitted.actorId},role:'standard_user',permissions:[],clientIds:[clientId],identityRevision:'a'.repeat(64),membershipRevision:(drift?'d':'b').repeat(64),contextRevision:'c'.repeat(64),checkedAtMs:now(),expiresAtMs:now()+5000};
   if(body.conversationId===refuse)return Response.json({error:'refused'},{status});
   return Response.json({...identity,conversationId:body.conversationId,selectedClientId:clientId});
  }finally{core.inFlight--;}
 }});
 const conversations=Array.from({length:rows},(_,n)=>({conversationId:conversationIdOf(n),scopes:[{tenantId:'tenant',kind:'client',resourceId:clientId,policyRevision:'p1'}]}));
 const gate={async admit({credential}){admitted=credential==='other'?{...principal,actorId:'other'}:principal;return {principal:admitted,expiresAtMs:now()+10000};},async recheck(){return admitted;}};
 const store={history:{async list(){return {conversations,hasMore:false,nextCursor:null};},async transcript(){return {conversation:conversations[0],turns:[],events:[]};}}};
 const app=createConversationHistoryApplication({service:createConversationHistoryService({store,gate}),gate,currentness,now,limits:{maxRequestMs:2000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const post=(path,body={},credential='native')=>app.handle(new Request('https://meri.invalid/api/conversations/'+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {core,list:(credential)=>post('list',{},credential),transcript:()=>post('transcript',{conversationId:conversationIdOf(0)})};
}

test('a 20-conversation history list makes one currentness read per row, at most four at once',async()=>{
 const f=fixture(),response=await f.list();
 assert.equal(response.status,200);assert.equal((await response.json()).conversations.length,rows);
 // Before: two passes of identity + context per row, serially (80 Core calls, peak 1).
 assert.deepEqual([f.core.current,f.core.identity,f.core.context],[rows,0,0],'one fresh combined current per row');
 assert.deepEqual(f.core.calls.map(c=>c.body.conversationId).sort(),Array.from({length:rows},(_,n)=>conversationIdOf(n)).sort());
 assert.ok(f.core.peak<=4&&f.core.peak>1,`bounded concurrent Core reads (peak ${f.core.peak})`);
});

test('one archived row still withholds the whole page, and no started Core read outlives the response',async()=>{
 const f=fixture({refuse:conversationIdOf(5)}),response=await f.list();
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_UNAVAILABLE'}});
 assert.equal(f.core.inFlight,0,'every started read settled before the refusal');
 assert.ok(f.core.current<rows,'no further rows are started after the refusal');
});


test('O214 transcript checks current once inside final release and repeats fresh on every request',async()=>{
 const f=fixture();for(let n=1;n<=2;n++){const response=await f.transcript();assert.equal(response.status,200);assert.equal((await response.json()).conversation.conversationId,conversationIdOf(0));assert.equal(f.core.current,n);assert.equal(f.core.inFlight,0);}
 assert.ok(f.core.calls.every(c=>c.body.conversationId===conversationIdOf(0)&&c.body.expect.membershipRevision===principal.membershipRevision));
});
test('O214 unavailable503 and revision drift withhold whole history pages using the frozen unavailable envelope',async()=>{
 for(const options of [{refuse:conversationIdOf(5),status:503},{drift:true}]){const f=fixture(options),response=await f.list();assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_UNAVAILABLE'}});assert.equal(f.core.inFlight,0);}
});
test('O214 history never reuses positives across rows, requests or principals',async()=>{
 const f=fixture();for(const [index,credential] of ['native','native','other'].entries()){const response=await f.list(credential);assert.equal(response.status,200);assert.equal((await response.json()).conversations.length,rows);assert.equal(f.core.current,(index+1)*rows);}
 assert.equal(f.core.calls.filter(c=>c.credential==='Bearer other').length,rows);assert.ok(f.core.calls.every(c=>c.body.expect.membershipRevision===principal.membershipRevision));
});
