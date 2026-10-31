import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileNativeDeployment,assertNativeLaunch} from '../native-deployment-configuration.mjs';
import {createManagedWatchdogReadback} from '../native-watchdog-readback.mjs';
import {createEc2NativeHostLaunchPort} from '../native-host-provisioning.mjs';
import {assertNativeDeclaration,assertNativeObserverAllocationJoin} from '../../control/browser-hosts/native-reservations.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {nativeObserverLaunchRequest,nativeObserverDeadline,NATIVE_OBSERVER_TAG_POLICY} from '../../../packages/contracts/native-observer.mjs';
const PEM=readFileSync(new URL('../certs/rds-global-bundle.pem',import.meta.url),'ascii')
 .match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/u)[0];
const spec={schema:'meri-native-bootstrap-spec/1',document:{name:'meri-bootstrap',version:'1',sha256:'a'.repeat(64),
 pluginName:'nativeBootstrap'},programSha256:'b'.repeat(64),profileSha256:'c'.repeat(64),
 hostEndpoint:{port:9443,serverName:'host.example'},control:{endpoint:{address:'10.0.0.1',port:443,
 serverName:'control.example'},clientName:'control.meri.internal',serverCertificate:PEM,clientCertificate:PEM,
 caCertificate:PEM,policySha256:'d'.repeat(64)},issuerCaCertificate:PEM};
function deployment(){return {accountId:'111122223333',region:'us-east-1',imageDigest:'sha256:'+'c'.repeat(64),
 sourceCommit:'d'.repeat(40),bootstrapSha256:'e'.repeat(64),
 placement:{availabilityZone:'us-east-1a',subnetId:'subnet-0123456789abcdef0',
  securityGroupIds:['sg-0123456789abcdef0'],iamInstanceProfile:'meri-host-profile'},
 launch:{ImageId:'ami-0123456789abcdef0',InstanceType:'c7g.large',SubnetId:'subnet-0123456789abcdef0',
  SecurityGroupIds:['sg-0123456789abcdef0'],IamInstanceProfile:{Name:'meri-host-profile'}},bootstrapSpec:spec};}

function observerDeployment(){const d=deployment();return {...d,placement:{...d.placement,vpcId:'vpc-0123456789abcdef0'},
 launchTagPolicy:NATIVE_OBSERVER_TAG_POLICY,physicalObserver:{schema:'meri-native-managed-observer/1',
 protocol:'native-observer-around-managed/1',route:'/v1/execution/native/physical-observer',
 authenticationPrincipal:'native-watchdog-observer-v1',
 bridgeFunctionVersionArn:'arn:aws:lambda:us-east-1:111122223333:function:meri-observer:7'}};}

test('/2 real producer supplies complete protected graph input and original launch tags on instance AND volume',async()=>{
 const d=compileNativeDeployment(observerDeployment()),hostId='0f8fad5b-d9cb-469f-a165-70867728950e';
 const allocation={schema:'meri-conversation-host-allocation/1',hostId,generation:1,tenantId:'fixture',
 conversationId:'1f8fad5b-d9cb-469f-a165-70867728950e',hostMode:'native-processing',imageDigest:d.imageDigest,leaseDeadlineMs:61000};
 const owner=createManagedWatchdogReadback({stateMachineVersionArn:'arn:aws:states:us-east-1:111122223333:stateMachine:meri:8',
 definitionSha256:'1'.repeat(64),qualificationEvidenceSha256:'2'.repeat(64),now:()=>1001});
 const watchdog=await owner.makeIntent({hostId,generation:1,t0Ms:1000,deadlineMs:61000,leaseDeadlineMs:61000,
 cleanupCeilingMs:86000,allocationSha256:hash(allocation),sourceCommit:d.sourceCommit,imageDigest:d.imageDigest,
 bootstrapSha256:d.bootstrapSha256,placementSha256:hash(d.placement),launchSha256:hash(d.launch),
 controlPolicySha256:spec.control.policySha256,provisionToken:'a'.repeat(64),physicalObserver:d.physicalObserver,
 placement:d.placement,launch:d.launch});
 assert.equal(watchdog.input.schema,'meri-native-watchdog-input/2');
 assert.equal(watchdog.input.placement.vpcId,d.placement.vpcId);
 assert.deepEqual(watchdog.input.launch,d.launch);
 const declaration=assertNativeDeclaration({...d,schema:'meri-native-provisioning-declaration/2',
 token:'a'.repeat(64),tags:{MeriProvisionToken:'a'.repeat(64)},leaseDeadlineMs:61000,watchdog});
 const requests=[];
 const launch=createEc2NativeHostLaunchPort({launch:d.launch,ec2:{async send(command){requests.push(command);
  if(command.constructor.name==='DescribeInstancesCommand')return {Reservations:[]};
  return {Instances:[{InstanceId:'i-0123456789abcdef0',PrivateIpAddress:'10.0.0.5'}]};}}});
 await launch.launchOnce({identity:{token:declaration.token,hostId,generation:1,
  placementSha256:hash(d.placement),allocationSha256:hash(allocation),declarationSha256:hash(declaration),allocation,declaration}});
 const sent=requests.find(x=>x.constructor.name==='RunInstancesCommand').input;
 assert.deepEqual(sent,nativeObserverLaunchRequest({allocation,declaration}));
 assert.deepEqual(sent.TagSpecifications.map(x=>x.ResourceType),['instance','volume']);
 for(const set of sent.TagSpecifications){const tags=Object.fromEntries(set.Tags.map(t=>[t.Key,t.Value]));
  assert.equal(Object.keys(tags).length,7);assert.equal(tags.Project,'meri-greenfield');
  assert.equal(tags.MeriDeclarationSha256,hash(declaration));assert.equal(tags.MeriAllocationSha256,hash(allocation));}
 assert.notEqual(hash(sent),watchdog.input.launchSha256);
 const mixed=structuredClone(declaration);mixed.watchdog.input.placement.vpcId='vpc-11111111';
 mixed.watchdog.inputSha256=hash(mixed.watchdog.input);assert.throws(()=>assertNativeDeclaration(mixed));
 for(const field of ['provisionToken','sourceCommit','bootstrapSha256','controlPolicySha256']){
  const wrong=structuredClone(declaration);wrong.watchdog.input[field]='9'.repeat(field==='sourceCommit'?40:64);
  wrong.watchdog.inputSha256=hash(wrong.watchdog.input);assert.throws(()=>assertNativeDeclaration(wrong),field);
 }
 for(const field of ['hostId','generation','allocationSha256']){
  const wrong=structuredClone(declaration);
  wrong.watchdog.input[field]=field==='generation'?2:field==='hostId'?'00000000-0000-4000-8000-000000000001':'9'.repeat(64);
  assert.throws(()=>assertNativeObserverAllocationJoin(allocation,wrong),field);
 }
});
test('/2 protected configuration refuses missing VPC, multiple SGs, foreign/unversioned observer and mixed protocol',()=>{
 for(const mutate of [d=>{delete d.placement.vpcId;},d=>{d.placement.securityGroupIds.push('sg-11111111');},
  d=>{d.physicalObserver.bridgeFunctionVersionArn=d.physicalObserver.bridgeFunctionVersionArn.replace('111122223333','444455556666');},
  d=>{d.physicalObserver.bridgeFunctionVersionArn=d.physicalObserver.bridgeFunctionVersionArn.replace(':7',':latest');},
  d=>{delete d.physicalObserver;},d=>{delete d.launchTagPolicy;}]){const d=observerDeployment();mutate(d);assert.throws(()=>compileNativeDeployment(d));}
 assert.throws(()=>nativeObserverDeadline(Number.MAX_SAFE_INTEGER-2));
});

