// Finite browser watchdog ASL compiler. No launcher, AWS adapter or admission flag.
import { FIXED, validateBinding } from './binding.mjs';
import {applyNativeObserverGraph} from './native-observer-graph.mjs';

const expr = text => `{% ${text} %}`;
const literal = value => JSON.stringify(value);
const now = '$toMillis($now())';
const merge = update => expr(`$merge([$ctx,${update}])`);
const seconds = expr(`$max([1,$min([15,$floor(($ctx.C-${now})/1000)])])`);
const wait = expr(`$max([1,$min([5,$floor(($ctx.C-${now})/1000)])])`);
const array = value => `$type(${value})='array'`;
const tags = (i, key, value) => `$count(${i}.Tags[Key=${literal(key)} and Value=${literal(value)}])=1 and $count(${i}.Tags[Key=${literal(key)}])=1`;

export function refusalDefinition() {
  return { QueryLanguage: 'JSONata', StartAt: 'SourceOnlyRefusal', States: {
    SourceOnlyRefusal: { Type: 'Fail', Error: 'BrowserWatchdog.NotAdmitted', Cause: 'Inert source preparation; owner version/input/name and wire/IAM admission absent' },
  } };
}

// Exported solely for expression inspection/tests. It cannot arm a watchdog:
// the literal-false guard cannot be altered with execution input.
export function compileWatchdog(input) {
  if (input === undefined) return refusalDefinition();
  const b = validateBinding(input);
  const expectedTags = i => [
    tags(i, 'aws:cloudformation:stack-id', b.stackId),
    tags(i, 'aws:cloudformation:stack-name', FIXED.stackName),
    tags(i, 'aws:cloudformation:logical-id', FIXED.logicalId),
    tags(i, 'QualificationRun', b.runUUID),
  ].join(' and ');
  const owned = i => `($type(${i})='object' and $type(${i}.InstanceId)='string' and $exists($match(${i}.InstanceId,/^i-[0-9a-f]{17}$/)) and ${array(`${i}.Tags`)} and ${expectedTags(i)} and $type(${i}.LaunchTime)='string' and $exists($match(${i}.LaunchTime,/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/)) and $toMillis(${i}.LaunchTime)>=${b.t0Ms}-5000 and $toMillis(${i}.LaunchTime)<=${b.C})`;
  const root = i => `${i}.BlockDeviceMappings[DeviceName=${i}.RootDeviceName].Ebs.VolumeId`;
  const rootValid = i => `($type(${i}.RootDeviceName)='string' and ${array(`${i}.BlockDeviceMappings`)} and $count(${i}.BlockDeviceMappings[DeviceName=${i}.RootDeviceName])=1 and $type(${root(i)})='string' and $exists($match(${root(i)},/^vol-[0-9a-f]{17}$/)))`;
  const qualified = i => `(${rootValid(i)} and ${i}.ImageId=${literal(FIXED.ami)} and ${i}.VpcId=${literal(FIXED.vpc)} and ${i}.SubnetId=${literal(FIXED.subnet)} and $count(${i}.BlockDeviceMappings)=1 and ${i}.BlockDeviceMappings[DeviceName=${i}.RootDeviceName].Ebs.DeleteOnTermination=true)`;
  // One emitted root-history operation for accumulated pages and fresh direct
  // reads. It never authorizes termination. Missing evidence, drift and bounded
  // overflow survive later clean observations; the first root is never erased.
  const retainRoots = `function($old,$observations) {(
    $validRoots := [$map($observations,function($i){${rootValid('$i')}?${root('$i')}:null})][$!=null];
    $allRoots := $distinct($append($old.observedRootVolumeIds,$validRoots));
    $roots := [$filter($allRoots,function($r,$n){$n<${FIXED.maxRootIds}})];
    $unknown := $old.rootUnknown or $count($filter($observations,function($i){$not(${rootValid('$i')})}))>0;
    $overflow := $old.rootOverflow or $count($allRoots)>${FIXED.maxRootIds};
    $drift := $old.rootDrift or $count($allRoots)>1;
    $merge([$old,{
      "rootVolumeId":$old.rootVolumeId=null?($count($roots)>0?$roots[0]:null):$old.rootVolumeId,
      "observedRootVolumeIds":$roots,"rootDrift":$drift,"rootUnknown":$unknown,"rootOverflow":$overflow,
      "qualified":$old.qualified and $count($filter($observations,function($i){$not(${qualified('$i')})}))=0
    }])
  )}`;
  const s = {};
  const pass = (name, update, next) => { s[name] = { Type: 'Pass', Assign: { ctx: merge(update) }, Next: next }; };
  const choice = (name, condition, yes, no) => { s[name] = { Type: 'Choice', Choices: [{ Condition: expr(condition), Next: yes }], Default: no }; };
  const task = (name, api, args, next, onError = 'ReadFailed') => {
    s[name] = { Type: 'Task', Resource: `arn:aws:states:::aws-sdk:ec2:${api}`,
      Arguments: args, TimeoutSeconds: seconds,
      Assign: { ctx: merge('{"result":$states.result,"error":null,"generation":$ctx.generation+1}') },
      Catch: [{ ErrorEquals: ['States.ALL'], Assign: { ctx: merge('{"result":null,"error":$states.errorOutput,"generation":$ctx.generation+1,"uncertain":true}') }, Next: onError }], Next: next };
  };
  choice('AdmissionGuard', 'false', 'Initialize', 'SourceOnlyRefusal');
  s.SourceOnlyRefusal = refusalDefinition().States.SourceOnlyRefusal;
  s.Initialize = { Type: 'Pass', Assign: { ctx: expr(literal({
    runUUID: b.runUUID, stackId: b.stackId, templateSha256: b.templateSha256,
    t0Ms: b.t0Ms, D: b.D, C: b.C, ledger: [], index: 0, scan: [], token: null,
    tokens: [], pages: 0, generation: 0, result: null, error: null,
    uncertain: false, failed: false, discoveryComplete: false,
  })) }, Next: 'TimeGate' };
  choice('TimeGate', `${now}>=$ctx.t0Ms and ${now}<$ctx.C-1000`, 'BeginScan', 'Unknown');
  pass('BeginScan', '{"scan":[],"token":null,"tokens":[],"pages":0,"discoveryComplete":false}', 'ScanBudget');
  choice('ScanBudget', `${now}<$ctx.C-1000 and $ctx.pages<${FIXED.maxPages}`, 'HasToken', 'ScanFailed');
  choice('HasToken', '$ctx.token=null', 'ListFirst', 'ListNext');
  const filters = [{ Name: 'tag:aws:cloudformation:stack-id', Values: [b.stackId] }];
  task('ListFirst', 'describeInstances', { Filters: filters, MaxResults: 5 }, 'PageShape');
  task('ListNext', 'describeInstances', { Filters: filters, MaxResults: 5, NextToken: expr('$ctx.token') }, 'PageShape');
  const pageShape = `${array('$ctx.result.Reservations')} and $count($ctx.result.Reservations)<=20 and $count($ctx.result.Reservations[$not($type(OwnerId)='string' and OwnerId=${literal(FIXED.account)} and $type(Instances)='array')])=0 and ($not($exists($ctx.result.NextToken)) or ($type($ctx.result.NextToken)='string' and $length($ctx.result.NextToken)>0 and $length($ctx.result.NextToken)<=2048))`;
  choice('PageShape', pageShape, 'RetainPage', 'ScanFailed');
  pass('RetainPage', '{"scan":$append($ctx.scan,[$ctx.result.Reservations.Instances]),"pages":$ctx.pages+1,"token":$exists($ctx.result.NextToken)?$ctx.result.NextToken:null}', 'PageBounds');
  choice('PageBounds', `$count($ctx.scan)<=${FIXED.maxInstances} and ($ctx.token=null or $not($ctx.token in $ctx.tokens))`, 'PageComplete', 'ScanFailed');
  choice('PageComplete', '$ctx.token=null', 'ReconcileScan', 'RetainToken');
  pass('RetainToken', '{"tokens":$append($ctx.tokens,$ctx.token)}', 'ScanBudget');
  // Retain every positively owned ID, even if security qualification fails.
  // Existing root identity is immutable; missing/changed mappings never erase it.
  const reconcile = `(
    $owned := [$ctx.scan[${owned('$')}]];
    $allIds := $distinct($append([$ctx.ledger.instanceId],[$owned.InstanceId]));
    $ids := [$filter($allIds,function($id,$n){$n<${FIXED.maxInstances}})];
    $retainRoots := ${retainRoots};
    $rows := [$map($ids,function($id) {(
      $old := $ctx.ledger[instanceId=$id][0];
      $observations := [$owned[InstanceId=$id]];
      $base := $exists($old)?$old:{
        "instanceId":$id,"rootVolumeId":null,"observedRootVolumeIds":[],"rootDrift":false,"rootUnknown":false,"rootOverflow":false,
        "qualified":true,"attempted":false,"terminal":false,"absent":false
      };
      $merge([$retainRoots($base,$observations),{"seen":$count($observations)>0}])
    )})];
    $merge([$ctx,{
      "ledger":$rows,"index":0,"discoveryComplete":true,
      "failed":$ctx.failed or $count($ctx.scan)!=1 or $count($owned)!=1 or $count($rows[qualified=false])>0,
      "uncertain":$ctx.uncertain or $count($allIds)>${FIXED.maxInstances} or $count($ctx.scan)!=$count($owned) or $count($rows[rootDrift=true or rootUnknown=true or rootOverflow=true])>0
    }])
  )`;
  s.ReconcileScan = { Type: 'Pass', Assign: { ctx: expr(reconcile) }, Next: 'HasLedger' };
  s.ReconcilePartialScan = { Type: 'Pass', Assign: {
    ctx: expr(reconcile.replace('"discoveryComplete":true', '"discoveryComplete":false')),
  }, Next: 'HasLedger' };
  choice('HasLedger', '$count($ctx.ledger)>0', 'ContainmentTime', 'PollWait');
  choice('ContainmentTime', `${now}>=$ctx.D`, 'SelectOwned', 'PollWait');
  choice('SelectOwned', '$ctx.index<$count($ctx.ledger)', 'DirectBudget', 'CleanupComplete');
  choice('DirectBudget', `${now}<$ctx.C-1000`, 'DescribeOwned', 'Unknown');
  task('DescribeOwned', 'describeInstances', { InstanceIds: expr('[$ctx.ledger[$ctx.index].instanceId]') }, 'DirectShape', 'NextOwnedFailed');
  const selected = '$ctx.result.Reservations[0].Instances[0]';
  choice('DirectShape', `${array('$ctx.result.Reservations')} and $count($ctx.result.Reservations)=1 and $ctx.result.Reservations[0].OwnerId=${literal(FIXED.account)} and ${array('$ctx.result.Reservations[0].Instances')} and $count($ctx.result.Reservations[0].Instances)=1 and ${selected}.InstanceId=$ctx.ledger[$ctx.index].instanceId and ${owned(selected)}`, 'RetainDirect', 'NextOwnedFailed');
  s.RetainDirect = { Type: 'Pass', Assign: { ctx: expr(`(
    $i := ${selected}; $old := $ctx.ledger[$ctx.index];
    $retainRoots := ${retainRoots};
    $row := $retainRoots($old,[$i]);
    $merge([$ctx,{
      "ledger":[$map($ctx.ledger,function($v,$n){$n=$ctx.index?$row:$v})],
      "uncertain":$ctx.uncertain or $row.rootDrift or $row.rootUnknown or $row.rootOverflow,"failed":$ctx.failed or $not($row.qualified)
    }])
  )`) }, Next: 'DirectState' };
  choice('DirectState', `${selected}.State.Name='terminated'`, 'MarkTerminal', 'MayTerminate');
  choice('MayTerminate', `${selected}.State.Name in ['pending','running','stopping','stopped','shutting-down']`, 'AlreadyAttempted', 'NextOwnedFailed');
  choice('AlreadyAttempted', '$ctx.ledger[$ctx.index].attempted', 'NextOwned', 'RecordAttempt');
  const updateRow = changes => `{"ledger":[$map($ctx.ledger,function($v,$i){$i=$ctx.index?$merge([$v,${changes}]):$v})]}`;
  pass('RecordAttempt', updateRow('{"attempted":true}'), 'TerminateBudget');
  choice('TerminateBudget', `${now}<$ctx.C-1000`, 'TerminateOwned', 'Unknown');
  task('TerminateOwned', 'terminateInstances', { InstanceIds: expr('[$ctx.ledger[$ctx.index].instanceId]') }, 'NextOwned', 'NextOwnedFailed');
  // An ACK never changes terminal/absent. Those come only from fresh reads.
  pass('MarkTerminal', updateRow('{"terminal":true}'), 'VolumeBudget');
  choice('VolumeBudget', `${now}<$ctx.C-1000 and $ctx.ledger[$ctx.index].rootVolumeId!=null`, 'ReadRootVolume', 'NextOwnedFailed');
  task('ReadRootVolume', 'describeVolumes', { VolumeIds: expr('[$ctx.ledger[$ctx.index].rootVolumeId]') }, 'RootStillExists', 'RootReadError');
  pass('RootStillExists', '{"failed":true}', 'NextOwned');
  // Error spelling is deliberately NOT guessed. Until a controlled real SDK
  // wire qualification pins the service error name+code, no error means absent.
  pass('RootReadError', '{"uncertain":true}', 'NextOwned');
  pass('NextOwnedFailed', '{"uncertain":true}', 'NextOwned');
  pass('NextOwned', '{"index":$ctx.index+1}', 'SelectOwned');
  choice('CleanupComplete', '$ctx.discoveryComplete and $count($ctx.ledger)>0 and $count($ctx.ledger[terminal!=true or absent!=true])=0 and $ctx.uncertain=false', 'Confirmed', 'PollWait');
  choice('PollWait', `${now}<$ctx.C-1000`, 'WaitBounded', 'Unknown');
  s.WaitBounded = { Type: 'Wait', Seconds: wait, Next: 'TimeGate' };
  pass('ScanFailed', '{"uncertain":true,"index":0}', 'ReconcilePartialScan');
  pass('ReadFailed', '{"uncertain":true}', 'ScanFailed');
  s.Confirmed = { Type: 'Pass', Output: expr('{"cleanup":"TERMINATED_AND_ROOT_ABSENT","qualification":$ctx.failed?"FAILED":"NOT_ASSESSED","ledger":$ctx.ledger,"runUUID":$ctx.runUUID,"t0Ms":$ctx.t0Ms,"C":$ctx.C}'), End: true };
  s.Unknown = { Type: 'Pass', Output: expr('{"cleanup":"UNKNOWN","qualification":$ctx.failed?"FAILED":"NOT_ASSESSED","ledger":$ctx.ledger,"runUUID":$ctx.runUUID,"t0Ms":$ctx.t0Ms,"C":$ctx.C,"uncertain":true,"lastError":$ctx.error}'), End: true };
  return { QueryLanguage: 'JSONata', Comment: 'INERT inspection graph. No caller input enables admission. Root-not-found wire/error mapping remains blocked.', StartAt: 'AdmissionGuard', States: s };
}

