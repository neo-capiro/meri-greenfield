// W02-19 focused SOURCE-ONLY canary qualification fixtures: native byte equivalence, closed
// canary factory/definition/graph/policy, the one-resource task-definition template, cross-mode
// rejection and (when a pinned JSONata runtime path is supplied) selected actual canary
// expression evaluation. No workflow run, AWS, network, provider, model, SDK or acceptance.
//
// Usage:
//   node scripts/test-native-canary-profile.mjs
//   node scripts/test-native-canary-profile.mjs <path-to-jsonata-2.0.6.js> <fresh-output.json>
//
// Baselines are compared as raw UTF8 against the owner-frozen immutable originals; they are
// never rewritten. The original canonical fixture module is imported for its SYNTHETIC pins
// only (it is not run as main), so its guarded suite is not executed here.
import {readFileSync,writeFileSync,existsSync,mkdtempSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';

import * as app from '../infra/native-enforcement/app.mjs';
import {validateTaskDefinition,validateCanaryTaskDefinition} from '../infra/native-enforcement/lib/task-definition.mjs';
import {buildPredicates,buildCanaryPredicates} from '../infra/native-enforcement/lib/expressions.mjs';
import {CANARY_EVIDENCE_PINS,CANARY_EXECUTABLE,CANARY_FAMILY,CANARY_IMAGE,CANARY_IMAGE_CONFIG_SHA256,CANARY_KIND,CANARY_LOG_PREFIX,CANARY_MACHINE_NAME,CANARY_MANAGED_ROLE_NAME,CANARY_NETWORK,CANARY_PROFILE,CANARY_ROLE_PINS,CANARY_SOURCE_COMMIT,CANARY_TARGET,PROFILE_CANARY,PROFILE_NATIVE} from '../infra/native-enforcement/lib/probe-profiles.mjs';

const {TARGET,NETWORK,ROLE_PINS,WIRE_PROFILE,EVIDENCE_KINDS,LIMITS,canonical,sha256}=app;
const {buildNativeEnforcementAdmission,buildNativeEnforcementStateMachine,buildNativeEnforcementTemplate,buildCanaryEnforcementAdmission,buildCanaryEnforcementStateMachine,buildCanaryEnforcementTemplate,buildCanaryTaskDefinitionTemplate,isCanaryBinding}=app;

const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,'..');
const BASELINE=resolve(ROOT,'.task-inputs/W02-19-original-baseline-1');
const {fixturePins,runShapeFixtures}=await import(new URL('./test-native-enforcement.mjs',import.meta.url).href);

let checks=0;const pass=label=>{checks++;console.log('PASS',label);};
const expectThrow=(label,fn)=>{let threw=false;try{fn();}catch{threw=true;}assert.equal(threw,true,label+' must throw');pass(label+' (refused)');};
const expectThrowMatch=(label,fn,frag)=>{let e=null;try{fn();}catch(err){e=err;}assert.ok(e,label+' must throw');assert.ok(String(e.message).includes(frag),label+' reason was: '+e.message);pass(label+' (refused: '+frag+')');};
const expectNoThrow=(label,fn)=>{let v;try{v=fn();}catch(e){throw new Error(label+' unexpectedly threw: '+e.message);}pass(label);return v;};
const rawBytes=v=>Buffer.from(JSON.stringify(v));
const byteEquals=(name,value)=>{const want=readFileSync(resolve(BASELINE,name));const got=rawBytes(value);assert.equal(got.length,want.length,name+' byte length '+got.length+' vs '+want.length);assert.ok(got.equals(want),name+' must be byte-identical');return got.length;};

// ---------------------------------------------------------------------------------------
// Synthetic canary fixture. Clearly SYNTHETIC; not deployable authority or actual evidence.
// ---------------------------------------------------------------------------------------
function canaryFixturePins(){
 const p={account:CANARY_TARGET.account,region:CANARY_TARGET.region,runUuid:'c1a1e5d2-4b7c-4e2a-9f3d-0a1b2c3d4e5f',stateMachineName:CANARY_MACHINE_NAME,managedRoleName:CANARY_MANAGED_ROLE_NAME,clusterArn:`arn:aws:ecs:${CANARY_TARGET.region}:${CANARY_TARGET.account}:cluster/meri-greenfield-qualification`,taskDefinitionArns:{canary:`arn:aws:ecs:${CANARY_TARGET.region}:${CANARY_TARGET.account}:task-definition/${CANARY_FAMILY}:7`},executionRoleArn:CANARY_ROLE_PINS.execution,workerRoleArn:CANARY_ROLE_PINS.worker,image:CANARY_IMAGE,imageConfigSha256:CANARY_IMAGE_CONFIG_SHA256,sourceCommit:CANARY_SOURCE_COMMIT,platformVersion:'1.4.0',network:{...CANARY_NETWORK},logGroup:'/meri-greenfield/qualification/runtime',kmsKeyArn:`arn:aws:kms:${CANARY_TARGET.region}:${CANARY_TARGET.account}:key/11111111-1111-4111-8111-111111111111`,taskDefinitionPins:{},authorityDocuments:[],wireProfile:WIRE_PROFILE,timestampEncoding:'iso8601',wireEvidence:{},canaryEvidencePins:structuredClone(CANARY_EVIDENCE_PINS)};
 p.taskDefinitionPins.canary={taskDefinitionArn:p.taskDefinitionArns.canary,family:CANARY_FAMILY,revision:7,executionRoleArn:p.executionRoleArn,taskRoleArn:p.workerRoleArn,networkMode:'awsvpc',cpu:'2048',memory:'8192',requiresCompatibilities:['FARGATE'],runtimePlatform:{cpuArchitecture:'X86_64',operatingSystemFamily:'LINUX'},ephemeralStorage:{sizeInGiB:50},volumes:[{name:'workspace',host:{}},{name:'tmp',host:{}}],containerDefinitions:[{name:'worker',image:p.image,user:'10001:10001',essential:true,readonlyRootFilesystem:true,privileged:false,stopTimeout:60,entryPoint:['/usr/bin/sleep'],command:['1200'],linuxParameters:{capabilities:{drop:['ALL']}},mountPoints:[{sourceVolume:'workspace',containerPath:'/workspace',readOnly:false},{sourceVolume:'tmp',containerPath:'/tmp',readOnly:false}],environment:[['HOME','/workspace/home'],['TMPDIR','/tmp'],['CLAUDE_CONFIG_DIR','/workspace/config'],['PLAYWRIGHT_BROWSERS_PATH','/opt/meri-browsers'],['MERI_QUALIFICATION_ONLY','true'],['MERI_SOURCES_ENABLED','false'],['CHROMIUM_SANDBOX_REQUIRED','true']].map(([name,value])=>({name,value})),logConfiguration:{logDriver:'awslogs',options:{'awslogs-group':p.logGroup,'awslogs-region':p.region,'awslogs-stream-prefix':CANARY_LOG_PREFIX,mode:'blocking'}}}]};
 p.authorityDocuments=EVIDENCE_KINDS.map(kind=>{const body=canonical({SYNTHETIC_TEST_ONLY:true,kind});return {kind,reference:'synthetic:'+kind,version:'fixture-1',body,sha256:sha256(body)};});
 const body=canonical({profile:WIRE_PROFILE,timestampEncoding:'iso8601',listResult:{taskArns:[]},describeResult:{tasks:[]},eniResult:{NetworkInterfaces:[]},identityResult:{Account:CANARY_TARGET.account}});
 p.wireEvidence={origin:'SYNTHETIC_TEST_ONLY',reference:'synthetic:wire',version:'fixture-1',body,sha256:sha256(body)};
 return p;
}
const canaryExpect=p=>({arn:p.taskDefinitionArns.canary,family:CANARY_FAMILY,revision:Number(p.taskDefinitionArns.canary.split(':').at(-1)),image:p.image,logGroup:p.logGroup,region:p.region,executionRoleArn:p.executionRoleArn,workerRoleArn:p.workerRoleArn,probeKind:CANARY_KIND});

