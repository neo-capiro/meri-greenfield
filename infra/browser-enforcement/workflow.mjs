// Finite browser watchdog ASL compiler. No launcher, AWS adapter or admission flag.
import { FIXED, validateBinding } from './binding.mjs';

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
  const qualified = i => `(${i}.ImageId=${literal(FIXED.ami)} and ${i}.VpcId=${literal(FIXED.vpc)} and ${i}.SubnetId=${literal(FIXED.subnet)} and $count(${i}.BlockDeviceMappings)=1 and ${i}.BlockDeviceMappings[DeviceName=${i}.RootDeviceName].Ebs.DeleteOnTermination=true)`;
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
    $ids := [$filter($allIds,function($id,$n){$n<20})];
    $rows := [$map($ids,function($id) {(
      $old := $ctx.ledger[instanceId=$id][0];
      $i := $owned[InstanceId=$id][0];
      $r := ${rootValid('$i')} ? ${root('$i')} : null;
      $exists($old) ? $merge([$old,{
        "seen":$exists($i),
        "rootVolumeId":$old.rootVolumeId=null?$r:$old.rootVolumeId,
        "observedRootVolumeIds":$distinct($append($old.observedRootVolumeIds,$r!=null?[$r]:[])),
        "rootDrift":$old.rootDrift or ($exists($i) and $r!=null and $old.rootVolumeId!=null and $r!=$old.rootVolumeId),
        "qualified":$old.qualified and ($exists($i)?${qualified('$i')}:true)
      }]) : {
        "instanceId":$id,"rootVolumeId":$r,"observedRootVolumeIds":$r!=null?[$r]:[],"seen":true,"rootDrift":false,
        "qualified":${qualified('$i')},"attempted":false,"terminal":false,"absent":false
      }
    )})];
    $merge([$ctx,{
      "ledger":$rows,"index":0,"discoveryComplete":true,
      "failed":$ctx.failed or $count($ctx.scan)!=1 or $count($owned)!=1 or $count($rows[qualified=false])>0,
      "uncertain":$ctx.uncertain or $count($allIds)>20 or $count($ctx.scan)!=$count($owned) or $count($rows[rootDrift=true])>0
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
    $r := ${rootValid('$i')} ? ${root('$i')} : null;
    $drift := $r!=null and $old.rootVolumeId!=null and $r!=$old.rootVolumeId;
    $row := $merge([$old,{
      "rootVolumeId":$old.rootVolumeId=null?$r:$old.rootVolumeId,
      "observedRootVolumeIds":$distinct($append($old.observedRootVolumeIds,$r!=null?[$r]:[])),
      "rootDrift":$old.rootDrift or $drift,"qualified":$old.qualified and ${qualified('$i')}
    }]);
    $merge([$ctx,{
      "ledger":[$map($ctx.ledger,function($v,$n){$n=$ctx.index?$row:$v})],
      "uncertain":$ctx.uncertain or $drift,"failed":$ctx.failed or $not(${qualified('$i')})
    }])
  )`) }, Next: 'DirectState' };
  choice('DirectState', `${selected}.State.Name='terminated'`, 'MarkTerminal', 'MayTerminate');
  choice('MayTerminate', `${selected}.State.Name in ['pending','running','stopping','stopped','shutting-down'] and $ctx.ledger[$ctx.index].rootVolumeId!=null`, 'AlreadyAttempted', 'NextOwnedFailed');
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
