/** Actual canonical owners + scripted ledger + real local txt/DOCX executor. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDocumentApplication} from '../index.mjs';
import {createLocalDocumentFixture} from '../local/fixture.mjs';
const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const spec={operation:'create_word',format:'txt',title:'Author document',content:{text:'First version\n'}};
async function setup(t,change=x=>x){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python});t.after(()=>f.close());
 const options={sessions:f.sessions,selectedClientId:f.selectedClientId,artifactOptions:f.artifactOptions,credential:f.credential,now:f.now,limits:f.limits,enabled:true};
 const app=createDocumentApplication(change(options)),session=await f.sessions.issue({identityCredential:f.nativeCredential});
 const req=(route,body,extra={})=>new Request(`http://127.0.0.1/api/documents/${route}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.credential}`},body:JSON.stringify(body),...extra});
 const post=(route,body,extra)=>app.handle(req(route,body,extra));
 return {f,app,options,session,req,post};
}
test('create/revise/inspect/download use immutable storage and one shared canonical ledger',async t=>{
 const a=await setup(t),firstResponse=await a.post('create',{deliveryId:'one',request:spec});assert.equal(firstResponse.status,200);const first=await firstResponse.json();
 const nextSpec={...spec,content:{text:'Second version\n'}},secondResponse=await a.post('revise',{deliveryId:'two',baseVersionId:first.version.versionId,request:nextSpec});assert.equal(secondResponse.status,200);const second=await secondResponse.json();
 assert.equal(second.version.parentVersionId,first.version.versionId);assert.equal(second.version.artifactId,first.version.artifactId);assert.notEqual(second.version.versionId,first.version.versionId);
 for(const [version,text]of[[first.version,spec.content.text],[second.version,nextSpec.content.text]]){
  const inspect=await a.post('inspect',{versionId:version.versionId});assert.equal(inspect.status,200);assert.equal((await inspect.json()).inspection.currentBytesVerified,true);
  const download=await a.post('download',{versionId:version.versionId});assert.equal(download.status,200);assert.equal(download.headers.get('content-disposition'),`attachment; filename="${version.filename}"`);assert.equal(download.headers.get('cache-control'),'no-store');assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.equal(download.headers.get('access-control-allow-origin'),null);
  const bytes=Buffer.from(await download.arrayBuffer());assert.equal(bytes.toString(),text);assert.equal(createHash('sha256').update(bytes).digest('hex'),version.object.sha256);
 }
 assert.equal(a.f.stats().generations,2);assert.equal(a.f.stats().consumedMicroUsd,'20');
 const repeat=await a.post('create',{deliveryId:'one',request:spec});assert.notEqual(repeat.status,200);assert.equal(a.f.stats().generations,2);assert.equal(a.f.stats().versionCharges,2);
 const changed=await a.post('create',{deliveryId:'one',request:{...spec,title:'Changed'}});assert.notEqual(changed.status,200);assert.equal(a.f.stats().generations,2);
});
test('actual DOCX produces truthful draft/preview metadata and exact ZIP bytes',async t=>{
 const a=await setup(t),request={operation:'create_word',format:'docx',title:'Word draft',content:{blocks:[{kind:'paragraph',runs:[{text:'Explicit typed paragraph.'}]}]}};
 const res=await a.post('create',{deliveryId:'word',request});assert.equal(res.status,200);const out=await res.json();assert.equal(out.execution.nativeQualified,false);assert.equal(out.inspection.nativeOpened,false);assert.equal(out.version.previewStatus,'pending');
 const download=await a.post('download',{versionId:out.version.versionId});assert.equal(download.status,200);assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0,2).toString(),'PK');assert.equal(a.f.stats().consumedMicroUsd,'10');
});
test('default disabled allocates no document effect; borrowed session remains open',async t=>{
 const a=await setup(t,c=>{delete c.enabled;return c;});const res=await a.post('create',{deliveryId:'one',request:spec});assert.equal(res.status,503);assert.equal((await res.json()).error.outcome,'NOT_DISPATCHED');assert.equal(a.f.stats().generations,0);assert.equal(a.f.sessions.status().closed,false);
});
for(const [label,body]of[['body authority',{deliveryId:'one',request:spec,context:{}}],['wrong operation',{deliveryId:'one',request:{...spec,operation:'create_excel'}}],['PDF',{deliveryId:'one',request:{operation:'create_word',format:'pdf',title:'PDF',content:{blocks:[]}}}]])test(`reject ${label} before generation`,async t=>{
 const a=await setup(t);assert.notEqual((await a.post('create',body)).status,200);assert.equal(a.f.stats().generations,0);assert.equal(a.f.stats().versionCharges,0);
});
test('native identity/tool tokens cannot authenticate application routes',async t=>{
 const a=await setup(t);for(const token of[a.f.nativeCredential,a.f.credential]){const res=await a.post('create',{deliveryId:'one',request:spec},{headers:{'content-type':'application/json',authorization:`Bearer ${token}`}});assert.equal(res.status,403);assert.equal((await res.json()).error.outcome,'NOT_DISPATCHED');}assert.equal(a.f.stats().generations,0);
});
test('revoked session denies older-version read without another reservation',async t=>{
 const a=await setup(t),r=await a.post('create',{deliveryId:'one',request:spec});assert.equal(r.status,200);const first=await r.json();a.f.revoke();const read=await a.post('download',{versionId:first.version.versionId});assert.equal(read.status,403);assert.equal(a.f.stats().versionCharges,1);
});
test('post-object revocation preserves uncertainty without regeneration',async t=>{
 const a=await setup(t,c=>{const original=c.artifactOptions.objects.put;c.artifactOptions={...c.artifactOptions,objects:{...c.artifactOptions.objects,async put(...args){const out=await original(...args);c.sessions.close();return out;}}};return c;});
 const res=await a.post('create',{deliveryId:'one',request:spec});assert.notEqual(res.status,200);assert.equal((await res.json()).error.outcome,'UNKNOWN');assert.equal(a.f.stats().generations,1);assert.equal(a.f.stats().unknown,1);
});
test('strict native Request admission ignores hostile own url and rejects Proxy without traps',async t=>{
 const a=await setup(t);let traps=0;const proxy=new Proxy({}, {get(){traps++;throw Error('SECRET');},getPrototypeOf(){traps++;throw Error('SECRET');}});assert.equal((await a.app.handle(proxy)).status,400);assert.equal(traps,0);
 const request=a.req('inspect',{versionId:'00000000-0000-4000-8000-000000000001'});Object.defineProperty(request,'url',{get(){traps++;throw Error('SECRET');}});const res=await a.app.handle(request);assert.notEqual(res.status,200);assert.equal(traps,0);
});
test('bounded body and fixed path/media handling preserve safe no-store errors',async t=>{
 const a=await setup(t,c=>({...c,limits:{...c.limits,maxRequestBytes:64}}));const res=await a.post('create',{deliveryId:'one',request:spec});assert.equal(res.status,413);assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(a.f.stats().generations,0);
 const bad=await a.app.handle(new Request('http://127.0.0.1/api/documents/create#fragment',{method:'POST'}));assert.equal(bad.status,404);
});
test('constructor snapshots data and rejects authority getters without invocation',async t=>{
 const a=await setup(t);let calls=0;const sessions={readCurrentState:a.f.sessions.readCurrentState};Object.defineProperty(sessions,'authenticateSession',{get(){calls++;return ()=>{};}});assert.throws(()=>createDocumentApplication({...a.options,sessions}));assert.equal(calls,0);
 a.options.artifactOptions.context.maxBytes=1;const res=await a.post('create',{deliveryId:'one',request:spec});assert.equal(res.status,200);
});
test('canonical descriptor rejects accidental grant or source redefinition',async t=>{
 const a=await setup(t);for(const mutation of[d=>{d.requiredGrants=[];},d=>{d.sourceRequirements=[];},d=>{d.operation.version='0.1.0';}]){
  const descriptor=structuredClone(a.options.artifactOptions.descriptor);mutation(descriptor);assert.throws(()=>createDocumentApplication({...a.options,artifactOptions:{...a.options.artifactOptions,descriptor}}));
 }
});
test('shorter artifact receipt clips outer lifetime before the next parked session call',async t=>{
 let parked=false,aborted=false;
 const a=await setup(t,c=>{const original=c.artifactOptions.authorize,auth=c.sessions.authenticateSession;c={...c,sessions:{authenticateSession:call=>{if(!parked)return auth(call);aborted=call.signal.aborted;call.signal.addEventListener('abort',()=>{aborted=true;},{once:true});return new Promise(()=>{});},readCurrentState:c.sessions.readCurrentState},artifactOptions:{...c.artifactOptions,async authorize(call){const receipt=await original(call);parked=true;return {...receipt,expiresAtMs:c.now()+40};}}};return c;});
 const started=Date.now(),res=await a.post('create',{deliveryId:'short',request:spec});assert.equal(res.status,408);assert.ok(Date.now()-started<1000);assert.equal(aborted,true);assert.equal(a.f.stats().generations,0);assert.equal(a.f.stats().versionCharges,0);
});
test('fresh session with changed full binding refuses before accounting',async t=>{
 const a=await setup(t,c=>({...c,sessions:{authenticateSession:c.sessions.authenticateSession,async readCurrentState(call){const fact=await c.sessions.readCurrentState(call);return {...fact,binding:{...fact.binding,writerFence:fact.binding.writerFence+1}};}}}));
 const res=await a.post('create',{deliveryId:'foreign',request:spec});assert.equal(res.status,403);assert.equal(a.f.stats().versionCharges,0);
});
for(const target of ['authorize','authority','executor','objects'])test(`hostile ${target} rejection is inert before canonical owner catches`,async t=>{
 let traps=0;const rejected=new Proxy({}, {get(_t,key){if(key==='then')return undefined;traps++;throw Error('SECRET');},getPrototypeOf(){traps++;throw Error('SECRET');},set(){traps++;throw Error('SECRET');}});
 const a=await setup(t,c=>{const options={...c.artifactOptions};if(target==='authorize')options.authorize=async()=>{throw rejected;};else if(target==='authority')options.authority={check:async()=>{throw rejected;}};else if(target==='executor')options.executor={execute:async()=>{throw rejected;}};else options.objects={...options.objects,put:async()=>{throw rejected;}};return {...c,artifactOptions:options};});
 const res=await a.post('create',{deliveryId:'hostile',request:spec});assert.notEqual(res.status,200);const body=await res.text();assert.equal(body.includes('SECRET'),false);assert.equal(traps,0);
});
