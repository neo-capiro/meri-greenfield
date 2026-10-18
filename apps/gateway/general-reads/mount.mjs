/** The general-read port for the worker's `meri_reads` server, over the SAME canonical durable gateway owner the
 * selected-skill mount uses (`createDurableToolDispatch.executeOwned`). It creates no grant, allocation, budget
 * counter or model loop, and adds no authorization of its own: every call still runs the full current-authority chain.
 *
 * Inputs are the run's existing trusted facts: the installed run allocation (today the frozen private0.2
 * SkillManifest-shaped allocation; a base general-read allocation is PROPOSAL P3), grant facts, producer identity, a
 * general-read installation owner (PROPOSAL P2, `installation.mjs`) and a discovery owner (PROPOSAL P1). An operation is
 * executable only when it is in the allocation, in the current measured installation and resolvable as a read-only
 * catalog descriptor. `sourceEnabled` defaults to false. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {allocation,parseToolGrantFacts} from '../budget/tool-budget-binding.mjs';
import {createDurableToolDispatch} from '../budget/durable-tool-dispatch.mjs';
import {safeFailure,deny,GatewayDenied} from '../dispatch/operation-result.mjs';
import {createInstalledCatalogView} from '../catalog/installed-catalog.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),DELIVERY=/^[-A-Za-z0-9_.:@/]{1,255}$/u;
export function createGeneralReadGatewayMount(configuration){
 const c=own(configuration,['pool','allocationJson','authority','limits','producerContext','producer','credential','installationOwner','discoveryOwner','catalogJson','contracts','now','newId'],['sourceEnabled','memoryContextPorts','mailContextPorts','retainedContextPorts','nativeReadContextPorts','defaultCongress','namespace','stopSignal']);
 if(c.namespace!==undefined&&!['qualification','product'].includes(c.namespace))deny('GATEWAY_CONFIGURATION');
 const a=allocation(c.allocationJson),context=parseToolGrantFacts(JSON.stringify(data(c.producerContext)),a),producer=data(c.producer),limits=data(c.limits);
 const installation=own(c.installationOwner,['readCurrent','handlers']),discovery=own(c.discoveryOwner,['readDiscoveryGrant']);own(producer,['namespace','executionId']);
 if(typeof installation.readCurrent!=='function'||typeof discovery.readDiscoveryGrant!=='function'||typeof c.now!=='function'||typeof c.newId!=='function'||typeof c.credential!=='string'||typeof(c.sourceEnabled??false)!=='boolean'||!Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1)deny('GATEWAY_CONFIGURATION');
 const allocated=operation=>a.manifest.allowedOperations.some(op=>same(op,operation));
 nativeSignal(c.stopSignal);
 // A per-run stop (run-bound read delegation Stop) aborts every in-flight call of the run: dispatch, credential owner and source transport.
 const lifetime=signal=>createOperationLifetime({deadlineMs:c.now()+limits.maxRequestMs,now:c.now,signal:c.stopSignal===undefined?signal:signal===undefined?c.stopSignal:AbortSignal.any([signal,c.stopSignal]),errorFactory:code=>new GatewayDenied(code)});
 // A refused or expired installation means the read is not available; it is never an empty success.
 const current=async life=>{try{const r=await life.run(signal=>installation.readCurrent.call(c.installationOwner,{signal}));if(!same(r.binding,context.binding))throw Error();return r;}catch{if(life.signal.aborted)life.check();deny('UNAVAILABLE');}};
 /** Trusted availability facts for the worker's gates 2 and 4: installed ∩ allocated operations, and the discovery grant. */
 async function readAvailability(value={}){const {signal}=own(value,[],['signal']);nativeSignal(signal);
  if(c.sourceEnabled!==true)deny('UNAVAILABLE');const life=lifetime(signal);
  try{const r=await current(life),grant=data(await life.run(signal=>discovery.readDiscoveryGrant.call(c.discoveryOwner,{binding:context.binding,policyRevision:context.qualificationBinding.policyRevision,signal})));life.check();
   return data({installation:{installationId:r.installationId,baseCatalogSha256:r.baseCatalogSha256,executionCatalogSha256:r.executionCatalogSha256,operations:r.operations.map(row=>row.operation).filter(allocated),checkedAtMs:r.checkedAtMs,expiresAtMs:r.expiresAtMs},discovery:grant});
  }catch(error){throw safeFailure(error);}finally{life.close();}}
 async function execute(value){const {signal,...raw}=own(value,['operation','arguments','deliveryId'],['signal']);nativeSignal(signal);const v=data(raw);
  if(c.sourceEnabled!==true||!allocated(v.operation))deny('UNAVAILABLE');
  if(typeof v.deliveryId!=='string'||!DELIVERY.test(v.deliveryId))deny('INVALID_ARGUMENTS');
  const life=lifetime(signal);
  try{const receipt=await current(life);
   const catalog=createInstalledCatalogView({catalogJson:c.catalogJson,contracts:c.contracts,handlers:installation.handlers,receipt,now:c.now});
   if(catalog.entry(v.operation)===null)deny('UNAVAILABLE');
   const gateway=createDurableToolDispatch({pool:c.pool,allocationJson:c.allocationJson,catalog,authority:c.authority,limits,now:c.now,newId:c.newId,sourceEnabled:true,...(c.namespace?{namespace:c.namespace}:{}),...(c.memoryContextPorts?{memoryContextPorts:c.memoryContextPorts}:{}),...(c.mailContextPorts?{mailContextPorts:c.mailContextPorts}:{}),...(c.retainedContextPorts?{retainedContextPorts:c.retainedContextPorts}:{}),...(c.nativeReadContextPorts?{nativeReadContextPorts:c.nativeReadContextPorts}:{}),...(c.defaultCongress?{defaultCongress:c.defaultCongress}:{})});
   const requestJson=JSON.stringify({operation:v.operation,arguments:v.arguments}),deliveryJson=JSON.stringify({context,producer,deliveryId:v.deliveryId});
   const result=await life.run(signal=>gateway.executeOwned(requestJson,c.credential,deliveryJson,signal));
   // The installation must still be current at release; otherwise the result is withheld.
   const after=await current(life);if(!same({...after,checkedAtMs:0},{...receipt,checkedAtMs:0}))deny('UNAVAILABLE');life.check();return result;
  }catch(error){throw safeFailure(error);}finally{life.close();}}
 return Object.freeze({readAvailability,execute});
}
