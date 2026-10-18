import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding} from '../../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {HOST_PHYSICAL_ABSENCE_SCHEMA} from '../teardown.mjs';
import {createEc2PhysicalTeardownPort} from './port.mjs';

const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation:2,hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,
 leaseDeadlineMs:Date.now()+600000};
const hostIdentity={schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',
 bootId:'00000021-b0a1-4000-8000-000000000000',conversationId:binding.conversationId,hostId:allocation.hostId};
const expected={accountId:'967807252336',region:'us-east-1',amiId:'ami-0123456789abcdef0',
 vpcId:'vpc-0123456789abcdef0',subnetId:'subnet-0123456789abcdef0',
 securityGroupId:'sg-0123456789abcdef0',rootDeviceName:'/dev/xvda'};
const rootVolumeId='vol-0123456789abcdef0',eniId='eni-0123456789abcdef0';
const request=()=>({allocation,binding,hostIdentity});
const tags=()=>[{Key:'Project',Value:'meri-greenfield'},{Key:'MeriHostId',Value:allocation.hostId},
 {Key:'MeriGeneration',Value:'2'},{Key:'MeriAllocationSha256',Value:canonicalSha256(allocation)}];
let requestNumber=1;
const output=body=>({...structuredClone(body),$metadata:{httpStatusCode:200,requestId:`request-${requestNumber++}`}});
const instance=(state='running')=>output({Reservations:[{OwnerId:expected.accountId,Instances:[{
 InstanceId:hostIdentity.instanceId,ImageId:expected.amiId,VpcId:expected.vpcId,SubnetId:expected.subnetId,
 State:{Name:state,Code:state==='terminated'?48:16},Tags:tags(),RootDeviceName:'/dev/xvda',RootDeviceType:'ebs',
 BlockDeviceMappings:[{DeviceName:'/dev/xvda',Ebs:{VolumeId:rootVolumeId,DeleteOnTermination:true}}],
 NetworkInterfaces:[{NetworkInterfaceId:eniId,OwnerId:expected.accountId,VpcId:expected.vpcId,
  SubnetId:expected.subnetId,Groups:[{GroupId:expected.securityGroupId}],
  Attachment:{InstanceId:hostIdentity.instanceId,DeleteOnTermination:true,DeviceIndex:0}}],
}]}]});
const volume=(state='in-use')=>output({Volumes:[{VolumeId:rootVolumeId,State:state,OwnerId:expected.accountId,
 Encrypted:true,Tags:tags(),Attachments:[{InstanceId:hostIdentity.instanceId,VolumeId:rootVolumeId,
  Device:'/dev/xvda',DeleteOnTermination:true}]}]});
const eni=()=>output({NetworkInterfaces:[{NetworkInterfaceId:eniId,OwnerId:expected.accountId,
 VpcId:expected.vpcId,SubnetId:expected.subnetId,Groups:[{GroupId:expected.securityGroupId}],
 Attachment:{InstanceId:hostIdentity.instanceId,DeleteOnTermination:true}}]});
const ack=()=>output({TerminatingInstances:[{InstanceId:hostIdentity.instanceId,
 CurrentState:{Name:'shutting-down',Code:32}}]});
function fixture(overrides={}){
 let terminated=false;const calls=[];
 const ec2={scope:{accountId:expected.accountId,region:expected.region},
  async describeInstances(args){calls.push(['instance',args]);return terminated?instance('terminated'):instance();},
  async describeVolumes(args){calls.push(['volume',args]);return terminated?volume('deleted'):volume();},
  async describeNetworkInterfaces(args){calls.push(['eni',args]);return terminated?output({NetworkInterfaces:[]}):eni();},
  async terminateInstances(args){calls.push(['terminate',args]);terminated=true;return ack();},
  ...overrides};
 const host=createEc2PhysicalTeardownPort({allocation,binding,hostIdentity,expected,ec2,maxRounds:2,pollMs:1});
 return {calls,host,ec2};
}

test('one exact termination request is followed by independent raw reads; empty ENI result stays UNKNOWN',async()=>{
 const f=fixture(),resources=await f.host.destroy(request());
 assert.deepEqual(resources,{requested:true,instanceId:hostIdentity.instanceId,rootVolumeId,networkInterfaceIds:[eniId]});
 const observed=await f.host.observeAbsent({...request(),resources});
 assert.equal(observed.schema,HOST_PHYSICAL_ABSENCE_SCHEMA);
 assert.equal(observed.instanceState,'terminated');
 assert.equal(observed.rootVolumeAbsent,true);
 assert.equal(observed.networkInterfacesAbsent,false);
 assert.deepEqual(f.calls.map(c=>c[0]),['instance','volume','eni','terminate','instance','volume','eni','instance','volume','eni']);
 for(const [name,args] of f.calls){
  assert.deepEqual(args,name==='instance'||name==='terminate'?{InstanceIds:[hostIdentity.instanceId]}:
   name==='volume'?{VolumeIds:[rootVolumeId]}:{NetworkInterfaceIds:[eniId]});
 }
 assert.equal(await f.host.destroy(request()),resources,'one destroy attempt');
 assert.equal(await f.host.observeAbsent({...request(),resources}),observed,'one readback sequence');
});

