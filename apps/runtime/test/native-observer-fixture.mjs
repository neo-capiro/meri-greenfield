/** Synthetic SDK wire and canonical /2 producer inputs. Never used by production. */
import {readFileSync} from 'node:fs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {nativeObserverLaunchTags,NATIVE_OBSERVER_TAG_POLICY} from '../../../packages/contracts/native-observer.mjs';
import {createManagedWatchdogReadback} from '../native-watchdog-readback.mjs';
import {assertNativeDeclaration} from '../../control/browser-hosts/native-reservations.mjs';
import {PHYSICAL_COLUMNS,physicalTriplet,initialPhysicalContexts} from '../../control/browser-hosts/native-physical-journal.mjs';
export const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const instanceId='i-0123456789abcdef0',volumeId='vol-0123456789abcdef0',eniId='eni-0123456789abcdef0';
export async function observerFixture(){
 const PEM=readFileSync(new URL('../certs/rds-global-bundle.pem',import.meta.url),'ascii').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/u)[0];
 const bootstrapSpec={schema:'meri-native-bootstrap-spec/1',document:{name:'meri-bootstrap',version:'1',sha256:'a'.repeat(64),pluginName:'nativeBootstrap'},
  programSha256:'b'.repeat(64),profileSha256:'c'.repeat(64),hostEndpoint:{port:9443,serverName:'host.example'},
  control:{endpoint:{address:'10.0.0.1',port:443,serverName:'control.example'},clientName:'control.meri.internal',
   serverCertificate:PEM,clientCertificate:PEM,caCertificate:PEM,policySha256:'d'.repeat(64)},issuerCaCertificate:PEM};
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:'tenant',conversationId:uuid(1),generation:1,
  hostId:uuid(7),hostMode:'native-processing',imageDigest:'sha256:'+'c'.repeat(64),leaseDeadlineMs:61000};
 const binding={tenantId:'tenant',actorId:uuid(2),conversationId:uuid(1),runId:uuid(3),attemptId:uuid(4),workerId:uuid(5),writerFence:1};
 const placement={availabilityZone:'us-east-1a',vpcId:'vpc-0123456789abcdef0',subnetId:'subnet-0123456789abcdef0',
  securityGroupIds:['sg-0123456789abcdef0'],iamInstanceProfile:'host'};
 const launch={ImageId:'ami-0123456789abcdef0',InstanceType:'c7g.large',SubnetId:placement.subnetId,
  SecurityGroupIds:placement.securityGroupIds,IamInstanceProfile:{Name:'host'}};
 const physicalObserver={schema:'meri-native-managed-observer/1',protocol:'native-observer-around-managed/1',
  route:'/v1/execution/native/physical-observer',authenticationPrincipal:'native-watchdog-observer-v1',
  bridgeFunctionVersionArn:'arn:aws:lambda:us-east-1:111122223333:function:observer:3'};
 const owner=createManagedWatchdogReadback({stateMachineVersionArn:'arn:aws:states:us-east-1:111122223333:stateMachine:meri:7',
  definitionSha256:'a'.repeat(64),qualificationEvidenceSha256:'b'.repeat(64),now:()=>1001});
 const watchdog=await owner.makeIntent({hostId:allocation.hostId,generation:1,t0Ms:1000,deadlineMs:61000,leaseDeadlineMs:61000,cleanupCeilingMs:86000,
  allocationSha256:hash(allocation),sourceCommit:'c'.repeat(40),imageDigest:allocation.imageDigest,bootstrapSha256:'e'.repeat(64),
  placementSha256:hash(placement),launchSha256:hash(launch),controlPolicySha256:bootstrapSpec.control.policySha256,
  provisionToken:'f'.repeat(64),physicalObserver,placement,launch});
 const declaration=assertNativeDeclaration({schema:'meri-native-provisioning-declaration/2',imageDigest:allocation.imageDigest,sourceCommit:'c'.repeat(40),
  bootstrapSha256:'e'.repeat(64),accountId:'111122223333',region:'us-east-1',placement,launch,token:'f'.repeat(64),
  tags:{MeriProvisionToken:'f'.repeat(64)},leaseDeadlineMs:61000,bootstrapSpec,watchdog,physicalObserver,launchTagPolicy:NATIVE_OBSERVER_TAG_POLICY});
 const row={host_id:allocation.hostId,generation:1,allocation_json:allocation,allocation_sha256:hash(allocation),original_binding_json:binding,
  declaration_json:declaration,declaration_sha256:hash(declaration),owner_instance_id:uuid(9),state:'dispatching',dispatch_started_at_ms:1100,
  observed_instance_json:{instanceId,privateIp:'10.0.0.5'},host_identity_json:null};
 for(const name of Object.keys(PHYSICAL_COLUMNS)){
  const [json,sha,canonical]=physicalTriplet(name,name==='context'?initialPhysicalContexts({allocation,binding,declaration}):null);
  Object.assign(row,{[`native_physical_${name}_json`]:json,[`native_physical_${name}_sha256`]:sha,[`native_physical_${name}_canonical`]:canonical});
 }
 const key={hostId:allocation.hostId,generation:1,originalBindingSha256:hash(binding),declarationSha256:hash(declaration)};
 const tags=Object.entries(nativeObserverLaunchTags({allocation,declaration})).map(([Key,Value])=>({Key,Value}));
 const meta={$metadata:{requestId:'synthetic-request-12345678',httpStatusCode:200,extendedRequestId:undefined,cfId:undefined,attempts:1,totalRetryDelay:0}};
 const nic={NetworkInterfaceId:eniId,OwnerId:declaration.accountId,VpcId:placement.vpcId,SubnetId:placement.subnetId,
  Groups:[{GroupId:placement.securityGroupIds[0]}],Attachment:{InstanceId:instanceId,AttachmentId:'eni-attach-0123456789abcdef0',DeviceIndex:0,DeleteOnTermination:true,Status:'attached'}};
 const instance={InstanceId:instanceId,ImageId:launch.ImageId,VpcId:placement.vpcId,SubnetId:placement.subnetId,Tags:tags,
  State:{Name:'running',Code:16},RootDeviceName:'/dev/xvda',RootDeviceType:'ebs',PublicIpAddress:'',PublicDnsName:'',PrivateIpAddress:'10.0.0.5',
  BlockDeviceMappings:[{DeviceName:'/dev/xvda',Ebs:{VolumeId:volumeId,DeleteOnTermination:true}}],NetworkInterfaces:[{...nic,Attachment:{...nic.Attachment}}]};
 delete instance.NetworkInterfaces[0].Attachment.InstanceId;
 const responses={
  GetCallerIdentity:{...meta,Account:declaration.accountId,Arn:`arn:aws:sts::${declaration.accountId}:assumed-role/control/session`,UserId:'role:session'},
  DescribeInstances:{...meta,Reservations:[{OwnerId:declaration.accountId,Instances:[instance]}]},
  DescribeVolumes:{...meta,Volumes:[{VolumeId:volumeId,OwnerId:declaration.accountId,State:'in-use',Encrypted:true,Tags:tags,
   Attachments:[{InstanceId:instanceId,VolumeId:volumeId,Device:'/dev/xvda',DeleteOnTermination:true}]}]},
  DescribeNetworkInterfaces:{...meta,NetworkInterfaces:[nic]},
  TerminateInstances:{...meta,TerminatingInstances:[{InstanceId:instanceId,CurrentState:{Name:'shutting-down',Code:32}}]},
 };
 return {row,key,responses,meta,allocation,binding,declaration};
}
