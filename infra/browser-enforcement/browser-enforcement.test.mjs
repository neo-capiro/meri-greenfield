import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { FIXED, validateBinding } from './binding.mjs';
import { compileWatchdog, refusalDefinition } from './workflow.mjs';
import { compileTemplate } from './template.mjs';

// Exact already-retained evaluator. No install, network, AWS mock extension,
// candidate helper import, $eval or OS callback is used.
const evaluatorPath = process.env.MERI_TEST_JSONATA;
assert.equal(typeof evaluatorPath, 'string', 'Explicit retained JSONata evaluator required');
assert.equal(createHash('sha256').update(readFileSync(evaluatorPath)).digest('hex'),
  '8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b');
const jsonata = createRequire(import.meta.url)(evaluatorPath);
const T0 = 1791660000000;
const binding = { runUUID: '2c7a4877-4c34-4870-b746-268163a1094a',
  stackId: `arn:aws:cloudformation:us-east-1:967807252336:stack/MeriGreenfield-BrowserQualification/11111111-1111-4111-8111-111111111111`,
  t0Ms: T0, templateSha256: 'a'.repeat(64) };
const graph = compileWatchdog(binding);
const instance = () => ({ InstanceId: 'i-0123456789abcdef0', LaunchTime: new Date(T0 + 1000).toISOString(),
  ImageId: FIXED.ami, VpcId: FIXED.vpc, SubnetId: FIXED.subnet, RootDeviceName: '/dev/xvda',
  State: { Name: 'running' }, BlockDeviceMappings: [{ DeviceName: '/dev/xvda', Ebs: { VolumeId: 'vol-0123456789abcdef0', DeleteOnTermination: true } }],
  Tags: [{ Key: 'aws:cloudformation:stack-id', Value: binding.stackId }, { Key: 'aws:cloudformation:stack-name', Value: FIXED.stackName },
    { Key: 'aws:cloudformation:logical-id', Value: FIXED.logicalId }, { Key: 'QualificationRun', Value: binding.runUUID }] });
const page = rows => ({ Reservations: [{ OwnerId: FIXED.account, Instances: rows }] });
async function evaluate(value, ctx, result = {}, ms = T0, error = {}) {
  if (typeof value !== 'string' || !value.startsWith('{% ')) {
    if (Array.isArray(value)) return Promise.all(value.map(v => evaluate(v, ctx, result, ms, error)));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k,v]) => [k,await evaluate(v,ctx,result,ms,error)])));
    return value;
  }
  const e = jsonata(value.slice(3, -3));
  e.registerFunction('now', () => new Date(ms).toISOString(), '<:s>');
  return e.evaluate({}, { ctx, states: { input: {}, result, errorOutput: error } });
}
async function initial() { return evaluate(graph.States.Initialize.Assign.ctx); }
async function assign(name, ctx, result = {}, ms = T0) { return evaluate(graph.States[name].Assign.ctx, ctx, result, ms); }
async function condition(name, ctx, ms = T0) { return evaluate(graph.States[name].Choices[0].Condition, ctx, {}, ms); }
async function scan(rows) {
  let c = await initial(); c = await assign('BeginScan', c); c = await assign('ListFirst', c, page(rows));
  assert.equal(await condition('PageShape', c), true); c = await assign('RetainPage', c); return assign('ReconcileScan', c);
}

// Simulation explicitly starts AFTER the production literal-false guard.
// It evaluates the actual compiled Assign/Choice/Arguments/Timeout expressions;
// API results and service duration/clock are synthetic, not AWS survival proof.
async function traceFromInitialize(api, startMs = T0 + 720000) {
  let state = 'Initialize', ctx, ms = startMs;
  const calls = [], visited = [];
  for (let step = 0; step < 5000; step++) {
    const s = graph.States[state]; visited.push(state);
    if (s.Type === 'Choice') {
      state = await evaluate(s.Choices[0].Condition,ctx,{},ms) ? s.Choices[0].Next : s.Default;
    } else if (s.Type === 'Wait') {
      ms += 1000 * await evaluate(s.Seconds,ctx,{},ms); state=s.Next;
    } else if (s.Type === 'Task') {
      const args=await evaluate(s.Arguments,ctx,{},ms), timeout=await evaluate(s.TimeoutSeconds,ctx,{},ms);
      const call={state,args,timeout,atMs:ms}; calls.push(call);
      const returned=api(call,calls);
      if (returned?.error) { ctx=await evaluate(s.Catch[0].Assign.ctx,ctx,{},ms,returned.error);state=s.Catch[0].Next; }
      else { ctx=await evaluate(s.Assign.ctx,ctx,returned,ms);state=s.Next; }
    } else if (s.Type === 'Pass') {
      if(s.Assign)ctx=await evaluate(s.Assign.ctx,ctx,{},ms);
      if(s.End)return {output:await evaluate(s.Output,ctx,{},ms),ctx,calls,visited,atMs:ms};
      state=s.Next;
    } else throw new Error('Unexpected simulated state');
    ms++;
  }
  throw new Error('Finite trace structural bound exceeded');
}

