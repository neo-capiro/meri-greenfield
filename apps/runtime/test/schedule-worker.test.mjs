/** SYNTHETIC worker registration/lifetime. Temporal worker, TLS and listener are borrowed doubles; no poller/DB/daemon is started. */
import {test,mock} from 'node:test';import assert from 'node:assert/strict';
import {validateConfiguration} from '../config.mjs';
import {versions} from '../../control/conversations/test/application-fixture.mjs';
let calls,registered,listenerOptions,workerState,done,failCreate=false;
const reset=()=>{calls=[];workerState='INITIALIZED';done=Promise.withResolvers();};reset();
mock.module('@temporalio/worker',{namedExports:{NativeConnection:{async connect(){calls.push('connection');return {async close(){calls.push('connection-close');}};}},Worker:{async create(options){calls.push('worker');if(failCreate)throw Error('synthetic create failure');registered=options;return {getState:()=>workerState,run(){workerState='RUNNING';return done.promise;},shutdown(){calls.push('shutdown');workerState='STOPPED';done.resolve();}};}}}});
mock.module('./../control.mjs',{namedExports:{async temporalTls(){calls.push('tls');return {};},async temporalAuthorization(){return null;}}});
mock.module('./../http-server.mjs',{namedExports:{async listenRuntime(options){calls.push('listener');listenerOptions=options;return {address:{port:0},async close(){calls.push('listener-close');}};}}});
const {startScheduleWorker,scheduleWorkerOptions}=await import('../schedule-worker.mjs');
const configuration={version:1,profile:'isolated-preview',sourceEnabled:false,versions,limits:{startupMs:1000,shutdownMs:1000,requestMs:1000,requestBytes:131072},
 http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://ui.synthetic.invalid'},temporal:{address:'temporal.synthetic.invalid:7233',namespace:'synthetic',taskQueue:'meri-schedules',tls:{caFile:process.execPath,certFile:process.execPath,keyFile:process.execPath}},
 scheduledDispatch:{enabled:true,conversationTaskQueue:'meri-conversations',maxConcurrentActivities:1}};

test('explicit schedule-worker role accepts only separate queue and bounded opt-in, without provider/native/DB credentials',()=>{
 assert.doesNotThrow(()=>validateConfiguration(configuration,'schedule-worker'));
 for(const changed of [{enabled:false},{conversationTaskQueue:'meri-schedules'},{maxConcurrentActivities:0},{maxConcurrentActivities:11},{extra:true}])assert.throws(()=>validateConfiguration({...configuration,scheduledDispatch:{...configuration.scheduledDispatch,...changed}},'schedule-worker'));
 assert.throws(()=>validateConfiguration({...configuration,native:{}},'schedule-worker'));assert.throws(()=>validateConfiguration({...configuration,sourceEnabled:true},'schedule-worker'));
});

test('missing or accessor dispatch refuses before TLS, connection or worker resources',async()=>{
 reset();await assert.rejects(startScheduleWorker(configuration),{code:'SCHEDULE_DISPATCH_UNAVAILABLE'});let getters=0;
 await assert.rejects(startScheduleWorker(configuration,{dispatch:{get dispatch(){getters++;return ()=>{};},reconcile(){}}}));assert.equal(getters,0);assert.deepEqual(calls,[]);
 await assert.rejects(startScheduleWorker({...configuration,scheduledDispatch:{enabled:true,maxConcurrentActivities:1}},{dispatch:{async dispatch(){},async reconcile(){}}}));assert.deepEqual(calls,[]);
});

test('registration uses canonical workflow, activity cancellation and original dispatch receiver, never HTTP dispatch',async()=>{
 reset();const identities=new WeakSet(),seen=[],dispatch={async dispatch(input){assert.ok(identities.has(this));seen.push(input);return {outcome:'UNKNOWN'};},async reconcile(input){assert.ok(identities.has(this));seen.push(input);return {outcome:'REFUSED'};}};identities.add(dispatch);
 const cancellation=new AbortController(),options=scheduleWorkerOptions({configuration,dispatch,context:()=>({cancellationSignal:cancellation.signal})});
 assert.equal(options.taskQueue,'meri-schedules');assert.equal(options.maxConcurrentActivityTaskExecutions,1);assert.match(options.workflowsPath,/scheduled-dispatch-workflow\.ts$/u);
 assert.deepEqual(Object.keys(options.activities),['dispatchScheduledOccurrence','reconcileScheduledOccurrence']);
 const occurrence={synthetic:true};assert.deepEqual(await options.activities.dispatchScheduledOccurrence({occurrence}),{outcome:'UNKNOWN'});assert.deepEqual(await options.activities.reconcileScheduledOccurrence({occurrence}),{outcome:'REFUSED'});assert.ok(seen.every(v=>v.occurrence===occurrence&&v.signal===cancellation.signal));
 const runtime=await startScheduleWorker(configuration,{dispatch});try{assert.equal(registered.taskQueue,'meri-schedules');await listenerOptions.readiness();
  const reply=await listenerOptions.application.handle(new Request('https://internal.synthetic.invalid/api/schedules/dispatch'));assert.equal(reply.status,404);assert.equal(seen.length,2);
 }finally{await runtime.close();await runtime.close();}
 assert.deepEqual(calls,['tls','connection','worker','listener','listener-close','shutdown','connection-close']);
});

test('worker construction failure closes owned connection and starts no listener',async()=>{
 reset();failCreate=true;try{await assert.rejects(startScheduleWorker(configuration,{dispatch:{async dispatch(){},async reconcile(){}}}),{code:'SCHEDULE_WORKER_STARTUP_FAILED'});assert.deepEqual(calls,['tls','connection','worker','connection-close']);}finally{failCreate=false;}
});

test('existing CLI help discovers schedule-worker without allocating dependencies',async()=>{
 const {main}=await import('../cli.mjs');let output='';const write=mock.method(process.stdout,'write',chunk=>{output+=chunk;return true;});try{assert.equal(await main(['--help']),0);assert.match(output,/schedule-worker/u);}finally{write.mock.restore();}
});
