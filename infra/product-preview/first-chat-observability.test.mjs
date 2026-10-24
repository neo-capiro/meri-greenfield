import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {synthesizeFirstChatObservability,observabilityBindingFromDeployment,telemetryEnvironment} from './first-chat-observability.mjs';
import {main} from './render-observability.mjs';
import {createTurnTelemetry} from '../../apps/runtime/telemetry/turn-context.mjs';
import {createSessionRefusalDiagnostics} from '../../apps/control/action-host/session/owner.mjs';

const deployment=JSON.parse(await readFile(new URL('./first-chat/deployment-inputs.json',import.meta.url),'utf8'));
const binding=()=>observabilityBindingFromDeployment(deployment);
const resources=(t,type)=>Object.values(t.Resources).filter(row=>row.Type===type).map(row=>row.Properties);
const alarmMap=t=>Object.fromEntries(resources(t,'AWS::CloudWatch::Alarm').map(p=>[p.AlarmName,p]));
const metricKey=m=>[m.MetricName,Object.fromEntries((m.Dimensions??[]).map(d=>[d.Name,d.Value]))];
const resolveJson=value=>typeof value==='string'?value:value?.Ref==='AWS::Region'?'us-east-1':value?.['Fn::Join']?value['Fn::Join'][1].map(resolveJson).join(value['Fn::Join'][0]):value;

test('standalone stack has only 4 current text filters, 6 alarms, dashboard and conditional SNS; no IAM/log-group mutations',()=>{
 const t=synthesizeFirstChatObservability(binding());
 assert.deepEqual(Object.values(t.Resources).reduce((counts,r)=>({...counts,[r.Type]:(counts[r.Type]??0)+1}),{}),{
  'AWS::SNS::Topic':1,'AWS::SNS::Subscription':1,'AWS::Logs::MetricFilter':4,'AWS::CloudWatch::Alarm':6,'AWS::CloudWatch::Dashboard':1});
 assert.equal(t.Parameters.AlarmEmail.Default,'');
 const subscription=Object.values(t.Resources).find(r=>r.Type==='AWS::SNS::Subscription');
 assert.equal(subscription.Condition,'HasAlarmEmail');
 assert.deepEqual(t.Conditions.HasAlarmEmail,{'Fn::Not':[{'Fn::Equals':[{Ref:'AlarmEmail'},'']}]});
 const topic=resources(t,'AWS::SNS::Topic')[0];assert.equal(topic.TopicName,'meri-preview-alarms');
 for(const p of resources(t,'AWS::CloudWatch::Alarm'))assert.deepEqual(p.AlarmActions,[{Ref:'AlarmsTopic'}]);
});

test('filters match existing exact text vocabularies in the proper groups with zero defaults',()=>{
 const filters=resources(synthesizeFirstChatObservability(binding()),'AWS::Logs::MetricFilter');
 const actual=filters.map(p=>[p.LogGroupName,p.FilterPattern,p.MetricTransformations[0].MetricName]);
 assert.deepEqual(actual,[
  ['/meri/product-preview/control','"RUNTIME_UNAVAILABLE"','RuntimeUnavailable'],
  ['/meri/product-preview/worker','"RUNTIME_UNAVAILABLE"','RuntimeUnavailable'],
  ['/meri/product-preview/control','"CONTROL_SESSION_REFUSED"','ControlSessionRefusals'],
  ['/meri/product-preview/control','"CONTROL_SESSION_DIAGNOSTICS_SUPPRESSED"','DiagnosticsSuppressed']]);
 for(const p of filters){const m=p.MetricTransformations[0];assert.equal(m.DefaultValue,0);assert.equal(m.MetricValue,'1');assert.equal(m.MetricNamespace,'Meri/Preview');assert.equal(m.Dimensions,undefined);}
});

