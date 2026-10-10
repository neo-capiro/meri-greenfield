import { buildNativeEnforcementAdmission,buildCanaryEnforcementAdmission,isCompiledBinding,isCanaryBinding,assertCanaryBoundary,prefix,check } from './binding.mjs';
import { buildNativeEnforcementStateMachine,buildCanaryEnforcementStateMachine } from './workflow.mjs';
import { PROFILE_NATIVE,PROFILE_CANARY } from './probe-profiles.mjs';
// Shared inert template builder. The closed mode is selected by private provenance, so a
// canary binding never produces the native two-definition policy and vice versa. The native
// profile preserves legacy role-bearing policy bytes; explicit role-free native
// bindings pass only the execution role.
function buildEnforcementTemplate(binding,profile){
 const ok=profile.mode==='canary'?isCanaryBinding(binding):(isCompiledBinding(binding)&&!isCanaryBinding(binding));
 check(ok,'complete static preparation required');if(profile.mode==='canary')assertCanaryBoundary();const p=binding.pins, taskResource=`${prefix}task/${p.clusterArn.split('/')[1]}/*`;
 const machineArn=`arn:aws:states:${p.region}:${p.account}:stateMachine:${p.stateMachineName}`;
 // StopTask stays conditioned on the CURRENT resource tags (no permission broadening).
 // Owner decision: the role-free/empty-policy worker cannot mutate tags; the trusted owner must preserve
 // the required tags/authority until the stop request. A required tag deleted before
 // containment (or out-of-band administrator mutation) leaves the retained positive
 // ledger unable to satisfy this condition and MUST stay CLEANUP_UNKNOWN, blocking the
 // next admission. Retained original ownership never bypasses live IAM. Post-stop tag
 // deletion may still allow exact-bound terminal confirmation. Condition/key support and
 // real tag propagation remain unqualified service facts, not established by this source.
 const requestTags={'aws:RequestTag/QualificationRun':p.runUuid,'aws:RequestTag/MeriComponent':'native-enforcement','aws:RequestTag/QualificationProbe':profile.probeTags};
 const runTaskResource=profile.mode==='canary'?[p.taskDefinitionArns.canary]:Object.values(p.taskDefinitionArns);
 const policy={Version:'2012-10-17',Statement:[
  {Effect:'Allow',Action:'ecs:RunTask',Resource:runTaskResource,Condition:{ArnEquals:{'ecs:cluster':p.clusterArn},StringEquals:requestTags,Bool:{'ecs:enable-execute-command':'false'},'ForAllValues:StringEquals':{'aws:TagKeys':['QualificationRun','QualificationProbe','MeriComponent']}}},
  {Effect:'Allow',Action:'ecs:TagResource',Resource:taskResource,Condition:{StringEquals:{'ecs:CreateAction':'RunTask',...requestTags}}},
  {Effect:'Allow',Action:'iam:PassRole',Resource:p.workerRoleArn===null?[p.executionRoleArn]:[p.executionRoleArn,p.workerRoleArn],Condition:{StringEquals:{'iam:PassedToService':'ecs-tasks.amazonaws.com'}}},
  {Effect:'Allow',Action:'ecs:StopTask',Resource:taskResource,Condition:{ArnEquals:{'ecs:cluster':p.clusterArn},StringEquals:{'aws:ResourceTag/QualificationRun':p.runUuid,'aws:ResourceTag/MeriComponent':'native-enforcement'}}},
  {Effect:'Allow',Action:'ecs:DescribeTasks',Resource:taskResource,Condition:{ArnEquals:{'ecs:cluster':p.clusterArn}}},
  {Effect:'Allow',Action:'ecs:ListTasks',Resource:'*',Condition:{ArnEquals:{'ecs:cluster':p.clusterArn}}},
  {Effect:'Allow',Action:'ec2:DescribeNetworkInterfaces',Resource:'*',Condition:{StringEquals:{'aws:RequestedRegion':p.region}}},
  {Effect:'Allow',Action:'sts:GetCallerIdentity',Resource:'*'}]};
 return {AWSTemplateFormatVersion:'2010-09-09',Description:'INERT dedicated native qualification; no application/control relocation',Metadata:{staticBindingId:binding.staticBindingId,runtimeEnabled:binding.runtimeEnabled,finalHashes:'external owner admission only'},Resources:{NativeEnforcementRole:{Type:'AWS::IAM::Role',Properties:{RoleName:p.managedRoleName,AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'states.amazonaws.com'},Action:'sts:AssumeRole',Condition:{StringEquals:{'aws:SourceAccount':p.account},ArnEquals:{'aws:SourceArn':machineArn}}}]},Policies:[{PolicyName:'ExactQualificationRun',PolicyDocument:policy}]}},NativeEnforcementMachine:{Type:'AWS::StepFunctions::StateMachine',Properties:{StateMachineName:p.stateMachineName,StateMachineType:'STANDARD',RoleArn:{'Fn::GetAtt':['NativeEnforcementRole','Arn']},Definition:profile.mode==='canary'?buildCanaryEnforcementStateMachine(binding):buildNativeEnforcementStateMachine(binding)}}}};
}

// Native entry point: unchanged behavior (inert default refuses).
export function buildNativeEnforcementTemplate(binding=buildNativeEnforcementAdmission()){
 return buildEnforcementTemplate(binding,PROFILE_NATIVE);
}

// Canary entry point: single canary-revision policy scope; native bindings are refused.
export function buildCanaryEnforcementTemplate(binding=buildCanaryEnforcementAdmission()){
 return buildEnforcementTemplate(binding,PROFILE_CANARY);
}
