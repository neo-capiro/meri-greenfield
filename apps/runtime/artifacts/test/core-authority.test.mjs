/** Artifact current-authority wire: golden vectors (docs/integration/artifact-current-authority.vector.json), the fixed Core client,
 * credential custody, the in-process authority over control's REAL action-session owner, and the composed documents family through
 * the runtime document application. SYNTHETIC only: scripted Core replies over an in-memory fetch, placeholder credentials, a
 * synthetic S3 client and an unused pool. No network, AWS, database or real credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {ARTIFACT_AUTHORITY_CONTRACT,ARTIFACT_AUTHORITY_ROUTE,INTENT_OPERATIONS,MAX_RECEIPT_TTL_MS,assertArtifactAuthorityRequest,assertArtifactAuthorityReceipt,
 artifactAuthorityStatusCode} from '../core-authority-wire.mjs';
import {createCoreArtifactAuthorityClient} from '../core-authority-client.mjs';
import {createArtifactAuthorityCredentials} from '../authority-credentials.mjs';
import {createCoreArtifactAuthority} from '../core-authority.mjs';
import {composeDocumentsFamily} from '../authority-composition.mjs';
import {createRuntimeArtifactApplication} from '../application.mjs';
import {bindDocumentsSessions} from '../session-binding.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';

const vector=JSON.parse(readFileSync(new URL('../../../../docs/integration/artifact-current-authority.vector.json',import.meta.url),'utf8'));
const code=c=>e=>{assert.equal(e?.code,c,`expected ${c}, got ${e?.code} (${e?.message})`);return true;};
const ORIGIN='https://core.synthetic.invalid';
const SECRET='synthetic-core-service-secret',BEARER='synthetic-native-bearer-1',CONTROL='synthetic-marked-control-credential';
const ids={tenantId:'00000000-0000-4000-8000-00000000a001',actorId:'00000000-0000-4000-8000-00000000a002',conversationId:'00000000-0000-4000-8000-00000000c001',
 runId:'00000000-0000-4000-8000-00000000c002',attemptId:'00000000-0000-4000-8000-00000000c003',workerId:'00000000-0000-4000-8000-00000000c004',clientId:'00000000-0000-4000-8000-00000000d001'};
const binding={tenantId:ids.tenantId,actorId:ids.actorId,conversationId:ids.conversationId,runId:ids.runId,attemptId:ids.attemptId,workerId:ids.workerId,writerFence:1};
const scopes=[{tenantId:ids.tenantId,kind:'client',resourceId:ids.clientId,policyRevision:'r'.repeat(64)}];
const rev=label=>canonicalSha256({synthetic:label});
const limits={maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576};
const files={identity:'/run/meri/identity-credential',task:'/run/meri/task-capability',control:'/run/meri/control-capability',proxy:'/run/meri/proxy-credential',secret:'/run/meri/core-tool-service-secret'};
const nativeCandidate={identity:{origin:ORIGIN,credentialFile:files.identity},taskCapabilityFile:files.task,controlCapabilityFile:files.control,proxyCredentialFile:files.proxy};
function secretFiles(overrides={}){const bytes={[files.identity]:CONTROL,[files.task]:'synthetic-task-capability',[files.control]:'synthetic-control-capability',[files.proxy]:'synthetic-proxy-credential',[files.secret]:SECRET,...overrides},reads=[];
 const hooks={};return {reads,bytes,hooks,async readSecret(path){reads.push(path);hooks.onRead?.(path);if(!Object.hasOwn(bytes,path))throw Object.assign(Error('RUNTIME_SECRET_FILE'),{code:'RUNTIME_SECRET_FILE'});return Buffer.from(bytes[path]+'\n');}};}

/** Scripted Core receiver over an in-memory fetch: validates the wire exactly as the contract says, answers from `core`. */
function scriptedCore(){
 const core={calls:[],status:200,operations:['artifact.download','artifact.generate','artifact.inspect','artifact.preview-publish','artifact.revise'],limits:null,
  contextRevision:rev('context'),authorityRevision:rev('authority'),principal:{tenantId:ids.tenantId,actorId:ids.actorId},skewMs:-5000,ttlMs:60000,park:false,mutate:null,onCall:null,bearers:new Set([BEARER])};
 core.fetch=async(url,init)=>{
  const headers=init.headers,request=JSON.parse(init.body);
  core.calls.push({url,method:init.method,authorization:headers.authorization,service:headers['x-internal-service-secret'],request,init});core.onCall?.(core.calls.length);
  assert.equal(url,ORIGIN+ARTIFACT_AUTHORITY_ROUTE);assert.equal(init.method,'POST');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
  assert.deepEqual(Object.keys(headers).sort(),['accept','accept-encoding','authorization','content-type','x-internal-service-secret']);
  assert.deepEqual(assertArtifactAuthorityRequest(request),request);
  if(core.park)return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));
  if(headers['x-internal-service-secret']!==SECRET)return Response.json({message:'service identity'},{status:403});
  if(!core.bearers.has(headers.authorization.slice(7)))return Response.json({message:'unauthenticated'},{status:401});
  if(core.status!==200)return Response.json({message:'Application authority unavailable'},{status:core.status});
  const checkedAtMs=Date.now()+core.skewMs;
  let receipt={contract:ARTIFACT_AUTHORITY_CONTRACT,observationId:request.observationId,principal:core.principal,identityRevision:rev('identity'),conversationId:request.conversationId,
   selectedClientId:request.clientId,contextRevision:core.contextRevision,intent:request.intent,requestSha256:request.requestSha256,operations:core.operations,limits:core.limits,
   authorityRevision:core.authorityRevision,checkedAtMs,expiresAtMs:checkedAtMs+core.ttlMs};
  if(core.mutate)receipt=core.mutate(receipt);
  return Response.json(receipt);
 };
 return core;
}

