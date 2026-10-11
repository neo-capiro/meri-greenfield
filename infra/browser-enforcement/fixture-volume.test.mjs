import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { FIXTURE as F, fixtureTags, fixtureMachineName, fixtureExecutionName, validateFixtureBinding } from './fixture-volume-binding.mjs';
import { compileFixtureWorkflow, fixtureRefusal } from './fixture-volume-workflow.mjs';
import { compileFixtureTemplate } from './fixture-volume-template.mjs';

const evaluator = process.env.MERI_TEST_JSONATA;
assert.equal(typeof evaluator, 'string', 'Explicit retained evaluator required; no installation');
assert.equal(createHash('sha256').update(readFileSync(evaluator)).digest('hex'),
  '8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b');
const jsonata = createRequire(import.meta.url)(evaluator);
const T0 = 1791660000000; // Synthetic only; no actual fixture clock assigned.
const binding = { t0Ms: T0, createNotAfterMs: T0+300000, ownerBindingId: 'a'.repeat(64) };
const graph = compileFixtureWorkflow(binding);
const ID = 'vol-0123456789abcdef0';
const volume = () => ({ VolumeId: ID, CreateTime: new Date(T0+1000).toISOString(), Tags: fixtureTags(),
  Size: 1, VolumeType: 'gp3', Encrypted: true, KmsKeyId: F.keyArn, AvailabilityZone: F.az,
  State: 'available', Attachments: [], SnapshotId: '' });
const page = rows => ({ Volumes: rows });
const context = () => ({ Execution: { Name: fixtureExecutionName(),
  Id: `arn:aws:states:${F.region}:${F.account}:execution:${fixtureMachineName()}:${fixtureExecutionName()}`,
  StartTime: new Date(T0).toISOString() }, StateMachine: { Id: `arn:aws:states:${F.region}:${F.account}:stateMachine:${fixtureMachineName()}` } });
const expectedInput = () => ({ runUuid: F.runUuid, ...binding });
async function evaluate(value, ctx, result = {}, ms = T0+1000, error = {}, input = expectedInput(), serviceContext = context()) {
  if (typeof value === 'string' && value.startsWith('{% ')) {
    const expression = jsonata(value.slice(3,-3));
    expression.registerFunction('now', () => new Date(ms).toISOString(), '<:s>');
    return expression.evaluate({}, { ctx, states: { result, errorOutput: error, input, context: serviceContext } });
  }
  if (Array.isArray(value)) return Promise.all(value.map(v => evaluate(v,ctx,result,ms,error,input,serviceContext)));
  if (value && typeof value === 'object') {
    const pairs = await Promise.all(Object.entries(value).map(async ([k,v]) => [k,await evaluate(v,ctx,result,ms,error,input,serviceContext)]));
    return Object.fromEntries(pairs);
  }
  return value;
}
const initial = () => evaluate(graph.States.Initialize.Assign.ctx);
const assign = (name, ctx, result = {}, ms = T0+1000) => evaluate(graph.States[name].Assign.ctx, ctx, result, ms);
const condition = (name,ctx,ms=T0+1000) => evaluate(graph.States[name].Choices[0].Condition,ctx,{},ms);

