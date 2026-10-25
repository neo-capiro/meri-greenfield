/** Actual fixed Core transport and product/history HTTP composition; the remote
 * Core is a synthetic receiver. No membership or database proof is claimed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreConversationManagement} from '../native-authority/conversation-management.mjs';
import {createConversationHistoryService} from '../../control/conversations/history/service.mjs';
import {createConversationHistoryApplication} from '../../control/conversations/history/http.mjs';
import {MANAGEMENT_VERSION} from '../../../packages/contracts/conversation-history/protocol.mjs';
import {productFailure} from '../../control/product-access/errors.mjs';

const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const now=Date.now,principal={tenantId:id(1),actorId:id(2),clientIds:[id(3)],membershipRevision:'a'.repeat(64)};
const metadata=(n,status='active')=>({conversationId:id(n),title:`Chat ${n}`,status,revision:'0',scopeKind:'client',clientId:id(3),updatedAt:'2026-10-24T00:00:00.000Z',archivedAt:status==='archived'?'2026-10-24T00:00:00.000Z':null,trashedAt:null,restoreUntil:null});
const current=conversationId=>({principal:{tenantId:principal.tenantId,actorId:principal.actorId},role:'standard_user',permissions:[],clientIds:principal.clientIds,identityRevision:'a'.repeat(64),membershipRevision:'a'.repeat(64),contextRevision:'a'.repeat(64),checkedAtMs:now(),expiresAtMs:now()+5000,conversationId,selectedClientId:id(3)});
function fixture({reply,wait=0}={}){
 const calls=[];let inFlight=0,peak=0;
 const owner=createCoreConversationManagement({origin:'https://core.synthetic.invalid',getServiceSecret:async()=>'synthetic-service',policyRevision:'policy',now,maxRequestMs:1000,
  nativeCredentials:{nativeCredentialFor(){return {credential:'native',expiresAtMs:now()+10000};}},async fetchImpl(url,init){
   assert.equal(init.headers.authorization,'Bearer native');const path=new URL(url).pathname,body=JSON.parse(init.body);calls.push({path,body,headers:init.headers});inFlight++;peak=Math.max(peak,inFlight);
   try{if(wait)await new Promise(resolve=>setTimeout(resolve,wait));return reply?await reply(path,body,init):Response.json(path.endsWith('/current')?current(body.conversationId):metadata(Number(body.conversationId.slice(-12))));}finally{inFlight--;}
  }});
 const controller=new AbortController(),port=owner.forRequest({credential:'native',principal,signal:controller.signal,deadlineMs:now()+5000});
 return {owner,port,controller,calls,get inFlight(){return inFlight;},get peak(){return peak;}};
}
test('metadata is one fixed service+user authenticated call and cannot select a route or principal',async()=>{
 const f=fixture();assert.deepEqual(await f.port.metadata(id(10)),metadata(10));assert.deepEqual(f.calls[0].body,{version:MANAGEMENT_VERSION,conversationId:id(10)});
 assert.equal(f.calls[0].headers['x-internal-service-secret'],'synthetic-service');assert.equal(f.calls[0].path,'/api/clio/conversations/management/metadata');
 await assert.rejects(f.port.read({version:MANAGEMENT_VERSION,requestId:id(20),conversationId:id(10),expectedRevision:'0',operation:'archive',tenantId:id(50)}));assert.equal(f.calls.length,1);
});
test('metadata correlation, scope and private readback release identity are closed',async()=>{
 for(const changed of [{conversationId:id(11)},{clientId:id(40)},{status:'trashed'},{privateToken:'never'}]){
  const f=fixture({reply:()=>Response.json({...metadata(10),...changed})});await assert.rejects(f.port.metadata(id(10)));
 }
 const q={version:MANAGEMENT_VERSION,requestId:id(20),conversationId:id(10),expectedRevision:'0',operation:'restore'};
 const receipt={version:MANAGEMENT_VERSION,requestId:q.requestId,conversation:{...metadata(10),revision:'1'}};
 const result={version:MANAGEMENT_VERSION,requestId:q.requestId,current:receipt.conversation,receipt,releaseRetention:true,suppressionRequestId:id(19)};
 const valid=fixture({reply:()=>Response.json(result)});assert.equal((await valid.port.read(q)).suppressionRequestId,id(19));
 for(const change of [{suppressionRequestId:null},{releaseRetention:false},{current:{...metadata(10),revision:'2'}},{requestId:id(21)}]){
  const f=fixture({reply:()=>Response.json({...result,...change})});await assert.rejects(f.port.read(q));
 }
});
test('Core refusal and unavailable stay distinct; expired request closure makes no call',async()=>{
 for(const [status,code] of [[403,'ACCESS_DENIED'],[404,'CONVERSATION_NOT_FOUND'],[503,'CONVERSATION_UNAVAILABLE']]){
  const f=fixture({reply:()=>Response.json({error:'private upstream text'},{status})});await assert.rejects(f.port.metadata(id(10)),e=>productFailure(e)?.code===code);
 }
 const f=fixture();f.controller.abort();await assert.rejects(f.port.metadata(id(10)));assert.equal(f.calls.length,0);
});
test('empty-chat registration and locked admission use actual current ownership, never metadata alone',async()=>{
 const f=fixture(),registered=await f.port.registration(metadata(10));assert.deepEqual(registered.conversation.owner,{tenantId:principal.tenantId,actorId:principal.actorId});await registered.recheckActive();
 assert.equal(f.calls.length,2);assert.ok(f.calls.every(c=>c.path==='/api/clio/application-authority/current'));
 const other=fixture({reply:(_path,body)=>Response.json({...current(body.conversationId),principal:{tenantId:id(99),actorId:principal.actorId}})});await assert.rejects(other.port.registration(metadata(10)));
 await assert.rejects(f.port.registration(metadata(10,'archived')));assert.equal(f.calls.length,2);
});
function clockFixture(offset=0){
 const at=1800000000000,state={at,receipt: {...current(id(10)),checkedAtMs:at+offset,expiresAtMs:at+10000},calls:0};
 const binding={tenantId:principal.tenantId,actorId:principal.actorId,conversationId:id(10),runId:id(20),attemptId:id(21),workerId:id(22),writerFence:1};
 const scopes=[{tenantId:principal.tenantId,kind:'client',resourceId:id(3),policyRevision:'policy'}];
 const owner=createCoreConversationManagement({origin:'https://core.synthetic.invalid',getServiceSecret:async()=>'synthetic-service',policyRevision:'policy',now:()=>state.at,maxRequestMs:1000,
  nativeCredentials:{nativeCredentialFor(){return {credential:'native',expiresAtMs:at+20000};}},fetchImpl:async()=>{state.calls++;return Response.json(state.receipt);}});
 return {state,port:(deadlineMs=state.at+1000)=>owner.forRequest({credential:'native',principal,deadlineMs}),assertActive:()=>owner.assertActiveBinding({binding,scopes,selectedClientId:id(3)})};
}
for(const offset of [-5000,-1000,0,1000,5000])test(`fresh management receipt accepts ${offset}ms host clock offset without changing expiry`,async()=>{
 const f=clockFixture(offset),registered=await f.port().registration(metadata(10));await registered.recheckActive();await f.assertActive();assert.equal(f.state.calls,3);
});
test('management receipt clock tolerance rejects outside bounds, expiry, later replay and wrong principal',async()=>{
 for(const offset of [-5001,5001]){const f=clockFixture(offset);await assert.rejects(f.port().registration(metadata(10)));await assert.rejects(f.assertActive());}
 for(const change of [{checkedAtMs:1800000000000-1,expiresAtMs:1800000000000},{principal:{tenantId:id(99),actorId:principal.actorId}}]){
  const f=clockFixture();Object.assign(f.state.receipt,change);await assert.rejects(f.port().registration(metadata(10)));await assert.rejects(f.assertActive());
 }
 const f=clockFixture();await f.assertActive();f.state.at+=5001;await assert.rejects(f.port().registration(metadata(10)));await assert.rejects(f.assertActive());
 const expired=clockFixture(5000);await assert.rejects(expired.port(expired.state.at).registration(metadata(10)));assert.equal(expired.state.calls,0,'clock tolerance cannot extend the local request deadline');
});
function history(options={}){
 const f=fixture(options),rows=[10,11,12].map(n=>({conversationId:id(n),scopes:[{tenantId:principal.tenantId,kind:'client',resourceId:id(3),policyRevision:'policy'}]}));
 const gate={async admit(){return {principal,expiresAtMs:now()+10000};},async recheck(){return principal;}};
 const store={history:{async list(){return {conversations:rows,nextBefore:null};},async transcript(){return {conversation:rows[0]};}}};
 const service=createConversationHistoryService({store,gate}),app=createConversationHistoryApplication({service,gate,management:f.owner,currentness:{assertCurrent(){throw Error('ordinary metadata must not be followed by active-only current');}},now,limits:{maxRequestMs:2000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const post=(route,body)=>app.handle(new Request('https://meri.invalid/api/conversations/'+route,{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:JSON.stringify(body)}));
 return {...f,post};
}
test('an explicitly owned archived row is omitted from Recents while its read-only transcript remains readable',async()=>{
 const f=history({reply:(_path,b)=>Response.json(metadata(Number(b.conversationId.slice(-12)),b.conversationId===id(10)?'archived':'active'))});
 const list=await f.post('list',{});assert.equal(list.status,200);assert.deepEqual((await list.json()).conversations.map(c=>c.conversationId),[id(11),id(12)]);
 const transcript=await f.post('transcript',{conversationId:id(10)});assert.equal(transcript.status,200);assert.equal((await transcript.json()).conversation.conversationId,id(10));
});
test('revoked, missing and unavailable rows never become silent archive omissions',async()=>{
 for(const status of [403,404,503]){
  const f=history({reply:(_path,b)=>b.conversationId===id(11)?Response.json({error:'private'},{status}):Response.json(metadata(Number(b.conversationId.slice(-12))))});
  const response=await f.post('list',{});assert.equal(response.status,status);assert.ok((await response.json()).error);assert.equal(f.calls.length,3);
 }
});