/** Control's real process-local action-session owner over synthetic Core identity/context replies. */
async function liveSession({nativeCredential=BEARER,now=Date.now}={}){
 const state={revoked:false};
 const stamp=()=>({checkedAtMs:now(),expiresAtMs:now()+120000});
 const sessions=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:8,maxRequestMs:3000,maxTtlMs:120000,maxFactBytes:65536},
  async verifyIdentity({credential}){if(state.revoked||credential!==nativeCredential)throw Error('SYNTHETIC_IDENTITY_REFUSED');return {principal:{tenantId:ids.tenantId,actorId:ids.actorId},identityRevision:'synthetic-identity-1',...stamp()};},
  async resolveContext({identity,identitySha256}){if(identitySha256!==canonicalSha256(identity))throw Error('SYNTHETIC');return {identitySha256,binding:structuredClone(binding),scopes:structuredClone(scopes),selectedClientId:ids.clientId,contextRevision:'synthetic-context-1',...stamp()};}});
 const issued=await sessions.issue({identityCredential:nativeCredential});
 return {sessions,state,credential:issued.credential};
}
const descriptor=intent=>{const e=catalog.operations.find(x=>x.operation.id==='create_word');return {operation:e.operation,requiredGrants:e.requiredGrants,sourceRequirements:e.sourceRequirements};};
function scriptedRunOptions(){
 const run={calls:[],reply:'valid',maxBytes:2097152,credential:'synthetic-run-capability'};
 run.port={async read(call){run.calls.push(call);if(run.reply==='null')return null;
  return {allocationJson:'{"synthetic":true}',producerContext:{context:{binding:call.binding},producer:{synthetic:true}},descriptor:descriptor(call.intent),evidence:[],assets:[],maxBytes:run.maxBytes,
   authority:{async check(){throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}},credential:run.credential};}};
 return run;
}
async function authorityHarness({now=Date.now,nativeCredential}={}){
 const core=scriptedCore(),s=secretFiles(),run=scriptedRunOptions(),live=await liveSession({now,...(nativeCredential?{nativeCredential}:{})});
 const credentials=await createArtifactAuthorityCredentials({configuration:{nativeCandidate},serviceSecretFile:files.secret,readSecret:s.readSecret});
 const client=createCoreArtifactAuthorityClient({origin:ORIGIN,fetchImpl:core.fetch,now});
 const authority=createCoreArtifactAuthority({client,credentials,runOptions:run.port,now,limits});
 const call=(intent,body,extra={})=>({sessions:live.sessions,credential:live.credential,intent,body,requestSha256:canonicalSha256({intent,body}),deadlineMs:now()+5000,...extra});
 return {core,s,run,live,authority,call,now};
}
const createBody={deliveryId:'synthetic-delivery-1',request:{operation:'create_word',format:'txt',title:'Synthetic',content:{text:'Synthetic document body'}}};

