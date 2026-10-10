import { buildNativeEnforcementAdmission,isCompiledBinding,LIMITS,PLATFORM,rolePrefix } from './binding.mjs';
import { J,lit,now,array,currentOwned,buildPredicates,byteBound,pushIssue,issue,errSummary,retainTask,taskFacts,taskCore,workerOf,commitCtx,boundedExpr } from './expressions.mjs';

export function buildNativeEnforcementStateMachine(binding=buildNativeEnforcementAdmission()){
 if(!isCompiledBinding(binding))return {QueryLanguage:'JSONata',StartAt:'AdmissionRefused',States:{AdmissionRefused:{Type:'Fail',Error:'AdmissionRefused',Cause:'missing complete static preparation'}}};
 const p=binding.pins, machineArn=`arn:aws:states:${p.region}:${p.account}:stateMachine:${p.stateMachineName}`, managedRoleArn=rolePrefix+p.managedRoleName;
 const {taskArnTest,selected,group,worker,coverage,ownership,terminal,mismatch,ready,safeRaw,attachmentsCompatible,attachmentsContradictory,eniIdExpr,eniIpExpr,eniGood}=buildPredicates(p);
 const states={};
 // ---- graph primitives -----------------------------------------------------------------
 const choice=(name,cs,otherwise)=>states[name]={Type:'Choice',Choices:cs.map(([condition,next])=>({Condition:J(condition),Next:next})),Default:otherwise};
 const pass=(name,updates,next)=>states[name]={Type:'Pass',Assign:{ctx:J(commitCtx(updates))},Output:{},Next:next};
 // Every dynamic record field is wrapped in a conservative before-write UTF8 bound with
 // an explicit compact failure disposition, so no record emits unguarded dynamic output.
 const boundedExtra=v=>typeof v==='string'&&v.startsWith('{% ')&&v.endsWith(' %}')?J(boundedExpr(v.slice(3,-3),LIMITS.recordBytes,"{'truncated':true}")):v;
 const record=(name,kind,next,extra={})=>states[name]={Type:'Pass',Output:{kind,sequence:J('$ctx.calls'),run:J('$ctx.run'),staticBindingId:binding.staticBindingId,D:J('$ctx.D'),C:J('$ctx.C'),at:J(now),authorityReferences:p.authorityReferences,...Object.fromEntries(Object.entries(extra).map(([k,v])=>[k,boundedExtra(v)]))},Next:next};
 const timeout=limit=>J(`($r:=$floor((${limit}-${now})/1000);$r>=1?$min([30,$r]):$error('DeadlineInsufficient'))`);
 const created=p.timestampEncoding==='epoch-seconds'?"($type($states.result.tasks[0].createdAt)='number'?$states.result.tasks[0].createdAt*1000:null)":"($type($states.result.tasks[0].createdAt)='string'?$toMillis($states.result.tasks[0].createdAt):null)";
 // Every Task captures only a byte-bounded result; oversized responses are dropped to
 // null so the following shape check fails closed to a bounded UNKNOWN path.
 function task(name,action,args,next,errorNext,limit='$ctx.C',parseCreated=false){states[name]={Type:'Task',Resource:`arn:aws:states:::aws-sdk:${action}`,Arguments:args,TimeoutSeconds:timeout(limit),Assign:{raw:J(`($s:=$string($states.result);$length($s)*6<=${LIMITS.recordBytes}?$states.result:null)`),rawOver:J(`($s:=$string($states.result);$length($s)*6>${LIMITS.recordBytes})`),callOk:true,callError:null,observedMs:J(now),enteredMs:J('$toMillis($states.context.State.EnteredTime)'),createdMs:parseCreated?J(created):null},Output:{},Catch:[{ErrorEquals:['States.DataLimitExceeded','States.QueryEvaluationError','States.Timeout'],Assign:{raw:null,rawOver:false,callOk:false,createdMs:null,callError:J(`($s:=$string($states.errorOutput);$length($s)*6<=${LIMITS.issueBytes}?$states.errorOutput:{'truncated':true})`),observedMs:J(now),enteredMs:J('$toMillis($states.context.State.EnteredTime)')},Output:{},Next:errorNext},{ErrorEquals:['States.ALL'],Assign:{raw:null,rawOver:false,callOk:false,createdMs:null,callError:J(`($s:=$string($states.errorOutput);$length($s)*6<=${LIMITS.issueBytes}?$states.errorOutput:{'truncated':true})`),observedMs:J(now),enteredMs:J('$toMillis($states.context.State.EnteredTime)')},Output:{},Next:errorNext}],Next:next};}
 function prepare(name,operation,next){pass(name,`{'calls':$ctx.calls+1,'operation':${lit(operation)}}`,next);}
 // ---- shared ledger expressions --------------------------------------------------------
 const ownedArns='$map($ctx.owned,function($o){$o.arn})', overflowArns='$map($ctx.overflow,function($o){$o.arn})';
 const pendingOwned='$filter($ctx.owned,function($o){$o.terminal=false and $o.stopAttempted=false})';
 const pendingOverflow='$filter($ctx.overflow,function($o){$o.terminal=false and $o.stopAttempted=false})';
 const pendingAll=`$append(${pendingOwned},${pendingOverflow})`;
 const unconfirmedAll='$append($filter($ctx.owned,function($o){$o.stopAttempted=true and $o.terminal=false}),$filter($ctx.overflow,function($o){$o.stopAttempted=true and $o.terminal=false}))';
 const boundAll='$append($ctx.owned,$ctx.overflow)', boundArns=`$append(${ownedArns},${overflowArns})`;
 const pendingCount=`$count(${pendingAll})`, unconfirmedCount=`$count(${unconfirmedAll})`, boundCount=`$count(${boundAll})`;
 const notTerminalCount=`$count($filter(${boundAll},function($o){$o.terminal=false}))`;
 const containment=`($ctx.qualificationFailed or ${now}>=$ctx.D-155000)`;
 const ownedRecord=(arns)=>`{'arn':$ctx.currentArn,'definition':$ctx.current.definition,'createdMs':$createdMs,'containerArn':($exists(${worker}.containerArn)?${worker}.containerArn:null),'firstSequence':$ctx.calls,'stopAttempted':false,'terminal':false,'qualifiedSeen':false,'netId':null,'netIp':null,'terminalAt':null,'probeSeq':0,'truncated':$ctx.current.truncated}`;
 const mapLedger=(field)=>`'owned':$map($ctx.owned,function($o){$o.arn=$ctx.currentArn?$merge([$o,${field}]):$o}),'overflow':$map($ctx.overflow,function($o){$o.arn=$ctx.currentArn?$merge([$o,${field}]):$o})`;
 // ---- admission ------------------------------------------------------------------------
 const stsPrefix=`arn:aws:sts::${p.account}:assumed-role/${p.managedRoleName}/`;
 const identity=`$type($raw)='object' and $raw.Account=${lit(p.account)} and ($type($raw.Arn)='string'?$count($match($raw.Arn,/^${stsPrefix.replaceAll('/','\\/')}[A-Za-z0-9+=,.@_-]{2,64}$/))=1:false) and $states.context.Execution.RoleArn=${lit(managedRoleArn)}`;
 const guard=`${binding.runtimeEnabled} and $type($states.input)='object' and $count($keys($states.input))=5 and $states.input.runUuid=${lit(p.runUuid)} and ($states.input.probeKind='sdk' or $states.input.probeKind='office') and $states.input.executionName=('meri-native-' & $states.input.probeKind & '-' & $states.input.runUuid) and $states.context.Execution.Name=$states.input.executionName and $states.context.StateMachine.Id=${lit(machineArn)} and $states.input.staticBindingId=${lit(binding.staticBindingId)} and ($type($states.input.t0Ms)='number'?$states.input.t0Ms=$floor($states.input.t0Ms) and $states.input.t0Ms<=$toMillis($states.context.Execution.StartTime) and $toMillis($states.context.Execution.StartTime)-$states.input.t0Ms<=30000:false)`;
 choice('GuardInput',[[guard,'Initialize']],'AdmissionRefused');states.AdmissionRefused={Type:'Fail',Error:'AdmissionRefused',Cause:'inert/missing/mismatched original owner binding'};
 states.Initialize={Type:'Pass',Assign:{ctx:J("{'run':{'uuid':$states.input.runUuid,'probeKind':$states.input.probeKind,'executionName':$states.input.executionName,'t0Ms':$states.input.t0Ms},'D':$states.input.t0Ms+720000,'C':$states.input.t0Ms+900000,'attemptConsumed':false,'attemptStart':0,'attemptEnd':0,'launchCertain':false,'direct':[],'allArns':[],'queue':[],'owned':[],'overflow':[],'overflowExhausted':false,'currentArn':null,'current':null,'eni':null,'taskReady':false,'mode':0,'pages':0,'nextToken':null,'tokens':[],'completeModes':[],'polls':0,'calls':0,'issues':[],'qualificationFailed':false,'hold':false,'finalMode':false,'stopMode':false,'finalQueue':[],'operation':'init'}"),raw:null,callError:null,callOk:false,createdMs:null,observedMs:0},Output:{},Next:'AdmissionRecord'};
 record('AdmissionRecord','ADMISSION','DispatchGate',{input:J('$states.context.Execution.Input'),execution:J('$states.context.Execution.Id'),managedRoleArn});
 // ---- one dynamic launch ---------------------------------------------------------------
 choice('DispatchGate',[[`${now}<$ctx.D-155000 and $not($ctx.attemptConsumed)`,'PrepareDispatchIdentity']],'FinalUnknown');
 prepare('PrepareDispatchIdentity','predispatch-identity','DispatchIdentity');task('DispatchIdentity','sts:getCallerIdentity',{},'CheckDispatchIdentity','FinalUnknown','$ctx.D');
 choice('CheckDispatchIdentity',[[identity,'ConsumeAttempt']],'FinalUnknown');
 pass('ConsumeAttempt',`{'attemptConsumed':true,'attemptStart':${now},'calls':$ctx.calls+1,'operation':'run'}`,'LaunchAttemptRecord');record('LaunchAttemptRecord','LAUNCH_ATTEMPT','RunTask',{identity:J('$raw'),attemptConsumed:true});
 task('RunTask','ecs:runTask',{Cluster:p.clusterArn,TaskDefinition:J(selected),Count:1,LaunchType:'FARGATE',PlatformVersion:PLATFORM,EnableExecuteCommand:false,StartedBy:J('$ctx.run.uuid'),Group:J(group),ClientToken:J("'meri-' & $ctx.run.probeKind & '-' & $ctx.run.uuid"),Overrides:{},NetworkConfiguration:{AwsvpcConfiguration:{Subnets:[p.network.subnetId],SecurityGroups:[p.network.securityGroupId],AssignPublicIp:'DISABLED'}},Tags:[{Key:'QualificationRun',Value:J('$ctx.run.uuid')},{Key:'QualificationProbe',Value:J('$ctx.run.probeKind')},{Key:'MeriComponent',Value:'native-enforcement'}]},'RunShape','LaunchUncertain','$ctx.D');
 // Immediate-member typed predicate. Property traversal ($raw.tasks.taskArn) flattens nested
 // arrays before any validation, so a top-level count<=4 does NOT bound the flattened direct set.
 // Before RetainRun, EVERY immediate $raw.tasks element must itself be an object whose taskArn is a
 // scalar string matching the reviewed exact task namespace. The eligible direct ARNs are then
 // projected from those same validated immediate members (never a flattening property path), so the
 // eligible direct count is bounded by the immediate task count. Malformed/incomplete/mixed results
 // fail this guard and keep the uncertain-launch/failure disposition (they are never truncated into
 // a success and never retried or re-launched here). An EMPTY tasks array may still pass RunShape
 // (count 0 equals immediate 0), but RetainRun then keeps launchCertain:false / qualificationFailed:true,
 // so emptiness is never turned into launch certainty by this guard.
 const immediateTaskArns=`$filter($raw.tasks,function($t){$type($t)='object' and ${taskArnTest('$t.taskArn')}})`;
 choice('RunShape',[[`$type($raw)='object' and $type($raw.tasks)='array' and $count($raw.tasks)<=4 and ($not($exists($raw.failures)) or $type($raw.failures)='array') and $count(${immediateTaskArns})=$count($raw.tasks) and (${safeRaw})`,'RetainRun']],'LaunchUncertain');
 const direct=`$map(${immediateTaskArns},function($t){$t.taskArn})`;
 pass('RetainRun',`{'attemptEnd':${now},'direct':${array(`$distinct(${direct})`)},'launchCertain':$count($raw.tasks)=1 and $count(${direct})=1 and $count($raw.failures)=0,'qualificationFailed':$ctx.qualificationFailed or $count($raw.tasks)!=1 or $count(${direct})!=1 or $count($raw.failures)>0}`,'RunResultRecord');record('RunResultRecord','RUN_RESULT','StartScan',{raw:J('$raw'),launchCertain:J('$ctx.launchCertain')});
 pass('LaunchUncertain',`{'attemptEnd':$ctx.C,'launchObservedEnd':${now},'launchCertain':false,'qualificationFailed':true,'issues':${pushIssue(issue('launch-uncertain',`{'error':${errSummary('$callError')}}`))}}`,'StartScan');
 // ---- bounded discovery + containment dispatcher ---------------------------------------
 pass('StartScan',`{'mode':0,'pages':0,'nextToken':null,'tokens':[],'completeModes':[],'queue':${array(`$distinct($append($append($ctx.direct,${ownedArns}),${overflowArns}))`)},'polls':$ctx.polls+1}`,'LoopGate');
 choice('LoopGate',[
  [`${now}>=$ctx.C or $ctx.polls>${LIMITS.polls} or $ctx.calls>=${LIMITS.calls} or $not(${byteBound('$ctx',LIMITS.ctxBytes)})`,'SelectContainOrUnknown'],
  [`${containment} and ${pendingCount}>0`,'SelectOwned'],
  ['$ctx.mode<3','PageGate'],
  ['$count($ctx.queue)>0','PickCandidate'],
  [`${containment} and ${unconfirmedCount}>0`,'SelectConfirm'],
  [`${boundCount}>0 and ${pendingCount}=0 and ${unconfirmedCount}=0 and $ctx.launchCertain and $count($ctx.completeModes)=3 and $not($ctx.hold)`,'PrepareFinal']
 ],'PollWait');
 choice('SelectContainOrUnknown',[[`${now}<$ctx.C-2000 and ${pendingCount}>0`,'SelectOwned']],'FinalUnknown');
 choice('PageGate',[[`$ctx.pages>=${LIMITS.pages}`,'DiscoveryError'],['$ctx.nextToken=null','PrepareListFirst']],'PrepareListNext');
 prepare('PrepareListFirst','list','ListFirst');prepare('PrepareListNext','list','ListNext');
 const listArgs=`$merge([{'Cluster':${lit(p.clusterArn)},'MaxResults':10},$ctx.mode=0?{'StartedBy':$ctx.run.uuid}:{'DesiredStatus':$ctx.mode=1?'RUNNING':'STOPPED'}])`;
 task('ListFirst','ecs:listTasks',J(listArgs),'ListShape','DiscoveryError');task('ListNext','ecs:listTasks',J(`$merge([${listArgs},{'NextToken':$ctx.nextToken}])`),'ListShape','DiscoveryError');
 const validArns=`$count($filter($raw.taskArns,function($a){${taskArnTest('$a')}}))=$count($raw.taskArns)`;
 choice('ListShape',[[`$type($raw)='object' and $type($raw.taskArns)='array' and $count($raw.taskArns)<=10 and (${validArns}) and ($not($exists($raw.nextToken)) or ($type($raw.nextToken)='string' and $length($raw.nextToken)>0 and $length($raw.nextToken)<=${LIMITS.tokenChars} and $not($raw.nextToken in $ctx.tokens))) and $count($distinct($append($ctx.allArns,$raw.taskArns)))<=${LIMITS.candidates}`,'RetainPage']],'DiscoveryError');
 pass('RetainPage',`{'queue':${array('$distinct($append($ctx.queue,$raw.taskArns))')},'allArns':${array('$distinct($append($ctx.allArns,$raw.taskArns))')},'pages':$ctx.pages+1,'nextToken':$exists($raw.nextToken)?$raw.nextToken:null,'tokens':$exists($raw.nextToken)?$append($ctx.tokens,$raw.nextToken):$ctx.tokens}`,'PageRecord');record('PageRecord','DISCOVERY_PAGE','PageComplete',{mode:J('$ctx.mode'),page:J('$ctx.pages'),raw:J('$raw')});
 choice('PageComplete',[['$ctx.nextToken=null','NextInventory']],'LoopGate');pass('NextInventory',"{'completeModes':$append($ctx.completeModes,$ctx.mode),'mode':$ctx.mode+1,'pages':0,'tokens':[],'nextToken':null}",'LoopGate');
 pass('DiscoveryError',`{'hold':true,'qualificationFailed':true,'mode':3,'issues':${pushIssue(issue('discovery-incomplete',`{'operation':$ctx.operation,'error':${errSummary('$callError')}}`))}}`,'LoopGate');
 pass('PickCandidate',"{'currentArn':$ctx.queue[0],'queue':$append([],$filter($ctx.queue,function($a,$i){$i>0})),'current':null,'eni':null,'taskReady':false,'stopMode':false,'calls':$ctx.calls+1,'operation':'describe-candidate'}",'DescribeCandidate');
 const describeArgs={Cluster:p.clusterArn,Tasks:J('[$ctx.currentArn]'),Include:['TAGS']};
 task('DescribeCandidate','ecs:describeTasks',describeArgs,'CandidateCoverage','CandidateError','$ctx.C',true);
 choice('CandidateCoverage',[[`(${coverage}) and (${safeRaw})`,'RetainCandidate']],'CandidateError');pass('RetainCandidate',`{'current':${retainTask('$raw.tasks[0]')}}`,'OwnershipGate');
 choice('OwnershipGate',[[`$count($filter($append(${ownedArns},${overflowArns}),function($a){$a=$ctx.currentArn}))>0`,'EvaluateTask'],[ownership,'OwnedCapacity']],'ForeignOrAmbiguous');
 choice('OwnedCapacity',[[`$count($ctx.owned)<${LIMITS.owned}`,'BindOwned'],[`$count($ctx.overflow)<${LIMITS.overflow}`,'BindOverflow']],'OverflowExhausted');
 pass('BindOwned',`{'owned':$append($ctx.owned,${ownedRecord()}),'qualificationFailed':$ctx.qualificationFailed or $count($ctx.owned)>0}`,'OwnershipRecord');
 pass('BindOverflow',`{'overflow':$append($ctx.overflow,${ownedRecord()}),'qualificationFailed':true,'issues':${pushIssue(issue('owned-overflow',`{'arn':$ctx.currentArn,'overflowCount':$count($ctx.overflow)+1}`))}}`,'OwnershipRecord');
 pass('OverflowExhausted',`{'hold':true,'qualificationFailed':true,'overflowExhausted':true,'issues':${pushIssue(issue('owned-capacity-exhausted',`{'arn':$ctx.currentArn,'maxPositive':${LIMITS.owned+LIMITS.overflow}}`))}}`,'SelectContainOrUnknown');
 record('OwnershipRecord','OWNERSHIP','EvaluateTask',{task:J('$ctx.current'),createdMs:J('$createdMs'),direct:J('$ctx.currentArn in $ctx.direct')});
 pass('ForeignOrAmbiguous',`{'hold':true,'issues':${pushIssue(issue('foreign-or-ambiguous',`{'arn':$ctx.currentArn}`))}}`,'LoopGate');
 pass('CandidateError',`{'hold':true,'issues':${pushIssue(issue('candidate-read',`{'arn':$ctx.currentArn,'error':${errSummary('$callError')}}`))}}`,'LoopGate');
 // ---- per-task security + three-way attachment classification ---------------------------
 pass('EvaluateTask',`{'qualificationFailed':$ctx.qualificationFailed or (${mismatch}),'taskReady':(${ready})}`,'ExtractENI');
 choice('ExtractENI',[[`${now}<$ctx.C-2000 and (${attachmentsCompatible})`,'PrepareENI'],[`${attachmentsContradictory}`,'ENIContradiction']],'NetworkUnknown');
 prepare('PrepareENI','eni','DescribeENI');task('DescribeENI','ec2:describeNetworkInterfaces',{NetworkInterfaceIds:J(`[${eniIdExpr}]`)},'ENIShape','NetworkUnknown');
 choice('ENIShape',[[eniGood,'RetainENI']],'ENIMismatch');
 pass('RetainENI',`{'eni':{'status':'OK','id':${eniIdExpr},'subnetId':${lit(p.network.subnetId)},'privateIp':${eniIpExpr},'az':$ctx.current.availabilityZone},${mapLedger(`{'qualifiedSeen':$o.qualifiedSeen or $ctx.taskReady,'netId':$o.netId?$o.netId:${eniIdExpr},'netIp':$o.netIp?$o.netIp:${eniIpExpr}}`)}}`,'ObservedRecord');
 pass('ENIMismatch',`{'qualificationFailed':true,'eni':{'status':'MISMATCH'},'issues':${pushIssue(issue('eni-mismatch',`{'arn':$ctx.currentArn}`))}}`,'ObservedRecord');
 pass('ENIContradiction',`{'qualificationFailed':true,'eni':{'status':'CONTRADICTORY'},'issues':${pushIssue(issue('eni-contradictory',`{'arn':$ctx.currentArn}`))}}`,'ObservedRecord');
 pass('NetworkUnknown',`{'eni':{'status':'UNAVAILABLE'},'issues':${pushIssue(issue('eni-unavailable',`{'arn':$ctx.currentArn}`))}}`,'ObservedRecord');
 record('ObservedRecord','TASK_AND_ENI','AfterObservation',{task:J('$ctx.current'),eni:J('$ctx.eni'),qualificationFailed:J('$ctx.qualificationFailed')});
 choice('AfterObservation',[['$ctx.stopMode','PrepareStopIdentity'],[terminal,'RetainTerminal'],[`${containment}`,'SelectOwned']],'LoopGate');
 // ---- bounded stop dispatch: every positive identity gets one scoped attempt -------------
 pass('SelectOwned',`{'currentArn':${pendingAll}[0].arn,'current':null,'eni':null,'stopMode':true,'finalMode':false}`,'StopBudget');
 choice('StopBudget',[[`${now}<$ctx.C-2000 and $exists($ctx.currentArn)`,'PreparePreStopDescribe']],'FinalUnknown');
 prepare('PreparePreStopDescribe','prestop-describe','PreStopDescribe');task('PreStopDescribe','ecs:describeTasks',describeArgs,'PreStopCoverage','PreStopReadUnknown','$ctx.C',true);
 choice('PreStopCoverage',[[`(${coverage}) and (${safeRaw})`,'RetainPreStop']],'PreStopReadUnknown');pass('RetainPreStop',`{'current':${retainTask('$raw.tasks[0]')}}`,'PreStopTerminal');
 choice('PreStopTerminal',[[terminal,'RetainTerminal']],'EvaluateTask');
 pass('PreStopReadUnknown',`{'current':${currentOwned},'eni':{'status':'FRESH_READ_UNAVAILABLE'},'qualificationFailed':true,'hold':true,'issues':${pushIssue(issue('prestop-read',`{'arn':$ctx.currentArn,'error':${errSummary('$callError')}}`))}}`,'PrepareStopIdentity');
 prepare('PrepareStopIdentity','stop-identity','StopIdentity');task('StopIdentity','sts:getCallerIdentity',{},'CheckStopIdentity','FinalUnknown');
 choice('CheckStopIdentity',[[`${identity} and ${now}<$ctx.C-1000 and $count(${pendingAll}[arn=$ctx.currentArn])=1`,'MarkStopAttempt']],'FinalUnknown');
 pass('MarkStopAttempt',`{${mapLedger("{'stopAttempted':true}")},'calls':$ctx.calls+1,'operation':'stop','qualificationFailed':$ctx.qualificationFailed or ${now}>=$ctx.D}`,'PreStopRecord');
 record('PreStopRecord','PRE_STOP_PROVENANCE','StopOwned',{target:J('$ctx.currentArn'),original:J(currentOwned),freshTask:J('$ctx.current'),eni:J('$ctx.eni'),identity:J('$raw'),qualificationFailed:J('$ctx.qualificationFailed'),hold:J('$ctx.hold')});
 task('StopOwned','ecs:stopTask',{Cluster:p.clusterArn,Task:J('$ctx.currentArn'),Reason:J("'Meri isolated qualification containment ' & $ctx.run.uuid")},'RecordStopTiming','RecordStopTiming');
 pass('RecordStopTiming',`{'qualificationFailed':$ctx.qualificationFailed or $enteredMs>=$ctx.D}`,'StopResultRecord');
 record('StopResultRecord','STOP_RESULT','LoopGate',{target:J('$ctx.currentArn'),ok:J('$callOk'),error:J('$callError')});
 // ---- bounded round-robin terminal confirmation (acknowledgement is never STOPPED) -------
 choice('SelectConfirm',[[`${unconfirmedCount}>0`,'PickConfirm']],'LoopGate');
 pass('PickConfirm',`($u:=${unconfirmedAll};$m:=$min($u.probeSeq);{'currentArn':$u[probeSeq=$m][0].arn,'current':null,'eni':null,'stopMode':false,'finalMode':false})`,'PrepareTerminal');
 choice('PrepareTerminal',[[`${now}<$ctx.C-1000 and $ctx.calls<${LIMITS.terminalCalls}`,'CountTerminal']],'FinalUnknown');prepare('CountTerminal','terminal-describe','TerminalDescribe');
 task('TerminalDescribe','ecs:describeTasks',describeArgs,'TerminalCoverage','TerminalReadUnknown','$ctx.C',true);
 choice('TerminalCoverage',[[`(${coverage}) and (${safeRaw})`,'RetainFreshTerminal']],'TerminalReadUnknown');pass('RetainFreshTerminal',`{'current':${retainTask('$raw.tasks[0]')}}`,'TerminalGate');
 choice('TerminalGate',[[`(${terminal}) and $observedMs<$ctx.C`,'RetainTerminal']],'TerminalWaitRoute');
 pass('TerminalReadUnknown',`{'hold':true,'issues':${pushIssue(issue('terminal-read',`{'arn':$ctx.currentArn,'error':${errSummary('$callError')}}`))}}`,'TerminalWaitRoute');
 pass('RetainTerminal',`{${mapLedger("{'terminal':true,'terminalAt':$observedMs}")},'qualificationFailed':$ctx.qualificationFailed or ${worker}.exitCode!=0 or $not(${currentOwned}.qualifiedSeen) or (${mismatch})}`,'TerminalRecord');
 record('TerminalRecord','TERMINAL','AfterTerminal',{target:J('$ctx.currentArn'),task:J('$ctx.current'),observedMs:J('$observedMs'),original:J(currentOwned)});
 choice('AfterTerminal',[['$ctx.finalMode','NextFinal']],'LoopGate');
 choice('TerminalWaitRoute',[['$ctx.finalMode','PrepareTerminal']],'WaitTerminal');states.WaitTerminal={Type:'Wait',Timestamp:J(`$fromMillis($min([${now}+8000,$ctx.C-1000]))`),Next:'BumpProbe'};
 pass('BumpProbe',`{${mapLedger("{'probeSeq':$o.probeSeq+1}")}}`,'LoopGate');
 choice('PollWait',[[`${now}<$ctx.C-1000`,'WaitScan']],'FinalUnknown');states.WaitScan={Type:'Wait',Timestamp:J(`$fromMillis($min([${now}+8000,$ctx.C-1000]))`),Next:'StartScan'};
 // ---- explicit finite verdict ----------------------------------------------------------
 pass('PrepareFinal',`{'finalQueue':${array(boundArns)},'finalMode':true,'stopMode':false}`,'NextFinal');
 choice('NextFinal',[['$count($ctx.finalQueue)>0','PickFinal']],'FinalGate');
 pass('PickFinal',"{'currentArn':$ctx.finalQueue[0],'finalQueue':$append([],$filter($ctx.finalQueue,function($a,$i){$i>0})),'current':null}",'PrepareTerminal');
 choice('FinalGate',[[`${boundCount}>0 and ${pendingCount}=0 and ${unconfirmedCount}=0 and ${notTerminalCount}=0 and $ctx.launchCertain and $not($ctx.hold) and $count($ctx.completeModes)=3 and ${now}<$ctx.C`,'FinalConfirmed']],'FinalUnknown');
 states.FinalConfirmed={Type:'Succeed',Output:{cleanup:'STOPPED_CONFIRMED',qualification:J("$ctx.qualificationFailed?'FAILED':'RUNTIME_CHECKS_ONLY_NOT_NATIVE_ACCEPTED'"),run:J('$ctx.run'),D:J('$ctx.D'),C:J('$ctx.C'),ledger:J('$ctx.owned'),overflowLedger:J('$ctx.overflow'),staticBindingId:binding.staticBindingId}};
 states.FinalUnknown={Type:'Succeed',Output:{cleanup:'CLEANUP_UNKNOWN',qualification:'NOT_ACCEPTED',run:J('$ctx.run'),D:J('$ctx.D'),C:J('$ctx.C'),ledger:J('$ctx.owned'),overflowLedger:J('$ctx.overflow'),overflowExhausted:J('$ctx.overflowExhausted'),issues:J('$ctx.issues'),staticBindingId:binding.staticBindingId}};
 return {Comment:'INERT preparation; explicit evidence verdict required, no universal finally',QueryLanguage:'JSONata',StartAt:'GuardInput',States:states};
}
