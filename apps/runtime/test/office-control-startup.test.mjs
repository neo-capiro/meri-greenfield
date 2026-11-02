// Parent integration proof: real startControl/assembleControl/documents/retention/
// Office adapters. Only SQL, S3, Temporal, candidate transport, discovery and
// listener transport are scripted. No service, real key or provider operation.
// The rendered-shape case boots the exact `office` block render-material.mjs emits.
import test from 'node:test';
import assert from 'node:assert/strict';
import {startControl,assembleControl} from '../control.mjs';
import {listenRuntime} from '../http-server.mjs';
const nativeFetch=globalThis.fetch;
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {createProductPortsFactory} from '../product-ports/index.mjs';
import {documentsFamily} from '../product-ports/documents.mjs';
import {binding,scopes,id} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {OFFICE_ROUTES,OFFICE_SCHEMA} from '../../../packages/contracts/dist/office-application.mjs';
import {OFFICE_UNAVAILABLE_EVENT,OFFICE_AVAILABLE_EVENT,OFFICE_RETRY_MS,startOfficeDiscovery} from '../artifacts/office-composition.mjs';
import {renderOfficeControl,officeSigningKey,PATHS} from '../../../infra/product-preview/first-chat/render-material.mjs';
const office=c=>({enabled:true,editorOrigin:'https://office.example.test',wopiOrigin:'https://wopi.example.test',browserOrigin:c.http.frontendOrigin,coreOrigin:'https://core.synthetic.invalid',keyFile:'/run/meri/office.key',serviceSecretFile:'/run/meri/core.secret'});
const xml=Buffer.from('<wopi-discovery><net-zone name="external-https"><app><action ext="docx" name="edit" urlsrc="https://office.example.test/browser/synthetic/cool.html?"/></app></net-zone></wopi-discovery>');
const absentObject=()=>Object.assign(Error('synthetic empty ledger'),{name:'NoSuchKey',$metadata:{httpStatusCode:404}});
function fixture(t,{enabled=true,discovery='valid',publicFailure=false,actualListener=false,rendered=false}={}){
 const c=structuredClone(agentcoreControlFixture().configuration),key=rendered?officeSigningKey():Buffer.alloc(32,41),events=[],closed=[],listeners={},logs=[],state={assembly:null,context:null,authorityCalls:[],sql:[],leases:0,released:0,watermark:{sequence:0,entry_sha256:null},fetches:0,officeReads:0,closeCalls:0,listenerAddresses:{},listenerCloseCounts:{private:0,public:0},discovery};
 c.retention={enabled:true};c.artifacts={enabled:true,region:'us-east-1',bucket:'synthetic-office-bucket',prefix:'meri-artifacts',expectedBucketOwner:'111122223333',kmsKeyId:'arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001',authority:{origin:'https://core.synthetic.invalid',serviceSecretFile:'/run/meri/core.secret'}};
 // The rendered shape: the renderer's exact control block (WOPI at the control private origin, the reads secret file reused) and its generated key.
 if(rendered){c.artifacts.authority.serviceSecretFile=PATHS.readsServiceSecret;c.office=renderOfficeControl({enabled:true,editorOrigin:'https://office.example.test'},{coreOrigin:'https://core.synthetic.invalid',frontendOrigin:c.http.frontendOrigin,controlPrivate:c.privateHttp.frontendOrigin});}
 else c.office=enabled?office(c):{enabled:false};
 const keyFile=c.office.keyFile;
 t.mock.method(process.stderr,'write',chunk=>{logs.push(String(chunk));return true;});
 const finish=name=>async()=>{closed.push(name);};
 async function query(sql,args=[]){
  state.sql.push(sql);
  if(sql.startsWith("SELECT to_regclass('meri_conversations.runs')"))return {rows:[{runs:'runs',events:'events',controls:'controls',selected_outputs:'selected_outputs',initial_inputs:'initial_inputs'}]};
  if(sql.startsWith('SELECT name,to_regclass(name)'))return {rows:args[0].map(name=>({name,relation:name}))};
  if(sql.startsWith('SELECT pg_advisory_unlock'))return {rows:[{unlocked:true}]};
  if(sql.startsWith('SELECT pg_advisory_')||sql.startsWith('BEGIN')||sql.startsWith('SET LOCAL ')||['COMMIT','ROLLBACK'].includes(sql))return {rows:[]};
  if(sql.startsWith('INSERT INTO meri_conversations.retention_recovery_watermark')){state.watermark={sequence:args[0],entry_sha256:args[1]??null};return {rows:[{...state.watermark}]};}
  if(sql.startsWith('SELECT sequence,entry_sha256 FROM meri_conversations.retention_recovery_watermark'))return {rows:[{...state.watermark}]};
  assert.fail('unexpected SQL: '+sql);
 }
 const pool={query,async connect(){state.leases++;let released=false;return {query,release(error){assert.equal(error,undefined);assert.equal(released,false);released=true;state.released++;}};},end:finish('pool')};
 const connection={withDeadline:async(_at,fn)=>fn(),withAbortSignal:async(signal,fn)=>{signal.throwIfAborted();return fn();},workflowService:{async describeNamespace(){return {};}},close:finish('connection')};
 const identityContext={verifyIdentity:async()=>({principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'synthetic',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000}),resolveContext:async({identity})=>({identitySha256:canonicalSha256(identity),binding,scopes,selectedClientId:id(5),contextRevision:'synthetic',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000})};
 const candidate={execution:{authenticate(){assert.fail('no private execution');}},native:{async readiness(){},async call(){assert.fail('no native operation');}},productPorts:{identityContext},application:{handle:async()=>null},bindApplication(){events.push('candidate-bind');},close:finish('candidate')};
 const s3={async send(command){events.push(command.constructor.name);if(command.constructor.name==='GetObjectCommand')throw absentObject();if(command.constructor.name==='GetBucketVersioningCommand')return {Status:'Enabled'};assert.fail('unexpected S3: '+command.constructor.name);}};
 const family=documentsFamily({authority:{async resolve(call){state.authorityCalls.push(call);return null;}},executor:{execute(){assert.fail('no rendering');}},createS3Client:()=>s3});
 const productPortsFactory=createProductPortsFactory({families:[['documents',context=>{state.context=context;return family(context);}]]});
 t.mock.method(globalThis,'fetch',async url=>{state.fetches++;assert.equal(url,'https://office.example.test/hosting/discovery');if(state.discovery==='failed')throw Error('synthetic discovery failure');return {status:200,url,redirected:false,headers:new Headers(),body:new Response(state.discovery==='malformed'?Buffer.from('bad'):xml).body};});
 const owners={readMaterial:async path=>{if(path===keyFile){state.officeReads++;return key;}if(path===c.database.connectionFile)return Buffer.from('postgresql://database.synthetic.invalid/meri?sslmode=verify-full');if(path===c.native.capabilityFile)return Buffer.from('synthetic-control-startup-only-long-credential');assert.fail('unexpected material read');},
  tls:async()=>({synthetic:true}),createPool:()=>pool,connect:async()=>connection,createClient:()=>({workflow:{start(){assert.fail('no dispatch');},getHandle(){assert.fail('no dispatch');}}}),startCandidate:async()=>candidate,
  assemble(options){const actual=assembleControl(options);state.assembly=actual;return {...actual,async close(){state.closeCalls++;return actual.close();}};},
  listen:async options=>{const role=options.configuration.http.port===c.privateHttp.port?'private':'public';events.push('listen:'+role);
  if(actualListener){const actual=await listenRuntime({...options,configuration:{...options.configuration,http:{...options.configuration.http,hostname:'127.0.0.1',port:0}}});
   let closedFlag=false;const actualClose=actual.close.bind(actual);const wrapped={...actual,close(){if(closedFlag)return Promise.resolve();closedFlag=true;state.listenerCloseCounts[role]++;return actualClose();}};
   listeners[role]=wrapped;state.listenerAddresses[role]=actual.address;return wrapped;}
  listeners[role]=options.application;if(role==='public'&&publicFailure)throw Error('synthetic public bind failure');return {address:{address:'127.0.0.1',port:options.configuration.http.port},close:finish(role)};}};
 const controller=new AbortController();
 const officeEvents=()=>logs.flatMap(line=>{try{const e=JSON.parse(line);return typeof e.event==='string'&&e.event.startsWith('runtime.office.')?[e]:[];}catch{return [];}});
 return {c,key,state,events,closed,listeners,controller,officeEvents,start:()=>startControl(c,{testOwners:owners,productPortsFactory,signal:controller.signal})};
}
const request=(route,body={},credential)=>new Request('https://control.synthetic.invalid/api/meri/office/'+route,{method:'POST',headers:{'content-type':'application/json',...(credential?{authorization:'Bearer '+credential}:{})},body:JSON.stringify(body)});
function input(route){if(route==='import')return {schema:OFFICE_SCHEMA,uploadId:id(850),sha256:'a'.repeat(64),operation:'import'};const key={schema:OFFICE_SCHEMA,draftId:id(700),versionId:id(901)};if(route==='inspect')return {schema:OFFICE_SCHEMA,versionId:key.versionId};if(route==='launch')return {...key,operation:'acquire',editorId:id(701),expectedEpoch:0,mode:'edit'};if(route==='renew')return {...key,editorId:id(701),expectedEpoch:1,mode:'edit'};if(route==='release')return {...key,editorId:id(701),expectedEpoch:1};if(route==='publish')return {...key,sequence:1,sha256:'a'.repeat(64)};return key;}
const wopi=(origin='https://wopi.example.test')=>new Request(origin+'/api/meri/office/wopi/files/'+id(700)+'?access_token=bad');
test('enabled actual Control composition reaches real Office adapters on the correct listeners',async t=>{
 const f=fixture(t),runtime=await f.start();
 try{
  assert.deepEqual(f.events.filter(e=>e.startsWith('listen:')),['listen:private','listen:public']);assert.equal(f.state.assembly.retention.serving.isEnabled(),true);
  assert.equal(f.state.fetches,1);assert.equal(f.state.officeReads,1);assert.equal(f.state.context.now,Date.now);
  const session=await f.state.assembly.sessions.issue({identityCredential:'synthetic-member'});
  for(const route of OFFICE_ROUTES){
   const unauth=await f.listeners.public.handle(request(route,input(route)));assert.equal(unauth.status,401,route);assert.equal((await unauth.json()).error.code,'UNAUTHENTICATED');
   const malformed=await f.listeners.public.handle(request(route,{},session.credential));assert.equal(malformed.status,400,route);
   const real=await f.listeners.public.handle(request(route,input(route),session.credential));assert.equal(real.status,503,route);assert.equal((await real.json()).error.code,'UNAVAILABLE');
   assert.equal((await f.listeners.private.handle(request(route,input(route),session.credential))).status,404);
  }
  assert.equal(f.state.authorityCalls.length,OFFICE_ROUTES.length);assert.ok(f.state.authorityCalls.every(call=>call.sessions===f.state.assembly.sessions&&call.store===f.state.assembly.store));
  assert.equal((await f.listeners.private.handle(wopi())).status,401);assert.equal((await f.listeners.public.handle(wopi())).status,404);assert.equal((await f.listeners.public.handle(request('unknown'))).status,404);
  f.state.assembly.sessions.revoke(session.credential);const denied=await f.listeners.public.handle(request('open',input('open'),session.credential));assert.equal(denied.status,403);
 }finally{await runtime.close();await runtime.close();}
 assert.ok(f.key.every(b=>b===0));assert.equal(f.state.closeCalls,1);assert.equal(f.state.leases,f.state.released);assert.deepEqual([...f.closed].sort(),['candidate','connection','pool','private','public']);
});
test('disabled Office touches no Office material or discovery and its routes stay absent',async t=>{
 const f=fixture(t,{enabled:false}),runtime=await f.start();try{for(const route of OFFICE_ROUTES)assert.equal((await f.listeners.public.handle(request(route))).status,404);assert.equal((await f.listeners.private.handle(wopi())).status,404);assert.equal(f.state.fetches,0);assert.equal(f.state.officeReads,0);}finally{await runtime.close();}
});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const discovery of ['failed','malformed'])test(`${discovery} discovery degrades: control listens, Office answers UNAVAILABLE, one event, and a backoff retry mounts the real adapters`,async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture(t,{discovery}),runtime=await f.start();
 try{
  assert.deepEqual(f.events.filter(e=>e.startsWith('listen:')),['listen:private','listen:public']);assert.equal(f.state.fetches,1);assert.equal(f.state.officeReads,1);
  assert.equal(f.state.assembly.office.mounted(),false);assert.equal(f.key.every(b=>b===0),false);
  const session=await f.state.assembly.sessions.issue({identityCredential:'synthetic-member'});
  for(const route of OFFICE_ROUTES){const r=await f.listeners.public.handle(request(route,input(route),session.credential));assert.equal(r.status,503,route);assert.deepEqual(await r.json(),{schema:OFFICE_SCHEMA,error:{code:'UNAVAILABLE',outcome:'NOT_DISPATCHED'}});}
  assert.equal((await f.listeners.private.handle(wopi())).status,503);assert.equal((await f.listeners.public.handle(wopi())).status,404);
  assert.deepEqual(f.officeEvents().map(e=>[e.event,e.retryMs]),[[OFFICE_UNAVAILABLE_EVENT,OFFICE_RETRY_MS.initial]]);
  assert.equal(typeof f.officeEvents()[0].code,'string');
  // Still down after the first backoff: a second attempt, no second event, and the delay doubles.
  t.mock.timers.tick(OFFICE_RETRY_MS.initial);await settle();
  assert.equal(f.state.fetches,2);assert.equal(f.officeEvents().length,1);assert.equal(f.state.assembly.office.mounted(),false);
  // The editor comes back: the doubled backoff fires, discovery succeeds, the real adapters mount and one recovery event is logged.
  f.state.discovery='valid';t.mock.timers.tick(OFFICE_RETRY_MS.initial*2);await settle();
  assert.equal(f.state.fetches,3);assert.equal(f.state.assembly.office.mounted(),true);assert.equal(f.state.officeReads,1);
  assert.deepEqual(f.officeEvents().map(e=>[e.event,e.attempts]),[[OFFICE_UNAVAILABLE_EVENT,undefined],[OFFICE_AVAILABLE_EVENT,3]]);
  for(const route of OFFICE_ROUTES){const r=await f.listeners.public.handle(request(route,input(route),session.credential));assert.equal(r.status,503,route);assert.equal((await r.json()).error.code,'UNAVAILABLE');
   assert.equal((await f.listeners.public.handle(request(route,input(route)))).status,401,route);}
  assert.equal((await f.listeners.private.handle(wopi())).status,401);
  t.mock.timers.tick(OFFICE_RETRY_MS.max);await settle();assert.equal(f.state.fetches,3);
 }finally{await runtime.close();}
 assert.ok(f.key.every(b=>b===0));assert.equal(f.state.closeCalls,1);assert.equal(f.state.leases,f.state.released);assert.deepEqual([...f.closed].sort(),['candidate','connection','pool','private','public']);
});
test('closing a degraded control stops the discovery retry and zeroes the held key',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture(t,{discovery:'failed'}),runtime=await f.start();
 assert.equal(f.state.fetches,1);await runtime.close();assert.ok(f.key.every(b=>b===0));
 f.state.discovery='valid';t.mock.timers.tick(OFFICE_RETRY_MS.max*2);await settle();
 assert.equal(f.state.fetches,1);assert.equal(f.state.assembly.office.mounted(),false);assert.equal(f.officeEvents().length,1);
});
test('an unreadable signing key still refuses startup: the key is deployment material, not editor availability',async t=>{
 const f=fixture(t);f.c.office={...f.c.office,keyFile:'/run/meri/office-missing.key'};
 await assert.rejects(f.start(),{code:'CONTROL_STARTUP_FAILED'});assert.equal(f.events.some(e=>e.startsWith('listen:')),false);assert.equal(f.state.fetches,0);assert.deepEqual([...f.closed].sort(),['candidate','connection','pool']);
});
test('the rendered office block (render-material.mjs) boots the real adapters against the scripted discovery endpoint',async t=>{
 const f=fixture(t,{rendered:true}),runtime=await f.start();
 try{
  assert.deepEqual(f.c.office,{enabled:true,editorOrigin:'https://office.example.test',wopiOrigin:f.c.privateHttp.frontendOrigin,browserOrigin:f.c.http.frontendOrigin,coreOrigin:'https://core.synthetic.invalid',keyFile:PATHS.officeKey,serviceSecretFile:PATHS.readsServiceSecret});
  assert.equal(f.state.fetches,1);assert.equal(f.state.officeReads,1);assert.equal(f.state.assembly.office.mounted(),true);assert.deepEqual(f.officeEvents(),[]);
  const session=await f.state.assembly.sessions.issue({identityCredential:'synthetic-member'});
  for(const route of OFFICE_ROUTES){assert.equal((await f.listeners.public.handle(request(route,input(route)))).status,401,route);const real=await f.listeners.public.handle(request(route,input(route),session.credential));assert.equal(real.status,503,route);assert.equal((await real.json()).error.code,'UNAVAILABLE');}
  assert.equal((await f.listeners.private.handle(wopi(f.c.privateHttp.frontendOrigin))).status,401);assert.equal((await f.listeners.public.handle(wopi(f.c.privateHttp.frontendOrigin))).status,404);
 }finally{await runtime.close();}
 assert.ok(f.key.every(b=>b===0));
});
test('public bind failure closes existing private listener and composed Office exactly once',async t=>{
 const f=fixture(t,{publicFailure:true});await assert.rejects(f.start(),{code:'CONTROL_STARTUP_FAILED'});assert.deepEqual(f.events.filter(e=>e.startsWith('listen:')),['listen:private','listen:public']);assert.equal(f.state.closeCalls,1);assert.ok(f.key.every(b=>b===0));assert.deepEqual([...f.closed].sort(),['candidate','connection','pool','private']);assert.equal(f.state.leases,f.state.released);assert.throws(()=>f.state.assembly.office.current().codec.issue({}),{code:'WOPI_TOKEN_CONFIGURATION'});
});