test('golden vectors: exact request bytes and digest, accepted receipts, every listed refusal, status mapping',()=>{
 assert.equal(vector.contract,ARTIFACT_AUTHORITY_CONTRACT);assert.equal(vector.route.path,ARTIFACT_AUTHORITY_ROUTE);assert.equal(vector.transport.maxReceiptTtlMs,MAX_RECEIPT_TTL_MS);
 assert.deepEqual(vector.intentOperations,JSON.parse(JSON.stringify(INTENT_OPERATIONS)));
 assert.doesNotMatch(JSON.stringify(vector),/action_session_|eyJ|sk_live|Bearer [A-Za-z0-9]/u,'placeholders only');
 for(const k of vector.cases){
  assert.equal(canonicalSha256(k.meriRequest),k.request.requestSha256,k.name);
  const request=assertArtifactAuthorityRequest(k.request);assert.equal(JSON.stringify(request),k.requestJson,k.name);
  assert.deepEqual(assertArtifactAuthorityReceipt(k.receipt,k.request),k.receipt,k.name);
  assert.equal(k.meriClock.localExpiresAtMs,k.meriClock.startedAtMs+(k.receipt.expiresAtMs-k.receipt.checkedAtMs));
 }
 const [first]=vector.cases;assert.equal(vector.receiptRefusalsApplyTo,'cases[0]');
 for(const r of vector.receiptRefusals){const receipt=structuredClone(first.receipt);Object.assign(receipt,r.patch??{});if(r.remove)delete receipt[r.remove];
  assert.throws(()=>assertArtifactAuthorityReceipt(receipt,first.request),code(vector.refusalCode),r.name);}
 for(const row of vector.statusMapping)if(typeof row.status==='number'&&row.status!==200)assert.equal(artifactAuthorityStatusCode(row.status),row.meri,String(row.status));
 for(const bad of [{...first.request,observationId:'00000000-0000-1000-8000-00000000e001'},{...first.request,intent:'delete'},{...first.request,clientId:first.request.clientId.toUpperCase()},{...first.request,extra:1}])
  assert.throws(()=>assertArtifactAuthorityRequest(bad),code('ACCESS_DENIED'));
});

