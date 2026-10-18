import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileEnabledBrowserHostTemplate,computeEnabledTemplateReviewSha256} from './enabled-template.mjs';
import {canonicalJson,WATCHDOG_INPUT_SCHEMA} from './enabled-binding.mjs';
import {LAUNCH_DENY_POLICY_NAME,launchDeadlinePolicy} from './launch-deadline-policy.mjs';
import {closedHostStackPolicy} from './stack-update-policy.mjs';
import {evaluateWatchdogPreflight,handleWatchdogPreflight} from './watchdog-preflight-provider.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const t0=1792424700000;
const imageHash='a'.repeat(64),providerHash='e'.repeat(64),definition='{"StartAt":"Contain","States":{"Contain":{"Type":"Wait","Seconds":1,"End":true}}}';
const bootstrap=Buffer.from('#!/bin/bash\nset -euo pipefail\nexit 1\n');
const ids={control:'sg-0123456789abcdef0',ecrApi:'sg-1123456789abcdef0',ecrDocker:'sg-2123456789abcdef0',logs:'sg-3123456789abcdef0',host:'sg-4123456789abcdef0'};
const fixture=()=>({
 proposal:{allocation:{tenantId:'tenant-one',conversationId:'12e5d15a-46f8-4188-8052-5d35bc5d2a85',
  hostId:'26b43f6a-e709-4f07-9a67-388a641d4b77',generation:4,leaseDeadlineMs:t0+900000},
  source:{sourceCommit:'b'.repeat(40),imageUri:`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/runtime@sha256:${imageHash}`,
   imageConfigSha256:imageHash,bootstrapSha256:hash(bootstrap),seccompSha256:'d'.repeat(64)},
  network:{vpcId:'vpc-0123456789abcdef0',subnetId:'subnet-0123456789abcdef0',controlSecurityGroupId:ids.control},
  host:{amiId:'ami-0123456789abcdef0',amiOwner:'591542846629',architecture:'x86_64',instanceType:'t3.large',rootVolumeGiB:30}},
 privateNetwork:{mode:'closed-qualification',ecrApiSecurityGroupId:ids.ecrApi,ecrDockerSecurityGroupId:ids.ecrDocker,
  logsSecurityGroupId:ids.logs,s3GatewayPrefixListId:'pl-0123456789abcdef0'},
 encryption:{rootKmsKeyArn:'arn:aws:kms:us-east-1:967807252336:key/12e5d15a-46f8-4188-8052-5d35bc5d2a85',
  logsKmsKeyArn:'arn:aws:kms:us-east-1:967807252336:key/26b43f6a-e709-4f07-9a67-388a641d4b77'},
 bootstrap:{userDataBase64:bootstrap.toString('base64'),nativeHelperSha256:'f'.repeat(64)},
 watchdog:{serviceTokenArn:'arn:aws:lambda:us-east-1:967807252336:function:MeriD005Preflight:3',providerCodeSha256:providerHash,
  stateMachineVersionArn:'arn:aws:states:us-east-1:967807252336:stateMachine:MeriD005Watchdog:7',
  definitionSha256:hash(definition),qualificationEvidenceSha256:'1'.repeat(64),
  executionArn:'arn:aws:states:us-east-1:967807252336:execution:MeriD005Watchdog:26b43f6a-e709-4f07-9a67-388a641d4b77-g4',
  originalT0Ms:t0},
 launchGuard:{serviceRoleArn:'arn:aws:iam::967807252336:role/MeriD005-26b43f6a-e709-4f07-9a67-388a641d4b77-g4',
  policySha256:hash(canonicalJson(launchDeadlinePolicy(t0+900000))),
  stackPolicySha256:hash(canonicalJson(closedHostStackPolicy()))},
});
const clone=x=>structuredClone(x);
const permission=source=>({IpProtocol:'tcp',FromPort:443,ToPort:443,UserIdGroupPairs:[{GroupId:source}]});
function network(p){
 const services=[['ecr.api',ids.ecrApi,'eni-0123456789abcdef0'],['ecr.dkr',ids.ecrDocker,'eni-1123456789abcdef0'],['logs',ids.logs,'eni-2123456789abcdef0']];
 return {subnet:{SubnetId:p.SubnetId,VpcId:p.VpcId,MapPublicIpOnLaunch:false,AssignIpv6AddressOnCreation:false},
  routeTable:{RouteTableId:'rtb-0123456789abcdef0',VpcId:p.VpcId,
   Associations:[{SubnetId:p.SubnetId,AssociationState:{State:'associated'}}],
   Routes:[{DestinationCidrBlock:'10.0.0.0/16',GatewayId:'local',State:'active'},
    {DestinationPrefixListId:p.S3GatewayPrefixListId,GatewayId:'vpce-3123456789abcdef0',State:'active'}]},
  endpoints:[...services.map(([service,sg,eni],i)=>({VpcEndpointId:`vpce-${i}123456789abcdef0`,VpcId:p.VpcId,
   ServiceName:`com.amazonaws.us-east-1.${service}`,VpcEndpointType:'Interface',State:'available',PrivateDnsEnabled:true,
   Groups:[{GroupId:sg}],NetworkInterfaceIds:[eni]})),
   {VpcEndpointId:'vpce-3123456789abcdef0',VpcId:p.VpcId,ServiceName:'com.amazonaws.us-east-1.s3',
    VpcEndpointType:'Gateway',State:'available',RouteTableIds:['rtb-0123456789abcdef0']}],
  securityGroups:[{GroupId:ids.control,VpcId:p.VpcId,IpPermissions:[permission(ids.host)]},
   ...services.map(([,sg])=>({GroupId:sg,VpcId:p.VpcId,IpPermissions:[permission(ids.host)]})),
   {GroupId:ids.host,VpcId:p.VpcId,IpPermissions:[],IpPermissionsEgress:[
    ...[ids.control,ids.ecrApi,ids.ecrDocker,ids.logs].map(sg=>({IpProtocol:'tcp',FromPort:443,ToPort:443,UserIdGroupPairs:[{GroupId:sg}]})),
    {IpProtocol:'tcp',FromPort:443,ToPort:443,PrefixListIds:[{PrefixListId:p.S3GatewayPrefixListId}]}]}],
  networkInterfaces:services.map(([,sg,eni])=>({NetworkInterfaceId:eni,Groups:[{GroupId:sg}]}))};
}
function preflight(){
 const t=compileEnabledBrowserHostTemplate(fixture()),p=clone(t.Resources.WatchdogPreflight.Properties);
 p.HostSecurityGroupId=ids.host;
 const expected={schema:WATCHDOG_INPUT_SCHEMA,hostId:p.HostId,generation:p.Generation,allocationSha256:p.AllocationSha256,
  sourceCommit:p.SourceCommit,imageUri:p.ImageUri,imageConfigSha256:p.ImageConfigSha256,
  bootstrapSha256:p.BootstrapSha256,nativeHelperSha256:p.NativeHelperSha256,templateSha256:p.TemplateSha256,
  originalT0Ms:p.OriginalT0Ms,deadlineMs:p.DeadlineMs};
 const event={RequestType:'Create',RequestId:'request-one',StackId:'arn:aws:cloudformation:us-east-1:967807252336:stack/meri-host/1234',
  ResponseURL:'https://cloudformation-custom-resource-response-use1.s3.amazonaws.com/signed',ResourceType:'Custom::MeriWatchdogPreflight',
  LogicalResourceId:'WatchdogPreflight',ResourceProperties:p};
 const state={template:clone(t),execution:{executionArn:p.ExecutionArn,stateMachineArn:p.StateMachineVersionArn.replace(/:7$/u,''),
  stateMachineVersionArn:p.StateMachineVersionArn,status:'RUNNING',input:canonicalJson(expected),startDate:new Date(t0+1000)},
  machine:{stateMachineArn:p.StateMachineVersionArn,type:'STANDARD',status:'ACTIVE',definition,
   roleArn:'arn:aws:iam::967807252336:role/MeriD005Watchdog'},
  provider:{FunctionArn:p.ServiceToken,CodeSha256:Buffer.from(providerHash,'hex').toString('base64')},
  stackSummary:{Stacks:[{StackId:event.StackId,RoleARN:p.StackServiceRoleArn}]},
  rolePolicy:{RoleName:p.StackServiceRoleArn.split('/').at(-1),PolicyName:LAUNCH_DENY_POLICY_NAME,
   PolicyDocument:encodeURIComponent(JSON.stringify(launchDeadlinePolicy(p.DeadlineMs)))},
  stackPolicy:{StackPolicyBody:JSON.stringify(closedHostStackPolicy())},
  ami:{Images:[{ImageId:p.AmiId,OwnerId:p.AmiOwner,Architecture:p.Architecture,State:'available',
   RootDeviceName:'/dev/xvda',RootDeviceType:'ebs',VirtualizationType:'hvm',BlockDeviceMappings:[{DeviceName:'/dev/xvda',Ebs:{SnapshotId:'snap-a'}}]}]},
  network:network(p),qualification:{schema:'meri-d005-watchdog-qualification/1',
   stateMachineVersionArn:p.StateMachineVersionArn,definitionSha256:p.WatchdogDefinitionSha256,
   roleArn:'arn:aws:iam::967807252336:role/MeriD005Watchdog',evidenceSha256:p.QualificationEvidenceSha256,
   positiveRootVolumeAbsenceQualified:true,managedSurvivalMeasured:true,
   lateProvisioningReconciliationQualified:true,originalCeilingMeasured:true,
   issuedAtMs:t0-1000,expiresAtMs:t0+900000},
  now:t0+5000};
 const ports={nowMs:()=>state.now,readStackTemplate:async()=>({TemplateBody:JSON.stringify(state.template)}),
  readStackSummary:async()=>state.stackSummary,readRolePolicy:async()=>state.rolePolicy,
  readStackPolicy:async()=>state.stackPolicy,
  readStateMachineVersion:async()=>state.machine,readExecution:async()=>state.execution,
  readProviderCode:async()=>state.provider,readAmi:async()=>state.ami,readNetwork:async()=>state.network,
  readWatchdogQualification:async()=>state.qualification};
 return {t,p,event,state,ports};
}

