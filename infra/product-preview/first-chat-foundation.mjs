/** Stage 2 foundation for the Meri first-chat preview: KMS signing key, IAM roles, security groups,
 * Cloud Map, log groups and the control target group. Source only: no lookup, AWS client or deployment.
 * Services (Stage 3) consume this stack's outputs; secrets are created separately with exact values and
 * passed in as ARNs so no secret material ever enters a template. */
import {App,Stack,CfnOutput,BootstraplessSynthesizer,aws_ec2 as ec2,aws_iam as iam,aws_kms as kms,aws_logs as logs,
 aws_servicediscovery as discovery,aws_elasticloadbalancingv2 as elbv2} from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';

const ACCOUNT='967807252336',REGION='us-east-1';
const fail=()=>{throw Error('FIRST_CHAT_FOUNDATION_BINDING_REFUSED');};
const sg=/^sg-[a-f0-9]{8,17}$/u,secretArn=/^arn:aws:secretsmanager:us-east-1:967807252336:secret:[A-Za-z0-9/_+=.@-]{1,512}-[A-Za-z0-9]{6}$/u;
function closed(value,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||
    keys.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>!keys.includes(k)))fail();
 return value;
}
export const FOUNDATION_SECRET_ROLES=Object.freeze(['control','worker','issuer','owner','proxy','temporal','migrator']);
// Service names are fixed so dependent policies (issuer and owner DescribeServices) need no cross-stack lookup.
export const SERVICE_NAMES=Object.freeze({control:'meri-product-preview-control',worker:'meri-product-preview-temporal-worker',
 issuer:'meri-product-preview-temporal-issuer',owner:'meri-product-preview-owner',proxy:'meri-product-preview-proxy'});
export const RUNNER_FAMILY='meri-product-preview-runner';

export function validateFoundationBinding(value){
 const b=closed(value,['account','region','vpcId','vpcCidr','privateSubnetIds','clusterArn','ecrRepositoryArn','albSecurityGroupId',
  'auroraSecurityGroupId','endpointSecurityGroupId','s3PrefixListId','checkpoint','secretArns','secretKmsKeyArns','bedrock']);
 if(b.account!==ACCOUNT||b.region!==REGION||!/^vpc-[a-f0-9]{8,17}$/u.test(b.vpcId)||!/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}\/16$/u.test(b.vpcCidr)||
    !Array.isArray(b.privateSubnetIds)||b.privateSubnetIds.length<2||new Set(b.privateSubnetIds).size!==b.privateSubnetIds.length||
    !b.privateSubnetIds.every(s=>/^subnet-[a-f0-9]{8,17}$/u.test(s))||
    b.clusterArn!==`arn:aws:ecs:${REGION}:${ACCOUNT}:cluster/capiro-dev`||
    !new RegExp(`^arn:aws:ecr:${REGION}:${ACCOUNT}:repository/[a-z0-9._/-]{2,256}$`,'u').test(b.ecrRepositoryArn)||
    ![b.albSecurityGroupId,b.auroraSecurityGroupId,b.endpointSecurityGroupId].every(x=>sg.test(x))||
    new Set([b.albSecurityGroupId,b.auroraSecurityGroupId,b.endpointSecurityGroupId]).size!==3||!/^pl-[a-f0-9]{8,17}$/u.test(b.s3PrefixListId))fail();
 const c=closed(b.checkpoint,['bucket','prefix','kmsKeyArn']);
 if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(c.bucket)||!/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/u.test(c.prefix)||
    !new RegExp(`^arn:aws:kms:${REGION}:${ACCOUNT}:key/[a-f0-9-]{36}$`,'u').test(c.kmsKeyArn))fail();
 const s=closed(b.secretArns,FOUNDATION_SECRET_ROLES);
 for(const role of FOUNDATION_SECRET_ROLES)if(!Array.isArray(s[role])||s[role].length<1||s[role].length>8||!s[role].every(a=>secretArn.test(a))||
    new Set(s[role]).size!==s[role].length)fail();
 const k=closed(b.secretKmsKeyArns,FOUNDATION_SECRET_ROLES);
 for(const role of FOUNDATION_SECRET_ROLES)if(!Array.isArray(k[role])||k[role].length>2||
    !k[role].every(a=>new RegExp(`^arn:aws:kms:${REGION}:${ACCOUNT}:key/[a-f0-9-]{36}$`,'u').test(a)))fail();
 const m=closed(b.bedrock,['inferenceProfileArn','foundationModelArns','countTokensModelArn']);
 if(!new RegExp(`^arn:aws:bedrock:${REGION}:${ACCOUNT}:inference-profile/us\\.anthropic\\.[a-z0-9.-]+$`,'u').test(m.inferenceProfileArn)||
    !Array.isArray(m.foundationModelArns)||m.foundationModelArns.length<1||m.foundationModelArns.length>4||
    !m.foundationModelArns.every(a=>/^arn:aws:bedrock:us-(east|west)-[12]::foundation-model\/anthropic\.[a-z0-9.-]+$/u.test(a))||
    !m.foundationModelArns.includes(m.countTokensModelArn))fail();
 return b;
}

