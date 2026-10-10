// Pure one-resource CloudFormation task-definition template builder. No CLI, process,
// deployment, network or AWS API; it returns inert source data only. Exactly one
// AWS::ECS::TaskDefinition resource (logical ID CanaryTaskDefinition) and its optional exact
// ARN output. No IAM role, state machine, cluster, VPC, security group, log group, key,
// secret, route, custom or nested resource, and no execute admission. Registration is later
// separate owner work.
//
// Fixed reviewed inputs come only from the dependency-free probe-profiles leaf snapshot, so
// this builder cannot inherit mutable authority from the writable legacy exports
// (TARGET/ROLE_PINS/...). On any legacy-export mutation it still returns the same reviewed
// fixed output. It does not import binding.mjs.
import { CANARY_FAMILY,CANARY_IMAGE,CANARY_LOG_GROUP,CANARY_LOG_PREFIX,CANARY_ROLE_PINS,CANARY_TARGET } from './lib/probe-profiles.mjs';

export function buildCanaryTaskDefinitionTemplate(){
 const environment=[['HOME','/workspace/home'],['TMPDIR','/tmp'],['CLAUDE_CONFIG_DIR','/workspace/config'],['PLAYWRIGHT_BROWSERS_PATH','/opt/meri-browsers'],['MERI_QUALIFICATION_ONLY','true'],['MERI_SOURCES_ENABLED','false'],['CHROMIUM_SANDBOX_REQUIRED','true']].map(([Name,Value])=>({Name,Value}));
 const container={
  Name:'worker',
  Image:CANARY_IMAGE,
  Essential:true,
  ReadonlyRootFilesystem:true,
  Privileged:false,
  User:'10001:10001',
  StopTimeout:60,
  EntryPoint:['/usr/bin/sleep'],
  Command:['1200'],
  Environment:environment,
  MountPoints:[{SourceVolume:'workspace',ContainerPath:'/workspace',ReadOnly:false},{SourceVolume:'tmp',ContainerPath:'/tmp',ReadOnly:false}],
  LinuxParameters:{Capabilities:{Drop:['ALL']}},
  LogConfiguration:{LogDriver:'awslogs',Options:{'awslogs-group':CANARY_LOG_GROUP,'awslogs-region':CANARY_TARGET.region,'awslogs-stream-prefix':CANARY_LOG_PREFIX,mode:'blocking'}}
 };
 const resource={Type:'AWS::ECS::TaskDefinition',Properties:{Family:CANARY_FAMILY,NetworkMode:'awsvpc',RequiresCompatibilities:['FARGATE'],Cpu:'2048',Memory:'8192',ExecutionRoleArn:CANARY_ROLE_PINS.execution,TaskRoleArn:CANARY_ROLE_PINS.worker,RuntimePlatform:{CpuArchitecture:'X86_64',OperatingSystemFamily:'LINUX'},EphemeralStorage:{SizeInGiB:50},Volumes:[{Name:'workspace',Host:{}},{Name:'tmp',Host:{}}],ContainerDefinitions:[container]}};
 return {AWSTemplateFormatVersion:'2010-09-09',Description:'INERT dedicated canary qualification task definition; no IAM/service/resource relocation',Resources:{CanaryTaskDefinition:resource},Outputs:{CanaryTaskDefinitionArn:{Value:{Ref:'CanaryTaskDefinition'}}}};
}
