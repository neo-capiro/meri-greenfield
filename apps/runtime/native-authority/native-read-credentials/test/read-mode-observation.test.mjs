/** Synthetic mode HTTP over the actual identity adapter; no native grant or installed source is qualified. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {MODE_READ_OPERATIONS} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {createCapiroApplicationAuthorityClient} from '../../../../control/action-host/application-adapters/authority-http.mjs';
import {createNativeToolAuthorityClient} from '../core-client.mjs';
import {createReadModeObservationReader,assertNativeReadModeObservation,READ_MODE_MAX_REQUEST_MS} from '../read-mode-observation.mjs';

const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const origin='https://native-core.example.invalid',modePath='/api/clio/application-authority/read-mode-observation',identityPath='/api/clio/application-authority/identity';
const modes=['off','shadow','enforce'],sha='d'.repeat(64),otherId=uuid('e'),turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(changes={}){
 const state={now:1800000000000,calls:[],identityRevision:'a'.repeat(64),nativeExpiry:1800000060000,status:201,mode:'off'},now=()=>state.now;
 const principal={tenantId:uuid('b'),actorId:uuid('c')};
 const fetchImpl=async(url,init)=>{
  const path=new URL(url).pathname,body=JSON.parse(init.body);state.calls.push({url,init,path,body});await state.beforeResponse?.(path);
  const value=path===identityPath?{principal:structuredClone(principal),identityRevision:state.identityRevision,checkedAtMs:now(),expiresAtMs:state.nativeExpiry}:
   {operation:structuredClone(body.operation),requestSha256:body.requestSha256,principal:structuredClone(principal),surface:'chat',evidenceAccuracyMode:state.mode};
  state.mutate?.(value,path,state.calls.length);
  return state.response?.(value,path)??Response.json(value,{status:path===modePath?state.status:200});
 };
 const authorityClient=createCapiroApplicationAuthorityClient({origin,fetchImpl,now,enabled:true,limits:{maxRequestMs:3000,maxResponseBytes:16384}});
 const configuration={available:true,origin,fetchImpl,authorityClient,now,maxRequestMs:3000,...changes};
 return {state,now,principal,authorityClient,configuration,read:createReadModeObservationReader(configuration),request:()=>({credential:'SYNTHETIC_NATIVE',serviceSecret:'SYNTHETIC_SERVICE',operation:{id:MODE_READ_OPERATIONS[0],version:'0.2.0'},requestSha256:sha,deadlineMs:now()+10000})};
}
const failure=async(p,code)=>assert.rejects(p,error=>{if(code)assert.equal(error.message,code);assert.match(error.message,/^(CONFIGURATION|INVALID_ARGUMENTS|ACCESS_DENIED|UNAVAILABLE|DEADLINE|CANCELLED|INVALID_RESULT|RESOURCE_LIMIT)$/u);assert.equal(error.message.includes('PRIVATE'),false);return true;});
const identityFact=f=>({principal:f.principal,identityRevision:'a'.repeat(64),checkedAtMs:f.now(),expiresAtMs:f.now()+10000});

test('finite mode operation registry and exported observation cap remain exact',()=>{
 assert.deepEqual(MODE_READ_OPERATIONS,['search_federal_grants','search_federal_awards','search_program_elements','get_program_element','get_pe_budget_timeline']);assert.equal(READ_MODE_MAX_REQUEST_MS,3000);
});

for(const id of MODE_READ_OPERATIONS)for(const mode of modes)test(`${id} observes native ${mode} with exact fixed identity/mode/identity wire`,async()=>{
 const f=fixture();f.state.mode=mode;const request={...f.request(),operation:{id,version:'0.2.0'}},out=await f.read(request);
 assert.deepEqual(f.state.calls.map(call=>call.path),[identityPath,modePath,identityPath]);
 assert.deepEqual(out,{principal:f.principal,identityRevision:'a'.repeat(64),operation:request.operation,requestSha256:sha,evidenceAccuracyMode:mode,checkedAtMs:f.now(),expiresAtMs:Math.min(request.deadlineMs,f.state.nativeExpiry)});
 assert.equal(Object.isFrozen(out),true);assert.equal(Object.isFrozen(out.principal),true);assert.equal(Object.isFrozen(out.operation),true);
 const call=f.state.calls[1];assert.equal(call.url,origin+modePath);assert.equal(call.init.method,'POST');assert.equal(call.init.redirect,'error');assert.equal(call.init.credentials,'omit');assert.equal(call.init.cache,'no-store');
 assert.equal(call.init.body,JSON.stringify({operation:request.operation,requestSha256:sha}));assert.deepEqual(call.body,{operation:request.operation,requestSha256:sha});
 assert.deepEqual(call.init.headers,{authorization:'Bearer SYNTHETIC_NATIVE','x-internal-service-secret':'SYNTHETIC_SERVICE','x-meri-deadline-at':String(f.now()+3000),'content-type':'application/json',accept:'application/json','accept-encoding':'identity'});
 for(const identity of [f.state.calls[0],f.state.calls[2]])assert.equal(Object.hasOwn(identity.init.headers,'x-internal-service-secret'),false);
 for(const key of ['surface','issuer','contextRevision','resourceRevision','membershipRevision','credential','serviceSecret','scopes','tenantId','modeRevision'])assert.equal(Object.hasOwn(out,key),false);
});

for(const status of [200,202,299])test(`fixed mode POST accepts coherent native2xx ${status}`,async()=>{const f=fixture();f.state.status=status;assert.equal((await f.read(f.request())).evidenceAccuracyMode,'off');assert.equal(f.state.calls.length,3);});

test('local expiry preserves first actual identity expiry, second expiry, caller cap and configured bound',async()=>{
 for(const [first,second,deadline,max,expected] of [[60,500,100,75,60],[500,40,100,75,40],[500,500,25,75,25],[500,500,100,50,100]]){
  const f=fixture({maxRequestMs:max}),began=f.now();f.state.mutate=(value,path,n)=>{if(path===identityPath)value.expiresAtMs=began+(n===1?first:second);f.state.now++;};
  const out=await f.read({...f.request(),deadlineMs:began+deadline});assert.equal(out.checkedAtMs,began);assert.equal(out.expiresAtMs,began+expected);assert.equal(f.now(),began+3);
  assert.equal(f.state.calls[1].init.headers['x-meri-deadline-at'],String(began+Math.min(first,deadline,max)));
 }
});

test('each call obtains fresh mode and identity without caching or closing borrowed authority',async()=>{
 const f=fixture();assert.equal((await f.read(f.request())).evidenceAccuracyMode,'off');f.state.now+=20;f.state.mode='enforce';assert.equal((await f.read(f.request())).evidenceAccuracyMode,'enforce');
 assert.deepEqual(f.state.calls.map(c=>c.path),[identityPath,modePath,identityPath,identityPath,modePath,identityPath]);assert.equal(typeof f.authorityClient.readContext,'function');
});

test('input operation is captured inertly before awaited identity and raw request hash is unchanged',async()=>{
 const f=fixture(),request=f.request(),original=structuredClone(request.operation);f.state.beforeResponse=path=>{if(path===identityPath)request.operation.id='get_legal_reference';};
 const out=await f.read(request);assert.deepEqual(out.operation,original);assert.deepEqual(f.state.calls[1].body,{operation:original,requestSha256:sha});
});

for(const change of ['actor','tenant','revision'])test(`final identity ${change} drift withholds local mode`,async()=>{
 const f=fixture();f.state.mutate=(value,path,n)=>{if(path===identityPath&&n===3){if(change==='revision')value.identityRevision='b'.repeat(64);else value.principal[change==='actor'?'actorId':'tenantId']=otherId;}};
 await failure(f.read(f.request()),'ACCESS_DENIED');assert.equal(f.state.calls.length,3);
});

for(const phase of ['before','after'])for(const kind of ['stale','future','expired','revision','extra','principal'])test(`${phase} identity ${kind} cannot establish a local mode`,async()=>{
 const f=fixture();let calls=0;const authorityClient={async readIdentity(){calls++;const value=identityFact(f);
  if(calls===(phase==='before'?1:2)){if(kind==='stale')value.checkedAtMs--;if(kind==='future')value.checkedAtMs++;if(kind==='expired')value.expiresAtMs=f.now();if(kind==='revision')value.identityRevision='PRIVATE';if(kind==='extra')value.extra='PRIVATE';if(kind==='principal')value.principal={...f.principal,actorId:'PRIVATE'};}return value;
 }};
 const read=createReadModeObservationReader({...f.configuration,authorityClient});await failure(read(f.request()),'ACCESS_DENIED');assert.equal(f.state.calls.length,phase==='before'?0:1);
});

for(const [label,mutate] of [
 ['actor',r=>r.principal.actorId=otherId],['tenant',r=>r.principal.tenantId=otherId],['operation',r=>r.operation.id=MODE_READ_OPERATIONS[1]],['hash',r=>r.requestSha256='b'.repeat(64)],
])test(`native mode ${label} substitution cannot establish local context`,async()=>{
 const f=fixture();f.state.mutate=(r,p)=>{if(p===modePath)mutate(r);};await failure(f.read(f.request()),'ACCESS_DENIED');assert.equal(f.state.calls.length,2);
});

for(const [label,mutate] of [
 ['extra',r=>r.extra='PRIVATE'],['surface',r=>r.surface='explorer'],['missing mode',r=>delete r.evidenceAccuracyMode],['mode boolean',r=>r.evidenceAccuracyMode=false],['mode spelling',r=>r.evidenceAccuracyMode='OFF'],
 ['mode null',r=>r.evidenceAccuracyMode=null],['operation extra',r=>r.operation.tenantId=uuid('b')],['operation version',r=>r.operation.version='0.1.0'],['operation unsupported',r=>r.operation.id='search_client_knowledge'],
 ['principal extra',r=>r.principal.role='standard_user'],['principal invalid',r=>r.principal.actorId='PRIVATE'],['wrapper',r=>{r.result=structuredClone(r);delete r.evidenceAccuracyMode;}],
])test(`closed native mode result rejects ${label}`,async()=>{
 const f=fixture();f.state.mutate=(r,p)=>{if(p===modePath)mutate(r);};await failure(f.read(f.request()),'INVALID_RESULT');assert.equal(f.state.calls.length,2);
});

for(const [label,response] of [
 ['403',()=>new Response('PRIVATE',{status:403})],['500',()=>new Response('PRIVATE',{status:500})],['204',()=>new Response(null,{status:204})],['wrong media',()=>new Response('{}',{status:201})],
 ['encoding',()=>new Response('{}',{status:201,headers:{'content-type':'application/json','content-encoding':'gzip'}})],['declared overflow',()=>new Response('{}',{status:201,headers:{'content-type':'application/json','content-length':'4097'}})],
 ['stream overflow',()=>new Response(' '.repeat(4097),{status:201,headers:{'content-type':'application/json'}})],['byte mismatch',()=>new Response('{}',{status:201,headers:{'content-type':'application/json','content-length':'3'}})],
 ['malformed JSON',()=>new Response('{',{status:201,headers:{'content-type':'application/json'}})],['invalid UTF8',()=>new Response(new Uint8Array([0xc3,0x28]),{status:201,headers:{'content-type':'application/json'}})],
 ['redirect',r=>{const response=Response.json(r,{status:201});Object.defineProperty(response,'redirected',{value:true});return response;}],['proxy',r=>new Proxy(Response.json(r),{get(){throw Error('PRIVATE');}})],
])test(`bounded mode HTTP ${label} releases no local context or fallback`,async()=>{
 const f=fixture();f.state.response=(r,p)=>p===modePath?response(r):Response.json(r);await failure(f.read(f.request()));assert.equal(f.state.calls.length,2);
});

test('strict bounded JSON stream accepts exactly4096 bytes and a split chunk boundary',async()=>{
 const f=fixture();f.state.response=(r,p)=>{if(p!==modePath)return Response.json(r);const json=JSON.stringify(r),bytes=Buffer.from(json+' '.repeat(4096-Buffer.byteLength(json)),'utf8');return new Response(new ReadableStream({start(c){c.enqueue(bytes.subarray(0,17));c.enqueue(bytes.subarray(17));c.close();}}),{status:201,headers:{'content-type':'application/json; charset=utf-8','content-encoding':'identity','content-length':'4096'}});};
 assert.equal((await f.read(f.request())).evidenceAccuracyMode,'off');assert.equal(f.state.calls.length,3);
});

test('native service-secret rejection remains unavailable and does not invoke a legacy or identity-only fallback',async()=>{
 const f=fixture();f.state.response=(r,p)=>p===modePath?new Response('PRIVATE native denied secret',{status:403}):Response.json(r);
 await failure(f.read({...f.request(),serviceSecret:'SYNTHETIC_FOREIGN'}),'UNAVAILABLE');assert.equal(f.state.calls.length,2);assert.equal(f.state.calls[1].init.headers['x-internal-service-secret'],'SYNTHETIC_FOREIGN');
});

test('closed caller shape, finite operation, header tokens and hash reject before identity or source IO',async()=>{
 const f=fixture();let touched=0;const cases=[{operation:{id:'search_client_knowledge',version:'0.2.0'}},{operation:{id:MODE_READ_OPERATIONS[0],version:'0.1.0'}},{operation:{id:MODE_READ_OPERATIONS[0],version:'0.2.0',tenantId:uuid('b')}},
  {operation:null},{operation:{get id(){touched++;return MODE_READ_OPERATIONS[0];},version:'0.2.0'}},{requestSha256:'D'.repeat(64)},{requestSha256:'d'.repeat(63)},{requestSha256:null},{requestSha256:7},
  {serviceSecret:''},{serviceSecret:'bad token'},{serviceSecret:'bad\r\nPRIVATE'},{serviceSecret:'é'},{serviceSecret:'x'.repeat(8193)},{serviceSecret:null},{credential:'bad token'},{credential:'é'},{deadlineMs:1.5},
  {headers:{cookie:'PRIVATE'}},{tenantId:uuid('b')},{url:origin+'/other'},{signal:{}},{get serviceSecret(){touched++;return 'PRIVATE';}}];
 for(const changes of cases){const call=Object.defineProperties({...f.request()},Object.getOwnPropertyDescriptors(changes));await failure(f.read(call),'INVALID_ARGUMENTS');}
 await failure(f.read(new Proxy(f.request(),{get(){touched++;throw Error('PRIVATE');}})),'INVALID_ARGUMENTS');assert.equal(touched,0);assert.equal(f.state.calls.length,0);
 const noSecret=f.request();delete noSecret.serviceSecret;await failure(f.read(noSecret),'INVALID_ARGUMENTS');assert.equal(f.state.calls.length,0);
});

test('configuration is inert and rejects routes, headers, proxy ports and invalid request windows',()=>{
 const f=fixture();let touched=0;for(const changes of [{origin:origin+'/route'},{origin:'http://native-core.example.invalid'},{headers:{cookie:'PRIVATE'}},{maxRequestMs:0},{maxRequestMs:3001},{maxRequestMs:1.5},{authorityClient:null},{fetchImpl:undefined},{now:undefined},
  {fetchImpl:new Proxy(()=>{},{apply(){touched++;}})},{authorityClient:{get readIdentity(){touched++;return ()=>{};}}},{get origin(){touched++;return origin;}}]){
  const c=Object.defineProperties({...f.configuration},Object.getOwnPropertyDescriptors(changes));assert.throws(()=>createReadModeObservationReader(c),{message:'CONFIGURATION'});
 }
 assert.equal(touched,0);assert.equal(f.state.calls.length,0);
});

test('unavailable reader and unavailable Core client expose the method without invoking any owner',async()=>{
 const f=fixture(),read=createReadModeObservationReader({available:false,now:f.now,maxRequestMs:3000});await failure(read(f.request()),'UNAVAILABLE');
 const core=createNativeToolAuthorityClient({now:f.now});assert.equal(core.available,false);assert.equal(typeof core.readModeObservation,'function');await failure(core.readModeObservation(f.request()),'UNAVAILABLE');assert.equal(f.state.calls.length,0);
});

test('actual Core-client method composes the same existing identity HTTP owner and fixed mode reader',async()=>{
 const f=fixture(),core=createNativeToolAuthorityClient({origin,fetchImpl:f.configuration.fetchImpl,now:f.now,enabled:true});
 assert.equal(core.available,true);assert.equal((await core.readModeObservation(f.request())).evidenceAccuracyMode,'off');assert.deepEqual(f.state.calls.map(c=>c.path),[identityPath,modePath,identityPath]);
 for(const method of ['readCurrent','readConversation','readClientReference'])assert.equal(typeof core[method],'function');
});

test('pre-abort and elapsed deadline refuse before identity and mode HTTP',async()=>{
 const f=fixture();await failure(f.read({...f.request(),signal:AbortSignal.abort()}),'CANCELLED');await failure(f.read({...f.request(),deadlineMs:f.now()}),'DEADLINE');assert.equal(f.state.calls.length,0);
});

test('invalid or regressing clock and expiry reached after HTTP cannot establish a mode',async()=>{
 for(const at of [-1,NaN,Number.MAX_SAFE_INTEGER]){const f=fixture();f.state.now=at;await failure(f.read({...f.request(),deadlineMs:1800000003000}),'ACCESS_DENIED');assert.equal(f.state.calls.length,0);}
 const g=fixture(),at=g.now(),read=createReadModeObservationReader({...g.configuration,authorityClient:{async readIdentity(){g.state.now=at-1;return identityFact(g);}}});await failure(read(g.request()),'ACCESS_DENIED');assert.equal(g.state.calls.length,0);
 const f=fixture(),began=f.now();f.state.beforeResponse=p=>{if(p===modePath)f.state.now=began+30;};await failure(f.read({...f.request(),deadlineMs:began+30}),'DEADLINE');assert.equal(f.state.calls.length,2);
});

test('cancellation retires late mode body and does not run another identity call',async()=>{
 const f=fixture(),abort=new AbortController();let release,entered,cancelled=false;const ready=new Promise(resolve=>entered=resolve);
 f.state.response=(r,p)=>p!==modePath?Response.json(r):new Promise(resolve=>{release=resolve;entered();});
 const pending=f.read({...f.request(),signal:abort.signal});await ready;abort.abort();await failure(pending,'CANCELLED');
 release(new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:201,headers:{'content-type':'application/json'}}));await turn();assert.equal(cancelled,true);assert.equal(f.state.calls.length,2);assert.equal(f.state.calls[1].init.signal.aborted,true);
});

test('configured request window bounds an uncooperative native wait and cancels its late body',async()=>{
 const f=fixture({maxRequestMs:40});let release,cancelled=false;f.state.response=(r,p)=>p!==modePath?Response.json(r):new Promise(resolve=>release=resolve);
 await failure(f.read(f.request()),'DEADLINE');release(new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:201,headers:{'content-type':'application/json'}}));await turn();assert.equal(cancelled,true);assert.equal(f.state.calls.length,2);
});

test('stream cancellation discards incomplete mode JSON and retires its body reader',async()=>{
 const f=fixture(),abort=new AbortController();let entered,cancelled=false;const ready=new Promise(resolve=>entered=resolve);
 f.state.response=(r,p)=>p!==modePath?Response.json(r):new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('{"operation":'));entered();},cancel(){cancelled=true;}}),{status:201,headers:{'content-type':'application/json'}});
 const pending=f.read({...f.request(),signal:abort.signal});await ready;abort.abort();await failure(pending,'CANCELLED');await turn();assert.equal(cancelled,true);assert.equal(f.state.calls.length,2);
});

test('rejected acquired HTTP body is cancelled without waiting or closing the borrowed identity client',async()=>{
 const f=fixture();let cancelled=false;f.state.response=(r,p)=>p!==modePath?Response.json(r):new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:403,headers:{'content-type':'application/json'}});
 await failure(f.read(f.request()),'UNAVAILABLE');await turn();assert.equal(cancelled,true);assert.equal(typeof f.authorityClient.readIdentity,'function');assert.equal(f.state.calls.length,2);
});

test('local projection validator binds exact fields, operation/hash, canonical identity and3s lifetime',async()=>{
 const f=fixture(),call=f.request(),out=await f.read(call),options={started:f.now(),now:f.now,operation:call.operation,requestSha256:sha,deadlineMs:call.deadlineMs};assert.deepEqual(assertNativeReadModeObservation(out,options),out);
 for(const mutate of [r=>r.operation.id=MODE_READ_OPERATIONS[1],r=>r.operation.extra=true,r=>r.operation.version='0.1.0',r=>r.requestSha256='b'.repeat(64),r=>r.evidenceAccuracyMode='PRIVATE',r=>r.principal.actorId='PRIVATE',r=>r.identityRevision='opaque',
  r=>r.checkedAtMs--,r=>r.checkedAtMs++,r=>r.expiresAtMs=f.now(),r=>r.expiresAtMs=call.deadlineMs+1,r=>r.surface='chat',r=>delete r.requestSha256]){
  const value=structuredClone(out);mutate(value);assert.throws(()=>assertNativeReadModeObservation(value,options),{message:'ACCESS_DENIED'});
 }
 for(const changes of [{started:-1},{started:Number.MAX_SAFE_INTEGER},{requestSha256:'D'.repeat(64)},{operation:{id:'query_knowledge_graph',version:'0.2.0'}},{now:()=>options.started-1}])assert.throws(()=>assertNativeReadModeObservation(out,{...options,...changes}),{message:'ACCESS_DENIED'});
 let touched=0;assert.throws(()=>assertNativeReadModeObservation({...out,get evidenceAccuracyMode(){touched++;return 'off';}},options),{message:'ACCESS_DENIED'});assert.throws(()=>assertNativeReadModeObservation(new Proxy(out,{get(){touched++;}}),options),{message:'ACCESS_DENIED'});assert.equal(touched,0);
});
