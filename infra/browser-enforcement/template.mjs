// Inert CloudFormation DATA assembly; never calls CDK, AWS or a shell.
import { FIXED, machineName, validateBinding } from './binding.mjs';
import { compileWatchdog } from './workflow.mjs';

export function compileTemplate(input) {
  const b = input === undefined ? null : validateBinding(input);
  const name = b ? machineName(b) : 'MeriGreenfield-BrowserWatchdog-SOURCE-ONLY';
  const arn = `arn:aws:states:${FIXED.region}:${FIXED.account}:stateMachine:${name}`;
  const statements = b ? [
    { Effect: 'Allow', Action: ['ec2:DescribeInstances', 'ec2:DescribeVolumes'], Resource: '*',
      Condition: { StringEquals: { 'aws:RequestedRegion': FIXED.region } } },
    { Effect: 'Allow', Action: ['ec2:TerminateInstances'],
      Resource: `arn:aws:ec2:${FIXED.region}:${FIXED.account}:instance/*`,
      Condition: { StringEquals: {
        'aws:RequestedRegion': FIXED.region,
        'ec2:ResourceTag/QualificationRun': b.runUUID,
        'ec2:ResourceTag/aws:cloudformation:stack-id': b.stackId,
        'ec2:ResourceTag/aws:cloudformation:logical-id': FIXED.logicalId,
      } } },
  ] : [];
  return {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'INERT browser-specific Standard watchdog preparation; owner deployment and launch admission absent',
    Metadata: { runtimeEnabled: false, wireProfile: FIXED.wireProfile,
      rootAbsenceWireQualified: false, ownerBinding: b, originalCeilingMs: FIXED.ceilingMs },
    Resources: {
      WatchdogRole: { Type: 'AWS::IAM::Role', Properties: {
        AssumeRolePolicyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Allow',
          Principal: { Service: 'states.amazonaws.com' }, Action: 'sts:AssumeRole',
          Condition: { StringEquals: { 'aws:SourceAccount': FIXED.account }, ArnEquals: { 'aws:SourceArn': arn } },
        }] },
        ...(b ? { Policies: [{ PolicyName: 'OnlyReviewedBrowserCleanup', PolicyDocument: { Version: '2012-10-17', Statement: statements } }] } : {}),
      } },
      Watchdog: { Type: 'AWS::StepFunctions::StateMachine', Properties: {
        StateMachineType: 'STANDARD', StateMachineName: name,
        RoleArn: { 'Fn::GetAtt': ['WatchdogRole', 'Arn'] }, Definition: compileWatchdog(input),
        Tags: [{ Key: 'Project', Value: 'meri-greenfield' }, { Key: 'QualificationOnly', Value: 'true' },
          ...(b ? [{ Key: 'QualificationRun', Value: b.runUUID }] : [])],
      } },
    },
  };
}
