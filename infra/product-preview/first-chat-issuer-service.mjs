/** CloudFormation for the private Temporal issuer ECS task definition and service
 * (approved change set Stage 3). Same idiom as model-proxy-template.mjs: a closed,
 * validated binding in, raw CloudFormation JSON out.
 *
 * Consumed, never created here (foundation stack outputs): the issuer and dbClient
 * security groups and their rules, both IAM roles and their policies (ECS/EC2
 * peer reads on the task role, ECR/logs/the issuer material secret on the
 * execution role), the KMS signing-key grant, the log group and the Cloud Map
 * `issuer.meri.internal` A-record service. Created here: one task definition and
 * one service, at the desired count the binding names (0 or 1).
 *
 * Task shape (verified against the runtime sources):
 * - apps/runtime/temporal-issuer-cli.mjs accepts exactly
 *   `--config <absolute path> --config-sha256 <64 hex>` and refuses to start
 *   unless MERI_TEMPORAL_ISSUER_REQUIRED is exactly '1'.
 * - material-init-plan.mjs names the issuer's config `/run/meri/issuer.json` and
 *   its reader 1000:1000; the init writes as that same user, so it drops ALL.
 * - The issuer listens only on 0.0.0.0:8445 (TLS 1.3, client certificate
 *   requested). It serves the JWKS, token and bootstrap routes and no /health
 *   route, so the task has no container health check.
 * - No issuer source writes to /tmp; the writable `tmp` volume is kept for
 *   parity with every other read-only-root Node task in this preview.
 * - 0.25 vCPU / 0.5 GiB per AWS-ACTIVATION-PROPOSAL.md ("unless measured startup
 *   requires a reviewed increase"): a two-connection pg Pool, three AWS SDK
 *   clients and one HTTPS listener.
 *
 * This module performs no AWS lookup, credential read, file read or deployment.
 */
import {parseStaticProductMaterialExpected} from '../../apps/runtime/material-init.mjs';

const ACCOUNT='967807252336',REGION='us-east-1';
export const BINDING_SCHEMA='meri.product-preview.temporal-issuer/1';
/** Fresh 17 Oct 2026 capiro-dev inventory and the foundation's fixed names. */
export const ISSUER_SERVICE_EXISTING=Object.freeze({
 clusterArn:`arn:aws:ecs:${REGION}:${ACCOUNT}:cluster/capiro-dev`,
 vpcId:'vpc-0ac26cfac7ed972be',
 privateSubnetIds:Object.freeze(['subnet-0920665f91c905f01','subnet-0e38bd390f8961fef','subnet-06db79cd21239de19']),
 executionRoleArn:`arn:aws:iam::${ACCOUNT}:role/MeriPreview-issuer-execution`,
 taskRoleArn:`arn:aws:iam::${ACCOUNT}:role/MeriPreview-issuer-task`,
 logGroupName:'/meri/product-preview/issuer',
 // Foreign to the issuer's own ENI: the shared Aurora SG and the issuer-client marker SG.
 foreignSecurityGroupIds:Object.freeze(['sg-059b4e4de0b1dcca5','sg-0c3da023e9e8fb292'])
});
export const ISSUER_SERVICE=Object.freeze({
 serviceName:'meri-product-preview-temporal-issuer',family:'meri-product-preview-temporal-issuer',
 containerName:'temporal-issuer',materialRole:'temporal-issuer',runtimeUser:'1000:1000',port:8445,
 hostname:'issuer.meri.internal',configFile:'/run/meri/issuer.json',materialDirectory:'/run/meri',
 sizing:Object.freeze({cpu:256,memoryMiB:512})
});

const fail=()=>{throw Error('FIRST_CHAT_ISSUER_BINDING_REFUSED');};
function object(value,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||
    Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail();
 return value;
}
function match(value,pattern){if(typeof value!=='string'||!pattern.test(value))fail();return value;}
const hex64=/^[a-f0-9]{64}$/u,commit=/^[a-f0-9]{40}$/u,sg=/^sg-[a-f0-9]{8,17}$/u;
const imageUri=/^967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com\/[a-z0-9]+(?:[._/-][a-z0-9]+)*@sha256:[a-f0-9]{64}$/u;
// The issuer's own material secret, pinned to one exact version (empty JSON key and stage).
const issuerSecretVersion=/^arn:aws:secretsmanager:us-east-1:967807252336:secret:meri\/preview\/issuer\/material-[A-Za-z0-9]{6}:::[A-Za-z0-9-]{32,64}$/u;
const registryArn=/^arn:aws:servicediscovery:us-east-1:967807252336:service\/srv-[a-z0-9]{8,64}$/u;
const digestOf=uri=>`sha256:${uri.split('@sha256:')[1]}`;
export const issuerServiceArn=`arn:aws:ecs:${REGION}:${ACCOUNT}:service/capiro-dev/${ISSUER_SERVICE.serviceName}`;

