/** Log-only production telemetry. This module has no exporter, timer or import-time side effects.
 * Every event is rebuilt from a closed schema; arbitrary objects never reach JSON.stringify.
 * meri.core.counters is a bounded metric-only companion (at most nine status classes) because
 * one EMF root cannot hold multiple values of CoreCalls under different StatusClass dimensions.
 */
import {TELEMETRY_CODES} from './turn-vocabulary.mjs';
const codeVocabulary=new Set(TELEMETRY_CODES);

export const STAGES = Object.freeze(['send.admit.received','send.submit.accepted','run.starting','run.running',
  'runner.process.start','runner.load.done','runner.query.start','delta.first.durable','run.terminal']);
export const CORE_ROUTES = Object.freeze(['identity','context','membership','current','other']);
export const STATUS_CLASSES = Object.freeze(['2xx','401','403','409','4xx','503','5xx','timeout','unanswered']);
export const AWS_OPERATIONS = Object.freeze(['DescribeTasks','ListTasks','DescribeServices','DescribeClusters',
  'DescribeTaskDefinition','DescribeNetworkInterfaces','DescribeInstances','DescribeSecurityGroups','DescribeSubnets',
  'DescribeVpcs','DescribeTags','ListTagsForResource','RunTask','StopTask','InvokeModel','InvokeModelWithResponseStream',
  'Converse','ConverseStream','other']);
export const RUN_OWNER_OPERATIONS = Object.freeze(['runner/load','runner/publish','runner/next-controls',
  'runner/native/bootstrap','runner/native/admitted','runner/native/prepare','runner/native/verify','runner/native/start','runner/native/started',
  'runner/runtime','runner/checkpoint/capture',
  'runner/claim-control','runner/ack-control','runner/record-checkpoint','runner/checkpoint/complete',
  'runner/checkpoint/pause','runner/session/load','runner/session/list','runner/session/append',
  'runner/session/register','runner/complete','runner/reserve-next','other']);
const SERVICES=['control','runner','owner','proxy'],OUTCOMES=['completed','refused','failed','cancelled','success','error','timeout','unanswered','other'];
const COMPONENTS=['bootstrap','pending-work','owner-gate','pair','service-gate','facts','credential-delivery','currentness','owner','proxy','other'];
export const DIAGNOSTIC_STAGES=Object.freeze(['module-import','runner-preflight','capability-load','binding-bootstrap','remote-module-import','admission-wait','activity',
 'runtime-prepare','runtime-admission','sdk-session','sdk-directories','skill-plugin','bash-facts','runner-cleanup','activity-input','activity-load',
 'activity-policy','activity-setup','activity-starting','activity-running','activity-query','activity-stream','activity-output','activity-result',
 'activity-finalize','activity-complete','activity-terminal','activity-cleanup','remote-config','remote-tls','remote-clients','remote-worker',
 'remote-listen','kickoff-wait','remote-cleanup',
 'agentcore-input','agentcore-admission','agentcore-workspace','agentcore-clients','agentcore-assemble','agentcore-cleanup','agentcore-reconcile','agentcore-settle',
 'agentcore-config','agentcore-transport','agentcore-listen','agentcore-shutdown',
 'worker-material','worker-readiness','worker-connect','worker-create','worker-run','worker-listen','worker-cleanup']);
const SIGNALS=['none','SIGABRT','SIGALRM','SIGBUS','SIGFPE','SIGHUP','SIGILL','SIGINT','SIGKILL','SIGPIPE','SIGQUIT','SIGSEGV','SIGSYS','SIGTERM',
 'SIGTRAP','SIGUSR1','SIGUSR2','SIGXCPU','SIGXFSZ'];