test('client: the golden request on the wire, Meri-clock receipt timing, and closed status/body/deadline refusals',async()=>{
 const [k]=vector.cases,times=[k.meriClock.startedAtMs,k.meriClock.observedAtMs],seen=[];let reply=()=>Response.json(k.receipt);
 const now=()=>times.length>1?times.shift():times[0];
 const client=createCoreArtifactAuthorityClient({origin:ORIGIN,now,newObservationId:()=>k.request.observationId,fetchImpl:async(url,init)=>{seen.push({url,init});return reply(init);}});
 const read=(extra={})=>client.read({bearer:BEARER,serviceSecret:SECRET,request:{conversationId:k.request.conversationId,clientId:k.request.clientId,intent:k.request.intent,requestSha256:k.request.requestSha256},deadlineMs:k.meriClock.startedAtMs+3000,...extra});
 const out=await read();
 assert.equal(seen[0].url,ORIGIN+vector.route.path);assert.equal(seen[0].init.body,k.requestJson);
 assert.deepEqual(seen[0].init.headers,{...vector.requestHeaders,authorization:'Bearer '+BEARER,'x-internal-service-secret':SECRET});
 assert.deepEqual(out.receipt,k.receipt);assert.equal(out.observedAtMs,k.meriClock.localCheckedAtMs);assert.equal(out.localExpiresAtMs,k.meriClock.localExpiresAtMs);
 // Core's absolute clock never meets Meri's: the vector's Core times are 5 s ahead of Meri and still accepted.
 assert.ok(k.receipt.checkedAtMs>out.observedAtMs);
 times.splice(0,times.length,k.meriClock.startedAtMs);
 for(const [status,expected] of [[401,'SESSION_REFUSED'],[403,'ACCESS_DENIED'],[400,'ACCESS_DENIED'],[404,'UNAVAILABLE'],[429,'UNAVAILABLE'],[500,'UNAVAILABLE'],[503,'UNAVAILABLE']]){
  reply=()=>Response.json({message:'x'},{status});await assert.rejects(read(),code(expected),String(status));}
 reply=()=>new Response(JSON.stringify(k.receipt),{headers:{'content-type':'text/plain'}});await assert.rejects(read(),code('ACCESS_DENIED'),'content type');
 reply=()=>Response.json({...k.receipt,pad:'x'.repeat(5000)});await assert.rejects(read(),code('ACCESS_DENIED'),'oversized');
 reply=()=>Response.json({...k.receipt,observationId:'00000000-0000-4000-8000-00000000e999'});await assert.rejects(read(),code('ACCESS_DENIED'),'replayed observation');
 reply=()=>{throw TypeError('fetch failed');};await assert.rejects(read(),code('UNAVAILABLE'),'network');
 const before=seen.length;
 await assert.rejects(read({serviceSecret:BEARER}),code('ACCESS_DENIED'),'bearer equal to the service secret');
 await assert.rejects(read({bearer:'has space'}),code('ACCESS_DENIED'));
 assert.equal(seen.length,before,'refused before any request');
 // A 50 ms Core lifetime that elapsed in transit on Meri's own clock (counted from the send, not from Core's checkedAtMs) is refused.
 times.splice(0,times.length,k.meriClock.startedAtMs,k.meriClock.startedAtMs+55);reply=()=>Response.json({...k.receipt,expiresAtMs:k.receipt.checkedAtMs+50});
 await assert.rejects(read(),code('ACCESS_DENIED'),'lifetime counted from Meri send');
 // Parked Core: bounded by the caller deadline; an aborted caller is CANCELLED.
 const parked=createCoreArtifactAuthorityClient({origin:ORIGIN,now:Date.now,maxRequestMs:50,fetchImpl:(url,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}))});
 const parkedRead=extra=>parked.read({bearer:BEARER,serviceSecret:SECRET,request:{conversationId:k.request.conversationId,clientId:k.request.clientId,intent:'create',requestSha256:k.request.requestSha256},deadlineMs:Date.now()+5000,...extra});
 await assert.rejects(parkedRead(),code('DEADLINE'));
 const controller=new AbortController();setTimeout(()=>controller.abort(),10);await assert.rejects(parkedRead({signal:controller.signal}),code('CANCELLED'));
 for(const origin of ['http://core.synthetic.invalid','https://core.synthetic.invalid/api','https://user:pw@core.synthetic.invalid','https://core.synthetic.invalid/?q=1'])
  assert.throws(()=>createCoreArtifactAuthorityClient({origin,now:Date.now,fetchImpl:async()=>{}}),code('ARTIFACT_AUTHORITY_CONFIGURATION'),origin);
});

