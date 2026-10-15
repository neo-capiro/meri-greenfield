/** Root mount of the signed download link routes behind the startup readiness gate, through the real startControl/assembleControl
 * with the same synthetic pg/Temporal/native/listener stand-ins as first-run-mount. No network, database or cloud call occurs. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import * as actualConfig from '../config.mjs';

const events=[];let listenHook,abortOnVerify;
const KEY_FILE='/run/secrets/meri-download-link-key';
mock.module('pg',{namedExports:{Pool:class{constructor(){events.push('pool');}async query(sql,args){if(sql.includes('unnest'))return {rows:args[0].map(name=>({name,relation:name}))};return {rows:[{runs:'runs',events:'events',controls:'controls',selected_outputs:'selected_outputs'}]};}connect(){throw Error('No SQL effects');}async end(){events.push('pool-end');}}}});
mock.module('@temporalio/client',{namedExports:{WorkflowIdReusePolicy,WorkflowIdConflictPolicy,Connection:{async connect(){return {async close(){events.push('connection-close');},withDeadline(_at,fn){return fn();},withAbortSignal(_signal,fn){return fn();},workflowService:{async getSystemInfo(){}}};}},Client:class{workflow={start:async()=>{},getHandle:()=>({})};}}});
mock.module('../config.mjs',{namedExports:{...actualConfig,async readSecret(path){events.push('secret:'+path);
 if(path==='db')return Buffer.from('postgres://synthetic.invalid/db?sslmode=verify-full');
 if(path===KEY_FILE)return Buffer.alloc(32,9);if(path==='/run/secrets/short-key')return Buffer.alloc(16,9);if(path==='/run/secrets/missing-key')throw actualConfig.fault('RUNTIME_SECRET_FILE');
 return Buffer.from('synthetic');}}});
mock.module('../native-client.mjs',{namedExports:{createNativeCapabilityClient(){return {async readiness(){},async call(){throw Error('not used');}};}}});
mock.module('../http-server.mjs',{namedExports:{async listenRuntime(input){events.push('listen');await listenHook?.(input);return {address:{port:1},async close(){events.push('listener-close');}};}}});
const {startControl}=await import('../control.mjs');
const base={sourceEnabled:false,limits:{requestMs:1000,requestBytes:131072,startupMs:1000,shutdownMs:1000},native:{maxResponseBytes:131072,capabilityFile:'cap'},database:{connectionFile:'db'},temporal:{taskQueue:'synthetic',namespace:'synthetic',address:'synthetic',tls:{caFile:'ca',certFile:'cert',keyFile:'key'}},sessions:{maxSessions:10,maxTtlMs:3000},versions};
const configuration=(changes={})=>({...base,retention:{enabled:true},downloadLinks:{enabled:true,keyFile:KEY_FILE},...changes});
const identityContext={async verifyIdentity(){throw Error('synthetic refusal');},async resolveContext(){throw Error('synthetic refusal');}};
const authorization={async resolve(){return null;}};
const store=(verify=async()=>{events.push('store-verify');return {};})=>({async verifyPrivate(input){if(abortOnVerify)abortOnVerify();return verify(input);}});
const ports=(changes={})=>({identityContext,artifactOptionsOwner:authorization,artifactStore:store(),...changes});
const request=(path,body)=>new Request('https://synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer action_session_'+'a'.repeat(43),'content-type':'application/json'},body:JSON.stringify(body)});
const keyReads=()=>events.filter(e=>e.startsWith('secret:/run/secrets/')).length;

/** Starts control, captures link-route and unrelated-route answers from the listener's application, and closes it. */
async function start(config,productPorts){
 events.length=0;let link,unrelated;abortOnVerify=undefined;
 listenHook=async({application})=>{link=await application.handle(request('/api/documents/links/issue',{versionId:'00000000-0000-4000-8000-0000000000b1'}));const r=await application.handle(request('/api/documents/inspect',{versionId:'00000000-0000-4000-8000-0000000000b1'}));unrelated={status:r.status,body:await r.json()};};
 const runtime=await startControl(config,{productPorts});
 try{return {downloads:runtime.downloads,link:{status:link.status,headers:link.headers,body:await link.json()},unrelated,events:[...events]};}finally{await runtime.close();}
}
const closed=(result,reason)=>{
 assert.deepEqual(result.downloads,{enabled:false,reason});assert.equal(result.link.status,503);assert.deepEqual(result.link.body,{error:{code:'DOWNLOADS_UNAVAILABLE'}});
 assert.equal(result.link.headers.get('cache-control'),'no-store');assert.equal(result.link.headers.get('referrer-policy'),'no-referrer');
 assert.ok(result.events.includes('listen'),'the rest of the API still starts and listens');
};

