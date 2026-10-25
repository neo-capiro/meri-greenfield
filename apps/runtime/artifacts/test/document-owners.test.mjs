/** Artifact executor configuration remains a current production boundary. Retired allocation/run-options fixtures were removed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileRuntimeArtifactsConfiguration} from '../configuration.mjs';
const code=c=>e=>e?.code===c;
const ORIGIN='https://core.synthetic.invalid',files={secret:'/run/meri/core-tool-service-secret'};
const nativeCandidate={identity:{origin:ORIGIN,credentialFile:'/run/meri/identity'},taskCapabilityFile:'/run/meri/task',controlCapabilityFile:'/run/meri/control',proxyCredentialFile:'/run/meri/proxy'};
const kmsKeyId='arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001';
const executorBlock={pythonExecutable:'/usr/bin/python3',pptxModulePath:'/opt/meri/node_modules/pptxgenjs',tempRoot:'/tmp'};
const artifacts=(extra={})=>({enabled:true,region:'us-east-1',bucket:'synthetic-artifact-bucket',prefix:'meri-artifacts',expectedBucketOwner:'111122223333',kmsKeyId,authority:{origin:ORIGIN,serviceSecretFile:files.secret},...extra});
const control=(extra={})=>({nativeCandidate,limits:{requestMs:5000,requestBytes:131072},native:{maxResponseBytes:1048576},...extra});
test('configuration: the closed artifacts.executor block names image paths only (absolute POSIX, no traversal, bounded timeout) and composes nothing by itself',()=>{
 const base={...control({artifacts:artifacts({executor:executorBlock})})};
 const a=compileRuntimeArtifactsConfiguration(base);
 assert.deepEqual(a.executor,executorBlock);assert.ok(Object.isFrozen(a.executor));
 assert.deepEqual(compileRuntimeArtifactsConfiguration(control({artifacts:artifacts({executor:{...executorBlock,nodeExecutable:'/usr/local/bin/node',timeoutMs:60000}})})).executor,{...executorBlock,nodeExecutable:'/usr/local/bin/node',timeoutMs:60000});
 for(const [label,executor] of Object.entries({noPython:{pptxModulePath:executorBlock.pptxModulePath,tempRoot:'/tmp'},relative:{...executorBlock,tempRoot:'tmp'},traversal:{...executorBlock,pythonExecutable:'/usr/../bin/python3'},doubleSlash:{...executorBlock,pptxModulePath:'/opt//pptx'},
  timeoutZero:{...executorBlock,timeoutMs:0},timeoutHigh:{...executorBlock,timeoutMs:60001},extra:{...executorBlock,renderer:'/x'},notObject:'/usr/bin/python3'}))
  assert.throws(()=>compileRuntimeArtifactsConfiguration(control({artifacts:artifacts({executor})})),code('ARTIFACT_CONFIGURATION'),label);
 assert.equal(compileRuntimeArtifactsConfiguration(control({artifacts:artifacts()})).executor,undefined);
});
