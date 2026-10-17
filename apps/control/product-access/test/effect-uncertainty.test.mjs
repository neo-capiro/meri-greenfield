/** SYNTHETIC: real Fetch/settings transaction and memory producer paths, scripted SQL/Core. No database or network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductApplication} from '../http.mjs';
import {createSettingsRoutes} from '../../settings/routes.mjs';
import {createSettingsService} from '../../settings/service.mjs';
import {createPostgresSettingsStore} from '../../settings/postgres-store.mjs';
import {USER_PREFERENCE_DEFAULTS} from '../../settings/documents.mjs';
import {createMemoryRoutes} from '../../memory/routes.mjs';
import {createMemoryProducer} from '../../memory/producer.mjs';
import {createCoreReview} from '../../memory/core-review.mjs';
import {createCoreMemoryReads} from '../../memory/core-memory.mjs';
import {createCoreDouble,createJournalDouble,ids} from '../../memory/test/fixtures.mjs';
import {directory,id} from './fixtures.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
const deferred=()=>Promise.withResolvers();
function application(routes){const d=directory();return createProductApplication({gate:d.gate,now:()=>d.now,routes,
 limits:{maxRequestMs:100,maxRequestBytes:65536,maxResponseBytes:1048576}});}
const post=(app,path,body,signal)=>app.handle(new Request(`https://meri.invalid${path}`,{method:'POST',signal,
 headers:{authorization:'Bearer token-1','content-type':'application/json'},body:JSON.stringify(body)}));
async function unknown(response,mode){assert.equal(response.status,mode==='deadline'?408:499);assert.deepEqual(await response.json(),{error:{code:mode==='deadline'?'DEADLINE':'CANCELLED',outcome:'UNKNOWN'}});}

for(const mode of ['deadline','cancel'])test(`pending settings COMMIT after ${mode} stays UNKNOWN even if the commit later succeeds`,{timeout:3000},async()=>{
 const entered=deferred(),release=deferred(),settled=deferred();let writing=false,commits=0;
 const pool={async connect(){return {async query(sql){
  if(sql==='BEGIN')writing=true;
  if(sql==='COMMIT'&&writing){entered.resolve();await release.promise;commits++;settled.resolve();}
  if(sql.startsWith('INSERT INTO meri_settings.user_preferences'))return {rows:[{revision:'1',document:USER_PREFERENCE_DEFAULTS,document_sha256:canonicalSha256(USER_PREFERENCE_DEFAULTS)}]};
  return {rows:[]};},release(){}};}};
 const service=createSettingsService({store:createPostgresSettingsStore({pool}),readPlatformLimits:async()=>{},newId:ids()});
 const app=application(createSettingsRoutes({service})),controller=new AbortController();
 const pending=post(app,'/api/settings/user/save',{expectedRevision:0,preferences:USER_PREFERENCE_DEFAULTS},controller.signal);
 try{await entered.promise;if(mode==='cancel')controller.abort();await unknown(await pending,mode);assert.equal(commits,0);}
 finally{release.resolve();await settled.promise;}
 assert.equal(commits,1,'late COMMIT is possible; timeout never proves rollback');
});

for(const mode of ['deadline','cancel'])for(const intent of ['propose','correct'])test(`pending memory ${intent} Core submit after ${mode} stays UNKNOWN`,{timeout:3000},async()=>{
 const core=createCoreDouble(),journal=createJournalDouble(),entered=deferred(),release=deferred(),settled=deferred(),call=core.transport.call;
 core.addMemory({memoryId:'mem-1'});
 core.transport.call=async(...args)=>{if(args[0]==='submit'){entered.resolve();await release.promise;}const out=await call(...args);if(args[0]==='submit')settled.resolve();return out;};
 const producer=createMemoryProducer({journal,review:createCoreReview({transport:core.transport}),memory:createCoreMemoryReads({transport:core.transport}),newId:ids(),now:Date.now});
 const app=application(createMemoryRoutes({producer})),controller=new AbortController(),body=intent==='propose'?{idempotencyKey:id(1),scope:'personal',content:'fact'}:
  {idempotencyKey:id(1),targetMemoryId:'mem-1',content:'fixed',reason:'evidence',sources:[{kind:'document',reference:'doc-1'}]};
 const pending=post(app,`/api/memory/proposals/${intent}`,body,controller.signal);
 try{await entered.promise;if(mode==='cancel')controller.abort();await unknown(await pending,mode);assert.equal(core.reviews.size,0);}
 finally{release.resolve();await settled.promise;}
 assert.equal(core.reviews.size,1,'the exact journaled candidate can reach Core after the HTTP lifetime ends');
 assert.equal(journal.rows.size,1);
});

test('cancellation during membership admission never invokes the effect route',{timeout:3000},async()=>{
 const entered=deferred(),release=deferred(),controller=new AbortController();let calls=0;
 const app=createProductApplication({gate:{async admit(){entered.resolve();await release.promise;return {principal:{},expiresAtMs:Date.now()+10000};},async recheck(){}},
 routes:{'/api/test/save':{effect:true,handle(){calls++;return {};}}},limits:{maxRequestMs:1000,maxRequestBytes:65536,maxResponseBytes:65536}});
 const pending=post(app,'/api/test/save',{},controller.signal);
 try{await entered.promise;controller.abort();const response=await pending;assert.deepEqual(await response.json(),{error:{code:'CANCELLED'}});assert.equal(calls,0);}
 finally{release.resolve();}
});
