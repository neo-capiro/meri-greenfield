// @ts-check
/** Static CloudFormation sources for the infrastructure the native /2 composition needs BEFORE its observer and watchdog
 * (docs/qualification/native-release-composition-20261031.md): the Temporal worker task role, and the observer's private
 * network, encryption key and log group. The observer function, its numeric version and the watchdog graph are published by
 * the existing `compileNativeObserverTemplate` / `compileNativeWatchdogTemplate` (infra/browser-enforcement/native-template.mjs);
 * the worker and Control policies by `compileNativeRuntimePolicyTemplate`, attached to the role created here. No AWS client,
 * secret or deploy action lives here; no secret value or key material is part of any template. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const ACCOUNT='967807252336',REGION='us-east-1';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const REFUSED='NATIVE_PREREQUISITES_TEMPLATE_REFUSED';
const freezeTree=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTree(child);Object.freeze(value);}return value;};
const ID=prefix=>new RegExp(`^${prefix}-[0-9a-f]{8,17}$`,'u');
export const NATIVE_WORKER_TASK_ROLE_NAME='MeriPreview-native-worker-task';
export const NATIVE_OBSERVER_LOG_GROUP='/meri-greenfield/native-observer';
export const NATIVE_OBSERVER_KEY_ALIAS='alias/meri-greenfield/native-observer';
const tags=[{Key:'Project',Value:'meri-greenfield'},{Key:'meri',Value:'first-chat-preview'}];

/** The distinct ECS task role the Temporal worker runs as once `features.nativeProcessing` is enabled
 * (`foundation.WorkerTaskRoleArn`; the renderer refuses the control task role). It carries NO policy here: the reviewed worker
 * policy (`nativeWorkerPolicy`) is attached by `compileNativeRuntimePolicyTemplate` once the host AMIs, the instance role and
 * the watchdog version exist, so an unused role grants nothing. The trust is the foundation's `ecsTrust()`. */
export function compileNativeWorkerRoleTemplate(){
 return freezeTree({
  AWSTemplateFormatVersion:'2010-09-09',
  Description:'Meri native /2 Temporal worker task role: trust only, policies are attached by the native runtime policy template.',
  Resources:{NativeWorkerTaskRole:{Type:'AWS::IAM::Role',Properties:{RoleName:NATIVE_WORKER_TASK_ROLE_NAME,
   AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'ecs-tasks.amazonaws.com'},Action:'sts:AssumeRole',
    Condition:{StringEquals:{'aws:SourceAccount':ACCOUNT},ArnLike:{'aws:SourceArn':`arn:aws:ecs:${REGION}:${ACCOUNT}:*`}}}]},Tags:tags}}},
  Outputs:{NativeWorkerTaskRoleArn:{Value:{'Fn::GetAtt':['NativeWorkerTaskRole','Arn']},Description:'deployment.foundation.WorkerTaskRoleArn'},
   NativeWorkerTaskRoleName:{Value:{Ref:'NativeWorkerTaskRole'},Description:'workerRoleName of compileNativeRuntimePolicyTemplate'}},
 });
}

/** @param {unknown} raw */
export function validateNativeObserverPrerequisitesInput(raw){
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))fail(REFUSED);
 let v;
 try{v=own(raw,['endpointSecurityGroupId','privateAlbSecurityGroupId','vpcId'],['caseId']);}
 catch{fail(REFUSED);}
 const isCase=Object.hasOwn(v,'caseId');
 if(isCase&&(typeof v.caseId!=='string'||!/^[a-f0-9]{12}$/u.test(v.caseId)))fail(REFUSED);
 if(typeof v.vpcId!=='string'||!ID('vpc').test(v.vpcId)||typeof v.privateAlbSecurityGroupId!=='string'||!ID('sg').test(v.privateAlbSecurityGroupId)||
  typeof v.endpointSecurityGroupId!=='string'||!ID('sg').test(v.endpointSecurityGroupId)||v.privateAlbSecurityGroupId===v.endpointSecurityGroupId)fail(REFUSED);
 return Object.freeze({vpcId:v.vpcId,privateAlbSecurityGroupId:v.privateAlbSecurityGroupId,endpointSecurityGroupId:v.endpointSecurityGroupId,
  ...(isCase?{caseId:v.caseId}:{})});
}

