/** Native /2 CloudFormation source through the existing template path. Compilers never call AWS or enable application producers. */
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalJson,canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {assertNativeObserver} from '../../packages/contracts/native-observer.mjs';
import {observerEntrypointConfiguration} from '../../apps/runtime/native-observer-entrypoint.mjs';
import {compileNativeDeployment} from '../../apps/runtime/native-deployment-configuration.mjs';
import {compileNativeWatchdogDefinition} from './workflow.mjs';
const ACCOUNT='967807252336',REGION='us-east-1',HEX=/^[a-f0-9]{64}$/u;
const fail=()=>{throw Error('NATIVE_DEPLOYMENT_TEMPLATE_REFUSED');};
const policy=Statement=>({Version:'2012-10-17',Statement});
const context=(why,must)=>({'com.aws.cloudformation.Context':{why,must}});
const base=description=>({AWSTemplateFormatVersion:'2010-09-09',Description:description,
 Metadata:{AWSToolsMetrics:{AWSAgentToolkit:'aws-cloudformation@3'},applicationEnabled:false},Resources:{},Outputs:{}});
const output=(Value,Description)=>({Value,Description});
function list(v,re,max=16){if(!Array.isArray(v)||!v.length||v.length>max||new Set(v).size!==v.length||v.some(x=>typeof x!=='string'||!re.test(x)))fail();return [...v];}
function enabled(raw,required){const r=own(raw,['enabled'],required);if(typeof r.enabled!=='boolean')fail();
 if(!r.enabled){if(Object.keys(r).length!==1)fail();return null;}return own(raw,['enabled',...required]);}
const machineArn=name=>`arn:aws:states:${REGION}:${ACCOUNT}:stateMachine:${name}`;
const executionArn=name=>`arn:aws:states:${REGION}:${ACCOUNT}:execution:${name}:*`;
const instanceArn=`arn:aws:ec2:${REGION}:${ACCOUNT}:instance/*`;
const regionCondition={StringEquals:{'aws:RequestedRegion':REGION}};
const reads=['ec2:DescribeInstances','ec2:DescribeVolumes','ec2:DescribeNetworkInterfaces'];
function owned(placement){return {StringEquals:{'aws:RequestedRegion':REGION,'ec2:ResourceTag/Project':'meri-greenfield',
 'ec2:ResourceTag/MeriPlacementSha256':hash(placement)},Null:Object.fromEntries(['MeriProvisionToken','MeriHostId','MeriGeneration','MeriAllocationSha256','MeriDeclarationSha256'].map(k=>[`ec2:ResourceTag/${k}`,'false']))};}

