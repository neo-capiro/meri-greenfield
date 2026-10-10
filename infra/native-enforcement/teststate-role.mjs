// Dedicated read-only service-wire qualification. No deployment or API calls.
export const TESTSTATE_ROLE_NAME = 'MeriGreenfield-TestStateReadOnly-20261010';
export const TESTSTATE_STACK_NAME = 'MeriGreenfield-TestStateReadOnly';
const account = '967807252336';
const region = 'us-east-1';
const cluster = `arn:aws:ecs:${region}:${account}:cluster/meri-greenfield-qualification`;

export function buildTestStateRoleTemplate() {
  return {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'Independent Meri G1 read-only Step Functions wire qualification',
    Resources: {
      ReadOnlyTestStateRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
          RoleName: TESTSTATE_ROLE_NAME,
          MaxSessionDuration: 3600,
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow', Principal: { Service: 'states.amazonaws.com' },
              Action: 'sts:AssumeRole',
              Condition: { StringEquals: { 'aws:SourceAccount': account } },
            }],
          },
          Policies: [{
            PolicyName: 'QualificationMetadataOnly',
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                { Effect: 'Allow', Action: 'ecs:ListTasks', Resource: '*',
                  Condition: { ArnEquals: { 'ecs:cluster': cluster } } },
                { Effect: 'Allow', Action: 'ecs:DescribeTasks',
                  Resource: `arn:aws:ecs:${region}:${account}:task/meri-greenfield-qualification/*`,
                  Condition: { ArnEquals: { 'ecs:cluster': cluster } } },
                { Effect: 'Allow', Action: 'ec2:DescribeNetworkInterfaces', Resource: '*',
                  Condition: { StringEquals: { 'aws:RequestedRegion': region } } },
                { Effect: 'Allow', Action: 'sts:GetCallerIdentity', Resource: '*' },
              ],
            },
          }],
          Tags: [{ Key: 'MeriComponent', Value: 'qualification-read-only' }],
        },
      },
    },
    Outputs: { RoleArn: { Value: { 'Fn::GetAtt': ['ReadOnlyTestStateRole', 'Arn'] } } },
  };
}