/** The observer bridge's own surroundings (it reads one Secrets Manager version and posts one HMAC request to the pinned
 * private Control origin, nothing else): a dedicated rotating KMS key for that secret, the existing-log-group name the
 * observer template requires, and a security group with no ingress whose only egress is the private Control load balancer and
 * the VPC interface endpoints (Secrets Manager, KMS). The private load balancer accepts the bridge on 443 through one
 * additive ingress rule. @param {unknown} input */
export function compileNativeObserverPrerequisitesTemplate(input){
 const b=validateNativeObserverPrerequisitesInput(input);
 // Use the existing case prefix only for explicit validated own identity; ordinary exports and output refs stay unchanged.
 const isCase=Object.hasOwn(b,'caseId');
 const keyAlias=isCase?`alias/meri-case-${b.caseId}/native-observer`:NATIVE_OBSERVER_KEY_ALIAS;
 const logGroup=isCase?`/meri-case-${b.caseId}/native-observer`:NATIVE_OBSERVER_LOG_GROUP;
 return freezeTree({
  AWSTemplateFormatVersion:'2010-09-09',
  Description:'Meri native observer prerequisites: secret encryption key, log group, bridge security group and its private Control ingress rule.',
  Resources:{
   NativeObserverKey:{Type:'AWS::KMS::Key',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',Properties:{
    Description:'Encrypts the native observer material secret (observer HMAC key and private Control CA); read only by the observer role',
    EnableKeyRotation:true,KeyPolicy:{Version:'2012-10-17',Statement:[{Sid:'AccountAdministration',Effect:'Allow',
     Principal:{AWS:`arn:aws:iam::${ACCOUNT}:root`},Action:'kms:*',Resource:'*'}]},Tags:tags}},
   NativeObserverKeyAlias:{Type:'AWS::KMS::Alias',Properties:{AliasName:keyAlias,TargetKeyId:{Ref:'NativeObserverKey'}}},
   NativeObserverLogGroup:{Type:'AWS::Logs::LogGroup',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',Properties:{
    LogGroupName:logGroup,RetentionInDays:30,Tags:tags}},
   NativeObserverSecurityGroup:{Type:'AWS::EC2::SecurityGroup',Properties:{VpcId:b.vpcId,
    GroupDescription:'Meri native observer bridge: no ingress; private Control load balancer and VPC endpoints out',
    SecurityGroupEgress:[
     {IpProtocol:'tcp',FromPort:443,ToPort:443,DestinationSecurityGroupId:b.privateAlbSecurityGroupId,Description:'Private Control origin'},
     {IpProtocol:'tcp',FromPort:443,ToPort:443,DestinationSecurityGroupId:b.endpointSecurityGroupId,Description:'Secrets Manager and KMS interface endpoints'}],Tags:tags}},
   PrivateAlbFromNativeObserver:{Type:'AWS::EC2::SecurityGroupIngress',Properties:{GroupId:b.privateAlbSecurityGroupId,IpProtocol:'tcp',FromPort:443,ToPort:443,
    SourceSecurityGroupId:{Ref:'NativeObserverSecurityGroup'},Description:'Native observer bridge to the pinned private control origin'}},
  },
  Outputs:{
   NativeObserverKeyArn:{Value:{'Fn::GetAtt':['NativeObserverKey','Arn']},Description:'compileNativeObserverTemplate kmsKeyArn and the observer secret key'},
   NativeObserverLogGroupName:{Value:{Ref:'NativeObserverLogGroup'},Description:'compileNativeObserverTemplate logGroupName'},
   NativeObserverSecurityGroupId:{Value:{Ref:'NativeObserverSecurityGroup'},Description:'compileNativeObserverTemplate network.securityGroupIds'},
  },
 });
}
