/** Protected source-only assembly beside the ordinary renderer. No publication, key minting,
 * activation or execution authority. Production references contain only public certs/config and a key hash. */
import {createHash,X509Certificate} from 'node:crypto';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {composeNativeProcessing,parseNativeProcessing} from './native-processing-material.mjs';
import {observerEntrypointConfiguration,OPERATOR_OBSERVER_CONFIGURATION} from '../../../apps/runtime/native-observer-entrypoint.mjs';
import {checkedCertificate,sha256Der} from '../../../apps/worker/conversation/host/control/tls.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const publicKey=c=>sha(c.publicKey.export({format:'der',type:'spki'}));
const fail=()=>{throw Error('OPERATOR_OBSERVER_MATERIAL_REFUSED');};
export function composeOperatorObserverMaterial(raw){
 try{
  const v=own(raw,['feature','material','deployment','pki','nowMs','validUntilMs','cleanupCeilingMs','identity','production']);
  const {feature,material,deployment,pki,nowMs,validUntilMs,cleanupCeilingMs}=v;
  if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(cleanupCeilingMs)||cleanupCeilingMs<=nowMs||
   !Number.isSafeInteger(validUntilMs)||validUntilMs<cleanupCeilingMs)fail();
  const f=parseNativeProcessing(feature);
  if(!f?.enabled||f.deployment!==undefined||f.browserDeployment===undefined)fail();
  // Retain ALL existing fixed-name/port/placement/certificate/material checks.
  const native=composeNativeProcessing({feature,material,deployment,pki,nowMs,validUntilMs});
  const d=f.browserDeployment,s=d.bootstrapSpec.control;
  const identity=own(v.identity,['functionArn','stateMachineArn','secretArn','secretVersionId']);
  if(!d.physicalObserver.bridgeFunctionVersionArn.startsWith(identity.functionArn+':')||
   !f.watchdog.stateMachineVersionArn.startsWith(identity.stateMachineArn+':'))fail();
  const production=own(v.production,['configuration','serverCaCertificate','serverCertificate','issuerCaCertificate','controlClientCertificate','observerKeySha256']);
  const pc=observerEntrypointConfiguration(production.configuration);
  if(pc.schema!=='meri-native-observer-entrypoint/1'||! /^[a-f0-9]{64}$/u.test(production.observerKeySha256)||
   pc.caSha256!==sha(Buffer.from(production.serverCaCertificate)))fail();
  const prior=[production.serverCaCertificate,production.serverCertificate,production.issuerCaCertificate,production.controlClientCertificate].map(x=>new X509Certificate(x));
  const certificates=[s.caCertificate,s.serverCertificate,d.bootstrapSpec.issuerCaCertificate,s.clientCertificate].map(x=>new X509Certificate(x));
  const priorKeys=new Set(prior.map(publicKey));
  for(const c of certificates)if(priorKeys.has(publicKey(c))||c.validFromDate.getTime()>nowMs||c.validToDate.getTime()<=cleanupCeilingMs)fail();
  const [ca,leaf]=certificates;
  if(!ca.ca||leaf.ca||!leaf.checkIssued(ca)||!leaf.verify(ca.publicKey)||
   leaf.keyUsage?.length!==1||leaf.keyUsage[0]!=='1.3.6.1.5.5.7.3.1'||
   f.observerKeyId===pc.keyId||sha(material.observerKey)===production.observerKeySha256||
   identity.functionArn===pc.functionArn||identity.secretArn===pc.secretArn||identity.stateMachineArn===pc.stateMachineArn)fail();
  const serverFingerprintSha256=sha256Der(leaf.raw);
  checkedCertificate(leaf.raw,{name:s.endpoint.serverName,nowMs,pinnedControl:'server',fingerprintSha256:serverFingerprintSha256});
  const configuration=observerEntrypointConfiguration({schema:OPERATOR_OBSERVER_CONFIGURATION,...identity,
   keyId:f.observerKeyId,secretSha256:sha(native.observerMaterial),caSha256:sha(Buffer.from(s.caCertificate)),
   endpoint:{...s.endpoint,serverFingerprintSha256}});
  // Material/edge/secret retention is independent of new-work admission. The published
  // original version and this exact address must remain available through this ceiling.
  return {native,configuration,retainUntilMs:cleanupCeilingMs};
 }catch{fail();}
}