test('credentials: the service secret is re-read per call and never a candidate credential; bearers are admitted per call only',async()=>{
 const s=secretFiles(),credentials=await createArtifactAuthorityCredentials({configuration:{nativeCandidate},serviceSecretFile:files.secret,readSecret:s.readSecret});
 assert.equal(await credentials.serviceSecret(),SECRET);
 assert.equal(credentials.admitBearer(BEARER,SECRET),BEARER);
 for(const bad of [CONTROL,'synthetic-control-capability','synthetic-task-capability','synthetic-proxy-credential',SECRET,'',' x','x'.repeat(8193)])
  assert.throws(()=>credentials.admitBearer(bad,SECRET),code('UNAVAILABLE'));
 s.bytes[files.secret]='synthetic-rotated-secret';assert.equal(await credentials.serviceSecret(),'synthetic-rotated-secret','rotation without restart');
 s.bytes[files.secret]=CONTROL;await assert.rejects(credentials.serviceSecret(),code('UNAVAILABLE'),'a secret file now holding the control credential');
 for(const [label,options] of Object.entries({
  reservedPath:{configuration:{nativeCandidate},serviceSecretFile:files.control,readSecret:s.readSecret},
  candidateBytes:{configuration:{nativeCandidate},serviceSecretFile:files.secret,readSecret:secretFiles({[files.secret]:CONTROL}).readSecret},
  unreadable:{configuration:{nativeCandidate},serviceSecretFile:'/run/meri/absent',readSecret:s.readSecret},
  noCandidate:{configuration:{},serviceSecretFile:files.secret,readSecret:s.readSecret},
  relative:{configuration:{nativeCandidate},serviceSecretFile:'run/meri/x',readSecret:s.readSecret},
 }))await assert.rejects(createArtifactAuthorityCredentials(options),code('ARTIFACT_AUTHORITY_CONFIGURATION'),label);
});

test('authority: one observation per resolve/recheck over the real session owner, pinned facts, Core-gated authorize',async()=>{
 const h=await authorityHarness(),call=h.call('create',createBody);
 const resolved=await h.authority.resolve(call);
 assert.equal(h.core.calls.length,1);const [sent]=h.core.calls;
 assert.equal(sent.authorization,'Bearer '+BEARER,'the live session native bearer (RC1 option A)');assert.equal(sent.service,SECRET);
 assert.notEqual(sent.authorization,'Bearer '+h.live.credential,'never the action-session credential');
 assert.deepEqual({...sent.request,observationId:undefined},{contract:ARTIFACT_AUTHORITY_CONTRACT,observationId:undefined,conversationId:ids.conversationId,clientId:ids.clientId,intent:'create',requestSha256:call.requestSha256});
 assert.deepEqual(Object.keys(resolved).sort(),['artifactOptions','credential','enabled','limits','recheck','selectedClientId']);
 const o=resolved.artifactOptions;
 assert.equal(resolved.selectedClientId,ids.clientId);assert.equal(resolved.credential,'synthetic-run-capability');assert.equal(resolved.enabled,true);assert.deepEqual(resolved.limits,limits);
 assert.deepEqual(o.context.binding,binding);assert.deepEqual(o.context.scopes,scopes);assert.equal(o.context.maxBytes,limits.maxResponseBytes,'min(run 2 MiB, no Core ceiling, response 1 MiB)');
 for(const key of ['pool','versions','objects','executor'])assert.equal(o[key],null,`${key} is substituted by the documents composer`);
 assert.doesNotMatch(JSON.stringify({...o,authority:null}),new RegExp(BEARER),'the native bearer never enters artifactOptions');
 assert.equal(h.run.calls.length,1);assert.deepEqual(h.run.calls[0].authority.operations,h.core.operations);
 // authorize: only the intent's operations, the pinned binding/scopes, and never past the latest observation.
 const authz=extra=>o.authorize({action:'artifact.generate',resource:{versionId:null,object:null,assetObjects:[]},requestSha256:'a'.repeat(64),binding,scopes,deadlineMs:h.now()+4000,...extra});
 const receipt=await authz();
 assert.deepEqual(Object.keys(receipt).sort(),['action','binding','decision','expiresAtMs','receiptId','requestSha256','resourceSha256','scopesSha256']);
 assert.equal(receipt.decision,'allow');assert.ok(receipt.expiresAtMs<=h.now()+4000);
 await assert.rejects(authz({action:'artifact.download'}),code('ACCESS_DENIED'),'not an operation of the create intent');
 await assert.rejects(authz({binding:{...binding,writerFence:2}}),code('ACCESS_DENIED'));
 await assert.rejects(authz({scopes:[{...scopes[0],policyRevision:'s'.repeat(64)}]}),code('ACCESS_DENIED'));
 assert.equal(h.core.calls.length,1,'authorize itself makes no Core call');
 // recheck: a fresh correlated observation each time, same pin.
 const r=await resolved.recheck({phase:'admission',intent:'create',requestSha256:call.requestSha256,resource:null,deadlineMs:h.now()+4000});
 assert.deepEqual(Object.keys(r).sort(),['checkedAtMs','expiresAtMs','phase']);assert.equal(h.core.calls.length,2);
 assert.notEqual(h.core.calls[1].request.observationId,h.core.calls[0].request.observationId);
 await assert.rejects(resolved.recheck({phase:'effect',intent:'download',requestSha256:call.requestSha256,resource:null,deadlineMs:h.now()+4000}),code('ACCESS_DENIED'));
 await assert.rejects(resolved.recheck({phase:'later',intent:'create',requestSha256:call.requestSha256,resource:null,deadlineMs:h.now()+4000}),code('ACCESS_DENIED'));
 const recheck=()=>resolved.recheck({phase:'release',intent:'create',requestSha256:call.requestSha256,resource:null,deadlineMs:h.now()+4000});
 for(const [label,change,expected] of [
  ['context revision changed (client visibility, conversation archived, prospect scope)',c=>{c.contextRevision=rev('context-2');},'ACCESS_DENIED'],
  ['authority revision changed (membership/role)',c=>{c.authorityRevision=rev('authority-2');},'ACCESS_DENIED'],
  ['operations narrowed',c=>{c.operations=['artifact.download','artifact.generate'];},'ACCESS_DENIED'],
  ['Core ceiling appeared',c=>{c.limits={maxArtifactBytes:1024};},'ACCESS_DENIED'],
  ['Core refuses',c=>{c.status=403;},'ACCESS_DENIED'],
  ['Clerk session ended at Core',c=>{c.status=401;},'SESSION_REFUSED'],
  ['Core unavailable',c=>{c.status=503;},'UNAVAILABLE'],
  ['principal differs from the session',c=>{c.principal={tenantId:ids.tenantId,actorId:'00000000-0000-4000-8000-00000000a009'};},'ACCESS_DENIED'],
  ['Core lifetime above 60 s',c=>{c.ttlMs=60001;},'ACCESS_DENIED'],
 ]){
  const saved={...h.core};change(h.core);await assert.rejects(recheck(),code(expected),label);Object.assign(h.core,saved);
 }
 await recheck();
 // The latest observation bounds authorize; a revoked live session refuses every later observation without a Core call.
 h.live.sessions.revoke(h.live.credential);const calls=h.core.calls.length;
 await assert.rejects(recheck(),code('SESSION_REFUSED'));assert.equal(h.core.calls.length,calls,'no Core call without a live session');
});

