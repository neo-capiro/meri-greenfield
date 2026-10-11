import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeFixtureVolumeHistory } from './fixture-volume-history.mjs';
import { FIXTURE as F, fixtureTags, fixtureMachineName, fixtureExecutionName } from './fixture-volume-binding.mjs';
import { compileFixtureWorkflow } from './fixture-volume-workflow.mjs';

// Explicit synthetic raw service-shaped DATA. This never invokes Step Functions.
const T=1791660000000,ID='vol-0123456789abcdef0',OTHER='vol-1123456789abcdef0';
const binding={t0Ms:T,createNotAfterMs:T+300000,ownerBindingId:'a'.repeat(64)};
const machine=`arn:aws:states:${F.region}:${F.account}:stateMachine:${fixtureMachineName()}`;
const execution=`arn:aws:states:${F.region}:${F.account}:execution:${fixtureMachineName()}:${fixtureExecutionName()}`;
const role=`arn:aws:iam::${F.account}:role/QualificationFixtureOnly`;
const graph=compileFixtureWorkflow(binding),raw=x=>Buffer.from(JSON.stringify(x)),sha=x=>createHash('sha256').update(x).digest('hex');
const volume=()=>({VolumeId:ID,Tags:fixtureTags(),CreateTime:new Date(T+500).toISOString(),AvailabilityZone:F.az,KmsKeyId:F.keyArn,Size:1,VolumeType:'gp3',Encrypted:true,Attachments:[],SnapshotId:'',State:'available'});
function fixture({lost=false,deleteFailure=false,paged=false,noDelete=false,duplicateCreate=false,duplicateDelete=false}={}) {
  const events=[];let clock=T+1000;
  const add=(type,details={},parent=events.length)=>{const ev={id:events.length+1,previousEventId:parent,timestamp:clock/1000,type,...details};events.push(ev);clock+=50;return ev;};
  const inputRaw=raw({runUuid:F.runUuid,...binding});
  add('ExecutionStarted',{executionStartedEventDetails:{input:inputRaw.toString(),inputDetails:{truncated:false},roleArn:role,stateMachineVersionArn:machine+':1'}},0);
  const state=(name)=>add(`${graph.States[name].Type}StateEntered`,{stateEnteredEventDetails:{name,input:'{}',inputDetails:{truncated:false}}});
  function call(name,args,out,failed=false) {
    const enter=state(name),api=graph.States[name].Resource.split(':').at(-1);
    const schedule=add('TaskScheduled',{taskScheduledEventDetails:{resourceType:'aws-sdk:ec2',resource:api,region:F.region,parameters:JSON.stringify(args),timeoutInSeconds:15}},enter.id);
    const start=add('TaskStarted',{taskStartedEventDetails:{resourceType:'aws-sdk:ec2',resource:api}},schedule.id);
    const end=failed?add('TaskTimedOut',{taskTimedOutEventDetails:{resourceType:'aws-sdk:ec2',resource:api,error:'States.Timeout',cause:'synthetic unknown completion'}},start.id):
      add('TaskSucceeded',{taskSucceededEventDetails:{resourceType:'aws-sdk:ec2',resource:api,output:JSON.stringify(out),outputDetails:{truncated:false}}},start.id);
    add('TaskStateExited',{stateExitedEventDetails:{name,output:'{}',outputDetails:{truncated:false}}},end.id);
  }
  state('RecordCreateAttempt');
  call('CreateVolume',graph.States.CreateVolume.Arguments,{VolumeId:ID},lost);
  if(duplicateCreate)call('CreateVolume',graph.States.CreateVolume.Arguments,{VolumeId:ID});
  call('ListFirst',graph.States.ListFirst.Arguments,paged?{Volumes:[],NextToken:'opaque token !'}:{Volumes:[volume()]});
  if(paged)call('ListNext',{...graph.States.ListFirst.Arguments,NextToken:'opaque token !'},{Volumes:[volume()]});
  call('DescribeOwned',{VolumeIds:[ID]},{Volumes:[volume()]});
  if(!noDelete){state('RecordDeleteAttempt');call('DeleteVolume',{VolumeId:ID},{},deleteFailure);if(duplicateDelete)call('DeleteVolume',{VolumeId:ID},{});call('ReadAbsent',{VolumeIds:[ID]},{},true);}
  add('ExecutionSucceeded',{executionSucceededEventDetails:{output:'{"cleanup":"UNKNOWN"}',outputDetails:{truncated:false}}});
  const x={binding:{...binding},pins:{sourceCommit:'b'.repeat(40),definitionSha256:'',inputSha256:sha(inputRaw),versionArn:machine+':1',executionArn:execution,roleArn:role,pages:[]},definitionRaw:raw(graph),inputRaw,pages:[]};
  x.pins.definitionSha256=sha(x.definitionRaw);
  const packageEvents=(cuts=[events.length])=>{let start=0; x.pages=[];x.pins.pages=[];cuts.forEach((end,index)=>{const req={executionArn:execution,includeExecutionData:true,reverseOrder:false,maxResults:1000,...(index?{nextToken:'history-'+index}:{})};const res={events:events.slice(start,end),...(index<cuts.length-1?{nextToken:'history-'+(index+1)}:{})};const page={requestRaw:raw(req),responseRaw:raw(res)};x.pages.push(page);x.pins.pages.push({requestSha256:sha(page.requestRaw),responseSha256:sha(page.responseRaw)});start=end;});};
  packageEvents();return {x,events,packageEvents};
}
function changeEvent(f,predicate,change){change(f.events.find(predicate));f.packageEvents();}
function output(f,state,fn){let entered=false;changeEvent(f,e=>{if(e.type==='TaskStateEntered')entered=e.stateEnteredEventDetails.name===state;return entered&&e.type==='TaskSucceeded';},e=>{const d=e.taskSucceededEventDetails;d.output=JSON.stringify(fn(JSON.parse(d.output)));});}
const refused=f=>assert.throws(()=>decodeFixtureVolumeHistory(f.x),/refused|JSON|UTF|member/i);

