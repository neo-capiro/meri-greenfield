import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { FIXTURE as F, fixtureTags, fixtureMachineName, fixtureExecutionName } from './fixture-volume-binding.mjs';
import { createFixtureBootstrapDescriptor, validateFixtureBootstrapDescriptor, fixtureBootstrapInput } from './fixture-volume-activation.mjs';
import { compileFixtureWorkflow, compileFixtureBootstrapWorkflow, fixtureRefusal } from './fixture-volume-workflow.mjs';
import { compileFixtureTemplate, compileFixtureBootstrapTemplate } from './fixture-volume-template.mjs';

const T0=1791660000000, window={t0Ms:T0,createNotAfterMs:T0+300000}; // synthetic only
const descriptor=createFixtureBootstrapDescriptor(window), input=fixtureBootstrapInput(descriptor);
const graph=compileFixtureBootstrapWorkflow(descriptor), template=compileFixtureBootstrapTemplate(descriptor);
const copy=v=>structuredClone(v);
const sha=v=>createHash('sha256').update(v).digest('hex');
const evaluator=process.env.MERI_TEST_JSONATA;
assert.equal(typeof evaluator,'string','Explicit retained evaluator required');
assert.equal(sha(readFileSync(evaluator)),'8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b');
const jsonata=createRequire(import.meta.url)(evaluator);
const context=()=>({Execution:{Name:fixtureExecutionName(),Id:`arn:aws:states:${F.region}:${F.account}:execution:${fixtureMachineName()}:${fixtureExecutionName()}`,StartTime:new Date(T0).toISOString()},
 StateMachine:{Id:`arn:aws:states:${F.region}:${F.account}:stateMachine:${fixtureMachineName()}`}});
async function evaluate(expression,{ctx,ms=T0+1000,request=input,serviceContext=context(),result={},error={}}={}) {
 const compiled=jsonata(expression.slice(3,-3));compiled.registerFunction('now',()=>new Date(ms).toISOString(),'<:s>');
 return compiled.evaluate({}, {ctx,states:{input:request,context:serviceContext,result,errorOutput:error}});
}
const guard=(state,options)=>evaluate(graph.States[state].Choices[0].Condition,options);

