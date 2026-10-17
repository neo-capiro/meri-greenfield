/** CloudFormation for the private product model proxy and its canonical budget
 * owner, both as ECS services at desired count 0 (approved change set Stage 3).
 * Every resource is unconditional; creating the stack starts no task.
 *
 * Consumed, never created here (foundation stack outputs): security groups and
 * their rules, IAM roles, log groups and the Cloud Map `meri.internal` services.
 * Created here: the two task definitions, the two services and the managed
 * policies attached to the supplied roles.
 * This module performs no AWS lookup, credential read or deployment.
 */
import {planPrivateModelProxy,repositoryArn} from './model-proxy-plan.mjs';

const REGION='us-east-1',ACCOUNT='967807252336';
const ref=name=>({'Ref':name});
const resource=(type,properties,dependsOn)=>({Type:type,Properties:properties,...(dependsOn?{DependsOn:dependsOn}:{})});
const roleName=arn=>arn.slice(arn.lastIndexOf('/')+1);
const secretArn=valueFrom=>valueFrom.slice(0,valueFrom.lastIndexOf(':::'));
const logGroupArn=name=>`arn:aws:logs:${REGION}:${ACCOUNT}:log-group:${name}:*`;
const dropAll={Capabilities:{Drop:['ALL']}};
const logging=(group,prefix)=>({LogDriver:'awslogs',Options:{'awslogs-group':group,'awslogs-region':REGION,
 'awslogs-stream-prefix':prefix,'mode':'blocking'}});

function observerStatements(o){
 return [
  {Effect:'Allow',Action:'ecs:DescribeServices',Resource:o.describeServices},
  {Effect:'Allow',Action:'ecs:DescribeTasks',Resource:o.describeTasks},
  {Effect:'Allow',Action:'ecs:ListTasks',Resource:o.listTasks.resource,Condition:o.listTasks.condition},
  {Effect:'Allow',Action:o.unscoped,Resource:'*'}];
}
function executionPolicy(service,images){
 const repositories=[...new Set(images.map(repositoryArn))];
 return {Version:'2012-10-17',Statement:[
  {Effect:'Allow',Action:'ecr:GetAuthorizationToken',Resource:'*'},
  {Effect:'Allow',Action:['ecr:BatchCheckLayerAvailability','ecr:GetDownloadUrlForLayer','ecr:BatchGetImage'],Resource:repositories},
  {Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:logGroupArn(service.logGroupName)},
  // Material reaches only the init container through ECS secret injection.
  {Effect:'Allow',Action:'secretsmanager:GetSecretValue',Resource:secretArn(service.material.valueFrom)}]};
}
/** Same init shape as manifest.mjs: one-shot writer, SUCCESS gate, read-only main mount. */
// The model-proxy app runs as 10001 on a volume Fargate creates root-owned, so its init runs as root and keeps
// only CHOWN to hand the written files to 10001 (material-init.mjs model-proxy role); every other init drops all.
const chownOnly={Capabilities:{Drop:['AUDIT_WRITE','DAC_OVERRIDE','FOWNER','FSETID','KILL','MKNOD','NET_BIND_SERVICE','NET_RAW','SETFCAP','SETGID','SETPCAP','SETUID','SYS_CHROOT']}};
function materialInit(service){
 const proxy=service.material.expected.role==='model-proxy';
 return {Name:'material-init',Image:service.initImage,Essential:false,User:proxy?'0:0':service.runtimeUser,Privileged:false,ReadonlyRootFilesystem:true,
  EntryPoint:['node','apps/runtime/material-init-cli.mjs'],Command:['write'],LinuxParameters:proxy?chownOnly:dropAll,
  Environment:[{Name:'MERI_STATIC_MATERIAL_EXPECTED',Value:JSON.stringify(service.material.expected)}],
  Secrets:[{Name:'MERI_STATIC_MATERIAL_BUNDLE',ValueFrom:service.material.valueFrom}],
  MountPoints:[{SourceVolume:'material',ContainerPath:'/run/meri',ReadOnly:false}],
  LogConfiguration:logging(service.logGroupName,`${service.serviceName}-init`)};
}
function taskDefinition(plan,service,main){
 const size=plan.placement.sizing;
 return resource('AWS::ECS::TaskDefinition',{
  Family:service.family,RequiresCompatibilities:['FARGATE'],NetworkMode:'awsvpc',
  Cpu:String(size.cpu),Memory:String(size.memoryMiB),EphemeralStorage:{SizeInGiB:size.ephemeralStorageGiB},
  RuntimePlatform:{CpuArchitecture:'X86_64',OperatingSystemFamily:'LINUX'},
  ExecutionRoleArn:service.executionRoleArn,TaskRoleArn:service.taskRoleArn,
  Volumes:[{Name:'material'},{Name:'tmp'}],
  ContainerDefinitions:[materialInit(service),{Name:service.containerName,Essential:true,User:service.runtimeUser,
   Privileged:false,ReadonlyRootFilesystem:true,StopTimeout:60,LinuxParameters:dropAll,
   PortMappings:[{ContainerPort:service.port,Protocol:'tcp'}],
   MountPoints:[{SourceVolume:'material',ContainerPath:'/run/meri',ReadOnly:true},{SourceVolume:'tmp',ContainerPath:'/tmp',ReadOnly:false}],
   DependsOn:[{ContainerName:'material-init',Condition:'SUCCESS'}],
   LogConfiguration:logging(service.logGroupName,service.serviceName),...main}]});
}
function ecsService(plan,service,taskName,dependsOn){
 const p=plan.placement;
 return resource('AWS::ECS::Service',{
  ServiceName:service.serviceName,Cluster:p.clusterArn,TaskDefinition:ref(taskName),DesiredCount:0,
  LaunchType:'FARGATE',PlatformVersion:p.platformVersion,EnableExecuteCommand:false,
  NetworkConfiguration:{AwsvpcConfiguration:{AssignPublicIp:'DISABLED',Subnets:[...p.privateSubnetIds],SecurityGroups:[...service.securityGroupIds]}},
  ServiceRegistries:[{RegistryArn:service.registryArn}]},dependsOn);
}