test('default refusal has one state and no caller runtime/admission toggle', () => {
  assert.deepEqual(compileWatchdog(), refusalDefinition());
  assert.equal(Object.keys(compileTemplate().Resources.Watchdog.Properties.Definition.States).length, 1);
  assert.equal(compileTemplate().Resources.WatchdogRole.Properties.Policies, undefined);
  assert.throws(() => compileWatchdog({ ...binding, execute: true }));
  assert.throws(() => compileWatchdog({ ...binding, runtimeEnabled: true }));
  const hidden={...binding};Object.defineProperty(hidden,'execute',{value:true});assert.throws(()=>compileWatchdog(hidden));
  const symbol={...binding,[Symbol('execute')]:true};assert.throws(()=>compileWatchdog(symbol));
});
test('binding rejects foreign account/stack, unknown keys, malformed UUID and reset options', () => {
  for (const x of [null, [], { ...binding, stackId: binding.stackId.replace('967807252336','111111111111') },
    { ...binding, runUUID: 'string' }, { ...binding, t0Ms: NaN }, { ...binding, C: T0+999999 }, { ...binding, templateSha256: 'claim' }]) assert.throws(() => validateBinding(x));
});
test('real expressions parse and graph targets exist; all tasks capture real result/error without Retry', () => {
  const names = new Set(Object.keys(graph.States));
  function visit(v) { if (typeof v === 'string' && v.startsWith('{% ')) jsonata(v.slice(3,-3)); else if(v && typeof v==='object') for(const x of Object.values(v))visit(x); }
  visit(graph);
  for (const s of Object.values(graph.States)) {
    for (const n of [s.Next,s.Default,...(s.Choices||[]).map(x=>x.Next),...(s.Catch||[]).map(x=>x.Next)].filter(Boolean)) assert.ok(names.has(n));
    if(s.Type==='Task') { assert.equal(s.Retry,undefined); assert.match(s.Assign.ctx,/\$states.result/); assert.match(s.Catch[0].Assign.ctx,/\$states.errorOutput/); assert.match(s.Catch[0].Assign.ctx,/"result":null/); }
  }
});
test('literal admission guard refuses even hostile caller input; compiler emits no launch API', async () => {
  assert.equal(await condition('AdmissionGuard', { execute: true, runtimeEnabled:true }), false);
  assert.doesNotMatch(JSON.stringify(graph), /executeChangeSet|runInstances|RunTask|StartExecution|RedriveExecution/);
});
test('original deadline fixed, calls/waits clipped, post-ceiling UNKNOWN and before-t0 refusal', async () => {
  const c=await initial(); assert.equal(c.D,T0+720000); assert.equal(c.C,T0+900000);
  assert.equal(await condition('TimeGate',c,T0-1),false); assert.equal(await condition('TimeGate',c,c.C),false);
  for(const left of [900000,16000,15000,5000,2000,1001]) {
    const ms=c.C-left; const n=await evaluate(graph.States.ListFirst.TimeoutSeconds,c,{},ms);
    assert.ok(n>=1 && n<=15 && n*1000<=left);
    const w=await evaluate(graph.States.WaitBounded.Seconds,c,{},ms); assert.ok(w>=1 && w<=5 && w*1000<=left);
  }
});
test('uncertain CREATE and late discovery preserve original deadline; empty inventory never confirms', async () => {
  const empty=await scan([]); assert.equal(empty.ledger.length,0); assert.equal(await condition('CleanupComplete',empty),false);
  const late=await scan([instance()]); assert.equal(late.ledger.length,1); assert.equal(late.C,T0+900000);
  assert.equal(await condition('ContainmentTime',late,T0+719999),false); assert.equal(await condition('ContainmentTime',late,T0+720000),true);
});
test('owned wrong AMI/network remains retained for containment and qualification fails', async () => {
  const i=instance(); i.ImageId='ami-foreign';i.SubnetId='subnet-foreign';
  const c=await scan([i]); assert.equal(c.ledger[0].instanceId,i.InstanceId); assert.equal(c.failed,true);assert.equal(c.ledger[0].qualified,false);
});
test('foreign/missing/conflicting tags, launch window and account never authorize termination', async () => {
  for(const mode of ['foreign','missing','duplicate','old']) {
    const i=instance(); if(mode==='foreign')i.Tags[0].Value+='foreign'; if(mode==='missing')i.Tags.pop();
    if(mode==='duplicate')i.Tags.push({...i.Tags[0]});if(mode==='old')i.LaunchTime=new Date(T0-10000).toISOString();
    const c=await scan([i]);assert.equal(c.ledger.length,0);assert.equal(c.uncertain,true);
  }
  let c=await initial(); c=await assign('ListFirst',c,{Reservations:[{OwnerId:'foreign',Instances:[instance()]}]});assert.equal(await condition('PageShape',c),false);
});
test('opaque paging accepted, duplicate tokens and structural/page bounds fail closed', async () => {
  let c=await initial();c=await assign('ListFirst',c,{...page([]),NextToken:'opaque+/=token'});assert.equal(await condition('PageShape',c),true);
  c=await assign('RetainPage',c);c=await assign('RetainToken',c);assert.equal(await condition('PageBounds',c),false);
  c.pages=20;assert.equal(await condition('ScanBudget',c),false);
  for(const bad of [{},{Reservations:null},{Reservations:[],NextToken:5},{Reservations:[{OwnerId:FIXED.account,Instances:{}}]}]) {
    c=await assign('ListFirst',await initial(),bad);assert.equal(await condition('PageShape',c),false);
  }
});
test('root ID persists after terminated mapping disappears; terminal requires same direct identity', async () => {
  let c=await scan([instance()]);const i=instance();i.State.Name='terminated';i.BlockDeviceMappings=[];
  c=await assign('DescribeOwned',c,page([i]));assert.equal(await condition('DirectShape',c),true);assert.equal(await condition('DirectState',c),true);
  c=await assign('MarkTerminal',c);assert.equal(c.ledger[0].rootVolumeId,'vol-0123456789abcdef0');assert.equal(c.ledger[0].terminal,true);
  const foreign=instance();foreign.InstanceId='i-fedcba98765432100';c=await assign('DescribeOwned',c,page([foreign]));assert.equal(await condition('DirectShape',c),false);
});
test('termination ACK cannot prove STOPPED/root absence and attempted mutation never retries', async () => {
  let c=await scan([instance()]);c=await assign('RecordAttempt',c);c=await assign('TerminateOwned',c,{TerminatingInstances:[{InstanceId:instance().InstanceId}]});
  assert.equal(c.ledger[0].terminal,false);assert.equal(c.ledger[0].absent,false);assert.equal(await condition('AlreadyAttempted',c),true);assert.equal(await condition('CleanupComplete',c),false);
});
test('access denied, empty volume response and unqualified NotFound remain UNKNOWN', async () => {
  let c=await scan([instance()]);c=await assign('MarkTerminal',c);
  for(const error of [{Error:'Ec2.UnauthorizedOperationException',Cause:'denied'},{Error:'Ec2.InvalidVolume.NotFoundException',Cause:'unqualified'}]) {
    const caught=await evaluate(graph.States.ReadRootVolume.Catch[0].Assign.ctx,c,{},T0,error);
    assert.equal(caught.result,null);assert.equal(caught.uncertain,true);assert.equal(await condition('CleanupComplete',caught),false);
  }
  c=await assign('ReadRootVolume',c,{Volumes:[]});c=await assign('RootStillExists',c);assert.equal(c.ledger[0].absent,false);assert.equal(await condition('CleanupComplete',c),false);
});
test('inert IAM proposes exact source trust and tag-bound termination without launches/passrole', () => {
  const t=compileTemplate(binding);const role=t.Resources.WatchdogRole.Properties;
  assert.equal(role.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals['aws:SourceAccount'],FIXED.account);
  assert.match(role.AssumeRolePolicyDocument.Statement[0].Condition.ArnEquals['aws:SourceArn'],/MeriGreenfield-BrowserWatchdog-/);
  const rows=role.Policies[0].PolicyDocument.Statement;assert.equal(rows.length,2);
  assert.deepEqual(rows[1].Action,['ec2:TerminateInstances']);assert.equal(rows[1].Condition.StringEquals['ec2:ResourceTag/aws:cloudformation:stack-id'],binding.stackId);
  assert.equal(t.Resources.Watchdog.Properties.StateMachineType,'STANDARD');assert.equal(t.Metadata.runtimeEnabled,false);
  assert.doesNotMatch(JSON.stringify(rows),/iam:PassRole|ec2:RunInstances|cloudformation:ExecuteChangeSet|DeleteVolume|CreateTags/);
});
test('composed caller-loss abstraction retains IDs, sends one termination and reads terminal after ACK', async () => {
  let stopped=false;
  const r=await traceFromInitialize(call=>{
    if(call.state==='TerminateOwned'){stopped=true;return {TerminatingInstances:[{InstanceId:instance().InstanceId,CurrentState:{Name:'shutting-down'}}]};}
    if(call.state==='ReadRootVolume')return {error:{Error:'Ec2.UnqualifiedNotFound',Cause:'wire unqualified'}};
    const i=instance();if(stopped){i.State.Name='terminated';i.BlockDeviceMappings=[];}
    return page([i]);
  });
  assert.equal(r.calls.filter(x=>x.state==='TerminateOwned').length,1);
  assert.ok(r.calls.filter(x=>x.state==='DescribeOwned').length>1);
  assert.equal(r.ctx.ledger[0].terminal,true);assert.equal(r.ctx.ledger[0].rootVolumeId,'vol-0123456789abcdef0');
  assert.equal(r.output.cleanup,'UNKNOWN');assert.ok(r.atMs<=T0+900000+1000);
  assert.ok(!r.visited.some(x=>/controller/i.test(x)));
});
test('composed scan permissions failure still contains previously owned host, never retries termination', async () => {
  let first=true;
  const r=await traceFromInitialize(call=>{
    if(call.state==='ListFirst'){if(first){first=false;return page([instance()]);}return {error:{Error:'Ec2.UnauthorizedOperationException'}};}
    if(call.state==='TerminateOwned')return {error:{Error:'States.Timeout'}};
    return page([instance()]);
  },T0+719990);
  assert.equal(r.calls.filter(x=>x.state==='TerminateOwned').length,1);
  assert.equal(r.output.cleanup,'UNKNOWN');assert.equal(r.ctx.uncertain,true);
});
test('composed pagination discovers owned late page, foreign companion blocks success without broad stop', async () => {
  const foreign=instance();foreign.InstanceId='i-fedcba98765432100';foreign.Tags[0].Value+='foreign';
  const r=await traceFromInitialize(call=>{
    if(call.state==='ListFirst')return {...page([foreign]),NextToken:'opaque+/='};
    if(call.state==='ListNext'){assert.equal(call.args.NextToken,'opaque+/=');return page([instance()]);}
    if(call.state==='TerminateOwned'){assert.deepEqual(call.args.InstanceIds,[instance().InstanceId]);return {TerminatingInstances:[]};}
    return page([instance()]);
  });
  assert.equal(r.calls.filter(x=>x.state==='TerminateOwned').length,1);
  assert.equal(r.ctx.ledger.length,1);assert.equal(r.output.cleanup,'UNKNOWN');
});
test('root drift and multiple positively owned records retain all IDs; accessor binding never executes', async () => {
  let c=await scan([instance()]);const changed=instance();changed.BlockDeviceMappings[0].Ebs.VolumeId='vol-fedcba98765432100';
  c.scan=[changed];c=await assign('ReconcileScan',c);assert.equal(c.uncertain,true);
  assert.equal(c.ledger[0].rootVolumeId,'vol-0123456789abcdef0');
  assert.deepEqual(c.ledger[0].observedRootVolumeIds,['vol-0123456789abcdef0','vol-fedcba98765432100']);
  const second=instance();second.InstanceId='i-fedcba98765432100';second.BlockDeviceMappings[0].Ebs.VolumeId='vol-fedcba98765432100';
  c=await scan([instance(),second]);assert.equal(c.ledger.length,2);assert.equal(c.failed,true);
  let used=false;const accessor={...binding};Object.defineProperty(accessor,'t0Ms',{enumerable:true,get(){used=true;return T0;}});
  assert.throws(()=>validateBinding(accessor));assert.equal(used,false);
});
test('receipt preserves security failure, and direct drift is retained before a positive-owned termination', async () => {
  let c=await scan([instance()]);const i=instance();i.ImageId='ami-wrong';i.BlockDeviceMappings[0].Ebs.VolumeId='vol-fedcba98765432100';
  c=await assign('DescribeOwned',c,page([i]));assert.equal(await condition('DirectShape',c),true);
  c=await assign('RetainDirect',c);assert.equal(c.failed,true);assert.equal(c.uncertain,true);
  assert.deepEqual(c.ledger[0].observedRootVolumeIds,['vol-0123456789abcdef0','vol-fedcba98765432100']);
  assert.equal(await condition('MayTerminate',c),true);
  const output=await evaluate(graph.States.Unknown.Output,c);assert.equal(output.qualification,'FAILED');assert.equal(output.cleanup,'UNKNOWN');
});
test('owned first-page evidence still gets containment when later page fails; pagination cannot manufacture completeness', async () => {
  const r=await traceFromInitialize(call=>{
    if(call.state==='ListFirst')return {...page([instance()]),NextToken:'opaque-next'};
    if(call.state==='ListNext')return {error:{Error:'Ec2.UnauthorizedOperationException'}};
    if(call.state==='TerminateOwned')return {TerminatingInstances:[{InstanceId:instance().InstanceId}]};
    return page([instance()]);
  });
  assert.equal(r.calls.filter(x=>x.state==='TerminateOwned').length,1);
  assert.equal(r.ctx.discoveryComplete,false);assert.equal(r.output.cleanup,'UNKNOWN');
});
