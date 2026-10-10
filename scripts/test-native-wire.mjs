// Codex owner completion: local captured-data and synthetic-expression checks.
// No AWS, process launch, provider, native worker or source access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { fixturePins,expressionEntries } from './test-native-enforcement.mjs';
import { buildNativeEnforcementAdmission as compile,buildNativeEnforcementStateMachine as graph,buildNativeEnforcementTemplate as template,buildCanaryEnforcementAdmission as compileCanary,buildCanaryEnforcementStateMachine as canaryGraph } from '../infra/native-enforcement/app.mjs';
import { buildPredicates } from '../infra/native-enforcement/lib/expressions.mjs';
import { SDK_WIRE_PROFILE,parseWireEvidence,sdkTaskFacts,sdkResultGuard,sdkCreatedMs } from '../infra/native-enforcement/lib/ecs-wire.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const ROOT=new URL('../',import.meta.url);
const runtime=new URL('.task-inputs/jsonata-2.0.6-runtime/jsonata.js',ROOT);
assert.equal(sha(readFileSync(runtime)),'8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b');
const jsonata=createRequire(import.meta.url)(fileURLToPath(runtime));
const capturePins={
 identity:'1d2a435ad58d91973bc8e2ed3aee523e38527b43770316549126ebdd2735bd84',
 'list-started-by':'966e007d90bfbfc8a95d1c7ded817e47f3bc628c60b28b84126c9530c6f6e935',
 'list-running':'9e1b482b31e95cd1ee1c7441f5d3bdf171855aed37cb668707ad9e34b761b653',
 'list-stopped':'c5be493ea9fc157560b0c7ae5e4007ffb79bf539a0b9d5ce257ab5533b2ac575',
 'ecs-describe-synthetic':'478c3158a7d78e56b0308ca08e82faf91913ad18dfbe689f499f9fda2f478785',
 'ec2-describe-qualification':'72ffb9cfcf05cc484e118b6af04cac212a972dbfe5d77815c5d4ab60843de628',
};
const captures={};
for(const [name,pin]of Object.entries(capturePins)){
 const raw=readFileSync(new URL(`.task-inputs/CODEX-G1-readonly-wire-1/teststate-${name}/stdout.bin`,ROOT));
 assert.equal(sha(raw),pin);const record=JSON.parse(raw);assert.equal(record.status,'SUCCEEDED');captures[name]=JSON.parse(record.inspectionData.result);
}
function pins(){const p=fixturePins();p.wireProfile=SDK_WIRE_PROFILE;
 const body=JSON.stringify({profile:SDK_WIRE_PROFILE,timestampEncoding:'iso8601',listResult:captures['list-started-by'],describeResult:captures['ecs-describe-synthetic'],eniResult:captures['ec2-describe-qualification'],identityResult:captures.identity});
 p.wireEvidence={origin:'SYNTHETIC_COMPOSITION_OF_READ_ONLY_CAPTURES',reference:'synthetic:captured-shapes',version:'1',body,sha256:sha(body)};return p;
}
const p=pins(),binding=compile({staticPins:p}),d=graph(binding),pred=buildPredicates(binding.pins);
const ev=(source,variables={})=>jsonata(source.startsWith('{% ')?source.slice(3,-3):source).evaluate({},variables);
const ctx=()=>({run:{uuid:p.runUuid,probeKind:'sdk'},D:Date.now()+720000,C:Date.now()+900000,calls:1,queue:[],allArns:[],owned:[],overflow:[],tokens:[],pages:0,qualificationFailed:false,hold:false,mode:0,issues:[],direct:[]});
const taskId='4a9c2d40f4094c8f88705108fdd11f2e',taskArn=`arn:aws:ecs:us-east-1:967807252336:task/meri-greenfield-qualification/${taskId}`;
const containerArn=`arn:aws:ecs:us-east-1:967807252336:container/meri-greenfield-qualification/${taskId}/85bd54ab-bd0a-41ae-a166-d626792d8d1d`;
// Task body is SYNTHETIC PascalCase. The container ARN is from retained CLI
// metadata; no real Step Functions task body / timestamp was captured yet.
function task(){return {TaskArn:taskArn,ClusterArn:p.clusterArn,TaskDefinitionArn:p.taskDefinitionArns.sdk,StartedBy:p.runUuid,Group:'meri-greenfield-qualification:sdk',LaunchType:'FARGATE',PlatformFamily:'Linux',PlatformVersion:'1.4.0',AvailabilityZone:'us-east-1a',EnableExecuteCommand:false,LastStatus:'STOPPED',DesiredStatus:'STOPPED',CreatedAt:'2026-10-10T14:05:00.000Z',Containers:[{Name:'worker',Image:p.image,ImageDigest:p.image.split('@')[1],LastStatus:'STOPPED',ExitCode:0,ContainerArn:containerArn,TaskArn:taskArn}],Overrides:{ContainerOverrides:[{Name:'worker'}],InferenceAcceleratorOverrides:[]},Tags:[{Key:'QualificationRun',Value:p.runUuid}],Attachments:[{Type:'ElasticNetworkInterface',Status:'ATTACHING',Details:[{Name:'networkInterfaceId',Value:'eni-12345678'}]}]};}

