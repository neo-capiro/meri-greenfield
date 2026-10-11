// Existing STANDARD qualification component; inert proposed CFN, no clients.
import { FIXTURE as F, fixtureTags, fixtureMachineName, validateFixtureBinding } from './fixture-volume-binding.mjs';
import { compileFixtureWorkflow } from './fixture-volume-workflow.mjs';

export function compileFixtureTemplate(input) {
  const b = input === undefined ? null : validateFixtureBinding(input);
  const name = b ? fixtureMachineName() : 'MeriGF-BrowserFixture-SOURCE-ONLY';
  const machineArn = `arn:aws:states:${F.region}:${F.account}:stateMachine:${name}`;
  const tagValues = Object.fromEntries(fixtureTags().map(t => [t.Key, t.Value]));
  const region = { 'aws:RequestedRegion': F.region };
  const policies = b ? [{ PolicyName: 'OneEmptyFixtureLifecycle', PolicyDocument: { Version: '2012-10-17', Statement: [
    { Effect: 'Allow', Action: ['ec2:DescribeVolumes'], Resource: '*', Condition: { StringEquals: region } },
    { Effect: 'Allow', Action: ['ec2:CreateVolume'], Resource: `arn:aws:ec2:${F.region}:${F.account}:volume/*`,
      Condition: { StringEquals: { ...region, 'ec2:AvailabilityZone': F.az, 'ec2:VolumeType': 'gp3',
        ...Object.fromEntries(Object.entries(tagValues).map(([k,v]) => [`aws:RequestTag/${k}`,v])) },
        Bool: { 'ec2:Encrypted': 'true' }, NumericEquals: { 'ec2:VolumeSize': '1' },
        'ForAllValues:StringEquals': { 'aws:TagKeys': Object.keys(tagValues) } } },
    { Effect: 'Allow', Action: ['ec2:CreateTags'], Resource: `arn:aws:ec2:${F.region}:${F.account}:volume/*`,
      Condition: { StringEquals: { ...region, 'ec2:CreateAction': 'CreateVolume',
        ...Object.fromEntries(Object.entries(tagValues).map(([k,v]) => [`aws:RequestTag/${k}`,v])) },
        'ForAllValues:StringEquals': { 'aws:TagKeys': Object.keys(tagValues) } } },
    { Effect: 'Allow', Action: ['ec2:DeleteVolume'], Resource: `arn:aws:ec2:${F.region}:${F.account}:volume/*`,
      Condition: { StringEquals: { ...region,
        ...Object.fromEntries(Object.entries(tagValues).map(([k,v]) => [`ec2:ResourceTag/${k}`,v])) } } },
    { Effect: 'Allow', Action: ['kms:Decrypt', 'kms:DescribeKey', 'kms:GenerateDataKeyWithoutPlaintext', 'kms:ReEncryptFrom', 'kms:ReEncryptTo'],
      Resource: F.keyArn, Condition: { StringEquals: { ...region, 'kms:ViaService': `ec2.${F.region}.amazonaws.com`, 'kms:CallerAccount': F.account } } },
    { Effect: 'Allow', Action: ['kms:CreateGrant'], Resource: F.keyArn,
      Condition: { StringEquals: { ...region, 'kms:ViaService': `ec2.${F.region}.amazonaws.com`, 'kms:CallerAccount': F.account },
        Bool: { 'kms:GrantIsForAWSResource': 'true' } } },
  ] } }] : [];
  return { AWSTemplateFormatVersion: '2010-09-09', Description: 'INERT single-owner empty fixture lifecycle source proposal',
    Metadata: { runtimeEnabled: false, absenceWireQualified: false, managedSurvivalQualified: false, wireProfile: F.wireProfile,
      binding: b, localSource9MutationPathExcluded: true, originalCeilingMs: F.ceilingMs },
    Resources: {
      FixtureRole: { Type: 'AWS::IAM::Role', Properties: {
        AssumeRolePolicyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Service: 'states.amazonaws.com' },
          Action: 'sts:AssumeRole', Condition: { StringEquals: { 'aws:SourceAccount': F.account }, ArnEquals: { 'aws:SourceArn': machineArn } } }] },
        ...(b ? { Policies: policies } : {}),
      } },
      FixtureLifecycle: { Type: 'AWS::StepFunctions::StateMachine', Properties: {
        StateMachineType: 'STANDARD', StateMachineName: name, RoleArn: { 'Fn::GetAtt': ['FixtureRole', 'Arn'] },
        Definition: compileFixtureWorkflow(input), Tags: [{ Key: 'Project', Value: 'meri-greenfield' },
          { Key: 'QualificationOnly', Value: 'true' }, { Key: 'QualificationRun', Value: F.runUuid }],
      } },
    } };
}
