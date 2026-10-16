import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeProductPreview} from './manifest.mjs';

const a='a'.repeat(64),b='b'.repeat(64);
function binding(){return {
 account:'967807252336',region:'us-east-1',enabled:false,materialDelivery:'unmounted',
 clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/meri-greenfield-product-preview',
 imageUri:`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/product-runtime@sha256:${a}`,
 logGroupName:'/meri-greenfield/product-preview/runtime',
 executionRoleArn:'arn:aws:iam::967807252336:role/MeriGreenfield-ProductPreview-Execution',
 controlTaskRoleArn:'arn:aws:iam::967807252336:role/MeriGreenfield-ProductPreview-Control',
 runtimeUser:'1000:1000',runnerSha256:b,
 network:{privateSubnetId:'subnet-1234abcd',controlSecurityGroupId:'sg-1234abcd',workerSecurityGroupId:'sg-5678abcd',runnerSecurityGroupIds:['sg-abcd1234']},
 sizing:{control:{cpu:512,memoryMiB:1024,ephemeralStorageGiB:21},temporalWorker:{cpu:512,memoryMiB:1024,ephemeralStorageGiB:21},runner:{cpu:1024,memoryMiB:2048,ephemeralStorageGiB:50}}
};}
const byType=(template,type)=>Object.values(template.Resources).filter(r=>r.Type===type).map(r=>r.Properties);
const byFamily=(tasks,family)=>tasks.find(t=>t.Family===`meri-product-preview-${family}`);

test('offline source has only two stopped services and three immutable role tasks',()=>{
 const input=binding(),template=synthesizeProductPreview(input),types=Object.values(template.Resources).map(r=>r.Type).sort();
 assert.deepEqual(types,[...Array(2).fill('AWS::ECS::Service'),...Array(3).fill('AWS::ECS::TaskDefinition')].sort());
 const tasks=byType(template,'AWS::ECS::TaskDefinition'),services=byType(template,'AWS::ECS::Service');
 assert.equal(tasks.length,3);assert.equal(services.length,2);
 for(const [role,port,config] of [['control',8080,'control.json'],['temporal-worker',8081,'worker.json'],['runner',8080,'task.json']]){
  const task=byFamily(tasks,role),[container]=task.ContainerDefinitions;
  assert.deepEqual(container.EntryPoint,['node','apps/runtime/cli.mjs']);
  assert.deepEqual(container.Command,[role==='runner'?'conversation-runner':role,'--config',`/run/meri/${config}`]);
  assert.equal(task.ExecutionRoleArn,input.executionRoleArn);assert.equal(task.NetworkMode,'awsvpc');
  assert.deepEqual(task.RequiresCompatibilities,['FARGATE']);
  assert.equal(task.RuntimePlatform.OperatingSystemFamily,'LINUX');
  assert.equal(task.ContainerDefinitions.length,1);assert.equal(container.User,'1000:1000');
  assert.equal(container.ReadonlyRootFilesystem,true);assert.equal(container.Privileged,false);
  assert.deepEqual(container.LinuxParameters.Capabilities.Drop,['ALL']);
  assert.equal(container.Image,input.imageUri);assert.equal(container.PortMappings[0].ContainerPort,port);
  assert.equal(container.Secrets,undefined);
 }
 assert.equal(byFamily(tasks,'control').TaskRoleArn,input.controlTaskRoleArn);
 assert.equal(byFamily(tasks,'temporal-worker').TaskRoleArn,undefined);
 assert.equal(byFamily(tasks,'runner').TaskRoleArn,undefined);
 assert.equal(byFamily(tasks,'runner').ContainerDefinitions[0].Name,'worker','matches nativeCandidate taskRequest containerName');
 assert.deepEqual(byFamily(tasks,'runner').ContainerDefinitions[0].Environment,[{Name:'MERI_RUNNER_SHA256',Value:b}]);
 assert.equal(template.Outputs.RunnerClusterArn.Value,input.clusterArn);
 assert.equal(template.Outputs.RunnerPrivateSubnetId.Value,input.network.privateSubnetId);
 assert.equal(template.Outputs.RunnerSecurityGroupIds.Value,input.network.runnerSecurityGroupIds.join(','));
 for(const service of services){
  assert.equal(service.DesiredCount,0);assert.equal(service.EnableExecuteCommand,false);
  assert.equal(service.Cluster,input.clusterArn);assert.equal(service.NetworkConfiguration.AwsvpcConfiguration.AssignPublicIp,'DISABLED');
  assert.deepEqual(service.NetworkConfiguration.AwsvpcConfiguration.Subnets,[input.network.privateSubnetId]);
  assert.equal(service.LoadBalancers,undefined);
 }
 assert(!services.some(s=>s.ServiceName.includes('runner')));
});

test('two distinct reviewed control target groups attach only to stopped control port 8080',()=>{
 const input=binding();input.controlTargetGroupArn='arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-product-preview/1234567890abcdef';
 input.controlPrivateTargetGroupArn='arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-private/abcdef0123456789';
 const services=byType(synthesizeProductPreview(input),'AWS::ECS::Service'),control=services.find(s=>s.ServiceName==='meri-product-preview-control');
 assert.deepEqual(control.LoadBalancers,[
  {ContainerName:'control',ContainerPort:8080,TargetGroupArn:input.controlTargetGroupArn},
  {ContainerName:'control',ContainerPort:8080,TargetGroupArn:input.controlPrivateTargetGroupArn}
 ]);
 assert.equal(control.DesiredCount,0);
 assert.equal(services.find(s=>s.ServiceName==='meri-product-preview-temporal-worker').LoadBalancers,undefined);
});

test('missing inventory, foreign refs, runnable state and claimed material delivery refuse',()=>{
 const variants=[
  x=>{delete x.clusterArn;},
  x=>{x.region='us-west-2';},
  x=>{x.imageUri=x.imageUri.replace('967807252336.dkr','000000000000.dkr');},
  x=>{x.imageUri=x.imageUri.replace('@sha256:'+a,':latest');},
  x=>{x.clusterArn='arn:aws:ecs:us-east-1:000000000000:cluster/foreign';},
  x=>{x.clusterArn='arn:aws:ecs:us-east-1:967807252336:service/not-a-cluster';},
  x=>{x.imageUri=`967807252336.dkr.ecr.us-west-2.amazonaws.com/meri-greenfield/runtime@sha256:${a}`;},
  x=>{x.logGroupName='not-an-absolute-log-group';},
  x=>{x.executionRoleArn='arn:aws:iam::000000000000:role/foreign';},
  x=>{x.controlTaskRoleArn='arn:aws:iam::000000000000:role/foreign';},
  x=>{x.enabled=true;},
  x=>{x.materialDelivery='ready';},
  x=>{x.network.runnerSecurityGroupIds=[];},
  x=>{x.network.privateSubnetId='subnet-foreign';},
  x=>{x.controlTargetGroupArn='arn:aws:elasticloadbalancing:us-west-2:967807252336:targetgroup/meri-product-preview/1234567890abcdef';},
  x=>{x.controlTargetGroupArn='arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/foreign/1234567890abcdef';},
  x=>{x.controlPrivateTargetGroupArn='arn:aws:elasticloadbalancing:us-west-2:967807252336:targetgroup/foreign/1234567890abcdef';},
  x=>{x.controlTargetGroupArn='arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview/1234567890abcdef';x.controlPrivateTargetGroupArn=x.controlTargetGroupArn;}
 ];
 for(const change of variants){const x=binding();change(x);assert.throws(()=>synthesizeProductPreview(x),/PRODUCT_PREVIEW_BINDING_REFUSED/);}
});