test('authority clock: authorize never outlives the latest observation, and a recheck renews it (Meri clock only)',async()=>{
 const clock={t:Date.now()},now=()=>clock.t,h=await authorityHarness({now});h.core.ttlMs=1000;h.core.skewMs=-3600000;
 const resolved=await h.authority.resolve(h.call('create',createBody)),T=clock.t;
 const authz=()=>resolved.artifactOptions.authorize({action:'artifact.generate',resource:{versionId:null,object:null,assetObjects:[]},requestSha256:'a'.repeat(64),binding,scopes,deadlineMs:T+60000});
 assert.ok((await authz()).expiresAtMs<=T+1000,'bounded by the 1 s Core lifetime counted on the Meri clock');
 clock.t=T+1500;await assert.rejects(authz(),code('ACCESS_DENIED'),'the latest observation expired');
 await resolved.recheck({phase:'effect',intent:'create',requestSha256:canonicalSha256({intent:'create',body:createBody}),resource:null,deadlineMs:T+5000});
 const renewed=await authz();assert.ok(renewed.expiresAtMs>T+1500&&renewed.expiresAtMs<=T+2500,'renewed by the recheck');
});

test('authority refuses before Core: forged digest, revoked session, marked bearer; Meri-local run options gate composition',async()=>{
 const h=await authorityHarness();
 await assert.rejects(h.authority.resolve({...h.call('create',createBody),requestSha256:'b'.repeat(64)}),code('ACCESS_DENIED'),'digest must pin the body');
 await assert.rejects(h.authority.resolve(h.call('create',createBody,{credential:'action_session_'+'x'.repeat(43)})),code('SESSION_REFUSED'));
 assert.equal(h.core.calls.length,0);
 h.run.reply='null';assert.equal(await h.authority.resolve(h.call('create',createBody)),null,'no Meri-local run options: unavailable');
 h.run.reply='valid';h.run.credential=BEARER;await assert.rejects(h.authority.resolve(h.call('create',createBody)),code('UNAVAILABLE'),'the run capability is never the native bearer');
 h.run.credential='synthetic-run-capability';h.core.limits={maxArtifactBytes:4096};
 assert.equal((await h.authority.resolve(h.call('download',{versionId:'00000000-0000-4000-8000-00000000f001'}))).artifactOptions.context.maxBytes,4096,'Core ceiling clamps the context');
 const marked=await authorityHarness({nativeCredential:CONTROL});
 await assert.rejects(marked.authority.resolve(marked.call('create',createBody)),code('UNAVAILABLE'),'a session holding the marked control credential');
 assert.equal(marked.core.calls.length,0,'the marked control credential never reaches the artifact route');
 h.core.park=true;const parked=h.call('create',createBody,{deadlineMs:h.now()+80});
 await assert.rejects(h.authority.resolve(parked),code('DEADLINE'),'a parked Core is bounded by the request deadline');h.core.park=false;
 // Core's principal must be the session's tenant and actor on the FIRST observation too (not only by pin equality).
 h.core.principal={tenantId:ids.tenantId,actorId:'00000000-0000-4000-8000-00000000a009'};
 await assert.rejects(h.authority.resolve(h.call('create',createBody)),code('ACCESS_DENIED'),'principal join');h.core.principal={tenantId:ids.tenantId,actorId:ids.actorId};
 // The session is revoked while the service secret is read: the bearer is looked up again and the call never reaches Core.
 const calls=h.core.calls.length;h.s.hooks.onRead=path=>{if(path===files.secret){h.s.hooks.onRead=null;h.live.sessions.revoke(h.live.credential);}};
 await assert.rejects(h.authority.resolve(h.call('create',createBody)),code('UNAVAILABLE'),'bearer re-lookup after the secret read');
 assert.equal(h.core.calls.length,calls);
});

