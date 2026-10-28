/** Startup wiring with only the external renderer transport mocked; no cloud, secret, model or native operation. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {createRendererPort} from '../../../artifacts/renderer.mjs';import {syntheticAdmission} from '../../../artifacts/test/pdf-fixtures.mjs';
const calls=[],available=createRendererPort({admission:syntheticAdmission(),transformer:{transform:()=>assert.fail('startup never converts')}});let selected=available;
mock.module('../renderer-client.mjs',{namedExports:{async createAgentCoreRenderer(input){calls.push(input);return selected;}}});
const {composeDocumentsFamily}=await import('../authority-composition.mjs');
const imageDigest='sha256:'+'a'.repeat(64),now=Date.now,nativeCredentials={nativeCredentialFor:()=>assert.fail('no native credential read during startup')};
const config=()=>({limits:{requestMs:30000,requestBytes:131072},native:{maxResponseBytes:8388608},retention:{enabled:true},
 agentcore:{runtimeArn:'arn:aws:bedrock-agentcore:us-east-1:111122223333:runtime/meri_synthetic',qualifier:'preview',maxOutputBytes:8388608},
 artifacts:{enabled:true,region:'us-east-1',bucket:'synthetic-artifact-bucket',prefix:'artifacts',expectedBucketOwner:'111122223333',kmsKeyId:'arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001',
  authority:{origin:'https://core.synthetic.invalid',serviceSecretFile:'/run/meri/core-secret'},executor:{pythonExecutable:'/usr/bin/python3.13',nodeExecutable:'/usr/local/bin/node',pptxModulePath:'/opt/meri/pptxgenjs',tempRoot:'/tmp'},renderer:{enabled:true,imageDigest},pdfAdmission:true}});
const options=configuration=>({configuration,now,nativeCredentials,readSecret:async()=>Buffer.from('synthetic-service-secret'),fetchImpl:()=>assert.fail('no Core request at startup')});
test('actual startup invokes the trusted renderer bridge with configured endpoint and exact selected image',async()=>{
 calls.length=0;const configuration=config(),out=await composeDocumentsFamily(options(configuration));assert.deepEqual(out.missing,[]);assert.equal(typeof out.family,'function');
 assert.deepEqual(calls,[{region:'us-east-1',agentRuntimeArn:configuration.agentcore.runtimeArn,qualifier:'preview',imageDigest,now}]);
 selected=createRendererPort({admission:null});try{assert.deepEqual((await composeDocumentsFamily(options(config()))).missing,[],'unqualified native renderer does not disable unrelated document reads');}finally{selected=available;}
});
test('missing trusted inputs refuse before remote qualification, and an unselected renderer performs no probe',async()=>{
 calls.length=0;const noRuntime=config();delete noRuntime.agentcore;assert.deepEqual((await composeDocumentsFamily(options(noRuntime))).missing,['artifacts.renderer.agentcore']);
 const missingSecret=await composeDocumentsFamily({...options(config()),readSecret:async()=>{throw Error('synthetic absent secret');}});assert.deepEqual(missingSecret.missing,['artifacts.authority.serviceSecretFile']);
 const disabled=config();disabled.artifacts.renderer.enabled=false;await composeDocumentsFamily(options(disabled));assert.equal(calls.length,0);
});
