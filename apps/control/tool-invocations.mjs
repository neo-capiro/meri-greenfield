/** Trusted control delivery owner. No SDK/model loop, listener or pool ownership. */
import { types } from 'node:util';
import { createDurableSourceDisabledGateway } from '../gateway/index.mjs';

const fail = () => { throw new Error('TOOL_INVOCATION_CONTROL_REQUIRED'); };
function fields(value, names) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value)!==Object.prototype) fail();
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
  if(keys.length!==names.length||keys.some(k=>!names.includes(k))||
      Object.values(descriptors).some(d=>!d.enumerable||!Object.hasOwn(d,'value')))fail();
  return Object.fromEntries(Object.entries(descriptors).map(([k,d])=>[k,d.value]));
}
function json(raw,names) {
  if(typeof raw!=='string'||Buffer.byteLength(raw)>65536)fail();
  let value;try{value=JSON.parse(raw);}catch{fail();}return fields(value,names);
}
/** Internal composition seam; production always constructs the canonical disabled gateway below. */
export function bindToolInvocationControl(options) {
  const {gateway,contextJson,producerJson}=fields(options,['gateway','contextJson','producerJson']);
  if(!gateway||types.isProxy(gateway)||Object.getPrototypeOf(gateway)!==Object.prototype)fail();
  const descriptors=Object.getOwnPropertyDescriptors(gateway),ports={};
  for(const key of ['bindTrustedGrant','executeOwned','reconcileInvocation']){
    const d=descriptors[key];if(!d?.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='function')fail();ports[key]=d.value;
  }
  const context=json(contextJson,['grantId','binding','qualificationBinding','capabilitySha256','allocationSha256']);
  const producer=json(producerJson,['namespace','executionId']);
  // Snapshot prebound identity once. A delivery ID is correlation, never authentication.
  const grantJson=JSON.stringify({...context,invocationId:'binding-admission'});
  const delivery=deliveryId=>{if(typeof deliveryId!=='string'||!/^[A-Za-z0-9_.:@/-]{1,255}$/.test(deliveryId))fail();return JSON.stringify({context,producer,deliveryId});};
  return Object.freeze({
    bindTrustedGrant:()=>ports.bindTrustedGrant.call(gateway,grantJson),
    execute:(requestJson,credential,deliveryId,signal)=>ports.executeOwned.call(gateway,requestJson,credential,delivery(deliveryId),signal),
    reconcile:(requestJson,deliveryId)=>ports.reconcileInvocation.call(gateway,delivery(deliveryId),requestJson),
  });
}
export function createToolInvocationControl(options) {
  const {gatewayOptions,contextJson,producerJson}=fields(options,['gatewayOptions','contextJson','producerJson']);
  return bindToolInvocationControl({gateway:createDurableSourceDisabledGateway(gatewayOptions),contextJson,producerJson});
}
