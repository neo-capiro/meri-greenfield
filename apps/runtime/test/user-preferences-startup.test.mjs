/** Actual control assembly/startup and preferences owners. SQL, secrets, Temporal, native startup and listeners are SYNTHETIC.
 * Prepared allocation/compiler and unrelated artifact recovery are borrowed; no live database, schema or service is qualified. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {productFailure} from '../../control/product-access/errors.mjs';
import {fixture} from '../../control/settings/user-application/test/fixture.mjs';
import {createSettingsPoolFixture} from '../../control/settings/test/postgres-store-fixture.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
mock.module('../prepared-candidate-config.mjs',{namedExports:{compilePreparedCandidateConfiguration:value=>value}});
mock.module('../artifacts/composition.mjs',{namedExports:{runtimeArtifactRecovery(){return null;}}});
const actualConfig=await import('../config.mjs');let active;
mock.module('../config.mjs',{namedExports:{...actualConfig,async readSecret(path){active.events.push('secret:'+path);return Buffer.from(path==='db'?'postgres://synthetic.invalid/preferences?sslmode=verify-full':'synthetic');}}});
mock.module('pg',{namedExports:{Pool:class{constructor(){active.events.push('pool');return active.pool;}}}});
mock.module('@temporalio/client',{namedExports:{WorkflowIdReusePolicy,WorkflowIdConflictPolicy,
 Connection:{async connect(){active.events.push('temporal');return {withDeadline(_deadline,fn){return fn();},withAbortSignal(_signal,fn){return fn();},workflowService:{async getSystemInfo(){active.events.push('temporal-ready');}},async close(){active.events.push('temporal-close');}};}},
 Client:class{workflow={async start(){assert.fail('preferences must not dispatch a conversation');},getHandle(){assert.fail('preferences must not access a workflow');}};}}});
mock.module('../native-client.mjs',{namedExports:{createNativeCapabilityClient(){active.events.push('native');return active.native;}}});
mock.module('../prepared-candidate.mjs',{namedExports:{async startPreparedCandidate({pool}){
 assert.equal(pool,active.pool);active.events.push('candidate');return {controlCapabilitySha256:capabilityDigest('synthetic'),native:active.native,
  productPorts:active.membership?{conversationMembership:active.membership}:{},application:{async handle(request){assert.ok(!new URL(request.url).pathname.startsWith('/api/settings/'));return null;}},
  bindApplication(application){active.bound=application;},async close(){active.events.push('candidate-close');}};
}}});
mock.module('../http-server.mjs',{namedExports:{async listenRuntime(input){
 const name=input.configuration.http.port===1002?'private':'public';active.events.push('listen:'+name);
 if(active.failListener===name)throw Error('synthetic bind failure');active.listeners[name]=input;
 return {address:{port:input.configuration.http.port},async close(){active.events.push('listener-close:'+name);}};
}}});
const {assembleControl,startControl}=await import('../control.mjs');
const base={sourceEnabled:false,versions,http:{hostname:'127.0.0.1',port:1001,frontendOrigin:'https://ui.synthetic.invalid'},
 privateHttp:{hostname:'127.0.0.1',port:1002,frontendOrigin:'https://ui.synthetic.invalid'},
 limits:{requestMs:1000,requestBytes:131072,startupMs:1000,shutdownMs:1000},native:{maxResponseBytes:131072,capabilityFile:'cap'},
 nativeCandidate:{controlCapabilityFile:'cap'},database:{connectionFile:'db'},temporal:{taskQueue:'synthetic',namespace:'synthetic',address:'synthetic',tls:{caFile:'ca',certFile:'cert',keyFile:'key'}},sessions:{maxSessions:10,maxTtlMs:3000}};
const request=(operation,body={})=>new Request('https://meri.synthetic.invalid/api/settings/user/'+operation,{method:'POST',headers:{authorization:'Bearer A','content-type':'application/json'},body:JSON.stringify(body)});
function scenario({scripts=[],membership=true,missingSchema=false,enabled=true,failListener,schemaHook}={}){
 const identity=fixture(),sql=createSettingsPoolFixture(scripts),events=[],listeners={};identity.state.now=Date.now();
 const state={identity,sql,events,listeners,membership:membership?identity.gate:undefined,missingSchema,failListener,schemaHook,ends:0,bound:null,
  native:{async readiness(){events.push('native-ready');},async call(){assert.fail('preferences must not invoke native task authority');}}};
 state.pool={...sql.pool,async query(statement,params){
  if(statement.includes('unnest')){events.push('settings-schema');assert.deepEqual(params,[['meri_settings.user_preferences','meri_settings.settings_audit']]);await state.schemaHook?.();return {rows:params[0].map(name=>({name,relation:state.missingSchema?null:name}))};}
  events.push('conversation-schema');assert.ok(statement.includes("to_regclass('meri_conversations.initial_inputs')"));return {rows:[{runs:'runs',events:'events',controls:'controls',selected_outputs:'selected_outputs',initial_inputs:'initial_inputs'}]};
 },async end(){state.ends++;events.push('pool-end');}};
 state.configuration={...base,...(enabled===undefined?{}:{userPreferences:{enabled}})};active=state;return state;
}
const cleanup=['listener-close:public','listener-close:private','candidate-close','temporal-close','pool-end'];
test('actual assembly leaves absent/false preferences inert and never closes the borrowed pool',async()=>{
 for(const enabled of [undefined,false]){
  const s=scenario({enabled}),configuration={...s.configuration};if(enabled===undefined)delete configuration.userPreferences;
  const assembly=assembleControl({configuration,pool:s.pool,client:{workflow:{async start(){assert.fail('disabled preferences must not dispatch');},getHandle(){assert.fail('disabled preferences must not read a workflow');}}},native:s.native,canonicalProductPorts:{conversationMembership:s.membership},now:()=>s.identity.state.now});
  assert.equal(assembly.userPreferences.state(),'disabled');await assembly.userPreferences.readiness();
  assert.equal((await assembly.application.handle(request('save'))).status,503);assert.deepEqual(s.events,[]);assert.equal(s.identity.state.identities.length,0);assert.equal(s.sql.connections(),0);
  assembly.close();assert.equal(assembly.sessions.status().closed,true);assert.equal(assembly.userPreferences.state(),'retired');assert.equal(s.ends,0);
 }
});
test('prepared canonical membership joins actual startup/API/store read-save-readback before owned cleanup',async()=>{
 const preferences={...fixture().preferences,theme:'dark',density:'compact'},row={revision:'1',document:preferences,document_sha256:canonicalSha256(preferences)};
 const s=scenario({scripts:[{steps:[{match:/^SELECT revision,document/u,rows:[]}]},
  {steps:[{match:/^INSERT INTO meri_settings.user_preferences/u,rows:[row],inspect(params){assert.deepEqual(params.slice(0,2),['tenant-A','actor-A']);assert.equal(params[2],1);assert.deepEqual(JSON.parse(params[3]),preferences);}},{match:/^INSERT INTO meri_settings.settings_audit/u}]},
  {steps:[{match:/^SELECT revision,document/u,rows:[row]}]}]});
 const runtime=await startControl(s.configuration);
 try{
  assert.ok(s.events.indexOf('settings-schema')<s.events.indexOf('listen:private'));assert.ok(s.events.indexOf('listen:private')<s.events.indexOf('listen:public'));
  const app=s.listeners.public.application;assert.equal((await app.handle(request('read'))).status,200);
  const saved=await app.handle(request('save',{expectedRevision:0,preferences}));assert.equal(saved.status,200);
  const expected={owner:{tenantId:'tenant-A',actorId:'actor-A'},revision:1,preferences};assert.deepEqual(await saved.json(),expected);assert.deepEqual(await (await app.handle(request('read'))).json(),expected);
  assert.equal((await s.listeners.private.application.handle(request('read'))).status,404);
  assert.ok(s.identity.state.identities.length>=3);assert.ok(s.identity.state.identities.every(call=>call.credential==='A'));assert.equal(s.sql.committed.filter(entry=>entry.kind==='audit').length,1);assert.equal(s.sql.released.length,3);assert.equal(s.ends,0);
 }finally{await runtime.close();await runtime.close();}
 assert.deepEqual(s.events.slice(-5),cleanup);assert.equal(s.ends,1);assert.equal((await s.bound.handle(request('read'))).status,503);
});
test('startup false opt-in does not query settings or authenticate and still closes owned resources',async()=>{
 const s=scenario({enabled:false}),runtime=await startControl(s.configuration);assert.equal(s.events.includes('settings-schema'),false);
 assert.equal((await s.listeners.public.application.handle(request('read'))).status,503);assert.equal(s.sql.connections(),0);assert.equal(s.identity.state.identities.length,0);
 await runtime.close();assert.equal(s.ends,1);assert.deepEqual(s.events.slice(-5),cleanup);
});
test('enabled missing membership or settings schema fails before listeners and preserves startup cleanup',async()=>{
 for(const options of [{membership:false},{missingSchema:true}]){
  const s=scenario(options);await assert.rejects(startControl(s.configuration),error=>error.code==='CONTROL_STARTUP_FAILED'&&productFailure(error.cause)?.code==='USER_PREFERENCES_UNAVAILABLE');
  assert.equal(s.events.some(event=>event.startsWith('listen:')),false);assert.equal(s.sql.connections(),0);assert.equal(s.ends,1);assert.deepEqual(s.events.slice(-3),['candidate-close','temporal-close','pool-end']);
 }
});
test('invalid feature declarations fail before secret reads or allocation',async()=>{
 for(const userPreferences of [{enabled:'true'},{enabled:true,authority:{}},null]){
  const s=scenario();await assert.rejects(startControl({...s.configuration,userPreferences}));assert.deepEqual(s.events,[]);assert.equal(s.ends,0);
 }
});
test('cancellation during settings schema readiness cannot open listeners and closes owned startup resources',async()=>{
 const abort=new AbortController(),s=scenario({schemaHook(){abort.abort();}});await assert.rejects(startControl(s.configuration,{signal:abort.signal}),{code:'CONTROL_STARTUP_FAILED'});
 assert.equal(s.events.includes('settings-schema'),true);assert.equal(s.events.some(event=>event.startsWith('listen:')),false);assert.equal(s.sql.connections(),0);assert.deepEqual(s.events.slice(-3),['candidate-close','temporal-close','pool-end']);assert.equal(s.ends,1);
});
test('a failed public bind retires the open private listener and all startup owners once',async()=>{
 const s=scenario({failListener:'public'});await assert.rejects(startControl(s.configuration),{code:'CONTROL_STARTUP_FAILED'});
 assert.deepEqual(s.events.slice(-4),['listener-close:private','candidate-close','temporal-close','pool-end']);assert.equal(s.sql.connections(),0);assert.equal(s.ends,1);assert.equal((await s.bound.handle(request('read'))).status,503);
});
