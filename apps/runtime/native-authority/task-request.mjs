/** Canonical inert RunTask request. Expected placement always comes from reviewed control configuration. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {executionFault} from './execution-broker.mjs';

export function compileNativeTaskRequest(configuration){
 const c=own(configuration,['original','taskRequest','containerName']);
 const original=data(own(c.original,['binding','executionKey','executionId','planSha256','expiresAtMs','versions']));validateShape('RunBinding',original.binding);validateShape('RuntimeVersions',original.versions);if(original.executionKey!==hash(original.binding)||original.executionId!==original.executionKey||!/^([a-f0-9]{64})$/u.test(original.planSha256)||!Number.isSafeInteger(original.expiresAtMs)||original.expiresAtMs<1)throw executionFault('ALLOCATION_CONFIGURATION');
 const request=data(own(c.taskRequest,['cluster','taskDefinition','networkConfiguration','overrides']));
 if(!/^arn:aws:ecs:us-east-1:967807252336:cluster\/[A-Za-z0-9_-]+$/u.test(request.cluster)||!/^arn:aws:ecs:us-east-1:967807252336:task-definition\/[A-Za-z0-9_-]+:[1-9][0-9]*$/u.test(request.taskDefinition))throw executionFault('ALLOCATION_CONFIGURATION');
 const vpc=own(request.networkConfiguration,['awsvpcConfiguration']).awsvpcConfiguration;own(vpc,['subnets','securityGroups','assignPublicIp']);if(vpc.assignPublicIp!=='DISABLED'||!Array.isArray(vpc.subnets)||vpc.subnets.length!==1||!/^subnet-[a-f0-9]+$/u.test(vpc.subnets[0])||!Array.isArray(vpc.securityGroups)||vpc.securityGroups.length<1||vpc.securityGroups.length>5||new Set(vpc.securityGroups).size!==vpc.securityGroups.length||vpc.securityGroups.some(x=>!/^sg-[a-f0-9]+$/u.test(x)))throw executionFault('ALLOCATION_CONFIGURATION');
 own(request.overrides,['containerOverrides']);if(!Array.isArray(request.overrides.containerOverrides)||request.overrides.containerOverrides.length!==1)throw executionFault('ALLOCATION_CONFIGURATION');const worker=own(request.overrides.containerOverrides[0],['name','command','environment']);
 if(worker.name!==c.containerName||!Array.isArray(worker.command)||worker.command.some(x=>typeof x!=='string'||x.includes('\0'))||!Array.isArray(worker.environment)||worker.environment.some(x=>{own(x,['name','value']);return typeof x.value!=='string'||!/^MERI_[A-Z_]+$/u.test(x.name)||/(TOKEN|PASSWORD|SECRET|CREDENTIAL)$/u.test(x.name);}))throw executionFault('ALLOCATION_CONFIGURATION');
 const spec=data({...request,count:1,launchType:'FARGATE',platformVersion:'1.4.0',enableExecuteCommand:false,enableECSManagedTags:false,clientToken:original.executionKey,startedBy:original.executionKey,group:'meri:'+original.executionId,tags:[{key:'meri:execution-id',value:original.executionId},{key:'meri:binding-sha256',value:hash(original.binding)},{key:'meri:plan-sha256',value:original.planSha256},{key:'meri:expires-at-ms',value:String(original.expiresAtMs)}]});
 return Object.freeze({original,request,spec,taskRequestSha256:hash(spec)});
}
