import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access} from 'node:fs/promises';
import {createDocumentApplication} from '../index.mjs';
import {createLocalDocumentFixture} from '../local/fixture.mjs';
import {mountLocalDocumentApplication} from '../local/mount.mjs';
import {draft,runLocalDocumentFlow} from '../local/flow.mjs';
import {listenActionApplication} from '../../action-application/node-http.mjs';
import {main} from '../../../../scripts/local-document/run.mjs';
const python='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const text=()=>({operation:'create_word',format:'txt',title:'Independent exact bytes',content:{text:'First draft\nUnicode: π\n'}});
const parked=signal=>new Promise((_,reject)=>{if(signal.aborted)reject(Error('cancelled'));else signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});});
async function setup(t,transform=x=>x){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python});
 t.after(async()=>{await f.close();assert.equal(f.stats().cleanup.executorDirectoriesAbsent,true);assert.equal(f.stats().cleanup.storeRemoved,true);await assert.rejects(access(f.directory));});
 const base={sessions:{authenticateSession:f.sessions.authenticateSession,readCurrentState:f.sessions.readCurrentState},selectedClientId:f.selectedClientId,artifactOptions:{...f.artifactOptions},credential:f.credential,now:f.now,limits:{...f.limits},enabled:true};
 const options=transform(base),app=createDocumentApplication(options),session=await f.sessions.issue({identityCredential:f.nativeCredential});
 const request=(route,body,extra={})=>new Request('http://127.0.0.1/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+session.credential,'content-type':'application/json'},body:JSON.stringify(body),...extra});
 return {f,options,app,session,request,post:(route,body,extra)=>app.handle(request(route,body,extra))};
}
async function json(response){const out=await response.json();assert.equal(response.status,200,JSON.stringify(out));return out;}
async function reject(response,outcome){const out=await response.json();assert.notEqual(response.status,200);assert.deepEqual(Object.keys(out),['error']);assert.deepEqual(Object.keys(out.error).sort(),['code','outcome']);if(outcome)assert.equal(out.error.outcome,outcome);assert.equal(response.headers.get('cache-control'),'no-store');return out;}
test('independent real loopback DOCX flow creates revisions, retains originals, reconstructs graph and closes all resources',async t=>{
 const a=await setup(t);let app=mountLocalDocumentApplication(a.f);const server=await listenActionApplication({app:{handle:r=>app.handle(r)},host:'127.0.0.1',port:0,lifetimeMs:15000});
 try{const result=await runLocalDocumentFlow({fixture:a.f,pythonExecutable:python,send:(path,body,credential)=>fetch(server.origin+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)}),reconstruct:async()=>{app=mountLocalDocumentApplication(a.f);}});assert.equal(Object.values(result.invariants).every(Boolean),true);assert.equal(result.stats.consumedMicroUsd,'20');assert.equal(result.stats.nativeDatabase,false);for(const receipt of [...result.stats.processReceipts,...result.inspectionProcessReceipts]){assert.equal(receipt.groupAbsent,true);assert.equal(receipt.leaderClosed,true);assert.equal(receipt.sandboxQualified,false);}}
 finally{await server.close();assert.deepEqual(server.status(),{closed:true,listening:false,activeSockets:0});}assert.equal(a.f.sessions.status().closed,false);
});
for(const [label,mutate] of [
 ['actor',v=>{v.binding.actorId='foreign-actor';}],['tenant',v=>{v.binding.tenantId='foreign-tenant';}],['attempt',v=>{v.binding.attemptId='10000000-0000-4000-8000-000000000099';}],['fence',v=>{v.binding.writerFence++;}],['client',v=>{v.selectedClientId='10000000-0000-4000-8000-000000000099';}],['scope revision',v=>{v.scopes[0].policyRevision+='changed';}],
])test(`independent current ${label} substitution refuses before generation`,async t=>{
 const a=await setup(t,c=>{const prior=c.sessions.readCurrentState;c.sessions.readCurrentState=async x=>{const v=await prior(x);mutate(v);return v;};return c;});await reject(await a.post('create',{deliveryId:'forged',request:text()}),'NOT_DISPATCHED');assert.equal(a.f.stats().generations,0);assert.equal(a.f.stats().versionCharges,0);
});
test('independent full canonical descriptor cannot omit grants or source requirements',async t=>{
 const a=await setup(t);for(const key of ['requiredGrants','sourceRequirements'])assert.throws(()=>createDocumentApplication({...a.options,artifactOptions:{...a.options.artifactOptions,descriptor:{...a.options.artifactOptions.descriptor,[key]:[]}}}));
});
test('independent constructor snapshots caller context, scopes, limits and descriptor',async t=>{
 const a=await setup(t);a.options.artifactOptions.context.maxBytes=1;a.options.artifactOptions.context.scopes[0].resourceId='foreign';a.options.artifactOptions.descriptor.operation.id='other';a.options.limits.maxResponseBytes=1;
 const out=await json(await a.post('create',{deliveryId:'snapshot',request:text()}));assert.equal(out.version.object.bytes,Buffer.byteLength(text().content.text));
});
test('independent create replay and changed intent cannot generate or charge again',async t=>{
 const a=await setup(t),body={deliveryId:'immutable-id',request:text()};await json(await a.post('create',body));await reject(await a.post('create',body),'UNKNOWN');await reject(await a.post('create',{...body,request:{...text(),title:'Changed'}}),'UNKNOWN');assert.equal(a.f.stats().generations,1);assert.equal(a.f.stats().versionCharges,1);assert.equal(a.f.stats().consumedMicroUsd,'10');
});
test('independent stale revision leaves both committed versions unchanged and preserves uncertain effect',async t=>{
 const a=await setup(t),first=await json(await a.post('create',{deliveryId:'base',request:text()})),next={...text(),content:{text:'Revision\n'}},second=await json(await a.post('revise',{deliveryId:'next',baseVersionId:first.version.versionId,request:next}));
 await reject(await a.post('revise',{deliveryId:'stale',baseVersionId:first.version.versionId,request:{...text(),content:{text:'stale'}}}),'UNKNOWN');
 for(const [version,expected]of[[first.version,text().content.text],[second.version,next.content.text]]){const r=await a.post('download',{versionId:version.versionId});assert.equal(r.status,200);assert.equal(await r.text(),expected);}assert.equal(a.f.stats().settled,2);assert.equal(a.f.stats().unknown,1);
});
test('independent committed result withheld on final session denial remains RESULT_NOT_RELEASED',async t=>{
 let final=false;const a=await setup(t,c=>{const auth=c.sessions.authenticateSession;c.sessions.authenticateSession=x=>{if(final)throw Error('SECRET');return auth(x);};const check=c.artifactOptions.authorize;let releases=0;c.artifactOptions.authorize=async x=>{const out=await check(x);if(x.resource?.versionId&&++releases===2)final=true;return out;};return c;});
 // Denial timing is selected by the actual version commit callback, followed by the final session check.
 const out=await a.post('create',{deliveryId:'late',request:text()});if(out.status===200){const v=await out.json();final=true;await reject(await a.post('download',{versionId:v.version.versionId}),'NOT_DISPATCHED');}else{const e=await reject(out);assert.ok(['UNKNOWN','RESULT_NOT_RELEASED'].includes(e.error.outcome));}assert.equal(a.f.stats().generations,1);
});
test('independent object acknowledgement then revocation retains UNKNOWN and no second write on replay',async t=>{
 const a=await setup(t,c=>{const put=c.artifactOptions.objects.put;c.artifactOptions.objects={...c.artifactOptions.objects,async put(...args){const out=await put(...args);c.sessions.close();return out;}};return c;});await reject(await a.post('create',{deliveryId:'lost-release',request:text()}),'UNKNOWN');assert.equal(a.f.stats().unknown,1);assert.equal(a.f.stats().generations,1);await reject(await a.post('create',{deliveryId:'lost-release',request:text()}),'NOT_DISPATCHED');assert.equal(a.f.stats().generations,1);
});
test('independent original cutoff aborts parked current-state receipt before effects',async t=>{
 let stopped=false;const a=await setup(t,c=>{c.limits.maxRequestMs=35;c.sessions.readCurrentState=async x=>{try{await parked(x.signal);}finally{stopped=x.signal.aborted;}};return c;});const at=Date.now();await reject(await a.post('create',{deliveryId:'parked',request:text()}),'NOT_DISPATCHED');assert.equal(stopped,true);assert.ok(Date.now()-at<1000);assert.equal(a.f.stats().generations,0);
});
test('independent newly shortened artifact expiry bounds the next parked executor',async t=>{
 let deadline,aborted=false;const a=await setup(t,c=>{const authorize=c.artifactOptions.authorize;c.artifactOptions.authorize=async x=>{const out=await authorize(x);deadline??=Date.now()+100;return {...out,expiresAtMs:Math.min(deadline,out.expiresAtMs)};};c.artifactOptions.executor={async execute(x){assert.ok(x.deadlineMs<=deadline);try{await parked(x.signal);}finally{aborted=x.signal.aborted;}}};return c;});const at=Date.now();await reject(await a.post('create',{deliveryId:'shortened',request:text()}),'UNKNOWN');assert.equal(aborted,true);assert.ok(Date.now()-at<1000);assert.equal(a.f.stats().unknown,1);
});
test('independent cancellation during response acquisition denies exact old version',async t=>{
 let park=false,aborted=false;const a=await setup(t,c=>{const get=c.artifactOptions.objects.get;c.artifactOptions.objects={...c.artifactOptions.objects,async get(object,signal){if(park){try{await parked(signal);}finally{aborted=signal.aborted;}}return get(object,signal);}};return c;}),first=await json(await a.post('create',{deliveryId:'original',request:text()}));park=true;const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),25);try{await reject(await a.post('download',{versionId:first.version.versionId},{signal:ac.signal}),'READ_UNAVAILABLE');}finally{clearTimeout(timer);}assert.equal(aborted,true);assert.equal(a.f.stats().versionCharges,1);
});
for(const key of ['binding','scopes','credential','path','baseVersionId'])test(`independent raw ${key} injection has no authority/effect`,async t=>{const a=await setup(t);await reject(await a.post('create',{deliveryId:'injection',request:text(),[key]:'forged'}),'NOT_DISPATCHED');assert.equal(a.f.stats().generations,0);});
test('independent hostile errors and request objects execute no getters or proxy traps',async t=>{
 let traps=0;const hostile=new Proxy({}, {get(){traps++;throw Error('SECRET');},getPrototypeOf(){traps++;throw Error('SECRET');},ownKeys(){traps++;throw Error('SECRET');}});
 const a=await setup(t,c=>{c.artifactOptions.authorize=async()=>{throw hostile;};return c;});await reject(await a.app.handle(hostile),'NOT_DISPATCHED');const r=await a.post('create',{deliveryId:'hostile',request:text()});assert.equal((await r.text()).includes('SECRET'),false);assert.equal(traps,0);
});
test('independent oversized and malformed UTF8 bodies refuse before source work',async t=>{
 const a=await setup(t,c=>({...c,limits:{...c.limits,maxRequestBytes:128}}));await reject(await a.post('create',{deliveryId:'big',request:text()}),'NOT_DISPATCHED');const req=a.request('create',{});const invalid=new Request(req.url,{method:'POST',headers:req.headers,body:new Uint8Array([123,34,120,34,58,34,0xff,34,125])});await reject(await a.app.handle(invalid),'NOT_DISPATCHED');assert.equal(a.f.stats().generations,0);
});
test('independent parked incoming body aborts under original deadline',async t=>{let cancelled=false;const a=await setup(t,c=>({...c,limits:{...c.limits,maxRequestMs:30}}));const req=a.request('create',{});const body=new ReadableStream({cancel(){cancelled=true;}});await reject(await a.app.handle(new Request(req.url,{method:'POST',headers:req.headers,body,duplex:'half'})),'NOT_DISPATCHED');assert.equal(cancelled,true);assert.equal(a.f.stats().generations,0);});
test('independent no activation by default and separate tool/native credentials refused',async t=>{const a=await setup(t,c=>{delete c.enabled;return c;});assert.equal((await a.post('create',{deliveryId:'disabled',request:text()})).status,503);assert.equal(a.f.stats().versionCharges,0);assert.equal(a.f.sessions.status().closed,false);const app=createDocumentApplication({...a.options,enabled:true});for(const credential of[a.f.credential,a.f.nativeCredential])await reject(await app.handle(a.request('create',{deliveryId:'badcredential',request:text()},{headers:{'content-type':'application/json',authorization:'Bearer '+credential}})),'NOT_DISPATCHED');});
test('independent CLI help and invalid arguments remain inert and preserve environment',async()=>{const original=process.env.MERI_REVIEW_SOURCE_ROOT;for(const [args,code]of[[['--help'],0],[['--run','--python','relative'],2]]){let output='';assert.equal(await main(args,v=>output+=v),code);assert.match(output,/Usage:/);assert.equal(process.env.MERI_REVIEW_SOURCE_ROOT,original);}});