/** Publish observer first; take its returned numeric version into the graph compiler. No guessed version or publication cycle. */
export function compileNativeObserverTemplate(raw={enabled:false}){
 try{
  const t=base('Meri native observation bridge; no host launch, cleanup mutation or application activation.');
  const b=enabled(raw,['configuration','code','network','kmsKeyArn','logGroupName']);if(b===null)return t;
  const c=observerEntrypointConfiguration(b.configuration);
  if(!c.functionArn.startsWith(`arn:aws:lambda:${REGION}:${ACCOUNT}:function:`))fail();
  const code=own(b.code,['bucket','key','versionId','sha256']);
  if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(code.bucket)||typeof code.key!=='string'||!code.key||code.key.length>1024||
   typeof code.versionId!=='string'||!code.versionId||code.versionId==='null'||code.versionId.length>1024||!HEX.test(code.sha256))fail();
  const network=own(b.network,['privateSubnetIds','securityGroupIds']);
  list(network.privateSubnetIds,/^subnet-[a-f0-9]{8,17}$/u);list(network.securityGroupIds,/^sg-[a-f0-9]{8,17}$/u,5);
  if(!new RegExp(`^arn:aws:kms:${REGION}:${ACCOUNT}:key/[a-f0-9-]{36}$`,'u').test(b.kmsKeyArn)||
   typeof b.logGroupName!=='string'||!/^\/[A-Za-z0-9/._-]{1,500}$/u.test(b.logGroupName))fail();
  const functionName=c.functionArn.split(':').at(-1),logArn=`arn:aws:logs:${REGION}:${ACCOUNT}:log-group:${b.logGroupName}:*`;
  const eni=['ec2:CreateNetworkInterface','ec2:DescribeNetworkInterfaces','ec2:DescribeSubnets','ec2:DeleteNetworkInterface','ec2:AssignPrivateIpAddresses','ec2:UnassignPrivateIpAddresses'];
  t.Resources.NativeObserverRole={Type:'AWS::IAM::Role',Metadata:context('Dedicated bridge execution role; Lambda manages VPC interfaces.',[
   'One exact secret version; code cannot mutate EC2, invoke Lambda, use Step Functions or change IAM.','Review effective policies and private network before publication.']),Properties:{
   AssumeRolePolicyDocument:policy([{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]),
   Policies:[{PolicyName:'NativeObserverOnly',PolicyDocument:policy([
    {Effect:'Allow',Action:['secretsmanager:GetSecretValue'],Resource:c.secretArn,Condition:{StringEquals:{'secretsmanager:VersionId':c.secretVersionId,'aws:RequestedRegion':REGION}}},
    {Effect:'Allow',Action:['kms:Decrypt'],Resource:b.kmsKeyArn,Condition:{StringEquals:{'kms:ViaService':`secretsmanager.${REGION}.amazonaws.com`,'kms:EncryptionContext:SecretARN':c.secretArn}}},
    {Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:logArn},
    {Effect:'Allow',Action:eni,Resource:'*',Condition:regionCondition},
    {Effect:'Deny',Action:['ec2:*','states:*','iam:*','lambda:*'],Resource:'*',Condition:{ArnEquals:{'lambda:SourceFunctionArn':c.functionArn}}},
   ])}],Tags:[{Key:'Project',Value:'meri-greenfield'}]}};
  t.Resources.NativeObserver={Type:'AWS::Lambda::Function',Metadata:context('Synchronous private observer with immutable secret and source pins.',[
   'No event source, function URL, async destination or mutable alias.','Package includes pinned SDK dependencies; private key bytes never enter the template.']),Properties:{
   FunctionName:functionName,Runtime:'nodejs24.x',Architectures:['arm64'],Handler:'apps/runtime/native-observer-entrypoint.handler',
   Code:{S3Bucket:code.bucket,S3Key:code.key,S3ObjectVersion:code.versionId},Role:{'Fn::GetAtt':['NativeObserverRole','Arn']},
   MemorySize:128,Timeout:30,ReservedConcurrentExecutions:4,LoggingConfig:{LogGroup:b.logGroupName},
   Environment:{Variables:{MERI_NATIVE_OBSERVER_CONFIG:JSON.stringify(c)}},
   VpcConfig:{SubnetIds:network.privateSubnetIds,SecurityGroupIds:network.securityGroupIds,Ipv6AllowedForDualStack:false},
   Tags:[{Key:'Project',Value:'meri-greenfield'}]}};
  t.Resources.NativeObserverVersion={Type:'AWS::Lambda::Version',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',
   Metadata:context('Retain exact published code/config for original cleanup contexts.',['Never repoint historical generations or infer a numeric version.']),
   Properties:{FunctionName:{Ref:'NativeObserver'},CodeSha256:Buffer.from(code.sha256,'hex').toString('base64'),Description:`Native observer configuration ${hash(c)}`}};
  t.Outputs.NativeObserverVersionArn=output({Ref:'NativeObserverVersion'},'Actual numeric version for the graph and protected deployment declaration.');
  t.Outputs.NativeObserverRoleArn=output({'Fn::GetAtt':['NativeObserverRole','Arn']},'Dedicated execution role for effective-policy review.');
  return t;
 }catch{fail();}
}

