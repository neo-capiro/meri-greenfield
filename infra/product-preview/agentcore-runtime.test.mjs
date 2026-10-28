import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {synthesizeAgentCoreRuntime} from './agentcore-runtime.mjs';

function binding(){
 const foundation=JSON.parse(readFileSync(new URL('./first-chat/foundation-binding.json',import.meta.url),'utf8'));
 const ca=readFileSync(new URL('../../apps/runtime/certs/rds-global-bundle.pem',import.meta.url));
 // A single public certificate is enough to exercise configuration transport in this offline fixture.
 const cert=Buffer.from(ca.toString().match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/u)[0]+'\n');
 return {imageUri:'967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:'+'a'.repeat(64),
  sourceCommit:'b'.repeat(40),vpcId:foundation.vpcId,privateSubnetIds:foundation.privateSubnetIds,
  controlTaskRoleName:'MeriPreview-control-task',controlOrigin:'https://control.example.test',
  controlCaBase64:cert.toString('base64'),controlCaSha256:createHash('sha256').update(cert).digest('hex'),bedrock:[{
   inferenceProfileArn:'arn:aws:bedrock:us-east-1:967807252336:inference-profile/us.anthropic.claude-sonnet-4-6',
   foundationModelArns:['arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6'],
   countTokensModelArn:'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6'}],claudeApiSecretArn:null};
}
test('synthesizes V1 IAM HTTP runtime and pinned endpoint without ECS runner, memory or a gateway',()=>{
 const template=synthesizeAgentCoreRuntime(binding()),resources=Object.values(template.Resources);
 const runtime=resources.find(r=>r.Type==='AWS::BedrockAgentCore::Runtime').Properties;
 assert.equal(runtime.PlatformVersion,'V1');assert.equal(runtime.ProtocolConfiguration,'HTTP');
 assert.equal(runtime.EnvironmentVariables.MERI_RENDERER_IMAGE_DIGEST,binding().imageUri.split('@')[1]);
 assert.equal(runtime.NetworkConfiguration.NetworkMode,'VPC');assert.equal(runtime.AuthorizerConfiguration,undefined);
 assert.deepEqual(runtime.LifecycleConfiguration,{IdleRuntimeSessionTimeout:900,MaxLifetime:28800});
 const endpoint=resources.find(r=>r.Type==='AWS::BedrockAgentCore::RuntimeEndpoint').Properties;
 assert.equal(endpoint.Name,'preview');assert.deepEqual(endpoint.AgentRuntimeVersion,{Ref:'QualifiedRuntimeVersion'});
 assert.equal(template.Parameters.QualifiedRuntimeVersion.AllowedPattern,'[1-9][0-9]*');
 assert(!resources.some(r=>/AWS::ECS|AWS::BedrockAgentCore::(?:Memory|Gateway|Harness)/u.test(r.Type)));
 const control=resources.find(r=>r.Type==='AWS::IAM::Policy'&&r.Properties.PolicyName==='MeriAgentCoreInvocation').Properties;
 assert.deepEqual(control.Roles,['MeriPreview-control-task']);
 assert.deepEqual(control.PolicyDocument.Statement[0].Action,['bedrock-agentcore:InvokeAgentRuntime','bedrock-agentcore:StopRuntimeSession']);
 assert(!JSON.stringify(control.PolicyDocument.Statement[0].Resource).includes('*'));
 const json=JSON.stringify(template);assert(!/secretsmanager:GetSecretValue|rds-db:connect|ecs:RunTask|GetWorkloadAccessToken/u.test(json));
 const groups=resources.filter(r=>r.Type==='AWS::Logs::LogGroup');assert.equal(groups.length,2);
 assert(groups.every(r=>r.Properties.KmsKeyId&&r.Properties.RetentionInDays===30&&r.DeletionPolicy==='Retain'));
});

test('only the runtime role reads the exact Claude API secret; each model keeps its own profile condition',()=>{
 const b=binding();b.claudeApiSecretArn='arn:aws:secretsmanager:us-east-1:967807252336:secret:synthetic/api-key-abcdef';
 const second=JSON.parse(JSON.stringify(b.bedrock[0]).replaceAll('claude-sonnet-4-6','claude-opus-4-6-v1'));b.bedrock.push(second);
 const resources=Object.values(synthesizeAgentCoreRuntime(b).Resources),policies=resources.filter(r=>r.Type==='AWS::IAM::Policy');
 const runtime=resources.find(r=>r.Type==='AWS::BedrockAgentCore::Runtime').Properties;
 assert.equal(runtime.EnvironmentVariables.MERI_CLAUDE_API_SECRET_ARN,b.claudeApiSecretArn);assert.equal(runtime.EnvironmentVariables.ANTHROPIC_API_KEY,undefined);
 const secretPolicies=policies.filter(p=>JSON.stringify(p).includes('secretsmanager:GetSecretValue'));assert.equal(secretPolicies.length,1);
 const statement=secretPolicies[0].Properties.PolicyDocument.Statement.find(s=>s.Action==='secretsmanager:GetSecretValue'||Array.isArray(s.Action)&&s.Action.includes('secretsmanager:GetSecretValue'));
 assert.equal(statement.Resource,b.claudeApiSecretArn);assert(!JSON.stringify(secretPolicies[0].Properties.Roles).includes('control'));
 const conditioned=secretPolicies[0].Properties.PolicyDocument.Statement.filter(s=>s.Condition?.StringEquals?.['bedrock:InferenceProfileArn']);
 assert.deepEqual(conditioned.map(s=>s.Condition.StringEquals['bedrock:InferenceProfileArn']).sort(),b.bedrock.map(m=>m.inferenceProfileArn).sort());
 for(const arn of ['*',b.claudeApiSecretArn.replace('967807252336','111111111111'),'sk-ant-secret'])assert.throws(()=>synthesizeAgentCoreRuntime({...b,claudeApiSecretArn:arn}));
});
test('creation waits for ECR permissions and runtime stabilization before the preview endpoint',()=>{
 const {Resources:resources}=synthesizeAgentCoreRuntime(binding());
 const rolePolicy=Object.entries(resources).find(([,r])=>r.Type==='AWS::IAM::Policy'&&r.Properties.PolicyName!=='MeriAgentCoreInvocation')[0];
 // GetAtt alone allowed CloudFormation's optimistic creation to call the endpoint
 // while version1 was still CREATING. Explicit ordering must reach the policy too.
 assert(resources.Runtime.DependsOn?.includes(rolePolicy));
 assert(resources.PreviewEndpoint.DependsOn?.includes('Runtime'));
});
test('rejects unpinned image, public/credentialed control URL, CA mismatch and undeclared credentials',()=>{
 for(const edit of [b=>b.imageUri=b.imageUri.split('@')[0]+':latest',b=>b.controlOrigin='http://control.example.test',
  b=>b.controlOrigin='https://user:password@control.example.test',b=>b.controlCaSha256='0'.repeat(64),
  b=>b.secret='must-not-enter-template',b=>b.privateSubnetIds=[b.privateSubnetIds[0],b.privateSubnetIds[0]],
  b=>b.controlTaskRoleName='unrelated-role']){
  const value=binding();edit(value);assert.throws(()=>synthesizeAgentCoreRuntime(value));
 }
});
