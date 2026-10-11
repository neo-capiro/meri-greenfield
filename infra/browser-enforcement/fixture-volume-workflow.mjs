// One finite STANDARD execution owns CREATE and first DELETE. Source DATA only.
import { FIXTURE as F, fixtureTags, fixtureMachineName, fixtureExecutionName, validateFixtureBinding } from './fixture-volume-binding.mjs';
import { validateFixtureBootstrapDescriptor, fixtureBootstrapInput } from './fixture-volume-activation.mjs';
const q = JSON.stringify;
const e = text => `{% ${text} %}`;
const now = '$toMillis($now())';
const array = v => `$type(${v})='array'`;
// Explicit unqualified wire profile. Validate calendar components BEFORE
// $toMillis so malformed service DATA cannot throw through an ownership check.
const iso = (v, fraction = '\\.[0-9]{3}') => `($dt:=${v};$type($dt)='string'?($exists($match($dt,/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]${fraction}Z$/))?($y:=$number($substring($dt,0,4));$m:=$number($substring($dt,5,2));$d:=$number($substring($dt,8,2));$days:=[31,($y%4=0 and ($y%100!=0 or $y%400=0))?29:28,31,30,31,30,31,31,30,31,30,31];$d<=$days[$m-1]):false):false)`;
export const fixtureRefusal = () => ({ QueryLanguage: 'JSONata', StartAt: 'SourceOnlyRefusal', States: {
  SourceOnlyRefusal: { Type: 'Fail', Error: 'BrowserFixture.NotAdmitted', Cause: 'Source only; exact owner version/input, IAM, fresh authority and managed admission absent' },
} });

export function compileFixtureWorkflow(input) {
  if (input === undefined) return fixtureRefusal();
  return buildFixtureWorkflow(validateFixtureBinding(input), null);
}

// Explicit qualification DATA factory; external version/authority/start
// admission is still mandatory. No caller enable flag, policy or predicate.
export function compileFixtureBootstrapWorkflow(input) {
  if (input === undefined) return fixtureRefusal();
  const d = validateFixtureBootstrapDescriptor(input);
  const b = validateFixtureBinding({ t0Ms: d.clock.t0Ms, createNotAfterMs: d.clock.createNotAfterMs, ownerBindingId: d.ownerBindingId });
  return buildFixtureWorkflow(b, d);
}