test('complete managed DATA reconstructs native attempts and historical ownership only',()=>{
  const f=fixture(),v=decodeFixtureVolumeHistory(f.x);
  assert.equal(v.provenance,'MANAGED');assert.equal(v.volumeId,ID);assert.equal(v.createAttempt.parameters.ClientToken,F.runUuid);
  assert.equal(v.firstDeleteAttempt.parameters.VolumeId,ID);assert.equal(v.ownership.inventory.volume.KmsKeyId,F.keyArn);
  assert.equal(v.clock.C,T+900000);assert.equal(v.cleanup,'UNKNOWN');assert.equal(v.runtimeAdmitted,false);assert.equal(v.physicalAbsenceProven,false);
  assert.equal(v.sourceGuardLiteralFalse,true);assert.equal(v.uncertain,true);assert.equal(v.errors[0].state,'ReadAbsent');
  assert.equal(Object.hasOwn(v,'nonce'),false);assert.equal(Object.hasOwn(v,'caller'),false);
});
test('lost create ACK is retained UNKNOWN, never fabricated CREATED',()=>{
  const v=decodeFixtureVolumeHistory(fixture({lost:true}).x);assert.equal(v.createAttempt.outcome,'TaskTimedOut');assert.equal(v.uncertain,true);assert.equal(v.volumeId,ID);
});
test('complete multiple history pages and opaque inventory tokens reconstruct',()=>{
  const f=fixture({paged:true});f.packageEvents([10,25,f.events.length]);const v=decodeFixtureVolumeHistory(f.x);assert.equal(v.rawPages.length,3);assert.equal(v.ownership.inventory.eventIds.length,2);
});
test('request hashes, response hashes and strict duplicate-key JSON are enforced',()=>{
  for(const part of ['requestRaw','responseRaw']){const f=fixture();f.x.pages[0][part]=Buffer.concat([f.x.pages[0][part],Buffer.from(' ')]);refused(f);}
  const f=fixture();f.x.pages[0].responseRaw=Buffer.from('{"events":[],"events":[]}');f.x.pins.pages[0].responseSha256=sha(f.x.pages[0].responseRaw);refused(f);
});
test('missing, duplicate, out of order and foreign-parent events refuse',()=>{
  for(const kind of ['missing','duplicate','order','parent']){const f=fixture();if(kind==='missing')f.events.splice(4,1);if(kind==='duplicate')f.events.splice(4,0,f.events[4]);if(kind==='order')[f.events[4],f.events[5]]=[f.events[5],f.events[4]];if(kind==='parent')f.events[4].previousEventId=9999;f.packageEvents();refused(f);}
});
test('last-page token, absent intermediate token and malformed false/null token refuse',()=>{
  for(const token of ['pending',null,false,0,'']){const f=fixture(),res=JSON.parse(f.x.pages[0].responseRaw);res.nextToken=token;f.x.pages[0].responseRaw=raw(res);f.x.pins.pages[0].responseSha256=sha(f.x.pages[0].responseRaw);refused(f);}
  const f=fixture();f.packageEvents([10,f.events.length]);const res=JSON.parse(f.x.pages[0].responseRaw);delete res.nextToken;f.x.pages[0].responseRaw=raw(res);f.x.pins.pages[0].responseSha256=sha(f.x.pages[0].responseRaw);refused(f);
});
test('truncation flags at every nesting level and incomplete execution refuse',()=>{
  const f=fixture();f.events[0].executionStartedEventDetails.inputDetails.truncated=true;f.packageEvents();refused(f);
  const g=fixture();g.events.pop();g.packageEvents();refused(g);
});
test('source, graph, version, execution and input identity mismatch refuse',()=>{
  for(const key of ['versionArn','executionArn','roleArn','sourceCommit']){const f=fixture();f.x.pins[key]='foreign';refused(f);}
  const f=fixture();const graph2=JSON.parse(f.x.definitionRaw);graph2.States.AdmissionGuard.Choices[0].Condition='{% true %}';f.x.definitionRaw=raw(graph2);f.x.pins.definitionSha256=sha(f.x.definitionRaw);refused(f);
  const g=fixture();g.x.inputRaw=raw({...JSON.parse(g.x.inputRaw),runUuid:'wrong'});g.x.pins.inputSha256=sha(g.x.inputRaw);refused(g);
});
test('start binding alias, wrong role/version/input and redrive refuse',()=>{
  for(const key of ['roleArn','stateMachineVersionArn','input','stateMachineAliasArn']){const f=fixture();f.events[0].executionStartedEventDetails[key]='wrong';f.packageEvents();refused(f);}
  const f=fixture();f.events[2].type='ExecutionRedriven';f.packageEvents();refused(f);
});
test('scheduled actual request, resource, credentials and ancestry cannot be replaced',()=>{
  for(const key of ['parameters','resource','resourceType','region','taskCredentials']){const f=fixture();const d=f.events.find(e=>e.type==='TaskScheduled').taskScheduledEventDetails;d[key]=key==='parameters'?'{}':'wrong';f.packageEvents();refused(f);}
  const f=fixture();f.events.find(e=>e.type==='TaskStarted').previousEventId=1;f.packageEvents();refused(f);
});
test('conflicting create/inventory/direct identities and multiple owned rows refuse',()=>{
  for(const state of ['ListFirst','DescribeOwned']){const f=fixture();output(f,state,o=>({Volumes:[{...o.Volumes[0],VolumeId:OTHER}]}));refused(f);}
  const f=fixture();output(f,'ListFirst',o=>({Volumes:[o.Volumes[0],{...o.Volumes[0]}]}));refused(f);
});
test('foreign tags, boolean size, attachments, key, time and shape refuse',()=>{
  for(const patch of [{Tags:[]},{Size:true},{Attachments:[{}]},{KmsKeyId:'other'},{CreateTime:'2026-02-30T00:00:00.000Z'},{State:'in-use'}]){const f=fixture();output(f,'ListFirst',o=>({Volumes:[{...o.Volumes[0],...patch}]}));refused(f);}
  const f=fixture();output(f,'DescribeOwned',o=>({...o,NextToken:null}));refused(f);
});
test('inventory malformed tokens, zero rows and incomplete pages do not prove ownership',()=>{
  for(const out of [{Volumes:[]},{Volumes:[volume()],NextToken:null},{Volumes:[volume()],NextToken:'unconsumed'}]){const f=fixture();output(f,'ListFirst',()=>out);refused(f);}
});
test('stale direct ownership and deadline/time regressions refuse',()=>{
  const f=fixture();let deleteEntered=false;for(const e of f.events){if(e.type==='TaskStateEntered'&&e.stateEnteredEventDetails.name==='DeleteVolume')deleteEntered=true;if(deleteEntered)e.timestamp+=16;}f.packageEvents();refused(f);
  for(const mode of ['ceiling','reverse']){const g=fixture();g.events.at(-1).timestamp=mode==='ceiling'?(T+900001)/1000:T/1000;g.packageEvents();refused(g);}
});
test('ambiguous delete retains one attempt and never establishes physical absence',()=>{
  const v=decodeFixtureVolumeHistory(fixture({deleteFailure:true}).x);assert.equal(v.firstDeleteAttempt.outcome,'TaskTimedOut');assert.equal(v.physicalAbsenceProven,false);assert.equal(v.errors.length,2);
});
test('no delete can be reported without record-before-mutation or extra mutations',()=>{
  const f=fixture();f.events.find(e=>e.stateEnteredEventDetails?.name==='RecordDeleteAttempt').stateEnteredEventDetails.name='RecordCreateAttempt';f.packageEvents();refused(f);
  refused(fixture({duplicateCreate:true}));refused(fixture({duplicateDelete:true}));
});
test('Task success cannot skip its actual TaskStarted ancestry',()=>{
  const f=fixture(),index=f.events.findIndex(e=>e.type==='TaskStarted'),removed=f.events[index].id,parent=f.events[index].previousEventId;
  f.events.splice(index,1);for(const e of f.events){if(e.id>removed)e.id--;if(e.previousEventId===removed)e.previousEventId=parent;else if(e.previousEventId>removed)e.previousEventId--;}
  f.packageEvents();refused(f);
});
test('direct payload bounds, final empty absence and raw non-Buffer refuse',()=>{
  const f=fixture();output(f,'DescribeOwned',o=>({Volumes:[{...o.Volumes[0],Description:'x'.repeat(F.maxResultChars)}]}));refused(f);
  const g=fixture();const ev=g.events.find(e=>e.type==='TaskTimedOut');ev.type='TaskSucceeded';ev.taskSucceededEventDetails={resourceType:'aws-sdk:ec2',resource:'describeVolumes',output:'{"Volumes":[]}',outputDetails:{truncated:false}};delete ev.taskTimedOutEventDetails;g.packageEvents();refused(g);
  const h=fixture();h.x.pages[0].requestRaw=null;refused(h);
});
test('unknown outer options cannot supply an admission toggle',()=>{
  const f=fixture();f.x.runtimeAdmitted=true;refused(f);assert.throws(()=>decodeFixtureVolumeHistory(),/exact decoder options/);
});
test('contradictory event details and missing data-truncation evidence refuse',()=>{
  const f=fixture();f.events[0].taskScheduledEventDetails={};f.packageEvents();refused(f);
  const g=fixture();delete g.events[0].executionStartedEventDetails.inputDetails;g.packageEvents();refused(g);
  const h=fixture();h.events.find(e=>e.type==='TaskSucceeded').taskSucceededEventDetails.outputDetails.truncated=null;h.packageEvents();refused(h);
});
test('explicit source refusal cannot masquerade as an observed lifecycle',()=>{
  const f=fixture();f.events.find(e=>e.stateEnteredEventDetails?.name==='RecordCreateAttempt').stateEnteredEventDetails.name='SourceOnlyRefusal';f.events.find(e=>e.stateEnteredEventDetails?.name==='SourceOnlyRefusal').type='FailStateEntered';f.packageEvents();refused(f);
});
test('volume ID trailing newline is rejected even when every observation agrees',()=>{
  const f=fixture();
  for(const e of f.events){
    if(e.taskScheduledEventDetails)e.taskScheduledEventDetails.parameters=e.taskScheduledEventDetails.parameters.replaceAll(ID,ID+'\\n');
    if(e.taskSucceededEventDetails)e.taskSucceededEventDetails.output=e.taskSucceededEventDetails.output.replaceAll(ID,ID+'\\n');
  }
  f.packageEvents();refused(f);
});
test('no-delete branch retains ownership and refuses terminal stale evidence',()=>{
  const f=fixture({noDelete:true}),v=decodeFixtureVolumeHistory(f.x);assert.equal(v.firstDeleteAttempt,null);assert.equal(v.uncertain,false);
  f.events.at(-1).timestamp+=16;f.packageEvents();refused(f);
});
test('raw bounds, nonfinite JSON and omitted pins refuse before reconstruction',()=>{
  const f=fixture();f.x.definitionRaw=Buffer.alloc(1048577);refused(f);
  const g=fixture();g.x.inputRaw=Buffer.from('{"x":1e309}');g.x.pins.inputSha256=sha(g.x.inputRaw);refused(g);
  const h=fixture();h.x.pins.pages=[];refused(h);
});
