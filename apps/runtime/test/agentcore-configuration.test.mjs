import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfiguration} from '../config.mjs';
import {main} from '../cli.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../product-ports/capability-policy.mjs';

test('control compiles the one AgentCore deployment and keeps private listener, Temporal and product declarations',()=>{
 const c=agentcoreControlFixture().configuration;
 assert.equal(validateConfiguration(c,'control').agentcore.runtimeVersion,'2');
 assert.equal(validateConfiguration(c,'control').privateHttp.port,8082);
 for(const change of [v=>delete v.agentcore,v=>v.nativeCandidate={},v=>v.taskRouter={},v=>v.privateHttp.frontendOrigin=v.http.frontendOrigin,v=>v.privateHttp.port=8080]){
  const v=structuredClone(c);change(v);assert.throws(()=>validateConfiguration(v,'control'));
 }
});
test('typed read configuration refuses obsolete grant/installation/delegation knobs and credential files',()=>{
 const c=agentcoreControlFixture().configuration;c.capabilityPlatform=PROPOSED_PREVIEW_CAPABILITY_PLATFORM;
 c.reads={enabled:true,serviceSecretFile:'/run/secrets/core-service',defaultCongress:119};
 assert.doesNotThrow(()=>validateConfiguration(c,'control'));
 for(const [key,value] of [['installation',{enabled:true}],['delegation',{enabled:true}],['gateway',{}],['retainedAuthority',{}],['nativeReadCredentialFile','/synthetic/user']]){
  const v=structuredClone(c);v.reads[key]=value;assert.throws(()=>validateConfiguration(v,'control'));
 }
 const missing=structuredClone(c);delete missing.capabilityPlatform;assert.throws(()=>validateConfiguration(missing,'control'));
});
test('the obsolete per-task runner CLI role cannot be configured; CLI imports without its removed export',async()=>{
 assert.throws(()=>validateConfiguration(agentcoreControlFixture().configuration,'conversation-runner'));
 const write=process.stdout.write,lines=[];process.stdout.write=function(chunk){lines.push(String(chunk));return true;};
 try{assert.equal(await main(['--help']),0);}finally{process.stdout.write=write;}
 assert.match(lines.join(''),/<control\|temporal-worker\|schedule-worker>/u);
 assert.doesNotMatch(lines.join(''),/conversation-runner/u);
});