const ecsTrust=()=>new iam.PrincipalWithConditions(new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
 {StringEquals:{'aws:SourceAccount':ACCOUNT},ArnLike:{'aws:SourceArn':`arn:aws:ecs:${REGION}:${ACCOUNT}:*`}});
const statement=(actions,resources,conditions)=>new iam.PolicyStatement({actions,resources,...(conditions?{conditions}:{})});

/** Returns the CloudFormation template JSON for the foundation stack. */
export function synthesizeFirstChatFoundation(binding){
 const b=validateFoundationBinding(binding),app=new App({context:{'aws:cdk:version-reporting':false}});
 const stack=new Stack(app,'MeriFirstChatFoundation',{env:{account:ACCOUNT,region:REGION},synthesizer:new BootstraplessSynthesizer()});
 const vpc=ec2.Vpc.fromVpcAttributes(stack,'Vpc',{vpcId:b.vpcId,vpcCidrBlock:b.vpcCidr,availabilityZones:b.privateSubnetIds.map((_,i)=>`${REGION}${'abc'[i]}`),privateSubnetIds:b.privateSubnetIds});
 const existing=(id,name)=>ec2.SecurityGroup.fromSecurityGroupId(stack,name,id,{mutable:false});
 const alb=existing(b.albSecurityGroupId,'AlbSg'),aurora=existing(b.auroraSecurityGroupId,'AuroraSg'),endpoints=existing(b.endpointSecurityGroupId,'EndpointSg');
 const group=(id,description)=>new ec2.SecurityGroup(stack,id,{vpc,allowAllOutbound:false,description,securityGroupName:`meri-preview-${id.replace(/Sg$/u,'').toLowerCase()}`});
 const g={control:group('ControlSg','Meri preview control'),worker:group('WorkerSg','Meri preview Temporal worker'),runner:group('RunnerSg','Meri preview runner'),
  issuer:group('IssuerSg','Meri preview Temporal issuer'),proxy:group('ProxySg','Meri preview model proxy'),owner:group('OwnerSg','Meri preview proxy budget owner'),
  migrator:group('MigratorSg','Meri preview one-shot migrator'),dbClient:group('DbClientSg','Meri preview Aurora client marker'),
  issuerClient:group('IssuerClientSg','Meri preview issuer client marker')};
 // Every task pulls images, writes logs and reads injected secrets through the shared interface endpoints and S3 gateway.
 for(const key of ['control','worker','runner','issuer','proxy','owner','migrator']){
  g[key].addEgressRule(endpoints,ec2.Port.tcp(443),'interface endpoints: ECR, logs, secrets, KMS, STS');
  g[key].addEgressRule(ec2.Peer.prefixList(b.s3PrefixListId),ec2.Port.tcp(443),'S3 gateway: ECR layers, checkpoints');
 }
 // D6 (approved): NAT 443 for ECS/EC2 APIs, Core and Clerk (control, owner, issuer) and Bedrock (proxy); no endpoint exists for them.
 for(const key of ['control','worker','issuer','owner','proxy'])g[key].addEgressRule(ec2.Peer.anyIpv4(),ec2.Port.tcp(443),'NAT 443: AWS APIs without endpoints, Core, Clerk, Bedrock');
 g.control.addIngressRule(alb,ec2.Port.tcp(8080),'public ALB to control 8080 (Meri host rule only)');
 g.control.addIngressRule(g.runner,ec2.Port.tcp(8082),'runner poststart to private control');
 g.runner.addEgressRule(g.control,ec2.Port.tcp(8082),'runner poststart to private control');
 g.runner.addEgressRule(g.proxy,ec2.Port.tcp(8443),'runner model traffic to proxy');
 g.proxy.addIngressRule(g.runner,ec2.Port.tcp(8443),'runner model traffic');
 g.proxy.addEgressRule(g.owner,ec2.Port.tcp(8444),'proxy to budget owner mTLS');
 g.owner.addIngressRule(g.proxy,ec2.Port.tcp(8444),'proxy to budget owner mTLS');
 for(const key of ['control','worker'])g[key].addEgressRule(ec2.Peer.ipv4(b.vpcCidr),ec2.Port.tcp(7233),'Temporal frontend (role SGs admit only these clients)');
 g.issuerClient.addEgressRule(g.issuer,ec2.Port.tcp(8445),'issuer bootstrap, token and JWKS');
 g.issuer.addIngressRule(g.issuerClient,ec2.Port.tcp(8445),'issuer clients carrying the marker SG');
 g.dbClient.addEgressRule(aurora,ec2.Port.tcp(5432),'Meri schemas and Temporal stores');
 new ec2.CfnSecurityGroupIngress(stack,'AuroraFromMeriDbClients',{groupId:b.auroraSecurityGroupId,ipProtocol:'tcp',fromPort:5432,toPort:5432,
  sourceSecurityGroupId:g.dbClient.securityGroupId,description:'Meri preview tasks carrying the DB client marker'});

 const logGroups={};
 for(const key of ['control','worker','runner','issuer','proxy','owner','temporal','migrator'])
  logGroups[key]=new logs.LogGroup(stack,`${key}Logs`,{logGroupName:`/meri/product-preview/${key}`,retention:logs.RetentionDays.ONE_MONTH,removalPolicy:'retain'});

 const execution=(key,secretArns)=>{
  const role=new iam.Role(stack,`${key}ExecutionRole`,{roleName:`MeriPreview-${key}-execution`,assumedBy:ecsTrust()});
  role.addToPolicy(statement(['ecr:GetAuthorizationToken'],['*']));
  role.addToPolicy(statement(['ecr:BatchCheckLayerAvailability','ecr:GetDownloadUrlForLayer','ecr:BatchGetImage'],[b.ecrRepositoryArn]));
  role.addToPolicy(statement(['logs:CreateLogStream','logs:PutLogEvents'],[`${logGroups[key].logGroupArn}:*`]));
  if(secretArns)role.addToPolicy(statement(['secretsmanager:GetSecretValue'],secretArns));
  // Customer-managed secret keys (e.g. the existing Aurora admin secret) are decryptable only through Secrets Manager.
  const keys=secretArns?b.secretKmsKeyArns[key]:[];
  if(keys.length)role.addToPolicy(statement(['kms:Decrypt'],keys,{StringEquals:{'kms:ViaService':`secretsmanager.${REGION}.amazonaws.com`}}));
  return role;
 };
 const exec={control:execution('control',b.secretArns.control),worker:execution('worker',b.secretArns.worker),runner:execution('runner'),
  issuer:execution('issuer',b.secretArns.issuer),owner:execution('owner',b.secretArns.owner),proxy:execution('proxy',b.secretArns.proxy),
  temporal:execution('temporal',b.secretArns.temporal),migrator:execution('migrator',b.secretArns.migrator)};
 const task=key=>new iam.Role(stack,`${key}TaskRole`,{roleName:`MeriPreview-${key}-task`,assumedBy:ecsTrust()});
 const cluster=b.clusterArn,tasks=`arn:aws:ecs:${REGION}:${ACCOUNT}:task/capiro-dev/*`,service=name=>`arn:aws:ecs:${REGION}:${ACCOUNT}:service/capiro-dev/${name}`;
 const discoveryReads=(role,services)=>{
  role.addToPolicy(statement(['ecs:DescribeServices'],services.map(service)));
  role.addToPolicy(statement(['ecs:DescribeTasks'],[tasks]));
  role.addToPolicy(statement(['ecs:ListTasks'],['*'],{ArnEquals:{'ecs:cluster':cluster}}));
  role.addToPolicy(statement(['ecs:DescribeTaskDefinition','ec2:DescribeNetworkInterfaces'],['*']));
 };
 const control=task('control');
 control.addToPolicy(statement(['ecs:RunTask'],[`arn:aws:ecs:${REGION}:${ACCOUNT}:task-definition/${RUNNER_FAMILY}:*`],
  {ArnEquals:{'ecs:cluster':cluster},'ForAllValues:StringEquals':{'aws:TagKeys':['meri:execution-id','meri:binding-sha256','meri:plan-sha256','meri:expires-at-ms']}}));
 control.addToPolicy(statement(['ecs:TagResource'],[tasks],{StringEquals:{'ecs:CreateAction':'RunTask'}}));
 control.addToPolicy(statement(['ecs:DescribeTasks','ecs:StopTask'],[tasks]));
 control.addToPolicy(statement(['ecs:ListTasks'],['*'],{ArnEquals:{'ecs:cluster':cluster}}));
 control.addToPolicy(statement(['ecs:DescribeTaskDefinition','ec2:DescribeNetworkInterfaces'],['*']));
 control.addToPolicy(statement(['iam:PassRole'],[exec.runner.roleArn],{StringEquals:{'iam:PassedToService':'ecs-tasks.amazonaws.com'}}));
 control.addToPolicy(statement(['s3:GetBucketVersioning'],[`arn:aws:s3:::${b.checkpoint.bucket}`]));
 control.addToPolicy(statement(['s3:PutObject','s3:GetObject','s3:GetObjectVersion'],[`arn:aws:s3:::${b.checkpoint.bucket}/${b.checkpoint.prefix}/*`]));
 control.addToPolicy(statement(['kms:GenerateDataKey','kms:Decrypt'],[b.checkpoint.kmsKeyArn],{StringEquals:{'kms:ViaService':`s3.${REGION}.amazonaws.com`}}));
 const issuer=task('issuer');discoveryReads(issuer,[SERVICE_NAMES.control,SERVICE_NAMES.worker]);
 const owner=task('owner');discoveryReads(owner,[SERVICE_NAMES.owner,SERVICE_NAMES.proxy]);
 const proxy=task('proxy');discoveryReads(proxy,[SERVICE_NAMES.owner,SERVICE_NAMES.proxy]);
 proxy.addToPolicy(statement(['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream'],[b.bedrock.inferenceProfileArn]));
 proxy.addToPolicy(statement(['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream'],b.bedrock.foundationModelArns,{StringEquals:{'bedrock:InferenceProfileArn':b.bedrock.inferenceProfileArn}}));
 proxy.addToPolicy(statement(['bedrock:CountTokens'],[b.bedrock.countTokensModelArn]));
 const temporalTasks=Object.fromEntries(['frontend','history','matching','worker','internal-frontend'].map(r=>[r,task(`temporal-${r}`)]));

 const signingKey=new kms.CfnKey(stack,'IssuerSigningKey',{description:'Meri preview Temporal issuer JWT signing (RSA-2048)',keySpec:'RSA_2048',keyUsage:'SIGN_VERIFY',
  enableKeyRotation:false,pendingWindowInDays:30,keyPolicy:{Version:'2012-10-17',Statement:[
   {Sid:'AccountAdministration',Effect:'Allow',Principal:{AWS:`arn:aws:iam::${ACCOUNT}:root`},Action:'kms:*',Resource:'*'},
   {Sid:'IssuerPublicKey',Effect:'Allow',Principal:{AWS:issuer.roleArn},Action:'kms:GetPublicKey',Resource:'*'},
   {Sid:'IssuerSign',Effect:'Allow',Principal:{AWS:issuer.roleArn},Action:'kms:Sign',Resource:'*',
    Condition:{StringEquals:{'kms:SigningAlgorithm':'RSASSA_PKCS1_V1_5_SHA_256','kms:MessageType':'DIGEST'}}}]}});
 signingKey.cfnOptions.deletionPolicy='Retain';signingKey.cfnOptions.updateReplacePolicy='Retain';
 new kms.CfnAlias(stack,'IssuerSigningAlias',{aliasName:'alias/meri/temporal-issuer-preview',targetKeyId:signingKey.ref});

 const namespace=new discovery.PrivateDnsNamespace(stack,'MeriNamespace',{name:'meri.internal',vpc,description:'Meri preview private services'});
 const discoveryService=name=>namespace.createService(`${name}Discovery`,{name,dnsRecordType:discovery.DnsRecordType.A,dnsTtl:{toSeconds:()=>10},
  customHealthCheck:{failureThreshold:1},routingPolicy:discovery.RoutingPolicy.MULTIVALUE});
 const services={issuer:discoveryService('issuer'),control:discoveryService('control-private'),proxy:discoveryService('proxy'),owner:discoveryService('owner')};

 const targetGroup=new elbv2.CfnTargetGroup(stack,'ControlTargetGroup',{name:'meri-preview-control-8080',targetType:'ip',protocol:'HTTP',port:8080,vpcId:b.vpcId,
  healthCheckProtocol:'HTTP',healthCheckPath:'/health/live',healthCheckPort:'8080',healthCheckIntervalSeconds:15,healthyThresholdCount:2,unhealthyThresholdCount:3,
  matcher:{httpCode:'200'},targetGroupAttributes:[{key:'deregistration_delay.timeout_seconds',value:'30'}]});

 const out=(id,value)=>new CfnOutput(stack,id,{value});
 for(const [key,value] of Object.entries(g))out(`${key[0].toUpperCase()}${key.slice(1)}SecurityGroupId`,value.securityGroupId);
 for(const [key,value] of Object.entries(exec))out(`${key[0].toUpperCase()}${key.slice(1)}ExecutionRoleArn`,value.roleArn);
 for(const [key,value] of Object.entries({control,issuer,owner,proxy}))out(`${key[0].toUpperCase()}${key.slice(1)}TaskRoleArn`,value.roleArn);
 for(const [key,value] of Object.entries(temporalTasks))out(`Temporal${key.replace('-','')}TaskRoleArn`,value.roleArn);
 for(const [key,value] of Object.entries(logGroups))out(`${key[0].toUpperCase()}${key.slice(1)}LogGroupName`,value.logGroupName);
 for(const [key,value] of Object.entries(services))out(`${key[0].toUpperCase()}${key.slice(1)}DiscoveryServiceArn`,value.serviceArn);
 out('MeriNamespaceId',namespace.namespaceId);out('IssuerSigningKeyArn',signingKey.attrArn);out('ControlTargetGroupArn',targetGroup.ref);
 return Template.fromStack(stack).toJSON();
}