test('finite version1 descriptor bytes have a literal independent ordering/content oracle',()=>{
 const literal='{"schema":"meri-browser-fixture-bootstrap-descriptor/1","profile":"MANAGED_WIRE_BOOTSTRAP_V1","environment":{"account":"967807252336","region":"us-east-1","runUuid":"b247b9a1-bfde-414a-a76b-9ff4fdd83110","subnet":"subnet-0864c000b771df32c","vpc":"vpc-06e1941747e798f0a","availabilityZone":"us-east-1a","keyArn":"arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042"},"names":{"machine":"MeriGF-BrowserFixture-b247b9a1-bfde-414a-a76b-9ff4fdd83110","execution":"meri-browser-fixture-b247b9a1-bfde-414a-a76b-9ff4fdd83110"},"resource":{"sizeGiB":1,"volumeType":"gp3","encrypted":true,"attachments":"NEVER_ATTACH","tags":[{"Key":"MeriComponent","Value":"qualification-browser-wire"},{"Key":"QualificationRun","Value":"b247b9a1-bfde-414a-a76b-9ff4fdd83110"},{"Key":"MeriPurpose","Value":"empty-absence-wire"}]},"clock":{"t0Ms":1791660000000,"createNotAfterMs":1791660300000,"C":1791660900000},"limits":{"ceilingMs":900000,"createWindowMs":300000,"maxPages":8,"pageSize":100,"maxRows":800,"maxCalls":512,"maxPolls":160,"maxResultChars":32768,"maxTokenChars":2048},"wireProfile":"UNQUALIFIED-ec2-sdk-pascal-iso-millis-z-v1"}';
 const {ownerBindingId,...body}=descriptor;
 assert.equal(JSON.stringify(body),literal);assert.equal(ownerBindingId,sha(Buffer.from(literal,'utf8')));
 assert.equal(JSON.stringify(createFixtureBootstrapDescriptor({createNotAfterMs:T0+300000,t0Ms:T0})),JSON.stringify(descriptor));
 assert.notEqual(createFixtureBootstrapDescriptor({...window,createNotAfterMs:T0+1000}).ownerBindingId,ownerBindingId);
 assert.deepEqual(Object.keys(input),['profile','runUuid','t0Ms','createNotAfterMs','ownerBindingId']);
});
test('exact window DATA refuses missing, foreign, unstable, nonfinite and accessor inputs before reading',()=>{
 for(const v of [undefined,null,[],{}, {...window,execute:true},{...window,sourceCommit:'a'.repeat(40)},
  {...window,t0Ms:NaN},{...window,t0Ms:Infinity},{...window,t0Ms:1791660000000.5},
  {...window,createNotAfterMs:T0},{...window,createNotAfterMs:T0+300001},Object.assign(Object.create(null),window)])
  assert.throws(()=>createFixtureBootstrapDescriptor(v));
 let touched=0;const getter={...window};Object.defineProperty(getter,'t0Ms',{get(){touched++;return T0;}});
 assert.throws(()=>createFixtureBootstrapDescriptor(getter));assert.equal(touched,0);
 assert.throws(()=>createFixtureBootstrapDescriptor({...window,[Symbol('foreign')]:1}));
});
test('descriptor rejects every mutable authority/environment/resource/name/limit/hash substitution',()=>{
 const changes=[d=>d.ownerBindingId='f'.repeat(64),d=>d.environment.account='000000000000',d=>d.environment.region='us-west-2',
  d=>d.environment.runUuid='foreign',d=>d.environment.keyArn='foreign',d=>d.environment.subnet='foreign',
  d=>d.names.machine='foreign',d=>d.names.execution='foreign',d=>d.resource.sizeGiB=2,d=>d.resource.encrypted=false,
  d=>d.resource.attachments='ALLOW',d=>d.resource.tags[0].Value='foreign',d=>d.resource.tags.reverse(),
  d=>d.clock.C++,d=>d.limits.maxCalls++,d=>d.wireProfile='qualified',d=>d.profile='arbitrary',
  d=>d.sourceCommit='a'.repeat(40),d=>d.admission=true,d=>d.graph={},d=>d.policy={},d=>d.publishedVersionArn='fake'];
 for(const change of changes){const d=copy(descriptor);change(d);assert.throws(()=>validateFixtureBootstrapDescriptor(d));
  assert.throws(()=>compileFixtureBootstrapWorkflow(d));assert.throws(()=>compileFixtureBootstrapTemplate(d));}
});
test('nested accessors, symbols, sparse arrays and extra array fields are never read/accepted',()=>{
 let touched=0;
 for(const key of ['environment','clock','limits','resource']){const d=copy(descriptor);Object.defineProperty(d,key,{get(){touched++;return descriptor[key];}});assert.throws(()=>validateFixtureBootstrapDescriptor(d));}
 const d=copy(descriptor);Object.defineProperty(d.environment,'account',{get(){touched++;return F.account;}});assert.throws(()=>validateFixtureBootstrapDescriptor(d));
 const a=copy(descriptor);Object.defineProperty(a.resource.tags,'0',{get(){touched++;return descriptor.resource.tags[0];}});assert.throws(()=>validateFixtureBootstrapDescriptor(a));
 for(const mutate of [d=>delete d.resource.tags[0],d=>d.resource.tags.extra=true,d=>d.limits[Symbol('x')]=1,
  d=>Object.setPrototypeOf(d.environment,null)]){const x=copy(descriptor);mutate(x);assert.throws(()=>validateFixtureBootstrapDescriptor(x));}
 assert.equal(touched,0);
 const validated=validateFixtureBootstrapDescriptor(copy(descriptor));assert.notEqual(validated,descriptor);
 assert.ok(Object.isFrozen(validated)&&Object.isFrozen(validated.resource.tags[0]));
});
test('old three original raw graph/template pairs stay byte-identical including caller key ordering',()=>{
 const path=process.env.MERI_FIXTURE_ORIGINAL_PRODUCTS;assert.equal(typeof path,'string','Original pre-edit products required');
 const raw=readFileSync(path);assert.equal(sha(raw),'c3ae08f9c37db5f8982fd6fb21d0534b7e3264d5a690123befda3525d21cb1ae');
 const rows=JSON.parse(raw);assert.equal(rows.length,3);
 for(const row of rows){const b=row.default?undefined:row.input;assert.equal(JSON.stringify(compileFixtureWorkflow(b)),row.graph);assert.equal(JSON.stringify(compileFixtureTemplate(b)),row.template);}
});
test('missing factories remain inert; existing binding cannot enable bootstrap or acquire runtime authority',async()=>{
 assert.deepEqual(compileFixtureBootstrapWorkflow(),fixtureRefusal());assert.equal(compileFixtureBootstrapTemplate().Resources.FixtureRole.Properties.Policies,undefined);
 const b={...window,ownerBindingId:descriptor.ownerBindingId};assert.throws(()=>compileFixtureBootstrapWorkflow(b));
 assert.equal(await evaluate(compileFixtureWorkflow(b).States.AdmissionGuard.Choices[0].Condition),false);
 assert.equal(template.Metadata.runtimeEnabled,false);assert.equal(template.Metadata.absenceWireQualified,false);
 assert.equal(template.Metadata.managedSurvivalQualified,false);assert.equal(template.Metadata.externalAdmissionRequired,true);
});
test('both bootstrap guards evaluate exact source-profile input, name/context and original time',async()=>{
 for(const state of ['AdmissionGuard','GuardExecution']){
  assert.equal(await guard(state),true);
  for(const request of [{...input,execute:true},{...input,profile:'foreign'},{...input,ownerBindingId:'f'.repeat(64)},
   {...input,runUuid:'foreign'},{...input,t0Ms:T0+1},{...input,sourceCommit:'a'.repeat(40)}])assert.equal(await guard(state,{request}),false);
  for(const mutate of [c=>c.Execution.Name='foreign',c=>c.Execution.Id+=':foreign',c=>c.StateMachine.Id+=':1',
   c=>c.Execution.StartTime=new Date(T0-1).toISOString(),c=>c.Execution.StartTime='invalid']){
   const c=context();mutate(c);assert.equal(await guard(state,{serviceContext:c}),false);}
  assert.equal(await guard(state,{ms:T0-1}),false);assert.equal(await guard(state,{ms:T0+300001}),false);
 }
});
test('bootstrap context accepts documented fractions without extending create or current-time bounds',async()=>{
 const base=new Date(T0).toISOString().slice(0,19);
 const end=new Date(T0+300000).toISOString().slice(0,19);
 for(const state of ['AdmissionGuard','GuardExecution']){
  for(const tail of ['Z','.000Z','.000000Z','.000000000Z','.000001Z','.000000001Z']){
   const c=context();c.Execution.StartTime=base+tail;
   assert.equal(await guard(state,{serviceContext:c}),true,tail);
  }
  for(const tail of ['.000001Z','.000000001Z']){
   const c=context();c.Execution.StartTime=end+tail;
   assert.equal(await guard(state,{serviceContext:c,ms:T0+300000}),false,'sub-ms beyond create bound');
   c.Execution.StartTime=base+tail;
   assert.equal(await guard(state,{serviceContext:c,ms:T0}),false,'sub-ms beyond current time');
  }
  for(const tail of ['Z','.000Z','.000000Z','.000000000Z']){
   const c=context();c.Execution.StartTime=end+tail;
   assert.equal(await guard(state,{serviceContext:c,ms:T0+300000}),true,'inclusive exact bound');
  }
  const c=context();c.Execution.StartTime=new Date(T0-1).toISOString().replace('Z','999999Z');
  assert.equal(await guard(state,{serviceContext:c}),false,'sub-ms below original T0');
 }
});

