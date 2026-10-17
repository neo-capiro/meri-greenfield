import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeModelProxyTemplate} from './model-proxy-template.mjs';
import {binding} from './model-proxy-test-fixture.mjs';

const ofType=(template,type)=>Object.entries(template.Resources).filter(([,value])=>value.Type===type);

test('template is enabled, creates only task definitions, zero-count services and role policies',()=>{
 const b=binding(),template=synthesizeModelProxyTemplate(b),resources=template.Resources;
 assert.equal(template.Conditions,undefined);
 for(const value of Object.values(resources))assert.equal(value.Condition,undefined);
 assert.deepEqual([...new Set(Object.values(resources).map(value=>value.Type))].sort(),
  ['AWS::ECS::Service','AWS::ECS::TaskDefinition','AWS::IAM::ManagedPolicy']);
 const text=JSON.stringify(template);
 for(const absent of ['ElasticLoadBalancingV2','AWS::EC2::','AWS::Logs::','AWS::ServiceDiscovery::','AWS::IAM::Role','GetInferenceProfile','Fn::Equals'])
  assert.equal(text.includes(absent),false,absent);
 for(const [name,service] of ofType(template,'AWS::ECS::Service')){
  const p=service.Properties;
  assert.equal(p.DesiredCount,0,name);assert.equal(p.LaunchType,'FARGATE');assert.equal(p.PlatformVersion,'1.4.0');
  assert.equal(p.EnableExecuteCommand,false);assert.equal(p.LoadBalancers,undefined);
  assert.equal(p.Cluster,'arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev');
  assert.equal(p.NetworkConfiguration.AwsvpcConfiguration.AssignPublicIp,'DISABLED');
  assert.deepEqual(p.NetworkConfiguration.AwsvpcConfiguration.Subnets,b.placement.privateSubnetIds);
  assert.equal(p.ServiceRegistries.length,1);
 }
 const proxy=resources.ModelProxyService.Properties,owner=resources.ModelOwnerService.Properties;
 assert.equal(proxy.ServiceName,'meri-product-preview-proxy');assert.equal(owner.ServiceName,'meri-product-preview-owner');
 assert.deepEqual(proxy.ServiceRegistries,[{RegistryArn:b.serviceDiscovery.proxyRegistryArn}]);
 assert.deepEqual(owner.ServiceRegistries,[{RegistryArn:b.serviceDiscovery.ownerRegistryArn}]);
 assert.deepEqual(proxy.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[b.network.proxySecurityGroupId]);
 assert.deepEqual(owner.NetworkConfiguration.AwsvpcConfiguration.SecurityGroups,[b.network.ownerSecurityGroupId,b.network.dbClientSecurityGroupId]);
 assert.deepEqual(proxy.TaskDefinition,{Ref:'ModelProxyTask'});
 assert.deepEqual(Object.keys(template.Outputs).sort(),['ModelOwnerOrigin','ModelOwnerServiceArn','ModelOwnerTaskDefinitionArn',
  'ModelProxyOrigin','ModelProxyServiceArn','ModelProxyTaskDefinitionArn']);
 assert.equal(template.Outputs.ModelProxyOrigin.Value,'https://proxy.meri.internal:8443');
});

test('task definitions gate the app on material-init SUCCESS with read-only material and exact users',()=>{
 const b=binding(),resources=synthesizeModelProxyTemplate(b).Resources;
 const cases=[['ModelProxyTask','model-proxy','10001:10001',8443,b.images.proxy.uri,b.material.proxy,'/meri/product-preview/proxy'],
  ['ModelOwnerTask','model-owner','1000:1000',8444,b.images.nodeRuntime.uri,b.material.owner,'/meri/product-preview/owner']];
 for(const [name,container,user,port,image,material,logGroup] of cases){
  const t=resources[name].Properties,[init,main]=t.ContainerDefinitions;
  assert.equal(t.Cpu,'512');assert.equal(t.Memory,'1024');assert.equal(t.NetworkMode,'awsvpc');
  assert.deepEqual(t.Volumes,[{Name:'material'},{Name:'tmp'}]);
  assert.equal(t.ContainerDefinitions.length,2);
  assert.equal(init.Name,'material-init');assert.equal(init.Essential,false);
  // model-proxy: root init keeping only CHOWN, so it can hand the files to 10001; model-owner: same user, all dropped.
  if(container==='model-proxy'){assert.equal(init.User,'0:0');assert.ok(!init.LinuxParameters.Capabilities.Drop.includes('CHOWN'));
   assert.ok(['DAC_OVERRIDE','SETUID','SETGID','FOWNER'].every(c=>init.LinuxParameters.Capabilities.Drop.includes(c)));}
  else{assert.equal(init.User,user);assert.deepEqual(init.LinuxParameters,{Capabilities:{Drop:['ALL']}});}
  assert.equal(init.Image,b.images.nodeRuntime.uri);
  assert.deepEqual(init.EntryPoint,['node','apps/runtime/material-init-cli.mjs']);assert.deepEqual(init.Command,['write']);
  assert.deepEqual(JSON.parse(init.Environment[0].Value),material.expected);
  assert.deepEqual(init.Secrets,[{Name:'MERI_STATIC_MATERIAL_BUNDLE',ValueFrom:material.valueFrom}]);
  assert.deepEqual(init.MountPoints,[{SourceVolume:'material',ContainerPath:'/run/meri',ReadOnly:false}]);
  assert.equal(main.Name,container);assert.equal(main.Essential,true);assert.equal(main.User,user);assert.equal(main.Image,image);
  assert.equal(main.ReadonlyRootFilesystem,true);assert.equal(main.Privileged,false);
  assert.deepEqual(main.LinuxParameters,{Capabilities:{Drop:['ALL']}});
  assert.deepEqual(main.PortMappings,[{ContainerPort:port,Protocol:'tcp'}]);
  assert.deepEqual(main.DependsOn,[{ContainerName:'material-init',Condition:'SUCCESS'}]);
  assert.deepEqual(main.MountPoints[0],{SourceVolume:'material',ContainerPath:'/run/meri',ReadOnly:true});
  assert.equal(main.Secrets,undefined,'no secret reaches the app container');
  assert.equal(main.LogConfiguration.Options['awslogs-group'],logGroup);
 }
 const proxy=resources.ModelProxyTask.Properties.ContainerDefinitions[1],owner=resources.ModelOwnerTask.Properties.ContainerDefinitions[1];
 assert.equal(proxy.EntryPoint,undefined,'the proxy image ENTRYPOINT runs apps.proxy.product.main');
 assert.deepEqual(proxy.Command,['--config','/run/meri/proxy.json','--config-sha256',b.startup.proxyConfigSha256]);
 assert.deepEqual(proxy.Environment,[{Name:'MERI_PRODUCT_PROXY_REQUIRED',Value:'1'}]);
 assert.deepEqual(owner.EntryPoint,['node','apps/proxy/product/owner-entrypoint.mjs']);
 assert.deepEqual(owner.Command,['--config','/run/meri/owner.json']);
 assert.deepEqual(owner.Environment,[{Name:'MERI_PRODUCT_OWNER_REQUIRED',Value:'1'},
  {Name:'MERI_PRODUCT_OWNER_CONFIG_SHA256',Value:b.startup.ownerConfigSha256}]);
});