test('enabled source has one bounded private host and a real preflight dependency',()=>{
 const t=compileEnabledBrowserHostTemplate(fixture());
 assert.equal(Object.hasOwn(t,'Conditions'),false);
 assert.deepEqual(Object.keys(t.Resources).sort(),['HostInstance','HostInstanceProfile','HostLogGroup','HostRole','HostSecurityGroup','WatchdogPreflight']);
 assert.deepEqual(t.Resources.HostInstance.DependsOn,['WatchdogPreflight','HostLogGroup']);
 assert.equal(t.Resources.WatchdogPreflight.Type,'Custom::MeriWatchdogPreflight');
 assert.equal(computeEnabledTemplateReviewSha256(t),t.Metadata.templateReviewSha256);
 assert.equal(t.Resources.WatchdogPreflight.Properties.TemplateSha256,t.Metadata.templateReviewSha256);
 const h=t.Resources.HostInstance.Properties;
 assert.equal(h.UserData,bootstrap.toString('base64'));
 assert.equal(h.CreditSpecification.CPUCredits,'standard');
 assert.equal(h.BlockDeviceMappings[0].Ebs.KmsKeyId,fixture().encryption.rootKmsKeyArn);
 assert.equal(h.BlockDeviceMappings[0].Ebs.DeleteOnTermination,true);
 assert.equal(h.NetworkInterfaces[0].DeleteOnTermination,true);
 assert.equal(h.NetworkInterfaces[0].AssociatePublicIpAddress,false);
 assert.equal(h.PropagateTagsToVolumeOnCreation,true);
 assert.equal(t.Resources.HostLogGroup.Properties.RetentionInDays,7);
 assert.equal(t.Resources.HostSecurityGroup.Properties.SecurityGroupIngress.length,0);
 assert.equal(t.Resources.HostSecurityGroup.Properties.SecurityGroupEgress.length,5);
 assert.deepEqual(t.Resources.HostRole.Properties.AssumeRolePolicyDocument.Statement[0].Condition,
  {StringEqualsIfExists:{'aws:SourceAccount':'967807252336'}});
 assert.equal(JSON.stringify(t).includes('0.0.0.0/0'),false);
 assert.equal(JSON.stringify(t).includes('NatGateway'),false);
 assert.equal(t.Metadata.productionBrowserActivation,'held');
});