// =======================================================================================
// 1. Native output byte equivalence against owner-frozen baselines.
// =======================================================================================
const nativeBinding=buildNativeEnforcementAdmission({staticPins:fixturePins()});
const nativeDefinition=buildNativeEnforcementStateMachine(nativeBinding);
const nativeTemplate=buildNativeEnforcementTemplate(nativeBinding);
const nB=byteEquals('binding.json',nativeBinding);
const nD=byteEquals('definition.json',nativeDefinition);
const nT=byteEquals('template.json',nativeTemplate);
pass(`native binding byte-identical (${nB}B)`);
pass(`native definition byte-identical (${nD}B)`);
pass(`native template byte-identical (${nT}B)`);
assert.equal(nB,7133);assert.equal(nD,112210);assert.equal(nT,115766);
pass('native byte lengths match frozen baseline (7133/112210/115766)');

// =======================================================================================
// 2. Native contract behavior retained (default refusal, synthetic inert, cross-mode reject).
// =======================================================================================
assert.equal(buildNativeEnforcementAdmission().runtimeEnabled,false);
assert.equal(buildNativeEnforcementStateMachine().States.AdmissionRefused.Type,'Fail');
expectThrow('template() refuses inert default',()=>buildNativeEnforcementTemplate());
assert.equal(buildNativeEnforcementAdmission({staticPins:fixturePins(),executeAdmitted:true}).runtimeEnabled,false);
pass('native default/missing refuses and synthetic wire stays inert despite Boolean true');
expectThrow('native admission refuses added canaryEvidencePins field',()=>buildNativeEnforcementAdmission({staticPins:{...fixturePins(),canaryEvidencePins:{}}}));
expectThrow('native admission refuses canary arn collection',()=>{const p=fixturePins();p.taskDefinitionArns={canary:p.taskDefinitionArns.sdk};buildNativeEnforcementAdmission({staticPins:p});});
expectThrow('native admission refuses foreign role',()=>{const p=fixturePins();p.workerRoleArn='arn:aws:iam::111111111111:role/x';buildNativeEnforcementAdmission({staticPins:p});});
expectThrow('native admission refuses added capability',()=>{const p=fixturePins();p.taskDefinitionPins.sdk.containerDefinitions[0].linuxParameters.capabilities.add=['SYS_ADMIN'];buildNativeEnforcementAdmission({staticPins:p});});

// =======================================================================================
// 3. Canary factory: positive, provenance, distinct identity, inert default, mutation-safety.
// =======================================================================================
assert.equal(buildCanaryEnforcementAdmission().runtimeEnabled,false);
assert.equal(buildCanaryEnforcementStateMachine().States.AdmissionRefused.Type,'Fail');
expectThrow('canary template refuses inert default',()=>buildCanaryEnforcementTemplate());
pass('canary default/missing refuses before any factory authority');

const canaryPins=canaryFixturePins();
const canaryBinding=buildCanaryEnforcementAdmission({staticPins:canaryPins});
assert.equal(canaryBinding.runtimeEnabled,false);
assert.match(canaryBinding.staticBindingId,/^[a-f0-9]{64}$/);
assert.notEqual(canaryBinding.staticBindingId,nativeBinding.staticBindingId);
assert.equal(canaryBinding.pins.canaryProfile,CANARY_PROFILE);
assert.equal(Object.isFrozen(canaryBinding.pins.canaryProfile),true);
assert.equal(Object.isFrozen(canaryBinding.pins.canaryProfile.entryPoint),true);
assert.deepEqual(Object.keys(canaryBinding.pins.canaryProfile),['kind','family','entryPoint','command']);
assert.equal(isCanaryBinding(canaryBinding),true);
assert.equal(app.isCanaryBinding(nativeBinding),false);
pass('canary positive binding: inert, distinct 64hex id, deep-frozen 4-key canaryProfile');
assert.equal(buildCanaryEnforcementAdmission({staticPins:canaryFixturePins()}).staticBindingId,canaryBinding.staticBindingId);
pass('canary binding id is stable across identical synthetic input');
assert.equal(buildCanaryEnforcementAdmission({staticPins:canaryPins,executeAdmitted:true}).runtimeEnabled,false);
pass('canary synthetic wire stays inert despite executeAdmitted:true');

