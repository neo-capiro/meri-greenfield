import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createCoreOfficeDraftClient} from '../core-drafts.mjs';
import {officeDraftRequest,officeDraftResponse,OFFICE_DRAFT_MAX_BYTES} from '../core-draft-wire.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const key={conversationId:id(1),draftId:id(8)},source={artifactId:id(9),baseVersionId:id(10),baseSha256:'a'.repeat(64),format:'docx',filename:'Draft.docx'};
const bytes=Buffer.from('private edited bytes'),saved={...key,lock:'wopi-lock',expectedSequence:0,kind:'autosave',sha256:sha(bytes),bytesBase64:bytes.toString('base64')};
const initial=()=>({...key,...source,sequence:0,sha256:null,byteLength:0,state:'draft',publishIntent:null,publishedVersionId:null,savedAt:'2026-10-29T00:00:00.000Z',expiresAt:'2026-11-05T00:00:00.000Z'});
const kept=()=>({...initial(),sequence:1,sha256:sha(bytes),byteLength:bytes.length});
const pending=()=>({...kept(),state:'publish-pending',publishIntent:`office:${key.draftId}:1`});
const begin={...key,sequence:1,sha256:sha(bytes)};
const settle={...begin,intent:`office:${key.draftId}:1`,outcome:'published',versionId:id(11)};
const reply=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json','cache-control':'private, no-store'}});
async function fixture(){
 let clock=Date.parse('2026-10-29T00:00:00Z');const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},scopes=[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy'}];
 const sessions=createActionSessionOwner({mode:'process-local',now:()=>clock,limits:{maxSessions:4,maxRequestMs:1000,maxTtlMs:10000,maxFactBytes:65536},
  verifyIdentity:async()=>({principal:{tenantId:'tenant',actorId:'actor'},identityRevision:'identity',checkedAtMs:clock,expiresAtMs:clock+20000}),
  resolveContext:async({identity})=>({identitySha256:canonicalSha256(identity),binding,scopes,selectedClientId:id(5),contextRevision:'revision',checkedAtMs:clock,expiresAtMs:clock+20000})});
 const session=await sessions.issue({identityCredential:'synthetic-native-bearer'}),selection={binding,scopes,selectedClientId:id(5),deadlineMs:clock+5000};
 const state={calls:[],reply:()=>reply(initial()),secret:'synthetic-service-secret',secretHook:null,reserved:new Set()};
 const options={origin:'https://core.example.test',nativeCredentials:{nativeCredentialFor:input=>sessions.nativeCredentialFor(input)},getServiceSecret:async()=>{await state.secretHook?.();return state.secret;},reservedCredentials:async()=>state.reserved,now:()=>clock,
  fetchImpl:async(url,options)=>{state.calls.push({url,options});return state.reply();}};
 const client=createCoreOfficeDraftClient(options);
 return {sessions,session,selection,state,options,client,advance:ms=>{clock+=ms;},call:(route='open',body={...key,...source},chosen=selection)=>client.call(route,body,chosen)};
}
const exchanges=[['open',{...key,...source},initial()],['read',key,{...kept(),bytesBase64:saved.bytesBase64}],['read',key,{...initial(),bytesBase64:null}],
 ['lock',{...key,operation:'get'},{status:200,lock:''}],['lock',{...key,operation:'lock',lock:'new'},{status:200}],['lock',{...key,operation:'refresh',lock:'new'},{status:409,lock:'other'}],
 ['save',saved,{status:200,receipt:kept()}],['save',saved,{status:409,lock:''}],['discard',key,{discarded:true}],['beginPublish',begin,{receipt:pending(),dispatch:true}],
 ['beginPublish',begin,{receipt:{...pending(),state:'published',publishedVersionId:id(11)},dispatch:false}],['settlePublish',settle,{...pending(),state:'published',publishedVersionId:id(11)}]];
