/** P0 log-only observability. Pure synthesis: no AWS lookups, credentials or app-stack changes. */
import {App,Stack,BootstraplessSynthesizer,CfnParameter,CfnCondition,Fn,aws_logs as logs,aws_cloudwatch as cloudwatch,aws_sns as sns} from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';

export const OBSERVABILITY_SERVICES=Object.freeze(['control','worker']);
const fail=()=>{throw Error('OBSERVABILITY_CONFIGURATION');};
export function telemetryEnvironment(raw){
 if(raw===undefined)return 'Preview';
 if(raw===null||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==1||
    !Object.hasOwn(raw,'environment')||!['Preview','Production'].includes(raw.environment))fail();
 return raw.environment;
}
function bindingOf(raw){
 if(raw===null||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['logGroups','environment','alarmEmail'].includes(k)))fail();
 const environment=raw.environment===undefined?'Preview':raw.environment;
 telemetryEnvironment({environment});
 const groups=raw.logGroups;
 if(groups===null||typeof groups!=='object'||Array.isArray(groups)||Object.keys(groups).length!==OBSERVABILITY_SERVICES.length||
    OBSERVABILITY_SERVICES.some(k=>typeof groups[k]!=='string'||!/^[.\-_/#A-Za-z0-9]{1,512}$/u.test(groups[k]))||
    new Set(Object.values(groups)).size!==OBSERVABILITY_SERVICES.length)fail();
 const alarmEmail=raw.alarmEmail??'';
 if(typeof alarmEmail!=='string'||(alarmEmail!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(alarmEmail))||alarmEmail.length>254)fail();
 return {environment,logGroups:groups,alarmEmail};
}

export function observabilityBindingFromDeployment(deployment,{environment,alarmEmail}={}){
 const logGroups=Object.fromEntries(OBSERVABILITY_SERVICES.map(service=>[service,deployment?.foundation?.[`${service[0].toUpperCase()}${service.slice(1)}LogGroupName`]]));
 return bindingOf({logGroups,environment:environment??telemetryEnvironment(deployment?.telemetry),...(alarmEmail===undefined?{}:{alarmEmail})});
}

/** CloudFormation metric arrays deliberately name exact emitted dimension sets: CloudWatch does not aggregate them. */
export function synthesizeFirstChatObservability(raw){
 const b=bindingOf(raw),prefix=`meri-${b.environment.toLowerCase()}`,namespace=`Meri/${b.environment}`;
 const app=new App({context:{'aws:cdk:version-reporting':false}});
 const stack=new Stack(app,'MeriFirstChatObservability',{synthesizer:new BootstraplessSynthesizer(),
  description:'Meri control and Temporal worker observability using existing logs and emitted turn metrics; no application or log-group mutations.'});
 stack.templateOptions.metadata={AWSToolsMetrics:{AWSAgentToolkit:'aws-cloudformation@3'}};
 const topic=new sns.CfnTopic(stack,'AlarmsTopic',{topicName:`${prefix}-alarms`});
 const email=new CfnParameter(stack,'AlarmEmail',{type:'String',default:b.alarmEmail,maxLength:254,
  allowedPattern:'^$|^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',description:'Optional alarm recipient; confirm the SNS email after deployment.'});
 const subscribe=new CfnCondition(stack,'HasAlarmEmail',{expression:Fn.conditionNot(Fn.conditionEquals(email.valueAsString,''))});
 const subscription=new sns.CfnSubscription(stack,'AlarmEmailSubscription',{protocol:'email',endpoint:email.valueAsString,topicArn:topic.ref});
 subscription.cfnOptions.condition=subscribe;
 const filters=[
  ['ControlUnavailable','control','RUNTIME_UNAVAILABLE','RuntimeUnavailable'],
  ['WorkerUnavailable','worker','RUNTIME_UNAVAILABLE','RuntimeUnavailable'],
  // Each refused action-session issuance or recheck (session/owner.mjs): step and owned code only, rate-limited at the source.
  ['ControlSessionRefused','control','CONTROL_SESSION_REFUSED','ControlSessionRefusals'],
  ['ControlSessionDiagnosticsSuppressed','control','CONTROL_SESSION_DIAGNOSTICS_SUPPRESSED','DiagnosticsSuppressed']
 ];
 for(const [id,service,pattern,metricName] of filters)new logs.CfnMetricFilter(stack,id,{filterName:`${prefix}-${id.replace(/[A-Z]/gu,x=>`-${x.toLowerCase()}`).slice(1)}`,
  logGroupName:b.logGroups[service],filterPattern:JSON.stringify(pattern),metricTransformations:[{metricName,metricNamespace:namespace,metricValue:'1',defaultValue:0}]});
 // Plain-text filters cannot extract static Service dimensions, and DefaultValue cannot coexist with dimensions.
 // The session suppression filter retains control provenance through its name/log group.
 const dimensions=values=>Object.entries(values).map(([name,value])=>({name,value}));
 const metric=(id,name,dims={},period=300,stat='Sum')=>({id,returnData:false,metricStat:{metric:{namespace,metricName:name,dimensions:dimensions(dims)},period,stat}});
 const expression=(id,value,returnData=false)=>({id,expression:value,returnData});
 const alarms=(id,suffix,threshold,comparisonOperator,metrics,extra={})=>new cloudwatch.CfnAlarm(stack,id,{
  alarmName:`${prefix}-${suffix}`,alarmDescription:`Meri ${b.environment} P0: ${suffix}`,alarmActions:[topic.ref],
  comparisonOperator,threshold,evaluationPeriods:1,datapointsToAlarm:1,treatMissingData:'notBreaching',metrics,...extra});
 alarms('TurnFailureRate','turn-failure-rate',20,'GreaterThanThreshold',[
  metric('completed','Turns',{Service:'control',Outcome:'completed'},1800),metric('failed','Turns',{Service:'control',Outcome:'failed'},1800),
  expression('total','completed+failed'),expression('rate','IF(total>=3,100*failed/total,0)',true)]);
 // A runner can identify a timeout while control retains the unchanged generic EXECUTION_FAILED reason.
 // Both sources gate on zero; the sum is a signal count, not a count of distinct timed-out turns.
 alarms('TimeoutFailure','timeout-failure',1,'GreaterThanOrEqualToThreshold',[
  metric('control','TimeoutFailures',{Service:'control'}),metric('runner','TimeoutFailures',{Service:'runner'}),expression('timeouts','SUM([control,runner])',true)]);
 alarms('FirstTextP95','first-text-p95',20000,'GreaterThanThreshold',[{...metric('firsttext','FirstTextMs',{Service:'control'},3600,'p95'),returnData:true}],{evaluateLowSampleCountPercentile:'evaluate'});
 const errors=['5xx','503','timeout','unanswered'],core=[];
 for(const [index,service] of ['control'].entries()){
  core.push(metric(`total${index}`,'CoreCalls',{Service:service},600));
  errors.forEach((status,i)=>core.push(metric(`e${index}${i}`,'CoreCalls',{Service:service,StatusClass:status},600)));
 }
 alarms('CoreErrorRate','core-error-rate',5,'GreaterThanThreshold',[...core,
  expression('total','total0'),expression('errors','SUM([e00,e01,e02,e03])'),
  expression('rate','IF(total>=20,100*errors/total,0)',true)],{evaluationPeriods:2,datapointsToAlarm:2});
 // Three breaching minute samples tolerate an isolated startup refusal while detecting sustained session refusal.
 // Match the plain-text control filter exactly: it emits ControlSessionRefusals without dimensions.
 alarms('SessionRefusalsSustained','session-refusals-sustained',1,'GreaterThanOrEqualToThreshold',[
  {...metric('session','ControlSessionRefusals',{},60),returnData:true}],{evaluationPeriods:3,datapointsToAlarm:3});
 alarms('TelemetryDropped','telemetry-dropped',1,'GreaterThanOrEqualToThreshold',[
  ...['control','runner'].map(service=>metric(service,'TelemetryDropped',{Service:service},900)),expression('drops','SUM([control,runner])',true)]);

 const chartMetric=(name,dims={},options={})=>[namespace,name,...Object.entries(dims).flat(),options];
 const widgets=[];
 const widget=(title,metrics,{period=300,...options}={})=>{
  const index=widgets.length;widgets.push({type:'metric',x:(index%2)*12,y:Math.floor(index/2)*6,width:12,height:6,
   properties:{title,region:stack.region,view:'timeSeries',stat:'Sum',period,metrics,...options}});
 };
 for(const [label,period] of [['1 hour',3600],['1 day',86400]])widget(`First text and result (${label})`,
  ['FirstTextMs','ResultMs'].flatMap(name=>['p50','p95'].map(stat=>chartMetric(name,{Service:'control'},{stat}))),{period});
 widget('Turns and timeout signals by source (signals may share a turn)',[
  ...['completed','failed','cancelled'].map(Outcome=>chartMetric('Turns',{Service:'control',Outcome})),
  chartMetric('TimeoutFailures',{Service:'control'},{label:'Control timeout signals'}),chartMetric('TimeoutFailures',{Service:'runner'},{label:'Runner timeout signals'})]);
 const callsPerTurn=['completed','failed','cancelled'].map((Outcome,i)=>chartMetric('Turns',{Service:'control',Outcome},{id:`turn${i}`,visible:false}));
 callsPerTurn.push([{expression:'SUM([turn0,turn1,turn2])',id:'turns',visible:false}]);
 for(const [s,Service] of ['control'].entries())for(const [m,name] of ['CoreCalls','ClerkReadsEstimate','AwsCalls','DbStatements'].entries()){
  const id=`s${s}m${m}`,bg=`b${s}m${m}`;
  callsPerTurn.push(chartMetric(name,{Service},{id,visible:false}));
  callsPerTurn.push(chartMetric(name,{Service,Attribution:'background'},{id:bg,visible:false}));
  callsPerTurn.push([{expression:`IF(turns>0,(${id}-FILL(${bg},0))/turns,0)`,label:`${Service} ${name} / turn`}]);
 }
 widget('Calls per turn (background excluded; Clerk reads estimated)',callsPerTurn);
 widget('Runner run-owner calls and elapsed time',[chartMetric('RunOwnerCalls',{Service:'runner'},{stat:'Average'}),chartMetric('RunOwnerMs',{Service:'runner'},{stat:'Average',yAxis:'right'})]);
 const source=OBSERVABILITY_SERVICES.map(service=>`SOURCE '${b.logGroups[service]}'`).join(' | ');
 let logY=Math.ceil(widgets.length/2)*6;
 for(const [title,query] of [
  ['Turn detail',`fields @timestamp, @log, event, service, stage, atMs, firstTextMs, resultMs, state, reasonCode, timeoutClass, core, aws, db\n| filter schema = "meri.telemetry/1" and runId = "<paste runId>"\n| sort atMs asc`],
  ['Last 20 turns','filter schema = "meri.telemetry/1" and event = "meri.turn.summary"\n| sort @timestamp desc\n| limit 20']
 ]){widgets.push({type:'log',x:0,y:logY,width:24,height:6,
  properties:{title,region:stack.region,view:'table',query:`${source}\n| ${query}`}});logY+=6;}
 new cloudwatch.CfnDashboard(stack,'HotPathDashboard',{dashboardName:`${prefix}-hot-path`,dashboardBody:stack.toJsonString({widgets})});
 const template=Template.fromStack(stack).toJSON();
 for(const resource of Object.values(template.Resources))if(resource.Type==='AWS::CloudWatch::Alarm'||resource.Type==='AWS::CloudWatch::Dashboard')
  resource.Metadata={'com.aws.cloudformation.Context':{why:'Observe current turn and session behavior without a model proxy.',must:['Use exact emitted metric dimensions.','Do not mutate application or log-group resources.']}};
 return template;
}
