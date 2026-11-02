// @ts-check
/** Static CloudFormation source for the PROVISIONED browser-only hosts (one per conversation run, launched and destroyed by
 * the worker's native host coordinator, never by this stack): the shared security group, the instance role and profile
 * and the log group every browser host instance uses. The per-run instance itself is a `RunInstances` call whose launch
 * inputs (`features.nativeProcessing.browserDeployment.launch`) reference these resources by id. No AWS client, deploy
 * action or secret lives here; the executor renders and reviews this template, then creates the stack through Release. */
import {HOST_ACCOUNT,HOST_REGION} from './binding.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const REFUSED='PROVISIONED_BROWSER_HOST_TEMPLATE_REFUSED';
/** One pinned listener per host: viewer, named browser operations and the Control lifecycle route share it. */
export const BROWSER_HOST_LISTENER_PORT=9444;
const ID=/^(vpc|sg)-[0-9a-f]{8,17}$/u;
const CIDR=/^(?:10|172|192)\.(?:\d{1,3})\.(?:\d{1,3})\.(?:\d{1,3})\/(?:1[6-9]|2[0-8])$/u;
const REPOSITORY=/^meri-greenfield\/[a-z0-9-]{1,64}$/u;
const LOG_GROUP=/^\/meri-greenfield\/[a-z0-9/-]{1,120}$/u;
const freezeTree=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTree(child);Object.freeze(value);}return value;};

/** @param {unknown} raw */
export function validateProvisionedBrowserHostInput(raw){
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))fail(REFUSED);
 const v=/** @type {Record<string,unknown>} */(raw);
 const keys=Object.keys(v).sort();
 if(keys.join(',')!=='controlSecurityGroupId,imageRepository,logGroupName,vpcCidr,vpcId')fail(REFUSED);
 if(typeof v.vpcId!=='string'||!ID.test(v.vpcId)||!v.vpcId.startsWith('vpc-')||typeof v.controlSecurityGroupId!=='string'||
  !ID.test(v.controlSecurityGroupId)||!v.controlSecurityGroupId.startsWith('sg-')||typeof v.vpcCidr!=='string'||!CIDR.test(v.vpcCidr)||
  typeof v.imageRepository!=='string'||!REPOSITORY.test(v.imageRepository)||typeof v.logGroupName!=='string'||!LOG_GROUP.test(v.logGroupName))fail(REFUSED);
 return Object.freeze({vpcId:v.vpcId,vpcCidr:v.vpcCidr,controlSecurityGroupId:v.controlSecurityGroupId,imageRepository:v.imageRepository,logGroupName:v.logGroupName});
}

