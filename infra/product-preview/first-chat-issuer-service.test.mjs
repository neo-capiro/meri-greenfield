import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {synthesizeFirstChatIssuerServiceTemplate,validateFirstChatIssuerBinding} from './first-chat-issuer-service.mjs';

/** capiro-dev network, roles, log group, secret name and Cloud Map service are the live foundation outputs;
 * the image digest, source commit, secret version and file hashes are synthetic. */
const sha=text=>createHash('sha256').update(text).digest('hex');
const ecr='967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker';
const imageDigest='6617b23650cc8cce973beac90c13f7c8231ccf3fbab4d4b4c44b26aea35c180c';
const sourceCommit='f69cc7a93f1b0a64cbd3bdd6b6e1879936021c3a';
const secretArn='arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/issuer/material-MYhacb';
const versionId='3b0f2c6e-5d1a-4f8e-9c7b-2a6d4e8f1b03';
const seal=value=>{const {materialContractSha256:_,...contract}=value;return {...contract,materialContractSha256:canonicalSha256(contract)};};
function binding(){
 const configSha256=sha('synthetic issuer.json');
 const files={'/run/meri/issuer.json':configSha256,'/run/meri/issuer-database.uri':sha('db'),'/run/meri/issuer-server.key':sha('key'),
  '/run/meri/issuer-server.crt':sha('crt'),'/run/meri/issuer-client-ca.pem':sha('ca'),'/run/meri/issuer-client-ca.key':sha('ca-key')};
 return {schema:'meri.product-preview.temporal-issuer/1',account:'967807252336',region:'us-east-1',
  placement:{clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev',vpcId:'vpc-0ac26cfac7ed972be',
   privateSubnetIds:['subnet-0920665f91c905f01','subnet-0e38bd390f8961fef','subnet-06db79cd21239de19']},
  image:{uri:`${ecr}@sha256:${imageDigest}`,sourceCommit},
  roles:{executionRoleArn:'arn:aws:iam::967807252336:role/MeriPreview-issuer-execution',
   taskRoleArn:'arn:aws:iam::967807252336:role/MeriPreview-issuer-task'},
  logGroupName:'/meri/product-preview/issuer',
  serviceDiscovery:{issuerRegistryArn:'arn:aws:servicediscovery:us-east-1:967807252336:service/srv-v7ppowfuwb7ub6me'},
  network:{issuerSecurityGroupId:'sg-06fdc7ce3a117a478',dbClientSecurityGroupId:'sg-0d5b5286baf28242e'},
  material:{valueFrom:`${secretArn}:::${versionId}`,expected:seal({schemaVersion:1,role:'temporal-issuer',runtimeUser:'1000:1000',
   sourceCommit,imageDigest:`sha256:${imageDigest}`,sha256ByPath:files})},
  startup:{configSha256},desiredCount:0};
}
const refused=/FIRST_CHAT_ISSUER_BINDING_REFUSED/;