test('policies: Bedrock on the proxy only, scoped ECS/EC2 observer reads on both, secrets via execution roles',()=>{
 const b=binding(),r=synthesizeModelProxyTemplate(b).Resources;
 const statements=name=>r[name].Properties.PolicyDocument.Statement;
 assert.deepEqual(r.ModelProxyProviderPolicy.Properties.Roles,['meri-preview-proxy-task']);
 assert.deepEqual(r.ModelOwnerObserverPolicy.Properties.Roles,['meri-preview-owner-task']);
 assert.deepEqual(r.ModelProxyExecutionPolicy.Properties.Roles,['meri-preview-proxy-exec']);
 assert.deepEqual(r.ModelOwnerExecutionPolicy.Properties.Roles,['meri-preview-owner-exec']);
 const proxy=statements('ModelProxyProviderPolicy'),owner=statements('ModelOwnerObserverPolicy');
 const actions=list=>list.flatMap(s=>[s.Action].flat());
 assert(actions(proxy).includes('bedrock:InvokeModelWithResponseStream'));
 assert.equal(actions(owner).some(a=>a.startsWith('bedrock:')),false);
 assert.equal(proxy[0].Resource,'arn:aws:bedrock:us-east-1:967807252336:inference-profile/us.anthropic.claude-sonnet-4-6');
 assert.deepEqual(proxy[2],{Effect:'Allow',Action:'bedrock:CountTokens',Resource:'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6'});
 for(const list of [proxy,owner]){
  const observer=list.filter(s=>[s.Action].flat().some(a=>a.startsWith('ecs:')||a.startsWith('ec2:')));
  assert.deepEqual(observer,[
   {Effect:'Allow',Action:'ecs:DescribeServices',Resource:[
    'arn:aws:ecs:us-east-1:967807252336:service/capiro-dev/meri-product-preview-proxy',
    'arn:aws:ecs:us-east-1:967807252336:service/capiro-dev/meri-product-preview-owner']},
   {Effect:'Allow',Action:'ecs:DescribeTasks',Resource:'arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/*'},
   {Effect:'Allow',Action:'ecs:ListTasks',Resource:'*',Condition:{ArnEquals:{'ecs:cluster':'arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev'}}},
   {Effect:'Allow',Action:['ecs:DescribeTaskDefinition','ec2:DescribeNetworkInterfaces'],Resource:'*'}]);
  assert.equal(actions(list).some(a=>a.startsWith('secretsmanager:')),false);
 }
 for(const [name,material,group] of [['ModelProxyExecutionPolicy',b.material.proxy,'/meri/product-preview/proxy'],['ModelOwnerExecutionPolicy',b.material.owner,'/meri/product-preview/owner']]){
  const s=statements(name);
  assert.deepEqual(s[1].Resource,['arn:aws:ecr:us-east-1:967807252336:repository/meri-greenfield/qualification-worker']);
  assert.equal(s[2].Resource,`arn:aws:logs:us-east-1:967807252336:log-group:${group}:*`);
  assert.deepEqual(s[3],{Effect:'Allow',Action:'secretsmanager:GetSecretValue',Resource:material.valueFrom.slice(0,material.valueFrom.lastIndexOf(':::'))});
 }
});

test('metadata lists foundation-owned SG rules; a refused binding synthesizes nothing',()=>{
 const t=synthesizeModelProxyTemplate(binding());
 assert(t.Metadata.FoundationOwnedSecurityGroupRules.egress.some(r=>r.cidrIp==='0.0.0.0/0'&&r.port===443));
 assert.deepEqual(t.Metadata.BedrockPath,{kind:'nat',port:443});
 const wrong=binding();wrong.images.proxy.upstreamDigest='sha256:'+'0'.repeat(64);
 assert.throws(()=>synthesizeModelProxyTemplate(wrong),/PRODUCT_MODEL_PROXY_BINDING_REFUSED/);
 const user=binding();user.material.proxy.expected.runtimeUser='1000:1000';
 assert.throws(()=>synthesizeModelProxyTemplate(user),/PRODUCT_MODEL_PROXY_BINDING_REFUSED/);
});
