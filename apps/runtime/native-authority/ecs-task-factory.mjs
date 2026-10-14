/** Compile existing admitted worker ARN into the broker's original task factory. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';
import {createEcsNativeTaskOwner} from './ecs-task-owner.mjs';
import {executionFault,createNativeExecutionBroker} from './execution-broker.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
export function createAdmittedEcsTaskFactory(value){
 const c=own(value,['client','native','metadata','allocationJson','grantFactsJsons','grantId'],['enabled','now','maxRequestMs','maxPages','maxTasks']);
 const metadata=data(own(c.metadata,['clusterArn','taskDefinitionArn','taskArn','containerName','createdAtMs'])),{allocation,facts}=parseAdmittedGrantSet(c),grant=facts.find(f=>f.grantId===c.grantId);
 if(!grant||facts.some(f=>f.qualificationBinding.workerArn!==metadata.taskArn))throw executionFault('ECS_ADMITTED_TASK_REFUSED');
 return value=>{
  const input=own(value,['original','launchConfiguration']),original=data(input.original);
  if(hash(original.binding)!==hash(grant.binding)||original.expiresAtMs>Date.parse(allocation.schedule.expiresAt))throw executionFault('ECS_ADMITTED_TASK_REFUSED');
  return createEcsNativeTaskOwner({client:c.client,native:c.native,binding:{...metadata,original,enabled:c.enabled??false,now:c.now??Date.now,...Object.fromEntries(['maxRequestMs','maxPages','maxTasks'].filter(k=>c[k]!==undefined).map(k=>[k,c[k]]))}});
 };
}

/** Rebuild original retirement from canonical journal; expired leases never authorize launch. */
export function createAdmittedEcsExecutionRecovery(value){
 const c=own(value,['pool','binding','versions','plan','expiresAtMs','verifier','taskCapability','taskFactory'],['enabled','now','maxRequestMs']);
 if(typeof c.taskFactory!=='function')throw executionFault('ECS_ADMITTED_TASK_REFUSED');
 const original=createExecutionBinding({binding:c.binding,versions:c.versions,plan:c.plan,expiresAtMs:c.expiresAtMs}),store=createPostgresConversationStore({pool:c.pool}),tasks=c.taskFactory({original,launchConfiguration:null});
 return createNativeExecutionBroker({binding:c.binding,versions:c.versions,plan:c.plan,expiresAtMs:c.expiresAtMs,journal:store.executions,tasks,verifier:c.verifier,taskCapability:c.taskCapability,enabled:c.enabled??false,now:c.now??Date.now,maxRequestMs:c.maxRequestMs??3000});
}
