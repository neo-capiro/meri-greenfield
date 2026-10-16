/** SYNTHETIC runner composition. No general-read installation/discovery/allocation receipt or provider is supplied. */
import {test,mock} from 'node:test';import assert from 'node:assert/strict';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {captureGeneralReadPort} from '../general-read-port.mjs';
import * as configModule from '../config.mjs';
import * as preparationModule from '../native-authority/preparation-intent.mjs';
const f=candidateFixture();let activityOptions,secrets=0,taskSecret=f.secret.task;
mock.module('../../worker/conversation/activity.mjs',{namedExports:{createConversationActivity(options){activityOptions=options;return async()=> 'synthetic-no-query';}}});
mock.module('../config.mjs',{namedExports:{...configModule,async readSecret(){secrets++;return Buffer.from(taskSecret);}}});
mock.module('../native-client.mjs',{namedExports:{createNativeCapabilityClient(){return {async call(){throw Error('No native effect');}};}}});
mock.module('../native-authority/preparation-intent.mjs',{namedExports:{...preparationModule,compileNativePreparationIntent(value){return value;}}});
const {assembleConversationRunner}=await import('../conversation-runner.mjs');
const {runRemoteConversation}=await import('../remote-conversation-runner.mjs');
function port(){const owners=new WeakSet();let calls=0;const value={async readAvailability(input){assert.equal(owners.has(this),true);calls++;return input;},async execute(input){assert.equal(owners.has(this),true);calls++;return input;}};owners.add(value);return {value,calls:()=>calls};}
test('capturing the trusted mount is inert, receiver-preserving and rejects getters even while disabled',async()=>{
 const p=port(),captured=captureGeneralReadPort(p.value,true);assert.equal(p.calls(),0);p.value.execute=()=>{throw Error('replaced');};const input={operation:'synthetic'};assert.equal(await captured.execute(input),input);assert.equal(p.calls(),1);assert.ok(Object.isFrozen(captured));
 assert.equal(captureGeneralReadPort(port().value,false),undefined);let getters=0;const hostile={get readAvailability(){getters++;return ()=>{};},async execute(){}};
 assert.throws(()=>captureGeneralReadPort(hostile,false));assert.equal(getters,0);
});
for(const enabled of [false,true])test(`ordinary runner passes only an explicitly enabled borrowed read port (${enabled}) to existing activity`,async()=>{
 const p=port(),execute=assembleConversationRunner({configuration:{binding:f.binding,versions:f.configuration.versions,sourceEnabled:enabled},native:{async call(){throw Error('No effect');}},generalReads:p.value});
 assert.equal(await execute({binding:f.binding}),'synthetic-no-query');assert.equal(Object.hasOwn(activityOptions,'generalReads'),enabled);assert.equal(p.calls(),0);
 if(enabled){assert.equal(await activityOptions.generalReads.readAvailability('synthetic'), 'synthetic');assert.equal(p.calls(),1);}
});
const remoteConfiguration=enabled=>({...f.configuration,binding:f.binding,workspace:f.configuration.nativeCandidate.preparationIntent.workspace,sourceEnabled:enabled,
 remoteTask:{original:{binding:f.binding,versions:f.configuration.versions,executionKey:'x',executionId:'x',planSha256:'x',expiresAtMs:Date.now()+1000},preparationIntent:f.configuration.nativeCandidate.preparationIntent,taskArn:'synthetic',controlCapabilitySha256:'a'.repeat(64),processOrigin:'https://process.synthetic.invalid',http:f.configuration.http}});
for(const enabled of [false,true])test(`remote runner retains passive read port through existing execute boundary (${enabled})`,async()=>{
 const configuration=remoteConfiguration(enabled),{createExecutionBinding}=await import('../../control/conversations/execution-boundary.mjs');configuration.remoteTask.original=createExecutionBinding({binding:f.binding,versions:f.configuration.versions,plan:{synthetic:true},expiresAtMs:Date.now()+1000});
 const p=port();let closes=0;const result=await runRemoteConversation(configuration,{generalReads:p.value,fetchImpl(){throw Error('No fetch');},sessionFactory(){throw Error('No initialization');},
  createWorker(){return {query(){throw Error('No SDK');},application:{async handle(){return null;}},async close(){closes++;}};},async listen(){return {async close(){closes++;}};},
  async execute(_configuration,options){assert.equal(Object.hasOwn(options,'generalReads'),enabled);if(enabled)assert.equal(await options.generalReads.execute('synthetic'),'synthetic');return 'borrowed';}});
 assert.equal(result,'borrowed');assert.equal(closes,2);assert.equal(p.calls(),enabled?1:0);
});
test('malformed borrowed read port refuses remote startup before secret or owned resource allocation',async()=>{
 const before=secrets;let getters=0;await assert.rejects(runRemoteConversation({}, {generalReads:{get execute(){getters++;return ()=>{};},readAvailability(){}}}));assert.equal(getters,0);assert.equal(secrets,before);
});

test('remote runner constructs the canonical native client from bootstrap config and TASK credential when no borrowed port exists',async()=>{
 const {readsFixture}=await import('../native-authority/test/reads-fixture.mjs'),r=await readsFixture(),{createExecutionBinding}=await import('../../control/conversations/execution-boundary.mjs'),configuration=remoteConfiguration(true);configuration.binding=r.binding;configuration.remoteTask.original=createExecutionBinding({binding:r.binding,versions:f.configuration.versions,plan:{synthetic:true},expiresAtMs:r.now()+1000});configuration.remoteTask.approvedReads=r.config;taskSecret=r.credential;const clock=mock.method(Date,'now',r.now);let calls=0;
 try{const result=await runRemoteConversation(configuration,{async fetchImpl(url,init){calls++;assert.equal(init.headers.authorization,'Bearer '+r.credential);assert.equal(init.credentials,'omit');return r.application.handle(new Request(url,init));},sessionFactory(){assert.fail('No session initialization');},createWorker(){return {query(){assert.fail('No SDK');},application:{async handle(){return null;}},async close(){}};},async listen(){return {async close(){}};},async execute(_c,options){const snapshot=await options.generalReads.readAvailability();assert.ok(snapshot.installation.operations.length);return 'actual-native-client';}});assert.equal(result,'actual-native-client');assert.equal(calls,1);
 }finally{taskSecret=f.secret.task;clock.mock.restore();}
});
