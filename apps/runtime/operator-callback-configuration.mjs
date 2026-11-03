/** Protected deployment material only. This is transport configuration, never browser admission. */
import {createHash,X509Certificate} from 'node:crypto';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {operatorObserverEndpoint} from './native-observer-transport.mjs';
import {NATIVE_OBSERVER_ORIGIN} from './native-observer-http.mjs';
export const OPERATOR_CALLBACK_CONFIGURATION='meri-operator-callback-transport/1';
const fail=()=>{throw Error('OPERATOR_CALLBACK_CONFIGURATION_REFUSED');};
const digest=x=>createHash('sha256').update(x).digest('hex');
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