test('absent or disabled configuration keeps the link routes closed, reads no key and leaves other document routes unchanged',async()=>{
 const off=await start({...base},ports());closed(off,'DOWNLOAD_LINKS_DISABLED');assert.equal(keyReads(),0);
 const disabled=await start(configuration({downloadLinks:{enabled:false}}),ports());closed(disabled,'DOWNLOAD_LINKS_DISABLED');assert.equal(keyReads(),0);
 const on=await start(configuration(),ports());assert.deepEqual(on.downloads,{enabled:true,reason:'ENABLED'});
 for(const r of [off,disabled])assert.deepEqual(r.unrelated,on.unrelated);assert.equal(on.unrelated.status,503);assert.equal(on.unrelated.body.error.code,'UNAVAILABLE');
});
test('each missing owner keeps the gate closed with its own reason and never reads the signing key',async()=>{
 const {retention,...noRetention}=configuration();
 closed(await start(noRetention,ports()),'DOWNLOAD_LINK_RETENTION_UNAVAILABLE');assert.equal(keyReads(),0);
 const {artifactOptionsOwner,...noAuthorization}=ports();closed(await start(configuration(),noAuthorization),'DOWNLOAD_LINK_AUTHORIZATION_UNAVAILABLE');assert.equal(keyReads(),0);
 const {artifactStore,...noStore}=ports();closed(await start(configuration(),noStore),'DOWNLOAD_LINK_STORE_UNAVAILABLE');assert.equal(keyReads(),0);
 closed(await start(configuration(),ports({artifactStore:store(async()=>{throw Object.assign(Error('ARTIFACT_S3_NOT_PRIVATE'),{code:'ARTIFACT_S3_NOT_PRIVATE'});})})),'DOWNLOAD_LINK_STORE_UNVERIFIED');assert.equal(keyReads(),0);
});
test('an unreadable or short signing key keeps the gate closed after the store is verified',async()=>{
 for(const keyFile of ['/run/secrets/missing-key','/run/secrets/short-key']){const r=await start(configuration({downloadLinks:{enabled:true,keyFile}}),ports());closed(r,'DOWNLOAD_LINK_KEY_UNAVAILABLE');assert.equal(keyReads(),1);assert.ok(r.events.indexOf('store-verify')<r.events.indexOf('secret:'+keyFile));}
});
test('verified owners open the gate before the listener; the key is read once through readSecret and the routes reach the link application',async()=>{
 const r=await start(configuration({downloadLinks:{enabled:true,keyFile:KEY_FILE,ttlMs:30000}}),ports());assert.deepEqual(r.downloads,{enabled:true,reason:'ENABLED'});
 assert.deepEqual(r.events.filter(e=>e==='secret:'+KEY_FILE),['secret:'+KEY_FILE]);
 assert.ok(r.events.indexOf('store-verify')<r.events.indexOf('secret:'+KEY_FILE));assert.ok(r.events.indexOf('secret:'+KEY_FILE)<r.events.indexOf('listen'));
 // The synthetic bearer is not a live session: the link application refuses it through the canonical session owner, not the gate.
 assert.equal(r.link.status,403);assert.equal(r.link.body.error.code,'SESSION_REFUSED');assert.equal(r.link.headers.get('referrer-policy'),'no-referrer');
});
test('startup cancelled during the store proof fails closed, never reads the key and never listens',async()=>{
 events.length=0;const abort=new AbortController();abortOnVerify=()=>abort.abort();
 await assert.rejects(startControl(configuration(),{signal:abort.signal,productPorts:ports()}),{code:'CONTROL_STARTUP_FAILED'});
 assert.equal(events.includes('listen'),false);assert.equal(keyReads(),0);assert.deepEqual(events.slice(-2),['connection-close','pool-end']);abortOnVerify=undefined;
});
test('configuration admits only a closed control downloadLinks block with an absolute key file and a lifetime of at most five minutes',async()=>{
 const {candidateFixture}=await import('./prepared-candidate-fixture.mjs'),control=downloadLinks=>({...candidateFixture().configuration,downloadLinks});
 for(const d of [{enabled:false},{enabled:true,keyFile:KEY_FILE},{enabled:true,keyFile:KEY_FILE,ttlMs:1000},{enabled:true,keyFile:KEY_FILE,ttlMs:300000}])assert.doesNotThrow(()=>actualConfig.validateConfiguration(control(d),'control'),JSON.stringify(d));
 for(const d of [{enabled:true},{enabled:'true',keyFile:KEY_FILE},{enabled:true,keyFile:'relative/key'},{enabled:true,keyFile:KEY_FILE,ttlMs:999},{enabled:true,keyFile:KEY_FILE,ttlMs:300001},{enabled:true,keyFile:KEY_FILE,key:'inline'},{enabled:true,keyFile:KEY_FILE,url:'https://bucket.invalid'}])
  assert.throws(()=>actualConfig.validateConfiguration(control(d),'control'),/DOWNLOAD_LINK_CONFIGURATION|RUNTIME_CONFIGURATION|INVALID_COMMAND/u,JSON.stringify(d));
 const {native,http,temporal,version,profile,sourceEnabled,limits}=candidateFixture().configuration;
 assert.throws(()=>actualConfig.validateConfiguration({native,http,temporal,version,profile,sourceEnabled,limits,downloadLinks:{enabled:false}},'temporal-worker'),/RUNTIME_CONFIGURATION|INVALID_COMMAND|DOWNLOAD_LINK_CONFIGURATION/u);
});