// Mutation after compilation must not alter the compiled binding.
const mutable=canaryFixturePins();const compiled=buildCanaryEnforcementAdmission({staticPins:mutable});
const beforeId=compiled.staticBindingId;mutable.image='x';mutable.taskDefinitionArns.canary='y';
assert.equal(compiled.staticBindingId,beforeId);assert.equal(compiled.pins.image,CANARY_IMAGE);
pass('mutating caller input after compilation cannot change the compiled binding');

// =======================================================================================
// 4. Canary negatives: lookalike/mix/extra/forged/options/authority/strict evidence pins.
// =======================================================================================
const canaryNegatives=[
 ['sdk+office arn collection',p=>{p.taskDefinitionArns={sdk:p.taskDefinitionArns.canary,office:p.taskDefinitionArns.canary};}],
 ['canary+sdk mixed arns',p=>{p.taskDefinitionArns={canary:p.taskDefinitionArns.canary,sdk:p.taskDefinitionArns.canary};}],
 ['unknown top-level field',p=>{p.extraField=1;}],
 ['caller-supplied canaryProfile field',p=>{p.canaryProfile=CANARY_PROFILE;}],
 ['unknown nested evidence key',p=>{p.canaryEvidencePins.unexpected=true;}],
 ['wrong inventory payload bytes',p=>{p.canaryEvidencePins.inventoryPayloadBytes=1;}],
 ['wrong result sha',p=>{p.canaryEvidencePins.resultSha256='0'.repeat(64);}],
 ['wrong executable sha',p=>{p.canaryEvidencePins.executable.sha256='0'.repeat(64);}],
 ['non-integer executable bytes',p=>{p.canaryEvidencePins.executable.bytes='43432';}],
 ['unknown executable key',p=>{p.canaryEvidencePins.executable.extra=1;}],
 ['mutable/different image',p=>{p.image=CANARY_IMAGE.replace('bf55f','AAAAA');}],
 ['wrong image config',p=>{p.imageConfigSha256='0'.repeat(64);}],
 ['different build source',p=>{p.sourceCommit='f'.repeat(40);}],
 ['wrong canary machine name',p=>{p.stateMachineName='meri-greenfield-native-enforcement-fixture';}],
 ['wrong managed role name',p=>{p.managedRoleName='MeriGreenfield-NativeEnforcement-Fixture';}],
 ['foreign account',p=>{p.account='111111111111';}],
 ['family revision zero',p=>{p.taskDefinitionArns.canary=p.taskDefinitionArns.canary.replace(':7',':0');}],
 ['family wrong kind',p=>{p.taskDefinitionArns.canary=p.taskDefinitionArns.canary.replace('canary','sdk');}],
 ['record entryPoint node',p=>{p.taskDefinitionPins.canary.containerDefinitions[0].entryPoint=['node'];}],
 ['record command extra arg',p=>{p.taskDefinitionPins.canary.containerDefinitions[0].command=['1200','--x'];}],
 ['record command duration drift',p=>{p.taskDefinitionPins.canary.containerDefinitions[0].command=['600'];}],
 ['record entryPoint shell',p=>{p.taskDefinitionPins.canary.containerDefinitions[0].entryPoint=['/bin/sh','-c'];}],
 ['record added capability',p=>{p.taskDefinitionPins.canary.containerDefinitions[0].linuxParameters.capabilities.add=['SYS_ADMIN'];}],
 ['record added secret',p=>{p.taskDefinitionPins.canary.containerDefinitions[0].secrets=[{name:'S',valueFrom:'x'}];}],
 ['record extra container',p=>{p.taskDefinitionPins.canary.containerDefinitions.push({name:'other'});}],
 ['record unknown field',p=>{p.taskDefinitionPins.canary.containerDefinitions[0].unknownSetting=1;}],
 ['missing authority kind',p=>{p.authorityDocuments.pop();}],
 ['mismatched authority bytes',p=>{p.authorityDocuments[0].body+=' ';}],
 ['wrong wire casing',p=>{p.wireProfile='guessed';}],
 ['added environment entry',p=>{p.taskDefinitionPins.canary.containerDefinitions[0].environment.push({name:'AWS_ACCESS_KEY_ID',value:'fake'});}]
];
for(const [label,mutate] of canaryNegatives)expectThrow('canary rejects '+label,()=>{const p=canaryFixturePins();mutate(p);buildCanaryEnforcementAdmission({staticPins:p});});

// Forged lookalike binding object (not produced by the factory) obtains no authority.
const forged={runtimeEnabled:true,staticBindingId:canaryBinding.staticBindingId,pins:structuredClone(canaryBinding.pins),reasons:[]};
assert.equal(buildCanaryEnforcementStateMachine(forged).States.AdmissionRefused.Type,'Fail');
expectThrow('canary template refuses forged lookalike binding',()=>buildCanaryEnforcementTemplate(forged));
assert.equal(buildNativeEnforcementStateMachine(forged).States.AdmissionRefused.Type,'Fail');
pass('forged lookalike binding is refused by both graph builders and the template');

// =======================================================================================
// 5. Cross-mode structural rejection: native graph/template refuse canary, and vice versa.
// =======================================================================================
assert.equal(buildNativeEnforcementStateMachine(canaryBinding).States.AdmissionRefused.Type,'Fail');
expectThrow('native template refuses canary binding',()=>buildNativeEnforcementTemplate(canaryBinding));
assert.equal(buildCanaryEnforcementStateMachine(nativeBinding).States.AdmissionRefused.Type,'Fail');
expectThrow('canary template refuses native binding',()=>buildCanaryEnforcementTemplate(nativeBinding));
pass('native rejects canary and canary rejects native binding');