/** @param {unknown} input */
export function compileProvisionedBrowserHostTemplate(input){
 const b=validateProvisionedBrowserHostInput(input);
 const tags=[{Key:'Project',Value:'meri-greenfield'},{Key:'MeriHostPurpose',Value:'browser-only'}];
 const ecrArn=`arn:aws:ecr:${HOST_REGION}:${HOST_ACCOUNT}:repository/${b.imageRepository}`;
 const logStreamArn=`arn:aws:logs:${HOST_REGION}:${HOST_ACCOUNT}:log-group:${b.logGroupName}:log-stream:*`;
 const region={StringEquals:{'aws:RequestedRegion':HOST_REGION}};
 return freezeTree({
  AWSTemplateFormatVersion:'2010-09-09',
  Description:'Meri provisioned browser-only hosts: shared security group, instance role/profile and log group. Instances are launched per conversation run by the worker coordinator and destroyed by Control.',
  Metadata:{hostPurpose:'browser-only',listenerPort:BROWSER_HOST_LISTENER_PORT,instanceType:'c7g.large',architecture:'arm64',
   note:'The per-run instance is not a stack resource. browserDeployment.launch carries exactly ImageId, InstanceType, SubnetId, SecurityGroupIds and IamInstanceProfile:{Name} (compileNativeDeployment refuses other keys); IMDSv2 with hop limit 1, the encrypted gp3 root volume and terminate-on-shutdown come from the browser host AMI and the account instance defaults, and the qualification host readback (runbook 4c) verifies them.'},
  Resources:{
   BrowserHostLogGroup:{Type:'AWS::Logs::LogGroup',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',Properties:{
    LogGroupName:b.logGroupName,RetentionInDays:7,Tags:tags}},
   BrowserHostSecurityGroup:{Type:'AWS::EC2::SecurityGroup',Properties:{
    VpcId:b.vpcId,GroupDescription:'Meri browser-only host: Control-only listener, public web through the host egress proxy',
    // Ingress: only Control reaches the one pinned listener (viewer, browser operations, lifecycle route).
    SecurityGroupIngress:[{IpProtocol:'tcp',FromPort:BROWSER_HOST_LISTENER_PORT,ToPort:BROWSER_HOST_LISTENER_PORT,
     SourceSecurityGroupId:b.controlSecurityGroupId,Description:'Control to the pinned host listener'}],
    // Egress: Control currentness, VPC DNS, and the public web. The security group is one layer: the run policy decides
    // every connection in the supervisor, and the host nft guard (network/proxy-guard.mjs) confines the proxy uid to
    // public TCP 80/443, dropping private, link-local and metadata ranges on the host itself.
    SecurityGroupEgress:[
     {IpProtocol:'tcp',FromPort:443,ToPort:443,DestinationSecurityGroupId:b.controlSecurityGroupId,Description:'Host to the Control private listener'},
     {IpProtocol:'udp',FromPort:53,ToPort:53,CidrIp:b.vpcCidr,Description:'VPC resolver'},
     {IpProtocol:'tcp',FromPort:53,ToPort:53,CidrIp:b.vpcCidr,Description:'VPC resolver (TCP fallback)'},
     {IpProtocol:'tcp',FromPort:443,ToPort:443,CidrIp:'0.0.0.0/0',Description:'Public web (HTTPS) through the host egress proxy'},
     {IpProtocol:'tcp',FromPort:80,ToPort:80,CidrIp:'0.0.0.0/0',Description:'Public web (HTTP) through the host egress proxy'},
    ],Tags:tags}},
   BrowserHostRole:{Type:'AWS::IAM::Role',Properties:{
    AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'ec2.amazonaws.com'},Action:'sts:AssumeRole',
     Condition:{StringEqualsIfExists:{'aws:SourceAccount':HOST_ACCOUNT}}}]},
    // SSM core for the bootstrap document (prepare/install) and nothing else from AWS: the host never calls EC2, S3 or STS.
    ManagedPolicyArns:['arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'],
    Policies:[{PolicyName:'BrowserHostImageAndOwnLogs',PolicyDocument:{Version:'2012-10-17',Statement:[
     {Effect:'Allow',Action:'ecr:GetAuthorizationToken',Resource:'*',Condition:region},
     {Effect:'Allow',Action:['ecr:BatchCheckLayerAvailability','ecr:BatchGetImage','ecr:GetDownloadUrlForLayer'],Resource:ecrArn,Condition:region},
     {Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:logStreamArn,Condition:region},
    ]}}],Tags:tags}},
   BrowserHostInstanceProfile:{Type:'AWS::IAM::InstanceProfile',Properties:{Roles:[{Ref:'BrowserHostRole'}]}},
  },
  Outputs:{
   BrowserHostSecurityGroupId:{Value:{Ref:'BrowserHostSecurityGroup'},Description:'browserDeployment.launch.SecurityGroupIds[0]'},
   BrowserHostInstanceProfileName:{Value:{Ref:'BrowserHostInstanceProfile'},Description:'browserDeployment.launch.IamInstanceProfile.Name and placement.iamInstanceProfile'},
   BrowserHostInstanceProfileArn:{Value:{'Fn::GetAtt':['BrowserHostInstanceProfile','Arn']},Description:'For the role inventory only; the launch input takes the Name'},
   BrowserHostLogGroupName:{Value:{Ref:'BrowserHostLogGroup'}},
  },
 });
}