// Starts explicitly AFTER literal production refusal. Actual JSONata expressions,
// synthetic AWS results/time only; not a service interpreter or survival proof.
async function trace(api, start = T0+1000) {
  let state='GuardExecution', ctx, ms=start;
  const calls=[], visited=[];
  for(let step=0; step<12000; step++) {
    const s=graph.States[state];visited.push(state);
    if(s.Type==='Choice') state=await condition(state,ctx,ms)?s.Choices[0].Next:s.Default;
    else if(s.Type==='Pass') {
      if(s.Assign)ctx=await assign(state,ctx,{},ms);
      if(s.End)return {ctx,calls,visited,output:await evaluate(s.Output,ctx,{},ms),atMs:ms};
      state=s.Next;
    } else if(s.Type==='Wait') {ms+=1000*await evaluate(s.Seconds,ctx,{},ms);state=s.Next;}
    else if(s.Type==='Task') {
      const call={state,args:await evaluate(s.Arguments,ctx,{},ms),timeout:await evaluate(s.TimeoutSeconds,ctx,{},ms),atMs:ms};calls.push(call);
      const response=api(call,calls);
      if(response?.error) {ctx=await evaluate(s.Catch[0].Assign.ctx,ctx,{},ms,response.error);state=s.Catch[0].Next;}
      else {ctx=await assign(state,ctx,response,ms);state=s.Next;}
    } else throw new Error(`Unexpected state ${state}`);
    ms++;
  }
  throw new Error('Bounded synthetic trace exceeded');
}
function successApi(call) {
  if(call.state==='CreateVolume')return volume();
  if(call.state==='DeleteVolume')return {};
  if(call.state==='ReadAbsent')return {error:{Error:'Ec2.UNKNOWN_NOT_FOUND_WIRE',Cause:'unqualified raw error'}};
  return page([volume()]);
}