// =======================================================================================
// 6. validateCanaryTaskDefinition positives/negatives; native validator unchanged.
// =======================================================================================
const cp=canaryFixturePins();
assert.equal(validateCanaryTaskDefinition(cp.taskDefinitionPins.canary,canaryExpect(cp)),true);
pass('canary definition record validates against exact direct-sleep binding');
assert.equal(validateTaskDefinition(fixturePins().taskDefinitionPins.sdk,{arn:fixturePins().taskDefinitionArns.sdk,family:'meri-greenfield-qualification-sdk',revision:1,image:fixturePins().image,logGroup:fixturePins().logGroup,region:fixturePins().region,executionRoleArn:fixturePins().executionRoleArn,workerRoleArn:fixturePins().workerRoleArn,probeKind:'sdk',command:'/opt/meri-worker/probes/sdk-capture.mjs'}),true);
pass('native validator still accepts the original synthetic record');
expectThrow('native validator rejects a direct-sleep (canary) invocation',()=>{const q=canaryFixturePins();validateTaskDefinition(q.taskDefinitionPins.canary,{...canaryExpect(q),probeKind:'sdk',command:'/opt/meri-worker/probes/sdk-capture.mjs'});});
expectThrow('canary validator rejects node entryPoint',()=>{const q=canaryFixturePins();q.taskDefinitionPins.canary.containerDefinitions[0].entryPoint=['node'];validateCanaryTaskDefinition(q.taskDefinitionPins.canary,canaryExpect(q));});
expectThrow('canary validator rejects non-empty capabilities',()=>{const q=canaryFixturePins();q.taskDefinitionPins.canary.containerDefinitions[0].linuxParameters.capabilities.add=['SYS_ADMIN'];validateCanaryTaskDefinition(q.taskDefinitionPins.canary,canaryExpect(q));});
expectThrow('canary validator rejects unknown container field',()=>{const q=canaryFixturePins();q.taskDefinitionPins.canary.containerDefinitions[0].unexpected=1;validateCanaryTaskDefinition(q.taskDefinitionPins.canary,canaryExpect(q));});

// =======================================================================================
// 7. Canary graph: kind/selection/one-launch/no-retry and unchanged containment semantics.
// =======================================================================================
const canaryDefinition=buildCanaryEnforcementStateMachine(canaryBinding);
const canaryGraphBytes=Buffer.byteLength(JSON.stringify(canaryDefinition));
const canaryTemplate=buildCanaryEnforcementTemplate(canaryBinding);
const graphSha=sha256(JSON.stringify(canaryDefinition)),templateSha=sha256(JSON.stringify(canaryTemplate));
const canaryTaskTemplate=buildCanaryTaskDefinitionTemplate();
const ctSha=sha256(JSON.stringify(canaryTaskTemplate));
assert.equal(Object.keys(canaryDefinition.States).length,91);
assert.deepEqual(Object.keys(canaryDefinition.States).sort(),Object.keys(nativeDefinition.States).sort());
pass('canary graph has the same 91 states as native (zero new persistent states)');
assert.equal(canaryDefinition.States.Initialize.Assign.ctx,nativeDefinition.States.Initialize.Assign.ctx);
pass('canary Initialize ctx is byte-identical to native (no new persistent fields)');
assert.equal(canaryDefinition.States.AdmissionRecord.Output.kind,'ADMISSION');
const passCtx=Object.values(canaryDefinition.States).filter(s=>s.Type==='Pass'&&s.Assign&&s.Assign.ctx).length;
const recordStates=Object.values(canaryDefinition.States).filter(s=>s.Type==='Pass'&&s.Output&&s.Output.kind).length;
const taskStates=Object.values(canaryDefinition.States).filter(s=>s.Type==='Task');
assert.equal(passCtx,39);assert.equal(recordStates,9);assert.equal(taskStates.length,10);
pass('builder inventory preserved: 39 Pass-with-ctx (Initialize + 31 pass + 7 prepare), 9 records, 10 tasks');
assert.equal(taskStates.filter(s=>s.Resource.endsWith(':runTask')).length,1);
assert.equal(canaryDefinition.States.RunTask.Arguments.TaskDefinition,app.J(JSON.stringify(canaryBinding.pins.taskDefinitionArns.canary)));
assert.ok(!JSON.stringify(canaryDefinition).includes('"Retry"'));
assert.ok(!JSON.stringify(canaryDefinition).includes('"Type":"Parallel"'));
assert.ok(!JSON.stringify(canaryDefinition).includes('"Type":"Map"'));
assert.equal(canaryDefinition.States.RunTask.Arguments.LaunchType,'FARGATE');
assert.equal(canaryDefinition.States.RunTask.Arguments.PlatformVersion,'1.4.0');
assert.equal(canaryDefinition.States.RunTask.Arguments.Count,1);
pass('canary graph: exactly one RunTask with the single canary revision, no Retry/Map/Parallel');
assert.ok(canaryDefinition.States.RunTask.Arguments.ClientToken.includes('meri-canary-')||canaryDefinition.States.RunTask.Arguments.ClientToken.includes("'meri-'"));
pass('canary client token derived from canary probe kind');
const guard=canaryDefinition.States.GuardInput.Choices[0].Condition;
assert.ok(guard.includes("$states.input.probeKind='canary'"));
assert.ok(guard.includes("('meri-canary-' & $states.input.runUuid)"));
assert.ok(!guard.includes("'sdk'")&&!guard.includes("'office'"));
assert.ok(guard.includes('$count($keys($states.input))=5'));
assert.ok(guard.startsWith('{% false and'));
pass('canary guard accepts only kind canary / five keys / canary execution name and is inert');
const policy=canaryTemplate.Resources.NativeEnforcementRole.Properties.Policies[0].PolicyDocument.Statement;
const canaryArns=[canaryBinding.pins.taskDefinitionArns.canary];
assert.deepEqual(policy.find(s=>s.Action==='ecs:RunTask').Resource,canaryArns);
assert.equal(policy.find(s=>s.Action==='ecs:RunTask').Resource.length,1);
assert.deepEqual(policy.find(s=>s.Action==='ecs:RunTask').Condition.StringEquals['aws:RequestTag/QualificationProbe'],['canary']);
assert.deepEqual(policy.find(s=>s.Action==='iam:PassRole').Resource,[ROLE_PINS.execution,ROLE_PINS.worker]);
assert.equal(policy.find(s=>s.Action==='ecs:StopTask').Condition.StringEquals['aws:ResourceTag/QualificationRun'],canaryBinding.pins.runUuid);
assert.equal(policy.find(s=>s.Action==='ecs:DescribeTasks').Condition.StringEquals,undefined);
pass('canary policy: one canary revision + canary request tag; PassRole/StopTask/Describe unchanged');
assert.equal(Object.values(canaryTemplate.Resources).map(r=>r.Type).sort().join(','),'AWS::IAM::Role,AWS::StepFunctions::StateMachine');
pass('canary enforcement template still carries only the IAM role + state machine');
assert.equal(canaryDefinition.States.FinalConfirmed.Output.cleanup,'STOPPED_CONFIRMED');
assert.equal(canaryDefinition.States.FinalUnknown.Output.cleanup,'CLEANUP_UNKNOWN');
assert.equal(canaryDefinition.States.FinalConfirmed.Output.qualification,nativeDefinition.States.FinalConfirmed.Output.qualification);
assert.equal(canaryDefinition.States.FinalUnknown.Output.qualification,'NOT_ACCEPTED');
assert.ok(!JSON.stringify(canaryDefinition).includes('CANARY_PASS'));
assert.ok(!JSON.stringify(canaryDefinition).includes('CANARY_ACCEPTED'));
pass('RetainTerminal/final semantics and generic verdicts unchanged; no automatic canary pass field');
assert.equal(canaryDefinition.States.RetainTerminal.Next,'TerminalRecord');
assert.equal(canaryDefinition.States.TerminalRecord.Next,'AfterTerminal');
pass('RetainTerminal unchanged');
assert.equal(LIMITS.owned,4);assert.equal(LIMITS.overflow,6);assert.equal(LIMITS.D,720000);assert.equal(LIMITS.C,900000);
pass('limits unchanged: owned4/overflow6/D720000/C900000');