test('bootstrap context rejects malformed forms and EC2 payload keeps its stricter independent profile',async()=>{
 const base=new Date(T0).toISOString().slice(0,19);
 for(const value of [base,base+'+00:00',base+'.0Z',base+'.00Z',base+'.0000Z',base+'.00000Z',
  base+'.0000000Z',base+'.00000000Z',base+'.0000000000Z',base+'.000z',' '+base+'Z',
  '2026-02-30T00:00:00Z','2026-13-01T00:00:00.000000Z','2026-10-10T25:00:00.000000000Z',
  '2026-10-10T00:00:60Z',null,0,false]){
  const c=context();c.Execution.StartTime=value;
  for(const state of ['AdmissionGuard','GuardExecution'])assert.equal(await guard(state,{serviceContext:c}),false,String(value));
 }
 const volume={VolumeId:'vol-0123456789abcdef0',CreateTime:new Date(T0).toISOString(),Tags:fixtureTags(),
  Size:1,VolumeType:'gp3',Encrypted:true,KmsKeyId:F.keyArn,AvailabilityZone:F.az,State:'available',Attachments:[],SnapshotId:''};
 assert.equal(await guard('PageOwnership',{ctx:{result:{Volumes:[volume]}}}),true);
 for(const tail of ['Z','.000000Z','.000000000Z']){
  const row={...volume,CreateTime:base+tail};
  assert.equal(await guard('PageOwnership',{ctx:{result:{Volumes:[row]}}}),false,tail);
 }
});