test('actual loopback listeners mount the real Office adapters on ephemeral ports',async t=>{
 const f=fixture(t,{actualListener:true}),runtime=await f.start();
 const publicBase='http://127.0.0.1:'+f.listeners.public.address.port,privateBase='http://127.0.0.1:'+f.listeners.private.address.port;
 const call=(base,path,init)=>nativeFetch(base+path,init);
 try{
  for(const route of OFFICE_ROUTES){
   const post=call(publicBase,'/api/meri/office/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input(route))});
   const response=await post;assert.equal(response.status,401,route);assert.equal((await response.json()).error.code,'UNAUTHENTICATED',route);
   assert.equal((await call(privateBase,'/api/meri/office/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input(route))})).status,404);
  }
  assert.equal((await call(publicBase,'/api/meri/office/wopi/files/x')).status,404);
  assert.equal((await call(privateBase,'/api/meri/office/wopi/files/x?access_token=bad')).status,401);
  assert.equal((await call(publicBase,'/api/meri/office/unknown',{method:'POST'})).status,404);
 }finally{await runtime.close();}
 await assert.rejects(call(publicBase,'/api/meri/office/open',{method:'POST'}));
});

test('a throwing log never fails an attempt or schedules a retry against an already mounted office',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let down=true,mounted=false,fetches=0;const logs=[];
 const fetchImpl=async url=>{fetches++;if(down)throw Error('synthetic');return {status:200,url,redirected:false,headers:new Headers(),body:new Response(xml).body};};
 const mount={mounted:()=>mounted,mount(bytes){if(mounted)throw Error('already mounted');assert.ok(bytes instanceof Uint8Array);mounted=true;}};
 const log=line=>{logs.push(line.event);throw Error('synthetic log failure');};
 const discovery=startOfficeDiscovery({office:{enabled:true,editorOrigin:'https://office.example.test'},mount,fetchImpl,log});
 assert.equal(await discovery.first,false);assert.deepEqual(logs,[OFFICE_UNAVAILABLE_EVENT]);
 down=false;t.mock.timers.tick(OFFICE_RETRY_MS.initial);await settle();
 assert.equal(mounted,true);assert.equal(fetches,2);assert.deepEqual(logs,[OFFICE_UNAVAILABLE_EVENT,OFFICE_AVAILABLE_EVENT]);
 t.mock.timers.tick(OFFICE_RETRY_MS.max*2);await settle();assert.equal(fetches,2);discovery.close();
});