test('input refuses implicit web mode, missing pins, mutable image and larger spend envelope',()=>{
 for(const change of [
  x=>{x.privateNetwork.mode='proxy-web';},x=>{delete x.watchdog.executionArn;},
  x=>{x.watchdog.serviceTokenArn=x.watchdog.serviceTokenArn.replace(':3',':$LATEST');},
  x=>{x.proposal.source.imageUri=x.proposal.source.imageUri.replace('@sha256:',':latest-');},
  x=>{x.proposal.host.instanceType='m5.4xlarge';},x=>{x.proposal.host.rootVolumeGiB=31;},
  x=>{x.proposal.allocation.leaseDeadlineMs+=1;},x=>{x.bootstrap.userDataBase64=Buffer.from('another script').toString('base64');},
  x=>{x.privateNetwork.ecrApiSecurityGroupId=ids.control;},
  x=>{x.launchGuard.policySha256='0'.repeat(64);},
  x=>{x.launchGuard.stackPolicySha256='0'.repeat(64);},
 ]){const x=fixture();change(x);assert.throws(()=>compileEnabledBrowserHostTemplate(x));}
});

test('provider checks actual stack, pinned managed execution, immutable provider, AMI and private network',async()=>{
 const f=preflight();
 assert.equal((await evaluateWatchdogPreflight(f.event,f.ports)).executionArn,f.p.ExecutionArn);
 const sent=[];
 const response=await handleWatchdogPreflight(f.event,{...f.ports,sendResponse:async(url,body)=>sent.push([url,body])});
 assert.equal(response.Status,'SUCCESS');assert.equal(sent.length,1);assert.equal(sent[0][0],f.event.ResponseURL);
});