const kmsKeyId='arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001';
const artifacts=(extra={})=>({enabled:true,region:'us-east-1',bucket:'synthetic-artifact-bucket',prefix:'meri-artifacts',expectedBucketOwner:'111122223333',kmsKeyId,authority:{origin:ORIGIN,serviceSecretFile:files.secret},...extra});
const control=(extra={})=>({nativeCandidate,limits:{requestMs:5000,requestBytes:131072},native:{maxResponseBytes:1048576},...extra});

test('startup composition is disabled unless every input exists, and names each gap by key only',async()=>{
 const s=secretFiles(),run=scriptedRunOptions(),executor={execute(){}};
 const missing=async(configuration,extra={})=>(await composeDocumentsFamily({configuration,readSecret:s.readSecret,fetchImpl:async()=>{},...extra})).missing;
 // Lane X composes both Meri-local owners when their inputs exist; the production CLI supplies neither input today.
 assert.deepEqual(await missing(control({artifacts:artifacts()})),['runOptions.authorityPorts','artifacts.executor'],'the production registration today');
 assert.deepEqual(await missing(control({artifacts:{enabled:false}}),{runOptions:run.port,executor}),['artifacts.enabled']);
 assert.deepEqual(await missing(control({artifacts:artifacts({authority:undefined})}),{runOptions:run.port,executor}),['artifacts.authority']);
 assert.deepEqual(await missing({...control({artifacts:artifacts()}),nativeCandidate:undefined},{runOptions:run.port,executor}),['nativeCandidate']);
 assert.deepEqual(await missing(control({artifacts:artifacts({authority:{origin:ORIGIN,serviceSecretFile:'/run/meri/absent'}})}),{runOptions:run.port,executor}),['artifacts.authority.serviceSecretFile']);
 const composed=await composeDocumentsFamily({configuration:control({artifacts:artifacts()}),readSecret:s.readSecret,fetchImpl:async()=>{},runOptions:run.port,executor});
 assert.deepEqual(composed.missing,[]);assert.equal(composed.authority.origin,ORIGIN);assert.equal(typeof composed.family,'function');
 // The declaration is closed: origin must be a bare https origin equal to the session identity origin; the secret file a POSIX path.
 for(const authority of [{origin:'http://core.synthetic.invalid',serviceSecretFile:files.secret},{origin:ORIGIN+'/api',serviceSecretFile:files.secret},{origin:'https://other.synthetic.invalid',serviceSecretFile:files.secret},
  {origin:ORIGIN,serviceSecretFile:'relative'},{origin:ORIGIN,serviceSecretFile:'/run/../x'},{origin:ORIGIN},{origin:ORIGIN,serviceSecretFile:files.secret,bearerFile:'/x'}])
  await assert.rejects(composeDocumentsFamily({configuration:control({artifacts:artifacts({authority})}),readSecret:s.readSecret}),code('ARTIFACT_AUTHORITY_CONFIGURATION'),JSON.stringify(authority));
});

