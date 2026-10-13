/** Synthetic test fixture only; no native worker or read authority. */
import {fixturePins} from '../../scripts/test-native-enforcement.mjs';
import {buildNativeEnforcementAdmission} from './app.mjs';
import {SDK_WIRE_PROFILE} from './lib/ecs-wire.mjs';
import {createQualificationWorkerObserver} from './worker-observer.mjs';
import {createHash} from 'node:crypto';
export const runtimePath=process.env.MERI_JSONATA_RUNTIME??'/tmp/meri-qualified-lifecycle-deps/jsonata.cjs';
export function observationFixture({runId,policyRevision}={}){
 const now=Date.now(),p=fixturePins();p.wireProfile=SDK_WIRE_PROFILE;if(runId)p.runUuid=runId;
 const wire=JSON.stringify({profile:SDK_WIRE_PROFILE,timestampEncoding:'iso8601',listResult:{TaskArns:[]},describeResult:{Tasks:[],Failures:[]},eniResult:{NetworkInterfaces:[]},identityResult:{Account:p.account}});
 p.wireEvidence={origin:'SYNTHETIC_TEST_ONLY',reference:'synthetic:worker-observer',version:'1',body:wire,sha256:createHash('sha256').update(wire).digest('hex')};
 const admission=buildNativeEnforcementAdmission({staticPins:p});
 const taskArn=`arn:aws:ecs:${p.region}:${p.account}:task/${p.clusterArn.split('/')[1]}/${'a'.repeat(32)}`;
 const q={runId:p.runUuid,attempt:1,workerArn:taskArn,fence:1,policyRevision:policyRevision??'f'.repeat(64)};
 const request={qualificationBinding:q,probeKind:'sdk',attemptStartMs:now-2000,attemptEndMs:now-500};
 const task={TaskArn:taskArn,ClusterArn:p.clusterArn,TaskDefinitionArn:p.taskDefinitionArns.sdk,StartedBy:p.runUuid,Group:'meri-greenfield-qualification:sdk',LaunchType:'FARGATE',PlatformFamily:'Linux',PlatformVersion:'1.4.0',AvailabilityZone:'us-east-1a',EnableExecuteCommand:false,LastStatus:'RUNNING',DesiredStatus:'RUNNING',CreatedAt:new Date(now-1000).toISOString(),Containers:[{Name:'worker',Image:p.image,ImageDigest:p.image.split('@')[1],LastStatus:'RUNNING',ContainerArn:`arn:aws:ecs:${p.region}:${p.account}:container/${p.clusterArn.split('/')[1]}/${'a'.repeat(32)}/11111111-1111-4111-8111-111111111111`,TaskArn:taskArn}],Overrides:{ContainerOverrides:[{Name:'worker'}],InferenceAcceleratorOverrides:[]},Tags:[{Key:'QualificationRun',Value:p.runUuid},{Key:'QualificationProbe',Value:'sdk'},{Key:'MeriComponent',Value:'native-enforcement'}],Attachments:[{Type:'ElasticNetworkInterface',Status:'ATTACHED',Details:[{Name:'networkInterfaceId',Value:'eni-0123456789abcdef0'},{Name:'subnetId',Value:p.network.subnetId},{Name:'privateIPv4Address',Value:'10.0.0.7'}]}]};
 const eni={NetworkInterfaces:[{NetworkInterfaceId:'eni-0123456789abcdef0',OwnerId:p.account,VpcId:p.network.vpcId,SubnetId:p.network.subnetId,AvailabilityZone:'us-east-1a',PrivateIpAddress:'10.0.0.7',Groups:[{GroupId:p.network.securityGroupId}],PrivateIpAddresses:[{PrivateIpAddress:'10.0.0.7'}],Ipv6Addresses:[]}]};
 const calls=[];let clock=now;
 const reads={async describeTasks(args,ctx){calls.push({kind:'tasks',args,ctx});return {Tasks:[task],Failures:[]};},async describeNetworkInterfaces(args,ctx){calls.push({kind:'eni',args,ctx});return eni;}};
 const make=(extra={})=>createQualificationWorkerObserver({compiledAdmission:admission,jsonataRuntimePath:runtimePath,reads,now:()=>clock,...extra});
 return {p,admission,request,task,eni,reads,calls,make,now:()=>clock,setNow:v=>{clock=v;},deadlineMs:now+10000};
}