// =======================================================================================
// 8. One-resource inert canary task-definition template.
// =======================================================================================
const tpl=canaryTaskTemplate;
const types=Object.values(tpl.Resources).map(r=>r.Type);
assert.equal(Object.keys(tpl.Resources).length,1);
assert.equal(types[0],'AWS::ECS::TaskDefinition');
assert.ok(tpl.Resources.CanaryTaskDefinition);
assert.deepEqual(tpl.Outputs,{CanaryTaskDefinitionArn:{Value:{Ref:'CanaryTaskDefinition'}}});
const props=tpl.Resources.CanaryTaskDefinition.Properties;
assert.equal(props.Family,CANARY_FAMILY);
assert.equal(props.NetworkMode,'awsvpc');
assert.equal(props.Cpu,'2048');assert.equal(props.Memory,'8192');
assert.deepEqual(props.RequiresCompatibilities,['FARGATE']);
assert.equal(props.ExecutionRoleArn,ROLE_PINS.execution);
assert.equal(props.TaskRoleArn,ROLE_PINS.worker);
const cont=props.ContainerDefinitions[0];
assert.equal(props.ContainerDefinitions.length,1);
assert.equal(cont.Name,'worker');
assert.equal(cont.Image,CANARY_IMAGE);
assert.deepEqual(cont.EntryPoint,['/usr/bin/sleep']);
assert.deepEqual(cont.Command,['1200']);
assert.equal(cont.Environment.length,7);
assert.equal(cont.ReadonlyRootFilesystem,true);
assert.equal(cont.Privileged,false);
assert.equal(cont.User,'10001:10001');
assert.equal(cont.StopTimeout,60);
assert.deepEqual(cont.LinuxParameters,{Capabilities:{Drop:['ALL']}});
assert.equal(JSON.stringify(tpl).includes('Secrets'),false);
assert.equal(JSON.stringify(tpl).includes('PortMappings'),false);
assert.equal(JSON.stringify(tpl).includes('EnvironmentFiles'),false);
pass('canary task template: exactly one TaskDefinition, fixed bf55 image, direct sleep 1200');

// =======================================================================================
// 9. W18 literal-B compatibility DATA (distinct 10904 literal input; not the original fixture).
// =======================================================================================
const W18=resolve(ROOT,'.task-inputs/W02-19-w18-literal-baseline-1');
const byteEqualsIn=(dir,name,value)=>{const want=readFileSync(resolve(dir,name));const got=rawBytes(value);assert.equal(got.length,want.length,name+' B byte length '+got.length+' vs '+want.length);assert.ok(got.equals(want),name+' B byte-identical');};
const w18input=JSON.parse(readFileSync(resolve(W18,'compile-input.json'),'utf8'));
const w18binding=buildNativeEnforcementAdmission(w18input);
const w18definition=buildNativeEnforcementStateMachine(w18binding);
const w18template=buildNativeEnforcementTemplate(w18binding);
byteEqualsIn(W18,'binding.json',w18binding);
byteEqualsIn(W18,'definition.json',w18definition);
byteEqualsIn(W18,'template.json',w18template);
assert.notEqual(sha256(readFileSync(resolve(W18,'binding.json')).toString()),sha256(readFileSync(resolve(BASELINE,'binding.json')).toString()));
pass('W18 literal-B native binding/definition/template byte-identical (distinct 10904 literal input)');

// =======================================================================================
// 10. Fixed predicate helper contract: no caller-supplied profile object.
// =======================================================================================
assert.equal(typeof buildPredicates,'function');
assert.equal(buildPredicates.length,1);
assert.equal(buildCanaryPredicates.length,1);
assert.equal(app.buildPredicates,undefined);
assert.equal(app.buildCanaryPredicates,undefined);
pass('predicate helpers are fixed (native one-arg / canary fixed wrapper), not re-exported by app');