test('default and supplied binding are inert; no execute toggle/accessors/foreign config', async () => {
  assert.deepEqual(compileFixtureWorkflow(),fixtureRefusal());
  assert.equal(compileFixtureTemplate().Resources.FixtureRole.Properties.Policies,undefined);
  assert.equal(await condition('AdmissionGuard', {execute:true}),false);
  for(const v of [null,[],{...binding,execute:true},{...binding,C:T0+999999},{...binding,runUuid:'foreign'},
    {...binding,createNotAfterMs:T0+300001},{...binding,t0Ms:NaN},{...binding,ownerBindingId:'claim'}])assert.throws(()=>validateFixtureBinding(v));
  let accessed=false;const getter={...binding};Object.defineProperty(getter,'t0Ms',{get(){accessed=true;return T0;}});
  assert.throws(()=>validateFixtureBinding(getter));assert.equal(accessed,false);
  assert.throws(()=>validateFixtureBinding({...binding,[Symbol('extra')]:true}));
});
test('every emitted expression parses; finite real API targets/results/errors and no Retry', () => {
  const names=new Set(Object.keys(graph.States));let expressions=0,tasks=0;
  function inspect(v){if(typeof v==='string'&&v.startsWith('{% ')){jsonata(v.slice(3,-3));expressions++;}else if(v&&typeof v==='object')Object.values(v).forEach(inspect);}
  inspect(graph);assert.ok(expressions>60);
  for(const s of Object.values(graph.States)) {
    for(const next of [s.Next,s.Default,...(s.Choices||[]).map(x=>x.Next),...(s.Catch||[]).map(x=>x.Next)].filter(Boolean))assert.ok(names.has(next));
    if(s.Type==='Task'){tasks++;assert.equal(s.Retry,undefined);assert.match(s.Assign.ctx,/\$states.result/);assert.match(s.Catch[0].Assign.ctx,/\$states.errorOutput/);assert.match(s.Catch[0].Assign.ctx,/"result":null/);}
  }
  assert.equal(tasks,6);assert.equal(graph.TimeoutSeconds,undefined);
  assert.deepEqual(Object.values(graph.States).filter(x=>x.Type==='Task').map(x=>x.Resource.split(':').at(-1)).sort(),
    ['createVolume','deleteVolume','describeVolumes','describeVolumes','describeVolumes','describeVolumes']);
  assert.equal(Object.values(graph.States).filter(x=>x.Resource?.endsWith(':createVolume')).length,1);
  assert.equal(Object.values(graph.States).filter(x=>x.Resource?.endsWith(':deleteVolume')).length,1);
});
test('exact execution input/name/context/current original window, no caller authority summaries', async () => {
  assert.equal(await condition('GuardExecution',undefined),true);
  for(const input of [{...expectedInput(),execute:true},{...expectedInput(),runUuid:'foreign'},{...expectedInput(),t0Ms:T0+1}])
    assert.equal(await evaluate(graph.States.GuardExecution.Choices[0].Condition,undefined,{},T0+1000,{},input),false);
  for(const field of ['Name','Id','StartTime']){const c=context();c.Execution[field]=field==='StartTime'?new Date(T0-1).toISOString():'foreign';assert.equal(await evaluate(graph.States.GuardExecution.Choices[0].Condition,undefined,{},T0+1000,{},expectedInput(),c),false);}
  assert.equal(await condition('GuardExecution',undefined,T0+300001),false);
});
test('original C, per-call clipping, finite counters and no deadline reset', async () => {
  const c=await initial();assert.equal(c.C,T0+900000);
  for(const left of [900000,16000,15000,5000,2001]){
    const ms=c.C-left,n=await evaluate(graph.States.ReadAbsent.TimeoutSeconds,c,{},ms);assert.ok(n>=1&&n<=15&&n*1000<=left-1000);
  }
  assert.equal(await condition('DirectBudget',c,c.C-2000),false);
  assert.equal(await condition('CreateBudget',c,T0+300001),false);
  assert.equal(await condition('DirectBudget',{...c,calls:F.maxCalls}),false);
  assert.equal(await condition('Poll',{...c,polls:F.maxPolls}),false);
});
test('managed controller-loss abstraction owns one create/delete, ACK and unqualified error remain UNKNOWN', async () => {
  const r=await trace(successApi);
  assert.equal(r.calls.filter(c=>c.state==='CreateVolume').length,1);assert.equal(r.calls.filter(c=>c.state==='DeleteVolume').length,1);
  assert.equal(r.ctx.volumeId,ID);assert.equal(r.ctx.createAttempted,true);assert.equal(r.ctx.deleteAttempted,true);
  assert.equal(r.output.cleanup,'UNKNOWN');assert.equal(r.output.absenceWireQualified,false);
  assert.equal(r.output.lastError.Cause,'unqualified raw error');
  assert.ok(r.visited.indexOf('GuardExecution')<r.visited.indexOf('CreateVolume'));
  assert.ok(r.visited.indexOf('RecordDeleteAttempt')<r.visited.indexOf('DeleteVolume'));
  assert.ok(!r.visited.some(x=>/controller|local/i.test(x)));
  assert.deepEqual(r.calls.find(c=>c.state==='DeleteVolume').args,{VolumeId:ID});
});
test('lost CREATE ACK recovers only complete pages and fresh exact singleton; never recreates', async () => {
  const r=await trace(call=>call.state==='CreateVolume'?{error:{Error:'States.Timeout',Cause:'unknown-create'}}:successApi(call));
  assert.equal(r.ctx.createOutcome,'UNKNOWN');assert.equal(r.ctx.volumeId,ID);assert.equal(r.ctx.C,T0+900000);
  assert.equal(r.calls.filter(c=>c.state==='CreateVolume').length,1);assert.equal(r.calls.filter(c=>c.state==='DeleteVolume').length,1);
});
test('empty complete inventory is UNKNOWN and cannot authorize guessed ID deletion', async () => {
  const r=await trace(call=>call.state==='CreateVolume'?{error:{Error:'States.Timeout'}}:page([]));
  assert.equal(r.calls.filter(c=>c.state==='DeleteVolume').length,0);assert.equal(r.ctx.volumeId,null);
  assert.equal(r.output.cleanup,'UNKNOWN');assert.ok(r.ctx.polls<=F.maxPolls);assert.ok(r.ctx.calls<=F.maxCalls);
});
test('two IDs, duplicate rows/pages, known-ID conflict retain original and never delete', async () => {
  const another={...volume(),VolumeId:'vol-fedcba98765432100'};
  for(const rows of [[volume(),another],[volume(),volume()],[another]]) {
    const r=await trace(call=>call.state==='CreateVolume'?volume():page(rows));
    assert.equal(r.ctx.volumeId,ID);assert.equal(r.ctx.conflict,true);assert.equal(r.calls.filter(c=>c.state==='DeleteVolume').length,0);
    assert.ok(r.ctx.scanIds.length<=2);
  }
});
test('foreign tags, time/key/size/type/attachments refuse first delete while known ID survives', async () => {
  for(const mutate of [v=>v.Tags.pop(),v=>v.Tags.push({...v.Tags[0]}),v=>v.KmsKeyId='foreign',v=>v.Size=true,
    v=>v.Attachments.push({InstanceId:'foreign'}),v=>v.VolumeType='io2',v=>v.CreateTime=new Date(T0-1).toISOString()]) {
    const v=volume();mutate(v);const r=await trace(call=>call.state==='CreateVolume'?volume():page([v]));
    assert.equal(r.ctx.volumeId,ID);assert.equal(r.calls.filter(c=>c.state==='DeleteVolume').length,0);assert.equal(r.output.cleanup,'UNKNOWN');
  }
});
test('opaque pagination, typed token absence, cap and late page error fail closed', async () => {
  const ok=await trace(call=>{
    if(call.state==='ListFirst')return {Volumes:[],NextToken:'opaque+/='};
    if(call.state==='ListNext'){assert.equal(call.args.NextToken,'opaque+/=');return page([volume()]);}
    return successApi(call);
  });assert.equal(ok.calls.filter(c=>c.state==='DeleteVolume').length,1);
  for(const token of [null,false,0,'',[],{}]){
    const r=await trace(call=>call.state==='ListFirst'?{Volumes:[],NextToken:token}:successApi(call));
    assert.equal(r.calls.filter(c=>c.state==='DeleteVolume').length,0);
  }
  const failed=await trace(call=>call.state==='ListFirst'?{Volumes:[volume()],NextToken:'next'}:call.state==='ListNext'?{error:{Error:'Ec2.Denied'}}:successApi(call));
  assert.equal(failed.ctx.volumeId,ID);assert.equal(failed.calls.filter(c=>c.state==='DeleteVolume').length,0);assert.equal(failed.ctx.scanComplete,false);
});
test('fresh direct unavailable/drift/extra envelope cannot delete', async () => {
  for(const response of [{Volumes:[]},{Volumes:[volume()],NextToken:null},{Volumes:[{...volume(),VolumeId:'vol-fedcba98765432100'}]},
    {Volumes:[{...volume(),Attachments:[{}]}]}]) {
    const r=await trace(call=>call.state==='DescribeOwned'?response:successApi(call));
    assert.equal(r.calls.filter(c=>c.state==='DeleteVolume').length,0);assert.equal(r.ctx.volumeId,ID);
  }
});
test('creating volume waits, rebinds available, and ambiguous DELETE never sends a second deletion', async () => {
  let direct=0;
  const r=await trace(call=>{
    if(call.state==='DescribeOwned')return page([{...volume(),State:++direct===1?'creating':'available'}]);
    if(call.state==='DeleteVolume')return {error:{Error:'States.Timeout',Cause:'unknown-delete'}};
    if(call.state==='ReadAbsent')return page([volume()]);
    return successApi(call);
  });
  assert.ok(direct>1);assert.equal(r.ctx.deleteOutcome,'UNKNOWN');assert.equal(r.calls.filter(c=>c.state==='DeleteVolume').length,1);
  assert.equal(r.output.cleanup,'UNKNOWN');assert.ok(r.atMs<=T0+900000);
});
test('empty successful absence response and denied errors never mean cleanup success', async () => {
  for(const response of [{Volumes:[]},{error:{Error:'Ec2.AccessDenied',Cause:'denied'}},{error:{Error:'Ec2.InvalidVolume.NotFound',Cause:'UNQUALIFIED'}}]) {
    const r=await trace(call=>call.state==='ReadAbsent'?response:successApi(call));assert.equal(r.output.cleanup,'UNKNOWN');assert.equal(r.output.absenceWireQualified,false);
    assert.equal(r.calls.filter(c=>c.state==='DeleteVolume').length,1);
  }
});
test('inert IAM exact source trust/tag scope/key, no local/source9 mutation authority or generic launch', () => {
  const t=compileFixtureTemplate(binding),role=t.Resources.FixtureRole.Properties,statements=role.Policies[0].PolicyDocument.Statement;
  assert.equal(t.Resources.FixtureLifecycle.Properties.StateMachineType,'STANDARD');assert.equal(t.Metadata.runtimeEnabled,false);
  assert.equal(role.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals['aws:SourceAccount'],F.account);
  assert.equal(role.AssumeRolePolicyDocument.Statement[0].Condition.ArnEquals['aws:SourceArn'],`arn:aws:states:${F.region}:${F.account}:stateMachine:${fixtureMachineName()}`);
  const deletion=statements.find(s=>s.Action.includes('ec2:DeleteVolume'));
  assert.equal(deletion.Condition.StringEquals['ec2:ResourceTag/QualificationRun'],F.runUuid);
  for(const s of statements.filter(s=>s.Action.some(a=>a.startsWith('kms:'))))assert.equal(s.Resource,F.keyArn);
  assert.doesNotMatch(JSON.stringify(t),/AttachVolume|DetachVolume|RunInstances|PassRole|StartExecution|RedriveExecution/);
});
test('malformed calendar timestamps fail safely before parsing and known ID remains retained', async () => {
  for(const time of [null,false,0,'bad','2026-13-01T00:00:00.000Z','2026-02-30T00:00:00.000Z','2026-10-10T25:00:00.000Z']) {
    const v={...volume(),CreateTime:time};
    const r=await trace(call=>call.state==='CreateVolume'?volume():page([v]));
    assert.equal(r.calls.filter(c=>c.state==='DeleteVolume').length,0);assert.equal(r.ctx.volumeId,ID);
    const c=context();c.Execution.StartTime=time;
    assert.equal(await evaluate(graph.States.GuardExecution.Choices[0].Condition,undefined,{},T0+1000,{},expectedInput(),c),false);
  }
});
test('page cap, repeated tokens and oversized result refuse with original ID retained', async () => {
  let pages=0;
  const cap=await trace(call=>call.state==='ListFirst'||call.state==='ListNext'?{Volumes:[],NextToken:`page-${++pages}`}:successApi(call));
  assert.equal(pages,F.maxPages);assert.equal(cap.ctx.volumeId,ID);assert.equal(cap.calls.filter(c=>c.state==='DeleteVolume').length,0);
  const repeated=await trace(call=>call.state==='ListFirst'||call.state==='ListNext'?{Volumes:[],NextToken:'same'}:successApi(call));
  assert.equal(repeated.calls.filter(c=>c.state==='ListFirst'||c.state==='ListNext').length,2);
  const large={...volume(),Description:'x'.repeat(F.maxResultChars)};
  const payload=await trace(call=>call.state==='ListFirst'?page([large]):successApi(call));
  assert.equal(payload.ctx.volumeId,ID);assert.equal(payload.calls.filter(c=>c.state==='DeleteVolume').length,0);
});
test('stale direct read cannot delete and post-C cannot dispatch any remaining task', async () => {
  let c=await initial();c={...c,volumeId:ID,scanComplete:true,resultAtMs:T0};
  assert.equal(await condition('DeleteBudget',c,T0+16001),false);
  assert.equal(await condition('DeleteAlreadyOrStale',c),false);
  for(const name of ['CreateBudget','ScanBudget','DirectBudget','DeleteBudget','AbsenceBudget','Poll','PollAbsent'])
    assert.equal(await condition(name,c,c.C),false,name);
  c.deleteAttempted=true;assert.equal(await condition('DeleteAlreadyOrStale',c),true);
});