/** Closed binding. Returns a frozen deep copy; the caller's object is never retained. */
export function validateFirstChatIssuerBinding(binding){
 const b=object(binding,['schema','account','region','placement','image','roles','logGroupName','serviceDiscovery','network','material','startup','desiredCount']);
 const E=ISSUER_SERVICE_EXISTING;
 if(b.schema!==BINDING_SCHEMA||b.account!==ACCOUNT||b.region!==REGION)fail();
 if(b.desiredCount!==0&&b.desiredCount!==1)fail();

 const p=object(b.placement,['clusterArn','vpcId','privateSubnetIds']);
 if(p.clusterArn!==E.clusterArn||p.vpcId!==E.vpcId)fail();
 if(!Array.isArray(p.privateSubnetIds)||p.privateSubnetIds.length<1||p.privateSubnetIds.length>E.privateSubnetIds.length||
    new Set(p.privateSubnetIds).size!==p.privateSubnetIds.length||p.privateSubnetIds.some(id=>!E.privateSubnetIds.includes(id)))fail();

 const image=object(b.image,['uri','sourceCommit']);match(image.uri,imageUri);match(image.sourceCommit,commit);

 const roles=object(b.roles,['executionRoleArn','taskRoleArn']);
 if(roles.executionRoleArn!==E.executionRoleArn||roles.taskRoleArn!==E.taskRoleArn)fail();
 if(b.logGroupName!==E.logGroupName)fail();
 const discovery=object(b.serviceDiscovery,['issuerRegistryArn']);match(discovery.issuerRegistryArn,registryArn);

 const n=object(b.network,['issuerSecurityGroupId','dbClientSecurityGroupId']);
 match(n.issuerSecurityGroupId,sg);match(n.dbClientSecurityGroupId,sg);
 if(n.issuerSecurityGroupId===n.dbClientSecurityGroupId||
    [n.issuerSecurityGroupId,n.dbClientSecurityGroupId].some(id=>E.foreignSecurityGroupIds.includes(id)))fail();

 const startup=object(b.startup,['configSha256']);match(startup.configSha256,hex64);

 // Same static material-init contract as manifest.mjs and model-proxy-plan.mjs: exact-version bundle secret plus an
 // independently pinned expected inventory bound to this image and to the container's --config-sha256.
 const m=object(b.material,['valueFrom','expected']);match(m.valueFrom,issuerSecretVersion);
 // The canonical parser also recomputes materialContractSha256 over the other fields.
 let expected;try{expected=parseStaticProductMaterialExpected(m.expected);}catch{fail();}
 if(expected.role!==ISSUER_SERVICE.materialRole||expected.runtimeUser!==ISSUER_SERVICE.runtimeUser||
    expected.sourceCommit!==image.sourceCommit||expected.imageDigest!==digestOf(image.uri)||
    expected.sha256ByPath[ISSUER_SERVICE.configFile]!==startup.configSha256||Buffer.byteLength(JSON.stringify(expected),'utf8')>8192)fail();

 return deepFreeze(structuredClone(b));
}
function deepFreeze(value){
 if(value!==null&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}
 return value;
}

const dropAll={Capabilities:{Drop:['ALL']}};
const logging=(group,prefix)=>({LogDriver:'awslogs',Options:{'awslogs-group':group,'awslogs-region':REGION,
 'awslogs-stream-prefix':prefix,'mode':'blocking'}});

