/** Correlate an original admitted Fargate resource; metadata is never run completion. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {executionFault} from './execution-broker.mjs';
const refused=()=>{throw executionFault('ECS_OWNERSHIP_REFUSED');};
export function compileEcsTaskBinding(value){
 const c=own(value,['original','clusterArn','taskDefinitionArn','taskArn','containerName','createdAtMs'],['enabled','now','maxRequestMs','maxPages','maxTasks']);
 const original=data(own(c.original,['binding','executionKey','executionId','planSha256','expiresAtMs','versions']));validateShape('RunBinding',original.binding);validateShape('RuntimeVersions',original.versions);if(original.executionKey!==hash(original.binding)||original.executionId!==original.executionKey||!/^[a-f0-9]{64}$/u.test(original.planSha256)||!Number.isSafeInteger(original.expiresAtMs)||original.expiresAtMs<1)refused();const regionAccount=/^arn:aws(?:-us-gov|-cn)?:ecs:[a-z0-9-]+:[0-9]{12}:/u;
 if([c.clusterArn,c.taskDefinitionArn,c.taskArn].some(v=>typeof v!=='string')||!regionAccount.test(c.clusterArn)||!/^cluster\/[A-Za-z0-9_-]{1,255}$/u.test(c.clusterArn.replace(regionAccount,'')))refused();
 const prefix=c.clusterArn.slice(0,c.clusterArn.indexOf('cluster/')),cluster=c.clusterArn.slice(prefix.length+8);
 if(!c.taskDefinitionArn.startsWith(prefix)||!/^task-definition\/[A-Za-z0-9_-]+:[1-9][0-9]*$/u.test(c.taskDefinitionArn.slice(prefix.length))||c.taskArn!==prefix+'task/'+cluster+'/'+c.taskArn.split('/').at(-1)||!/^[a-f0-9]{32}$/u.test(c.taskArn.split('/').at(-1))||typeof c.containerName!=='string'||!/^[A-Za-z0-9_-]{1,255}$/u.test(c.containerName)||!Number.isSafeInteger(c.createdAtMs)||c.createdAtMs<1||c.createdAtMs>=original.expiresAtMs)refused();
 const now=c.now??Date.now,enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??3000,maxPages=c.maxPages??4,maxTasks=c.maxTasks??100;
 if(typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>10||!Number.isSafeInteger(maxTasks)||maxTasks<1||maxTasks>100)refused();
 return Object.freeze({...c,original,now,enabled,maxRequestMs,maxPages,maxTasks,prefix,cluster,tags:Object.freeze({'meri:execution-id':original.executionId,'meri:binding-sha256':hash(original.binding),'meri:plan-sha256':original.planSha256,'meri:expires-at-ms':String(original.expiresAtMs)})});
}
function workerIdentity(task,c){
 if(!Array.isArray(task.containers)||task.containers.length!==1)refused();
 const worker=task.containers[0],containerPrefix=c.prefix+'container/'+c.cluster+'/'+task.taskArn.split('/').at(-1)+'/';
 if(worker.name!==c.containerName||worker.taskArn!==undefined&&worker.taskArn!==task.taskArn||typeof worker.containerArn!=='string'||!worker.containerArn.startsWith(containerPrefix)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(worker.containerArn.slice(containerPrefix.length)))refused();return worker;
}
export function assertEcsOwnedTask(task,c){
 if(!task||task.taskArn!==c.taskArn||task.clusterArn!==c.clusterArn||task.taskDefinitionArn!==c.taskDefinitionArn||task.startedBy!==c.original.executionKey||task.group!=='meri:'+c.original.executionId||!(task.createdAt instanceof Date)||task.createdAt.getTime()!==c.createdAtMs||!Array.isArray(task.tags))refused();
 const tags=new Map();for(const row of task.tags){if(typeof row.key!=='string'||typeof row.value!=='string'||tags.has(row.key))refused();tags.set(row.key,row.value);}for(const[k,v]of Object.entries(c.tags))if(tags.get(k)!==v)refused();
 const stopped=task.lastStatus==='STOPPED';if(stopped){const worker=workerIdentity(task,c);if(worker.lastStatus!=='STOPPED'||!Number.isSafeInteger(worker.exitCode))throw executionFault('ECS_CLEANUP_UNKNOWN');}
 return Object.freeze({taskId:task.taskArn,stopped});
}
export function assertEcsRunningTask(task,c){
 const worker=workerIdentity(task,c);
 if(task.launchType!=='FARGATE'||task.platformFamily!=='Linux'||task.platformVersion!=='1.4.0'||task.enableExecuteCommand!==false||worker.imageDigest!==c.original.versions.imageDigest||typeof worker.image!=='string'||!worker.image.endsWith('@'+c.original.versions.imageDigest)||task.lastStatus!=='RUNNING'||worker.lastStatus!=='RUNNING'||task.desiredStatus!=='RUNNING')throw executionFault('ECS_NOT_READY');
}
