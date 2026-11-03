/** Protected deployment material only. This is transport configuration, never browser admission. */
import {createHash,X509Certificate} from 'node:crypto';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {operatorObserverEndpoint} from './native-observer-transport.mjs';
import {NATIVE_OBSERVER_ORIGIN} from './native-observer-http.mjs';
import {checkedCertificate} from '../worker/conversation/host/control/tls.mjs';
export const OPERATOR_CALLBACK_CONFIGURATION='meri-operator-callback-transport/1';
const fail=()=>{throw Error('OPERATOR_CALLBACK_CONFIGURATION_REFUSED');};
const digest=x=>createHash('sha256').update(x).digest('hex');
/** Protected source material: private callback TLS443 -> Control HTTP8082.
 * The native bootstrap's separate TCP443 -> mTLS8443 destination is unchanged. */
export function operatorCallbackTarget(raw,{hostEndpoint,retainUntilMs,nowMs=Date.now()}){
 try{
  const v=own(data(raw),['endpoint','caCertificate','serverCertificate']),endpoint=operatorObserverEndpoint(v.endpoint);
  const ca=new X509Certificate(v.caCertificate),leaf=new X509Certificate(v.serverCertificate);
  const pem=/^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END CERTIFICATE-----\r?\n?$/u;
  if(![v.caCertificate,v.serverCertificate].every(x=>typeof x==='string'&&x.length<=8192&&pem.test(x))||
   endpoint.address===hostEndpoint.address||!ca.ca||leaf.ca||!leaf.checkIssued(ca)||!leaf.verify(ca.publicKey)||
   leaf.keyUsage?.length!==1||leaf.keyUsage[0]!=='1.3.6.1.5.5.7.3.1'||
   !Number.isSafeInteger(nowMs)||!Number.isSafeInteger(retainUntilMs)||retainUntilMs<=nowMs||
   ca.validFromDate.getTime()>nowMs||ca.validToDate.getTime()<=retainUntilMs)fail();
  const checked=checkedCertificate(leaf.raw,{name:endpoint.serverName,nowMs,pinnedControl:'server',fingerprintSha256:endpoint.serverFingerprintSha256});
  if(checked.notAfterMs<=retainUntilMs)fail();
  return Object.freeze({...v,endpoint});
 }catch{fail();}
}
export function operatorCallbackConfiguration(raw){
 try{
  const v=own(data(raw),['schema','origin','endpoint','caCertificate','retainUntilMs','controlCapabilitySha256','nativeProvisioningSha256']);
  const endpoint=operatorObserverEndpoint(v.endpoint),ca=new X509Certificate(v.caCertificate),now=Date.now();
  if(v.schema!==OPERATOR_CALLBACK_CONFIGURATION||v.origin!==NATIVE_OBSERVER_ORIGIN||
   typeof v.caCertificate!=='string'||v.caCertificate.length>16384||!/^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END CERTIFICATE-----\r?\n?$/u.test(v.caCertificate)||!ca.ca||ca.validFromDate.getTime()>now||
   !Number.isSafeInteger(v.retainUntilMs)||v.retainUntilMs<=now||ca.validToDate.getTime()<=v.retainUntilMs||
   !/^[a-f0-9]{64}$/u.test(v.controlCapabilitySha256)||!/^[a-f0-9]{64}$/u.test(v.nativeProvisioningSha256))fail();
  return Object.freeze({...v,endpoint});
 }catch{fail();}
}
export function assertOperatorCallbackWorker(raw,configuration){
 const v=operatorCallbackConfiguration(raw);
 if(configuration.native?.origin!==v.origin||configuration.native?.loopback!==false||configuration.native?.preparedKickoff!==true||
  canonicalSha256(configuration.nativeProvisioning??null)!==v.nativeProvisioningSha256)fail();
 return v;
}
export function assertOperatorCallbackCredential(configuration,credential){
 if(typeof credential!=='string'||!/^\S{32,8192}$/u.test(credential)||digest(credential)!==configuration.controlCapabilitySha256)fail();
}