/** Uses the already published observer version. The only host mutation is scoped termination by the original watchdog. */
export function compileNativeWatchdogTemplate(raw={enabled:false}){
 try{
  const t=base('Meri native /2 Standard watchdog; original lease and cleanup bounds; no start, redrive or producer activation.');
  const b=enabled(raw,['name','deployment']);if(b===null)return t;
  if(typeof b.name!=='string'||!/^[A-Za-z0-9_-]{1,80}$/u.test(b.name))fail();
  const d=compileNativeDeployment(b.deployment);if(d.accountId!==ACCOUNT||d.region!==REGION)fail();
  const observer=assertNativeObserver(d.physicalObserver,d),definition=compileNativeWatchdogDefinition({physicalObserver:observer});
  const arn=machineArn(b.name);
  t.Metadata.definitionSha256=hash(definition);
  t.Resources.NativeWatchdogRole={Type:'AWS::IAM::Role',Metadata:context('Only this Standard machine can use the cleanup role.',[
   'No StartExecution, RedriveExecution, StopExecution, launch, tagging or IAM rights.','Exact versioned observer invocation; actual identity/resource policies remain Release-qualified.']),Properties:{
   AssumeRolePolicyDocument:policy([{Effect:'Allow',Principal:{Service:'states.amazonaws.com'},Action:'sts:AssumeRole',
    Condition:{StringEquals:{'aws:SourceAccount':ACCOUNT},ArnEquals:{'aws:SourceArn':arn}}}]),
   Policies:[{PolicyName:'OriginalNativeCleanupOnly',PolicyDocument:policy([
    {Effect:'Allow',Action:reads,Resource:'*',Condition:regionCondition},
    {Effect:'Allow',Action:['ec2:TerminateInstances'],Resource:instanceArn,Condition:owned(d.placement)},
    {Effect:'Allow',Action:['lambda:InvokeFunction'],Resource:observer.bridgeFunctionVersionArn},
   ])}]}};
  t.Resources.NativeWatchdog={Type:'AWS::StepFunctions::StateMachine',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',
   Metadata:context('Existing native /2 graph with its original physical observer and finite cleanup window.',[
    'No retry/redrive controller; UNKNOWN remains unresolved.','Publishing is not a host launch or cleanup receipt.']),
   Properties:{StateMachineName:b.name,StateMachineType:'STANDARD',RoleArn:{'Fn::GetAtt':['NativeWatchdogRole','Arn']},DefinitionString:canonicalJson(definition),
    Tags:[{Key:'Project',Value:'meri-greenfield'}]}};
  t.Resources.NativeWatchdogVersion={Type:'AWS::StepFunctions::StateMachineVersion',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',
   Metadata:context('Pin exact graph revision; preserve historical executions.',['Record returned version and compare the complete definition before worker activation.']),
   Properties:{StateMachineArn:{Ref:'NativeWatchdog'},StateMachineRevisionId:{'Fn::GetAtt':['NativeWatchdog','StateMachineRevisionId']},Description:`Native graph ${hash(definition)}`}};
  t.Outputs.NativeWatchdogVersionArn=output({Ref:'NativeWatchdogVersion'},'Actual numeric graph version, never an alias.');
  t.Outputs.NativeWatchdogDefinitionSha256=output(hash(definition),'Expected SHA-256 of the exact UTF-8 DefinitionString; verify unchanged numeric-version DescribeStateMachine.definition bytes before rendering worker material.');
  return t;
 }catch{fail();}
}

/** Additional Control observation/ordinary cleanup rights, scoped to the selected deployment and original machine name. */
export function nativeControlPolicy({deployment,stateMachineName}){
 const d=compileNativeDeployment(deployment);
 if(d.accountId!==ACCOUNT||d.region!==REGION||typeof stateMachineName!=='string'||!/^[A-Za-z0-9_-]{1,80}$/u.test(stateMachineName))fail();
 return policy([{Effect:'Allow',Action:reads,Resource:'*',Condition:regionCondition},
  {Effect:'Allow',Action:['ec2:TerminateInstances'],Resource:instanceArn,Condition:owned(d.placement)},
  {Effect:'Allow',Action:['states:DescribeExecution','states:GetExecutionHistory'],Resource:executionArn(stateMachineName)}]);
}