export function synthesizeModelProxyTemplate(binding){
 const plan=planPrivateModelProxy(binding);
 const proxy=plan.services.proxy,owner=plan.services.owner,iam=plan.iam;
 return structuredClone({
  AWSTemplateFormatVersion:'2010-09-09',
  Description:'Meri private model proxy and canonical budget owner: ECS services at desired count 0',
  Metadata:{SourceSchema:plan.schema,DesiredCount:0,OneBudgetOwner:plan.owner.budgetNamespace,
   ProxyImageSourceCommit:plan.images.proxy.sourceCommit,ProxyImageScanSha256:plan.images.proxy.reviewedScanSha256,
   NodeRuntimeSourceCommit:plan.images.nodeRuntime.sourceCommit,NodeRuntimeScanSha256:plan.images.nodeRuntime.reviewedScanSha256,
   BedrockPath:plan.network.bedrockPath,ReusedS3Gateway:plan.network.s3Gateway,
   FoundationOwnedSecurityGroupRules:plan.network.foundationOwnedRules,
   RequiredBeforeDesiredCountOne:['Node runtime image containing the model-proxy/model-owner material roles (8e4b5926)',
    'startup configs pin these task-definition ARNs, service ARNs, images and exact SG sets',
    'Cloud Map service names proxy and owner in meri.internal',
    'IAM policy simulation, including DescribeTasks include=TAGS',
    'pinned server TLS, opaque bearer hash, direct socket IPv4 and fresh ECS task/ENI lease',
    'reviewed material issuer and exact secret versions','shipping approval']},
  Resources:{
   ModelProxyProviderPolicy:resource('AWS::IAM::ManagedPolicy',{
    Roles:[roleName(proxy.taskRoleArn)],PolicyDocument:{Version:'2012-10-17',Statement:[
     {Effect:'Allow',Action:iam.proxyRole.actions,
      Resource:iam.proxyRole.profile,Condition:{StringEquals:{'aws:RequestedRegion':iam.proxyRole.profileSourceRegion}}},
     {Effect:'Allow',Action:iam.proxyRole.actions,
      Resource:iam.proxyRole.foundations,Condition:{ArnEquals:iam.proxyRole.foundationCondition}},
     {Effect:'Allow',Action:iam.countTokens.action,Resource:iam.countTokens.foundation},
     ...observerStatements(iam.observer)]}}),
   ModelOwnerObserverPolicy:resource('AWS::IAM::ManagedPolicy',{
    Roles:[roleName(owner.taskRoleArn)],PolicyDocument:{Version:'2012-10-17',Statement:observerStatements(iam.observer)}}),
   ModelProxyExecutionPolicy:resource('AWS::IAM::ManagedPolicy',{
    Roles:[roleName(proxy.executionRoleArn)],PolicyDocument:executionPolicy(proxy,[proxy.image,proxy.initImage])}),
   ModelOwnerExecutionPolicy:resource('AWS::IAM::ManagedPolicy',{
    Roles:[roleName(owner.executionRoleArn)],PolicyDocument:executionPolicy(owner,[owner.image])}),
   ModelProxyTask:taskDefinition(plan,proxy,{Image:proxy.image,
    Command:['--config',proxy.configFile,'--config-sha256',proxy.configSha256],
    Environment:[{Name:'MERI_PRODUCT_PROXY_REQUIRED',Value:'1'}]}),
   ModelOwnerTask:taskDefinition(plan,owner,{Image:owner.image,
    EntryPoint:['node','apps/proxy/product/owner-entrypoint.mjs'],Command:['--config',owner.configFile],
    Environment:[{Name:'MERI_PRODUCT_OWNER_REQUIRED',Value:'1'},{Name:'MERI_PRODUCT_OWNER_CONFIG_SHA256',Value:owner.configSha256}]}),
   ModelProxyService:ecsService(plan,proxy,'ModelProxyTask',['ModelProxyProviderPolicy','ModelProxyExecutionPolicy']),
   ModelOwnerService:ecsService(plan,owner,'ModelOwnerTask',['ModelOwnerObserverPolicy','ModelOwnerExecutionPolicy']),
  },
  Outputs:{
   ModelProxyTaskDefinitionArn:{Value:ref('ModelProxyTask')},ModelOwnerTaskDefinitionArn:{Value:ref('ModelOwnerTask')},
   ModelProxyServiceArn:{Value:ref('ModelProxyService')},ModelOwnerServiceArn:{Value:ref('ModelOwnerService')},
   ModelProxyOrigin:{Value:proxy.origin},ModelOwnerOrigin:{Value:owner.origin}},
 });
}