test('suppression filter uses the complete literal token emitted after the control session diagnostic budget fills',()=>{
 const controlLines=[],sessions=createSessionRefusalDiagnostics({write:line=>controlLines.push(line.trim()),now:()=>0,burst:1});
 for(let i=0;i<3;i++)sessions('identity',{code:'SESSION_REFUSED'});
 assert.deepEqual(controlLines,['CONTROL_SESSION_REFUSED step=identity code=SESSION_REFUSED','CONTROL_SESSION_DIAGNOSTICS_SUPPRESSED']);
 const filters=resources(synthesizeFirstChatObservability(binding()),'AWS::Logs::MetricFilter').filter(p=>p.MetricTransformations[0].MetricName==='DiagnosticsSuppressed');
 assert.deepEqual(filters.map(p=>[p.LogGroupName,JSON.parse(p.FilterPattern)]),[
  [binding().logGroups.control,controlLines[1]]]);
});

test('all six current alarm thresholds, windows, evaluation counts and missing-data semantics are pinned',()=>{
 const alarms=alarmMap(synthesizeFirstChatObservability(binding()));
 const expected={
  'turn-failure-rate':[20,'GreaterThanThreshold',1800,1],
  'timeout-failure':[1,'GreaterThanOrEqualToThreshold',300,1],
  'first-text-p95':[20000,'GreaterThanThreshold',3600,1],
  'core-error-rate':[5,'GreaterThanThreshold',600,2],
  'session-refusals-sustained':[1,'GreaterThanOrEqualToThreshold',60,3],
  'telemetry-dropped':[1,'GreaterThanOrEqualToThreshold',900,1]
 };
 assert.deepEqual(Object.keys(alarms).sort(),Object.keys(expected).map(s=>`meri-preview-${s}`).sort());
 for(const [suffix,[threshold,operator,period,evaluations]] of Object.entries(expected)){
  const p=alarms[`meri-preview-${suffix}`];assert.equal(p.Threshold,threshold);assert.equal(p.ComparisonOperator,operator);
  assert.equal(p.EvaluationPeriods,evaluations);assert.equal(p.DatapointsToAlarm,evaluations);assert.equal(p.TreatMissingData,'notBreaching');
  assert.ok(p.Metrics.filter(m=>m.MetricStat).every(m=>m.MetricStat.Period===period));
  assert.equal(p.Metrics.filter(m=>m.ReturnData===true).length,1);
  assert.ok(p.Metrics.filter(m=>m.MetricStat).length<=10,'CloudWatch alarm MetricStat limit');
 }
 assert.equal(alarms['meri-preview-first-text-p95'].Metrics[0].MetricStat.Stat,'p95');
 assert.equal(alarms['meri-preview-turn-failure-rate'].Metrics.at(-1).Expression,'IF(total>=3,100*failed/total,0)');
 const timeouts=alarms['meri-preview-timeout-failure'].Metrics;
 assert.deepEqual(timeouts.filter(m=>m.MetricStat).map(m=>metricKey(m.MetricStat.Metric)),[
  ['TimeoutFailures',{Service:'control'}],['TimeoutFailures',{Service:'runner'}]]);
 assert.equal(timeouts.at(-1).Expression,'SUM([control,runner])');
 const dropped=alarms['meri-preview-telemetry-dropped'].Metrics;
 assert.deepEqual(dropped.filter(m=>m.MetricStat).map(m=>metricKey(m.MetricStat.Metric)),
  ['control','runner'].map(Service=>['TelemetryDropped',{Service}]));
 assert.equal(dropped.at(-1).Expression,'SUM([control,runner])');
 assert.equal(alarms['meri-preview-core-error-rate'].Metrics.at(-1).Expression,'IF(total>=20,100*errors/total,0)');
 const core=alarms['meri-preview-core-error-rate'].Metrics.filter(m=>m.MetricStat).map(m=>metricKey(m.MetricStat.Metric));
 assert.deepEqual(core,['control'].flatMap(Service=>[
  ['CoreCalls',{Service}],...['5xx','503','timeout','unanswered'].map(StatusClass=>['CoreCalls',{Service,StatusClass}])]));
 assert.equal(alarms['meri-preview-core-error-rate'].Metrics.find(m=>m.Id==='errors').Expression,'SUM([e00,e01,e02,e03])');
 assert.equal(alarms['meri-preview-core-error-rate'].Metrics.find(m=>m.Id==='total').Expression,'total0');
});