test('valid deployment compiles to the canonical placement/launch shape',()=>{
 const d=compileNativeDeployment(observerDeployment());
 assert.deepEqual(d.launch.IamInstanceProfile,{Name:'meri-host-profile'});
 assert.equal(d.placement.availabilityZone,'us-east-1a');assert.equal(d.maxLifetimeMs,600000);
 assert.equal(Object.isFrozen(d.launch),true);
});
test('D1/D4: new legacy provisioning and launch refuse before provider access',async()=>{
 assert.throws(()=>compileNativeDeployment(deployment()),{code:'NATIVE_PROVISIONING_CONFIGURATION'});
 let calls=0;
 const port=createEc2NativeHostLaunchPort({launch:deployment().launch,ec2:{send:async()=>{calls++;throw Error('unexpected');}}});
 for(const declaration of [undefined,{schema:'meri-native-provisioning-declaration/1'}])
  await assert.rejects(port.launchOnce({identity:{token:'a'.repeat(64),declaration}}),{code:'NATIVE_HOST_PROVISION_REFUSED'});
 assert.equal(calls,0,'no discovery or RunInstances for unsupported new launch');
});
for(const [name,mutate] of [
 ['missing availability zone',d=>{delete d.placement.availabilityZone;}],
 ['invalid availability zone',d=>{d.placement.availabilityZone='us-west-2a';}],
 ['unknown placement key',d=>{d.placement.extra='x';}],
 ['numeric account id',d=>{d.accountId=111122223333;}],
 ['Arn launch profile',d=>{d.launch.IamInstanceProfile={Arn:'arn:aws:iam::111122223333:instance-profile/x'};}],
 ['optional stand-alone UserData',d=>{d.launch.UserData='#!/bin/sh';}],
 ['optional stand-alone MetadataOptions',d=>{d.launch.MetadataOptions={HttpTokens:'required'};}],
 ['optional stand-alone BlockDeviceMappings',d=>{d.launch.BlockDeviceMappings=[];}],
 ['optional stand-alone EbsOptimized',d=>{d.launch.EbsOptimized=true;}],
 ['subnet mismatch',d=>{d.placement.subnetId='subnet-fffffffffffffffff';}],
 ['invalid bootstrap spec',d=>{d.bootstrapSpec={schema:'meri-native-bootstrap-spec/1'};}],
 ['short lifetime',d=>{d.maxLifetimeMs=59999;}],
 ['long lifetime',d=>{d.maxLifetimeMs=900001;}],
])test('deployment compiler refuses '+name,()=>{const d=observerDeployment();mutate(d);assert.throws(()=>compileNativeDeployment(d));});
test('stand-alone launch port keeps normalized Name compatibility',()=>{
 assert.deepEqual(assertNativeLaunch({...deployment().launch,IamInstanceProfile:'meri-host-profile'}).IamInstanceProfile,
  {Name:'meri-host-profile'});
});

test('stand-alone launch port still accepts exactly Name or Arn and keeps its original error code',()=>{
 const base=deployment().launch;
 assert.deepEqual(assertNativeLaunch({...base,IamInstanceProfile:'meri-host-profile'}).IamInstanceProfile,
  {Name:'meri-host-profile'});
 assert.deepEqual(assertNativeLaunch({...base,IamInstanceProfile:{Arn:'arn:aws:iam::111122223333:instance-profile/x'}})
  .IamInstanceProfile,{Arn:'arn:aws:iam::111122223333:instance-profile/x'});
 assert.throws(()=>assertNativeLaunch({...base,IamInstanceProfile:{Name:'x',Arn:'y'}}),
  error=>error.code==='NATIVE_HOST_PROVISION_CONFIGURATION');
});