const TIMEOUTS=['none','deadline','transport-timeout','upstream-unavailable'];
const ID=/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/iu;
const CODE=/^[A-Za-z0-9_.:-]{1,64}$/u;
export const safeId=value=>typeof value==='string'&&ID.test(value)?value:'invalid';
export const safeCode=value=>typeof value==='string'&&CODE.test(value)&&(codeVocabulary.has(value)||['none','other'].includes(value))?value:'other';
const choice=(values,fallback='other')=>value=>values.includes(value)?value:fallback;
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER?value:0;
const nullable=value=>value===null||value===undefined?null:number(value);
const dictionary=(keys,clean)=>value=>Object.fromEntries(keys.filter(k=>Object.hasOwn(value??{},k)).map(k=>[k,clean(value[k])]));
const statusCounts=dictionary(STATUS_CLASSES,number);
const core=dictionary(CORE_ROUTES,statusCounts),aws=dictionary(AWS_OPERATIONS,dictionary(OUTCOMES,number));
const exchanges=dictionary(['operation','capture','admission'],dictionary(['OPEN','OPERATION','POLL','REPLY'],number));
const db=value=>({statements:number(value?.statements),ms:number(value?.ms)});
const COMMON={service:choice(SERVICES),runId:safeId,attemptId:safeId,atMs:number};
const COUNTERS={core,coreMs:number,clerkReadsEstimate:number,authorityFresh:number,authorityReuses:number,aws,awsMs:number,db,runOwner:dictionary(RUN_OWNER_OPERATIONS,statusCounts),runOwnerMs:number};
export const LINE_SCHEMAS=Object.freeze({
 'meri.turn.stage':{...COMMON,stage:choice(STAGES)},
 'meri.turn.settlement':{...COMMON,state:choice(['completed','failed','cancelled','paused','waiting-for-approval']),sdkCleanup:choice(['closed'],'unknown')},
 'meri.turn.summary':{...COMMON,conversationId:safeId,state:choice(['completed','failed','cancelled']),reasonCode:safeCode,
   t0Ms:nullable,stages:dictionary(STAGES,number),firstTextMs:nullable,resultMs:nullable,deltaPublications:number,timeoutClass:choice(TIMEOUTS,'none')},
 'meri.turn.counters':{...COMMON,requestId:safeId,...COUNTERS},
 'meri.core.counters':{...COMMON,statusClass:choice(STATUS_CLASSES,'unanswered'),count:number,attribution:choice(['background','turn'])},
 'meri.turn.failure':{...COMMON,origin:choice(['runtime','sdk-prepare','native-prepare','native-start']),stage:choice(DIAGNOSTIC_STAGES),
   code:safeCode,class:safeCode,exit:value=>['string','number'].includes(typeof value)&&Number.isInteger(Number(value))&&/^(?:0|[1-9][0-9]{0,2})$/u.test(String(value))&&Number(value)<=255?String(value):'none',
   signal:choice(SIGNALS,'none'),cause:safeCode,msgHash:value=>typeof value==='string'&&/^[a-f0-9]{12}$/u.test(value)?value:'none',timeoutClass:choice(TIMEOUTS,'none')},
 'meri.model.request':{...COMMON,requestId:safeId,outcome:choice(['completed','refused','failed','cancelled']),
   refusal:value=>({gate:choice(['pair','exchange','ingress','admission','reserve','settle','bootstrap','owner','request','other'])(value?.gate),step:safeCode(value?.step),code:safeCode(value?.code)}),
   bootstrapMs:nullable,bedrockHeadersMs:nullable,firstChunkMs:nullable,streamEndMs:nullable,settleMs:nullable,
   ownerExchanges:exchanges,ownerExchangeMs:number,aws,awsMs:number,inputTokens:number,outputTokens:number},
 'meri.health':{service:choice(SERVICES),atMs:number,component:choice(COMPONENTS),transition:choice(['quarantined','poisoned','retired','unavailable','reproven']),code:safeCode},
 'meri.budget.quarantined':{...COMMON,reason:safeCode},
 'meri.process.rollup':{service:choice(SERVICES),atMs:number,windowMs:number,...COUNTERS,ownerExchanges:exchanges,telemetryDropped:number},
});
for(const schema of Object.values(LINE_SCHEMAS))Object.freeze(schema);

export function timeoutClass(...values){
 const codes=values.flat().filter(v=>typeof v==='string'||typeof v==='number').map(String);
 if(codes.some(c=>['DEADLINE','RUNTIME_STARTUP_TIMEOUT','RUNTIME_SHUTDOWN_TIMEOUT','PRODUCT_OWNER_STARTUP_TIMEOUT'].includes(c)))return 'deadline';
 if(codes.some(c=>['PINNED_NATIVE_TIMEOUT','REMOTE_RUNNER_CLEANUP_UNKNOWN','SDK_CLEANUP_UNKNOWN'].includes(c)))return 'transport-timeout';
 if(codes.some(c=>['NATIVE_UNAVAILABLE','PINNED_NATIVE_STATUS_503','503','timeout','unanswered'].includes(c)))return 'upstream-unavailable';
 return 'none';
}

