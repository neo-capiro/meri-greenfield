/** Stage 2 foundation for the Meri first-chat preview: IAM roles, security groups,
 * Cloud Map, log groups and the control target group. Source only: no lookup, AWS client or deployment.
 * Services (Stage 3) consume this stack's outputs; secrets are created separately with exact values and
 * passed in as ARNs so no secret material ever enters a template. */
import {App,Stack,CfnOutput,BootstraplessSynthesizer,aws_ec2 as ec2,aws_iam as iam,aws_logs as logs,
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
export const FOUNDATION_SECRET_ROLES=Object.freeze(['control','worker','temporal','migrator']);
export function validateFoundationBinding(value){
 const b=closed(value,['account','region','vpcId','vpcCidr','privateSubnetIds','clusterArn','ecrRepositoryArn','albSecurityGroupId',
  'auroraSecurityGroupId','endpointSecurityGroupId','s3PrefixListId','checkpoint','secretArns','secretKmsKeyArns']);
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
 const g={control:group('ControlSg','Meri preview control'),worker:group('WorkerSg','Meri preview Temporal worker'),
  migrator:group('MigratorSg','Meri preview one-shot migrator'),dbClient:group('DbClientSg','Meri preview Aurora client marker')};
 // Every task pulls images, writes logs and reads injected secrets through the shared interface endpoints and S3 gateway.
 for(const key of ['control','worker','migrator']){
  g[key].addEgressRule(endpoints,ec2.Port.tcp(443),'interface endpoints: ECR, logs, secrets, KMS, STS');
  g[key].addEgressRule(ec2.Peer.prefixList(b.s3PrefixListId),ec2.Port.tcp(443),'S3 gateway: ECR layers, checkpoints');
 }
 // The separate AgentCore stack owns SDK compute and direct Bedrock permissions.
 for(const key of ['control','worker'])g[key].addEgressRule(ec2.Peer.anyIpv4(),ec2.Port.tcp(443),'NAT 443: AWS APIs without endpoints, Core, Clerk, Bedrock');
 // One-shot Temporal schema task pulls the digest-pinned temporalio/admin-tools image from Docker Hub.
 g.migrator.addEgressRule(ec2.Peer.anyIpv4(),ec2.Port.tcp(443),'NAT 443: digest-pinned admin-tools image pull');
 g.control.addIngressRule(alb,ec2.Port.tcp(8080),'public ALB to control 8080 (Meri host rule only)');
 for(const key of ['control','worker'])g[key].addEgressRule(ec2.Peer.ipv4(b.vpcCidr),ec2.Port.tcp(7233),'Temporal frontend (role SGs admit only these clients)');
 g.dbClient.addEgressRule(aurora,ec2.Port.tcp(5432),'Meri schemas and Temporal stores');
 new ec2.CfnSecurityGroupIngress(stack,'AuroraFromMeriDbClients',{groupId:b.auroraSecurityGroupId,ipProtocol:'tcp',fromPort:5432,toPort:5432,
  sourceSecurityGroupId:g.dbClient.securityGroupId,description:'Meri preview tasks carrying the DB client marker'});

 const logGroups={};
 for(const key of ['control','worker','temporal','migrator'])
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
 const exec={control:execution('control',b.secretArns.control),worker:execution('worker',b.secretArns.worker),
  temporal:execution('temporal',b.secretArns.temporal),migrator:execution('migrator',b.secretArns.migrator)};
 const task=key=>new iam.Role(stack,`${key}TaskRole`,{roleName:`MeriPreview-${key}-task`,assumedBy:ecsTrust()});
 const control=task('control');
 control.addToPolicy(statement(['s3:GetBucketVersioning'],[`arn:aws:s3:::${b.checkpoint.bucket}`]));
 control.addToPolicy(statement(['s3:PutObject','s3:GetObject','s3:GetObjectVersion'],[`arn:aws:s3:::${b.checkpoint.bucket}/${b.checkpoint.prefix}/*`]));
 control.addToPolicy(statement(['kms:GenerateDataKey','kms:Decrypt'],[b.checkpoint.kmsKeyArn],{StringEquals:{'kms:ViaService':`s3.${REGION}.amazonaws.com`}}));
 const temporalTasks=Object.fromEntries(['frontend','history','matching','worker','internal-frontend'].map(r=>[r,task(`temporal-${r}`)]));

 const namespace=new discovery.PrivateDnsNamespace(stack,'MeriNamespace',{name:'meri.internal',vpc,description:'Meri preview private services'});
 const discoveryService=name=>namespace.createService(`${name}Discovery`,{name,dnsRecordType:discovery.DnsRecordType.A,dnsTtl:{toSeconds:()=>10},
  customHealthCheck:{failureThreshold:1},routingPolicy:discovery.RoutingPolicy.MULTIVALUE});
 const services={control:discoveryService('control-private')};

 const targetGroup=new elbv2.CfnTargetGroup(stack,'ControlTargetGroup',{name:'meri-preview-control-8080',targetType:'ip',protocol:'HTTP',port:8080,vpcId:b.vpcId,
  healthCheckProtocol:'HTTP',healthCheckPath:'/health/live',healthCheckPort:'8080',healthCheckIntervalSeconds:15,healthyThresholdCount:2,unhealthyThresholdCount:3,
  matcher:{httpCode:'200'},targetGroupAttributes:[{key:'deregistration_delay.timeout_seconds',value:'30'}]});

 const out=(id,value)=>new CfnOutput(stack,id,{value});
 for(const [key,value] of Object.entries(g))out(`${key[0].toUpperCase()}${key.slice(1)}SecurityGroupId`,value.securityGroupId);
 for(const [key,value] of Object.entries(exec))out(`${key[0].toUpperCase()}${key.slice(1)}ExecutionRoleArn`,value.roleArn);
 for(const [key,value] of Object.entries({control}))out(`${key[0].toUpperCase()}${key.slice(1)}TaskRoleArn`,value.roleArn);
 for(const [key,value] of Object.entries(temporalTasks))out(`Temporal${key.replace('-','')}TaskRoleArn`,value.roleArn);
 for(const [key,value] of Object.entries(logGroups))out(`${key[0].toUpperCase()}${key.slice(1)}LogGroupName`,value.logGroupName);
 for(const [key,value] of Object.entries(services))out(`${key[0].toUpperCase()}${key.slice(1)}DiscoveryServiceArn`,value.serviceArn);
 out('MeriNamespaceId',namespace.namespaceId);out('ControlTargetGroupArn',targetGroup.ref);
 const template=Template.fromStack(stack).toJSON();
 template.Description='Shared Meri control and native TLS Temporal foundation; no runtime token issuer or per-turn ECS compute.';
 template.Metadata={AWSToolsMetrics:{AWSAgentToolkit:'aws-cloudformation@3'}};
 return template;
}
