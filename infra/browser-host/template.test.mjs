import test from 'node:test';
import assert from 'node:assert/strict';
import {compileBrowserHostDisabledTemplate} from './template.mjs';

const hash='a'.repeat(64);
const fixture=()=>({
 allocation:{tenantId:'tenant-one',conversationId:'12e5d15a-46f8-4188-8052-5d35bc5d2a85',
  hostId:'26b43f6a-e709-4f07-9a67-388a641d4b77',generation:4,leaseDeadlineMs:1792425600000},
 source:{sourceCommit:'b'.repeat(40),
  imageUri:`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/runtime@sha256:${hash}`,
  imageConfigSha256:hash,bootstrapSha256:'c'.repeat(64),seccompSha256:'d'.repeat(64)},
 network:{vpcId:'vpc-0123456789abcdef0',subnetId:'subnet-0123456789abcdef0',
  controlSecurityGroupId:'sg-0123456789abcdef0'},
 host:{amiId:'ami-0123456789abcdef0',amiOwner:'591542846629',architecture:'x86_64',
  instanceType:'t3.large',rootVolumeGiB:30},
});

function refs(value,result=[]){
 if(!value||typeof value!=='object')return result;
 if(Object.hasOwn(value,'Ref'))result.push(value.Ref);
 for(const child of Object.values(value))refs(child,result);
 return result;
}

test('all concrete CFN resources are permanently disabled with no input admission switch',()=>{
 const t=compileBrowserHostDisabledTemplate(fixture());
 assert.deepEqual(t.Conditions,{SourceOnlyLaunchDenied:{'Fn::Equals':['source-only','launch-authorized']}});
 assert.equal(Object.hasOwn(t,'Parameters'),false);
 assert.equal(Object.hasOwn(t,'Outputs'),false);
 assert.deepEqual(Object.keys(t.Resources).sort(),['HostInstance','HostInstanceProfile','HostRole','HostSecurityGroup']);
 for(const r of Object.values(t.Resources))assert.equal(r.Condition,'SourceOnlyLaunchDenied');
 assert.deepEqual([...new Set(refs(t))].sort(),['HostInstanceProfile','HostRole','HostSecurityGroup']);
 assert.equal(t.Metadata.runtimeEnabled,false);
 assert.equal(t.Metadata.deployable,false);
 assert.equal(t.Metadata.watchdogArmed,false);
 assert.equal(t.Metadata.rootVolumeAbsenceQualified,false);
 assert.throws(()=>compileBrowserHostDisabledTemplate({...fixture(),runtimeEnabled:true}),
  {code:'BROWSER_HOST_PROPOSAL_REFUSED'});
});

test('private host boundary is exact and has no direct public network rule',()=>{
 const b=fixture(),t=compileBrowserHostDisabledTemplate(b);
 const sg=t.Resources.HostSecurityGroup.Properties;
 assert.equal(sg.VpcId,b.network.vpcId);
 assert.deepEqual(sg.SecurityGroupIngress,[]);
 assert.deepEqual(sg.SecurityGroupEgress,[{IpProtocol:'tcp',FromPort:443,ToPort:443,
  DestinationSecurityGroupId:b.network.controlSecurityGroupId,
  Description:'Pinned private control security group only'}]);
 const host=t.Resources.HostInstance.Properties;
 assert.equal(host.ImageId,b.host.amiId);
 assert.equal(host.InstanceType,b.host.instanceType);
 assert.deepEqual(host.NetworkInterfaces,[{DeviceIndex:'0',AssociatePublicIpAddress:false,
  SubnetId:b.network.subnetId,GroupSet:[{Ref:'HostSecurityGroup'}]}]);
 assert.deepEqual(host.MetadataOptions,{HttpEndpoint:'enabled',HttpTokens:'required',HttpPutResponseHopLimit:1,
  HttpProtocolIpv6:'disabled',InstanceMetadataTags:'disabled'});
 assert.deepEqual(host.BlockDeviceMappings,[{DeviceName:'/dev/xvda',Ebs:{VolumeType:'gp3',VolumeSize:30,
  Encrypted:true,DeleteOnTermination:true}}]);
 assert.equal(Object.hasOwn(host,'UserData'),false);
 assert.equal(Object.hasOwn(t.Resources,'InternetGateway'),false);
 assert.equal(Object.hasOwn(t.Resources,'NatGateway'),false);
});

test('bootstrap role is bounded to exact image repository and outputs are detached from mutable input',()=>{
 const b=fixture(),t=compileBrowserHostDisabledTemplate(b);
 const statements=t.Resources.HostRole.Properties.Policies[0].PolicyDocument.Statement;
 assert.deepEqual(statements,[
  {Effect:'Allow',Action:['ecr:GetAuthorizationToken'],Resource:'*'},
  {Effect:'Allow',Action:['ecr:BatchCheckLayerAvailability','ecr:BatchGetImage','ecr:GetDownloadUrlForLayer'],
   Resource:'arn:aws:ecr:us-east-1:967807252336:repository/meri-greenfield/runtime'},
 ]);
 assert.equal(t.Metadata.imageUri,b.source.imageUri);
 assert.equal(t.Metadata.amiOwner,b.host.amiOwner);
 assert.equal(t.Metadata.hostId,b.allocation.hostId);
 assert.equal(JSON.stringify(t).includes(b.allocation.tenantId),false);
 assert.equal(JSON.stringify(t).includes(b.allocation.conversationId),false);
 b.source.imageUri='changed';b.network.controlSecurityGroupId='changed';
 assert.equal(t.Metadata.imageUri.includes('@sha256:'),true);
 assert.equal(t.Resources.HostSecurityGroup.Properties.SecurityGroupEgress[0].DestinationSecurityGroupId,'sg-0123456789abcdef0');
 assert.equal(Object.isFrozen(t.Conditions.SourceOnlyLaunchDenied['Fn::Equals']),true);
 assert.throws(()=>t.Conditions.SourceOnlyLaunchDenied['Fn::Equals'].push('changed'),TypeError);
});