test('one task definition and one private, Cloud Map registered service; nothing else',()=>{
 const b=binding(),t=synthesizeFirstChatIssuerServiceTemplate(b);
 assert.deepEqual(Object.keys(t.Resources),['TemporalIssuerTask','TemporalIssuerService']);
 const text=JSON.stringify(t);
 for(const absent of ['AWS::IAM::','AWS::EC2::','AWS::Logs::','AWS::ServiceDiscovery::','AWS::KMS::','ElasticLoadBalancingV2','LoadBalancers','HealthCheck'])
  assert.equal(text.includes(absent),false,absent);
 const s=t.Resources.TemporalIssuerService.Properties;
 assert.equal(s.ServiceName,'meri-product-preview-temporal-issuer');
 assert.equal(s.Cluster,'arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev');
 assert.deepEqual(s.TaskDefinition,{Ref:'TemporalIssuerTask'});
 assert.equal(s.DesiredCount,0);assert.equal(s.LaunchType,'FARGATE');assert.equal(s.PlatformVersion,'1.4.0');
 assert.equal(s.EnableExecuteCommand,false);
 assert.deepEqual(s.NetworkConfiguration,{AwsvpcConfiguration:{AssignPublicIp:'DISABLED',
  Subnets:['subnet-0920665f91c905f01','subnet-0e38bd390f8961fef','subnet-06db79cd21239de19'],
  SecurityGroups:['sg-06fdc7ce3a117a478','sg-0d5b5286baf28242e']}});
 assert.deepEqual(s.ServiceRegistries,[{RegistryArn:'arn:aws:servicediscovery:us-east-1:967807252336:service/srv-v7ppowfuwb7ub6me'}]);
 assert.deepEqual(t.Outputs.TemporalIssuerOrigin,{Value:'https://issuer.meri.internal:8445'});
 assert.equal(t.Metadata.ServiceArn,'arn:aws:ecs:us-east-1:967807252336:service/capiro-dev/meri-product-preview-temporal-issuer');
 const one={...binding(),desiredCount:1};
 assert.equal(synthesizeFirstChatIssuerServiceTemplate(one).Resources.TemporalIssuerService.Properties.DesiredCount,1);
});

test('task definition: Fargate x86_64 0.25 vCPU / 0.5 GiB, issuer roles, material-init SUCCESS gate',()=>{
 const b=binding(),t=synthesizeFirstChatIssuerServiceTemplate(b).Resources.TemporalIssuerTask.Properties;
 assert.equal(t.Family,'meri-product-preview-temporal-issuer');
 assert.deepEqual(t.RequiresCompatibilities,['FARGATE']);assert.equal(t.NetworkMode,'awsvpc');
 assert.equal(t.Cpu,'256');assert.equal(t.Memory,'512');
 assert.deepEqual(t.RuntimePlatform,{CpuArchitecture:'X86_64',OperatingSystemFamily:'LINUX'});
 assert.equal(t.ExecutionRoleArn,b.roles.executionRoleArn);assert.equal(t.TaskRoleArn,b.roles.taskRoleArn);
 assert.deepEqual(t.Volumes,[{Name:'material'},{Name:'tmp'}]);
 assert.equal(t.ContainerDefinitions.length,2);
 const [init,main]=t.ContainerDefinitions;

 assert.equal(init.Name,'material-init');assert.equal(init.Essential,false);assert.equal(init.Image,b.image.uri);
 assert.equal(init.User,'1000:1000');assert.equal(init.Privileged,false);assert.equal(init.ReadonlyRootFilesystem,true);
 assert.deepEqual(init.LinuxParameters,{Capabilities:{Drop:['ALL']}});
 assert.deepEqual(init.EntryPoint,['node','apps/runtime/material-init-cli.mjs']);assert.deepEqual(init.Command,['write']);
 assert.deepEqual(init.Environment.map(e=>e.Name),['MERI_STATIC_MATERIAL_EXPECTED']);
 assert.deepEqual(JSON.parse(init.Environment[0].Value),b.material.expected);
 assert.equal(JSON.parse(init.Environment[0].Value).role,'temporal-issuer');
 assert.deepEqual(init.Secrets,[{Name:'MERI_STATIC_MATERIAL_BUNDLE',ValueFrom:`${secretArn}:::${versionId}`}]);
 assert.deepEqual(init.MountPoints,[{SourceVolume:'material',ContainerPath:'/run/meri',ReadOnly:false}]);
 assert.equal(init.LogConfiguration.Options['awslogs-group'],'/meri/product-preview/issuer');

 assert.equal(main.Name,'temporal-issuer');assert.equal(main.Essential,true);assert.equal(main.Image,b.image.uri);
 assert.equal(main.User,'1000:1000');assert.equal(main.Privileged,false);assert.equal(main.ReadonlyRootFilesystem,true);
 assert.deepEqual(main.LinuxParameters,{Capabilities:{Drop:['ALL']}});
 assert.deepEqual(main.DependsOn,[{ContainerName:'material-init',Condition:'SUCCESS'}]);
 assert.deepEqual(main.EntryPoint,['node','apps/runtime/temporal-issuer-cli.mjs']);
 assert.deepEqual(main.Command,['--config','/run/meri/issuer.json','--config-sha256',b.startup.configSha256]);
 assert.deepEqual(main.Environment,[{Name:'MERI_TEMPORAL_ISSUER_REQUIRED',Value:'1'}]);
 assert.equal(main.Secrets,undefined,'no secret reaches the issuer container');
 assert.equal(JSON.stringify(main).includes('secretsmanager'),false);
 assert.equal(main.HealthCheck,undefined,'the issuer serves no health route');
 assert.deepEqual(main.PortMappings,[{ContainerPort:8445,Protocol:'tcp'}]);
 assert.deepEqual(main.MountPoints,[{SourceVolume:'material',ContainerPath:'/run/meri',ReadOnly:true},
  {SourceVolume:'tmp',ContainerPath:'/tmp',ReadOnly:false}]);
 assert.deepEqual(main.LogConfiguration,{LogDriver:'awslogs',Options:{'awslogs-group':'/meri/product-preview/issuer',
  'awslogs-region':'us-east-1','awslogs-stream-prefix':'temporal-issuer','mode':'blocking'}});
});

