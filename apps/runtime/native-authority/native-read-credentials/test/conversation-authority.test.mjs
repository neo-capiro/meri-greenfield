/** Actual fixed identity/context HTTP JSON over the private native conversation reader. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createNativeToolAuthorityClient} from '../core-client.mjs';
import {assertNativeConversationAuthority} from '../conversation-authority.mjs';

const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const origin='https://native-core.example.invalid',conversationId=uuid('1'),clientId=uuid('2');
const identityPath='/api/clio/application-authority/identity',contextPath='/api/clio/application-authority/context';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){
 const state={now:1800000000000,calls:[],receipts:[],advance:0,identityRevision:'a'.repeat(64),contextRevision:'native-context-opaque-v1'},now=()=>state.now;
 const principal={tenantId:uuid('b'),actorId:uuid('c')};
 const configuration={origin,now,enabled:true,maxRequestMs:3000,async fetchImpl(url,init){
  const path=new URL(url).pathname,body=JSON.parse(init.body);state.calls.push({url,init,path,body});state.now+=state.advance;
  assert.ok([identityPath,contextPath].includes(path),'No membership, profile, new authority or source fallback');
  let value={principal:structuredClone(principal),identityRevision:state.identityRevision,checkedAtMs:now(),expiresAtMs:now()+60000};
  if(path===contextPath)value={...value,identitySha256:body.identitySha256,conversationId:body.conversationId,selectedClientId:body.clientId,contextRevision:state.contextRevision};
  state.mutate?.(value,path,state.calls.length);state.receipts.push(structuredClone(value));
  return state.response?state.response(value,path,init):Response.json(value);
 },...options};
 const client=createNativeToolAuthorityClient(configuration),request=()=>({credential:'SYNTHETIC_NATIVE',conversationId,clientId,deadlineMs:now()+10000});
 return {state,now,principal,configuration,client,request};
}

test('actual identity/context/identity binds the fresh full identity hash and preserves native selectors/revision',async()=>{
 const f=fixture();f.state.advance=7;const initial=f.now(),request=f.request(),out=await f.client.readConversation(request);
 assert.deepEqual(f.state.calls.map(call=>call.path),[identityPath,contextPath,identityPath]);
 assert.deepEqual(f.state.calls.map(call=>call.body),[{}, {identitySha256:hash(f.state.receipts[0]),conversationId,clientId},{}]);
 assert.deepEqual(out,{principal:f.principal,identityRevision:'a'.repeat(64),conversationId,selectedClientId:clientId,contextRevision:'native-context-opaque-v1',checkedAtMs:initial+7,expiresAtMs:request.deadlineMs});
 assert.equal(Object.hasOwn(out,'identitySha256'),false);assert.equal(Object.hasOwn(out,'credential'),false);assert.ok(Object.isFrozen(out));assert.ok(Object.isFrozen(out.principal));
 for(const {url,init} of f.state.calls){
  assert.equal(new URL(url).origin,origin);assert.equal(init.method,'POST');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
  assert.deepEqual(init.headers,{authorization:'Bearer SYNTHETIC_NATIVE','content-type':'application/json',accept:'application/json'});assert.equal(init.signal.aborted,true);
 }
 // No greenfield run/conversation binding is accepted by this API; the explicit Core UUID is preserved.
 assert.equal(out.conversationId,conversationId);assert.notEqual(out.conversationId,uuid('9'));
});

for(const [label,stage] of [['first identity',1],['native context',2],['last identity',3]])test(`shortest ${label} expiry bounds the entire observation`,async()=>{
 const f=fixture(),short=f.now()+100;f.state.mutate=(r,p,n)=>{if(n===stage)r.expiresAtMs=short;};
 assert.equal((await f.client.readConversation(f.request())).expiresAtMs,short);
});
test('caller authority expiry cannot be widened by longer native receipts',async()=>{
 const f=fixture({maxRequestMs:1234}),at=f.now();assert.equal((await f.client.readConversation(f.request())).expiresAtMs,at+10000);
 assert.equal((await f.client.readConversation({...f.request(),deadlineMs:at+400})).expiresAtMs,at+400);
});
test('network acquisition timeout does not shorten actual authority validity or extend the first native expiry',async()=>{
 const f=fixture({maxRequestMs:1000}),at=f.now();
 f.state.mutate=(r,p,n)=>r.expiresAtMs=at+4000+n*1000;
 const out=await f.client.readConversation(f.request());
 assert.equal(out.expiresAtMs,at+5000);assert.ok(out.expiresAtMs>at+f.configuration.maxRequestMs);
 assert.deepEqual(f.state.receipts.map(r=>r.expiresAtMs),[at+5000,at+6000,at+7000]);
});

for(const [label,mutate] of [
 ['tenant',r=>r.principal.tenantId=uuid('d')],['actor',r=>r.principal.actorId=uuid('d')],
 ['identity revision',r=>r.identityRevision='d'.repeat(64)],['identity hash',r=>r.identitySha256='d'.repeat(64)],
 ['conversation',r=>r.conversationId=uuid('d')],['client',r=>r.selectedClientId=uuid('d')],
 ['stale time',r=>r.checkedAtMs--],['future time',r=>r.checkedAtMs++],['expired',r=>r.expiresAtMs=r.checkedAtMs],
 ['empty context revision',r=>r.contextRevision=''],['long context revision',r=>r.contextRevision='x'.repeat(257)],
 ['nontext context revision',r=>r.contextRevision=42],['extra data',r=>r.privateClientName='PRIVATE'],
])test(`context ${label} substitution refuses without another identity or fallback`,async()=>{
 const f=fixture();f.state.mutate=(r,path)=>{if(path===contextPath)mutate(r);};await assert.rejects(f.client.readConversation(f.request()));assert.equal(f.state.calls.length,2);
});

for(const [label,mutate] of [
 ['foreign actor',r=>r.principal.actorId=uuid('d')],['foreign tenant',r=>r.principal.tenantId=uuid('d')],['new revision',r=>r.identityRevision='d'.repeat(64)],
 ['stale',r=>r.checkedAtMs--],['future',r=>r.checkedAtMs++],['expired',r=>r.expiresAtMs=r.checkedAtMs],
])test(`final identity ${label} change withholds the conversation observation`,async()=>{
 const f=fixture();f.state.mutate=(r,p,n)=>{if(n===3)mutate(r);};await assert.rejects(f.client.readConversation(f.request()));assert.equal(f.state.calls.length,3);
});

for(const [label,mutate] of [
 ['noncanonical principal',r=>r.principal.actorId='clerk_actor'],['invalid revision',r=>r.identityRevision='opaque-identity'],
 ['unexpected field',r=>r.contextRevision='extra'],['stale',r=>r.checkedAtMs--],['future',r=>r.checkedAtMs++],['expired',r=>r.expiresAtMs=r.checkedAtMs],
])test(`first identity ${label} refuses before context`,async()=>{
 const f=fixture();f.state.mutate=(r,p,n)=>{if(n===1)mutate(r);};await assert.rejects(f.client.readConversation(f.request()));assert.equal(f.state.calls.length,1);
});

test('identical revisions still use each invocation fresh full identity receipt rather than cached or aggregate facts',async()=>{
 const f=fixture();await f.client.readConversation(f.request());f.state.now+=50;await f.client.readConversation(f.request());
 const contexts=f.state.calls.filter(call=>call.path===contextPath);
 assert.equal(contexts[0].body.identitySha256,hash(f.state.receipts[0]));assert.equal(contexts[1].body.identitySha256,hash(f.state.receipts[3]));
 assert.notEqual(contexts[0].body.identitySha256,contexts[1].body.identitySha256);
});

for(const [label,response] of [
 ['forbidden',()=>new Response('{}',{status:403})],['wrong media',()=>new Response('{}')],
 ['encoding',()=>new Response('{}',{headers:{'content-type':'application/json','content-encoding':'gzip'}})],
 ['declared overflow',()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'16385'}})],
 ['stream overflow',()=>new Response(' '.repeat(16385),{headers:{'content-type':'application/json'}})],
 ['invalid JSON',()=>new Response('{',{headers:{'content-type':'application/json'}})],['wrapper',r=>Response.json({context:r})],
])test(`context HTTP ${label} refuses without fallback`,async()=>{
 const f=fixture();f.state.response=(r,p)=>p===contextPath?response(r):Response.json(r);await assert.rejects(f.client.readConversation(f.request()));assert.equal(f.state.calls.length,2);
});

test('closed exact UUID selectors and inert input refuse before HTTP',async()=>{
 const f=fixture();let getters=0;
 for(const changes of [{conversationId:'Client Name'},{conversationId:uuid('a').toUpperCase()},{clientId:` ${clientId} `},{clientId:null},{clientId:uuid('2')+'suffix'},
  {deadlineMs:1.5},{credential:'contains space'},{binding:{}},{identitySha256:'0'.repeat(64)},
  {get conversationId(){getters++;return conversationId;}}]){
  // Build the request without evaluating accessor-bearing input.
  const request=Object.defineProperties({...f.request()},Object.getOwnPropertyDescriptors(changes));
  await assert.rejects(f.client.readConversation(request),{message:'INVALID_ARGUMENTS'});
 }
 assert.equal(getters,0);assert.equal(f.state.calls.length,0);
});

test('disabled or missing dependencies preserve a callable unavailable reader without HTTP',async()=>{
 for(const changes of [{enabled:false},{origin:undefined},{fetchImpl:undefined}]){
  const f=fixture(changes);assert.equal(f.client.available,false);assert.equal(typeof f.client.readConversation,'function');
  await assert.rejects(f.client.readConversation(f.request()),{message:'UNAVAILABLE'});assert.equal(f.state.calls.length,0);
 }
});

test('pre-abort and elapsed cutoff refuse without authority HTTP',async()=>{
 const f=fixture();await assert.rejects(f.client.readConversation({...f.request(),signal:AbortSignal.abort()}),{message:'CANCELLED'});
 await assert.rejects(f.client.readConversation({...f.request(),deadlineMs:f.now()}),{message:'DEADLINE'});assert.equal(f.state.calls.length,0);
});
test('cancellation during native context retires the late response body and releases no receipt',async()=>{
 const f=fixture(),abort=new AbortController();let release,entered,cancelled=false;
 const ready=new Promise(resolve=>entered=resolve);f.state.response=(r,p)=>p!==contextPath?Response.json(r):new Promise(resolve=>{release=resolve;entered();});
 const work=f.client.readConversation({...f.request(),signal:abort.signal});await ready;abort.abort();await assert.rejects(work,{message:'CANCELLED'});
 release(new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}}));await turn();
 assert.equal(cancelled,true);assert.equal(f.state.calls.length,2);assert.equal(f.state.calls[1].init.signal.aborted,true);
});
test('bounded context wait aborts an uncooperative HTTP call and retires its late body',async()=>{
 const f=fixture({maxRequestMs:100});let release,cancelled=false;
 f.state.response=(r,p)=>p!==contextPath?Response.json(r):new Promise(resolve=>release=resolve);
 await assert.rejects(f.client.readConversation(f.request()),{message:'DEADLINE'});
 release(new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}}));await turn();
 assert.equal(cancelled,true);assert.equal(f.state.calls.length,2);assert.equal(f.state.calls[1].init.signal.aborted,true);
});

test('the shared private projection validator enforces exact fields, canonical facts, fresh times and selector equality',async()=>{
 const f=fixture(),out=await f.client.readConversation(f.request()),options={started:f.now(),now:f.now,conversationId,clientId};
 assert.deepEqual(assertNativeConversationAuthority(out,options),out);
 for(const mutate of [r=>r.principal.actorId='clerk_actor',r=>r.identityRevision='opaque',r=>r.conversationId=uuid('d'),r=>r.selectedClientId=uuid('d'),
  r=>r.contextRevision='',r=>r.contextRevision='x'.repeat(257),r=>r.checkedAtMs--,r=>r.checkedAtMs++,r=>r.expiresAtMs=r.checkedAtMs,
  r=>r.identitySha256='0'.repeat(64),r=>delete r.selectedClientId]){
  const value=structuredClone(out);mutate(value);assert.throws(()=>assertNativeConversationAuthority(value,options),{message:'ACCESS_DENIED'});
 }
 let touched=false;assert.throws(()=>assertNativeConversationAuthority({...out,get contextRevision(){touched=true;return 'opaque';}},options),{message:'ACCESS_DENIED'});assert.equal(touched,false);
});