// =======================================================================================
// 11. Canary outer-option validation (supported keys only; missing stays inert).
// =======================================================================================
for(const [label,extra] of [['profile',{profile:{}}],['command',{command:['x']}],['entryPoint',{entryPoint:['/bin/sh']}],['duration',{duration:600}],['unknown',{unknownOption:1}]]){
 expectThrow('canary rejects outer '+label+' option',()=>buildCanaryEnforcementAdmission({staticPins:canaryFixturePins(),...extra}));
}
expectThrow('canary rejects non-boolean executeAdmitted',()=>buildCanaryEnforcementAdmission({staticPins:canaryFixturePins(),executeAdmitted:'yes'}));
assert.equal(buildCanaryEnforcementAdmission({}).runtimeEnabled,false);
assert.equal(buildCanaryEnforcementAdmission({executeAdmitted:true}).runtimeEnabled,false);
assert.equal(buildCanaryEnforcementAdmission({staticPins:canaryFixturePins(),executeAdmitted:true}).runtimeEnabled,false);
pass('canary supports only staticPins/executeAdmitted; default/missing inert; synthetic stays runtimeEnabled false');

// =======================================================================================
// 11b. F1: outer option/type validation precedes the missing-staticPins return.
// =======================================================================================
assert.equal(buildCanaryEnforcementAdmission().runtimeEnabled,false);
assert.equal(buildCanaryEnforcementAdmission({}).runtimeEnabled,false);
assert.equal(buildCanaryEnforcementAdmission({executeAdmitted:true}).runtimeEnabled,false);
assert.equal(buildCanaryEnforcementAdmission({executeAdmitted:false}).runtimeEnabled,false);
pass('canary permitted absence stays inert (noarg/empty/supported missing-pins boolean)');
expectThrow('canary rejects unknown option without pins',()=>buildCanaryEnforcementAdmission({command:['evil']}));
expectThrow('canary rejects profile option without pins',()=>buildCanaryEnforcementAdmission({profile:{}}));
expectThrow('canary rejects entryPoint option without pins',()=>buildCanaryEnforcementAdmission({entryPoint:['/bin/sh']}));
expectThrow('canary rejects duration option without pins',()=>buildCanaryEnforcementAdmission({duration:1}));
expectThrow('canary rejects non-boolean executeAdmitted without pins',()=>buildCanaryEnforcementAdmission({executeAdmitted:'yes'}));
expectThrow('canary rejects unknown option alongside falsy pins',()=>buildCanaryEnforcementAdmission({staticPins:false,command:['evil']}));
expectThrow('canary rejects null outer input',()=>buildCanaryEnforcementAdmission(null));
expectThrow('canary rejects array outer input',()=>buildCanaryEnforcementAdmission([]));
expectThrow('canary rejects primitive outer input',()=>buildCanaryEnforcementAdmission('x'));
expectThrow('canary rejects number outer input',()=>buildCanaryEnforcementAdmission(7));
for(const [label,v] of [['null',null],['false',false],['zero',0],['emptystring',''],['emptyarray',[]],['undefined',undefined]]){
 expectThrow('canary rejects explicitly present '+label+' staticPins',()=>buildCanaryEnforcementAdmission({staticPins:v}));
}
pass('canary F1: outer keys/object/type checked before missing-pins; present-falsy pins refused');

// =======================================================================================
// 11c. F2: native validator reads expect.command only at the original command position.
// =======================================================================================
const nfp=fixturePins();
const sdkExpectBase={arn:nfp.taskDefinitionArns.sdk,family:'meri-greenfield-qualification-sdk',revision:1,image:nfp.image,logGroup:nfp.logGroup,region:nfp.region,executionRoleArn:nfp.executionRoleArn,workerRoleArn:nfp.workerRoleArn,probeKind:'sdk'};
const withCommandGetter=()=>{let reads=0;const e={...sdkExpectBase};Object.defineProperty(e,'command',{get(){reads++;return '/opt/meri-worker/probes/sdk-capture.mjs';},enumerable:true,configurable:true});return {e,reads:()=>reads};};
let cg=withCommandGetter();
expectThrowMatch('native validator null definition refuses before reading command',()=>validateTaskDefinition(null,cg.e),'definition object');assert.equal(cg.reads(),0,'command getter count 0 on null definition');
cg=withCommandGetter();const wrongFamily=structuredClone(nfp.taskDefinitionPins.sdk);wrongFamily.family='meri-greenfield-qualification-office';
expectThrow('native validator rejects wrong family before command',()=>validateTaskDefinition(wrongFamily,cg.e));assert.equal(cg.reads(),0,'command getter count 0 on wrong family');
cg=withCommandGetter();const badEP=structuredClone(nfp.taskDefinitionPins.sdk);badEP.containerDefinitions[0].entryPoint=['sh'];
expectThrowMatch('native validator rejects bad entryPoint before command',()=>validateTaskDefinition(badEP,cg.e),'entryPoint');assert.equal(cg.reads(),0,'command getter count 0 on bad entryPoint');
cg=withCommandGetter();assert.equal(validateTaskDefinition(structuredClone(nfp.taskDefinitionPins.sdk),cg.e),true);assert.equal(cg.reads(),1,'command getter read once on valid record');
const boom={...canaryExpect(canaryFixturePins())};Object.defineProperty(boom,'command',{get(){throw new Error('command must not be read');},enumerable:true,configurable:true});
assert.equal(validateCanaryTaskDefinition(canaryFixturePins().taskDefinitionPins.canary,boom),true);
pass('canary F2: native command read only at command position; canary never reads expect.command');