test('sustained session-refusal alarm matches the emitted filter namespace and dimensions with a three-minute policy',()=>{
 for(const [environment,prefix,namespace] of [['Preview','meri-preview','Meri/Preview'],['Production','meri-production','Meri/Production']]){
  const t=synthesizeFirstChatObservability({...binding(),environment});
  const filter=resources(t,'AWS::Logs::MetricFilter').find(p=>p.FilterName===`${prefix}-control-session-refused`);
  assert.ok(filter,'control session-refusal filter exists');
  assert.equal(filter.LogGroupName,binding().logGroups.control);
  assert.equal(filter.FilterPattern,'"CONTROL_SESSION_REFUSED"');
  assert.deepEqual(filter.MetricTransformations,[{MetricName:'ControlSessionRefusals',MetricNamespace:namespace,MetricValue:'1',DefaultValue:0}]);
  const alarm=alarmMap(t)[`${prefix}-session-refusals-sustained`];
  assert.ok(alarm,'sustained session-refusal alarm exists');
  assert.deepEqual(alarm.Metrics,[{Id:'session',ReturnData:true,MetricStat:{
   Metric:{Namespace:namespace,MetricName:'ControlSessionRefusals',Dimensions:[]},Period:60,Stat:'Sum'}}]);
  assert.equal(alarm.Threshold,1);assert.equal(alarm.ComparisonOperator,'GreaterThanOrEqualToThreshold');
  assert.equal(alarm.EvaluationPeriods,3);assert.equal(alarm.DatapointsToAlarm,3);
  assert.equal(alarm.TreatMissingData,'notBreaching');
  assert.deepEqual(alarm.AlarmActions,[{Ref:'AlarmsTopic'}]);
 }
});

test('actual EMF emitter series satisfy alarm dimensions and aggregate background errors exactly once',()=>{
 const lines=[],write=line=>lines.push(JSON.parse(line));
 const binding={runId:'11111111-1111-4111-8111-111111111111',attemptId:'22222222-2222-4222-8222-222222222222',conversationId:'33333333-3333-4333-8333-333333333333'};
 const control=createTurnTelemetry({service:'control',write,now:()=>1000});
 for(const telemetry of [control]){
  for(const status of ['5xx','503','timeout','unanswered'])telemetry.recordCore('identity',status,1);
  telemetry.within(binding,()=>{for(const status of ['5xx','503','timeout','unanswered'])telemetry.recordCore('context',status,1);});
  telemetry.counters(binding,{reset:true});telemetry.rollup();
 }
 control.stage(binding,'send.admit.received',100);control.summary({binding,type:'message.delta',sequence:1,data:{}});
 control.summary({binding,type:'run.status',sequence:2,data:{state:'completed'}});
 control.summary({binding:{...binding,runId:'44444444-4444-4444-8444-444444444444'},type:'run.status',sequence:1,data:{state:'failed',reasonCode:'DEADLINE'}});
 const runner=createTurnTelemetry({service:'runner',write,now:()=>1000});
 runner.emit('meri.turn.failure',{...binding,origin:'runtime',stage:'activity',code:'DEADLINE',class:'other',timeoutClass:'deadline'});
 runner.rollup();
 const key=(namespace,name,dimensions)=>JSON.stringify([namespace,name,Object.entries(dimensions).sort()]);
 const observed=new Map();
 for(const line of lines)for(const group of line._aws.CloudWatchMetrics)for(const dimensionNames of group.Dimensions)for(const m of group.Metrics){
  const signature=key(group.Namespace,m.Name,Object.fromEntries(dimensionNames.map(name=>[name,line[name]])));
  observed.set(signature,(observed.get(signature)??0)+line[m.Name]);
 }
 const template=synthesizeFirstChatObservability(observabilityBindingFromDeployment(deployment));
 const legacy=new Set(resources(template,'AWS::Logs::MetricFilter').map(p=>p.MetricTransformations[0].MetricName));
 for(const alarm of resources(template,'AWS::CloudWatch::Alarm'))for(const row of alarm.Metrics){
  const metric=row.MetricStat?.Metric;if(!metric||legacy.has(metric.MetricName))continue;
  const signature=key(metric.Namespace,metric.MetricName,Object.fromEntries(metric.Dimensions.map(d=>[d.Name,d.Value])));
  assert.ok(observed.has(signature),`${alarm.AlarmName}: ${signature} must be emitted by production schema`);
 }
 for(const Service of ['control']){
  assert.equal(observed.get(key('Meri/Preview','CoreCalls',{Service})),8);
  assert.equal(observed.get(key('Meri/Preview','CoreCalls',{Service,Attribution:'background'})),4);
  for(const StatusClass of ['5xx','503','timeout','unanswered'])assert.equal(observed.get(key('Meri/Preview','CoreCalls',{Service,StatusClass})),2);
 }
 assert.equal(observed.get(key('Meri/Preview','TimeoutFailures',{Service:'runner'})),1);
});

