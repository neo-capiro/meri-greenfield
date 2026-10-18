import test from 'node:test';import assert from 'node:assert/strict';
import {validateConfiguration} from '../config.mjs';
test('control admits a closed reads block: enabled needs an absolute service secret file and never takes a bearer file',async()=>{
 const {candidateFixture}=await import('./prepared-candidate-fixture.mjs'),control=reads=>({...candidateFixture().configuration,reads});
 for(const r of [{enabled:false},{enabled:true,serviceSecretFile:'/run/meri/core-tool-service-secret'},{enabled:true,serviceSecretFile:'/run/meri/a',readModeServiceSecretFile:'/run/meri/b',defaultCongress:119}])
  assert.doesNotThrow(()=>validateConfiguration(control(r),'control'),JSON.stringify(r));
 for(const r of [{},{enabled:'yes'},{enabled:true},{enabled:true,serviceSecretFile:'relative'},{enabled:false,serviceSecretFile:'/run/meri/a'},{enabled:true,serviceSecretFile:'/run/meri/a',nativeReadCredentialFile:'/run/meri/user'},{enabled:true,serviceSecretFile:'/run/meri/a',defaultCongress:0}])
  assert.throws(()=>validateConfiguration(control(r),'control'),JSON.stringify(r));
});
test('control admits reads.installation (64-hex pin, distinct material file, exact revocations) and reads.discovery (enabled needs capabilityPlatform); disabled blocks name nothing',async()=>{
 const {candidateFixture}=await import('./prepared-candidate-fixture.mjs'),{PROPOSED_PREVIEW_CAPABILITY_PLATFORM}=await import('../product-ports/capability-policy.mjs');
 const control=(reads,extra={})=>({...candidateFixture().configuration,...extra,reads});
 const base={enabled:true,serviceSecretFile:'/run/meri/core-service-secret',readModeServiceSecretFile:'/run/meri/core-read-mode-service-secret'},op={id:'read_bill_text',version:'0.2.0'};
 const installation={enabled:true,measurementSha256:'f'.repeat(64),measurementFile:'/run/meri/general-read-installation.json'};
 for(const r of [{...base,installation:{enabled:false}},{...base,installation},{...base,installation:{...installation,revokedOperations:[op,{id:'search_tracked_bills',version:'0.2.0'}]}},{...base,discovery:{enabled:false}},{...base,installation,discovery:{enabled:false}}])
  assert.doesNotThrow(()=>validateConfiguration(control(r),'control'),JSON.stringify(r));
 assert.doesNotThrow(()=>validateConfiguration(control({...base,installation,discovery:{enabled:true}},{capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}),'control'));
 for(const r of [{...base,discovery:{enabled:true}},{enabled:false,installation:{enabled:false}},{enabled:false,discovery:{enabled:false}},{...base,installation:{enabled:true}},{...base,installation:{enabled:'yes'}},{...base,installation:{}},
  {...base,installation:{...installation,measurementSha256:'F'.repeat(64)}},{...base,installation:{...installation,measurementSha256:'f'.repeat(63)}},{...base,installation:{...installation,measurementFile:'relative.json'}},
  {...base,installation:{...installation,measurementFile:'/run/meri/core-service-secret'}},{...base,installation:{...installation,measurementFile:'/run/meri/core-read-mode-service-secret'}},
  {...base,installation:{enabled:false,measurementSha256:'f'.repeat(64)}},{...base,installation:{enabled:false,measurementFile:'/run/meri/x'}},{...base,installation:{enabled:false,revokedOperations:[op]}},
  {...base,installation:{...installation,revokedOperations:[]}},{...base,installation:{...installation,revokedOperations:[{id:'x'}]}},{...base,installation:{...installation,revokedOperations:[op,op]}},{...base,installation:{...installation,revokedOperations:op}},
  {...base,installation:{...installation,measurement:{}}},{...base,discovery:{}},{...base,discovery:{enabled:'yes'}},{...base,discovery:{enabled:true,capabilityPolicy:{}}}])
  assert.throws(()=>validateConfiguration(control(r),'control'),JSON.stringify(r));
 for(const r of [{...base,discovery:{enabled:'yes'}},{...base,installation:{...installation,revokedOperations:[]}}])
  assert.throws(()=>validateConfiguration(control(r,{capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}),'control'),JSON.stringify(r));
});
