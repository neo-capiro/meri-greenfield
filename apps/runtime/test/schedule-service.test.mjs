/** Source composition only: real service/poller/domain owners; SQL, SDK connections/poller, secrets and listener are synthetic.
 * Common runtime role validation is primary-owned and is not mocked or claimed here; the new role helper runs unchanged. */
import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {WorkflowNotFoundError,WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {instruction} from '../native-authority/test/scheduled-admission-fixture.mjs';
import {scheduledJobFixture} from '../../control/schedules/test/scheduled-job-fixture.mjs';
import {createPreparedSchedulePoolFixture} from '../../control/intents/test/prepared-schedule-fixture.mjs';
import {createPostgresIntentJournalStore} from '../../control/intents/postgres-journal.mjs';
import {createIntentJournal} from '../../control/intents/journal.mjs';
import {fixture as scheduleToolFixture,validators as scheduleValidators} from '../../../packages/contracts/test/schedule-tool-interface-fixtures.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';

let state;
function reset(){
 state={events:[],secret:'postgresql://synthetic@db.synthetic.invalid/meri?sslmode=verify-full',secretHook:null,pool:null,client:null,workerState:'INITIALIZED',done:Promise.withResolvers(),activityAbort:new AbortController(),registered:null,listener:null,failWorker:false,failListener:false};
 return state;
}
reset();
mock.module('pg',{namedExports:{Pool:class{constructor(options){state.events.push('pool-create');state.poolOptions=options;if(!state.pool)throw Error('Synthetic pool boundary not supplied');return state.pool;}}}});
mock.module('@temporalio/client',{namedExports:{WorkflowNotFoundError,WorkflowIdReusePolicy,WorkflowIdConflictPolicy,
 Connection:{async connect(options){state.events.push('client-connect');state.clientOptions=options;return {withDeadline:(_deadline,fn)=>fn(),withAbortSignal:(_signal,fn)=>fn(),async close(){state.events.push('client-close');}};}},
 Client:class{constructor({connection,namespace}){state.events.push('client-create');state.namespace=namespace;if(!state.client)throw Error('Synthetic Temporal boundary not supplied');return {...state.client,connection};}},
}});
mock.module('@temporalio/activity',{namedExports:{Context:{current:()=>({cancellationSignal:state.activityAbort.signal})}}});
mock.module('@temporalio/worker',{namedExports:{
 NativeConnection:{async connect(){state.events.push('poller-connect');return {async close(){state.events.push('poller-close');}};}},
 Worker:{async create(options){state.events.push('worker-create');if(state.failWorker)throw Error('Synthetic worker construction failure');state.registered=options;return {getState:()=>state.workerState,run(){state.events.push('worker-run');state.workerState='RUNNING';return state.done.promise;},shutdown(){state.events.push('worker-stop');state.workerState='STOPPED';state.done.resolve();}};}},
}});
mock.module('../config.mjs',{namedExports:{fault:code=>Object.assign(Error(code),{code}),async readSecret(){state.events.push('secret-read');state.secretHook?.();return Buffer.from(state.secret);}}});
mock.module('../control.mjs',{namedExports:{async temporalTls(){state.events.push('tls');return {};},async temporalAuthorization(){state.events.push('temporal-authorization');return null;}}});
mock.module('../http-server.mjs',{namedExports:{async listenRuntime(options){state.events.push('listener-open');if(state.failListener)throw Error('Synthetic listener failure');state.listener=options;return {address:{port:0},async close(){state.events.push('listener-close');}};}}});

const {startScheduleWorker,composeScheduleService}=await import('../schedule-service.mjs');
const {compileScheduleServiceConfiguration,SCHEDULE_MAX_REQUEST_MS}=await import('../schedule-service-configuration.mjs');
const {readFileSync}=await import('node:fs');
const configuration={version:1,profile:'isolated-preview',sourceEnabled:false,versions,
 limits:{startupMs:1000,shutdownMs:1000,requestMs:1000,requestBytes:131072},
 http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://ui.synthetic.invalid'},
 temporal:{address:'temporal.synthetic.invalid:7233',namespace:'synthetic',taskQueue:'meri-schedules',tls:{caFile:resolve('synthetic-ca'),certFile:resolve('synthetic-cert'),keyFile:resolve('synthetic-key')}},
 scheduledDispatch:{enabled:true,conversationTaskQueue:'meri-conversations',maxConcurrentActivities:1}};
const unavailableOwners=()=>({authority:{async authorize(){throw Error('Synthetic policy unavailable');}},runAdmission:{async admit(){throw Error('Synthetic native producer unavailable');}},
 runControl:{async cancel(){throw Error('Synthetic canonical cancel unavailable');}},retirement:{async retire(){throw Error('Synthetic physical retirement unavailable');}}});

// Routes statements to the existing independent SQL fixtures. Transaction control is deferred until its first namespace is known;
// this is an outer protocol boundary, with no custody, admission, identity or dispatch business logic reproduced here.
function multiplexPool(h,intents){
 const sql={queries:[],releases:[],ends:0,missingRelation:false,onSchema:null};
 const pool={async connect(){let selected,mode,pending=[];return {
  async query(statement,params=[]){
   sql.queries.push({statement,params});
   if(statement.startsWith('SELECT name,to_regclass(name)')){mode='schema';await sql.onSchema?.();return {rows:params[0].map((name,index)=>({name,relation:sql.missingRelation&&index===0?null:name}))};}
   if(mode==='schema')return {rows:[]};
   if(!selected&&(/^(BEGIN|SET LOCAL)/u.test(statement)||statement==='COMMIT'||statement==='ROLLBACK')){pending.push([statement,params]);return {rows:[]};}
   if(!selected){
    const schedule=statement.includes('meri_schedules.')||statement.startsWith('SELECT pg_advisory')&&params[0]===`${h.template.principal.tenantId}:${h.intent.projection.scheduleId}`;
    const target=statement.includes('meri_intents.')?intents.pool:schedule?h.scheduleSql.pool:h.pool;
    selected=await target.connect();for(const [command,args]of pending)await selected.query(command,args);pending=[];
   }
   return selected.query(statement,params);
  },release(reason){sql.releases.push(reason);selected?.release(reason);},
 };},async end(){sql.ends++;state.events.push('pool-end');}};
 return {pool,sql};
}
async function actualComposition(t){
 const h=await scheduledJobFixture({admit:false,allocated:false});t.after(h.close);const intents=createPreparedSchedulePoolFixture(),boundary=multiplexPool(h,intents);
 const f=scheduleToolFixture(),{task,workflow,...policy}=h.intent.configuration,limits={maxCostMicrousd:h.intent.projection.maxCostMicrousd,maxRuntimeSeconds:h.intent.projection.maxRuntimeSeconds,retryLimit:h.intent.projection.retryLimit};
 f.request={taskInstruction:instruction,policy,destinationReference:'Policy-owned Meri inbox',requestedLimits:limits};
 const c=f.context.scheduleContext;Object.assign(c,{callerIdentity:h.template.principal,intentId:h.intent.intentId,projection:h.intent.projection,requestSha256:hash(f.request),nowMs:h.now(),deadlineMs:h.now()+1000,
  taskResolution:{instructionSha256:hash(instruction),task,workflow},destinationResolution:{reference:f.request.destinationReference,destinationId:h.template.destinationId},limitResolution:{requestedSha256:hash(limits),effective:limits}});
 const prepared=scheduleValidators.prepare('schedule_task',f.request,f.context);assert.equal(prepared.intentSha256,hash(h.intent));
 const binding={...h.identity.binding,conversationId:'99999999-1111-4111-8111-111111111111'},deliveryId='sdk:'+'b'.repeat(64),record={operation:{id:'schedule_task',version:'0.2.0'},argumentsSha256:prepared.requestSha256};
 const outcome={result:{status:'approval_required',proposal:prepared.proposal},release:{binding,scopes:h.scopes,expiresAtMs:h.now()-1}};
 const journal=createIntentJournal(createPostgresIntentJournalStore({pool:boundary.pool}));
 await journal.begin({binding,deliveryId,record});await journal.settle({binding,deliveryId,record,state:'PREPARED',outcome});
 return {h,intents,...boundary,runtimePorts:{authority:h.firingAuthority,runAdmission:h.adapter,runControl:h.options.runControl,retirement:h.options.retirement,pool:boundary.pool,client:h.temporal.client,now:h.now}};
}

test('missing, malformed or accessor authority/admission refuses before secrets and resources',async()=>{
 for(const runtimePorts of [undefined,{}, {authority:unavailableOwners().authority},{runAdmission:unavailableOwners().runAdmission},{...unavailableOwners(),policySelector:'synthetic'},
  ...['authority','runAdmission','runControl','retirement'].map(key=>{const ports=unavailableOwners();delete ports[key];return ports;}),
  ...[['authority','authorize'],['runAdmission','admit'],['runControl','cancel'],['retirement','retire']].map(([key,method])=>({...unavailableOwners(),[key]:{[method]:undefined}}))]){
  reset();await assert.rejects(startScheduleWorker(configuration,{runtimePorts}),{code:'SCHEDULE_SERVICE_UNAVAILABLE'});assert.deepEqual(state.events,[]);
 }
 let getters=0;const ports={runAdmission:unavailableOwners().runAdmission};Object.defineProperty(ports,'authority',{enumerable:true,get(){getters++;throw Error('PRIVATE');}});
 await assert.rejects(startScheduleWorker(configuration,{runtimePorts:ports}),{code:'SCHEDULE_SERVICE_UNAVAILABLE'});assert.equal(getters,0);
 const inner={...unavailableOwners(),authority:{get authorize(){getters++;throw Error('PRIVATE');}}};
 await assert.rejects(startScheduleWorker(configuration,{runtimePorts:inner}),{code:'SCHEDULE_SERVICE_UNAVAILABLE'});assert.equal(getters,0);assert.deepEqual(state.events,[]);
 for(const [key,method] of [['runControl','cancel'],['retirement','retire']]){
  const poisoned={...unavailableOwners(),[key]:{get [method](){getters++;throw Error('PRIVATE');}}};
  await assert.rejects(startScheduleWorker(configuration,{runtimePorts:poisoned}),{code:'SCHEDULE_SERVICE_UNAVAILABLE'});assert.equal(getters,0);assert.deepEqual(state.events,[]);
 }
});

test('canonical role settings stay closed, source-disabled, queue-separated and bounded',async()=>{
 assert.deepEqual(compileScheduleServiceConfiguration(configuration),{scheduledDispatch:configuration.scheduledDispatch});
 const variants=[{sourceEnabled:true},{scheduledDispatch:{...configuration.scheduledDispatch,enabled:false}},{scheduledDispatch:{...configuration.scheduledDispatch,conversationTaskQueue:configuration.temporal.taskQueue}},
  ...[0,11].map(maxConcurrentActivities=>({scheduledDispatch:{...configuration.scheduledDispatch,maxConcurrentActivities}})),
  {scheduledDispatch:{...configuration.scheduledDispatch,extra:true}},{database:{connectionFile:'relative-file'}},{database:{connectionFile:resolve('synthetic-database'),selector:'synthetic'}},{limits:{...configuration.limits,requestMs:0}},{limits:{...configuration.limits,requestMs:SCHEDULE_MAX_REQUEST_MS+1}}];
 for(const changed of variants){reset();await assert.rejects(startScheduleWorker({...configuration,...changed},{runtimePorts:unavailableOwners()}),{code:'SCHEDULE_SERVICE_CONFIGURATION'});assert.deepEqual(state.events,[]);}
});

test('the role accepts the preview control request budget and stays inside the scheduled workflow uncertainty bound',()=>{
 // The preview renders requestMs 25000 for control and worker (render-material.mjs); the former 3000 cap refused it.
 for(const requestMs of [3000,25000,SCHEDULE_MAX_REQUEST_MS])assert.deepEqual(compileScheduleServiceConfiguration({...configuration,limits:{...configuration.limits,requestMs}}),{scheduledDispatch:configuration.scheduledDispatch});
 // Static witness over the workflow source: one activity lifetime ends inside startToClose, and startToClose plus the request bound
 // stays shorter than the settle period after UNKNOWN, so a lost attempt has settled before reconciliation.
 const workflow=readFileSync(new URL('../../control/conversations/scheduled-dispatch-workflow.ts',import.meta.url),'utf8');
 const minutes=pattern=>Number(pattern.exec(workflow)?.[1])*60000;
 const startToClose=minutes(/proxyActivities<Activities>\(\{startToCloseTimeout:'(\d+) minutes?'/u),settle=minutes(/settleAfterUnknown='(\d+) minutes?'/u);
 assert.equal(startToClose,60000);assert.equal(settle,120000);
 assert.equal((workflow.match(/startToCloseTimeout:'1 minute'/gu)??[]).length,2,'every scheduled activity keeps the same startToClose');
 assert.ok(SCHEDULE_MAX_REQUEST_MS<startToClose&&startToClose+SCHEDULE_MAX_REQUEST_MS<settle);
});

test('owning a pool requires its explicit database configuration; pre-abort creates no resources',async()=>{
 reset();await assert.rejects(startScheduleWorker(configuration,{runtimePorts:unavailableOwners()}),{code:'SCHEDULE_SERVICE_CONFIGURATION'});assert.deepEqual(state.events,[]);
 const controller=new AbortController();controller.abort();
 await assert.rejects(startScheduleWorker({...configuration,database:{connectionFile:resolve('synthetic-database')}},{runtimePorts:unavailableOwners(),signal:controller.signal}),{code:'SCHEDULE_SERVICE_STARTUP_FAILED'});assert.deepEqual(state.events,[]);
});

test('owned pool configuration enforces one verify-full TLS parameter before pool creation',async()=>{
 for(const secret of ['postgresql://synthetic@db.synthetic.invalid/meri?sslmode=disable','postgresql://synthetic@db.synthetic.invalid/meri?sslmode=verify-full&sslmode=disable','postgresql://synthetic@db.synthetic.invalid/meri?sslmode=verify-full&application_name=unexpected']){
  reset();state.secret=secret;
  await assert.rejects(startScheduleWorker({...configuration,database:{connectionFile:resolve('synthetic-database')}},{runtimePorts:unavailableOwners()}),{code:'SCHEDULE_SERVICE_STARTUP_FAILED'});
  assert.deepEqual(state.events,['secret-read']);
 }
});

test('actual startup activities consume journal custody and canonical native admission, replaying one original run',async t=>{
 const x=await actualComposition(t);reset();
 const compiled=composeScheduleService({configuration,runtimePorts:x.runtimePorts});assert.deepEqual(Object.keys(compiled),['dispatch','reconcile','cancel']);
 assert.deepEqual(state.events,[],'pure composition allocates nothing');
 const service=await startScheduleWorker(configuration,{runtimePorts:x.runtimePorts});
 try{
  assert.equal(state.registered.taskQueue,'meri-schedules');assert.match(state.registered.workflowsPath,/scheduled-dispatch-workflow\.ts$/u);
  assert.deepEqual(Object.keys(state.registered.activities),['dispatchScheduledOccurrence','reconcileScheduledOccurrence','cancelScheduledOccurrence']);
  const dispatched=await state.registered.activities.dispatchScheduledOccurrence({occurrence:x.h.occurrence});
  assert.equal(dispatched.outcome,'ACTIVE');assert.deepEqual(dispatched.binding,x.h.identity.binding);
  const accepted=await x.h.store.read(x.h.identity.binding,{after:0,limit:10},()=>{});
  assert.equal(accepted.request.prompt,instruction);assert.equal(x.h.bindings.size,1);assert.equal(x.h.conversations.allocations.size,1);
  assert.equal([...x.h.conversations.allocations.values()][0].state,'ACCEPTED');assert.equal(x.h.conversations.state.runs.size,1);
  assert.deepEqual([...x.h.bindings.values()][0].record.binding,x.h.identity.binding);assert.ok(x.h.policy.calls.length>=3);
  assert.equal(x.h.temporal.workflows.size,1);
  assert.equal((await state.registered.activities.dispatchScheduledOccurrence({occurrence:x.h.occurrence})).outcome,'ACTIVE');
  assert.equal((await state.registered.activities.reconcileScheduledOccurrence({occurrence:x.h.occurrence})).outcome,'ACTIVE');
  assert.equal(x.h.scheduleSql.state.occurrences.get(`${x.h.identity.binding.tenantId}:${x.h.identity.occurrenceKey}`).state,'OPEN');
  assert.equal(x.h.temporal.workflows.size,1);assert.equal(x.h.conversations.state.runs.size,1);
  assert.equal((await state.listener.application.handle(new Request('https://health.synthetic.invalid/api/schedules/dispatch'))).status,404);
  await state.listener.readiness();
 }finally{await service.close();await service.close();}
 assert.equal(x.sql.ends,0,'borrowed pool is not disposed');assert.equal(state.events.includes('client-close'),false);
 assert.deepEqual(state.events.slice(-3),['listener-close','worker-stop','poller-close']);
});

for(const held of ['pause','approval.wait'])test(`actual service retains ${held} through retirement/resume and cancels only the real target`,async t=>{
 const x=await actualComposition(t);reset();const service=await startScheduleWorker(configuration,{runtimePorts:x.runtimePorts});
 try{
  const activities=state.registered.activities,call={occurrence:x.h.occurrence};
  assert.equal((await activities.dispatchScheduledOccurrence(call)).outcome,'ACTIVE');await x.h.claim();await x.h.running();await x.h.pause(held);await x.h.retire();
  assert.equal((await activities.reconcileScheduledOccurrence(call)).outcome,'ACTIVE');
  const key=`${x.h.identity.binding.tenantId}:${x.h.identity.occurrenceKey}`;assert.equal(x.h.scheduleSql.state.occurrences.get(key).state,'OPEN');
  const later={...x.h.occurrence,workflowId:'synthetic-later-held',scheduledAt:new Date(x.h.now()+1).toISOString()};
  assert.equal((await activities.dispatchScheduledOccurrence({occurrence:later})).code,'SCHEDULE_OCCURRENCE_UNRESOLVED');
  const target=await x.h.resume();await x.h.running(target);assert.notEqual(target.runId,x.h.identity.binding.runId);
  assert.equal((await activities.reconcileScheduledOccurrence(call)).outcome,'ACTIVE');
  assert.equal((await activities.cancelScheduledOccurrence(call)).outcome,'DISPATCHED');assert.deepEqual(x.h.calls.cancel,[target]);assert.deepEqual(x.h.calls.retire,[target]);
  assert.equal(x.h.row(target).projection.state,'cancelled');assert.equal(x.h.scheduleSql.state.occurrences.get(key).state,'DISPATCHED');
  assert.equal((await activities.reconcileScheduledOccurrence(call)).outcome,'DISPATCHED');assert.equal(x.h.temporal.calls.start,1);
 }finally{await service.close();}
});

test('actual service settles only canonical terminal plus retirement evidence, then admits the next occurrence once',async t=>{
 const x=await actualComposition(t);reset();const service=await startScheduleWorker(configuration,{runtimePorts:x.runtimePorts});
 try{
  const activities=state.registered.activities,call={occurrence:x.h.occurrence};assert.equal((await activities.dispatchScheduledOccurrence(call)).outcome,'ACTIVE');
  await x.h.claim();await x.h.running();await x.h.status('completed');
  const held=await activities.reconcileScheduledOccurrence(call);assert.equal(held.outcome,'ACTIVE');assert.equal(held.code,'SCHEDULE_JOB_RETIREMENT_UNPROVEN');
  await x.h.retire();assert.equal((await activities.reconcileScheduledOccurrence(call)).outcome,'DISPATCHED');
  x.h.advance(1);const next={...x.h.occurrence,workflowId:'synthetic-next-proven-terminal',scheduledAt:new Date(x.h.now()).toISOString()};
  assert.equal((await activities.dispatchScheduledOccurrence({occurrence:next})).outcome,'ACTIVE');assert.equal((await activities.dispatchScheduledOccurrence({occurrence:next})).outcome,'ACTIVE');
  assert.equal(x.h.temporal.calls.start,2);assert.equal(x.h.conversations.state.runs.size,2);
 }finally{await service.close();}
});

for(const mode of ['custody','authority','admission'])test(`actual activity with unavailable ${mode} does not admit or start a run`,async t=>{
 const x=await actualComposition(t);reset();
 if(mode==='custody')x.intents.state.rows.clear();
 if(mode==='authority')x.runtimePorts.authority={async authorize(){throw Error('Synthetic current owner policy unavailable');}};
 if(mode==='admission')x.runtimePorts.runAdmission={async admit(){throw Error('Synthetic genuine native producer unavailable');}};
 const service=await startScheduleWorker(configuration,{runtimePorts:x.runtimePorts});
 try{assert.equal((await state.registered.activities.dispatchScheduledOccurrence({occurrence:x.h.occurrence})).outcome,'UNKNOWN');
  assert.equal(x.h.bindings.size,0);assert.equal(x.h.conversations.allocations.size,0);assert.equal(x.h.conversations.state.runs.size,0);assert.equal(x.h.temporal.workflows.size,0);
 }finally{await service.close();}
});

test('schema readiness or cancellation prevents poller/listener startup and leaves borrowed resources owned by caller',async t=>{
 for(const mode of ['missing','cancel']){
  const x=await actualComposition(t);reset();const controller=new AbortController();
  if(mode==='missing')x.sql.missingRelation=true;else x.sql.onSchema=()=>controller.abort();
  await assert.rejects(startScheduleWorker(configuration,{runtimePorts:x.runtimePorts,signal:controller.signal}),{code:'SCHEDULE_SERVICE_STARTUP_FAILED'});
  assert.deepEqual(state.events,[]);assert.equal(x.sql.ends,0);assert.equal(x.sql.releases.length>0,true);
 }
});

test('service-owned pool and JS connection close after the existing poller, without closing borrowed owners',async t=>{
 for(const mode of ['pool','client','both']){
  const x=await actualComposition(t);reset();state.pool=x.pool;state.client=x.h.temporal.client;const owners={...x.runtimePorts};
  if(mode!=='client')delete owners.pool;if(mode!=='pool')delete owners.client;
  const service=await startScheduleWorker({...configuration,database:{connectionFile:resolve('synthetic-database')}},{runtimePorts:owners});
  if(mode!=='client')assert.equal(state.poolOptions.connectionTimeoutMillis,configuration.limits.requestMs);
  if(mode!=='pool')assert.equal(state.clientOptions.connectTimeout,configuration.limits.startupMs);
  await service.close();await service.close();
  assert.equal(x.sql.ends,mode==='client'?0:1);assert.equal(state.events.filter(e=>e==='client-close').length,mode==='pool'?0:1);
  for(const event of ['client-close','pool-end'])if(state.events.includes(event))assert.ok(state.events.indexOf(event)>state.events.indexOf('poller-close'));
 }
});

test('startup captures borrowed authority/admission/control/retirement methods before its first await and retains their receivers',async t=>{
 const x=await actualComposition(t);reset();state.pool=x.pool;state.client=x.h.temporal.client;
 let checks=0,admissions=0,cancellations=0,retirements=0;
 const authority={async authorize(request){assert.equal(this,authority);checks++;return x.h.firingAuthority.authorize(request);}};
 const runAdmission={async admit(request){assert.equal(this,runAdmission);admissions++;return x.h.adapter.admit(request);}};
 const runControl={async cancel(request){assert.equal(this,runControl);cancellations++;return x.h.options.runControl.cancel(request);}};
 const retirement={async retire(request){assert.equal(this,retirement);retirements++;return x.h.options.retirement.retire(request);}};
 state.secretHook=()=>{for(const [port,method] of [[authority,'authorize'],[runAdmission,'admit'],[runControl,'cancel'],[retirement,'retire']])port[method]=()=>{throw Error('replacement');};};
 const service=await startScheduleWorker({...configuration,database:{connectionFile:resolve('synthetic-database')}},{runtimePorts:{authority,runAdmission,runControl,retirement,now:x.h.now}});
 try{
  assert.equal((await state.registered.activities.dispatchScheduledOccurrence({occurrence:x.h.occurrence})).outcome,'ACTIVE');assert.equal(checks,2);assert.equal(admissions,1);
  await x.h.claim();await x.h.running();assert.equal((await state.registered.activities.cancelScheduledOccurrence({occurrence:x.h.occurrence})).outcome,'DISPATCHED');
  assert.equal(cancellations,1);assert.equal(retirements,1);
 }
 finally{await service.close();}
});

for(const phase of ['worker','listener'])test(`failed ${phase} startup closes all allocated resources`,async t=>{
 const x=await actualComposition(t);reset();state.pool=x.pool;state.client=x.h.temporal.client;state[phase==='worker'?'failWorker':'failListener']=true;
 const {pool,client,...owners}=x.runtimePorts;
 await assert.rejects(startScheduleWorker({...configuration,database:{connectionFile:resolve('synthetic-database')}},{runtimePorts:owners}),{code:'SCHEDULE_SERVICE_STARTUP_FAILED'});
 assert.equal(x.sql.ends,1);assert.equal(state.events.filter(e=>e==='client-close').length,1);assert.equal(state.events.filter(e=>e==='poller-close').length,1);
 assert.equal(state.events.includes('worker-stop'),phase==='listener');
});

test('failed JS client construction closes its allocated connection and pool before any poller',async t=>{
 const x=await actualComposition(t);reset();state.pool=x.pool;
 const {pool,client,...owners}=x.runtimePorts;
 await assert.rejects(startScheduleWorker({...configuration,database:{connectionFile:resolve('synthetic-database')}},{runtimePorts:owners}),{code:'SCHEDULE_SERVICE_STARTUP_FAILED'});
 assert.equal(x.sql.ends,1);assert.deepEqual(state.events.slice(-2),['client-close','pool-end']);assert.equal(state.events.includes('poller-connect'),false);
});