test('a runner writer failure becomes a positive sample in the alarm series when the runner closes',()=>{
 const lines=[];let refuseWrite=true;
 const runner=createTurnTelemetry({service:'runner',now:()=>1000,write:line=>{if(refuseWrite)throw Error('synthetic writer unavailable');lines.push(JSON.parse(line));}});
 assert.equal(runner.emit('meri.turn.failure',{origin:'runtime',stage:'activity',code:'DEADLINE',timeoutClass:'deadline'}),false);
 refuseWrite=false;runner.close();
 assert.equal(lines.length,1);const line=lines[0];
 assert.equal(line.event,'meri.process.rollup');assert.equal(line.TelemetryDropped,1);
 const alarm=alarmMap(synthesizeFirstChatObservability(binding()))['meri-preview-telemetry-dropped'];
 const metric=alarm.Metrics.find(m=>m.Id==='runner').MetricStat.Metric;
 assert.ok(line._aws.CloudWatchMetrics.some(group=>group.Namespace===metric.Namespace&&group.Metrics.some(m=>m.Name===metric.MetricName)&&
  group.Dimensions.some(names=>JSON.stringify(names)===JSON.stringify(metric.Dimensions.map(d=>d.Name)))));
 assert.equal(line.Service,metric.Dimensions[0].Value);
 assert.equal(alarm.Threshold,1);assert.equal(alarm.ComparisonOperator,'GreaterThanOrEqualToThreshold');
});

