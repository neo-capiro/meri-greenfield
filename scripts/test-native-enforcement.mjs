import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {buildNativeEnforcementAdmission as compile,buildNativeEnforcementStateMachine as definition,buildNativeEnforcementTemplate as template,canonical,sha256,TARGET,ROLE_PINS,NETWORK,WIRE_PROFILE,EVIDENCE_KINDS,LIMITS} from '../infra/native-enforcement/app.mjs';
import {validateTaskDefinition} from '../infra/native-enforcement/lib/task-definition.mjs';
// Clearly SYNTHETIC; these values are not deployable authority or actual wire evidence.
export function fixturePins(){
 const p={...TARGET,runUuid:'87890e41-3f88-4b4d-b1d3-aaa9b85aaa9b',stateMachineName:'meri-greenfield-native-enforcement-fixture',managedRoleName:'MeriGreenfield-NativeEnforcement-Fixture',clusterArn:`arn:aws:ecs:${TARGET.region}:${TARGET.account}:cluster/meri-greenfield-qualification`,taskDefinitionArns:{sdk:`arn:aws:ecs:${TARGET.region}:${TARGET.account}:task-definition/meri-greenfield-qualification-sdk:1`,office:`arn:aws:ecs:${TARGET.region}:${TARGET.account}:task-definition/meri-greenfield-qualification-office:2`},executionRoleArn:ROLE_PINS.execution,workerRoleArn:ROLE_PINS.worker,image:`${TARGET.account}.dkr.ecr.${TARGET.region}.amazonaws.com/meri-greenfield/qualification-worker@sha256:${'b'.repeat(64)}`,imageConfigSha256:'c'.repeat(64),sourceCommit:'d'.repeat(40),platformVersion:'1.4.0',network:{...NETWORK},logGroup:'/meri-greenfield/qualification/runtime',kmsKeyArn:`arn:aws:kms:${TARGET.region}:${TARGET.account}:key/11111111-1111-4111-8111-111111111111`,taskDefinitionPins:{},authorityDocuments:[],wireProfile:WIRE_PROFILE,timestampEncoding:'iso8601',wireEvidence:{}};
 for(const k of ['sdk','office'])p.taskDefinitionPins[k]={taskDefinitionArn:p.taskDefinitionArns[k],family:`meri-greenfield-qualification-${k}`,revision:k==='sdk'?1:2,executionRoleArn:p.executionRoleArn,taskRoleArn:p.workerRoleArn,networkMode:'awsvpc',cpu:'2048',memory:'8192',requiresCompatibilities:['FARGATE'],runtimePlatform:{cpuArchitecture:'X86_64',operatingSystemFamily:'LINUX'},ephemeralStorage:{sizeInGiB:50},volumes:[{name:'workspace',host:{}},{name:'tmp',host:{}}],containerDefinitions:[{name:'worker',image:p.image,user:'10001:10001',essential:true,readonlyRootFilesystem:true,privileged:false,stopTimeout:60,entryPoint:['node'],command:[`/opt/meri-worker/probes/${k==='sdk'?'sdk-capture':'office-export'}.mjs`],linuxParameters:{capabilities:{drop:['ALL']}},mountPoints:[{sourceVolume:'workspace',containerPath:'/workspace',readOnly:false},{sourceVolume:'tmp',containerPath:'/tmp',readOnly:false}],environment:[['HOME','/workspace/home'],['TMPDIR','/tmp'],['CLAUDE_CONFIG_DIR','/workspace/config'],['PLAYWRIGHT_BROWSERS_PATH','/opt/meri-browsers'],['MERI_QUALIFICATION_ONLY','true'],['MERI_SOURCES_ENABLED','false'],['CHROMIUM_SANDBOX_REQUIRED','true']].map(([name,value])=>({name,value})),logConfiguration:{logDriver:'awslogs',options:{'awslogs-group':p.logGroup,'awslogs-region':p.region,'awslogs-stream-prefix':`qualification-${k}`,mode:'blocking'}}}]};
 p.authorityDocuments=EVIDENCE_KINDS.map(kind=>{const body=canonical({SYNTHETIC_TEST_ONLY:true,kind});return {kind,reference:'synthetic:'+kind,version:'fixture-1',body,sha256:sha256(body)};});
 const body=canonical({profile:WIRE_PROFILE,timestampEncoding:'iso8601',listResult:{taskArns:[]},describeResult:{tasks:[]},eniResult:{NetworkInterfaces:[]},identityResult:{Account:TARGET.account}});
 p.wireEvidence={origin:'SYNTHETIC_TEST_ONLY',reference:'synthetic:wire',version:'fixture-1',body,sha256:sha256(body)};return p;
}
export function expressionEntries(value,path='$',out=[]){if(typeof value==='string'&&value.startsWith('{% ')&&value.endsWith(' %}'))out.push({path,source:value.slice(3,-3)});else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value))expressionEntries(v,path+'.'+key,out);return out;}
// Permanent SYNTHETIC RunTask reply-shape fixtures for the immediate-member launch guard.
// ARNs are clearly synthetic same-cluster strings and create no authority. expectRetainRun:true
// means the guard admits RetainRun; false means it must route to LaunchUncertain; null means the
// guard may admit (documented current empty-tasks behavior) but the disposition must still be
// launchCertain:false / qualificationFailed:true.
export function runShapeFixtures(pins){
 const ns=`arn:aws:ecs:${pins.region}:${pins.account}:task/${pins.clusterArn.split('/')[1]}`;
 const arn=i=>`${ns}/${i.toString(16).padStart(32,'0')}`;
 const foreign=`arn:aws:ecs:${pins.region}:111111111111:task/${pins.clusterArn.split('/')[1]}/${'1'.padStart(32,'0')}`;
 const obj=i=>({taskArn:arn(i)});
 return [
  {name:'valid-one-scalar-object',payload:{tasks:[obj(1)],failures:[]},expectRetainRun:true},
  {name:'valid-four-scalar-objects',payload:{tasks:[obj(1),obj(2),obj(3),obj(4)],failures:[]},expectRetainRun:true},
  {name:'malformed-singleton-arn-array',payload:{tasks:[{taskArn:[arn(1)]}],failures:[]},expectRetainRun:false},
  {name:'malformed-multiple-arn-array',payload:{tasks:[{taskArn:[1,2,3,4,5].map(arn)}],failures:[]},expectRetainRun:false},
  {name:'malformed-nested-task-records',payload:{tasks:[[1,2,3,4,5].map(obj)],failures:[]},expectRetainRun:false},
  {name:'malformed-mixed-immediate',payload:{tasks:[obj(1),{taskArn:[arn(2)]}],failures:[]},expectRetainRun:false},
  {name:'primitive-task-member',payload:{tasks:['x'],failures:[]},expectRetainRun:false},
  {name:'null-task-member',payload:{tasks:[null],failures:[]},expectRetainRun:false},
  {name:'missing-taskarn',payload:{tasks:[{}],failures:[]},expectRetainRun:false},
  {name:'numeric-taskarn',payload:{tasks:[{taskArn:123}],failures:[]},expectRetainRun:false},
  {name:'object-taskarn',payload:{tasks:[{taskArn:{a:1}}],failures:[]},expectRetainRun:false},
  {name:'foreign-namespace-arn',payload:{tasks:[{taskArn:foreign}],failures:[]},expectRetainRun:false},
  {name:'malformed-namespace-arn',payload:{tasks:[{taskArn:`${ns}/NOTHEX`}],failures:[]},expectRetainRun:false},
  {name:'tasks-wrong-type',payload:{tasks:'x',failures:[]},expectRetainRun:false},
  {name:'tasks-too-many',payload:{tasks:[1,2,3,4,5].map(obj),failures:[]},expectRetainRun:false},
  {name:'empty-tasks-uncertain',payload:{tasks:[],failures:[]},expectRetainRun:null}
 ];
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const b=compile({staticPins:fixturePins()}), d=definition(b), t=template(b);
 test('default/missing preparation is refusing-only',()=>{assert.equal(compile().runtimeEnabled,false);assert.equal(definition().States.AdmissionRefused.Type,'Fail');assert.throws(()=>template());});
 test('synthetic wire cannot enable runtime despite requested Boolean',()=>{assert.equal(compile({staticPins:fixturePins(),executeAdmitted:true}).runtimeEnabled,false);assert.match(d.States.GuardInput.Choices[0].Condition,/false and/);});
 test('noncircular stable static binding',()=>{assert.match(b.staticBindingId,/^[a-f0-9]{64}$/);assert.equal(compile({staticPins:fixturePins()}).staticBindingId,b.staticBindingId);assert.ok(!JSON.stringify(b.pins).includes('publishedVersionArn'));assert.throws(()=>compile({staticPins:{...fixturePins(),definitionSha256:'e'.repeat(64)}}));});
 for(const [name,mutate]of [
 ['foreign cluster',p=>p.clusterArn=p.clusterArn.replace(TARGET.account,'111111111111')],
 ['unversioned definition',p=>p.taskDefinitionArns.sdk=p.taskDefinitionArns.sdk.replace(':1','')],
 ['foreign role',p=>p.workerRoleArn='arn:aws:iam::111111111111:role/x'],
 ['added capability',p=>p.taskDefinitionPins.sdk.containerDefinitions[0].linuxParameters.capabilities.add=['SYS_ADMIN']],
 ['extra container',p=>p.taskDefinitionPins.sdk.containerDefinitions.push({name:'other'})],
 ['secret',p=>p.taskDefinitionPins.sdk.containerDefinitions[0].secrets=[{name:'SECRET',valueFrom:'x'}]],
 ['extra environment',p=>p.taskDefinitionPins.sdk.containerDefinitions[0].environment.push({name:'AWS_ACCESS_KEY_ID',value:'fake'})],
 ['public network extra',p=>p.network.assignPublicIp='ENABLED'],
 ['LATEST',p=>p.platformVersion='LATEST'],
 ['missing authority',p=>p.authorityDocuments.pop()],
 ['mismatched authority bytes',p=>p.authorityDocuments[0].body+=' '],
 ['unknown wire casing',p=>p.wireProfile='guessed'],
 ['wrong source',p=>p.sourceCommit='not-a-commit'],
 ['different task command',p=>p.taskDefinitionPins.office.containerDefinitions[0].command=['anything']]
 ])test('reject '+name,()=>{const p=fixturePins();mutate(p);assert.throws(()=>compile({staticPins:p,executeAdmitted:true}));});
 for (const [label, attribute] of [
  ['documented punctuation', {name:'capability/foo\\bar_1.-', value:'a@b: path/with\\segments', targetId:'resource-id', targetType:'container-instance'}],
  ['maximum attribute lengths', {name:'n'.repeat(128), value:'v'.repeat(128)}],
 ]) test('retain ' + label + ' without enabling runtime', () => {
  const pins = fixturePins();
  pins.taskDefinitionPins.sdk.requiresAttributes = [attribute];
  const before = JSON.stringify(pins);
  const result = compile({staticPins:pins});
  assert.equal(result.runtimeEnabled, false);
  assert.deepEqual(result.pins.taskDefinitionPins.sdk.requiresAttributes, [attribute]);
  assert.equal(JSON.stringify(pins), before);
 });
 for (const [label, attribute] of [
  ['unknown attribute field', {name:'ecs.capability', unexpected:true}],
  ['numeric attribute value', {name:'ecs.capability', value:42}],
  ['array attribute target', {name:'ecs.capability', targetId:[]}],
  ['object attribute target type', {name:'ecs.capability', targetType:{}}],
  ['invalid name punctuation', {name:'ecs@capability'}],
  ['trailing value space', {name:'ecs.capability', value:'value '}],
  ['oversized name', {name:'n'.repeat(129)}],
  ['oversized value', {name:'ecs.capability', value:'v'.repeat(129)}],
  ['empty name', {name:''}],
  ['empty value', {name:'ecs.capability', value:''}],
 ]) test('reject ' + label, () => {
  const pins = fixturePins();
  pins.taskDefinitionPins.sdk.requiresAttributes = [attribute];
  assert.throws(() => compile({staticPins:pins}));
 });
 test('reject unreviewed ephemeral storage settings', () => {
  const pins = fixturePins();
  pins.taskDefinitionPins.sdk.ephemeralStorage.unexpected = true;
  assert.throws(() => compile({staticPins:pins}));
 });
 test('exactly two inert resources and no other compute',()=>{assert.deepEqual(Object.values(t.Resources).map(r=>r.Type).sort(),['AWS::IAM::Role','AWS::StepFunctions::StateMachine']);assert.equal(t.Resources.NativeEnforcementMachine.Properties.StateMachineType,'STANDARD');});
 test('all graph targets exist and all states are reachable',()=>{const seen=new Set(),todo=[d.StartAt];while(todo.length){const n=todo.pop();assert.ok(d.States[n],n);if(seen.has(n))continue;seen.add(n);const s=d.States[n];todo.push(...[s.Next,s.Default,...(s.Choices??[]).map(c=>c.Next),...(s.Catch??[]).map(c=>c.Next)].filter(Boolean));}assert.equal(seen.size,Object.keys(d.States).length);});
 test('one dynamic RunTask, no retry/parallel/map/fuse',()=>{const tasks=Object.values(d.States).filter(s=>s.Type==='Task');assert.equal(tasks.filter(s=>s.Resource.endsWith(':runTask')).length,1);assert.match(d.States.RunTask.Arguments.TaskDefinition,/sdk.*office/);assert.equal(d.States.RunTask.Arguments.PlatformVersion,'1.4.0');assert.ok(!JSON.stringify(d).includes('"Retry"'));assert.ok(!JSON.stringify(d).includes('"Type":"Parallel"'));assert.equal(d.TimeoutSeconds,undefined);});
 test('every task reads a bounded result, catches fresh errors and clips positive calls',()=>{for(const s of Object.values(d.States).filter(s=>s.Type==='Task')){assert.match(s.Assign.raw,/\(\$s:=\$string\(\$states\.result\);\$length\(\$s\)\*6<=\d+\?\$states\.result:null\)/);assert.match(s.Assign.rawOver,/\(\$s:=\$string\(\$states\.result\);\$length\(\$s\)\*6>\d+\)/);assert.match(s.TimeoutSeconds,/DeadlineInsufficient/);assert.equal(s.Catch[0].Assign.raw,null);assert.equal(s.Catch[0].Assign.callOk,false);assert.ok(s.Catch[0].ErrorEquals.includes('States.DataLimitExceeded'));assert.match(s.Catch[0].Assign.callError,/truncated/);assert.equal(s.Output.constructor,Object);}});
 test('real EC2 and two managed STS tasks',()=>{const rs=Object.values(d.States).filter(s=>s.Type==='Task').map(s=>s.Resource);assert.equal(rs.filter(r=>r.endsWith('sts:getCallerIdentity')).length,2);assert.ok(rs.includes('arn:aws:states:::aws-sdk:ec2:describeNetworkInterfaces'));});
 test('opaque paging/direct singleton descriptions are real expressions',()=>{assert.match(d.States.ListNext.Arguments,/NextToken/);assert.ok(!d.States.ListFirst.Arguments.includes('NextToken'));assert.match(d.States.ListShape.Choices[0].Condition,/type\(\$raw.nextToken\)='string'/);assert.deepEqual(d.States.DescribeCandidate.Arguments.Tasks,'{% [$ctx.currentArn] %}');assert.match(d.States.StartScan.Assign.ctx,/ctx.direct/);});
 test('prestop full provenance precedes one exact mutation; terminal ledger retained',()=>{assert.equal(d.States.PreStopRecord.Next,'StopOwned');for(const k of ['original','freshTask','eni','identity','authorityReferences'])assert.ok(k in d.States.PreStopRecord.Output);assert.match(d.States.TerminalGate.Choices[0].Condition,/ctx.currentArn/);assert.match(d.States.TerminalGate.Choices[0].Condition,/exitCode/);assert.equal(d.States.FinalUnknown.Output.cleanup,'CLEANUP_UNKNOWN');assert.ok(d.States.FinalConfirmed.Output.ledger);});
 test('narrow exact trust and per-run IAM',()=>{const role=t.Resources.NativeEnforcementRole.Properties;assert.equal(role.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals['aws:SourceAccount'],TARGET.account);assert.match(role.AssumeRolePolicyDocument.Statement[0].Condition.ArnEquals['aws:SourceArn'],/stateMachine:meri-greenfield-native-enforcement-/);const ss=role.Policies[0].PolicyDocument.Statement;assert.equal(ss.find(s=>s.Action==='ecs:StopTask').Condition.StringEquals['aws:ResourceTag/QualificationRun'],b.pins.runUuid);assert.ok(!ss.find(s=>s.Action==='ecs:DescribeTasks').Condition.StringEquals);assert.deepEqual(ss.find(s=>s.Action==='iam:PassRole').Resource,[ROLE_PINS.execution,ROLE_PINS.worker]);});
 test('actual attachment type and explicit variables, never invented AWS verdicts',()=>{const text=JSON.stringify(d);assert.match(text,/ElasticNetworkInterface/);assert.ok(!text.includes('ownershipVerdict'));assert.ok(!text.includes('qualificationVerdict'));assert.ok(expressionEntries(d).length>100);assert.match(d.States.Initialize.Assign.ctx,/720000/);assert.match(d.States.Initialize.Assign.ctx,/900000/);});
 test('bounded overflow ledger contains extra positives instead of discarding stop identity',()=>{assert.ok(d.States.BindOverflow&&d.States.OwnedCapacity&&d.States.OverflowExhausted);assert.match(d.States.BindOverflow.Assign.ctx,/overflow/);assert.match(d.States.BindOverflow.Assign.ctx,/qualificationFailed':true/);assert.equal(d.States.OwnedCapacity.Choices[0].Next,'BindOwned');assert.match(d.States.OwnedCapacity.Choices[1].Condition,/ctx.overflow/);assert.equal(d.States.OwnedCapacity.Default,'OverflowExhausted');assert.match(d.States.OverflowExhausted.Assign.ctx,/'hold':true/);assert.match(d.States.OverflowExhausted.Assign.ctx,/owned-capacity-exhausted/);assert.equal(LIMITS.owned,4);assert.equal(LIMITS.overflow,6);});
 test('stop dispatch precedes round-robin exact-ARN terminal confirmation',()=>{assert.equal(d.States.StopResultRecord.Next,'LoopGate');assert.equal(d.States.LoopGate.Choices[1].Next,'SelectOwned');assert.equal(d.States.LoopGate.Choices[4].Next,'SelectConfirm');assert.ok(d.States.SelectConfirm&&d.States.PickConfirm&&d.States.BumpProbe&&d.States.TerminalWaitRoute);assert.match(d.States.PickConfirm.Assign.ctx,/probeSeq/);assert.match(d.States.BumpProbe.Assign.ctx,/probeSeq/);assert.match(d.States.SelectConfirm.Choices[0].Condition,/unconfirmedCount|stopAttempted/);});
 test('three-way attachment classification is explicit and contradiction is sticky',()=>{assert.equal(d.States.ExtractENI.Choices[0].Next,'PrepareENI');assert.equal(d.States.ExtractENI.Choices[1].Next,'ENIContradiction');assert.equal(d.States.ExtractENI.Default,'NetworkUnknown');assert.match(d.States.ENIContradiction.Assign.ctx,/qualificationFailed':true/);assert.match(d.States.NetworkUnknown.Assign.ctx,/UNAVAILABLE/);});
 test('every persistent write is committed behind a whole-context byte bound with compact fallback',()=>{for(const [name,s] of Object.entries(d.States))if(name!=='Initialize'&&s.Type==='Pass'&&s.Assign&&s.Assign.ctx)assert.match(s.Assign.ctx,/ctx-overflow/,name);assert.match(d.States.PreStopRecord.Output.original,/truncated/);assert.match(d.States.PreStopRecord.Output.identity,/truncated/);assert.ok(LIMITS.ledgerBytes>0&&LIMITS.recordBytes>0&&LIMITS.ctxBytes>0&&LIMITS.refBytes>0);});
 test('compiler ingress bounds authority reference/version fields and aggregate bytes',()=>{const long=fixturePins();long.authorityDocuments[0].reference='x'.repeat(LIMITS.refChars+1);assert.throws(()=>compile({staticPins:long}));const aggregate=fixturePins();aggregate.authorityDocuments.forEach(x=>{x.reference='y'.repeat(LIMITS.refChars);x.version='z'.repeat(LIMITS.refChars);});assert.throws(()=>compile({staticPins:aggregate}));});
 // Clearly SYNTHETIC observed-style representation of the neutral ECS service defaults.
 function observedDefinition(k='sdk'){const p=fixturePins();const command=`/opt/meri-worker/probes/${k==='sdk'?'sdk-capture':'office-export'}.mjs`;const revision=k==='sdk'?1:2;const c={name:'worker',image:p.image,cpu:0,links:[],portMappings:[],essential:true,entryPoint:['node'],command:[command],environment:[['HOME','/workspace/home'],['TMPDIR','/tmp'],['CLAUDE_CONFIG_DIR','/workspace/config'],['PLAYWRIGHT_BROWSERS_PATH','/opt/meri-browsers'],['MERI_QUALIFICATION_ONLY','true'],['MERI_SOURCES_ENABLED','false'],['CHROMIUM_SANDBOX_REQUIRED','true']].map(([name,value])=>({name,value})),environmentFiles:[],mountPoints:[{sourceVolume:'workspace',containerPath:'/workspace',readOnly:false},{sourceVolume:'tmp',containerPath:'/tmp',readOnly:false}],volumesFrom:[],linuxParameters:{capabilities:{add:[],drop:['ALL']},devices:[],tmpfs:[]},secrets:[],stopTimeout:60,user:'10001:10001',privileged:false,readonlyRootFilesystem:true,dnsServers:[],dnsSearchDomains:[],extraHosts:[],dockerSecurityOptions:[],dockerLabels:{},ulimits:[],logConfiguration:{logDriver:'awslogs',options:{'awslogs-group':p.logGroup,'awslogs-region':p.region,'awslogs-stream-prefix':`qualification-${k}`,mode:'blocking'},secretOptions:[]},systemControls:[],credentialSpecs:[]};const t={taskDefinitionArn:p.taskDefinitionArns[k],containerDefinitions:[c],family:`meri-greenfield-qualification-${k}`,taskRoleArn:p.workerRoleArn,executionRoleArn:p.executionRoleArn,networkMode:'awsvpc',revision,volumes:[{name:'tmp',host:{}},{name:'workspace',host:{}}],status:'ACTIVE',requiresAttributes:[{name:'ecs.capability.task-eni'}],placementConstraints:[],compatibilities:['EC2','FARGATE'],runtimePlatform:{cpuArchitecture:'X86_64',operatingSystemFamily:'LINUX'},requiresCompatibilities:['FARGATE'],cpu:'2048',memory:'8192',registeredAt:'2026-01-01T00:00:00Z',registeredBy:'arn:aws:iam::967807252336:user/synthetic',ephemeralStorage:{sizeInGiB:50}};return {t,expect:{arn:p.taskDefinitionArns[k],family:`meri-greenfield-qualification-${k}`,revision,image:p.image,logGroup:p.logGroup,region:p.region,executionRoleArn:p.executionRoleArn,workerRoleArn:p.workerRoleArn,probeKind:k,command}};}
 test('observed neutral service defaults validate and keyed reordering is tolerated',()=>{for(const k of ['sdk','office']){const {t,expect}=observedDefinition(k);assert.equal(validateTaskDefinition(t,expect),true);const reordered=structuredClone(t);reordered.volumes.reverse();reordered.containerDefinitions[0].environment.reverse();assert.equal(validateTaskDefinition(reordered,expect),true);}});
 test('synthetic minimal definitions without optional service metadata still validate',()=>{const p=fixturePins();for(const k of ['sdk','office'])assert.equal(validateTaskDefinition(p.taskDefinitionPins[k],{arn:p.taskDefinitionArns[k],family:`meri-greenfield-qualification-${k}`,revision:k==='sdk'?1:2,image:p.image,logGroup:p.logGroup,region:p.region,executionRoleArn:p.executionRoleArn,workerRoleArn:p.workerRoleArn,probeKind:k,command:`/opt/meri-worker/probes/${k==='sdk'?'sdk-capture':'office-export'}.mjs`}),true);});
 test('non-empty neutral defaults, unknown fields, duplicates and reordered command are rejected',()=>{const {t,expect}=observedDefinition('sdk');const mutators=[x=>{x.containerDefinitions[0].linuxParameters.capabilities.add=['SYS_ADMIN']},x=>{x.containerDefinitions[0].linuxParameters.devices=[{hostPath:'/dev/x'}]},x=>{x.containerDefinitions[0].secrets=[{name:'S',valueFrom:'x'}]},x=>{x.containerDefinitions[0].dnsServers=['1.1.1.1']},x=>{x.containerDefinitions[0].logConfiguration.secretOptions=[{name:'S',valueFrom:'x'}]},x=>{x.containerDefinitions[0].unknownSetting=1},x=>{x.unknownTaskField=1},x=>{x.containerDefinitions[0].environment.push({name:'AWS_ACCESS_KEY_ID',value:'x'})},x=>{x.containerDefinitions[0].environment=[{name:'HOME',value:'/workspace/home'},{name:'HOME',value:'/other'}]},x=>{x.volumes=[{name:'tmp',host:{}},{name:'tmp',host:{}}]},x=>{x.containerDefinitions[0].command=['/tmp/evil']},x=>{x.status='INACTIVE'},x=>{x.containerDefinitions[0].privileged=true}];for(const mutate of mutators){const x=structuredClone(t);mutate(x);assert.throws(()=>validateTaskDefinition(x,expect));}});
}
