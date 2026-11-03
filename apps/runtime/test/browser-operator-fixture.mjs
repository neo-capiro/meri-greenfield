/** Real material assembly with throwaway PKI; synthetic canonical owner rows only in tests. No provider/DB/cloud effects. */
import {createHash} from 'node:crypto';
import {createRenderFixture} from '../../../infra/product-preview/first-chat/render-material.fixture.mjs';
import {nativeProcessingInputs} from '../../../infra/product-preview/first-chat/native-processing-material.fixture.mjs';
import {composeOperatorObserverMaterial} from '../../../infra/product-preview/first-chat/operator-observer-material.mjs';
import {observerTransportPki} from './native-observer-transport.fixture.mjs';
import {createOperatorBrowserAdmission,bindOperatorBrowserInvocation} from '../browser-operator-admission.mjs';
import {nativeHostId} from '../native-host-provisioning.mjs';
import {createManagedWatchdogReadback} from '../native-watchdog-readback.mjs';
import {assertNativeDeclaration} from '../../control/browser-hosts/native-reservations.mjs';
import {allocationRow} from '../../control/browser-hosts/allocation.mjs';
import {hostClientDnsName} from '../../worker/conversation/host/control/protocol.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
const fixture=createRenderFixture(),sha=x=>createHash('sha256').update(x).digest('hex');
// Generate before tests capture a synthetic clock: freshly issued client certificates
// must not appear to come from the future while the first PKI fixture is being made.
const sample=await nativeProcessingInputs(fixture),foreign=observerTransportPki();
export const cleanupOperatorFixture=()=>fixture.cleanup();
export async function operatorCaseFixture({binding,prompt='Synthetic ordinary request',now=Date.now,expiresAtMs=now()+60000,cleanupCeilingMs=now()+3600000}={}){
 const i={...sample,deployment:structuredClone(sample.deployment)};
 const feature=i.deployment.features.nativeProcessing;delete feature.deployment;
 const account='967807252336',configuration={schema:'meri-native-observer-entrypoint/1',
  functionArn:`arn:aws:lambda:us-east-1:${account}:function:production-observer`,stateMachineArn:`arn:aws:states:us-east-1:${account}:stateMachine:production-native`,keyId:'production-key',
  secretArn:`arn:aws:secretsmanager:us-east-1:${account}:secret:production-observer-Abc123`,secretVersionId:'b'.repeat(32),secretSha256:'c'.repeat(64),caSha256:sha(foreign.otherCa)};
 const material=composeOperatorObserverMaterial({feature,material:i.nativeMaterial,deployment:i.deployment,pki:i.private,nowMs:now(),validUntilMs:now()+7200000,cleanupCeilingMs,
  identity:{functionArn:`arn:aws:lambda:us-east-1:${account}:function:synthetic-observer`,stateMachineArn:`arn:aws:states:us-east-1:${account}:stateMachine:synthetic-native`,
   secretArn:`arn:aws:secretsmanager:us-east-1:${account}:secret:synthetic-observer-Abc123`,secretVersionId:'a'.repeat(32)},
  production:{configuration,serverCaCertificate:foreign.otherCa,serverCertificate:foreign.otherCa,issuerCaCertificate:foreign.otherCa,controlClientCertificate:foreign.otherCa,observerKeySha256:sha(Buffer.alloc(32,8))}});
 const selection={...Object.fromEntries(['tenantId','actorId','conversationId'].map(k=>[k,binding[k]])),promptSha256:hash(prompt)};
 const sourceCommit=feature.browserDeployment.sourceCommit;
 const capability=createOperatorBrowserAdmission({selection,material,sourceCommit,expiresAtMs,now});
 return {capability,material,sourceCommit,selection,expiresAtMs,
  bind:(run={binding,state:'queued'})=>bindOperatorBrowserInvocation(capability,{binding,run,request:{prompt},expiresAtMs:now()+900000})};
}
export async function operatorAllocationFixture({binding,material,nowMs}){
 const d=material.native.worker.browserDeployment,hostId=nativeHostId({binding,generation:binding.writerFence,hostMode:'browser-only'}),lease=nowMs+60000;
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,generation:binding.writerFence,hostId,
  hostMode:'browser-only',imageDigest:d.imageDigest,leaseDeadlineMs:lease};
 const owner=createManagedWatchdogReadback({...material.native.worker.watchdog,now:()=>nowMs});
 const watchdog=await owner.makeIntent({hostId,generation:binding.writerFence,t0Ms:nowMs,deadlineMs:lease,leaseDeadlineMs:lease,cleanupCeilingMs:lease+25000,
  allocationSha256:hash(allocation),sourceCommit:d.sourceCommit,imageDigest:d.imageDigest,bootstrapSha256:d.bootstrapSha256,placementSha256:hash(d.placement),launchSha256:hash(d.launch),
  controlPolicySha256:d.bootstrapSpec.control.policySha256,provisionToken:'f'.repeat(64),physicalObserver:d.physicalObserver,placement:d.placement,launch:d.launch});
 const declaration=assertNativeDeclaration({...d,schema:'meri-native-provisioning-declaration/2',token:'f'.repeat(64),tags:{MeriProvisionToken:'f'.repeat(64)},leaseDeadlineMs:lease,watchdog});
 const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef0',bootId:binding.attemptId,conversationId:binding.conversationId,hostId};
 const endpoint={address:'10.0.0.5',...d.bootstrapSpec.hostEndpoint,serverFingerprintSha256:'b'.repeat(64)},dns=hostClientDnsName(allocation);
 const record={allocation,originalBinding:binding,hostIdentity,ownerInstanceId:binding.workerId,endpoint,
  hostCertificate:{fingerprintSha256:'a'.repeat(64),dnsName:dns,notAfterMs:lease},serverCertificateNotAfterMs:lease};
 const row={host_id:hostId,generation:binding.writerFence,tenant_id:binding.tenantId,conversation_id:binding.conversationId,lease_deadline_ms:lease,
  allocation_json:allocation,allocation_sha256:hash(allocation),original_binding_json:binding,owner_instance_id:binding.workerId,declaration_json:declaration,declaration_sha256:hash(declaration),
  state:'active',credential_revision:1,host_identity_json:hostIdentity,host_identity_sha256:hash(hostIdentity),endpoint_json:endpoint,
  client_cert_sha256:'a'.repeat(64),client_dns_name:dns,client_cert_not_after_ms:lease,server_cert_not_after_ms:lease,record_sha256:hash(record)};
 allocationRow(row);return {allocation,row,record};
}