test('the CLI argv the template renders is the argv temporal-issuer-cli.mjs admits',async()=>{
 const {main}=await import('../../apps/runtime/temporal-issuer-cli.mjs');
 const b=binding(),c=synthesizeFirstChatIssuerServiceTemplate(b).Resources.TemporalIssuerTask.Properties.ContainerDefinitions[1];
 const environment=Object.fromEntries(c.Environment.map(e=>[e.Name,e.Value])),seen=[];
 const readMaterial=async path=>{seen.push(path);throw Error('stop at the first file read');};
 // A config read is attempted only after argv and the required flag were admitted; it targets the pinned path.
 assert.equal(await main(c.Command,{environment,testOwners:{readMaterial}}),2);
 assert.deepEqual(seen,['/run/meri/issuer.json']);
 assert.equal(await main(c.Command,{environment:{},testOwners:{readMaterial}}),2);
 assert.equal(seen.length,1,'without MERI_TEMPORAL_ISSUER_REQUIRED=1 the CLI refuses before any read');
 assert.equal(await main([...c.Command,'--extra'],{environment,testOwners:{readMaterial}}),2);
 assert.equal(seen.length,1,'any other argv shape is refused before any read');
});

test('validated binding is a frozen copy; the input is not retained',()=>{
 const b=binding(),v=validateFirstChatIssuerBinding(b);
 assert.ok(Object.isFrozen(v)&&Object.isFrozen(v.material.expected.sha256ByPath));
 b.image.uri='mutated';assert.notEqual(v.image.uri,'mutated');
});