test('composed family through the runtime document application: Core gates admission and every effect, fail closed',async()=>{
 const now=Date.now,s=secretFiles(),run=scriptedRunOptions(),core=scriptedCore(),live=await liveSession({now});
 const {family,missing}=await composeDocumentsFamily({configuration:control({artifacts:artifacts()}),readSecret:s.readSecret,fetchImpl:core.fetch,runOptions:run.port,executor:{execute(){}},now});
 assert.deepEqual(missing,[]);
 // The family constructs the pinned SDK S3 client with no request; no path below reaches it (the versions owner refuses before IO).
 const context=Object.freeze({configuration:{...control({artifacts:artifacts()}),sessions:{maxSessions:10,maxTtlMs:30000},versions:{}},pool:Object.freeze({connect:()=>assert.fail('no SQL')}),now});
 const realFamily=family(context);
 assert.deepEqual(Object.keys(realFamily.ports),['artifactStore','artifactOptionsOwner']);
 assert.equal(bindDocumentsSessions(context,live.sessions),true);
 const app=createRuntimeArtifactApplication({sessions:live.sessions,now,limits,optionsOwner:captureRuntimePorts(realFamily.ports).artifactOptionsOwner});
 const send=(intent,body)=>app.handle(new Request('https://control.synthetic.invalid/api/documents/'+intent,{method:'POST',headers:{authorization:'Bearer '+live.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 const download={versionId:'00000000-0000-4000-8000-00000000f001'};
 // Core refuses at the admission recheck: nothing is dispatched.
 core.onCall=n=>{if(n===2)core.status=403;};
 let response=await send('download',download),body=await response.json();
 assert.equal(response.status,403);assert.deepEqual(body,{error:{code:'ACCESS_DENIED',outcome:'NOT_DISPATCHED'}});assert.equal(core.calls.length,2);
 core.onCall=null;core.status=200;
 // Core allows: resolve, admission recheck, then rechecks around the version-scoped authorize and the version read; the read itself
 // reaches the real S3/PG versions owner (which refuses without publication custody) only after Core allowed it.
 core.calls.length=0;response=await send('download',download);body=await response.json();
 assert.notEqual(response.status,200);assert.ok(core.calls.length>=4,`Core observations before the read: ${core.calls.length}`);
 assert.ok(core.calls.every(c=>c.authorization==='Bearer '+BEARER&&c.request.intent==='download'));
 // Core changes its decision between the admission recheck and the first effect: refused before any storage read.
 core.calls.length=0;core.onCall=n=>{if(n===3)core.contextRevision=rev('context-moved');};
 response=await send('download',download);body=await response.json();core.onCall=null;core.contextRevision=rev('context');
 assert.equal(response.status,403);assert.equal(body.error.code,'ACCESS_DENIED');assert.equal(core.calls.length,3);
 // Without a declared authority origin the same supplied authority composes the store only.
 const plain=family(Object.freeze({...context,configuration:{...context.configuration,artifacts:artifacts({authority:undefined})}}));
 assert.deepEqual(Object.keys(plain.ports),['artifactStore']);
});
