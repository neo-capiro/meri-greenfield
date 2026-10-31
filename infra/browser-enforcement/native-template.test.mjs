import test from 'node:test';
import assert from 'node:assert/strict';
import {compileNativeObserverTemplate,compileNativeWatchdogTemplate,compileNativeRuntimePolicyTemplate,nativeWorkerPolicy} from './native-template.mjs';
import {observerFixture} from '../../apps/runtime/test/native-observer-fixture.mjs';
const f=await observerFixture(),account='967807252336',source=f.declaration;
const deployment={accountId:account,region:'us-east-1',placement:source.placement,launch:source.launch,imageDigest:source.imageDigest,sourceCommit:source.sourceCommit,
 bootstrapSha256:source.bootstrapSha256,bootstrapSpec:source.bootstrapSpec,launchTagPolicy:source.launchTagPolicy,
 physicalObserver:{...source.physicalObserver,bridgeFunctionVersionArn:`arn:aws:lambda:us-east-1:${account}:function:synthetic-observer:3`}};
export const observerBinding={enabled:true,configuration:{schema:'meri-native-observer-entrypoint/1',functionArn:`arn:aws:lambda:us-east-1:${account}:function:synthetic-observer`,
 stateMachineArn:`arn:aws:states:us-east-1:${account}:stateMachine:synthetic-native`,keyId:'synthetic-key',
 secretArn:`arn:aws:secretsmanager:us-east-1:${account}:secret:synthetic-observer-Abc123`,secretVersionId:'a'.repeat(32),secretSha256:'b'.repeat(64),caSha256:'c'.repeat(64)},
 code:{bucket:'synthetic-native-code',key:'observer.zip',versionId:'synthetic-version',sha256:'d'.repeat(64)},
 network:{privateSubnetIds:['subnet-0123456789abcdef0'],securityGroupIds:['sg-0123456789abcdef0']},
 kmsKeyArn:`arn:aws:kms:us-east-1:${account}:key/00000000-0000-4000-8000-000000000001`,logGroupName:'/synthetic/native-observer'};
export const watchdogBinding={enabled:true,name:'synthetic-native',deployment};
export const runtimeBinding={enabled:true,deployment,stateMachineVersionArn:`arn:aws:states:us-east-1:${account}:stateMachine:synthetic-native:4`,
 instanceRoleArn:`arn:aws:iam::${account}:role/synthetic-native-host`,controlRoleName:'synthetic-control',workerRoleName:'synthetic-worker'};
test('disabled templates emit no resources and reject latent configuration',()=>{
 for(const compile of [compileNativeObserverTemplate,compileNativeWatchdogTemplate,compileNativeRuntimePolicyTemplate]){
  assert.deepEqual(compile().Resources,{});assert.throws(()=>compile({enabled:false,name:'latent'}));
 }
});
test('observer template pins package/version/secret and excludes invocation or cleanup authority',()=>{
 const t=compileNativeObserverTemplate(observerBinding),p=t.Resources.NativeObserver.Properties;
 assert.equal(p.Runtime,'nodejs24.x');assert.deepEqual(p.Architectures,['arm64']);assert.equal(p.Handler,'apps/runtime/native-observer-entrypoint.handler');
 assert.equal(p.Code.S3ObjectVersion,'synthetic-version');assert.equal(t.Resources.NativeObserverVersion.DeletionPolicy,'Retain');
 const statements=t.Resources.NativeObserverRole.Properties.Policies[0].PolicyDocument.Statement;
 const secrets=statements.find(s=>s.Action.includes('secretsmanager:GetSecretValue'));
 assert.equal(secrets.Resource,observerBinding.configuration.secretArn);assert.equal(secrets.Condition.StringEquals['secretsmanager:VersionId'],'a'.repeat(32));
 const deny=statements.find(s=>s.Effect==='Deny');assert.ok(deny.Action.includes('ec2:*'));assert.ok(deny.Action.includes('states:*'));
 assert.equal(deny.Condition.ArnEquals['lambda:SourceFunctionArn'],observerBinding.configuration.functionArn);
 assert.ok(!statements.filter(s=>s.Effect==='Allow').flatMap(s=>s.Action).some(a=>/Terminate|RunInstances|StartExecution|InvokeFunction|PutRole/u.test(a)));
 assert.ok(!Object.values(t.Resources).some(r=>/EventSource|Permission|Url|Alias/u.test(r.Type)));
});
test('watchdog and existing role policies preserve version, scope, original graph and no redrive',()=>{
 const t=compileNativeWatchdogTemplate(watchdogBinding),role=t.Resources.NativeWatchdogRole.Properties;
 assert.equal(role.AssumeRolePolicyDocument.Statement[0].Condition.ArnEquals['aws:SourceArn'],observerBinding.configuration.stateMachineArn);
 const statements=role.Policies[0].PolicyDocument.Statement;
 assert.equal(statements.find(s=>s.Action.includes('lambda:InvokeFunction')).Resource,deployment.physicalObserver.bridgeFunctionVersionArn);
 const terminate=statements.find(s=>s.Action.includes('ec2:TerminateInstances'));
 assert.equal(terminate.Condition.StringEquals['ec2:ResourceTag/Project'],'meri-greenfield');
 const graph=t.Resources.NativeWatchdog.Properties.Definition;
 assert.ok(!JSON.stringify(graph).includes('"Retry"'));assert.match(graph.States.PrearmWait.Seconds,/leaseDeadlineMs/u);
 const roles=compileNativeRuntimePolicyTemplate(runtimeBinding);
 assert.equal(roles.Resources.NativeWorkerPolicy.Properties.Roles[0],'synthetic-worker');
 const w=nativeWorkerPolicy(runtimeBinding).Statement;
 assert.equal(w.find(s=>s.Action.includes('states:StartExecution')).Resource,runtimeBinding.stateMachineVersionArn);
 assert.ok(!w.flatMap(s=>s.Action).some(a=>/Redrive|StopExecution|TerminateInstances|DeleteTags|PutRole/u.test(a)));
 assert.equal(w.find(s=>s.Action.includes('ec2:CreateTags')).Condition.StringEquals['ec2:CreateAction'],'RunInstances');
 assert.deepEqual(w.find(s=>s.Action.includes('iam:PassRole')).Resource,runtimeBinding.instanceRoleArn);
});
test('missing, foreign, alias and widened inputs fail closed',()=>{
 for(const mutate of [b=>b.configuration.functionArn+=':alias',b=>delete b.code.versionId,b=>b.configuration.secretArn+=':*',b=>b.network.securityGroupIds=['*'],b=>b.code.sha256='bad']){
  const b=structuredClone(observerBinding);mutate(b);assert.throws(()=>compileNativeObserverTemplate(b));
 }
 assert.throws(()=>nativeWorkerPolicy({...runtimeBinding,stateMachineVersionArn:observerBinding.configuration.stateMachineArn}));
 assert.throws(()=>nativeWorkerPolicy({...runtimeBinding,instanceRoleArn:'*'}));
 const b=structuredClone(watchdogBinding);delete b.deployment.physicalObserver;assert.throws(()=>compileNativeWatchdogTemplate(b));
});
