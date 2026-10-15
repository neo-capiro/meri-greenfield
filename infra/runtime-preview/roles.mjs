import {ref,sub,attr,taskTrust,policy,statement,tags} from './common.mjs';

export const roleNames=['control','poller','proxy','temporal','runner','relay'];
export const roleId=name=>name[0].toUpperCase()+name.slice(1);
export function buildRoles(){
  const resources={};
  for(const name of roleNames){
    const id=roleId(name),log=sub('arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/meri/runtime-preview/'+name+':*');
    resources[id+'ExecutionRole']={Type:'AWS::IAM::Role',Properties:{RoleName:'meri-runtime-preview-'+name+'-execution',AssumeRolePolicyDocument:taskTrust(),Tags:tags(),Policies:[{PolicyName:'ExactImageLogsAndBootstrap',PolicyDocument:policy([
      statement(['ecr:GetAuthorizationToken'],'*',{StringEquals:{'aws:RequestedRegion':'us-east-1'}}),
      statement(['ecr:BatchGetImage','ecr:GetDownloadUrlForLayer','ecr:BatchCheckLayerAvailability'],ref('ImageRepositoryArn')),
      statement(['logs:CreateLogStream','logs:PutLogEvents'],log),
      statement(['secretsmanager:GetSecretValue'],ref(id+'CapsuleArn')),
      statement(['kms:Decrypt'],ref('CapsuleKeyArn'),{StringEquals:{'kms:ViaService':sub('secretsmanager.${AWS::Region}.amazonaws.com')},ArnEquals:{'kms:EncryptionContext:SecretARN':ref(id+'CapsuleArn')}}),
    ])}]}};
  }
  const taskArn=sub('arn:${AWS::Partition}:ecs:${AWS::Region}:${AWS::AccountId}:task/${ClusterName}/*');
  const exactTags={'aws:RequestTag/meri:execution-id':ref('ExecutionId'),'aws:RequestTag/meri:binding-sha256':ref('BindingSha256'),'aws:RequestTag/meri:plan-sha256':ref('PlanSha256'),'aws:RequestTag/meri:expires-at-ms':ref('ExpiresAtMs')};
  const controlStatements=[
    statement(['ecs:RunTask'],ref('RunnerDefinition'),{ArnEquals:{'ecs:cluster':ref('ClusterArn')},StringEquals:exactTags,'ForAllValues:StringEquals':{'aws:TagKeys':['meri:execution-id','meri:binding-sha256','meri:plan-sha256','meri:expires-at-ms']},Bool:{'ecs:enable-execute-command':'false'},DateLessThan:{'aws:CurrentTime':ref('AdmissionExpiresAtUtc')}}),
    statement(['ecs:TagResource'],taskArn,{StringEquals:{'ecs:CreateAction':'RunTask',...exactTags}}),
    statement(['ecs:DescribeTaskDefinition'],ref('RunnerDefinition')),
    statement(['ecs:DescribeTasks'],taskArn,{ArnEquals:{'ecs:cluster':ref('ClusterArn')}}),
    statement(['ecs:StopTask'],taskArn,{ArnEquals:{'ecs:cluster':ref('ClusterArn')},StringEquals:{'aws:ResourceTag/meri:execution-id':ref('ExecutionId'),'aws:ResourceTag/meri:binding-sha256':ref('BindingSha256'),'aws:ResourceTag/meri:plan-sha256':ref('PlanSha256'),'aws:ResourceTag/meri:expires-at-ms':ref('ExpiresAtMs')}}),
    statement(['ecs:ListTasks'],'*',{ArnEquals:{'ecs:cluster':ref('ClusterArn')}}),
    statement(['iam:PassRole'],attr('RunnerExecutionRole','Arn'),{StringEquals:{'iam:PassedToService':'ecs-tasks.amazonaws.com'}}),
    statement(['s3:GetBucketVersioning'],sub('arn:${AWS::Partition}:s3:::${CheckpointBucket}')),
    statement(['s3:GetObject','s3:GetObjectVersion'],sub('arn:${AWS::Partition}:s3:::${CheckpointBucket}/${CheckpointPrefix}/*')),
    statement(['s3:PutObject'],sub('arn:${AWS::Partition}:s3:::${CheckpointBucket}/${CheckpointPrefix}/*'),{StringEquals:{'s3:if-none-match':'*','s3:x-amz-server-side-encryption':'aws:kms','s3:x-amz-server-side-encryption-aws-kms-key-id':ref('CheckpointKeyArn')}}),
    statement(['kms:Decrypt','kms:GenerateDataKey'],ref('CheckpointKeyArn'),{StringEquals:{'kms:ViaService':sub('s3.${AWS::Region}.amazonaws.com')},StringLike:{'kms:EncryptionContext:aws:s3:arn':sub('arn:${AWS::Partition}:s3:::${CheckpointBucket}/${CheckpointPrefix}/*')}}),
  ];
  resources.ControlRole={Type:'AWS::IAM::Role',Properties:{RoleName:'meri-runtime-preview-control',AssumeRolePolicyDocument:taskTrust(),Tags:tags(),Policies:[{PolicyName:'OneOriginalRunAndCheckpoint',PolicyDocument:policy(controlStatements)}]}};
  resources.ProxyRole={Type:'AWS::IAM::Role',Properties:{RoleName:'meri-runtime-preview-proxy',AssumeRolePolicyDocument:taskTrust(),Tags:tags(),Policies:[{PolicyName:'ApprovedBedrockOnly',PolicyDocument:policy([statement(['bedrock:InvokeModel','bedrock:InvokeModelWithResponseStream','bedrock:CountTokens'],ref('BedrockResourceArns'),{StringEquals:{'aws:RequestedRegion':['us-east-1','us-east-2','us-west-2']}})])}]}};
  return resources;
}
