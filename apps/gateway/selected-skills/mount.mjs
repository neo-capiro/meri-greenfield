/** The original SDK read port over the SAME canonical durable gateway owner. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';
import {assertSkillInstallation} from '../../../packages/contracts/selected-skills/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {allocation,parseToolGrantFacts} from '../budget/tool-budget-binding.mjs';
import {createDurableToolDispatch} from '../budget/durable-tool-dispatch.mjs';
import {createPostgresToolBudget} from '../budget/postgres-tool-budget.mjs';
import {safeFailure,deny} from '../dispatch/operation-result.mjs';
import {createInstalledRuntimeCatalog} from '../catalog/installed-catalog.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),fault=code=>Object.assign(Error(code),{code});
function configured(configuration){
 const c=own(configuration,['pool','allocationJson','authority','limits','producerContext','producer','credential','installationOwner','input','catalogJson','contracts','now','newId'],['sourceEnabled','memoryContextPorts','mailContextPorts','defaultCongress','namespace']);
 if(c.namespace!==undefined&&!['qualification','product'].includes(c.namespace))throw fault('SKILL_GATEWAY_CONFIGURATION');
 const input=data(c.input),selected=selectSkill(input.skill.skillId,input.skill.skillVersion),a=allocation(c.allocationJson),context=parseToolGrantFacts(JSON.stringify(data(c.producerContext)),a),producer=data(c.producer),owner=own(c.installationOwner,['readForSkill','handlers']);
 own(producer,['namespace','executionId']);if(!same(input.binding,context.binding)||!same(input.skill,selected.pin)||!same(a.manifest,selected.manifest)||a.catalogSha256!==selected.pin.catalogSha256||typeof owner.readForSkill!=='function'||types.isProxy(owner.handlers)||!(owner.handlers instanceof Map)||Object.getPrototypeOf(owner.handlers)!==Map.prototype||typeof c.now!=='function'||typeof c.newId!=='function'||typeof c.credential!=='string'||typeof(c.sourceEnabled??false)!=='boolean')throw fault('SKILL_GATEWAY_CONFIGURATION');
 const limits=data(c.limits);return {c,input,selected,context,producer,owner,limits};
}
export function createSelectedSkillGatewayMount(configuration){
 const {c,input,selected,context,producer,owner,limits}=configured(configuration);
 const readForSkill=value=>owner.readForSkill.call(c.installationOwner,value);
 async function execute(value){const {signal,...raw}=own(value,['operation','arguments','deliveryId'],['signal']);nativeSignal(signal);const v=data(raw);
  if(c.sourceEnabled!==true||!selected.manifest.allowedOperations.some(op=>same(op,v.operation)))deny('UNAVAILABLE');
  if(typeof v.deliveryId!=='string'||!/^[-A-Za-z0-9_.:@/]{1,255}$/u.test(v.deliveryId))throw fault('SKILL_DELIVERY_REFUSED');
  const life=createOperationLifetime({deadlineMs:c.now()+limits.maxRequestMs,now:c.now,signal,errorFactory:fault});
  try{let started=c.now();const installation=assertSkillInstallation(await life.run(signal=>readForSkill({...input,signal})),{input,selected,started,now:c.now,life});
   const catalog=createInstalledRuntimeCatalog({catalogJson:c.catalogJson,contracts:c.contracts,handlers:owner.handlers,installation,input,selected,now:c.now,life,started});
   if(catalog.entry(v.operation)===null)deny('UNAVAILABLE');
   const gateway=createDurableToolDispatch({pool:c.pool,allocationJson:c.allocationJson,catalog,authority:c.authority,limits,now:c.now,newId:c.newId,sourceEnabled:true,...(c.namespace?{namespace:c.namespace}:{}),...(c.memoryContextPorts?{memoryContextPorts:c.memoryContextPorts}:{}),...(c.mailContextPorts?{mailContextPorts:c.mailContextPorts}:{}),...(c.defaultCongress?{defaultCongress:c.defaultCongress}:{})});
   const requestJson=JSON.stringify({operation:v.operation,arguments:v.arguments}),deliveryJson=JSON.stringify({context,producer,deliveryId:v.deliveryId});
   const result=await life.run(signal=>gateway.executeOwned(requestJson,c.credential,deliveryJson,signal));
   started=c.now();assertSkillInstallation(await life.run(signal=>readForSkill({...input,signal})),{input,selected,started,now:c.now,life,previous:installation});life.check();return result;
  }catch(error){throw safeFailure(error);}finally{life.close();}}
 return Object.freeze({execute,readForSkill});
}
/** Trusted companion read-only port. The original gateway shape remains unchanged. */
export function createSelectedSkillGatewayCompletionReader(configuration){
 const {c,selected,context,producer}=configured(configuration);
 const budget=createPostgresToolBudget({pool:c.pool,allocationJson:c.allocationJson,now:c.now,...(c.namespace?{namespace:c.namespace}:{})});
 return async value=>{const {signal,...raw}=own(value,['operation','arguments','deliveryId'],['signal']);nativeSignal(signal);const v=data(raw);
  if(c.sourceEnabled!==true||!selected.manifest.allowedOperations.some(op=>same(op,v.operation))||typeof budget.readCompletion!=='function')deny('UNAVAILABLE');
  if(typeof v.deliveryId!=='string'||!/^[-A-Za-z0-9_.:@/]{1,255}$/u.test(v.deliveryId))throw fault('SKILL_DELIVERY_REFUSED');
  return budget.readCompletion(JSON.stringify({context,producer,deliveryId:v.deliveryId}),JSON.stringify({operation:v.operation,arguments:v.arguments}),{signal});
 };
}
