/** Synthetic fixed HTTP/identity observations; no native client data or authority grant is issued. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCapiroApplicationAuthorityClient} from '../../../../control/action-host/application-adapters/authority-http.mjs';
import {createClientReferenceReader,assertNativeClientReferenceObservation} from '../client-reference.mjs';

const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const origin='https://native-core.example.invalid',path='/api/clio/clients/check-ref',identityPath='/api/clio/application-authority/identity';
const clientId=uuid('d'),otherId=uuid('e'),turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(changes={}){
 const state={now:1800000000000,calls:[],identityRevision:'a'.repeat(64),nativeExpiry:1800000060000,status:201},now=()=>state.now;
 const principal={tenantId:uuid('b'),actorId:uuid('c')};
 const fetchImpl=async(url,init)=>{
  const selected=new URL(url).pathname;state.calls.push({url,init,path:selected,body:JSON.parse(init.body)});
  await state.beforeResponse?.(selected);
  const value=selected===identityPath?{principal:structuredClone(principal),identityRevision:state.identityRevision,checkedAtMs:now(),expiresAtMs:state.nativeExpiry}:{ok:true,clientId};
  state.mutate?.(value,selected,state.calls.length);
  return state.response?.(value,selected)??Response.json(value,{status:selected===path?state.status:200});
 };
 const authorityClient=createCapiroApplicationAuthorityClient({origin,fetchImpl,now,enabled:true,limits:{maxRequestMs:3000,maxResponseBytes:16384}});
 const configuration={available:true,origin,fetchImpl,authorityClient,now,maxRequestMs:3000,...changes};
 return {state,now,principal,authorityClient,configuration,read:createClientReferenceReader(configuration),request:()=>({credential:'SYNTHETIC_NATIVE',reference:'  Café 東京 — Client  ',deadlineMs:now()+10000})};
}
const failure=async(p,code)=>{
 await assert.rejects(p,error=>{if(code)assert.equal(error.message,code);assert.match(error.message,/^(CONFIGURATION|INVALID_ARGUMENTS|ACCESS_DENIED|UNAVAILABLE|DEADLINE|CANCELLED|INVALID_RESULT|RESOURCE_LIMIT)$/u);assert.equal(error.message.includes('PRIVATE'),false);return true;});
};

for(const status of [200,201,202,299])test(`fixed reference POST accepts native2xx ${status} inside exact identity brackets`,async()=>{
 const f=fixture();f.state.status=status;const request=f.request(),out=await f.read(request);
 assert.deepEqual(f.state.calls.map(call=>call.path),[identityPath,path,identityPath]);
 assert.deepEqual(out,{principal:f.principal,identityRevision:'a'.repeat(64),reference:request.reference,clientId,checkedAtMs:f.now(),expiresAtMs:f.now()+3000});
 assert.equal(Object.isFrozen(out),true);assert.equal(Object.isFrozen(out.principal),true);
 const call=f.state.calls[1];assert.equal(call.url,origin+path);assert.equal(call.init.method,'POST');assert.equal(call.init.redirect,'error');assert.equal(call.init.credentials,'omit');assert.equal(call.init.cache,'no-store');
 assert.deepEqual(call.body,{ref:request.reference});assert.equal(call.init.body,JSON.stringify({ref:request.reference}));
 assert.deepEqual(call.init.headers,{authorization:'Bearer SYNTHETIC_NATIVE','content-type':'application/json',accept:'application/json','accept-encoding':'identity'});
 for(const key of ['issuer','contextRevision','resourceRevision','membershipRevision','reason','credential','scopes','tenantId'])assert.equal(Object.hasOwn(out,key),false);
});

test('raw Unicode, exact UUID spelling and trailing clipping-boundary spaces are never rewritten',async()=>{
 for(const reference of ['é'.repeat(80),'😀'.repeat(40),'A'.repeat(79)+' ',` ${clientId.toUpperCase()} `,'名字\nCafé']){
  const f=fixture(),out=await f.read({...f.request(),reference});assert.equal(out.reference,reference);assert.equal(f.state.calls[1].body.ref,reference);
  assert.deepEqual(Buffer.from(f.state.calls[1].init.body,'utf8'),Buffer.from(JSON.stringify({ref:reference}),'utf8'));
 }
});

test('local expiry is capped by both identity facts, caller deadline and configured observation window',async()=>{
 const f=fixture({maxRequestMs:75}),began=f.now();
 f.state.mutate=(value,selected,n)=>{if(selected===identityPath)value.expiresAtMs=began+(n===1?60:40);f.state.now++;};
 const out=await f.read({...f.request(),deadlineMs:began+100});
 assert.equal(out.checkedAtMs,began);assert.equal(out.expiresAtMs,began+40);assert.equal(f.now(),began+3);
 const g=fixture(),at=g.now();assert.equal((await g.read({...g.request(),deadlineMs:at+25})).expiresAtMs,at+25);
 const h=fixture({maxRequestMs:50});assert.equal((await h.read(h.request())).expiresAtMs,h.now()+50);
});

test('each call re-observes the native identity and resolution without caching or closing borrowed ports',async()=>{
 const f=fixture();await f.read(f.request());f.state.now+=50;await f.read(f.request());
 assert.deepEqual(f.state.calls.map(call=>call.path),[identityPath,path,identityPath,identityPath,path,identityPath]);
 assert.equal(typeof f.authorityClient.readIdentity,'function');assert.equal(typeof f.authorityClient.readContext,'function');
});

for(const change of ['actor','tenant','revision'])test(`final identity ${change} drift withholds the observation`,async()=>{
 const f=fixture();f.state.mutate=(value,selected,n)=>{if(selected===identityPath&&n===3){if(change==='revision')value.identityRevision='b'.repeat(64);else value.principal[change==='actor'?'actorId':'tenantId']=otherId;}};
 await failure(f.read(f.request()),'ACCESS_DENIED');assert.equal(f.state.calls.length,3);
});

for(const phase of ['before','after'])for(const kind of ['stale','future','expired','revision','extra','principal'])test(`${phase} identity ${kind} cannot establish a local fact`,async()=>{
 const f=fixture();let calls=0;
 const authorityClient={async readIdentity(){calls++;const value={principal:f.principal,identityRevision:'a'.repeat(64),checkedAtMs:f.now(),expiresAtMs:f.now()+10000};
  if(calls===(phase==='before'?1:2)){if(kind==='stale')value.checkedAtMs--;if(kind==='future')value.checkedAtMs++;if(kind==='expired')value.expiresAtMs=f.now();if(kind==='revision')value.identityRevision='PRIVATE';if(kind==='extra')value.extra='PRIVATE';if(kind==='principal')value.principal={...f.principal,actorId:'PRIVATE'};}return value;
 }};
 const read=createClientReferenceReader({...f.configuration,authorityClient});await failure(read(f.request()),'ACCESS_DENIED');assert.equal(f.state.calls.length,phase==='before'?0:1);
});

for(const value of [{ok:false,reason:'PRIVATE no client or ambiguous name'},{ok:false,reason:''}])test(`native false remains unavailable without exposing or interpreting reason length${value.reason.length}`,async()=>{
 const f=fixture();f.state.response=(v,p)=>Response.json(p===path?value:v,{status:p===path?201:200});
 await failure(f.read(f.request()),'UNAVAILABLE');assert.equal(f.state.calls.length,2);
});

for(const [label,value] of [
 ['extra success',{ok:true,clientId,tenantId:uuid('b')}],['wrapper',{result:{ok:true,clientId}}],['missing UUID',{ok:true}],['upper UUID',{ok:true,clientId:clientId.toUpperCase()}],
 ['bad UUID',{ok:true,clientId:'PRIVATE'}],['nonboolean',{ok:'true',clientId}],['extra failure',{ok:false,reason:'PRIVATE',clientId}],['bad reason',{ok:false,reason:{PRIVATE:true}}],
])test(`closed native selection rejects ${label} without final identity or fallback`,async()=>{
 const f=fixture();f.state.response=(v,p)=>Response.json(p===path?value:v,{status:p===path?201:200});await failure(f.read(f.request()));assert.equal(f.state.calls.length,2);
});

for(const [label,response] of [
 ['403',()=>new Response('PRIVATE',{status:403})],['500',()=>new Response('PRIVATE',{status:500})],['204',()=>new Response(null,{status:204})],
 ['wrong media',()=>new Response('{}',{status:201})],['encoding',()=>new Response('{}',{status:201,headers:{'content-type':'application/json','content-encoding':'gzip'}})],
 ['declared overflow',()=>new Response('{}',{status:201,headers:{'content-type':'application/json','content-length':'4097'}})],
 ['stream overflow',()=>new Response(' '.repeat(4097),{status:201,headers:{'content-type':'application/json'}})],
 ['byte count mismatch',()=>new Response('{}',{status:201,headers:{'content-type':'application/json','content-length':'3'}})],
 ['malformed JSON',()=>new Response('{',{status:201,headers:{'content-type':'application/json'}})],
 ['invalid UTF8',()=>new Response(new Uint8Array([0xc3,0x28]),{status:201,headers:{'content-type':'application/json'}})],
 ['redirect',()=>{const r=Response.json({ok:true,clientId},{status:201});Object.defineProperty(r,'redirected',{value:true});return r;}],
 ['proxy',()=>new Proxy(Response.json({ok:true,clientId}),{get(){throw Error('PRIVATE');}})],
])test(`bounded native HTTP ${label} releases no observation`,async()=>{
 const f=fixture();f.state.response=(v,p)=>p===path?response():Response.json(v);await failure(f.read(f.request()));assert.equal(f.state.calls.length,2);
});

test('strict UTF8 decoder preserves a valid multibyte boundary split',async()=>{
 const f=fixture(),bytes=Buffer.from(JSON.stringify({ok:false,reason:'PRIVATE café 東京 😀'}),'utf8'),at=bytes.indexOf(0xc3)+1;
 f.state.response=(v,p)=>p!==path?Response.json(v):new Response(new ReadableStream({start(c){c.enqueue(bytes.subarray(0,at));c.enqueue(bytes.subarray(at));c.close();}}),{status:201,headers:{'content-type':'application/json'}});
 await failure(f.read(f.request()),'UNAVAILABLE');
});

test('closed caller fields and hostile objects refuse before identity or HTTP',async()=>{
 const f=fixture();let touched=0;
 const cases=[{reference:''},{reference:'   '},{reference:'é'.repeat(81)},{reference:null},{credential:'bad token'},{deadlineMs:1.5},{headers:{cookie:'PRIVATE'}},{tenantId:uuid('b')},{url:origin+'/other'},{signal:{}},{get reference(){touched++;return 'Name';}}];
 for(const changes of cases){const call=Object.defineProperties({...f.request()},Object.getOwnPropertyDescriptors(changes));await failure(f.read(call),'INVALID_ARGUMENTS');}
 await failure(f.read(new Proxy(f.request(),{get(){touched++;throw Error('PRIVATE');}})),'INVALID_ARGUMENTS');assert.equal(touched,0);assert.equal(f.state.calls.length,0);
});

test('configuration is inert and rejects route, header, proxy and borrowed-port overrides',()=>{
 const f=fixture();let touched=0;
 for(const changes of [{origin:origin+'/route'},{origin:'http://native-core.example.invalid'},{headers:{cookie:'PRIVATE'}},{maxRequestMs:0},{maxRequestMs:3001},{authorityClient:null},{fetchImpl:undefined},{now:undefined},
  {fetchImpl:new Proxy(()=>{},{apply(){touched++;}})},{authorityClient:{get readIdentity(){touched++;return ()=>{};}}},{get origin(){touched++;return origin;}}]){
  const config=Object.defineProperties({...f.configuration},Object.getOwnPropertyDescriptors(changes));assert.throws(()=>createClientReferenceReader(config),{message:'CONFIGURATION'});
 }
 assert.equal(touched,0);assert.equal(f.state.calls.length,0);
});

test('unavailable reader remains callable and uses no identity or HTTP',async()=>{
 const f=fixture(),read=createClientReferenceReader({available:false,now:f.now,maxRequestMs:3000});await failure(read(f.request()),'UNAVAILABLE');assert.equal(f.state.calls.length,0);
});

test('pre-abort and elapsed deadline refuse before identity and native HTTP',async()=>{
 const f=fixture();await failure(f.read({...f.request(),signal:AbortSignal.abort()}),'CANCELLED');await failure(f.read({...f.request(),deadlineMs:f.now()}),'DEADLINE');assert.equal(f.state.calls.length,0);
});

test('cancellation retires a late reference response body without another identity read',async()=>{
 const f=fixture(),abort=new AbortController();let release,entered,cancelled=false;const ready=new Promise(resolve=>entered=resolve);
 f.state.response=(v,p)=>p!==path?Response.json(v):new Promise(resolve=>{release=resolve;entered();});
 const pending=f.read({...f.request(),signal:abort.signal});await ready;abort.abort();await failure(pending,'CANCELLED');
 release(new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:201,headers:{'content-type':'application/json'}}));await turn();
 assert.equal(cancelled,true);assert.equal(f.state.calls.length,2);assert.equal(f.state.calls[1].init.signal.aborted,true);
});

test('configured bound ends an uncooperative native wait and retires its late body',async()=>{
 const f=fixture({maxRequestMs:40});let release,cancelled=false;
 f.state.response=(v,p)=>p!==path?Response.json(v):new Promise(resolve=>release=resolve);
 await failure(f.read(f.request()),'DEADLINE');release(new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:201,headers:{'content-type':'application/json'}}));await turn();
 assert.equal(cancelled,true);assert.equal(f.state.calls.length,2);
});

test('body streaming cancellation discards partial JSON and closes its reader',async()=>{
 const f=fixture(),abort=new AbortController();let entered,cancelled=false;const ready=new Promise(resolve=>entered=resolve);
 f.state.response=(v,p)=>p!==path?Response.json(v):new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('{"ok":'));entered();},cancel(){cancelled=true;}}),{status:201,headers:{'content-type':'application/json'}});
 const pending=f.read({...f.request(),signal:abort.signal});await ready;abort.abort();await failure(pending,'CANCELLED');await turn();assert.equal(cancelled,true);assert.equal(f.state.calls.length,2);
});

test('projection validator enforces exact fields, reference, canonical facts and local observation cap',async()=>{
 const f=fixture(),call=f.request(),out=await f.read(call),options={started:f.now(),now:f.now,reference:call.reference};
 assert.deepEqual(assertNativeClientReferenceObservation(out,options),out);
 for(const mutate of [r=>r.reference=r.reference.trim(),r=>r.clientId=r.clientId.toUpperCase(),r=>r.principal.actorId='PRIVATE',r=>r.identityRevision='opaque',
  r=>r.checkedAtMs--,r=>r.checkedAtMs++,r=>r.expiresAtMs=f.now(),r=>r.expiresAtMs=f.now()+3001,r=>r.resourceRevision='PRIVATE',r=>delete r.clientId]){
  const value=structuredClone(out);mutate(value);assert.throws(()=>assertNativeClientReferenceObservation(value,options),{message:'ACCESS_DENIED'});
 }
 let touched=0;assert.throws(()=>assertNativeClientReferenceObservation({...out,get clientId(){touched++;return clientId;}},options),{message:'ACCESS_DENIED'});
 assert.throws(()=>assertNativeClientReferenceObservation(new Proxy(out,{get(){touched++;}}),options),{message:'ACCESS_DENIED'});assert.equal(touched,0);
});