/** Native RunInstances watchdog. Only the protected /2 overlay may admit a new execution. */
export function compileNativeWatchdogDefinition({physicalObserver}={}) {
  const s = {};
  s.AdmissionGuard = { Type: 'Choice', Choices: [{ Condition: expr(
    "false and $type($states.input)='object' and $states.input.schema='meri-native-watchdog-input/1' and "+
    "$type($states.input.hostId)='string' and $type($states.input.generation)='number' and "+
    "$type($states.input.provisionToken)='string' and $exists($match($states.input.provisionToken,/^[0-9a-f]{64}$/)) and "+
    "$type($states.input.originalT0Ms)='number' and $type($states.input.deadlineMs)='number' and "+
    "$states.input.deadlineMs>$states.input.originalT0Ms"), Next: 'Initialize' }], Default: 'SourceOnlyRefusal' };
  s.SourceOnlyRefusal = refusalDefinition().States.SourceOnlyRefusal;
  s.Initialize = { Type: 'Pass', Assign: { ctx: expr(
    '{"hostId":$states.input.hostId,"generation":$states.input.generation,"accountId":$states.input.accountId,'+
    '"region":$states.input.region,"provisionToken":$states.input.provisionToken,'+
    '"allocationSha256":$states.input.allocationSha256,"placement":$states.input.placement,'+
    '"launch":$states.input.launch,"t0Ms":$states.input.originalT0Ms,"leaseDeadlineMs":$states.input.leaseDeadlineMs,"cleanupCeilingMs":$states.input.cleanupCeilingMs,"deadlineMs":$states.input.deadlineMs,'+
    '"token":null,"pages":0,"owned":[],"index":0,"terminations":0,"rootAbsent":0,"rootAbsentRounds":0,"eniIndex":0,"roundValid":false,"uncertain":false,"last":null,"lastError":null}') }, Next: 'TimeGate' };
  s.TimeGate = { Type: 'Choice', Choices: [
    { Condition: expr(`${now}>=$ctx.cleanupCeilingMs`), Next: 'Unknown' },
    { Condition: expr(`${now}<$ctx.leaseDeadlineMs`), Next: 'PrearmWait' }], Default: 'PageRoute' };
  s.PrearmWait = { Type: 'Wait', Seconds: expr(
    '$max([1,$min([30,$ceil(($ctx.leaseDeadlineMs-$toMillis($now()))/1000)])])'), Next: 'TimeGate' };
  // Two literal shapes instead of one always-sent optional field: the first page carries no NextToken,
  // and a later page carries exactly the token an accepted previous page returned.
  const discover = (argumentsValue) => ({ Type: 'Task', Resource: 'arn:aws:states:::aws-sdk:ec2:describeInstances',
    Arguments: argumentsValue,
    TimeoutSeconds: expr('$max([1,$min([10,$ceil(($ctx.deadlineMs-$toMillis($now()))/1000)])])'),
    Assign: { ctx: merge('{"last":$states.result,"pages":$ctx.pages+1}') },
    Catch: [{ ErrorEquals: ['States.ALL'], Assign: { ctx: merge('{"uncertain":true,"last":$states.errorOutput}') },
      Next: 'WaitBounded' }], Next: 'RetainOwned' });
  s.DiscoverFirst = discover({ Filters: [{ Name: 'tag:MeriProvisionToken', Values: ['{% $ctx.provisionToken %}'] }],
    MaxResults: 100 });
  s.DiscoverNext = discover({ Filters: [{ Name: 'tag:MeriProvisionToken', Values: ['{% $ctx.provisionToken %}'] }],
    MaxResults: 100, NextToken: '{% $ctx.token %}' });
  // Instance fields are bound explicitly: inside a predicate the context is the mapping, so an unqualified
  // RootDeviceName resolves to the mapping's own field and never matches the root device.
  s.RetainOwned = { Type: 'Pass', Assign: { ctx: expr(`(
    $items := $ctx.last.Reservations.Instances;
    $ownedNow := [$filter($items,function($i){
      $type($i.InstanceId)='string' and $exists($match($i.InstanceId,/^i-[0-9a-f]{17}$/)) and
      $type($i.Tags)='array' and
      $count($i.Tags[Key='MeriProvisionToken' and Value=$ctx.provisionToken])=1 and
      $count($i.Tags[Key='MeriHostId' and Value=$ctx.hostId])=1 and
      $count($i.Tags[Key='MeriGeneration' and Value=$string($ctx.generation)])=1 and
      $count($i.Tags[Key='MeriAllocationSha256' and Value=$ctx.allocationSha256])=1
    })];
    $rows := $ownedNow.($i := $; {"instanceId":$i.InstanceId,
      "rootVolumeId":$i.BlockDeviceMappings[DeviceName=$i.RootDeviceName].Ebs.VolumeId,
      "networkInterfaceIds":[$i.NetworkInterfaces.NetworkInterfaceId]});
    $merge([$ctx,{"owned":$count($rows)>0?$distinct($append($ctx.owned,$rows)):$ctx.owned,
      "token":$exists($ctx.last.NextToken)?$ctx.last.NextToken:null,"index":0}])
  )`) }, Next: 'PageCheck' };
  s.PageCheck = { Type: 'Choice', Choices: [
    { Condition: expr('$ctx.token!=null and $ctx.pages<20'), Next: 'PageGate' },
    { Condition: expr('$ctx.token!=null'), Next: 'ScanUnknown' }], Default: 'HasOwned' };
  // Every continuation page re-checks the ORIGINAL cleanup ceiling; paging never renews or extends it.
  s.PageGate = { Type: 'Choice', Choices: [
    { Condition: expr(`${now}>=$ctx.cleanupCeilingMs`), Next: 'Unknown' }], Default: 'PageRoute' };
  // The first page has no NextToken at all; a retained accepted token resumes exactly where it stopped.
  s.PageRoute = { Type: 'Choice', Choices: [{ Condition: expr('$ctx.token=null'), Next: 'DiscoverFirst' }],
    Default: 'DiscoverNext' };
  s.HasOwned = { Type: 'Choice', Choices: [{ Condition: expr('$count($ctx.owned)>0'), Next: 'SelectOwned' }],
    Default: 'WaitBounded' };
  s.ScanUnknown = { Type: 'Pass', Assign: { ctx: merge('{"uncertain":true}') }, Next: 'Unknown' };
  s.SelectOwned = { Type: 'Choice', Choices: [{ Condition: expr('$ctx.index<$count($ctx.owned)'), Next: 'OwnedGate' }],
    Default: 'CorrelatedBudget' };
  // The per-instance direct read is also bounded by the original cleanup ceiling.
  s.OwnedGate = { Type: 'Choice', Choices: [
    { Condition: expr(`${now}>=$ctx.cleanupCeilingMs`), Next: 'Unknown' }], Default: 'DescribeOwned' };
  s.DescribeOwned = { Type: 'Task', Resource: 'arn:aws:states:::aws-sdk:ec2:describeInstances',
    Arguments: { InstanceIds: ['{% $ctx.owned[$ctx.index].instanceId %}'] }, TimeoutSeconds: 10,
    Assign: { ctx: merge('{"last":$states.result}') },
    Catch: [{ ErrorEquals: ['States.ALL'], Assign: { ctx: merge('{"uncertain":true}') }, Next: 'NextOwned' }],
    Next: 'CheckOwned' };
  s.CheckOwned = { Type: 'Choice', Choices: [{ Condition: expr(`(
    $count($ctx.last.Reservations)=1 and $count($ctx.last.Reservations[0].Instances)=1 and
    $ctx.last.Reservations[0].OwnerId=$ctx.accountId and
    $ctx.last.Reservations[0].Instances[0].InstanceId=$ctx.owned[$ctx.index].instanceId and
    $count($ctx.last.Reservations[0].Instances[0].Tags[Key='MeriProvisionToken' and Value=$ctx.provisionToken])=1 and
    $count($ctx.last.Reservations[0].Instances[0].Tags[Key='MeriHostId' and Value=$ctx.hostId])=1 and
    $count($ctx.last.Reservations[0].Instances[0].Tags[Key='MeriGeneration' and Value=$string($ctx.generation)])=1 and
    $count($ctx.last.Reservations[0].Instances[0].Tags[Key='MeriAllocationSha256' and Value=$ctx.allocationSha256])=1 and
    $ctx.last.Reservations[0].Instances[0].ImageId=$ctx.launch.ImageId and
    $ctx.last.Reservations[0].Instances[0].VpcId=$ctx.placement.vpcId and
    $ctx.last.Reservations[0].Instances[0].SubnetId=$ctx.placement.subnetId and
    $count($ctx.last.Reservations[0].Instances[0].NetworkInterfaces[
      OwnerId!=$ctx.accountId or VpcId!=$ctx.placement.vpcId or SubnetId!=$ctx.placement.subnetId or
      $count(Groups[GroupId in $ctx.placement.securityGroupIds])!=1
    ])=0
  )`), Next: 'IsTerminated' }], Default: 'MarkUncertain' };
  s.MarkUncertain = { Type: 'Pass', Assign: { ctx: merge('{"uncertain":true}') }, Next: 'NextOwned' };
  s.IsTerminated = { Type: 'Choice', Choices: [{ Condition: expr(
    "$ctx.last.Reservations[0].Instances[0].State.Name='terminated'"), Next: 'NextOwned' }],
    Default: 'TerminateBudget' };
  s.TerminateBudget = { Type: 'Choice', Choices: [{ Condition: expr(
    `${now}<$ctx.deadlineMs and $ctx.terminations<16`), Next: 'TerminateOwned' }], Default: 'WaitBounded' };
  s.TerminateOwned = { Type: 'Task', Resource: 'arn:aws:states:::aws-sdk:ec2:terminateInstances',
    Arguments: { InstanceIds: ['{% $ctx.owned[$ctx.index].instanceId %}'] }, TimeoutSeconds: 10,
    Assign: { ctx: merge('{"terminations":$ctx.terminations+1}') },
    Catch: [{ ErrorEquals: ['States.ALL'], Assign: { ctx: merge('{"uncertain":true}') }, Next: 'NextOwned' }],
    Next: 'NextOwned' };
  s.NextOwned = { Type: 'Pass', Assign: { ctx: merge('{"index":$ctx.index+1}') }, Next: 'SelectOwned' };
  s.WaitBounded = { Type: 'Wait', Seconds: expr(
    '$max([1,$min([5,$ceil(($ctx.deadlineMs-$toMillis($now()))/1000)])])'), Next: 'TimeGate' };
  s.CorrelatedBudget = { Type: 'Choice', Choices: [
    { Condition: expr(`${now}<$ctx.cleanupCeilingMs and $count($ctx.owned)=1`), Next: 'CorrelatedTerminal' }],
    Default: 'Unknown' };
  s.CorrelatedTerminal = { Type: 'Task', Resource: 'arn:aws:states:::aws-sdk:ec2:describeInstances',
    Arguments: { InstanceIds: ['{% $ctx.owned[0].instanceId %}'] }, TimeoutSeconds: 10,
    Assign: { ctx: merge('{"last":$states.result}') },
    Catch: [{ ErrorEquals: ['States.ALL'], Assign: { ctx: merge('{"uncertain":true}') }, Next: 'WaitCorrelated' }],
    Next: 'TerminalCheck' };
  s.TerminalCheck = { Type: 'Choice', Choices: [{ Condition: expr(`(
    $count($ctx.last.Reservations)=1 and $count($ctx.last.Reservations[0].Instances)=1 and
    $ctx.last.Reservations[0].OwnerId=$ctx.accountId and
    $ctx.last.Reservations[0].Instances[0].InstanceId=$ctx.owned[0].instanceId and
    $ctx.last.Reservations[0].Instances[0].State.Name='terminated'
  )`), Next: 'RootBudget' }], Default: 'WaitCorrelated' };
  s.RootBudget = { Type: 'Choice', Choices: [
    { Condition: expr(`${now}<$ctx.cleanupCeilingMs and $ctx.owned[0].rootVolumeId!=null`), Next: 'ReadRoot' }],
    Default: 'Unknown' };
  s.ReadRoot = { Type: 'Task', Resource: 'arn:aws:states:::aws-sdk:ec2:describeVolumes',
    Arguments: { VolumeIds: ['{% $ctx.owned[0].rootVolumeId %}'] }, TimeoutSeconds: 10,
    Assign: { ctx: merge('{"last":$states.result}') },
    Catch: [{ ErrorEquals: ['States.ALL'], Assign: { ctx: merge('{"lastError":$states.errorOutput}') }, Next: 'RootError' }],
    Next: 'RootState' };
  s.RootState = { Type: 'Choice', Choices: [{ Condition: expr(
    "$count($ctx.last.Volumes)=1 and $ctx.last.Volumes[0].VolumeId=$ctx.owned[0].rootVolumeId and $ctx.last.Volumes[0].State='deleted'"),
    Next: 'RootAbsent' }], Default: 'RootPresent' };
  s.RootError = { Type: 'Choice', Choices: [{ Condition: expr(
    "$ctx.lastError.Error='InvalidVolume.NotFound'"), Next: 'RootAbsent' }], Default: 'RootPresent' };
  s.RootAbsent = { Type: 'Pass', Assign: { ctx: merge('{"rootAbsent":1,"rootAt":$toMillis($now())}') },
    Next: 'EniBudget' };
  s.RootPresent = { Type: 'Pass', Assign: { ctx: merge('{"rootAbsent":0,"uncertain":true}') }, Next: 'EniBudget' };
  s.EniBudget = { Type: 'Choice', Choices: [{ Condition: expr(
    `${now}<$ctx.cleanupCeilingMs and $count($ctx.owned[0].networkInterfaceIds)>0`), Next: 'EniStart' }],
    Default: 'Unknown' };
  s.EniStart = { Type: 'Pass', Assign: { ctx: merge('{"eniIndex":0,"roundValid":true,"eniUnknown":false}') },
    Next: 'EniSelect' };
  s.EniSelect = { Type: 'Choice', Choices: [{ Condition: expr(
    '$ctx.eniIndex<$count($ctx.owned[0].networkInterfaceIds)'), Next: 'EniGate' }], Default: 'RoundEnd' };
  // Every per-ENI iteration re-checks the ORIGINAL cleanup ceiling before issuing the next exact-ID read.
  s.EniGate = { Type: 'Choice', Choices: [
    { Condition: expr(`${now}>=$ctx.cleanupCeilingMs`), Next: 'Unknown' }], Default: 'ReadEni' };
  s.ReadEni = { Type: 'Task', Resource: 'arn:aws:states:::aws-sdk:ec2:describeNetworkInterfaces',
    Arguments: { NetworkInterfaceIds: ['{% $ctx.owned[0].networkInterfaceIds[$ctx.eniIndex] %}'] }, TimeoutSeconds: 10,
    Assign: { ctx: merge('{"last":$states.result}') },
    Catch: [{ ErrorEquals: ['States.ALL'], Assign: { ctx: merge('{"lastError":$states.errorOutput}') }, Next: 'EniError' }],
    Next: 'EniPresent' };
  s.EniError = { Type: 'Choice', Choices: [{ Condition: expr(
    "$ctx.lastError.Error='InvalidNetworkInterfaceID.NotFound'"), Next: 'EniAbsent' }],
    Default: 'EniUnknown' };
  s.EniAbsent = { Type: 'Pass', Assign: { ctx: merge('{"eniIndex":$ctx.eniIndex+1}') }, Next: 'EniSelect' };
  // Presence or any unqualified error invalidates this whole round; it never counts as absence.
  s.EniPresent = { Type: 'Pass', Assign: { ctx: merge('{"roundValid":false,"eniIndex":$ctx.eniIndex+1}') },
    Next: 'EniSelect' };
  s.EniUnknown = { Type: 'Pass', Assign: { ctx: merge('{"roundValid":false,"eniUnknown":true,"eniIndex":$ctx.eniIndex+1}') },
    Next: 'EniSelect' };
  s.RoundEnd = { Type: 'Choice', Choices: [{ Condition: expr(
    '$ctx.roundValid and $ctx.rootAbsent>0'), Next: 'RoundAbsent' }], Default: 'RoundReset' };
  s.RoundAbsent = { Type: 'Pass', Assign: { ctx: merge('{"rootAbsentRounds":$ctx.rootAbsentRounds+1,"rootAbsent":0}') },
    Next: 'CorrelatedCheck' };
  s.RoundReset = { Type: 'Pass', Assign: { ctx: merge('{"rootAbsentRounds":0,"rootAbsent":0,"uncertain":true}') },
    Next: 'CorrelatedCheck' };
  s.CorrelatedCheck = { Type: 'Choice', Choices: [{ Condition: expr(
    '$ctx.rootAbsentRounds>=2 and $ctx.roundValid'), Next: 'Confirmed' }], Default: 'WaitCorrelated' };
  s.WaitCorrelated = { Type: 'Wait', Seconds: 5, Next: 'CorrelatedBudget' };
  s.Confirmed = { Type: 'Pass', Output: expr(
    '{"schema":"meri-native-watchdog-result/1","cleanup":"TERMINATED_AND_CORRELATED_ABSENT","hostId":$ctx.hostId,"generation":$ctx.generation,"instanceId":$ctx.owned[0].instanceId,"rootVolumeId":$ctx.owned[0].rootVolumeId,"networkInterfaceIds":$ctx.owned[0].networkInterfaceIds,"rootAbsentCount":$ctx.rootAbsent,"eniAbsentCount":$ctx.eniAbsent,"owned":$ctx.owned,"deadlineMs":$ctx.cleanupCeilingMs}'), End: true };
  s.Unknown = { Type: 'Pass', Output: expr(
    '{"schema":"meri-native-watchdog-result/1","cleanup":"UNKNOWN","reason":"deadline_or_incomplete_observation","hostId":$ctx.hostId,"generation":$ctx.generation,"t0Ms":$ctx.t0Ms,"deadlineMs":$ctx.deadlineMs,"owned":$ctx.owned,"terminations":$ctx.terminations,"uncertain":$ctx.uncertain}'), End: true };
  if(physicalObserver!==undefined)applyNativeObserverGraph(s,physicalObserver);
  return { QueryLanguage: 'JSONata', Comment: 'Native RunInstances watchdog. Waits for the original lease deadline before exact-token cleanup. Root/ENI correlated proof remains the runtime receipt protocol.', StartAt: 'AdmissionGuard', States: s };
}
