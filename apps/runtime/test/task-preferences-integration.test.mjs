/** Actual merged control/startup, public/private boundary and both application owners.
 * SQL/Temporal/listener/native preparation, identity and Core Fetch boundaries are SYNTHETIC; no service is contacted.
 * Explicit source-enabled module compositions below are not validated configurations or activation evidence. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';import {resolve} from 'node:path';
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {fixture as membershipFixture} from '../../control/settings/user-application/test/fixture.mjs';
import {createSettingsPoolFixture} from '../../control/settings/test/postgres-store-fixture.mjs';
import {commandComposition,id} from '../../control/intents/test/fixture.mjs';
import {createTaskCommandApplication} from '../../control/task-command-application/index.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
import {createControlRouteApplications} from '../control-route-boundary.mjs';
import {productReadiness} from '../product-readiness.mjs';
mock.module('../prepared-candidate-config.mjs',{namedExports:{compilePreparedCandidateConfiguration:value=>value}});
mock.module('../artifacts/composition.mjs',{namedExports:{runtimeArtifactRecovery(){return null;}}});
const actualConfig=await import('../config.mjs');let active;
mock.module('../config.mjs',{namedExports:{...actualConfig,async readSecret(path){active.events.push('secret');return Buffer.from(path==='db'?'postgres://synthetic.invalid/integration?sslmode=verify-full':'synthetic');}}});
mock.module('pg',{namedExports:{Pool:class{constructor(){active.events.push('pool');return active.pool;}}}});
mock.module('@temporalio/client',{namedExports:{WorkflowIdReusePolicy,WorkflowIdConflictPolicy,
 Connection:{async connect(){return {withDeadline(_at,fn){return fn();},withAbortSignal(_signal,fn){return fn();},workflowService:{async getSystemInfo(){}},async close(){active.events.push('temporal-close');}};}},
 Client:class{workflow={async start(){assert.fail('product requests must not dispatch conversations');},getHandle(){assert.fail('product requests must not read workflows');}};}}});
mock.module('../native-client.mjs',{namedExports:{createNativeCapabilityClient(){return active.native;}}});
mock.module('../prepared-candidate.mjs',{namedExports:{async startPreparedCandidate({pool}){
 assert.equal(pool,active.pool);return {controlCapabilitySha256:capabilityDigest('synthetic'),native:active.native,productPorts:active.ports,
  application:active.candidate,bindApplication(application){active.bound=application;},async close(){active.events.push('candidate-close');}};
}}});
mock.module('../http-server.mjs',{namedExports:{async listenRuntime(input){
 const name=input.configuration.http.port===1002?'private':'public';active.events.push('listen:'+name);active.listeners[name]=input;
 return {address:{port:input.configuration.http.port},async close(){active.events.push('listener-close:'+name);}};
}}});
const {assembleControl,startControl}=await import('../control.mjs');
const base={sourceEnabled:false,versions,http:{hostname:'127.0.0.1',port:1001,frontendOrigin:'https://ui.synthetic.invalid'},
 privateHttp:{hostname:'127.0.0.1',port:1002,frontendOrigin:'https://ui.synthetic.invalid'},
 limits:{requestMs:1000,requestBytes:131072,startupMs:1000,shutdownMs:1000},native:{maxResponseBytes:131072,capabilityFile:'cap'},
 nativeCandidate:{controlCapabilityFile:'cap'},database:{connectionFile:'db'},temporal:{taskQueue:'synthetic',namespace:'synthetic',address:'synthetic',tls:{caFile:'ca',certFile:'cert',keyFile:'key'}},sessions:{maxSessions:10,maxTtlMs:3000}};
const paths=['/api/task-commands/prepare','/api/task-commands/execute','/api/settings/user/read','/api/settings/user/save'];
const request=(path,body={},credential=path.startsWith('/api/settings/')?'A':'synthetic-session')=>new Request('https://meri.synthetic.invalid'+path,
 {method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)});
const unavailable=async response=>{assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'TASK_COMMAND_UNAVAILABLE',outcome:'NOT_DISPATCHED'}});};
function scenario({sourceEnabled=false,taskOwner=true,scripts=[],schemaHook}={}){
 const membership=membershipFixture(),task=commandComposition({action:'task.update'}),sql=createSettingsPoolFixture(scripts);membership.state.now=Date.now();
 const state={membership,task,sql,events:[],listeners:{},schemaHook,taskResolutions:0,privateCalls:0,ends:0};
 const api=createTaskCommandApplication({now:()=>task.f.state.now,limits:{maxRequestMs:1000,maxRequestBytes:65536,maxResponseBytes:65536},async resolveSession(call){
  state.taskResolutions++;assert.equal(call.credential,'synthetic-session');return {binding:task.binding,commandOptions:task.commandOptions,checkedAtMs:task.f.state.now,expiresAtMs:task.f.state.now+1000,
   async authorizeExecution({proposal}){return {credential:'synthetic',execution:{...task.f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey}};}};
 }});
 state.ports={conversationMembership:membership.gate,...(taskOwner?{taskCommandApplication:api}:{})};
 state.native={async readiness(){},async call(){assert.fail('no native capability call in product integration');}};
 state.candidate={async handle(r){state.privateCalls++;assert.equal(new URL(r.url).pathname,'/v1/native-task/probe');return Response.json({syntheticProtected:true});}};
 state.pool={...sql.pool,async query(statement,params){
  if(statement.includes('unnest')){state.events.push('settings-schema');await state.schemaHook?.(state);return {rows:params[0].map(name=>({name,relation:name}))};}
  assert.ok(statement.includes("to_regclass('meri_conversations.initial_inputs')"));return {rows:[{runs:'runs',events:'events',controls:'controls',selected_outputs:'selected_outputs',initial_inputs:'initial_inputs'}]};
 },async end(){state.ends++;}};
 state.configuration={...base,sourceEnabled,userPreferences:{enabled:true}};active=state;return state;
}
function assembled(state){
 const assembly=assembleControl({configuration:state.configuration,pool:state.pool,client:{workflow:{async start(){assert.fail('no workflow dispatch');},getHandle(){assert.fail('no workflow read');}}},native:state.native,canonicalProductPorts:state.ports});
 return {assembly,routes:createControlRouteApplications({assembly:assembly.application,candidate:state.candidate})};
}
function preferenceScripts(preferences){
 const row={revision:'1',document:preferences,document_sha256:canonicalSha256(preferences)};
 return [{steps:[{match:/^SELECT revision,document/u,rows:[]}]},
  {steps:[{match:/^INSERT INTO meri_settings.user_preferences/u,rows:[row],inspect(params){assert.deepEqual(params.slice(0,2),['tenant-A','actor-A']);assert.deepEqual(JSON.parse(params[3]),preferences);}},{match:/^INSERT INTO meri_settings.settings_audit/u}]},
  {steps:[{match:/^SELECT revision,document/u,rows:[row]}]}];
}
test('actual separate-listener startup opens preferences after schema readiness while captured task commands remain disabled',async()=>{
 const preferences={...membershipFixture().preferences,theme:'dark',density:'compact'},s=scenario({scripts:preferenceScripts(preferences),async schemaHook(state){
  assert.equal(Object.keys(state.listeners).length,0);assert.equal((await state.bound.handle(request(paths[2]))).status,503);
  for(const path of paths.slice(0,2))await unavailable(await state.bound.handle(request(path)));assert.equal(state.taskResolutions,0);
 }});
 const runtime=await startControl(s.configuration);
 try{
  const app=s.listeners.public.application;assert.ok(s.events.indexOf('settings-schema')<s.events.indexOf('listen:private'));assert.ok(s.events.indexOf('listen:private')<s.events.indexOf('listen:public'));
  assert.equal((await app.handle(request(paths[2]))).status,200);const saved=await app.handle(request(paths[3],{expectedRevision:0,preferences}));assert.equal(saved.status,200);
  const expected={owner:{tenantId:'tenant-A',actorId:'actor-A'},revision:1,preferences};assert.deepEqual(await saved.json(),expected);assert.deepEqual(await (await app.handle(request(paths[2]))).json(),expected);
  for(const path of paths.slice(0,2))await unavailable(await app.handle(request(path)));for(const path of paths)assert.equal((await s.listeners.private.application.handle(request(path))).status,404);
  assert.equal(s.taskResolutions,0);assert.equal(s.task.metadataCalls.prepare,0);assert.equal(s.task.f.state.fetches,0);assert.equal(s.sql.committed.filter(row=>row.kind==='audit').length,1);assert.equal(s.sql.released.length,3);assert.equal(s.privateCalls,0);
 }finally{await runtime.close();}
 assert.equal(s.ends,1);assert.equal((await s.bound.handle(request(paths[2]))).status,503);
});
test('explicit synthetic source-enabled composition reaches both actual APIs through the public boundary and keeps separate approval',async()=>{
 const s=scenario({sourceEnabled:true,scripts:[{steps:[{match:/^SELECT revision,document/u,rows:[]}]}]}),{assembly,routes}=assembled(s);
 try{
  await assembly.userPreferences.readiness();assert.equal((await routes.public.handle(request(paths[2]))).status,200);
  const prepared=await routes.public.handle(request(paths[0],{arguments:{taskId:id(21),title:'Updated',status:'open'}}));assert.equal(prepared.status,200);const {proposal}=await prepared.json();
  assert.equal(s.task.f.state.fetches,0);assert.notEqual((await routes.public.handle(request(paths[1],{proposal}))).status,200);assert.equal(s.task.f.state.fetches,0);
  s.task.approve(proposal);const executed=await routes.public.handle(request(paths[1],{proposal}));assert.equal(executed.status,200);assert.equal((await executed.json()).status,'observed');
  assert.equal((await routes.public.handle(request(paths[1],{proposal}))).status,200);assert.equal(s.task.f.state.fetches,1);assert.equal(s.task.f.state.http.url,'https://source.invalid/clio/tools/update_task');assert.deepEqual(JSON.parse(s.task.f.state.http.options.body),{taskId:id(21),title:'Updated',status:'todo'});
  const census=assembly.productReadiness();assert.equal(census.owners.find(owner=>owner.name==='tasks.commands').state,'composed');assert.equal(census.owners.find(owner=>owner.name==='settings.userPreferences').state,'composed');assert.equal(census.ready,false);
 }finally{assembly.close();}assert.equal(s.ends,0,'assembly must not dispose its borrowed pool');
});
test('source-enabled synthetic composition without a trusted task application stays closed while preferences still reads',async()=>{
 const s=scenario({sourceEnabled:true,taskOwner:false,scripts:[{steps:[{match:/^SELECT revision,document/u,rows:[]}]}]}),{assembly,routes}=assembled(s);
 try{await assembly.userPreferences.readiness();assert.equal((await routes.public.handle(request(paths[2]))).status,200);for(const path of paths.slice(0,2))await unavailable(await routes.public.handle(request(path)));
  assert.equal(assembly.productReadiness().owners.find(owner=>owner.name==='tasks.commands').state,'unavailable');assert.equal(s.taskResolutions,0);assert.equal(s.task.f.state.fetches,0);
 }finally{assembly.close();}
});
test('public mounts are exact and both applications remain excluded from the protected listener',async()=>{
 const s=scenario(),{assembly,routes}=assembled(s);
 try{
  for(const path of ['/api/task-commands','/api/task-commands/prepares','/api/task-commands/prepare/extra','/api/task-commands/%70repare','/api/settings/tenant/read','/api/settings/user/read/extra','/v1/native-task/probe'])assert.equal((await routes.public.handle(request(path))).status,404,path);
  for(const path of paths)assert.equal((await routes.private.handle(request(path))).status,404,path);assert.equal(s.privateCalls,0);
  assert.equal((await routes.private.handle(request('/v1/native-task/probe'))).status,200);assert.equal(s.privateCalls,1);assert.equal(s.taskResolutions,0);assert.equal(s.sql.connections(),0);
 }finally{assembly.close();}
});
test('actual configuration accepts only source-disabled control; composition metadata cannot enable a source',()=>{
 const file=name=>resolve('synthetic-integration-inputs',name),configuration={version:1,profile:'isolated-preview',sourceEnabled:false,versions,
  limits:base.limits,userPreferences:{enabled:true},http:base.http,database:{connectionFile:file('db')},sessions:{mode:'process-local',replicas:1,maxSessions:10,maxTtlMs:3000},
  temporal:{address:'temporal.synthetic.invalid:7233',namespace:'synthetic',taskQueue:'synthetic',tls:{caFile:file('ca'),certFile:file('cert'),keyFile:file('key')}},
  native:{origin:'https://control.synthetic.invalid',capabilityFile:file('cap'),loopback:false,maxResponseBytes:131072}};
 assert.equal(actualConfig.validateConfiguration(configuration,'control').sourceEnabled,false);assert.throws(()=>actualConfig.validateConfiguration({...configuration,sourceEnabled:true},'control'),{code:'RUNTIME_CONFIGURATION'});
});
test('readiness distinguishes disabled, missing and composed task ownership without claiming live readiness',()=>{
 for(const [sourceEnabled,configuredOwners,expected]of [[false,[],'disabled'],[false,['taskCommandApplication'],'disabled'],[true,[],'unavailable'],[true,['taskCommandApplication'],'composed']]){
  const census=productReadiness({ports:{configuredOwners},sourceEnabled,userPreferences:'composed'});assert.equal(census.owners.find(owner=>owner.name==='tasks.commands').state,expected);assert.equal(census.ready,false);
  assert.ok(census.missingOwners.includes('sources.currentInstallation'));assert.ok(census.missingOwners.includes('proxy.modelGrants'));
 }
});