const sum=value=>Object.values(value??{}).reduce((n,v)=>n+(typeof v==='number'?v:sum(v)),0);
/** All metric names and dimension sets are derived here; callers cannot inject metric metadata. */
function metricsFor(event,line){
 const groups=[];
 const add=(name,value,unit='Count',dimensions=[['Service']])=>{if(value===null||value===undefined)return;
   line[name]=number(value);groups.push({Dimensions:dimensions,Metrics:[{Name:name,Unit:unit}]});};
 line.Service=line.service;
 if(event==='meri.turn.summary'){
  line.Outcome=line.state;add('FirstTextMs',line.firstTextMs,'Milliseconds');add('ResultMs',line.resultMs,'Milliseconds');
  add('Turns',1,'Count',[['Service','Outcome']]);add('TimeoutFailures',line.timeoutClass==='none'?0:1);
 }else if(event==='meri.turn.counters'||event==='meri.process.rollup'){
  const background=event==='meri.process.rollup',dimensions=background?[['Service'],['Service','Attribution']]:[['Service']];
  if(background)line.Attribution='background';
  if(line.service==='runner'){add('RunOwnerCalls',sum(line.runOwner));add('RunOwnerMs',line.runOwnerMs,'Milliseconds');}
  else {add('CoreCalls',sum(line.core),'Count',dimensions);add('ClerkReadsEstimate',line.clerkReadsEstimate,'Count',dimensions);
   add('CurrentAuthorityFresh',line.authorityFresh,'Count',dimensions);add('CurrentAuthorityReuses',line.authorityReuses,'Count',dimensions);
   add('AwsCalls',sum(line.aws),'Count',dimensions);add('DbStatements',line.db?.statements,'Count',dimensions);}
  if(background)add('TelemetryDropped',line.telemetryDropped);
 }else if(event==='meri.core.counters'){
  line.StatusClass=line.statusClass;
  if(line.attribution==='background')line.Attribution='background';
  add('CoreCalls',line.count,'Count',line.attribution==='background'?[['Service','StatusClass'],['Service','StatusClass','Attribution']]:[['Service','StatusClass']]);
 }else if(event==='meri.turn.failure'){line.Stage=line.stage;add('RunnerFailures',1,'Count',[['Service','Stage']]);
  if(line.timeoutClass&&line.timeoutClass!=='none')add('TimeoutFailures',1);}
 else if(event==='meri.health'){line.Component=line.component;add('HealthEvents',1,'Count',[['Service'],['Service','Component']]);}
 else if(event==='meri.budget.quarantined')add('BudgetQuarantines',1);
 else if(event==='meri.model.request'){
  line.Outcome=line.outcome;add('ModelRequests',1,'Count',[['Service','Outcome']]);add('ModelTtftMs',line.firstChunkMs,'Milliseconds');
  add('ModelBootstrapMs',line.bootstrapMs,'Milliseconds');add('OwnerExchanges',sum(line.ownerExchanges));add('ProxyAwsCalls',sum(line.aws));
 }
 return groups;
}

export function createTurnLineEmitter({service,environment='Preview',write=line=>process.stdout.write(line),now=Date.now}={}){
 let dropped=0;
 return Object.freeze({
  emit(event,fields={}){try{
   const schema=LINE_SCHEMAS[event];if(!schema||!SERVICES.includes(service)||!['Preview','Production'].includes(environment)){dropped++;return false;}
   const input=fields,line={schema:'meri.telemetry/1',event,service};
   for(const [key,clean] of Object.entries(schema))if(key!=='service'&&Object.hasOwn(input,key))line[key]=clean(input[key]);
   if(!Object.hasOwn(line,'atMs'))line.atMs=number(now());
   const groups=metricsFor(event,line);line._aws={Timestamp:line.atMs,CloudWatchMetrics:groups.map(group=>({Namespace:`Meri/${environment}`,...group}))};
   const encoded=JSON.stringify(line)+'\n';if(Buffer.byteLength(encoded)>8192){dropped++;return false;}
   const result=write(encoded);if(result&&typeof result.then==='function')result.catch(()=>{dropped++;});return true;
  }catch{dropped++;return false;}},
  get dropped(){return dropped;},
  drop(count=1){dropped+=Number.isSafeInteger(count)&&count>0?count:1;},
  takeDropped(){const n=dropped;dropped=0;return n;},
 });
}