function buildFixtureWorkflow(b, descriptor) {
  const s = {};
  const merge = changes => e(`$merge([$ctx,${changes}])`);
  const pass = (name, changes, next) => { s[name] = { Type: 'Pass', Assign: { ctx: merge(changes) }, Next: next }; };
  const choice = (name, condition, yes, no) => { s[name] = { Type: 'Choice', Choices: [{ Condition: e(condition), Next: yes }], Default: no }; };
  const budget = `${now}>=$ctx.t0Ms and ${now}<$ctx.C-2000 and $ctx.calls<${F.maxCalls}`;
  const timeout = e(`$max([1,$min([15,$floor(($ctx.C-${now}-1000)/1000)])])`);
  const task = (name, api, args, next, errorNext) => {
    s[name] = { Type: 'Task', Resource: `arn:aws:states:::aws-sdk:ec2:${api}`, Arguments: args,
      TimeoutSeconds: timeout, Assign: { ctx: merge(`{"result":$states.result,"error":null,"resultAtMs":${now}}`) },
      Catch: [{ ErrorEquals: ['States.ALL'], Assign: { ctx: merge('{"result":null,"error":$states.errorOutput,"uncertain":true}') }, Next: errorNext }], Next: next };
  };
  const beforeTask = (name, taskName, condition = budget, no = 'Unknown') => {
    choice(`${name}Budget`, condition, `${name}Count`, no);
    pass(`${name}Count`, '{"calls":$ctx.calls+1}', taskName);
  };
  const id = v => `$type(${v})='string' and $exists($match(${v},/^vol-[0-9a-f]{17}$/))`;
  const tag = (v, t) => `$count(${v}.Tags[Key=${q(t.Key)} and Value=${q(t.Value)}])=1 and $count(${v}.Tags[Key=${q(t.Key)}])=1`;
  // Ownership never comes from a guessed ID, empty response, or an untrusted summary.
  const owned = v => `($type(${v})='object' and ${id(`${v}.VolumeId`)} and ${array(`${v}.Tags`)} and $count(${v}.Tags)=3 and ${fixtureTags().map(t => tag(v, t)).join(' and ')} and ($not($exists(${v}.OwnerId)) or ${v}.OwnerId=${q(F.account)}) and (${iso(`${v}.CreateTime`)}?($toMillis(${v}.CreateTime)>=${b.t0Ms} and $toMillis(${v}.CreateTime)<=${b.createNotAfterMs}):false))`;
  const security = v => `(${v}.AvailabilityZone=${q(F.az)} and $type(${v}.Size)='number' and ${v}.Size=1 and ${v}.VolumeType='gp3' and ${v}.Encrypted=true and ${v}.KmsKeyId=${q(F.keyArn)} and ($not($exists(${v}.SnapshotId)) or ${v}.SnapshotId='') and $not($exists(${v}.SourceVolumeId)) and ${array(`${v}.Attachments`)} and $count(${v}.Attachments)=0)`;
  const validRow = v => `${owned(v)} and ${security(v)} and ${v}.State in ['creating','available']`;
  const prefix = `arn:aws:states:${F.region}:${F.account}`;
  const expectedInput = descriptor ? fixtureBootstrapInput(descriptor) : { runUuid: F.runUuid, t0Ms: b.t0Ms, createNotAfterMs: b.createNotAfterMs, ownerBindingId: b.ownerBindingId };
  // AWS context supports 0/3/6/9 fractional digits. EC2 wire remains exact 3Z.
  // $toMillis truncates submilliseconds, so retain the tail at upper bounds.
  const start = '$states.context.Execution.StartTime';
  const bootstrapTime = `(${iso(start, '(\\.[0-9]{3}([0-9]{3}){0,2})?')}?($start:=$toMillis(${start});$sub:=$length(${start})>24?$number($substring(${start},23,$length(${start})-24))>0:false;$start>=${b.t0Ms} and ($start<${b.createNotAfterMs} or ($start=${b.createNotAfterMs} and $not($sub))) and (${now}>$start or (${now}=$start and $not($sub)))):false)`;
  const timeGuard = descriptor ? bootstrapTime : `(${iso(start)}?($toMillis(${start})>=${b.t0Ms} and $toMillis(${start})<=${b.createNotAfterMs} and ${now}>=$toMillis(${start})):false)`;
  const guard = `$type($states.input)='object' and $count($keys($states.input))=${descriptor ? 5 : 4} and $states.input=${q(expectedInput)} and $states.context.Execution.Name=${q(fixtureExecutionName())} and $states.context.Execution.Id=${q(`${prefix}:execution:${fixtureMachineName()}:${fixtureExecutionName()}`)} and $states.context.StateMachine.Id=${q(`${prefix}:stateMachine:${fixtureMachineName()}`)} and ${timeGuard} and ${now}<=${b.createNotAfterMs}`;
  choice('AdmissionGuard', descriptor ? guard : 'false', 'GuardExecution', 'SourceOnlyRefusal');
  s.SourceOnlyRefusal = fixtureRefusal().States.SourceOnlyRefusal;
  choice('GuardExecution', guard, 'Initialize', 'SourceOnlyRefusal');
  s.Initialize = { Type: 'Pass', Assign: { ctx: e(q({ ...b, runUuid: F.runUuid, calls: 0, polls: 0,
    volumeId: null, createAttempted: false, deleteAttempted: false, createOutcome: 'NOT_ATTEMPTED',
    deleteOutcome: 'NOT_ATTEMPTED', result: null, error: null, resultAtMs: null, uncertain: false,
    failed: false, conflict: false, scanIds: [], totalRows: 0, pages: 0, token: null, tokens: [], scanComplete: false,
  })) }, Next: 'CreateBudget' };
  choice('CreateBudget', `${budget} and ${now}<=${b.createNotAfterMs} and $ctx.createAttempted=false`, 'RecordCreateAttempt', 'Unknown');
  pass('RecordCreateAttempt', '{"createAttempted":true,"calls":$ctx.calls+1}', 'CreateVolume');
  task('CreateVolume', 'createVolume', { AvailabilityZone: F.az, Size: 1, VolumeType: 'gp3', Encrypted: true,
    KmsKeyId: F.keyArn, ClientToken: F.runUuid, TagSpecifications: [{ ResourceType: 'volume', Tags: fixtureTags() }] }, 'RetainCreate', 'CreateUnknown');
  pass('RetainCreate', `{"volumeId":(${id('$ctx.result.VolumeId')})?$ctx.result.VolumeId:null,"createOutcome":"ACK","result":null}`, 'BeginScan');
  pass('CreateUnknown', '{"createOutcome":"UNKNOWN","result":null}', 'BeginScan');
  pass('BeginScan', '{"pages":0,"totalRows":0,"scanIds":[],"token":null,"tokens":[],"scanComplete":false,"result":null}', 'ScanBudget');
  choice('ScanBudget', `${budget} and $ctx.pages<${F.maxPages}`, 'HasToken', 'Unknown');
  choice('HasToken', '$ctx.token=null', 'ListFirstCount', 'ListNextCount');
  pass('ListFirstCount', '{"calls":$ctx.calls+1}', 'ListFirst');
  pass('ListNextCount', '{"calls":$ctx.calls+1}', 'ListNext');
  const filters = fixtureTags().map(t => ({ Name: `tag:${t.Key}`, Values: [t.Value] }));
  filters.push({ Name: 'availability-zone', Values: [F.az] });
  task('ListFirst', 'describeVolumes', { Filters: filters, MaxResults: F.pageSize }, 'PageShape', 'Unknown');
  task('ListNext', 'describeVolumes', { Filters: filters, MaxResults: F.pageSize, NextToken: e('$ctx.token') }, 'PageShape', 'Unknown');
  choice('PageShape', `$type($ctx.result)='object' and $count($keys($ctx.result))=($exists($ctx.result.NextToken)?2:1) and ${array('$ctx.result.Volumes')} and $count($ctx.result.Volumes)<=${F.pageSize} and $length($string($ctx.result))<=${F.maxResultChars} and ($not($exists($ctx.result.NextToken)) or ($type($ctx.result.NextToken)='string' and $length($ctx.result.NextToken)>0 and $length($ctx.result.NextToken)<=${F.maxTokenChars}))`, 'PageOwnership', 'Unknown');
  choice('PageOwnership', `$count($ctx.result.Volumes[$not(${validRow('$')})])=0`, 'RetainPage', 'Unknown');
  pass('RetainPage', `($ids:=$distinct($append($ctx.scanIds,[$ctx.result.Volumes.VolumeId]));$known:=$ctx.volumeId;$merge([{}, {"scanIds":[$filter($ids,function($v,$i){$i<2})],"volumeId":$known=null?($count($ids)>0?$ids[0]:null):$known,"conflict":$ctx.conflict or $count($ids)>1 or $count($ids)!=$ctx.totalRows+$count($ctx.result.Volumes) or ($known!=null and $count($ids[$!=$known])>0),"pages":$ctx.pages+1,"totalRows":$ctx.totalRows+$count($ctx.result.Volumes),"token":$exists($ctx.result.NextToken)?$ctx.result.NextToken:null,"result":null}]))`, 'PageIntegrity');
  choice('PageIntegrity', `$ctx.conflict=false and $ctx.totalRows<=${F.maxRows} and ($ctx.token=null or $not($ctx.token in $ctx.tokens))`, 'PageComplete', 'Unknown');
  choice('PageComplete', '$ctx.token=null', 'FinishScan', 'RetainToken');
  pass('RetainToken', '{"tokens":$append($ctx.tokens,$ctx.token)}', 'ScanBudget');
  pass('FinishScan', '{"scanComplete":true}', 'HasCandidate');
  choice('HasCandidate', '$count($ctx.scanIds)=1 and $ctx.scanIds[0]=$ctx.volumeId', 'DirectBudget', 'Poll');
  beforeTask('Direct', 'DescribeOwned');
  task('DescribeOwned', 'describeVolumes', { VolumeIds: e('[$ctx.volumeId]') }, 'DirectShape', 'Unknown');
  const selected = '$ctx.result.Volumes[0]';
  choice('DirectShape', `$type($ctx.result)='object' and $count($keys($ctx.result))=1 and ${array('$ctx.result.Volumes')} and $count($ctx.result.Volumes)=1 and ${selected}.VolumeId=$ctx.volumeId and ${validRow(selected)} and $length($string($ctx.result))<=${F.maxResultChars}`, 'Available', 'Unknown');
  choice('Available', `${selected}.State='available'`, 'DeleteBudget', 'Poll');
  choice('DeleteBudget', `${budget} and $ctx.scanComplete and $ctx.conflict=false and $ctx.deleteAttempted=false and ${now}-$ctx.resultAtMs<=15000`, 'RecordDeleteAttempt', 'DeleteAlreadyOrStale');
  choice('DeleteAlreadyOrStale', '$ctx.deleteAttempted=true', 'AbsenceBudget', 'Poll');
  pass('RecordDeleteAttempt', '{"deleteAttempted":true,"calls":$ctx.calls+1,"result":null}', 'DeleteVolume');
  task('DeleteVolume', 'deleteVolume', { VolumeId: e('$ctx.volumeId') }, 'DeleteAck', 'DeleteUnknown');
  pass('DeleteAck', '{"deleteOutcome":"ACK_NOT_ABSENCE","result":null}', 'AbsenceBudget');
  pass('DeleteUnknown', '{"deleteOutcome":"UNKNOWN","result":null}', 'AbsenceBudget');
  beforeTask('Absence', 'ReadAbsent');
  task('ReadAbsent', 'describeVolumes', { VolumeIds: e('[$ctx.volumeId]') }, 'StillExists', 'Unknown');
  choice('StillExists', `$type($ctx.result)='object' and $count($keys($ctx.result))=1 and ${array('$ctx.result.Volumes')} and $count($ctx.result.Volumes)=1 and ${selected}.VolumeId=$ctx.volumeId and ${owned(selected)} and ${security(selected)} and ${selected}.State in ['available','deleting'] and $length($string($ctx.result))<=${F.maxResultChars}`, 'PollAbsent', 'Unknown');
  choice('Poll', `${budget} and $ctx.polls<${F.maxPolls}`, 'WaitBeforeScan', 'Unknown');
  choice('PollAbsent', `${budget} and $ctx.polls<${F.maxPolls}`, 'WaitAfterDelete', 'Unknown');
  const wait = e(`$max([1,$min([5,$floor(($ctx.C-${now}-1000)/1000)])])`);
  s.WaitBeforeScan = { Type: 'Wait', Seconds: wait, Next: 'CountScanPoll' };
  s.WaitAfterDelete = { Type: 'Wait', Seconds: wait, Next: 'CountAbsentPoll' };
  pass('CountScanPoll', '{"polls":$ctx.polls+1,"result":null}', 'BeginScan');
  pass('CountAbsentPoll', '{"polls":$ctx.polls+1,"result":null}', 'AbsenceBudget');
  s.Unknown = { Type: 'Pass', Output: e('{"schema":"meri-browser-managed-fixture-result/1","runUuid":$ctx.runUuid,"ownerBindingId":$ctx.ownerBindingId,"t0Ms":$ctx.t0Ms,"C":$ctx.C,"volumeId":$ctx.volumeId,"createAttempted":$ctx.createAttempted,"createOutcome":$ctx.createOutcome,"deleteAttempted":$ctx.deleteAttempted,"deleteOutcome":$ctx.deleteOutcome,"cleanup":"UNKNOWN","absenceWireQualified":false,"qualification":"NOT_ADMITTED","conflict":$ctx.conflict,"observedIds":$ctx.scanIds,"uncertain":$ctx.uncertain,"lastError":$ctx.error,"calls":$ctx.calls,"polls":$ctx.polls}'), End: true };
  return { QueryLanguage: 'JSONata', Comment: descriptor ? 'MANAGED_WIRE_BOOTSTRAP_V1 source DATA; external admission required. Source9 mutations excluded. Wire/absence/survival UNQUALIFIED.' : 'INERT single-owner fixture lifecycle. Source9 mutations excluded. Error wire/absence and actual managed survival UNQUALIFIED.', StartAt: 'AdmissionGuard', States: s };
}