test('dashboard consumes current metric dimensions and its Logs Insights widgets span only control and worker groups',()=>{
 const d=resources(synthesizeFirstChatObservability(binding()),'AWS::CloudWatch::Dashboard')[0];
 assert.equal(d.DashboardName,'meri-preview-hot-path');const {widgets}=JSON.parse(resolveJson(d.DashboardBody));
 const logs=widgets.filter(w=>w.type==='log');assert.equal(logs.length,2);
 assert.deepEqual(Object.keys(binding().logGroups),['control','worker']);
 assert.doesNotMatch(JSON.stringify(widgets),/Service","(?:owner|proxy)"|product-preview\/(?:owner|proxy|runner)|OwnerExchanges|BudgetQuarantines|ProxyPairRefusals/u);
 for(const w of logs)for(const group of Object.values(binding().logGroups))assert.ok(w.properties.query.includes(`SOURCE '${group}'`));
 assert.ok(logs[0].properties.query.includes('runId = "<paste runId>"'));assert.ok(logs[1].properties.query.includes('limit 20'));
 const first=widgets.filter(w=>w.properties.title.startsWith('First text'));assert.deepEqual(first.map(w=>w.properties.period),[3600,86400]);
 for(const w of first)assert.deepEqual(w.properties.metrics.map(m=>m.at(-1).stat),['p50','p95','p50','p95']);
 const calls=widgets.find(w=>w.properties.title.startsWith('Calls per turn'));
 assert.ok(calls.properties.metrics.some(m=>m[0]?.expression?.includes('-FILL(')),'background counts excluded from turn ratios');
 assert.ok(calls.properties.title.includes('estimated'));
 const timeouts=widgets.find(w=>w.properties.title.includes('timeout signals'));
 assert.ok(timeouts.properties.title.includes('may share a turn'));
 assert.deepEqual(timeouts.properties.metrics.slice(-2).map(m=>m.at(-1).label),['Control timeout signals','Runner timeout signals']);
});

test('Production separates names and namespaces; an email is only a parameter default and remains conditional',()=>{
 const t=synthesizeFirstChatObservability({...binding(),environment:'Production',alarmEmail:'synthetic@example.invalid'});
 assert.equal(resources(t,'AWS::SNS::Topic')[0].TopicName,'meri-production-alarms');assert.equal(t.Parameters.AlarmEmail.Default,'synthetic@example.invalid');
 assert.ok(resources(t,'AWS::CloudWatch::Alarm').every(p=>p.AlarmName.startsWith('meri-production-')));
 assert.ok(resources(t,'AWS::Logs::MetricFilter').every(p=>p.MetricTransformations[0].MetricNamespace==='Meri/Production'));
});

test('only absent environment defaults; invalid labels, groups and email refuse before synthesis',()=>{
 assert.equal(telemetryEnvironment(undefined),'Preview');
 assert.equal(observabilityBindingFromDeployment({...deployment,telemetry:{environment:'Production'}}).environment,'Production');
 for(const raw of [null,{},'Preview',{environment:'preview'},{environment:'Production',enabled:true}])assert.throws(()=>telemetryEnvironment(raw),/OBSERVABILITY_CONFIGURATION/);
 for(const change of [b=>{b.environment=null;},b=>{b.extra=true;},b=>{b.logGroups.control='*';},b=>{b.logGroups.worker=b.logGroups.control;},b=>{delete b.logGroups.worker;},b=>{b.logGroups.owner='/retired/owner';},b=>{b.logGroups.proxy='/retired/proxy';},b=>{b.logGroups.runner='/retired/runner';},b=>{b.alarmEmail='x\n@example.test';}]){
  const b=binding();change(b);assert.throws(()=>synthesizeFirstChatObservability(b),/OBSERVABILITY_CONFIGURATION/);
 }
});

test('CLI help and invalid flags are bounded without reading files; malformed input does not emit a partial template',async()=>{
 let reads=0,stdout='',stderr='';const ports={read:async()=>{reads++;return '{}';},write:s=>{stdout+=s;},error:s=>{stderr+=s;}};
 assert.equal(await main(['--help'],ports),0);assert.equal(reads,0);assert.match(stdout,/No AWS access/);
 stdout='';assert.equal(await main(['--environment','unknown'],ports),2);assert.equal(reads,0);
 assert.equal(await main(['--deployment-inputs'],ports),2);assert.equal(reads,0);
 assert.equal(await main([],ports),2);assert.equal(reads,1);assert.equal(stdout,'');assert.match(stderr,/OBSERVABILITY_CONFIGURATION/);
 const child=spawnSync(process.execPath,[fileURLToPath(new URL('./render-observability.mjs',import.meta.url)),'--help'],{encoding:'utf8',timeout:10000});
 assert.equal(child.status,0);assert.equal(child.stderr,'');assert.match(child.stdout,/Exit codes/);
});

test('committed template equals the default offline renderer and pure synthesis',async()=>{
 const committed=JSON.parse(await readFile(new URL('./first-chat/observability.template.json',import.meta.url),'utf8'));
 assert.deepEqual(committed,synthesizeFirstChatObservability(binding()));
 let output='';assert.equal(await main([],{write:s=>{output+=s;}}),0);assert.deepEqual(JSON.parse(output),committed);
});
