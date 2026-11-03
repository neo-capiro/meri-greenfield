/** Derive protected callback transport from the already validated case observer/bootstrap.
 * No publication, credential generation or browser admission. */
import {createHash} from 'node:crypto';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {compileNativeDeployment} from '../../../apps/runtime/native-deployment-configuration.mjs';
import {observerEntrypointConfiguration,OPERATOR_OBSERVER_CONFIGURATION} from '../../../apps/runtime/native-observer-entrypoint.mjs';
import {OPERATOR_CALLBACK_CONFIGURATION,operatorCallbackConfiguration,operatorCallbackTarget} from '../../../apps/runtime/operator-callback-configuration.mjs';
import {NATIVE_OBSERVER_ORIGIN} from '../../../apps/runtime/native-observer-http.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex'),fail=()=>{throw Error('OPERATOR_CALLBACK_MATERIAL_REFUSED');};
export function composeOperatorCallbackMaterial(raw){
 try{
  const {material,controlCapability,productionControlCapabilitySha256}=own(raw,['material','controlCapability','productionControlCapabilitySha256']);
  if(!Buffer.isBuffer(controlCapability)||!/^\S{32,8192}$/u.test(controlCapability.toString('utf8').trim())||
   !/^[a-f0-9]{64}$/u.test(productionControlCapabilitySha256)||material.native?.worker?.enabled!==true||material.native.worker.deployment!==undefined)fail();
  const controlCapabilitySha256=digest(controlCapability.toString('utf8').trim());
  if(controlCapabilitySha256===productionControlCapabilitySha256)fail();
  const d=compileNativeDeployment(material.native.worker.browserDeployment),s=d.bootstrapSpec.control;
  const observer=observerEntrypointConfiguration(material.configuration);
  const {endpoint,caCertificate}=operatorCallbackTarget(material.callback,{hostEndpoint:s.endpoint,retainUntilMs:material.retainUntilMs});
  if(observer.schema!==OPERATOR_OBSERVER_CONFIGURATION||hash(endpoint)!==hash(observer.endpoint)||observer.caSha256!==digest(caCertificate)||
   observer.keyId!==material.native.control?.host?.observer?.keyId)fail();
  return operatorCallbackConfiguration({schema:OPERATOR_CALLBACK_CONFIGURATION,origin:NATIVE_OBSERVER_ORIGIN,endpoint,
   caCertificate,retainUntilMs:material.retainUntilMs,controlCapabilitySha256,nativeProvisioningSha256:hash(material.native.worker)});
 }catch{fail();}
}