test('bootstrap and inert finite lifecycle share every nonadmission state and identical constrained IAM',()=>{
 const b={...window,ownerBindingId:descriptor.ownerBindingId}, old=compileFixtureWorkflow(b), oldTemplate=compileFixtureTemplate(b);
 assert.deepEqual(Object.keys(graph.States),Object.keys(old.States));
 for(const [name,state]of Object.entries(graph.States))if(!['AdmissionGuard','GuardExecution'].includes(name))assert.deepEqual(state,old.States[name],name);
 assert.deepEqual(template.Resources.FixtureRole,oldTemplate.Resources.FixtureRole);
 assert.equal(template.Resources.FixtureLifecycle.Properties.StateMachineType,'STANDARD');
 assert.deepEqual(template.Resources.FixtureLifecycle.Properties.Tags,oldTemplate.Resources.FixtureLifecycle.Properties.Tags);
 assert.doesNotMatch(JSON.stringify(template),/AttachVolume|DetachVolume|RunInstances|PassRole|StartExecution|RedriveExecution/);
});
test('actual JSONata attempt/deadline expressions keep one-shot ordering and original finite caps',async()=>{
 const c=await evaluate(graph.States.Initialize.Assign.ctx);assert.equal(c.C,T0+900000);
 assert.equal(graph.States.RecordCreateAttempt.Next,'CreateVolume');assert.equal(graph.States.RecordDeleteAttempt.Next,'DeleteVolume');
 const create=await evaluate(graph.States.RecordCreateAttempt.Assign.ctx,{ctx:c});assert.equal(create.createAttempted,true);assert.equal(create.calls,1);
 const deletion=await evaluate(graph.States.RecordDeleteAttempt.Assign.ctx,{ctx:{...c,volumeId:'vol-0123456789abcdef0'}});assert.equal(deletion.deleteAttempted,true);
 assert.equal(Object.values(graph.States).filter(s=>s.Resource?.endsWith(':createVolume')).length,1);
 assert.equal(Object.values(graph.States).filter(s=>s.Resource?.endsWith(':deleteVolume')).length,1);
 for(const s of Object.values(graph.States))assert.equal(s.Retry,undefined);
 for(const state of ['CreateBudget','ScanBudget','DirectBudget','DeleteBudget','AbsenceBudget','Poll','PollAbsent'])assert.equal(await guard(state,{ctx:c,ms:c.C}),false);
 assert.equal(await guard('CreateBudget',{ctx:c,ms:T0+300001}),false);
 assert.equal(await guard('DirectBudget',{ctx:{...c,calls:512}}),false);
 assert.equal(await guard('Poll',{ctx:{...c,polls:160}}),false);
 for(const left of [16000,15000,5000,2001])assert.ok((await evaluate(graph.States.ReadAbsent.TimeoutSeconds,{ctx:c,ms:c.C-left}))*1000<=left-1000);
 const result=await evaluate(graph.States.Unknown.Output,{ctx:{...c,error:{Error:'Ec2.InvalidVolume.NotFound',Cause:'UNQUALIFIED'}}});
 assert.equal(result.cleanup,'UNKNOWN');assert.equal(result.absenceWireQualified,false);assert.equal(result.qualification,'NOT_ADMITTED');
});
test('every bootstrap expression parses and no source/import authority is smuggled into descriptor ID',()=>{
 let count=0;const inspect=v=>{if(typeof v==='string'&&v.startsWith('{% ')){jsonata(v.slice(3,-3));count++;}else if(v&&typeof v==='object')Object.values(v).forEach(inspect);};
 inspect(graph);assert.ok(count>60);assert.equal(graph.TimeoutSeconds,undefined);
 assert.deepEqual(Object.keys(descriptor),['schema','profile','environment','names','resource','clock','limits','wireProfile','ownerBindingId']);
 assert.doesNotMatch(JSON.stringify(descriptor),/templateSha256|definitionSha256|publishedVersionArn|admission|sourceCommit|S3/);
});