// =======================================================================================
// 12. Legacy-export mutation cannot grant canary authority (before/after a branded binding).
// =======================================================================================
const snapshotLegacy=()=>({target:{...app.TARGET},network:{...app.NETWORK},roles:{...app.ROLE_PINS},limits:{...app.LIMITS},kinds:[...app.EVIDENCE_KINDS]});
const restoreLegacy=s=>{Object.assign(app.TARGET,s.target);Object.assign(app.NETWORK,s.network);Object.assign(app.ROLE_PINS,s.roles);Object.assign(app.LIMITS,s.limits);app.EVIDENCE_KINDS.length=0;app.EVIDENCE_KINDS.push(...s.kinds);};
const branded=buildCanaryEnforcementAdmission({staticPins:canaryFixturePins()});
const fixedTaskTemplate=JSON.stringify(buildCanaryTaskDefinitionTemplate());
const fixedTaskTemplateSha=sha256(fixedTaskTemplate);
const legacy=snapshotLegacy();
try{
 const mutations=[
  ['TARGET',()=>{app.TARGET.account='111111111111';},()=>{app.TARGET.account='967807252336';}],
  ['NETWORK',()=>{app.NETWORK.subnetId='subnet-00000000000000000';},()=>{app.NETWORK.subnetId='subnet-0864c000b771df32c';}],
  ['ROLE_PINS',()=>{app.ROLE_PINS.worker='arn:aws:iam::967807252336:role/UNREVIEWED';},()=>{app.ROLE_PINS.worker='arn:aws:iam::967807252336:role/MeriGreenfield-Qualificatio-EmptyWorkerRole7C03C4DD-nOWJZv6LQdqD';}],
  ['LIMITS',()=>{app.LIMITS.calls=1;},()=>{app.LIMITS.calls=512;}],
  ['EVIDENCE_KINDS',()=>{app.EVIDENCE_KINDS.pop();},()=>{app.EVIDENCE_KINDS.push('logsKms');}]
 ];
 for(const [label,mut,undo] of mutations){
  mut();
  expectThrowMatch('mutated legacy '+label+' refuses canary factory',()=>buildCanaryEnforcementAdmission({staticPins:canaryFixturePins()}),'canary boundary');
  expectThrowMatch('mutated legacy '+label+' refuses canary graph on branded binding',()=>buildCanaryEnforcementStateMachine(branded),'canary boundary');
  expectThrowMatch('mutated legacy '+label+' refuses canary enforcement template',()=>buildCanaryEnforcementTemplate(branded),'canary boundary');
  assert.equal(sha256(JSON.stringify(buildCanaryTaskDefinitionTemplate())),fixedTaskTemplateSha,'fixed task template under '+label+' mutation');
  undo();
 }
 pass('legacy-export mutation refuses canary factory/graph/template; fixed task template output unchanged');
}finally{restoreLegacy(legacy);}

