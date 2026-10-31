/** /2-only changes to the original managed graph. The bridge has NO dispatch authority. */
import {assertNativeObserver} from '../../packages/contracts/native-observer.mjs';
const e=s=>`{% ${s} %}`,now='$toMillis($now())';
const update=s=>e(`$merge([$ctx,${s}])`);
export function applyNativeObserverGraph(states,raw){
 const observer=assertNativeObserver(raw),s=states;
 s.AdmissionGuard.Choices[0].Condition=e(
  `$states.input.schema='meri-native-watchdog-input/2' and `+
  `$states.input.physicalObserver=${JSON.stringify(observer)} and `+
  `$type($states.input.placement)='object' and $type($states.input.launch)='object' and `+
  `$exists($match($states.input.placement.vpcId,/^vpc-[0-9a-f]{8,17}$/)) and `+
  `$states.input.placement.subnetId=$states.input.launch.SubnetId and `+
  `$count($states.input.placement.securityGroupIds)=1 and `+
  `$states.input.placement.securityGroupIds=$states.input.launch.SecurityGroupIds and `+
  `$states.input.leaseDeadlineMs>$states.input.originalT0Ms and `+
  `$states.input.cleanupCeilingMs=$states.input.leaseDeadlineMs+25000 and `+
  `$states.input.deadlineMs=$states.input.cleanupCeilingMs and `+
  `$states.input.cleanupCeilingMs<=9007199254740991 and `+
  `$exists($match($states.input.provisionToken,/^[0-9a-f]{64}$/))`);
 const initial=s.Initialize.Assign.ctx;
 s.Initialize.Assign.ctx=e(`$merge([${initial.slice(3,-3)},{"attempted":{},"mappingConflict":false}])`);
 s.PrearmWait.Seconds=e(`$max([1,$min([30,$ceil(($ctx.leaseDeadlineMs-${now})/1000)])])`);
 // Deduplicate by instance, never by an entire mutable resource mapping. Retain conflict uncertainty.
 s.RetainOwned.Next='DeduplicateOwned';
 s.DeduplicateOwned={Type:'Pass',Assign:{ctx:e(`(
  $ids:=$distinct($ctx.owned.instanceId);
  $conflict:=$count($filter($ids,function($id){$count($ctx.owned[instanceId=$id])>1}))>0;
  $merge([$ctx,{"owned":[$map($ids,function($id){$ctx.owned[instanceId=$id][0]})],
   "mappingConflict":$ctx.mappingConflict or $conflict,"uncertain":$ctx.uncertain or $conflict}])
 )`)},Next:'PageCheck'};
 s.IsTerminated.Default='ManagedAttemptGate';
 s.ManagedAttemptGate={Type:'Choice',Choices:[
  {Condition:e(`$exists($lookup($ctx.attempted,$ctx.owned[$ctx.index].instanceId))`),Next:'NextOwned'},
  {Condition:e(`${now}>$ctx.cleanupCeilingMs-1000 or $ctx.terminations>=16`),Next:'NextOwned'}],Default:'ObserverPrepareBudget'};
 s.ObserverPrepareBudget={Type:'Choice',Choices:[
  // Three seconds for optional preparation, two for scheduling/transitions, one for dispatch.
  {Condition:e(`${now}<$ctx.cleanupCeilingMs-6000`),Next:'ObserverPrepare'}],Default:'CaptureManagedAttempt'};
 const invoke=(mode,next,prepare=false)=>({Type:'Task',Resource:'arn:aws:states:::lambda:invoke',
  Arguments:{FunctionName:observer.bridgeFunctionVersionArn,InvocationType:'RequestResponse',Payload:{
   schema:'meri-native-observer-invocation/1',mode,
   originalInput:e('$states.context.Execution.Input'),executionArn:e('$states.context.Execution.Id')}},
  TimeoutSeconds:e(`$max([1,$min([${prepare?3:10},$floor(($ctx.cleanupCeilingMs-${now}-${prepare?1000:0})/1000)])])`),
  Assign:{ctx:update(`{"observer${mode}Transport":true}`)},
  Catch:[{ErrorEquals:['States.ALL'],Assign:{ctx:update(`{"observer${mode}Transport":false}`)},Next:next}],Next:next});
 s.ObserverPrepare=invoke('prepare','CaptureManagedAttempt',true);
 s.CaptureManagedAttempt={Type:'Pass',Output:e(`{"instanceId":$ctx.owned[$ctx.index].instanceId,
  "attemptId":$states.context.Execution.Id & ':' & $ctx.owned[$ctx.index].instanceId,"attemptedAtMs":${now}}`),Next:'MarkManagedAttempt'};
 s.MarkManagedAttempt={Type:'Pass',Assign:{ctx:e(`(
  $id:=$ctx.owned[$ctx.index].instanceId;
  $record:=$states.input;
  $merge([$ctx,{"attempted":$merge([$ctx.attempted,{$id:$record}]),"terminations":$ctx.terminations+1}])
 )`)},Output:e('$states.input'),Next:'TerminateBudget'};
 s.TerminateBudget.Choices[0].Condition=e(`${now}<=$ctx.cleanupCeilingMs-1000 and $ctx.terminations<=16`);
 s.TerminateBudget.Default='NextOwned';
 s.TerminateOwned.Assign={ctx:update('{"managedDispatchAcknowledged":true}')};
 s.TerminateOwned.TimeoutSeconds=e(`$max([1,$min([10,$floor(($ctx.cleanupCeilingMs-${now})/1000)])])`);
 // No Retry here. Release must separately establish the no-redrive boundary.
 s.SelectOwned.Default='ObserverObserveBudget';
 s.ObserverObserveBudget={Type:'Choice',Choices:[
  {Condition:e(`${now}<$ctx.cleanupCeilingMs-1000`),Next:'ObserverObserve'}],Default:'CorrelatedBudget'};
 s.ObserverObserve=invoke('observe','CorrelatedBudget');
 return s;
}
