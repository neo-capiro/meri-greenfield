import test from 'node:test';import assert from 'node:assert/strict';
import {validateConfiguration} from '../config.mjs';
test('control admits a closed reads block: enabled needs an absolute service secret file and never takes a bearer file',async()=>{
 const {candidateFixture}=await import('./prepared-candidate-fixture.mjs'),control=reads=>({...candidateFixture().configuration,reads});
 for(const r of [{enabled:false},{enabled:true,serviceSecretFile:'/run/meri/core-tool-service-secret'},{enabled:true,serviceSecretFile:'/run/meri/a',readModeServiceSecretFile:'/run/meri/b',defaultCongress:119}])
  assert.doesNotThrow(()=>validateConfiguration(control(r),'control'),JSON.stringify(r));
 for(const r of [{},{enabled:'yes'},{enabled:true},{enabled:true,serviceSecretFile:'relative'},{enabled:false,serviceSecretFile:'/run/meri/a'},{enabled:true,serviceSecretFile:'/run/meri/a',nativeReadCredentialFile:'/run/meri/user'},{enabled:true,serviceSecretFile:'/run/meri/a',defaultCongress:0}])
  assert.throws(()=>validateConfiguration(control(r),'control'),JSON.stringify(r));
});
