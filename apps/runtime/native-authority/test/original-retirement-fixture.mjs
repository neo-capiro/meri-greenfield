/** Synthetic ports for the canonical original allocator: one scripted Fargate task per original (with outage and failed-stop modes)
 * and a scripted budget admission (with an uncertain-revocation mode). The conversation journal is the caller's (scripted SQL protocol
 * fixture). No AWS, budget database or provider effects. */
import {RunTaskCommand,DescribeTasksCommand,ListTasksCommand,StopTaskCommand} from '@aws-sdk/client-ecs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {compilePreparedCandidateConfiguration} from '../../prepared-candidate-config.mjs';
import {compileNativeBrokerPlan} from '../broker-stack.mjs';
import {createNativeTaskAllocator} from '../task-allocator.mjs';
import {candidateFixture} from '../../test/prepared-candidate-fixture.mjs';
const prefix='arn:aws:ecs:us-east-1:967807252336:';
/** The reviewed first-run candidate facts and the original they compile to. */
export function originalFacts(){
 const f=candidateFixture(),config=compilePreparedCandidateConfiguration(f.configuration.nativeCandidate,f.configuration.versions),runtime={...config.runtime,proxyCredential:f.secret.proxy};
 const original=compileNativeBrokerPlan({runtime,plan:config.plan,preparationIntent:config.preparationIntent}).original,limits={maxRequestMs:1000,maxFactBytes:131072};
 const retirement=(store,client,extra={})=>({store,pool:{connect(){throw Error('no budget database in this synthetic test');}},client,allocationJson:config.allocationJson,qualification:config.qualification,grantIntents:config.grantIntents,runtime,plan:config.plan,preparationIntent:config.preparationIntent,taskRequest:config.taskRequest,containerName:config.containerName,limits,...extra});
 return {f,config,runtime,original,limits,retirement};
}
export function fakeEcs(original,taskRequest){
 const s={runs:0,stops:0,describes:0,lists:0,outage:false,stopWorks:true,task:null},cluster=taskRequest.cluster.split('/').at(-1),taskId='a'.repeat(32);
 const launch=()=>({taskArn:prefix+'task/'+cluster+'/'+taskId,clusterArn:taskRequest.cluster,taskDefinitionArn:taskRequest.taskDefinition,startedBy:original.executionKey,group:'meri:'+original.executionId,createdAt:new Date(Date.now()-1000),
  tags:[{key:'meri:execution-id',value:original.executionId},{key:'meri:binding-sha256',value:hash(original.binding)},{key:'meri:plan-sha256',value:original.planSha256},{key:'meri:expires-at-ms',value:String(original.expiresAtMs)}],
  launchType:'FARGATE',platformFamily:'Linux',platformVersion:'1.4.0',enableExecuteCommand:false,lastStatus:'RUNNING',desiredStatus:'RUNNING',
  containers:[{name:taskRequest.overrides.containerOverrides[0].name,containerArn:prefix+'container/'+cluster+'/'+taskId+'/11111111-2222-4333-8444-555555555555',imageDigest:original.versions.imageDigest,image:'meri@'+original.versions.imageDigest,lastStatus:'RUNNING'}],
  attachments:[{type:'ElasticNetworkInterface',status:'ATTACHED',details:[{name:'subnetId',value:taskRequest.networkConfiguration.awsvpcConfiguration.subnets[0]}]}]});
 const client={async send(command){if(s.outage)throw Error('synthetic ECS outage');
  if(command instanceof RunTaskCommand){s.runs++;s.task=launch();return {tasks:[structuredClone(s.task)],failures:[]};}
  if(command instanceof DescribeTasksCommand){s.describes++;return {failures:[],tasks:command.input.tasks.map(()=>structuredClone(s.task))};}
  if(command instanceof StopTaskCommand){s.stops++;if(s.stopWorks)Object.assign(s.task,{lastStatus:'STOPPED',desiredStatus:'STOPPED',containers:[{...s.task.containers[0],lastStatus:'STOPPED',exitCode:0}]});return {};}
  if(command instanceof ListTasksCommand){s.lists++;return {taskArns:s.task?[s.task.taskArn]:[]};}
  throw Error('unexpected ECS command');}};
 /** A task launched by an earlier process: its durable resource metadata as the allocator records it. */
 function seed(){s.task=launch();return {taskArn:s.task.taskArn,createdAtMs:s.task.createdAt.getTime(),clusterArn:s.task.clusterArn,taskDefinitionArn:s.task.taskDefinitionArn,containerName:s.task.containers[0].name};}
 return {client,state:s,seed,stopped:()=>s.task?.lastStatus==='STOPPED'};
}
export function syntheticAdmission({original,config}){
 const s={admits:0,revokes:0,revokeWorks:true,grantFactsJsons:null},allocationSha256=hash(JSON.parse(config.allocationJson));
 const admission={async admit({taskArn}){s.admits++;s.grantFactsJsons=config.grantIntents.map(i=>JSON.stringify({grantId:i.grantId,binding:original.binding,qualificationBinding:{runId:original.binding.runId,attempt:config.qualification.attempt,workerArn:taskArn,fence:original.binding.writerFence,policyRevision:config.qualification.policyRevision},capabilitySha256:i.capabilitySha256,allocationSha256}));return {state:'ADMITTED',grantFactsJsons:s.grantFactsJsons,currentAllocationJson:config.allocationJson};},
  async read(){return {state:s.grantFactsJsons?'ADMITTED':'ABSENT',grantFactsJsons:s.grantFactsJsons,currentAllocationJson:config.allocationJson};},
  async revoke({taskArn}){s.revokes++;if(!s.revokeWorks)throw Error('synthetic revocation uncertain');return {state:'REVOKED',revocationProven:true,taskArn,grantIds:config.grantIntents.map(g=>g.grantId)};}};
 return {admission,state:s};
}
/** The canonical allocator a process uses to allocate this original (its pre-allocation authority is synthetic and current). */
export function processAllocator({store,original,config,client,admission}){
 return createNativeTaskAllocator({journal:store.allocations,authority:{async verify(){}},admission,client,original,taskRequest:config.taskRequest,qualification:config.qualification,grantIntents:config.grantIntents,allocationSha256:hash(JSON.parse(config.allocationJson)),containerName:config.containerName,enabled:true,maxRequestMs:1000});
}
