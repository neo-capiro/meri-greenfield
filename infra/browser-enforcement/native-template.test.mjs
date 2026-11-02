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
export const runtimeBinding={enabled:true,purposes:[{deployment,instanceRoleArn:`arn:aws:iam::${account}:role/synthetic-native-host`}],
 stateMachineVersionArn:`arn:aws:states:us-east-1:${account}:stateMachine:synthetic-native:4`,controlRoleName:'synthetic-control',workerRoleName:'synthetic-worker'};
// The browser-only purpose: its own AMI, placement (group, profile) and bootstrap document.
const browserDeployment={...deployment,launch:{...deployment.launch,ImageId:'ami-0fedcba9876543210',SecurityGroupIds:['sg-0fedcba9876543210'],IamInstanceProfile:{Name:'synthetic-browser-host'}},
 placement:{...deployment.placement,securityGroupIds:['sg-0fedcba9876543210'],iamInstanceProfile:'synthetic-browser-host'},
 bootstrapSpec:{...deployment.bootstrapSpec,document:{...deployment.bootstrapSpec.document,name:'synthetic-browser-bootstrap'}}};
const browserPurpose={deployment:browserDeployment,instanceRoleArn:`arn:aws:iam::${account}:role/synthetic-browser-host`};
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
 const graph=JSON.parse(t.Resources.NativeWatchdog.Properties.DefinitionString);
 assert.ok(!JSON.stringify(graph).includes('"Retry"'));assert.match(graph.States.PrearmWait.Seconds,/leaseDeadlineMs/u);
 const roles=compileNativeRuntimePolicyTemplate(runtimeBinding);
 assert.equal(roles.Resources.NativeWorkerPolicy.Properties.Roles[0],'synthetic-worker');
 const w=nativeWorkerPolicy(runtimeBinding).Statement;
 assert.equal(w.find(s=>s.Action.includes('states:StartExecution')).Resource,runtimeBinding.stateMachineVersionArn);
 assert.ok(!w.flatMap(s=>s.Action).some(a=>/Redrive|StopExecution|TerminateInstances|DeleteTags|PutRole/u.test(a)));
 assert.equal(w.find(s=>s.Action.includes('ec2:CreateTags')).Condition.StringEquals['ec2:CreateAction'],'RunInstances');
 assert.deepEqual(w.find(s=>s.Action.includes('iam:PassRole')).Resource,runtimeBinding.purposes[0].instanceRoleArn);
});
test('the browser-only purpose launches exactly its own AMI, groups, profile and document, alone or beside the native one',()=>{
 const run=statements=>statements.filter(s=>s.Action.includes('ec2:RunInstances'));
 const alone=nativeWorkerPolicy({...runtimeBinding,purposes:[browserPurpose]}).Statement;
 assert.deepEqual(run(alone)[0].Resource.slice(0,3),['arn:aws:ec2:us-east-1::image/ami-0fedcba9876543210',`arn:aws:ec2:us-east-1:${account}:subnet/${deployment.placement.subnetId}`,
  `arn:aws:ec2:us-east-1:${account}:security-group/sg-0fedcba9876543210`]);
 assert.equal(run(alone)[1].Condition.StringEquals['ec2:InstanceProfile'],`arn:aws:iam::${account}:instance-profile/synthetic-browser-host`);
 // The worker may launch only with IMDSv2 required and a one-hop limit, the options the launch request sets.
 assert.equal(run(alone)[1].Condition.StringEquals['ec2:MetadataHttpTokens'],'required');
 assert.equal(run(alone)[1].Condition.StringEquals['ec2:MetadataHttpEndpoint'],'enabled');
 assert.deepEqual(run(alone)[1].Condition.NumericEquals,{'ec2:MetadataHttpPutResponseHopLimit':1});
 assert.deepEqual(alone.filter(s=>s.Action.includes('ssm:SendCommand')&&String(s.Resource).includes(':document/')).map(s=>s.Resource),
  [`arn:aws:ssm:us-east-1:${account}:document/synthetic-browser-bootstrap`]);
 assert.deepEqual(alone.find(s=>s.Action.includes('iam:PassRole')).Resource,browserPurpose.instanceRoleArn);
 assert.ok(!JSON.stringify(alone).includes(deployment.launch.ImageId),'no native AMI without the native purpose');
 const both=nativeWorkerPolicy({...runtimeBinding,purposes:[...runtimeBinding.purposes,browserPurpose]}).Statement;
 assert.deepEqual(run(both).filter(s=>Array.isArray(s.Resource)).map(s=>s.Resource[0]),[`arn:aws:ec2:us-east-1::image/${deployment.launch.ImageId}`,'arn:aws:ec2:us-east-1::image/ami-0fedcba9876543210']);
 const control=compileNativeRuntimePolicyTemplate({...runtimeBinding,purposes:[browserPurpose]}).Resources.NativeControlPolicy.Properties.PolicyDocument.Statement;
 assert.equal(control.filter(s=>s.Action.includes('ec2:TerminateInstances')).length,1);
 for(const purposes of [[],[browserPurpose,browserPurpose],[runtimeBinding.purposes[0],{...browserPurpose,deployment:{...browserDeployment,launch:deployment.launch}}],
  [{...browserPurpose,instanceRoleArn:'*'}],[{...browserPurpose,extra:1}]])assert.throws(()=>nativeWorkerPolicy({...runtimeBinding,purposes}));
});
test('missing, foreign, alias and widened inputs fail closed',()=>{
 for(const mutate of [b=>b.configuration.functionArn+=':alias',b=>delete b.code.versionId,b=>b.configuration.secretArn+=':*',b=>b.network.securityGroupIds=['*'],b=>b.code.sha256='bad']){
  const b=structuredClone(observerBinding);mutate(b);assert.throws(()=>compileNativeObserverTemplate(b));
 }
 assert.throws(()=>nativeWorkerPolicy({...runtimeBinding,stateMachineVersionArn:observerBinding.configuration.stateMachineArn}));
 assert.throws(()=>nativeWorkerPolicy({...runtimeBinding,purposes:[{...runtimeBinding.purposes[0],instanceRoleArn:'*'}]}));
 const b=structuredClone(watchdogBinding);delete b.deployment.physicalObserver;assert.throws(()=>compileNativeWatchdogTemplate(b));
});