test('refuses foreign accounts, clusters, images, roles, secrets and mismatched material pins',()=>{
 const cases={
  'foreign account':b=>{b.account='111111111111';},
  'foreign region':b=>{b.region='us-west-2';},
  'unknown schema':b=>{b.schema='meri.product-preview.temporal-issuer/2';},
  'extra key':b=>{b.extra=true;},
  'missing key':b=>{delete b.startup;},
  'other cluster':b=>{b.placement.clusterArn='arn:aws:ecs:us-east-1:967807252336:cluster/capiro-prod';},
  'foreign-account cluster':b=>{b.placement.clusterArn='arn:aws:ecs:us-east-1:111111111111:cluster/capiro-dev';},
  'other VPC':b=>{b.placement.vpcId='vpc-0123456789abcdef0';},
  'foreign subnet':b=>{b.placement.privateSubnetIds=['subnet-0123456789abcdef0'];},
  'duplicate subnet':b=>{b.placement.privateSubnetIds=['subnet-0920665f91c905f01','subnet-0920665f91c905f01'];},
  'no subnet':b=>{b.placement.privateSubnetIds=[];},
  'tag image':b=>{b.image.uri=`${ecr}:latest`;},
  'foreign registry image':b=>{b.image.uri=`111111111111.dkr.ecr.us-east-1.amazonaws.com/x@sha256:${imageDigest}`;},
  'short commit':b=>{b.image.sourceCommit='f69cc7a9';},
  'proxy execution role':b=>{b.roles.executionRoleArn='arn:aws:iam::967807252336:role/MeriPreview-proxy-execution';},
  'control task role':b=>{b.roles.taskRoleArn='arn:aws:iam::967807252336:role/MeriPreview-control-task';},
  'swapped roles':b=>{[b.roles.executionRoleArn,b.roles.taskRoleArn]=[b.roles.taskRoleArn,b.roles.executionRoleArn];},
  'foreign-account role':b=>{b.roles.taskRoleArn='arn:aws:iam::111111111111:role/MeriPreview-issuer-task';},
  'other log group':b=>{b.logGroupName='/meri/product-preview/control';},
  'foreign registry':b=>{b.serviceDiscovery.issuerRegistryArn='arn:aws:servicediscovery:us-east-1:111111111111:service/srv-v7ppowfuwb7ub6me';},
  'same SG twice':b=>{b.network.dbClientSecurityGroupId=b.network.issuerSecurityGroupId;},
  'Aurora SG on the issuer':b=>{b.network.issuerSecurityGroupId='sg-059b4e4de0b1dcca5';},
  'issuer-client marker SG on the issuer':b=>{b.network.dbClientSecurityGroupId='sg-0c3da023e9e8fb292';},
  'unversioned secret':b=>{b.material.valueFrom=secretArn;},
  'stage-only secret':b=>{b.material.valueFrom=`${secretArn}::AWSCURRENT:`;},
  'JSON-key secret':b=>{b.material.valueFrom=`${secretArn}:password::${versionId}`;},
  'control material secret':b=>{b.material.valueFrom=`arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/control/material-OhIfMV:::${versionId}`;},
  'foreign-account secret':b=>{b.material.valueFrom=`arn:aws:secretsmanager:us-east-1:111111111111:secret:meri/preview/issuer/material-MYhacb:::${versionId}`;},
  'desired count 2':b=>{b.desiredCount=2;},
  'desired count string':b=>{b.desiredCount='1';},
  'config pin not hex':b=>{b.startup.configSha256='Z'.repeat(64);},
  'expected image digest differs':b=>{b.material.expected=seal({...b.material.expected,imageDigest:`sha256:${'0'.repeat(64)}`});},
  'expected source commit differs':b=>{b.material.expected=seal({...b.material.expected,sourceCommit:'a'.repeat(40)});},
  'expected role control':b=>{b.material.expected=seal({...b.material.expected,role:'control',
   sha256ByPath:{...b.material.expected.sha256ByPath,'/run/meri/control.json':b.startup.configSha256}});},
  'expected runtime user':b=>{b.material.expected=seal({...b.material.expected,runtimeUser:'10001:10001'});},
  'issuer.json hash differs from --config-sha256':b=>{b.startup.configSha256=sha('other config');},
  'issuer.json missing':b=>{const {['/run/meri/issuer.json']:_,...rest}=b.material.expected.sha256ByPath;
   b.material.expected=seal({...b.material.expected,sha256ByPath:rest});},
  'unsealed expected':b=>{b.material.expected.sha256ByPath['/run/meri/issuer-server.key']=sha('changed');},
 };
 for(const [name,mutate] of Object.entries(cases)){
  const b=binding();mutate(b);
  assert.throws(()=>synthesizeFirstChatIssuerServiceTemplate(b),refused,name);
 }
 assert.throws(()=>synthesizeFirstChatIssuerServiceTemplate(null),refused);
 assert.throws(()=>synthesizeFirstChatIssuerServiceTemplate(Object.assign(Object.create({}),binding())),refused);
});
