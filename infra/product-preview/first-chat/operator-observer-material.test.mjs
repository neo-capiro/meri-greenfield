import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,X509Certificate} from 'node:crypto';
import {createRenderFixture} from './render-material.fixture.mjs';
import {nativeProcessingInputs} from './native-processing-material.fixture.mjs';
import {composeOperatorObserverMaterial} from './operator-observer-material.mjs';
import {OPERATOR_OBSERVER_CONFIGURATION} from '../../../apps/runtime/native-observer-entrypoint.mjs';
import {observerTransportPki} from '../../../apps/runtime/test/native-observer-transport.fixture.mjs';
import {compileNativeObserverTemplate} from '../../browser-enforcement/native-template.mjs';
const fixture=createRenderFixture();after(()=>fixture.cleanup());
const pki=observerTransportPki(),sha=b=>createHash('sha256').update(b).digest('hex');
async function inputs(){
 const i=await nativeProcessingInputs(fixture),feature=i.deployment.features.nativeProcessing;delete feature.deployment;
 const nowMs=Date.now(),account='967807252336',configuration={schema:'meri-native-observer-entrypoint/1',
  functionArn:`arn:aws:lambda:us-east-1:${account}:function:production-observer`,stateMachineArn:`arn:aws:states:us-east-1:${account}:stateMachine:production-native`,
  keyId:'production-key',secretArn:`arn:aws:secretsmanager:us-east-1:${account}:secret:production-observer-Abc123`,secretVersionId:'b'.repeat(32),secretSha256:'c'.repeat(64),caSha256:sha(pki.otherCa)};
 return {feature,material:i.nativeMaterial,deployment:i.deployment,pki:i.private,nowMs,validUntilMs:nowMs+7200000,cleanupCeilingMs:nowMs+3600000,
  identity:{functionArn:`arn:aws:lambda:us-east-1:${account}:function:synthetic-observer`,stateMachineArn:`arn:aws:states:us-east-1:${account}:stateMachine:synthetic-native`,
   secretArn:`arn:aws:secretsmanager:us-east-1:${account}:secret:synthetic-observer-Abc123`,secretVersionId:'a'.repeat(32)},
  production:{configuration,serverCaCertificate:pki.otherCa,serverCertificate:pki.otherCa,issuerCaCertificate:pki.otherCa,controlClientCertificate:pki.otherCa,observerKeySha256:sha(Buffer.alloc(32,8))}};
}
test('case config derives equal bootstrap endpoint/leaf/CA/secret pins and is retained in the numeric-version template',async()=>{
 const v=await inputs(),r=composeOperatorObserverMaterial(v),s=v.feature.browserDeployment.bootstrapSpec.control,c=r.configuration;
 assert.equal(c.schema,OPERATOR_OBSERVER_CONFIGURATION);assert.deepEqual(c.endpoint,{...s.endpoint,serverFingerprintSha256:sha(new X509Certificate(s.serverCertificate).raw)});
 assert.equal(c.secretSha256,sha(r.native.observerMaterial));assert.equal(c.caSha256,sha(s.caCertificate));assert.equal(r.retainUntilMs,v.cleanupCeilingMs);
 assert.equal(r.native.control.host.observer.keyId,c.keyId);assert.equal(JSON.parse(r.native.observerMaterial).keyId,c.keyId);
 const t=compileNativeObserverTemplate({enabled:true,configuration:c,code:{bucket:'synthetic-native-code',key:'observer.zip',versionId:'synthetic-version',sha256:'d'.repeat(64)},
  network:{privateSubnetIds:['subnet-0123456789abcdef0'],securityGroupIds:['sg-0123456789abcdef0']},
  kmsKeyArn:'arn:aws:kms:us-east-1:967807252336:key/00000000-0000-4000-8000-000000000001',logGroupName:'/synthetic/native-observer'});
 assert.deepEqual(JSON.parse(t.Resources.NativeObserver.Properties.Environment.Variables.MERI_NATIVE_OBSERVER_CONFIG),c);
 assert.equal(t.Resources.NativeObserverVersion.DeletionPolicy,'Retain');assert.equal(t.Resources.NativeObserverVersion.UpdateReplacePolicy,'Retain');
 assert.ok(!JSON.stringify(t).includes(JSON.parse(r.native.observerMaterial).keyBase64));
});
test('mixed production identities, material, endpoint/name and insufficient cleanup lifetime refuse',async()=>{
 for(const mutate of [
  v=>v.production.serverCertificate=v.feature.browserDeployment.bootstrapSpec.control.serverCertificate,
  v=>v.production.issuerCaCertificate=v.feature.browserDeployment.bootstrapSpec.issuerCaCertificate,
  v=>v.production.controlClientCertificate=v.feature.browserDeployment.bootstrapSpec.control.clientCertificate,
  v=>v.production.observerKeySha256=sha(v.material.observerKey),v=>v.production.configuration.keyId=v.feature.observerKeyId,
  v=>v.production.configuration.functionArn=v.identity.functionArn,v=>v.production.configuration.secretArn=v.identity.secretArn,
  v=>v.production.configuration.stateMachineArn=v.identity.stateMachineArn,
  v=>v.feature.browserDeployment.bootstrapSpec.control.endpoint.address='8.8.8.8',
  v=>v.feature.browserDeployment.bootstrapSpec.control.endpoint.serverName='other.example',
  v=>v.feature.browserDeployment.bootstrapSpec.control.serverCertificate=pki.good.cert,
  v=>v.validUntilMs=v.cleanupCeilingMs-1,v=>{v.cleanupCeilingMs=v.nowMs+40*86400000;v.validUntilMs=v.cleanupCeilingMs;},
  v=>v.identity.functionArn+='-foreign',v=>v.identity.extra=true
 ]){
  const v=await inputs();mutate(v);assert.throws(()=>composeOperatorObserverMaterial(v),/OPERATOR_OBSERVER_MATERIAL_REFUSED/);
 }
});
