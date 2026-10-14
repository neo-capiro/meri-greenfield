/** Borrowed ECS SDK client + original trusted supervisor; no client/credentials on import. */
import {DescribeTasksCommand,ListTasksCommand,StopTaskCommand} from '@aws-sdk/client-ecs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {executionFault,assertNativeExecution} from './execution-broker.mjs';
import {compileEcsTaskBinding,assertEcsOwnedTask,assertEcsRunningTask} from './ecs-task-binding.mjs';
import {copySessionJson} from '../../worker/qualification/checkpoint/session-store-data.mjs';
export function createEcsNativeTaskOwner(value){
 const raw=own(value,['client','native','binding']),c=compileEcsTaskBinding(raw.binding),send=storageMethod(raw.client,'send');
 const nativePort=own(raw.native,['launch','inspect','readiness','registration'],['retire','close','status','spawnClaudeCodeProcess','startPreparedProcess','workspace']);
 const launchNative=storageMethod(raw.native,'launch'),inspectNative=storageMethod(raw.native,'inspect'),readyNative=storageMethod(raw.native,'readiness'),readRegistration=storageMethod(nativePort.registration,'read');let closed=false;
 function tuple(value){const v=own(value,['binding','executionKey','executionId','planSha256','expiresAtMs','versions'],['plan','signal','taskId']);nativeSignal(v.signal);const {plan,signal,taskId,...original}=v;if(hash(data(original))!==hash(c.original)||taskId!==undefined&&taskId!==c.taskArn)throw executionFault('ECS_REFUSED');return {...original,...(plan===undefined?{}:{plan}),signal};}
 const receipt=stopped=>data({binding:c.original.binding,executionId:c.original.executionId,planSha256:c.original.planSha256,expiresAtMs:c.original.expiresAtMs,versions:c.original.versions,taskId:c.taskArn,state:stopped?'stopped':'executing',physicalStopProven:stopped});
 async function operation(signal,body){if(!c.enabled)throw executionFault('ECS_UNAVAILABLE');const life=createOperationLifetime({now:c.now,signal,deadlineMs:c.now()+c.maxRequestMs,errorFactory:()=>executionFault('ECS_UNKNOWN')});try{return await body(life);}finally{life.close();}}
 const call=(life,command)=>life.run(signal=>send(command,{abortSignal:signal}));
 async function describe(life,arns){const r=await call(life,new DescribeTasksCommand({cluster:c.clusterArn,tasks:arns,include:['TAGS']}));
  if(!Array.isArray(r.tasks)||r.failures?.length||r.tasks.length!==arns.length||new Set(r.tasks.map(t=>t.taskArn)).size!==arns.length||r.tasks.some(t=>!arns.includes(t.taskArn)))throw executionFault('ECS_UNKNOWN');return r.tasks;}
 async function current(life,qualified=false){const task=(await describe(life,[c.taskArn]))[0],fact=assertEcsOwnedTask(task,c);if(qualified&&!fact.stopped)assertEcsRunningTask(task,c);return fact;}
 const workspacePort=nativePort.workspace===undefined?undefined:own(nativePort.workspace,['restore','verify']);
 const workspaceMethods=workspacePort===undefined?undefined:{restore:storageMethod(workspacePort,'restore'),verify:storageMethod(workspacePort,'verify')};
 function workspaceCurrent(){if(closed||c.now()>=c.original.expiresAtMs)throw executionFault('ECS_REFUSED');}
 async function workspaceCall(method,value){
  const raw=own(value,['binding','restoreKey','workspaceSha256','manifest',...(method==='restore'?['files']:[])],['signal']);nativeSignal(raw.signal);
  const {signal,...payload}=raw,v=copySessionJson(payload,method==='restore'?48*1024*1024:2*1024*1024);workspaceCurrent();
  if(hash(v.binding)!==hash(c.original.binding)||!/^[a-f0-9]{64}$/u.test(v.restoreKey)||!/^[a-f0-9]{64}$/u.test(v.workspaceSha256)||hash(v.manifest)!==v.workspaceSha256)throw executionFault('ECS_REFUSED');
  return operation(signal,async life=>{
   if((await current(life,true)).stopped)throw executionFault('ECS_REFUSED');workspaceCurrent();let observation;
   try{observation=await life.run(signal=>workspaceMethods[method]({...v,signal}));}
   finally{workspaceCurrent();if((await current(life,true)).stopped)throw executionFault('ECS_REFUSED');workspaceCurrent();}
   const r=data(own(observation,['binding','restoreKey','workspaceSha256','checkedAtMs','expiresAtMs']));
   if(hash(r.binding)!==hash(c.original.binding)||r.restoreKey!==v.restoreKey||r.workspaceSha256!==v.workspaceSha256||r.expiresAtMs!==c.original.expiresAtMs||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs>c.now()||r.checkedAtMs>=r.expiresAtMs||c.now()-r.checkedAtMs>c.maxRequestMs)throw executionFault('ECS_REFUSED');return r;
  });
 }
 const workspace=workspacePort===undefined?undefined:Object.freeze({restore:value=>workspaceCall('restore',value),verify:value=>workspaceCall('verify',value)});
 async function inventory(life,filter){const arns=new Set(),tokens=new Set();let nextToken;for(let page=0;page<c.maxPages;page++){
  const r=await call(life,new ListTasksCommand({cluster:c.clusterArn,...filter,maxResults:100,...(nextToken===undefined?{}:{nextToken})}));
  if(!Array.isArray(r.taskArns)||r.taskArns.some(a=>typeof a!=='string'||!a.startsWith(c.prefix+'task/'+c.cluster+'/'))||r.nextToken!==undefined&&(typeof r.nextToken!=='string'||!r.nextToken||tokens.has(r.nextToken)))throw executionFault('ECS_UNKNOWN');
  for(const arn of r.taskArns){arns.add(arn);if(arns.size>c.maxTasks)throw executionFault('ECS_INVENTORY_BOUND');}if(r.nextToken===undefined)return [...arns];tokens.add(r.nextToken);nextToken=r.nextToken;
 }throw executionFault('ECS_INVENTORY_BOUND');}
 async function discover(life){
  // startedBy cannot be combined with desiredStatus. STOPPED is a separate bounded inventory.
  const arns=new Set([c.taskArn,...await inventory(life,{startedBy:c.original.executionKey}),...await inventory(life,{desiredStatus:'STOPPED'})]);if(arns.size>c.maxTasks)throw executionFault('ECS_INVENTORY_BOUND');
  const tasks=await describe(life,[...arns]);const matching=tasks.filter(t=>t.startedBy===c.original.executionKey);if(matching.length!==1||matching[0].taskArn!==c.taskArn)throw executionFault('ECS_OWNERSHIP_REFUSED');const fact=assertEcsOwnedTask(matching[0],c);if(!fact.stopped)assertEcsRunningTask(matching[0],c);return fact;
 }
 async function retireOriginal(life){closed=true;let fact=await current(life);if(!fact.stopped){await call(life,new StopTaskCommand({cluster:c.clusterArn,task:c.taskArn,reason:'Meri original execution retirement'}));fact=await current(life);}if(!fact.stopped)throw executionFault('ECS_CLEANUP_UNKNOWN');return receipt(true);}
 return Object.freeze({
  ...(workspace===undefined?{}:{workspace}),
  async launch(value){const input=tuple(value);if(closed||c.now()>=c.original.expiresAtMs)throw executionFault('ECS_REFUSED');return operation(input.signal,async life=>{if((await discover(life)).stopped)throw executionFault('ECS_REFUSED');const native=assertNativeExecution(await life.run(signal=>{if(closed)throw executionFault('ECS_REFUSED');return launchNative({...input,signal});}),c.original);if(native.physicalStopProven)throw executionFault('ECS_NOT_READY');if((await current(life,true)).stopped)throw executionFault('ECS_NOT_READY');return receipt(false);});},
  async inspect(value){const input=tuple(value);return operation(input.signal,async life=>{const fact=value.taskId===undefined?await discover(life):await current(life,true);if(fact.stopped)return receipt(true);const native=assertNativeExecution(await life.run(signal=>inspectNative({...input,signal})),c.original);if(native.physicalStopProven)return retireOriginal(life);return receipt((await current(life,true)).stopped);});},
  async retire(value){const input=tuple(value);closed=true;return operation(input.signal,retireOriginal);},
  async readiness({signal}={}){if(closed||c.now()>=c.original.expiresAtMs)throw executionFault('ECS_REFUSED');return operation(signal,async life=>{if((await current(life,true)).stopped)throw executionFault('ECS_REFUSED');await life.run(signal=>readyNative({signal}));if(closed||c.now()>=c.original.expiresAtMs||(await current(life,true)).stopped)throw executionFault('ECS_REFUSED');});},
  registration:Object.freeze({async read(value){const v=own(value,['binding','key'],['signal','deadlineMs']);if(closed||c.now()>=c.original.expiresAtMs||hash(v.binding)!==hash(c.original.binding))throw executionFault('ECS_REFUSED');return operation(v.signal,async life=>{if((await current(life,true)).stopped)throw executionFault('ECS_REFUSED');const observation=await life.run(signal=>readRegistration({...v,signal}));if(closed||c.now()>=c.original.expiresAtMs||(await current(life,true)).stopped)throw executionFault('ECS_REFUSED');return observation;});}}),
  async close(){closed=true;return this.retire(c.original);}
 });
}