/** Source proposal for the existing worker role. IAM does not replace the durable single-use launch/SSM/graph owners. */
export function nativeWorkerPolicy({deployment,stateMachineVersionArn,instanceRoleArn}){
 const d=compileNativeDeployment(deployment);
 const machine=new RegExp(`^arn:aws:states:${REGION}:${ACCOUNT}:stateMachine:([A-Za-z0-9_-]{1,80}):[1-9][0-9]*$`,'u').exec(stateMachineVersionArn??'');
 if(d.accountId!==ACCOUNT||d.region!==REGION||!machine||
  !new RegExp(`^arn:aws:iam::${ACCOUNT}:role/[A-Za-z0-9_+=,.@/-]{1,512}$`,'u').test(instanceRoleArn??''))fail();
 const ec2=`arn:aws:ec2:${REGION}:${ACCOUNT}:`,volume=ec2+'volume/*';
 const tagKeys=['Project','MeriProvisionToken','MeriHostId','MeriGeneration','MeriPlacementSha256','MeriAllocationSha256','MeriDeclarationSha256'];
 const requestTags={StringEquals:{'aws:RequestedRegion':REGION,'aws:RequestTag/Project':'meri-greenfield','aws:RequestTag/MeriPlacementSha256':hash(d.placement)},
  'ForAllValues:StringEquals':{'aws:TagKeys':tagKeys},Null:{'aws:TagKeys':'false',...Object.fromEntries(tagKeys.map(k=>[`aws:RequestTag/${k}`,'false']))}};
 const sendTags={StringEquals:{'aws:RequestedRegion':REGION,'ssm:resourceTag/Project':'meri-greenfield','ssm:resourceTag/MeriPlacementSha256':hash(d.placement)}};
 return policy([
  {Effect:'Allow',Action:['ec2:DescribeInstances'],Resource:'*',Condition:regionCondition},
  {Effect:'Allow',Action:['ec2:RunInstances'],Resource:[`arn:aws:ec2:${REGION}::image/${d.launch.ImageId}`,ec2+`subnet/${d.placement.subnetId}`,
   ...d.placement.securityGroupIds.map(id=>ec2+`security-group/${id}`),ec2+'network-interface/*'],Condition:regionCondition},
  {Effect:'Allow',Action:['ec2:RunInstances'],Resource:instanceArn,Condition:{...requestTags,StringEquals:{...requestTags.StringEquals,
   'ec2:InstanceType':d.launch.InstanceType,'ec2:InstanceProfile':`arn:aws:iam::${ACCOUNT}:instance-profile/${d.placement.iamInstanceProfile}`}}},
  {Effect:'Allow',Action:['ec2:RunInstances'],Resource:volume,Condition:{...requestTags,Bool:{'ec2:Encrypted':'true'}}},
  {Effect:'Allow',Action:['ec2:CreateTags'],Resource:[instanceArn,volume],Condition:{...requestTags,StringEquals:{...requestTags.StringEquals,'ec2:CreateAction':'RunInstances'}}},
  {Effect:'Allow',Action:['iam:PassRole'],Resource:instanceRoleArn,Condition:{StringEquals:{'iam:PassedToService':'ec2.amazonaws.com'}}},
  {Effect:'Allow',Action:['ssm:SendCommand'],Resource:`arn:aws:ssm:${REGION}:${ACCOUNT}:document/${d.bootstrapSpec.document.name}`,Condition:regionCondition},
  {Effect:'Allow',Action:['ssm:SendCommand'],Resource:instanceArn,Condition:sendTags},
  {Effect:'Allow',Action:['ssm:GetCommandInvocation'],Resource:'*',Condition:regionCondition},
  {Effect:'Allow',Action:['states:DescribeStateMachine','states:StartExecution'],Resource:stateMachineVersionArn},
  {Effect:'Allow',Action:['states:DescribeExecution'],Resource:executionArn(machine[1])},
 ]);
}

export function compileNativeRuntimePolicyTemplate(raw={enabled:false}){
 try{
  const t=base('Additional native /2 policies on existing Control and Temporal worker roles; no role creation or application enablement.');
  const b=enabled(raw,['deployment','stateMachineVersionArn','instanceRoleArn','controlRoleName','workerRoleName']);if(b===null)return t;
  for(const name of [b.controlRoleName,b.workerRoleName])if(typeof name!=='string'||!/^[A-Za-z0-9_+=,.@-]{1,64}$/u.test(name))fail();
  if(b.controlRoleName===b.workerRoleName)fail();
  const worker=nativeWorkerPolicy(b),machine=b.stateMachineVersionArn.split(':').at(-2);
  t.Resources.NativeControlPolicy={Type:'AWS::IAM::Policy',Metadata:context('Existing Control owns original physical observation and ordinary cleanup.',[
   'No launch, SSM dispatch, redrive or graph mutation; retain policies required by unresolved historical contexts.']),
   Properties:{PolicyName:'NativePhysicalObservation',Roles:[b.controlRoleName],PolicyDocument:nativeControlPolicy({deployment:b.deployment,stateMachineName:machine})}};
  t.Resources.NativeWorkerPolicy={Type:'AWS::IAM::Policy',Metadata:context('Existing worker owns reviewed /2 provisioning and exact-version watchdog admission.',[
   'No direct termination or redrive. RunInstances tagging is instance and root-volume only.','Match instance profile membership, document version/hash, network, source/image and effective policies before activation.']),
   Properties:{PolicyName:'NativeOriginalProvisioning',Roles:[b.workerRoleName],PolicyDocument:worker}};
  return t;
 }catch{fail();}
}
