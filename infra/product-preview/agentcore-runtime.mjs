/** AgentCore owns reusable compute; Core and the existing stores retain data authority. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {App, Stack, CfnOutput, CfnParameter, BootstraplessSynthesizer, RemovalPolicy,
 aws_bedrockagentcore as agentcore, aws_iam as iam, aws_ec2 as ec2,
 aws_kms as kms, aws_logs as logs} from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';

const ACCOUNT='967807252336', REGION='us-east-1', NAME='meri_preview', ENDPOINT='preview';
const prefix=`arn:aws:bedrock-agentcore:${REGION}:${ACCOUNT}:runtime/${NAME}-`;
const logPrefix=`arn:aws:logs:${REGION}:${ACCOUNT}:log-group:/aws/bedrock-agentcore/runtimes/${NAME}-`;
const keys=['imageUri','sourceCommit','vpcId','privateSubnetIds','controlTaskRoleName','controlOrigin','controlCaBase64','controlCaSha256','bedrock','claudeApiSecretArn'];
const policy=(actions,resources,conditions)=>new iam.PolicyStatement({actions,resources,...(conditions?{conditions}:{})});

function validate(value){
 assert(value&&Object.getPrototypeOf(value)===Object.prototype,'AgentCore binding required');
 assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),'unknown or missing AgentCore binding field');
 assert.match(value.imageUri,new RegExp(`^${ACCOUNT}\\.dkr\\.ecr\\.${REGION}\\.amazonaws\\.com/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$`));
 assert.match(value.sourceCommit,/^[a-f0-9]{40}$/u);
 assert.match(value.vpcId,/^vpc-[a-f0-9]{8,17}$/u);
 assert(Array.isArray(value.privateSubnetIds)&&value.privateSubnetIds.length>=2&&value.privateSubnetIds.length<=3);
 assert.equal(new Set(value.privateSubnetIds).size,value.privateSubnetIds.length);
 for(const subnet of value.privateSubnetIds)assert.match(subnet,/^subnet-[a-f0-9]{8,17}$/u);
 assert.equal(value.controlTaskRoleName,'MeriPreview-control-task');
 const origin=new URL(value.controlOrigin);
 assert.equal(origin.origin,value.controlOrigin);assert.equal(origin.protocol,'https:');
 assert(!origin.username&&!origin.password);
 const ca=Buffer.from(value.controlCaBase64,'base64');
 assert(ca.length>0&&ca.length<=16384&&ca.toString('base64')===value.controlCaBase64);
 assert.equal(createHash('sha256').update(ca).digest('hex'),value.controlCaSha256);
 assert(ca.toString().includes('-----BEGIN CERTIFICATE-----')&&!ca.toString().includes('PRIVATE KEY'));
 assert(Array.isArray(value.bedrock)&&value.bedrock.length>=1&&value.bedrock.length<=64);
 assert.equal(new Set(value.bedrock.map(model=>model.inferenceProfileArn)).size,value.bedrock.length);
 for(const model of value.bedrock){
 assert.deepEqual(Object.keys(model).sort(),['countTokensModelArn','foundationModelArns','inferenceProfileArn']);
 assert.match(model.inferenceProfileArn,new RegExp(`^arn:aws:bedrock:${REGION}:${ACCOUNT}:inference-profile/us\\.anthropic\\.[a-z0-9.:-]+$`));
 assert(Array.isArray(model.foundationModelArns)&&model.foundationModelArns.length>=1&&model.foundationModelArns.length<=4);
 for(const arn of model.foundationModelArns)assert.match(arn,/^arn:aws:bedrock:us-(east|west)-[12]::foundation-model\/anthropic\.[a-z0-9.:-]+$/u);
 assert(model.foundationModelArns.includes(model.countTokensModelArn));
 }
 assert(value.claudeApiSecretArn===null||typeof value.claudeApiSecretArn==='string'&&/^arn:aws:secretsmanager:us-east-1:967807252336:secret:[A-Za-z0-9/_+=.@-]{1,512}-[A-Za-z0-9]{6}$/u.test(value.claudeApiSecretArn));
 return value;
}

/** Offline template synthesis only. The shipping owner validates fresh subnets/AZs and image evidence. */
export function synthesizeAgentCoreRuntime(binding){
 const b=validate(binding),app=new App({context:{'aws:cdk:version-reporting':false}});
 const stack=new Stack(app,'MeriAgentCoreRuntime',{env:{account:ACCOUNT,region:REGION},synthesizer:new BootstraplessSynthesizer()});
 const qualifiedVersion=new CfnParameter(stack,'QualifiedRuntimeVersion',{type:'String',default:'1',allowedPattern:'[1-9][0-9]*',
  description:'Release-selected version after MMDSv2 enablement and readback. First deployment must not be invoked before qualification.'});
 const repository=b.imageUri.split('.amazonaws.com/')[1].split('@')[0];
 const role=new iam.Role(stack,'RuntimeRole',{roleName:'MeriPreview-agentcore-runtime',
  assumedBy:new iam.PrincipalWithConditions(new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),{
   StringEquals:{'aws:SourceAccount':ACCOUNT},ArnLike:{'aws:SourceArn':`${prefix}*`}})});
 role.addToPolicy(policy(['ecr:GetAuthorizationToken'],['*']));
 role.addToPolicy(policy(['ecr:BatchGetImage','ecr:GetDownloadUrlForLayer','ecr:BatchCheckLayerAvailability'],
  [`arn:aws:ecr:${REGION}:${ACCOUNT}:repository/${repository}`]));
 role.addToPolicy(policy(['logs:DescribeLogStreams','logs:CreateLogStream','logs:PutLogEvents'],[`${logPrefix}*:log-stream:*`,`${logPrefix}*`]));
 for(const model of b.bedrock){
  role.addToPolicy(policy(['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream'],[model.inferenceProfileArn]));
  role.addToPolicy(policy(['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream'],model.foundationModelArns,
   {StringEquals:{'bedrock:InferenceProfileArn':model.inferenceProfileArn}}));
  role.addToPolicy(policy(['bedrock:CountTokens'],[model.countTokensModelArn]));
 }
 if(b.claudeApiSecretArn!==null)role.addToPolicy(policy(['secretsmanager:GetSecretValue'],[b.claudeApiSecretArn]));
 // Private VPC egress reaches the existing control HTTPS edge and AWS endpoints/NAT.
 // There is no inbound container port, database ingress or raw database credential.
 const network=new ec2.CfnSecurityGroup(stack,'RuntimeSecurityGroup',{vpcId:b.vpcId,
  groupDescription:'Meri AgentCore outbound HTTPS',securityGroupEgress:[{ipProtocol:'tcp',fromPort:443,toPort:443,cidrIp:'0.0.0.0/0'}]});
 const runtime=new agentcore.CfnRuntime(stack,'Runtime',{
  agentRuntimeName:NAME,description:'Meri Claude Agent SDK conversation runtime',
  agentRuntimeArtifact:{containerConfiguration:{containerUri:b.imageUri}},roleArn:role.roleArn,
  platformVersion:'V1',protocolConfiguration:'HTTP',
  // Omission selects the standard IAM SigV4 authorizer, not anonymous invocation.
  networkConfiguration:{networkMode:'VPC',networkModeConfig:{subnets:b.privateSubnetIds,securityGroups:[network.attrGroupId]}},
  lifecycleConfiguration:{idleRuntimeSessionTimeout:900,maxLifetime:28800},
  environmentVariables:{MERI_PRODUCT_PREVIEW_REQUIRED:'1',MERI_SOURCE_COMMIT:b.sourceCommit,
   MERI_CONTROL_ORIGIN:b.controlOrigin,MERI_CONTROL_CA_BASE64:b.controlCaBase64,MERI_CONTROL_CA_SHA256:b.controlCaSha256,
   ...(b.claudeApiSecretArn===null?{}:{MERI_CLAUDE_API_SECRET_ARN:b.claudeApiSecretArn})},
  tags:{Application:'meri',Environment:'preview',SourceCommit:b.sourceCommit}});
 const endpoint=new agentcore.CfnRuntimeEndpoint(stack,'PreviewEndpoint',{agentRuntimeId:runtime.attrAgentRuntimeId,
  agentRuntimeVersion:qualifiedVersion.valueAsString,name:ENDPOINT,description:'Qualified Meri preview runtime version'});
 // The control service alone invokes/stops sessions. Browser-supplied session IDs never select compute.
 new iam.CfnPolicy(stack,'ControlInvocationPolicy',{policyName:'MeriAgentCoreInvocation',roles:[b.controlTaskRoleName],
  policyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['bedrock-agentcore:InvokeAgentRuntime','bedrock-agentcore:StopRuntimeSession'],
   Resource:[runtime.attrAgentRuntimeArn,endpoint.attrAgentRuntimeEndpointArn]}]}});
 const logKey=new kms.Key(stack,'LogKey',{description:'Meri AgentCore application log encryption',enableKeyRotation:true,removalPolicy:RemovalPolicy.RETAIN});
 logKey.addToResourcePolicy(new iam.PolicyStatement({principals:[new iam.ServicePrincipal(`logs.${REGION}.amazonaws.com`)],
  actions:['kms:Encrypt','kms:Decrypt','kms:ReEncrypt*','kms:GenerateDataKey*','kms:DescribeKey'],resources:['*'],
  conditions:{ArnLike:{'kms:EncryptionContext:aws:logs:arn':`${logPrefix}*`}}}));
 // Precreate both endpoint groups before invocation, so the service cannot create unencrypted groups.
 for(const name of ['DEFAULT',ENDPOINT])new logs.LogGroup(stack,`${name}Logs`,{
  logGroupName:`/aws/bedrock-agentcore/runtimes/${runtime.attrAgentRuntimeId}-${name}`,
  encryptionKey:logKey,retention:logs.RetentionDays.ONE_MONTH,removalPolicy:RemovalPolicy.RETAIN});
 new CfnOutput(stack,'RuntimeArn',{value:runtime.attrAgentRuntimeArn});
 new CfnOutput(stack,'RuntimeId',{value:runtime.attrAgentRuntimeId});
 new CfnOutput(stack,'RuntimeVersion',{value:qualifiedVersion.valueAsString});
 new CfnOutput(stack,'EndpointName',{value:ENDPOINT});
 new CfnOutput(stack,'RuntimeSecurityGroupId',{value:network.attrGroupId});
 return Template.fromStack(stack).toJSON();
}