function taskDefinition(b){
 const S=ISSUER_SERVICE,material={SourceVolume:'material',ContainerPath:S.materialDirectory};
 const init={Name:'material-init',Image:b.image.uri,Essential:false,User:S.runtimeUser,Privileged:false,ReadonlyRootFilesystem:true,
  EntryPoint:['node','apps/runtime/material-init-cli.mjs'],Command:['write'],LinuxParameters:dropAll,
  Environment:[{Name:'MERI_STATIC_MATERIAL_EXPECTED',Value:JSON.stringify(b.material.expected)}],
  // The bundle reaches only this one-shot container; it exits before the issuer's SUCCESS gate opens.
  Secrets:[{Name:'MERI_STATIC_MATERIAL_BUNDLE',ValueFrom:b.material.valueFrom}],
  MountPoints:[{...material,ReadOnly:false}],
  LogConfiguration:logging(b.logGroupName,`${S.containerName}-init`)};
 const main={Name:S.containerName,Image:b.image.uri,Essential:true,User:S.runtimeUser,Privileged:false,ReadonlyRootFilesystem:true,
  // Above the CLI's 30 s retirement watchdog, so SIGKILL never races a graceful close.
  StopTimeout:60,LinuxParameters:dropAll,
  EntryPoint:['node','apps/runtime/temporal-issuer-cli.mjs'],
  Command:['--config',S.configFile,'--config-sha256',b.startup.configSha256],
  Environment:[{Name:'MERI_TEMPORAL_ISSUER_REQUIRED',Value:'1'}],
  PortMappings:[{ContainerPort:S.port,Protocol:'tcp'}],
  MountPoints:[{...material,ReadOnly:true},{SourceVolume:'tmp',ContainerPath:'/tmp',ReadOnly:false}],
  DependsOn:[{ContainerName:'material-init',Condition:'SUCCESS'}],
  LogConfiguration:logging(b.logGroupName,S.containerName)};
 return {Type:'AWS::ECS::TaskDefinition',Properties:{
  Family:S.family,RequiresCompatibilities:['FARGATE'],NetworkMode:'awsvpc',
  Cpu:String(S.sizing.cpu),Memory:String(S.sizing.memoryMiB),
  RuntimePlatform:{CpuArchitecture:'X86_64',OperatingSystemFamily:'LINUX'},
  ExecutionRoleArn:b.roles.executionRoleArn,TaskRoleArn:b.roles.taskRoleArn,
  Volumes:[{Name:'material'},{Name:'tmp'}],ContainerDefinitions:[init,main]}};
}
function ecsService(b){
 return {Type:'AWS::ECS::Service',Properties:{
  ServiceName:ISSUER_SERVICE.serviceName,Cluster:b.placement.clusterArn,TaskDefinition:{Ref:'TemporalIssuerTask'},
  DesiredCount:b.desiredCount,LaunchType:'FARGATE',PlatformVersion:'1.4.0',EnableExecuteCommand:false,
  NetworkConfiguration:{AwsvpcConfiguration:{AssignPublicIp:'DISABLED',Subnets:[...b.placement.privateSubnetIds],
   SecurityGroups:[b.network.issuerSecurityGroupId,b.network.dbClientSecurityGroupId]}},
  // Cloud Map A records under awsvpc: no ContainerName/ContainerPort (those are for SRV records).
  ServiceRegistries:[{RegistryArn:b.serviceDiscovery.issuerRegistryArn}]}};
}

/** Returns CloudFormation JSON only. A refused binding throws FIRST_CHAT_ISSUER_BINDING_REFUSED and synthesizes nothing. */
export function synthesizeFirstChatIssuerServiceTemplate(binding){
 const b=validateFirstChatIssuerBinding(binding),S=ISSUER_SERVICE;
 return structuredClone({
  AWSTemplateFormatVersion:'2010-09-09',
  Description:`Meri preview private Temporal issuer: ECS task definition and service at desired count ${b.desiredCount}`,
  Metadata:{SourceSchema:b.schema,DesiredCount:b.desiredCount,ImageSourceCommit:b.image.sourceCommit,
   ImageDigest:digestOf(b.image.uri),MaterialContractSha256:b.material.expected.materialContractSha256,
   ConfigSha256:b.startup.configSha256,ServiceArn:issuerServiceArn,
   FoundationOwned:['issuer and dbClient SGs and their rules (8445 from the issuer-client marker SG only)',
    'MeriPreview-issuer-execution (ECR, issuer log group, issuer material secret) and MeriPreview-issuer-task (peer ECS/EC2 reads)',
    'issuer KMS signing key policy (GetPublicKey, Sign) naming the issuer task role',
    'log group /meri/product-preview/issuer','Cloud Map A-record service issuer.meri.internal'],
   RequiredBeforeDesiredCountOne:['Node runtime image (PENDING_N4) with apps/runtime/temporal-issuer-cli.mjs, pg and the AWS SDK ECS/EC2/KMS clients',
    'issuer.json taskAuthority pins the control and temporal-worker task-definition ARNs (with revision), service ARNs, container names and images',
    'issuer material secret version holding the six files the expected inventory pins','shipping approval']},
  Resources:{TemporalIssuerTask:taskDefinition(b),TemporalIssuerService:ecsService(b)},
  Outputs:{TemporalIssuerTaskDefinitionArn:{Value:{Ref:'TemporalIssuerTask'}},
   TemporalIssuerServiceArn:{Value:{Ref:'TemporalIssuerService'}},
   TemporalIssuerOrigin:{Value:`https://${S.hostname}:${S.port}`}}
 });
}