for(const [n,[route,body,result]]of exchanges.entries())test(`Core exchange ${n+1}: ${route} through current native credential and exact route`,async t=>{
 const f=await fixture();t.after(()=>f.sessions.close());f.state.reply=()=>reply(result);assert.deepEqual(await f.call(route,body),result);
 const call=f.state.calls[0];assert.ok(call.url.startsWith('https://core.example.test/api/clio/office-drafts/'));assert.deepEqual(JSON.parse(call.options.body),body);
 assert.equal(call.options.headers.authorization,'Bearer synthetic-native-bearer');assert.equal(call.options.headers['x-internal-service-secret'],'synthetic-service-secret');
 assert.equal(call.options.redirect,'error');assert.equal(call.options.credentials,'omit');assert.equal(call.options.cache,'no-store');assert.equal(f.state.calls.length,1);
});
for(const change of ['expired','revoked','run','conversation','client','secret','reserved-bearer','reserved-secret','rotation'])test(`current credential boundary refuses ${change} before fetch`,async t=>{
 const f=await fixture();t.after(()=>f.sessions.close());let selected=structuredClone(f.selection);
 if(change==='expired'){f.advance(11000);selected.deadlineMs+=20000;}
 if(change==='revoked')f.sessions.revoke(f.session.credential);
 if(change==='run')selected.binding.runId=id(20);
 if(change==='conversation')selected.binding.conversationId=id(20);
 if(change==='client'){selected.selectedClientId=id(20);selected.scopes[0].resourceId=id(20);}
 if(change==='secret')f.state.secret='synthetic-native-bearer';
 if(change==='reserved-bearer')f.state.reserved.add(sha('synthetic-native-bearer'));
 if(change==='reserved-secret')f.state.reserved.add(sha('synthetic-service-secret'));
 if(change==='rotation')f.state.secretHook=async()=>{f.advance(1);await f.sessions.issue({identityCredential:'synthetic-new-session'});};
 await assert.rejects(f.call('open',{...key,...source},selected));assert.equal(f.state.calls.length,0);
});
test('session revocation after Save never releases the receipt and never retries',async t=>{
 const f=await fixture();t.after(()=>f.sessions.close());f.state.reply=()=>{f.sessions.revoke(f.session.credential);return reply({status:200,receipt:kept()});};
 await assert.rejects(f.call('save',saved),e=>e.outcome==='UNKNOWN');assert.equal(f.state.calls.length,1);
});
for(const status of [400,401,403,404,409,410])test(`Core HTTP ${status} is a definite refusal with no response-body disclosure`,async t=>{
 const f=await fixture();t.after(()=>f.sessions.close());f.state.reply=()=>new Response('private diagnostic',{status});
 await assert.rejects(f.call('save',saved),e=>e.outcome==='NOT_DISPATCHED'&&!e.message.includes('private diagnostic'));assert.equal(f.state.calls.length,1);
});
for(const change of ['network','500','invalid-json','extra','sequence','hash','length','encoded','oversize'])test(`ambiguous Save ${change} keeps UNKNOWN without retry`,async t=>{
 const f=await fixture();t.after(()=>f.sessions.close());
 f.state.reply=()=>{
  if(change==='network')throw Error('private socket message');if(change==='500')return new Response('private diagnostic',{status:500});
  if(change==='invalid-json')return new Response('{',{headers:{'content-type':'application/json'}});
  const result={status:200,receipt:kept()};if(change==='extra')result.authority=true;if(change==='sequence')result.receipt.sequence=4;if(change==='hash')result.receipt.sha256='b'.repeat(64);
  const response=reply(result);if(change==='length')response.headers.set('content-length','1');if(change==='encoded')response.headers.set('content-encoding','gzip');if(change==='oversize')response.headers.set('content-length','32769');return response;
 };
 await assert.rejects(f.call('save',saved),e=>e.outcome==='UNKNOWN'&&!e.message.includes('private'));assert.equal(f.state.calls.length,1);
});
test('a failed Read is unavailable, not an uncertain write; initial source and discarded identity cannot be forged',async t=>{
 const f=await fixture();t.after(()=>f.sessions.close());f.state.reply=()=>reply({...kept(),bytesBase64:Buffer.from('different').toString('base64')});
 await assert.rejects(f.call('read',key),e=>e.outcome==='READ_UNAVAILABLE');
 assert.throws(()=>officeDraftResponse('open',{...initial(),baseVersionId:id(22)},{...key,...source}));
 assert.throws(()=>officeDraftResponse('read',{...kept(),state:'discarded',bytesBase64:saved.bytesBase64},key));
});
test('20 MiB exact saves and private readbacks fit the dedicated bound; one extra byte and noncanonical base64 refuse',()=>{
 const bytes=Buffer.alloc(OFFICE_DRAFT_MAX_BYTES,7),request={...saved,bytesBase64:bytes.toString('base64'),sha256:sha(bytes)};
 const accepted=officeDraftRequest('save',request);assert.equal(accepted.bytesBase64,request.bytesBase64);
 const result={...kept(),byteLength:bytes.length,sha256:request.sha256,bytesBase64:request.bytesBase64};assert.equal(officeDraftResponse('read',result,key).byteLength,bytes.length);
 assert.throws(()=>officeDraftRequest('save',{...request,bytesBase64:Buffer.alloc(bytes.length+1,7).toString('base64')}));
 assert.throws(()=>officeDraftRequest('save',{...request,bytesBase64:request.bytesBase64+'\n'}));
});
test('wire data cannot run getters or coercion; invalid routes and extra authority refuse before transport',async t=>{
 const f=await fixture();t.after(()=>f.sessions.close());let touched=false;const body={...key,...source};Object.defineProperty(body,'draftId',{enumerable:true,get(){touched=true;return key.draftId;}});
 assert.throws(()=>officeDraftRequest('open',body));assert.equal(touched,false);
 assert.throws(()=>officeDraftRequest('open',{...key,...source,draftId:{toString(){touched=true;return key.draftId;}}}));assert.equal(touched,false);
 await assert.rejects(f.call('../save',saved));await assert.rejects(f.call('save',{...saved,tenantId:'other'}));assert.equal(f.state.calls.length,0);
});
test('20 MiB Save and Read cross the actual bounded JSON transport',async t=>{
 const f=await fixture();t.after(()=>f.sessions.close());const bytes=Buffer.alloc(OFFICE_DRAFT_MAX_BYTES,3),request={...saved,bytesBase64:bytes.toString('base64'),sha256:sha(bytes)};
 const receipt={...kept(),byteLength:bytes.length,sha256:request.sha256};f.state.reply=()=>reply({status:200,receipt});
 assert.equal((await f.call('save',request)).receipt.byteLength,bytes.length);
 f.state.reply=()=>reply({...receipt,bytesBase64:request.bytesBase64});const read=await f.call('read',key);
 assert.equal(read.bytesBase64,request.bytesBase64);assert.equal(f.state.calls.length,2);
});
test('cancelled Save stays unknown; a late response is retired without retry or release',async t=>{
 const f=await fixture();t.after(()=>f.sessions.close());const controller=new AbortController();let finish,retired=0;
 const fetchImpl=async()=>{queueMicrotask(()=>controller.abort());return new Promise(resolve=>{finish=resolve;});};
 const client=createCoreOfficeDraftClient({...f.options,fetchImpl});
 await assert.rejects(client.call('save',saved,{...f.selection,signal:controller.signal}),e=>e.outcome==='UNKNOWN');
 finish(new Response(new ReadableStream({cancel(){retired++;}}),{headers:{'content-type':'application/json'}}));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(retired,1);
});
