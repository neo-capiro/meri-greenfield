/** Borrowed ECS SDK client + original trusted supervisor; no client/credentials on import. */
import {DescribeTasksCommand,ListTasksCommand,StopTaskCommand} from '@aws-sdk/client-ecs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {executionFault,assertNativeExecution} from './execution-broker.mjs';
import {compileEcsTaskBinding,assertEcsOwnedTask} from './ecs-task-binding.mjs';
export function createEcsNativeTaskOwner(value){
 const raw=own(value,['client','native','binding']),c=compileEcsTaskBinding(raw.binding),send=storageMethod(raw.client,'send');
 const launchNative=storageMethod(raw.native,'launch'),inspectNative=storageMethod(raw.native,'inspect'),readyNative=storageMethod(raw.native,'readiness'),readRegistration=storageMethod(raw.native.registration,'read');let closed=false;
 function tuple(value){const v=own(value,['binding','executionKey','executionId','planSha256','expiresAtMs','versions'],['plan','signal','taskId']);nativeSignal(v.signal);const {plan,signal,taskId,...original}=v;if(hash(data(original))!==hash(c.original)||taskId!==undefined&&taskId!==c.taskArn)throw executionFault('ECS_REFUSED');return {...original,...(plan===undefined?{}:{plan}),signal};}
 const receipt=stopped=>data({binding:c.original.binding,executionId:c.original.executionId,planSha256:c.original.planSha256,expiresAtMs:c.original.expiresAtMs,versions:c.original.versions,taskId:c.taskArn,state:stopped?'stopped':'executing',physicalStopProven:stopped});
 async function operation(signal,body){if(!c.enabled)throw executionFault('ECS_UNAVAILABLE');const life=createOperationLifetime({now:c.now,signal,deadlineMs:c.now()+c.maxRequestMs,errorFactory:()=>executionFault('ECS_UNKNOWN')});try{return await body(life);}finally{life.close();}}
 const call=(life,command)=>life.run(signal=>send(command,{abortSignal:signal}));
 async function describe(life,arns){const r=await call(life,new DescribeTasksCommand({cluster:c.clusterArn,tasks:arns,include:['TAGS']}));
  if(!Array.isArray(r.tasks)||r.failures?.length||r.tasks.length!==arns.length||new Set(r.tasks.map(t=>t.taskArn)).size!==arns.length||r.tasks.some(t=>!arns.includes(t.taskArn)))throw executionFault('ECS_UNKNOWN');return r.tasks;}
 async function current(life){return assertEcsOwnedTask((await describe(life,[c.taskArn]))[0],c);}
 async function inventory(life,filter){const arns=new Set(),tokens=new Set();let nextToken;for(let page=0;page<c.maxPages;page++){
  const r=await call(life,new ListTasksCommand({cluster:c.clusterArn,...filter,maxResults:100,...(nextToken===undefined?{}:{nextToken})}));
  if(!Array.isArray(r.taskArns)||r.taskArns.some(a=>typeof a!=='string'||!a.startsWith(c.prefix+'task/'+c.cluster+'/'))||r.nextToken!==undefined&&(typeof r.nextToken!=='string'||!r.nextToken||tokens.has(r.nextToken)))throw executionFault('ECS_UNKNOWN');
  for(const arn of r.taskArns){arns.add(arn);if(arns.size>c.maxTasks)throw executionFault('ECS_INVENTORY_BOUND');}if(r.nextToken===undefined)return [...arns];tokens.add(r.nextToken);nextToken=r.nextToken;
 }throw executionFault('ECS_INVENTORY_BOUND');}
 async function discover(life){
  // startedBy cannot be combined with desiredStatus. STOPPED is a separate bounded inventory.
  const arns=new Set([c.taskArn,...await inventory(life,{startedBy:c.original.executionKey}),...await inventory(life,{desiredStatus:'STOPPED'})]);if(arns.size>c.maxTasks)throw executionFault('ECS_INVENTORY_BOUND');
  const tasks=await describe(life,[...arns]);const matching=tasks.filter(t=>t.startedBy===c.original.executionKey);if(matching.length!==1||matching[0].taskArn!==c.taskArn)throw executionFault('ECS_OWNERSHIP_REFUSED');return assertEcsOwnedTask(matching[0],c);
 }
 return Object.freeze({
  async launch(value){const input=tuple(value);if(closed||c.now()>=c.original.expiresAtMs)throw executionFault('ECS_REFUSED');return operation(input.signal,async life=>{if((await discover(life)).stopped)throw executionFault('ECS_REFUSED');const native=assertNativeExecution(await life.run(signal=>{if(closed)throw executionFault('ECS_REFUSED');return launchNative({...input,signal});}),c.original);if(native.physicalStopProven)throw executionFault('ECS_NOT_READY');await current(life);return receipt(false);});},
  async inspect(value){const input=tuple(value);return operation(input.signal,async life=>{const fact=value.taskId===undefined?await discover(life):await current(life);if(fact.stopped)return receipt(true);const native=assertNativeExecution(await life.run(signal=>inspectNative({...input,signal})),c.original);if(native.physicalStopProven)throw executionFault('ECS_NOT_READY');await current(life);return receipt(false);});},
  async retire(value){const input=tuple(value);closed=true;return operation(input.signal,async life=>{let fact=await current(life);if(!fact.stopped){await call(life,new StopTaskCommand({cluster:c.clusterArn,task:c.taskArn,reason:'Meri original execution retirement'}));fact=await current(life);}if(!fact.stopped)throw executionFault('ECS_CLEANUP_UNKNOWN');return receipt(true);});},
  async readiness({signal}={}){if(closed||c.now()>=c.original.expiresAtMs)throw executionFault('ECS_REFUSED');return operation(signal,async life=>{if((await current(life)).stopped)throw executionFault('ECS_REFUSED');await life.run(signal=>readyNative({signal}));});},
  registration:Object.freeze({async read(value){const v=own(value,['binding','key'],['signal','deadlineMs']);if(closed||hash(v.binding)!==hash(c.original.binding))throw executionFault('ECS_REFUSED');return operation(v.signal,async life=>{if((await current(life)).stopped)throw executionFault('ECS_REFUSED');return life.run(signal=>readRegistration({...v,signal}));});}}),
  async close(){closed=true;return this.retire(c.original);}
 });
}