// =======================================================================================
// 13. Optional pinned-runtime expression evaluation (isolated synthetic predicate fixtures).
// =======================================================================================
const [runtimeArg,outArg]=process.argv.slice(2);
const runtimeEvidence={ran:false};
if(runtimeArg){
 assert.ok(outArg,'usage with runtime requires a fresh output path');
 const out=resolve(outArg);
 assert.ok(!existsSync(out),'output must be a fresh path; prior captures are preserved');
 const RUNTIME_SHA='8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b';
 const rtSha=sha256(readFileSync(resolve(runtimeArg)));
 assert.equal(rtSha,RUNTIME_SHA,'retained JSONata 2.0.6 runtime SHA');
 const jsonata=createRequire(import.meta.url)(resolve(runtimeArg));
 const T0=Date.parse('2026-10-10T03:00:00.000Z'),OBSERVED=T0+1000,START=new Date(T0).toISOString();
 const unwrap=x=>{assert.ok(x.startsWith('{% ')&&x.endsWith(' %}'),'wrapped expression');return x.slice(3,-3);};
 let evaluations=0;
 const evaluate=async(source,vars={},states={})=>{evaluations++;const e=jsonata(unwrap(source));e.registerFunction('now',()=>new Date(OBSERVED).toISOString(),'<:s>');return e.evaluate({}, {...vars,states});};
 const binding=canaryBinding,p=binding.pins,d=canaryDefinition;
 const machineArn=`arn:aws:states:${p.region}:${p.account}:stateMachine:${p.stateMachineName}`;
 const execName=`meri-canary-${p.runUuid}`;
 const baseInput={runUuid:p.runUuid,probeKind:'canary',executionName:execName,staticBindingId:binding.staticBindingId,t0Ms:T0};
 const baseStates={input:baseInput,context:{Execution:{Name:execName,StartTime:START,Id:'exec-synthetic'},StateMachine:{Id:machineArn}}};

 // 9a. Isolated canary guard predicate.
 const guardRaw=unwrap(d.States.GuardInput.Choices[0].Condition);
 const guardIsolated='{% '+guardRaw.replace(/^false and /,'true and ')+' %}';
 assert.equal(await evaluate(guardIsolated,{},baseStates),true,'canary five-key input satisfies isolated guard');
 const sdkInput={...baseInput,probeKind:'sdk'};
 assert.equal(await evaluate(guardIsolated,{}, {input:sdkInput,context:{...baseStates.context,Execution:{...baseStates.context.Execution,Name:`meri-canary-${p.runUuid}`}}}),false,'sdk kind rejected');
 const extraInput={...baseInput,extra:1};
 assert.equal(await evaluate(guardIsolated,{}, {input:extraInput,context:baseStates.context}),false,'extra key rejected');
 const wrongUuid={...baseInput,runUuid:'00000000-0000-4000-8000-000000000000'};
 assert.equal(await evaluate(guardIsolated,{}, {input:wrongUuid,context:{...baseStates.context,Execution:{...baseStates.context.Execution,Name:`meri-canary-00000000-0000-4000-8000-000000000000`}}}),false,'wrong uuid rejected');
 pass('expression: canary guard accepts only exact five-key canary identity');

 // 9b. Selected definition literal.
 const selectedValue=await evaluate(d.States.RunTask.Arguments.TaskDefinition,{});
 assert.equal(selectedValue,p.taskDefinitionArns.canary);
 pass('expression: canary RunTask selects the single canary revision ARN');

 // 9c. Ownership predicate: foreign sdk/office cannot own; canary can.
 const t0=await evaluate(d.States.Initialize.Assign.ctx,{}, {input:baseInput});
 const ns=`arn:aws:ecs:${p.region}:${p.account}:task/${p.clusterArn.split('/')[1]}`;
 const taskArn=`${ns}/${'c'.repeat(32)}`;
 const ownership=d.States.OwnershipGate.Choices[1].Condition;
 const mkCurrent=definition=>({arn:taskArn,clusterArn:p.clusterArn,definition,startedBy:p.runUuid,group:`meri-greenfield-qualification:canary`,tags:[{key:'QualificationRun',value:p.runUuid},{key:'QualificationProbe',value:'canary'},{key:'MeriComponent',value:'native-enforcement'}],launchType:'FARGATE',platformFamily:'Linux',platformVersion:'1.4.0',enableExecuteCommand:false,containerCount:1});
 const octx={...t0,attemptStart:T0,attemptEnd:OBSERVED,currentArn:taskArn};
 assert.equal(await evaluate(ownership,{ctx:{...octx,current:mkCurrent(p.taskDefinitionArns.canary)},createdMs:T0+500,observedMs:OBSERVED}),true,'canary task is owned');
 assert.equal(await evaluate(ownership,{ctx:{...octx,current:mkCurrent(nativeBinding.pins.taskDefinitionArns.sdk)},createdMs:T0+500,observedMs:OBSERVED}),false,'foreign sdk task is not owned');
 assert.equal(await evaluate(ownership,{ctx:{...octx,current:mkCurrent(nativeBinding.pins.taskDefinitionArns.office)},createdMs:T0+500,observedMs:OBSERVED}),false,'foreign office task is not owned');
 pass('expression: canary ownership binds the canary definition; foreign sdk/office are not owned');

 // 9d. RunShape/RetainRun over the 16 focused immediate/scalar fixtures (canary graph).
 const fixtures=runShapeFixtures(p);
 const runShape=d.States.RunShape.Choices[0].Condition,retainRun=d.States.RetainRun.Assign.ctx,launchUncertain=d.States.LaunchUncertain.Assign.ctx,startScan=d.States.StartScan.Assign.ctx;
 const seededOwned={arn:`${ns}/${'a'.repeat(32)}`,definition:p.taskDefinitionArns.canary,netId:'eni-0123456789abcdef0',netIp:'10.0.0.7',stopAttempted:true,terminal:false,qualifiedSeen:true,probeSeq:0};
 const seededOverflow={arn:`${ns}/${'b'.repeat(32)}`,definition:p.taskDefinitionArns.canary,netId:'eni-0123456789abcdef1',netIp:'10.0.0.8',stopAttempted:true,terminal:false,qualifiedSeen:true,probeSeq:0};
 const ctx0={...t0,attemptConsumed:true,attemptStart:T0,attemptEnd:OBSERVED,owned:[seededOwned],overflow:[seededOverflow]};
 let retainCases=0,uncertainCases=0;
 for(const fx of fixtures){
  const raw=await evaluate(d.States.RunTask.Assign.raw,{ctx:ctx0},{result:fx.payload});
  const g=await evaluate(runShape,{ctx:ctx0,raw});
  const route=g?'RetainRun':'LaunchUncertain';
  if(fx.expectRetainRun===true)assert.equal(route,'RetainRun',fx.name+' must retain');
  if(fx.expectRetainRun===false)assert.equal(route,'LaunchUncertain',fx.name+' must route uncertain');
  const reached=route==='RetainRun'?await evaluate(retainRun,{ctx:ctx0,raw}):await evaluate(launchUncertain,{ctx:ctx0,raw,callError:null});
  if(route==='RetainRun'){retainCases++;assert.ok(reached.direct.length<=fx.payload.tasks.length,fx.name+' direct<=immediate');}else{uncertainCases++;assert.equal(reached.launchCertain,false,fx.name+' uncertain certainty');assert.equal(reached.qualificationFailed,true,fx.name+' uncertain failure');}
  assert.equal(reached.attemptConsumed,true,fx.name+' attemptConsumed survives');
  assert.equal(reached.owned[0].netId,'eni-0123456789abcdef0',fx.name+' owned net pin survives');
  assert.equal(reached.overflow[0].netIp,'10.0.0.8',fx.name+' overflow net pin survives');
  const scan=await evaluate(startScan,{ctx:reached});
  assert.ok(Array.isArray(scan.queue),fx.name+' StartScan queue');
  if(route==='LaunchUncertain')assert.ok(scan.queue.includes(seededOwned.arn)&&scan.queue.includes(seededOverflow.arn),fx.name+' discovery keeps originals');
 }
 assert.equal(retainCases+uncertainCases,16);
 pass(`expression: canary RunShape/RetainRun dispositions correct over ${fixtures.length} fixtures (${retainCases} retain / ${uncertainCases} uncertain)`);
 runtimeEvidence.ran=true;runtimeEvidence.runtimeSha256=rtSha;runtimeEvidence.evaluations=evaluations;runtimeEvidence.retainCases=retainCases;runtimeEvidence.uncertainCases=uncertainCases;
 const result={boundary:'W02-19_FOCUSED_SOURCE_ONLY_CANARY_QUALIFICATION__NOT_AWS_OR_WORKFLOW_OR_ACCEPTANCE',capturedUtc:new Date().toISOString(),runtimeSha256:rtSha,evaluations,checks,nativeByteLengths:{binding:nB,definition:nD,template:nT},canaryGraphBytes,canaryGraphSha256:graphSha,canaryEnforcementTemplateBytes:Buffer.byteLength(JSON.stringify(canaryTemplate)),canaryEnforcementTemplateSha256:templateSha,canaryTaskTemplateBytes:Buffer.byteLength(JSON.stringify(canaryTaskTemplate)),canaryTaskTemplateSha256:ctSha,retainCases,uncertainCases,limits:LIMITS,limitsOfEvidence:['Fixture compilation remains runtimeEnabled:false; the isolated guard predicate is a synthetic seed, not a source Boolean bypass or deployable admission.','Only selected actual canary source expressions were executed; no complete stop/cleanup simulation, AWS wire framing, IAM/tag propagation or physical termination was performed.','The canary graph/template are inert proposals and were not AWS-validated, deployed, registered or executed.']};
 writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log('RUNTIME SUCCESS',JSON.stringify({evaluations,retainCases,uncertainCases}));
}else{
 console.log('expression evaluation SKIPPED (no pinned runtime argument); structural checks only');
}

console.log('RESULT',JSON.stringify({checks,nativeByteLengths:{binding:nB,definition:nD,template:nT},canaryGraphBytes,canaryGraphSha256:graphSha,canaryTaskTemplateBytes:Buffer.byteLength(JSON.stringify(canaryTaskTemplate)),canaryTaskTemplateSha256:ctSha,canaryBindingId:canaryBinding.staticBindingId,runtimeEvaluation:runtimeEvidence.ran}));