test('foreign, incomplete, or contradictory pre-termination EC2 reads cannot authorize termination',async()=>{
 for(const change of [
  x=>{x.Reservations[0].OwnerId='000000000000';},
  x=>{x.Reservations[0].Instances[0].Tags[1].Value='foreign-host';},
  x=>{x.Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.DeleteOnTermination=false;},
  x=>{x.Reservations[0].Instances[0].NetworkInterfaces[0].Association={PublicIp:'1.2.3.4'};},
  x=>{x.Reservations.push(structuredClone(x.Reservations[0]));},
  x=>{delete x.$metadata;},
 ]){
  const wire=instance();change(wire);
  const f=fixture({async describeInstances(args){f.calls.push(['instance',args]);return wire;}});
  await assert.rejects(f.host.destroy(request()),e=>e.code==='HOST_PHYSICAL_UNKNOWN');
  assert.deepEqual(f.calls.map(c=>c[0]),['instance']);
 }
});

test('missing API methods, incorrect binding or scope, and an absent Describe read fail closed',async()=>{
 assert.throws(()=>createEc2PhysicalTeardownPort({allocation,binding,hostIdentity,expected,
  ec2:{scope:{accountId:expected.accountId,region:expected.region}}}),e=>e.code==='HOST_PHYSICAL_CONFIGURATION');
 assert.throws(()=>createEc2PhysicalTeardownPort({allocation,binding,hostIdentity,expected,
  ec2:{...fixture().ec2,scope:{accountId:expected.accountId,region:'eu-west-1'}}}),
  e=>e.code==='HOST_PHYSICAL_CONFIGURATION');
 const f=fixture();
 assert.throws(()=>f.host.destroy({...request(),binding:{...binding,tenantId:'another'}}),e=>e.code==='HOST_PHYSICAL_UNKNOWN');
 await assert.rejects(f.host.observeAbsent({...request(),resources:{instanceId:hostIdentity.instanceId,
  rootVolumeId,networkInterfaceIds:[eniId]}}),e=>e.code==='HOST_PHYSICAL_UNKNOWN');
 assert.deepEqual(f.calls,[]);
 const missing=fixture({async describeVolumes(args){missing.calls.push(['volume',args]);return undefined;}});
 await assert.rejects(missing.host.destroy(request()),e=>e.code==='HOST_PHYSICAL_UNKNOWN');
 assert.equal(missing.calls.some(c=>c[0]==='terminate'),false);
});

test('uncertain termination acknowledgement is sticky and cannot dispatch another termination',async()=>{
 const f=fixture({async terminateInstances(args){f.calls.push(['terminate',args]);return output({TerminatingInstances:[]});}});
 await assert.rejects(f.host.destroy(request()),e=>e.code==='HOST_PHYSICAL_UNKNOWN');
 await assert.rejects(f.host.destroy(request()),e=>e.code==='HOST_PHYSICAL_UNKNOWN');
 assert.equal(f.calls.filter(c=>c[0]==='terminate').length,1);
 await assert.rejects(f.host.observeAbsent({...request(),resources:{instanceId:hostIdentity.instanceId,
  rootVolumeId,networkInterfaceIds:[eniId]}}),e=>e.code==='HOST_PHYSICAL_UNKNOWN');
});

test('a Describe exception after termination is UNKNOWN forever, never a NotFound absence receipt',async()=>{
 const f=fixture({async describeVolumes(args){f.calls.push(['volume',args]);
  if(f.calls.some(c=>c[0]==='terminate'))throw Object.assign(new Error('not found'),{name:'InvalidVolume.NotFound'});
  return volume();}});
 const resources=await f.host.destroy(request());
 await assert.rejects(f.host.observeAbsent({...request(),resources}),e=>e.code==='HOST_PHYSICAL_UNKNOWN');
 await assert.rejects(f.host.observeAbsent({...request(),resources}),e=>e.code==='HOST_PHYSICAL_UNKNOWN');
 assert.equal(f.calls.filter(c=>c[0]==='volume').length,2);
});

test('an empty successful exact-ID volume list is still not positive physical absence',async()=>{
 const f=fixture({async describeVolumes(args){f.calls.push(['volume',args]);
  return f.calls.some(c=>c[0]==='terminate')?output({Volumes:[]}):volume();}});
 const resources=await f.host.destroy(request());
 const observed=await f.host.observeAbsent({...request(),resources});
 assert.equal(observed.instanceState,'terminated');
 assert.equal(observed.rootVolumeAbsent,false);
 assert.equal(observed.networkInterfacesAbsent,false);
});

test('a hung preflight read is bounded and cannot proceed to a termination request',async()=>{
 const f=fixture({async describeInstances(args){f.calls.push(['instance',args]);return new Promise(()=>{});}});
 const host=createEc2PhysicalTeardownPort({allocation,binding,hostIdentity,expected,ec2:f.ec2,operationMs:100,pollMs:1});
 await assert.rejects(host.destroy(request()),e=>e.code==='HOST_PHYSICAL_UNKNOWN');
 assert.deepEqual(f.calls.map(c=>c[0]),['instance']);
});