test('preflight refuses stale/changed source or a network direct route, then sends FAILED',async()=>{
 const changes=[
  f=>{f.state.now=t0+120001;},
  f=>{f.state.execution.status='SUCCEEDED';},
  f=>{f.state.execution.input=canonicalJson({...JSON.parse(f.state.execution.input),templateSha256:'f'.repeat(64)});},
  f=>{f.state.machine.definition='{}';},
  f=>{f.state.stackSummary.Stacks[0].RoleARN='arn:aws:iam::967807252336:role/Other';},
  f=>{f.state.rolePolicy.PolicyDocument=encodeURIComponent(JSON.stringify({...launchDeadlinePolicy(f.p.DeadlineMs),Statement:[]}));},
  f=>{f.state.stackPolicy.StackPolicyBody=JSON.stringify({Statement:[{Effect:'Allow',Action:'Update:*',Principal:'*',Resource:'*'}]});},
  f=>{f.state.qualification.positiveRootVolumeAbsenceQualified=false;},
  f=>{f.state.qualification.lateProvisioningReconciliationQualified=false;},
  f=>{f.state.provider.CodeSha256=Buffer.from('0'.repeat(64),'hex').toString('base64');},
  f=>{f.state.template.Resources.HostInstance.Properties.Monitoring=true;},
  f=>{f.state.template.Resources.HostInstance.Properties.NetworkInterfaces[0].GroupSet=[{Ref:'OtherSecurityGroup'}];},
  f=>{f.state.network.routeTable.Routes.push({DestinationCidrBlock:'0.0.0.0/0',NatGatewayId:'nat-123',State:'active'});},
  f=>{f.state.network.routeTable.Routes.push({DestinationCidrBlock:'8.8.8.8/32',NatGatewayId:'nat-123',State:'active'});},
  f=>{f.state.network.routeTable.Routes.push({DestinationIpv6CidrBlock:'2606:4700:4700::1111/128',EgressOnlyInternetGatewayId:'eigw-123',State:'active'});},
  f=>{f.state.network.routeTable.Routes.push({DestinationCidrBlock:'10.1.0.0/16',TransitGatewayId:'tgw-123',State:'active'});},
  f=>{f.state.network.routeTable.Routes[0].DestinationCidrBlock='11.0.0.0/8';},
  f=>{f.state.network.routeTable.Routes[0].State='blackhole';},
  f=>{f.state.network.networkInterfaces.push({NetworkInterfaceId:'eni-other',Groups:[{GroupId:ids.ecrApi}]});},
  f=>{f.state.ami.Images[0].BlockDeviceMappings.push({DeviceName:'/dev/xvdb',Ebs:{SnapshotId:'snap-b'}});},
 ];
 for(const change of changes){
  const f=preflight();change(f);
  await assert.rejects(evaluateWatchdogPreflight(f.event,f.ports),{code:'WATCHDOG_PREFLIGHT_REFUSED'});
  const sent=[];const response=await handleWatchdogPreflight(f.event,{...f.ports,sendResponse:async(_,body)=>sent.push(body)});
  assert.equal(response.Status,'FAILED');assert.equal(sent.length,1);
 }
});

test('preflight rejects a watchdog that stops during inventory reads',async()=>{
 const f=preflight();let reads=0;
 f.ports.readExecution=async()=>{
  reads++;
  return reads===1?clone(f.state.execution):{...f.state.execution,status:'SUCCEEDED',stopDate:new Date(t0+4000)};
 };
 await assert.rejects(evaluateWatchdogPreflight(f.event,f.ports),{code:'WATCHDOG_PREFLIGHT_REFUSED'});
 assert.equal(reads,2);
});

test('Delete removes only the preflight resource; Update cannot rearm a running host',async()=>{
 const f=preflight();const sent=[];
 const deleteEvent={...f.event,RequestType:'Delete',PhysicalResourceId:'meri-d005-preflight-0123456789abcdef0123456789abcdef'};
 assert.equal((await handleWatchdogPreflight(deleteEvent,{sendResponse:async(_,body)=>sent.push(body)})).Status,'SUCCESS');
 assert.equal(sent.length,1);
 await assert.rejects(evaluateWatchdogPreflight({...f.event,RequestType:'Update'},f.ports),{code:'WATCHDOG_PREFLIGHT_REFUSED'});
});