test('all six legacy A/B products retain their exact raw hashes',()=>{
 const Braw=readFileSync(new URL('.task-inputs/W02-18-owner-inputs/static-pins.json',ROOT));assert.equal(sha(Braw),'fc9f1beb1fc0e0c065abb9339ad4cfccc9a5b12591386064e113d128686591cc');
 const expected={A:['19dfb84639bad374aa8e38c255512d1a1cc76eb0843c3d2d5929d8a4a4d671c5','2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3','6a8c3255737fc3d9dc0153241fd3af49ad7d186607f7a3d6b371d2881561b4c7'],B:['9b9b77832b482e2d70f096326aa5c50cac60dbb1a37187bbb68cb6d20af654c1','2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3','c2de9e540fb97dc0e3a3ea421eea768ee58212c8593f4d70462bbc8f9bc0818a']};
 for(const [label,input]of [['A',fixturePins()],['B',JSON.parse(Braw)]]){const b=compile({staticPins:input});[b,graph(b),template(b)].forEach((v,i)=>assert.equal(sha(JSON.stringify(v)),expected[label][i]));}
});
test('old camel-case profile is static-only even when labelled actual',()=>{const q=fixturePins();q.wireEvidence.origin='OWNER_REVIEWED_ACTUAL_READ_ONLY_INTEGRATION';assert.equal(compile({staticPins:q,executeAdmitted:true}).runtimeEnabled,false);});
test('new profile stays inert for synthetic composition and has 94 parseable states',()=>{assert.equal(binding.runtimeEnabled,false);assert.equal(Object.keys(d.States).length,94);for(const x of expressionEntries(d))jsonata(x.source);assert.match(d.States.GuardInput.Choices[0].Condition,/false and/);});
test('three measured empty lists now route to RetainPage and preserve arrays',async()=>{for(const name of ['list-started-by','list-running','list-stopped']){const c=ctx();assert.equal(await ev(d.States.ListShape.Choices[0].Condition,{raw:captures[name],ctx:c}),true);const out=await ev(d.States.RetainPage.Assign.ctx,{raw:captures[name],ctx:c});assert.deepEqual(out.queue,[]);assert.deepEqual(out.allArns,[]);assert.equal(out.nextToken,null);}});
test('measured MISSING does not provide task coverage or a positive task verdict',async()=>{assert.equal(await ev(pred.coverage,{raw:captures['ecs-describe-synthetic'],ctx:{currentArn:taskArn}}),false);assert.deepEqual(captures['ecs-describe-synthetic'].Tasks,[]);assert.equal(captures['ecs-describe-synthetic'].Failures[0].Reason,'MISSING');});
test('raw wire remains exact; three new records precede task projection',()=>{for(const name of ['DescribeCandidate','PreStopDescribe','TerminalDescribe']){const wire=d.States[d.States[name].Next];assert.equal(wire.Output.kind,'ECS_WIRE');assert.match(wire.Output.raw,/\$raw/);assert.ok(!Object.hasOwn(d.States[name].Assign,'rawWire'));assert.equal(d.States[name].Assign.raw,'{% ($s:=$string($states.result);$length($s)*6<=32768?$states.result:null) %}');}});
test('duplicate JSON names and nested mixed-case/collisions refuse before evidence parsing',()=>{const body=p.wireEvidence.body;assert.throws(()=>parseWireEvidence(body.replace('"profile":','"pr\\u006ffile":"x","profile":'),p));for(const change of [w=>w.listResult.taskArns=[],w=>w.describeResult.tasks=[],w=>w.describeResult.Tasks=[{TaskArn:taskArn,TaskARN:taskArn}],w=>w.eniResult.networkInterfaces=[]]){const w=JSON.parse(body);change(w);assert.throws(()=>parseWireEvidence(JSON.stringify(w),p));}});
test('list wrong casing, nested ARN arrays, repeated/oversized tokens refuse',async()=>{for(const raw of [{taskArns:[]},{TaskArns:[],taskArns:[]},{TaskArns:[[taskArn]]},{TaskArns:[],NextToken:''},{TaskArns:[],NextToken:'x'.repeat(2049)}])assert.equal(await ev(d.States.ListShape.Choices[0].Condition,{raw,ctx:ctx()}),false);const c=ctx();c.tokens=['seen'];assert.equal(await ev(d.States.ListShape.Choices[0].Condition,{raw:{TaskArns:[],NextToken:'seen'},ctx:c}),false);});
test('synthetic pagination preserves the opaque token and original cap',async()=>{const raw={TaskArns:[taskArn],NextToken:'opaque-token'},c=ctx();assert.equal(await ev(d.States.ListShape.Choices[0].Condition,{raw,ctx:c}),true);const out=await ev(d.States.RetainPage.Assign.ctx,{raw,ctx:c});assert.deepEqual(out.queue,[taskArn]);assert.deepEqual(out.tokens,['opaque-token']);assert.equal(out.nextToken,'opaque-token');});
test('RunShape rejects malformed immediate arrays, never flattens five ARNs',async()=>{for(const Tasks of [[{TaskArn:[taskArn]}],[[{TaskArn:taskArn}]],[{TaskArn:taskArn},{TaskArn:[taskArn]}],Array.from({length:5},()=>({TaskArn:taskArn}))])assert.equal(await ev(d.States.RunShape.Choices[0].Condition,{raw:{Tasks,Failures:[]},ctx:ctx()}),false);assert.equal(await ev(d.States.RunShape.Choices[0].Condition,{raw:{Tasks:[{TaskArn:taskArn}],Failures:[]},ctx:ctx()}),true);});
test('projection preserves singleton and empty arrays and all container count',async()=>{const t=task(),f=await ev(sdkTaskFacts('$t'),{t});assert.deepEqual(f.tags,[{key:'QualificationRun',value:p.runUuid}]);assert.deepEqual(f.attachments[0].details,[{name:'networkInterfaceId',value:'eni-12345678'}]);assert.deepEqual(f.overrides,{containerOverrides:[{name:'worker'}],inferenceAcceleratorOverrides:[]});assert.equal(f.worker.containerArn,containerArn);t.Tags=[];t.Attachments[0].Details=[];t.Containers.push({Name:'extra'});const g=await ev(sdkTaskFacts('$t'),{t});assert.deepEqual(g.tags,[]);assert.deepEqual(g.attachments[0].details,[]);assert.equal(g.containerCount,2);t.Attachments=[{Type:'ElasticNetworkInterface',Status:'DELETED'}];const h=await ev(sdkTaskFacts('$t'),{t});assert.equal(Object.hasOwn(h.attachments[0],'details'),false);});
test('nested malformed scalar arrays refuse and override authority cannot disappear',async()=>{for(const mutate of [t=>t.Containers[0].Name=['worker'],t=>t.Tags[0].Value=[p.runUuid],t=>t.Attachments[0].Details[0].Value=['eni-12345678']]){const t=task();mutate(t);assert.equal(await ev(sdkResultGuard('$raw','tasks'),{raw:{Tasks:[t],Failures:[]}}),false);}const t=task();t.Overrides.TaskRoleArn='synthetic:forbidden';const f=await ev(sdkTaskFacts('$t'),{t});assert.deepEqual(f.overrides,{unsupported:true});assert.equal(await ev(pred.mismatch,{ctx:{current:f,owned:[],overflow:[],currentArn:taskArn,run:{uuid:p.runUuid,probeKind:'sdk'}}}),true);});
test('actual-shaped container ARN binds exact task ID and original positive ledger',async()=>{const f=await ev(sdkTaskFacts('$t'),{t:task()}),c={...ctx(),current:f,currentArn:taskArn};c.owned=[{arn:taskArn,definition:p.taskDefinitionArns.sdk,containerArn,qualifiedSeen:true,netId:null,netIp:null}];assert.equal(await ev(pred.terminal,{ctx:c}),true);for(const bad of [containerArn.replace(taskId,'f'.repeat(32)),containerArn+'/extra',containerArn.replace('85bd54ab-','85BD54AB-'),containerArn.replace('/85bd54ab-bd0a-41ae-a166-d626792d8d1d','')]){c.current.worker.containerArn=bad;assert.equal(await ev(pred.terminal,{ctx:c}),false);}c.current.worker.containerArn=containerArn;c.owned[0].containerArn=containerArn.replace('85bd54ab','95bd54ab');assert.equal(await ev(pred.terminal,{ctx:c}),false);});
test('nonzero worker exit remains FAILED while STOPPED evidence stays independent',async()=>{const f=await ev(sdkTaskFacts('$t'),{t:task()});f.worker.exitCode=143;const c={...ctx(),current:f,currentArn:taskArn};c.owned=[{arn:taskArn,definition:p.taskDefinitionArns.sdk,containerArn,qualifiedSeen:true,netId:null,netIp:null,terminal:false}];assert.equal(await ev(pred.terminal,{ctx:c}),true);const out=await ev(d.States.RetainTerminal.Assign.ctx,{ctx:c,observedMs:Date.now()});assert.equal(out.qualificationFailed,true);assert.equal(out.owned.terminal??out.owned[0].terminal,true);});
test('explicit timestamp encodings reject unsupported value forms',async()=>{assert.equal(await ev(sdkCreatedMs('iso8601'),{states:{result:{Tasks:[{CreatedAt:'2026-10-10T14:05:00.000Z'}]}}}),Date.parse('2026-10-10T14:05:00.000Z'));for(const value of [1791641100,'2026-10-10',[],{},'1791641100'])assert.equal(await ev(sdkCreatedMs('iso8601'),{states:{result:{Tasks:[{CreatedAt:value}]}}}),null);assert.equal(await ev(sdkCreatedMs('epoch-seconds'),{states:{result:{Tasks:[{CreatedAt:1791641100.25}]}}}),1791641100250);assert.equal(await ev(sdkCreatedMs('epoch-seconds'),{states:{result:{Tasks:[{CreatedAt:1791641100250}]}}}),null);assert.throws(()=>sdkCreatedMs('epoch-milliseconds'));});
test('oversized raw SDK response is dropped before persistent assignment',async()=>{const result={TaskArns:[],Filler:'x'.repeat(6000)};assert.equal(await ev(d.States.ListFirst.Assign.raw,{states:{result}}),null);assert.equal(await ev(d.States.ListFirst.Assign.rawOver,{states:{result}}),true);assert.equal(await ev(d.States.ListShape.Choices[0].Condition,{raw:null,ctx:ctx()}),false);});

test('closed canary factory also selects SDK shape without native-profile fallback',()=>{
 const raw=readFileSync(new URL('.task-inputs/W02-19-owner-export-196e34dd-207d-48f6-8730-c8b2650b10a6/canary-input.json',ROOT));assert.equal(sha(raw),'cd6d1d598e33468bb776fac0c7325ddd2ea02b710f502ac0bf39e7d0e898cb39');
 const q=JSON.parse(raw).staticPins;q.wireProfile=SDK_WIRE_PROFILE;q.wireEvidence=structuredClone(p.wireEvidence);const b=compileCanary({staticPins:q}),g=canaryGraph(b);assert.equal(b.runtimeEnabled,false);assert.equal(Object.keys(g.States).length,94);for(const x of expressionEntries(g))jsonata(x.source);assert.match(g.States.CandidateCoverage.Choices[0].Condition,/\$raw\.Tasks/);assert.equal(g.States.DescribeCandidateWire.Output.kind,'ECS_WIRE');assert.equal(graph(b).StartAt,'AdmissionRefused');
});
