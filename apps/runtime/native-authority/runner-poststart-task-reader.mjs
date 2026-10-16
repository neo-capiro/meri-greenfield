/** ECS lookup used only to discover the startedBy execution key for a claimed ARN.
 * Subsequent durable and fresh ECS/ENI reads must still agree before material. */
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {taskRouterFault} from './task-router-boundary.mjs';
const arn=/^arn:aws:ecs:us-east-1:967807252336:task\/[A-Za-z0-9_-]{1,255}\/[a-f0-9]{32}$/u;
export async function createRunnerPoststartTaskReader(configuration){
 const c=own(configuration,['ecsClient','clusterArn']),send=storageMethod(c.ecsClient,'send');
 if(typeof c.clusterArn!=='string'||!/^arn:aws:ecs:us-east-1:967807252336:cluster\/[A-Za-z0-9_-]{1,255}$/u.test(c.clusterArn))throw taskRouterFault();
 const {DescribeTasksCommand}=await import('@aws-sdk/client-ecs');
 return Object.freeze({async read(value){
  const v=own(value,['taskArn','signal']);nativeSignal(v.signal);
  if(!arn.test(v.taskArn)||v.signal?.aborted||!v.taskArn.startsWith(c.clusterArn.replace(':cluster/',':task/')+'/'))throw taskRouterFault();
  const result=await send(new DescribeTasksCommand({cluster:c.clusterArn,tasks:[v.taskArn],include:['TAGS']}),{abortSignal:v.signal});
  if(result?.failures?.length||!Array.isArray(result?.tasks)||result.tasks.length!==1||result.tasks[0].taskArn!==v.taskArn)throw taskRouterFault();
  return result.tasks[0];
 }});
}
