/** Canonical effective budgets. Roots come from rendered limits; importing this module performs no I/O. */
import {createHash} from 'node:crypto';

/** Absolute pre-execution cutoffs for one original runner lease. Each stage
 * keeps its own allowance plus every later allowance, so slow authority reads
 * cannot borrow time reserved for startup, shutdown, or failure settlement. */
export const RUNNER_LOAD_MAX_MS=23000;
export const RUNNER_LOAD_CONTROL_MARGIN_MS=2000;
// runner/load and runner/publish are sent again after an answer reporting a dependency that did not answer (a Clerk timeout
// answered 503), after these pauses and only inside the caller's absolute deadline (native-client.mjs).
export const RUNNER_REPLAY_DELAYS_MS=Object.freeze([500,1500]);
// The load stage fits one replay: a full attempt, the first pause and a second full attempt. Each attempt keeps
// RUNNER_LOAD_MAX_MS. At the tail Core profile one load takes about 15.7 s, so a single 23 s window could never hold a replay.
export const RUNNER_LOAD_STAGE_MAX_MS=2*RUNNER_LOAD_MAX_MS+RUNNER_REPLAY_DELAYS_MS[0];
export const RUNNER_STARTUP_MIN_SHUTDOWN_MS=10000;
export const RUNNER_STARTUP_SHUTDOWN_STEPS=3;
// Successful completion gets one bounded publication (including session
// settlement). If that fails, catch may need four serial terminal attempts.
export const RUNNER_STARTUP_SETTLEMENT_MS=5*RUNNER_LOAD_MAX_MS;
// Catch closes an in-flight query before terminal publication; final cleanup
// remains separately reserved after the terminal attempt sequence.
export const RUNNER_STARTUP_CATCH_CLEANUP_MS=3000;
// Final cleanup can make seven serial three-second attempts and then spend
// 131 seconds settling a Browser host whose outcome remains uncertain.
export const RUNNER_STARTUP_CLEANUP_MS=7*3000+131000;
export const RUNNER_STARTUP_MARGIN_MS=2000;
// A native prepare/start exchange crosses runner client -> control task router
// -> runner receiver, and the receiver's preparation authority calls return to
// control inside it. Each enclosing hop keeps one control margin above the hop it
// encloses, so the innermost owner refuses first and the outer ones still answer.
export const RUNNER_NATIVE_STARTUP_ROUTER_MS=RUNNER_LOAD_MAX_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;
export const RUNNER_NATIVE_STARTUP_RECEIVER_MS=RUNNER_NATIVE_STARTUP_ROUTER_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;

// SDK session mirror RPCs (runner -> control /v1/runner/session/*). Control's session owner verifies task authority, two Core
// calls each, twice for a read, three times for an append and four times for a registration plus its observation hop; the
// continuation snapshot verifies three times and reads its checkpoint object. Control bounds each operation one control margin
// inside the runner's allowance, so control answers before the runner gives up.
export const RUNNER_SESSION_RPC_MS=Object.freeze({register:12000,append:7000,load:6000,'list-subkeys':6000,snapshot:8000});
export const controlSessionRpcMs=operation=>RUNNER_SESSION_RPC_MS[operation]-RUNNER_LOAD_CONTROL_MARGIN_MS;
// One bound-store call: the first load of a subpath, then its append.
export const RUNNER_SESSION_STORE_CALL_MS=RUNNER_SESSION_RPC_MS.load+RUNNER_SESSION_RPC_MS.append+RUNNER_LOAD_CONTROL_MARGIN_MS;

// A runner checkpoint call (`checkpoint/complete` at the end of a turn, `checkpoint/capture` for a pause) has one network
// allowance. It encloses control's checkpoint capture, which encloses control's capture channel to the runner, the task
// router's forwarding of it and the runner's capture with its session reads.
export const CONTROL_CHECKPOINT_CAPTURE_MS=RUNNER_LOAD_MAX_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;
export const CONTROL_CAPTURE_CHANNEL_MS=CONTROL_CHECKPOINT_CAPTURE_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;
export const TASK_ROUTER_CAPTURE_MS=CONTROL_CAPTURE_CHANNEL_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;
export const RUNNER_CAPTURE_MS=TASK_ROUTER_CAPTURE_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;

export const RUNNER_STARTUP_STAGE_ORDER=Object.freeze([
 'bootstrap','admittedBefore','admittedAfter','load','runtime','local',
 'starting','setup','running','nativePrepare','nativeStart','session',
]);

// SDK session preparation; a continuation reads its checkpoint snapshot from control here.
const LOCAL_STAGE_MS=RUNNER_SESSION_RPC_MS.snapshot+RUNNER_LOAD_CONTROL_MARGIN_MS;
// The activity's bound on runtime preparation: the runner/runtime call, then the local stage. It is the one place where an
// enclosing bound is smaller than its inner allowances in sequence (runtime 23 s + local 10 s = 33 s against 30 s). Each stage
// keeps its own allowance and absolute cutoff, so the 30 s only shortens the local stage after a runtime call past 20 s; the
// local stage's work is about 3.3 s at the tail profile (adj-e D2), so that takes a runtime call past 26.7 s, beyond its own 23 s.
export const ACTIVITY_PREPARATION_MAX_MS=30000;
// Optional Browser host, objective, and selected-skill preparation share this
// stage before the first running publication.
const SETUP_STAGE_MS=23000;

export function runnerStartupBudget({requestMs,shutdownMs,originalExpiresAtMs}){
 if(![requestMs,shutdownMs,originalExpiresAtMs].every(Number.isSafeInteger)||
    requestMs<=RUNNER_LOAD_CONTROL_MARGIN_MS||shutdownMs<1||originalExpiresAtMs<1)
  throw new TypeError('RUNNER_STARTUP_BUDGET_REFUSED');
 const networkMs=Math.min(RUNNER_LOAD_MAX_MS,requestMs-RUNNER_LOAD_CONTROL_MARGIN_MS);
 // The runner client's native start allowance must keep one control margin above the router's startup allowance.
 if(networkMs<RUNNER_NATIVE_STARTUP_ROUTER_MS+RUNNER_LOAD_CONTROL_MARGIN_MS)throw new TypeError('RUNNER_STARTUP_BUDGET_REFUSED');
 const reserveMs=RUNNER_STARTUP_SHUTDOWN_STEPS*Math.max(shutdownMs,RUNNER_STARTUP_MIN_SHUTDOWN_MS)+
  RUNNER_STARTUP_CATCH_CLEANUP_MS+RUNNER_STARTUP_SETTLEMENT_MS+
  RUNNER_STARTUP_CLEANUP_MS+RUNNER_STARTUP_MARGIN_MS;
 const loadStageMs=2*networkMs+RUNNER_REPLAY_DELAYS_MS[0];
 const capFor=stage=>stage==='local'?LOCAL_STAGE_MS:stage==='setup'?SETUP_STAGE_MS:stage==='load'?loadStageMs:networkMs;
 let cutoff=originalExpiresAtMs-reserveMs;
 const stages={};
 for(const stage of [...RUNNER_STARTUP_STAGE_ORDER].reverse()){
  const maxMs=capFor(stage);
  // The load stage also names its per-attempt allowance, the native client's runner/load request bound.
  stages[stage]=Object.freeze(stage==='load'?{maxMs,attemptMs:networkMs,expiresAtMs:cutoff}:{maxMs,expiresAtMs:cutoff});
  cutoff-=maxMs;
 }
 return Object.freeze({originalExpiresAtMs,reserveMs,stages:Object.freeze(stages)});
}

/** Compatibility for callers moving from the prior load-only allowance. */
export function runnerLoadBudget(input){
 try{return runnerStartupBudget(input).stages.load;}
 catch(error){if(error?.message==='RUNNER_STARTUP_BUDGET_REFUSED')throw new TypeError('RUNNER_LOAD_BUDGET_REFUSED');throw error;}
}


export const HOT_PATH_BUDGET_VERSION='meri.hot-path-budgets/1';
export const HOT_PATH_BUDGET_MARGIN_MS=RUNNER_LOAD_CONTROL_MARGIN_MS;
export const RUNTIME_KEEP_ALIVE_MS=125000;
export const OWNER_REQUEST_MAX_MS=15000;
export const GATEWAY_RUN_ALLOCATION_READ_MAX_MS=3000;
export const GATEWAY_COMPLETION_ADMISSION_MS=3000;
export const GENERAL_READ_VISION_TIMEOUT_MS=30000;
export const GENERAL_READ_DEFAULT_RUNTIME_SECONDS=900;
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const fixed=(ms,extra={})=>({kind:'independent',ms,...extra});
const nested=(ms,parent,extra={})=>fixed(ms,{kind:'nested',parent,...extra});
const library=(ms,boundedBy,reason,extra={})=>fixed(ms,{kind:'library',boundedBy,reason,...extra});
const unbounded=(boundedBy,reason)=>library(0,boundedBy,reason,{unbounded:true});

/** Stable hop names. A derived entry describes a cap or rate whose owning lifetime is not a nested request. */
const HOP_DEFINITIONS={
 'native.ecs.binding.request':nested(3000,'request'),
 'native.remote.stdout.poll':nested(100,'native.transport.request'),
 'temporal.issuer.pg.connect.max':fixed(3000,{kind:'derived',reason:'Startup cap'}),
 'temporal.issuer.pg.idle':library(1000,'startup','Idle retirement'),
 'temporal.control.connect':library(({limits})=>limits.startupMs,'startup','Connect default'),
 'temporal.schedule.connect':library(({limits})=>limits.startupMs,'startup','Connect default'),
 'runtime.runWindow.cap':fixed(86400000), 'aws.issuer.attempts':library(3,'request','Retry default',{unit:'count'}),
 'runtime.shutdown.watchdog':fixed(({limits})=>limits.shutdownMs+1000),
 'runtime.startup':fixed(({limits})=>limits.startupMs), 'runtime.request':fixed(({limits})=>limits.requestMs),
 'conversation.http.request':fixed(3000),
 'native.allocator.request':fixed(30000),
 'gateway.runAllocation.read':fixed(({limits})=>Math.min(limits.requestMs,GATEWAY_RUN_ALLOCATION_READ_MAX_MS)),
 'gateway.completion.admission':fixed(GATEWAY_COMPLETION_ADMISSION_MS),
 'gateway.document.vision':fixed(GENERAL_READ_VISION_TIMEOUT_MS,{reason:'Pinned Core tariff evidence bound; not an owned timer.'}),
 'gateway.generalRead.defaultRuntime':fixed(GENERAL_READ_DEFAULT_RUNTIME_SECONDS,{unit:'seconds'}),
 'authority.current.request':fixed(10000),
 'authority.current.lease':fixed(30000),
 'authority.current.proposal':fixed(900000),
 'authority.gateway.request':fixed(30000),
 'authority.gateway.cleanup':fixed(3000),
 'native.read.request':fixed(3000),
 'native.retained.source':fixed(15000),
 'native.continuation.request':fixed(3000),
 'native.continuation.authority':fixed(30000),
 'native.continuation.admission':fixed(300000),
 'native.execution.skew':fixed(1000),
 'native.execution.request':fixed(10000),
 'native.execution.cleanup':fixed(3000),
 'native.intent.prepare':fixed(30000),
 'control.session.diagnostics.burst':fixed(20,{unit:'count'}), 'control.session.diagnostics.window':fixed(60000),
 'proxy.diagnostics.burst':fixed(20,{unit:'count'}), 'proxy.diagnostics.window':fixed(60000),
 'conversation.window.slack':fixed(50),
 'conversation.retention.inventory':fixed(5000),
 'objective.lifecycle.poll':fixed(30000),
 'objective.lifecycle.retry':fixed(120000),
 'schedule.request.max':fixed(30000),
 'schedule.native.request':fixed(10000),
 'temporal.bootstrap.window':fixed(180000),
 'temporal.bootstrap.retry':fixed(2500),
 'temporal.bootstrap.reserve':fixed(10000),
 'temporal.issuer.retirement':fixed(30000),
 'retention.journal.request':fixed(10000),
 'retention.ledger.head':fixed(10000),
 'retention.storage.request':fixed(15000),
 'native.pinned.transport':fixed(30000),
 'browser.action':fixed(5000),
 'browser.navigation':fixed(60000),
 'browser.takeover.settle':fixed(5000),
 'browser.takeover.hard':fixed(130000),
 'browser.takeover.idle':fixed(600000),
 'host.currentness':fixed(30000),
 'host.process.fresh':fixed(1000),
 'browser.process.exit':fixed(25000),
 'host.teardown.max':fixed(130000),
 'intents.snapshot':fixed(3000),
 'reads.snapshot':fixed(3000),
 'sandbox.observe':fixed(1000),
 'sandbox.cleanup':fixed(5000),
 'browser.cleanup.default':fixed(30000),
 'browser.cleanup.max':fixed(130000),
 'egress.admit':fixed(10000),
 'egress.idle':fixed(120000),
 'egress.connect':fixed(10000),
 'host.process.timeout':fixed(25000),
 'host.process.arm':fixed(5000),
 'host.process.poll':fixed(100),
 'browser.process.poll':fixed(100),
 'host.teardown.local':fixed(30000),
 'host.teardown.host':fixed(30000),
 'objective.runtime.request':fixed(3000),
 'sandbox.deadline':fixed(30000),
 'sandbox.probe':fixed(10000),
 'browser.cleanup.settle':fixed(131000),
 'native.tls.socket':unbounded('native.transport.request','Request signal'),
 'temporal.issuer.challenge':fixed(15000), 'temporal.issuer.certificate':fixed(300000),
 'temporal.issuer.http.headers':library(60000,'startup','HTTP default'),
 'temporal.issuer.http.request':library(300000,'startup','HTTP default'),
 'temporal.issuer.http.keepAlive':library(5000,'startup','HTTP default'),
 'reads.runtime.max':fixed(60000), 'intents.runtime.max':fixed(60000),
 'intents.availability':fixed(30000),
 'withdrawal.propagation':fixed(30000),
 'withdrawal.staleness':fixed(30000),
 'artifact.download.ttl':fixed(60000),
 'material.initialize.request':fixed(5000),
 'temporal.issuer.registration.query':fixed(3000),
 'temporal.token.disabled.refresh':fixed(1000),
 'temporal.token.disabled.request':fixed(1000),
 'native.gateway.read.request':fixed(3000),
 'temporal.keepAlive.period':library(30000,'turn','gRPC default'),
 'temporal.keepAlive.timeout':library(15000,'turn','gRPC default'),
 'temporal.retry.attempts':library(10,'request','gRPC default',{unit:'count'}),
 'temporal.retry.initial':library(100,'request','Retry default'),
 'temporal.retry.resourceExhausted':library(1000,'request','Retry default'),
 'temporal.retry.max':library(5000,'request','Retry ceiling'),
 'native.process.poll':fixed(10),
 'native.process.leaseTick':fixed(1000),
 'native.tls.challenge':fixed(3000),
 'native.tls.exchange':fixed(30000),
 'native.allocator.settle':fixed(15000),
 'native.allocator.poll':fixed(1000),
 'native.allocator.startupPoll':fixed(1000),
 'native.poststart.challenge':fixed(15000),
 'native.routine.receipt':fixed(30000),
 'native.read.observation':fixed(3000),
 'host.expiry.tick':fixed(1000),
 'temporal.issuer.settlement':fixed(2500),
 'temporal.issuer.registration.cleanup':fixed(2000),
 'temporal.issuer.http.close':fixed(2000),
 'core.request':fixed(({limits})=>limits.requestMs,{parent:'request',inherits:'request'}),
 'memory.request.max':fixed(30000),
 'settings.tenant.request.max':fixed(30000),
 'settings.user.request.max':fixed(10000),
 'native.intent.availability':fixed(3000),
 'native.read.reference':fixed(3000),
 'native.delegation.request':fixed(3000),
 'native.delegation.attended':fixed(1800000),
 'native.delegation.occurrence':fixed(900000),
 'native.delegation.consent':fixed(2592000000),
 'native.delegation.token':fixed(60000),
 'owner.request.cap':fixed(OWNER_REQUEST_MAX_MS),
 'artifact.authority.request':nested(3000,'request'),
 'native.retained.credential':fixed(30000,{kind:'derived',reason:'Signed expiry cap'}),
 'budget.margin':fixed(HOT_PATH_BUDGET_MARGIN_MS),
 'runner.call.load':nested(({limits})=>Math.min(RUNNER_LOAD_MAX_MS,limits.requestMs-HOT_PATH_BUDGET_MARGIN_MS),'request'),
 'runner.checkpoint.complete':nested(({limits})=>Math.min(RUNNER_LOAD_MAX_MS,limits.requestMs-HOT_PATH_BUDGET_MARGIN_MS),'request'),
 'runner.call.publish':nested(({limits})=>Math.min(RUNNER_LOAD_MAX_MS,limits.requestMs-HOT_PATH_BUDGET_MARGIN_MS),'request'),
 'runner.replay.delays':fixed(RUNNER_REPLAY_DELAYS_MS),
 'runner.stage.load':{kind:'serial',ms:({limits})=>2*Math.min(RUNNER_LOAD_MAX_MS,limits.requestMs-HOT_PATH_BUDGET_MARGIN_MS)+RUNNER_REPLAY_DELAYS_MS[0],children:['runner.call.load','runner.replay.pause','runner.call.load']},
 'runner.replay.pause':fixed(RUNNER_REPLAY_DELAYS_MS[0]),
 'runner.stage.runtime':nested(({limits})=>Math.min(RUNNER_LOAD_MAX_MS,limits.requestMs-HOT_PATH_BUDGET_MARGIN_MS),'runtime.preparation'),
 'runner.stage.local':nested(LOCAL_STAGE_MS,'runtime.preparation'),
 'runner.stage.setup':nested(SETUP_STAGE_MS,'turn'),
 'runtime.preparation':{kind:'serial',parent:'turn',ms:ACTIVITY_PREPARATION_MAX_MS,children:['runner.stage.runtime','runner.stage.local']},
 'runner.native.router':nested(RUNNER_NATIVE_STARTUP_ROUTER_MS,'runner.call.load'),
 'runner.native.receiver':nested(RUNNER_NATIVE_STARTUP_RECEIVER_MS,'runner.native.router'),
 ...Object.fromEntries(Object.entries(RUNNER_SESSION_RPC_MS).flatMap(([operation,ms])=>[
  ['runner.session.'+operation,nested(ms,'request')],['control.session.'+operation,nested(controlSessionRpcMs(operation),'runner.session.'+operation)],
 ])),
 'runner.session.store':{kind:'serial',parent:'turn',ms:RUNNER_SESSION_STORE_CALL_MS,children:['runner.session.load','runner.session.append'],reason:'The SDK bound-store append may first load a subpath, then append; both RPCs run within its 15 s call and the active turn.'},
 'control.capture':nested(CONTROL_CHECKPOINT_CAPTURE_MS,'runner.call.load'),
 'control.capture.channel':nested(CONTROL_CAPTURE_CHANNEL_MS,'control.capture'),
 'router.capture':nested(TASK_ROUTER_CAPTURE_MS,'control.capture.channel'),
 'runner.capture':nested(RUNNER_CAPTURE_MS,'router.capture'),
 'runner.startup.minShutdown':fixed(RUNNER_STARTUP_MIN_SHUTDOWN_MS),
 'runner.startup.shutdownSteps':fixed(RUNNER_STARTUP_SHUTDOWN_STEPS,{unit:'count'}),
 'runner.startup.settlement':fixed(RUNNER_STARTUP_SETTLEMENT_MS),
 'runner.startup.catchCleanup':fixed(RUNNER_STARTUP_CATCH_CLEANUP_MS),
 'runner.startup.cleanup':fixed(RUNNER_STARTUP_CLEANUP_MS),
 'runner.startup.margin':fixed(RUNNER_STARTUP_MARGIN_MS),
 'broker.poll.completionDefer':fixed(CONTROL_CHECKPOINT_CAPTURE_MS,{parent:'control.capture',reason:'Broker poll defers while completion capture holds the run.'}),
 'router.capture.selfStop':fixed(TASK_ROUTER_CAPTURE_MS,{parent:'router.capture',reason:'An in-flight capture retains its allowance after self-stop.'}),
 'native.client.request':fixed(3000), 'native.client.startup':fixed(RUNNER_LOAD_MAX_MS),
 'native.transport.request':fixed(8000), 'native.independent.request':fixed(3000), 'native.independent.close':fixed(3000),
 'native.launch.shutdown':fixed(1000), 'native.prepared.request':fixed(3000), 'native.prepared.wait':fixed(30000),
 'native.prepared.poll':fixed(100), 'native.prepared.cleanup':fixed(30000), 'native.session.registration':fixed(3000),
 'native.session.owner':fixed(3000), 'native.session.http':fixed(3000), 'runtime.original.reconcile':fixed(15000),
 'runtime.objective.lifecycle':fixed(15000), 'runtime.objective.owner':fixed(10000),
 'http.request':fixed(({limits})=>limits.requestMs+1000), 'http.headers':fixed(({limits})=>limits.requestMs), 'http.keepAlive':fixed(RUNTIME_KEEP_ALIVE_MS),
 'pg.control.connect':library(({limits})=>limits.requestMs,'request','Request limit'),
 'pg.control.idle':library(10000,'request','Idle retirement'),
 'pg.control.query':library(({limits})=>limits.requestMs,'request','Request limit'),
 'broker.native.request':fixed(10000), 'broker.poll':fixed(1000), 'runner.terminal.attempt':fixed(3000),
 'continuation.poll':fixed(100), 'conversation.events.poll':fixed(100), 'conversation.events.idleRecheck':fixed(10000),
 'conversation.events.subscription':fixed(30000), 'continuation.journal.deadline':fixed(3000),
 'runner.bootstrap.files.request':fixed(5000), 'runner.poststart.bootstrap':fixed(20000), 'runner.poststart.step':fixed(3000),
 'runner.poststart.pending.poll':fixed(250), 'runner.poststart.challenge.ceiling':fixed(15000),
 'runner.poststart.transport.request':fixed(3000), 'runner.poststart.exchange.request':fixed(3000), 'runner.poststart.metadata.read':fixed(2000),
 'runner.task.bootstrap.poll':fixed(100), 'temporal.connect':fixed(null,{kind:'library',sdkOwned:true,configurable:false,owner:'sdk-core',reason:'Worker NativeConnection has no configurable connect timeout; sdk-core owns the native default, which the JavaScript options do not expose.'}),
 'worker.shutdown.grace':fixed(({limits})=>limits.shutdownMs), 'worker.shutdown.force':fixed(({limits})=>limits.shutdownMs+1000),
 'owner.startup.pair.window':fixed(180000), 'owner.startup.pair.retry':fixed(2500), 'owner.startup.pair.settle':fixed(1000),
 'owner.startup.pair.watchdog':fixed(200000), 'owner.request':fixed(({ownerRequestMs})=>ownerRequestMs),
 'pg.owner.idle':library(10000,'owner.request','Idle retirement'), 'owner.diagnostics.burst':fixed(20,{unit:'count'}),
 'owner.diagnostics.window':fixed(60000), 'owner.idle.keepAlive':fixed(0), 'owner.idle.initialDelay':fixed(60000),
 'proxy.exchange.max':fixed(15000), 'proxy.exchange.min':fixed(8000), 'proxy.exchange.carrier':fixed(10000),
 'proxy.request.check':fixed(26000), 'proxy.request.cleanup':fixed(26000), 'proxy.bootstrap':fixed(35000),
 'proxy.pair.fetch':fixed(3000), 'proxy.pair.lease':fixed(30000),
 'proxy.boto.connect':library(1000,'proxy.exchange.max','Boto default'),
 'proxy.boto.read':library(1000,'proxy.exchange.max','Boto default'),
 'proxy.boto.attempts':library(1,'proxy.exchange.max','Retry default',{unit:'count'}),
 'proxy.uvicorn.keepAlive':library(5000,'proxy.exchange.max','Uvicorn default'),
 'proxy.uvicorn.shutdown':unbounded('shutdown','No local timeout'),
 'fetch.connect':library(10000,'request','Request signal'),
 'fetch.headers':library(300000,'request','Request signal'),
 'fetch.body':library(300000,'request','Request signal'),
 'aws.connection':unbounded('request','Request signal'),
 'aws.request':unbounded('request','Request signal'),
 'aws.socketAcquisitionWarning':fixed(3000,{kind:'derived',reason:'Smithy socket pool warning delay only; preserves the implicit 2000 + 1000 ms logging threshold and does not bound an operation.'}),
 'aws.attempts':library(1,'request','Retry default',{unit:'count'}),
 ...Object.fromEntries(['control','owner'].flatMap(role=>['statement','lock','idleInTransaction'].map(kind=>['pg.'+role+'.'+kind,unbounded(role==='owner'?'owner.request':'request','Operation signal')]))),
 'native.allocator.startup':fixed(180000), 'native.release.request':fixed(10000), 'native.replay.minAttempt':fixed(1000),
 'activity.cleanup.attempt':fixed(3000), 'activity.load':fixed(3000), 'activity.runtime':fixed(3000), 'activity.heartbeat':fixed(5000),
 'continuation.cleanup.ack':fixed(100), 'continuation.read.backoff.first':fixed(500), 'continuation.read.backoff.max':fixed(5000),
 'continuation.read.unavailable.limit':fixed(2,{unit:'count'}), 'runner.session.cleanup':fixed(1000),
 'proxy.request.poll':fixed(5000), 'proxy.connection':fixed(900000), 'proxy.native.start':fixed(5000),
 'proxy.native.stop':fixed(1000), 'proxy.resources.close':fixed(1000), 'proxy.owner.settle':fixed(1000),
 'proxy.startup.pair.window':fixed(180000), 'proxy.startup.pair.retry':fixed(2500),
 'pg.owner.connect':library(({ownerRequestMs})=>ownerRequestMs,'owner.request','Request limit'),
 'pg.owner.query':library(({ownerRequestMs})=>ownerRequestMs,'owner.request','Request limit'),
 'owner.shutdown.watchdog':fixed(({ownerRequestMs})=>ownerRequestMs+1000),
 'workflow.conversation.startToClose':fixed(1800000,{duration:'30 minutes'}),
 'workflow.conversation.heartbeat':fixed(30000,{duration:'30 seconds'}),
 'workflow.recovery.startToClose':fixed(20000,{duration:'20 seconds'}),
 'workflow.recovery.scheduleToClose':fixed(240000,{duration:'240 seconds'}),
 'workflow.recovery.retry.initial':fixed(1000,{duration:'1 second'}),
 'workflow.recovery.retry.maximum':fixed(10000,{duration:'10 seconds'}),
 'workflow.objective.startToClose':fixed(60000,{duration:'1 minute'}),
 'workflow.schedule.startToClose':fixed(60000,{duration:'1 minute'}),
 'workflow.schedule.settle':fixed(120000,{duration:'2 minutes'}),
 'sdk.load':library(60000,'turn','SDK default'),
 'sdk.runEnd':library(600000,'turn','SDK ceiling'),
 'sdk.append.retryAttempts':library(3,'turn','SDK default',{unit:'count'}),
 'sdk.append.retryDelays':library([200,800],'turn','SDK default'),
 'sdk.api':unbounded('turn','Pinned unset'),
};

// These edges describe actual owners; separately owned lifetimes carry explicit owner metadata.
const NESTED_PARENTS={
 "native.intent.availability":"request",
 "native.read.reference":"request",
 "native.delegation.request":"request",
 "native.client.request": "request",
 "native.client.startup": "request",
 "native.transport.request": "request",
 "native.independent.request": "request",
 "native.launch.shutdown": "shutdown",
 "native.prepared.request": "native.prepared.wait",
 "native.prepared.wait": "turn",
 "native.session.registration": "request",
 "native.session.owner": "request",
 "native.session.http": "request",
 "runtime.objective.lifecycle": "request",
 "runtime.objective.owner": "request",
 "broker.native.request": "request",
 "runner.terminal.attempt": "request",
 "conversation.events.subscription": "turn",
 "continuation.journal.deadline": "request",
 "runner.bootstrap.files.request": "startup",
 "runner.poststart.bootstrap": "startup",
 "runner.poststart.step": "runner.poststart.bootstrap",
 "runner.poststart.transport.request": "runner.poststart.bootstrap",
 "runner.poststart.exchange.request": "runner.poststart.bootstrap",
 "runner.poststart.metadata.read": "runner.poststart.bootstrap",
 "owner.startup.pair.window": "owner.startup.pair.watchdog",
 "proxy.exchange.max": "proxy.request.check",
 "proxy.exchange.min": "proxy.exchange.max",
 "proxy.exchange.carrier": "proxy.request.check",
 "proxy.request.check": "proxy.connection",
 "proxy.pair.fetch": "proxy.pair.lease",
 "native.allocator.startup": "turn",
 "native.allocator.request": "native.allocator.startup",
 "native.release.request": "request",
 "activity.load": "runtime.preparation",
 "activity.runtime": "runtime.preparation",
 "proxy.native.start": "startup",
 "proxy.startup.pair.window": "turn",
 "gateway.runAllocation.read": "request",
 "gateway.completion.admission": "request",
 "native.read.request": "request",
 "native.retained.source": "request",
 "native.continuation.request": "native.continuation.authority",
 "native.continuation.authority": "native.continuation.admission",
 "native.continuation.admission": "turn",
 "native.execution.request": "request",
 "native.intent.prepare": "turn",
 "proxy.request.poll": "proxy.connection",
 "authority.current.request": "authority.gateway.request",
 "temporal.bootstrap.retry": "temporal.bootstrap.window",
 "browser.process.exit": "browser.cleanup.default",
 "host.process.timeout": "host.teardown.local",
 "host.process.arm": "host.process.timeout",
 "host.process.poll": "host.process.timeout",
 "browser.process.poll": "browser.process.exit",
 "sandbox.observe": "sandbox.deadline",
 "egress.admit": "egress.idle",
 "egress.connect": "egress.idle",
 "native.process.poll": "native.independent.request",
 "native.process.leaseTick": "turn",
 "native.tls.challenge": "native.tls.exchange",
 "native.allocator.poll": "native.allocator.settle",
 "native.allocator.startupPoll": "native.allocator.startup",
 "runner.replay.pause": "runner.stage.load",
 "continuation.read.backoff.first": "turn",
 "continuation.read.backoff.max": "turn",
 "activity.heartbeat": "workflow.conversation.heartbeat",
 "broker.poll": "turn",
 "continuation.poll": "turn",
 "native.prepared.poll": "native.prepared.wait",
 "conversation.events.poll": "conversation.events.subscription",
 "conversation.events.idleRecheck": "conversation.events.subscription",
 "runner.poststart.pending.poll": "runner.poststart.bootstrap",
 "runner.task.bootstrap.poll": "turn",
 "owner.startup.pair.retry": "owner.startup.pair.window",
 "proxy.startup.pair.retry": "proxy.startup.pair.window"
};
const AUDITED_NESTING={
 "workflow.recovery.retry.maximum":["workflow.recovery.scheduleToClose","Temporal maximum backoff runs between recovery attempts inside their schedule-to-close window."],
 "workflow.recovery.retry.initial":["workflow.recovery.scheduleToClose","Temporal initial backoff runs between recovery attempts inside their schedule-to-close window."],
 "conversation.http.request": [
  "request",
  "Control HTTP handling encloses the conversation submit/history/cancel lifetime and forwards the request signal."
 ],
 "authority.gateway.request": [
  "request",
  "Control HTTP handling encloses general-read dispatch; its 30 s cap can outlast the 25 s request and is cut short by that signal."
 ],
 "conversation.retention.inventory": [
  "request",
  "Control retention discovery passes the serving request signal into the bounded inventory scan."
 ],
 "native.pinned.transport": [
  "request",
  "The pinned HTTPS transport is called by capability clients with their request AbortSignal; its 30 s socket ceiling is not a separate lifetime."
 ],
 "browser.action": [
  "turn",
  "Playwright action timeouts run only while the conversation owns the browser and its turn-bound egress grant."
 ],
 "browser.navigation": [
  "turn",
  "Playwright navigation runs within the conversation browser lifetime; the turn owner revokes egress and closes the query."
 ],
 "intents.snapshot": [
  "request",
  "Availability reads carry their caller signal during setup and per-tool rechecks; the 3 s snapshot is a request child."
 ],
 "reads.snapshot": [
  "request",
  "Availability reads carry their caller signal during setup and per-tool rechecks; the 3 s snapshot is a request child."
 ],
 "browser.cleanup.default": [
  "browser.cleanup.settle",
  "cleanupConversation awaits browserRun.settle under the 131 s cleanup wait; the lifecycle default owns 30 s within it."
 ],
 "egress.idle": [
  "turn",
  "Each run-owned proxy socket has an idle timeout while the grant expiry and run/host cancellation close the proxy."
 ],
 "objective.runtime.request": [
  "turn",
  "Objective prepare and result capture use the smaller of their 3 s cap and the caller original/turn deadline."
 ],
 "intents.availability": [
  "request",
  "The control intent mount is called through HTTP with the request signal; its 30 s cap can exceed the enclosing 25 s request."
 ],
 "native.gateway.read.request": [
  "request",
  "The control native gateway forwards availability reads within the incoming HTTP request signal."
 ],
 "native.tls.exchange": [
  "native.transport.request",
  "Task-router send runs inside the forwarding lifetime (ordinary native transport request; longer prepare/start/capture variants also cap it)."
 ],
 "native.read.observation": [
  "request",
  "The mode observation reader receives the execution caller deadline and signal through the control reads owner; the 3 s core-client cap is not a separate enclosing operation."
 ],
 "temporal.issuer.settlement": [
  "temporal.issuer.retirement",
  "The issuer CLI retirement lifetime encloses entrypoint.close, whose individual child settlement waits are 2.5 s."
 ],
 "temporal.issuer.registration.cleanup": [
  "request",
  "Despite its historical name this is the 2 s pool-borrow wait during a registration transaction, with the issuer request signal."
 ],
 "temporal.issuer.http.close": [
  "temporal.issuer.settlement",
  "Entrypoint closeChild(service) waits 2.5 s while service.close waits up to 2 s for the listener."
 ],
 "runtime.original.reconcile": [
  "workflow.recovery.startToClose",
  "The recovery activity has a 20 s Temporal attempt around createReconcileActivity's 15 s owner; the one-shot CLI uses the same cap."
 ],
 "proxy.bootstrap": [
  "proxy.connection",
  "ASGI admission occurs after the TLS connection arrival timestamp; the existing 35 s bootstrap is inside its 900 s connection lifetime."
 ],
 "workflow.conversation.heartbeat": [
  "workflow.conversation.startToClose",
  "Temporal heartbeat timeout belongs to the executeConversation activity attempt, whose start-to-close limit is 30 minutes."
 ],
 "workflow.recovery.startToClose": [
  "workflow.recovery.scheduleToClose",
  "Temporal limits each recovery attempt to 20 s inside its 4 minute schedule-to-close retry window."
 ]
};
const DERIVED_REASONS={
 "runner.session.cleanup":"Historical 1 s helper default; production createOwnedRuntimeSdkSession explicitly supplies the shutdown root, so this row does not start a separate cleanup timer.",
 "objective.lifecycle.poll":"Durable workflow condition wait interval between activity calls; input.notAfterMs/effect expiry are dynamic, not a fixed enclosing request hop.",
 "objective.lifecycle.retry":"Durable workflow retry delay between separate activity calls; not a timeout enclosing those activities.",
 "temporal.token.disabled.refresh":"Inert validated placeholder when the token writer is disabled; no refresh timer or operation is started.",
 "temporal.token.disabled.request":"Inert validated placeholder when the token writer is disabled; no request or timeout is started.",
 "native.allocator.settle":"Containment polling allowance added to native.allocator.request for the fresh stop operation; not an independent operation timeout.",
 "host.expiry.tick":"Maximum observation tick; each wait is shortened to the dynamically issued host/run expiry and ends on cancellation.",
 "owner.startup.pair.settle":"Additive settlement slack on one startup pair read (maxRequestMs + 1 s), inside the owner startup watchdog; not a separate timer lifetime.",
 "proxy.owner.settle":"Additive synchronous future settlement slack after the owner request deadline; not an independently started operation.",
 "workflow.schedule.settle":"Durable workflow sleep between completed/unknown activity attempts; the schedule wrapper has no fixed end-to-end timeout.",
 "memory.request.max":"Request ceiling",
 "settings.tenant.request.max":"Request ceiling",
 "settings.user.request.max":"Request ceiling",
 "native.delegation.attended":"Signed expiry",
 "native.delegation.occurrence":"Signed expiry",
 "native.delegation.consent":"Signed expiry",
 "native.delegation.token":"Signed expiry",
 "owner.request.cap":"Request ceiling",
 "runtime.runWindow.cap": "Run ceiling",
 "runtime.startup": "Inherited root",
 "runtime.request": "Inherited root",
 "gateway.document.vision": "Tariff ceiling",
 "gateway.generalRead.defaultRuntime": "Profile ceiling",
 "authority.current.lease": "Lease age cap",
 "authority.current.proposal": "Fact expiry",
 "native.execution.skew": "Clock skew cap",
 "control.session.diagnostics.burst": "Rate count",
 "control.session.diagnostics.window": "Rate window",
 "proxy.diagnostics.burst": "Rate count",
 "proxy.diagnostics.window": "Rate window",
 "conversation.window.slack": "Deadline slack",
 "schedule.request.max": "Request ceiling",
 "schedule.native.request": "Request ceiling",
 "temporal.bootstrap.reserve": "Startup reserve",
 "browser.takeover.settle": "Drain grace",
 "browser.takeover.hard": "Drain ceiling",
 "browser.takeover.idle": "Idle lease age",
 "host.currentness": "Source age cap",
 "host.process.fresh": "Process age cap",
 "host.teardown.max": "Cleanup ceiling",
 "browser.cleanup.max": "Cleanup ceiling",
 "reads.runtime.max": "Read ceiling",
 "intents.runtime.max": "Intent ceiling",
 "temporal.issuer.challenge": "Fact expiry",
 "temporal.issuer.certificate": "Certificate TTL",
 "withdrawal.propagation": "Evidence bound",
 "withdrawal.staleness": "Evidence age",
 "artifact.download.ttl": "Link TTL",
 "native.poststart.challenge": "Fact expiry",
 "native.routine.receipt": "Receipt age",
 "budget.margin": "Nesting policy",
 "runner.replay.delays": "Request pauses",
 "runner.startup.minShutdown": "Shutdown floor",
 "runner.startup.shutdownSteps": "Shutdown count",
 "runner.startup.settlement": "Publish reserve",
 "runner.startup.cleanup": "Cleanup reserve",
 "runner.startup.margin": "Startup slack",
 "broker.poll.completionDefer": "Capture bound",
 "router.capture.selfStop": "Capture retained",
 "runner.poststart.challenge.ceiling": "Expiry cap",
 "native.replay.minAttempt": "Replay floor",
 "continuation.read.unavailable.limit": "Refusal count",
 "owner.diagnostics.burst": "Rate count",
 "owner.diagnostics.window": "Rate window",
 "proxy.pair.lease": "Fact expiry",
 "core.request": "Shared signal P6"
};
const LIBRARY_OWNERS={
 "temporal.issuer.registration.query":["request","Request signal"],
 "http.request": [
  "request",
  "Response grace"
 ],
 "http.headers": [
  "request",
  "Request limit"
 ],
 "http.keepAlive": [
  "request",
  "Idle socket"
 ],
 "worker.shutdown.grace": [
  "shutdown",
  "Shutdown limit"
 ],
 "worker.shutdown.force": [
  "shutdown",
  "Shutdown grace"
 ],
 "owner.idle.keepAlive": [
  "owner.request",
  "Idle disabled"
 ],
 "owner.idle.initialDelay": [
  "owner.request",
  "TCP keepalive"
 ]
};
const INDEPENDENT_OWNERS={
 "runtime.shutdown.watchdog": [
  "runtime.process-exit",
  "CLI process-exit backstop starts on termination outside the cancelled runtime; no request or turn encloses this watchdog."
 ],
 "authority.gateway.cleanup": [
  "gateway.cleanup",
  "Gateway dispatch finally starts a fresh cleanup lifetime after its request closes; the expired dispatch signal is deliberately not inherited."
 ],
 "native.execution.cleanup": [
  "intent.execution-cleanup",
  "Durable command execution cleanup starts a fresh lifetime after dispatch fails or expires; no live request signal encloses settlement."
 ],
 "temporal.bootstrap.window": [
  "temporal.bootstrap-command",
  "The pre-service bootstrap command owns its whole retry window before runtime construction; runtime startupMs does not enclose it."
 ],
 "temporal.issuer.retirement": [
  "temporal.issuer-retirement",
  "CLI retirement starts after aborting issuer startup/service and owns fresh cleanup; no live service request or startup deadline encloses it."
 ],
 "retention.journal.request": [
  "retention.journal-wait",
  "Each pool lease/statement wait has a fresh deadline, including offline recovery and unlock/rollback; the journal has no overall bounded transaction or enclosing request signal."
 ],
 "retention.ledger.head": [
  "retention.ledger-head",
  "Ledger head creates its own lifetime for startup/recovery and readiness verification; those owners do not impose a common outer timed hop or forward a signal."
 ],
 "retention.storage.request": [
  "retention.version-storage",
  "Source-qualified retention storage starts a fresh timer per head/delete; the purge/recovery coordinator has no enclosing operation deadline, and live purge is disabled."
 ],
 "sandbox.cleanup": [
  "sandbox.probe-retirement",
  "Readiness cancels its SDK startup timer before closing the query and awaiting its consumer with a fresh cleanup timer; no active startup deadline encloses it."
 ],
 "host.teardown.local": [
  "host.local-retirement",
  "The source-qualified host teardown starts its local deadline after run cancellation, without the cancelled run signal or any outer cleanup timer."
 ],
 "host.teardown.host": [
  "host.physical-retirement",
  "Host destruction starts a fresh deadline after local cleanup completes or expires; the local phase cannot cancel this backstop."
 ],
 "sandbox.deadline": [
  "sandbox.sdk-probe",
  "The readiness CLI/source-qualified host probe starts this timer after namespace probes; no runtime preparation timer is composed around these entrypoints."
 ],
 "sandbox.probe": [
  "sandbox.namespace-probe",
  "Each namespace subprocess is timed before probeSdkSandboxStartup starts its deadline; the readiness CLI has no enclosing operation timer."
 ],
 "browser.cleanup.settle": [
  "conversation.browser-retirement",
  "Conversation finally grants browser settlement its fresh 131 s wait after the query/turn is stopped; no live turn deadline encloses that cleanup wait."
 ],
 "material.initialize.request": [
  "material.init-delivery",
  "The one-shot init-container command bounds delivery before a runtime is created; no runtime startup or request lifetime encloses the material fetch."
 ],
 "runner.startup.catchCleanup": [
  "runner.failed-startup-cleanup",
  "The activity catch path gives query close a fresh wait after the failed startup/turn lifetime; later publication and final cleanup have separately reserved time."
 ],
 "owner.startup.pair.watchdog": [
  "owner.process-startup",
  "The executable watchdog surrounds config, material, pair discovery and listen before serving; no request or runtime startup hop encloses this process-level owner."
 ],
 "owner.request": [
  "owner.https-request",
  "The separate owner HTTPS service starts this request lifetime at ingress; a control request/turn does not own or enclose the owner server request."
 ],
 "owner.shutdown.watchdog": [
  "owner.process-exit",
  "The executable starts this exit backstop after stopping the owner service; no live owner request or startup lifetime encloses it."
 ],
 "proxy.connection": [
  "proxy.tls-connection",
  "The TLS protocol timestamps a newly accepted connection before request admission; no request or turn exists yet to enclose its maximum age."
 ],
 "proxy.request.cleanup": [
  "proxy.request-retirement",
  "RequestLifetime.close first denies/cancels the request, then asyncio.wait gets a fresh 26 s timeout; the expired request deadline does not enclose this quarantine wait."
 ],
 "native.independent.close": [
  "native.supervisor-retirement",
  "Supervisor close uses bounded(undefined, ...) after cancellation/lease expiry, with separate graceful and forced waits; no live task request signal encloses them."
 ],
 "native.prepared.cleanup": [
  "native.prepared-retirement",
  "Prepared kickoff close aborts startup then creates a fresh 30 s lifetime for allocation settlement/controller close, without the cancelled caller signal."
 ],
 "activity.cleanup.attempt": [
  "activity.resource-retirement",
  "Conversation finally attempts each resource close with a fresh 3 s lifetime after the turn is stopped; no single active turn/request deadline encloses those attempts."
 ],
 "proxy.native.stop": [
  "proxy.native-retirement",
  "The native context exit runs in finally with a fresh bounded wait after service operation cancellation; no live request lifetime encloses it."
 ],
 "proxy.resources.close": [
  "proxy.process-retirement",
  "Executable finally retires clients/transports after cancelling its service operation; this process resource wait has no enclosing live request deadline."
 ],
 "continuation.cleanup.ack": [
  "continuation.terminal-ack",
  "Lifecycle finish acknowledges pending controls with a fresh 100 ms lifetime after aborting the polling/turn signal; no live polling deadline encloses it."
 ],
 "workflow.conversation.startToClose": [
  "temporal.conversation-attempt",
  "Temporal owns the durable activity attempt before and beyond the runner turn, including kickoff/poll/cleanup; there is no enclosing fixed workflow timeout."
 ],
 "workflow.recovery.scheduleToClose": [
  "temporal.recovery-window",
  "Temporal owns the recovery retry window after a lost conversation activity; the workflow has no enclosing fixed timeout and the lost turn may already be expired."
 ],
 "workflow.objective.startToClose": [
  "temporal.objective-attempt",
  "Temporal bounds one objective lifecycle activity attempt; the durable driver spans multiple attempts and has dynamic input expiry rather than a fixed enclosing hop."
 ],
 "workflow.schedule.startToClose": [
  "temporal.schedule-attempt",
  "Temporal bounds each schedule dispatch/reconcile/cancel activity; the durable wrapper remains open across attempts and sleeps without a fixed enclosing timeout."
 ]
};
function ownedHop(id,row){
 if(AUDITED_NESTING[id]){const [parent,reason]=AUDITED_NESTING[id];return {...row,kind:'nested',parent,reason};}
 if(NESTED_PARENTS[id])return {...row,kind:'nested',parent:NESTED_PARENTS[id]};
 if(DERIVED_REASONS[id])return {...row,kind:'derived',reason:DERIVED_REASONS[id]};
 if(LIBRARY_OWNERS[id]){const [boundedBy,reason]=LIBRARY_OWNERS[id];return {...row,kind:'library',boundedBy,reason};}
 if(INDEPENDENT_OWNERS[id]){const [owner,reason]=INDEPENDENT_OWNERS[id];return {...row,kind:'independent',owner,reason};}
 if(row.kind==='independent')throw Error('Unclassified budget owner: '+id);
 return row;
}
export const HOP=freeze(Object.fromEntries(Object.entries(HOP_DEFINITIONS).map(([id,row])=>[id,ownedHop(id,row)])));

export const WORKFLOW_BUDGETS=freeze(Object.fromEntries(Object.entries(HOP).filter(([id])=>id.startsWith('workflow.')).map(([id,row])=>[id,row.duration])));

const exception=(hop,rule,removedBy,reason,limits={})=>({hop,rule,removedBy,reason,recordedAt:'2026-10-21',...limits});
export const HOT_PATH_BUDGET_EXCEPTIONS=freeze([
 exception('authority.gateway.request','nested-margin','P6','The read-dispatch cap exceeds control HTTP; request cancellation remains the effective outer bound.',{parent:'request',maxChildMs:30000,minParentMs:25000}),
 exception('authority.gateway.request','adr-margin','P6','The read-dispatch cap exceeds control HTTP; request cancellation remains the effective outer bound.'),
 exception('native.pinned.transport','nested-margin','P6','The pinned socket ceiling exceeds the capability request; the supplied request signal aborts the transport first.',{parent:'request',maxChildMs:30000,minParentMs:25000}),
 exception('native.pinned.transport','adr-margin','P6','The pinned socket ceiling exceeds the capability request; the supplied request signal aborts the transport first.'),
 exception('intents.availability','nested-margin','P6','Intent availability retains its 30 s cap inside control HTTP and inherits request cancellation.',{parent:'request',maxChildMs:30000,minParentMs:25000}),
 exception('intents.availability','adr-margin','P6','Intent availability retains its 30 s cap inside control HTTP and inherits request cancellation.'),
 exception('native.tls.exchange','nested-margin','P5','TLS send retains its 30 s ceiling inside task-router forwarding; the forwarding signal and candidate expiry cut it short.',{parent:'native.transport.request',maxChildMs:30000,minParentMs:8000}),
 exception('native.tls.exchange','adr-margin','P5','TLS send retains its 30 s ceiling inside task-router forwarding; the forwarding signal and candidate expiry cut it short.'),
 exception('temporal.issuer.http.close','nested-margin','P5','Issuer service listener close retains only 500 ms before entrypoint child settlement expires.',{parent:'temporal.issuer.settlement',maxChildMs:2000,minParentMs:2500}),
 exception('temporal.issuer.http.close','adr-margin','P5','Issuer service listener close retains only 500 ms before entrypoint child settlement expires.'),
 exception('core.request','shared-deadline','P6','Core 25 s allowance shares the enclosing 25 s request and AbortSignal; P6 removes per-hop Core calls.'),
 exception('native.client.startup','adr-margin','P5','Startup client keeps 23 s within the existing 25 s request root.'),
 exception('runner.checkpoint.complete','adr-margin','P2','23 s completion inside 25 s keeps the existing 2 s margin.'),
 exception('runner.checkpoint.complete','tail-margin','P6','Completion includes the existing control capture chain.'),
 exception('runner.call.load','adr-margin','P6','23 s request inside 25 s keeps the existing 2 s margin.'),
 exception('runner.call.publish','adr-margin','P6','23 s request inside 25 s keeps the existing 2 s margin.'),
 exception('runner.native.router','adr-margin','P5','21 s router inside 23 s client keeps the existing 2 s margin.'),
 exception('runner.native.receiver','adr-margin','P5','19 s receiver inside 21 s router keeps the existing 2 s margin.'),
 exception('control.capture','adr-margin','P2','21 s capture inside 23 s client keeps the existing 2 s margin.'),
 exception('control.capture.channel','adr-margin','P2','19 s channel inside 21 s capture keeps the existing 2 s margin.'),
 exception('runtime.preparation','serial-sum','P5','Runtime 23 s plus local 10 s exceed the existing 30 s activity cap.'),
 exception('control.capture','tail-margin','P6','Repeated current Core checks retain the existing capture allowance.'),
 exception('runner.call.load','tail-margin','P6','Repeated current Core checks retain the existing load allowance.'),
 exception('runner.call.publish','tail-margin','P6','Repeated current Core checks retain the existing publish allowance.'),
 exception('proxy.exchange.max','tail-margin','P4','Owner reservation retains the existing 15 s allowance.'),
 exception('conversation.events.subscription','tail-margin','P6','Event window retains the existing 30 s allowance.'),
]);

const refuse=(hop,parent,reason)=>{throw Object.assign(new TypeError('HOT_PATH_BUDGET_CONFIGURATION: '+hop+(parent?' inside '+parent:'')+' ('+reason+')'),{code:'HOT_PATH_BUDGET_CONFIGURATION',hop,parent});};
const valueAt=(table,id)=>table.hops?.[id]??table.roots?.[id];
const scalar=(value,hop)=>{if(!Number.isSafeInteger(value)||value<0)refuse(hop,undefined,'expected a nonnegative safe integer');return value;};
export function fixedHotPathBudget(id){const hop=HOP[id];if(!hop||typeof hop.ms==='function'||hop.ms===null)refuse(id,undefined,'fixed preconfiguration hop required');return hop.ms;}
export function budget(table,id){const hop=valueAt(table,id);if(!hop)refuse(id,undefined,'unknown hop');if(hop.ms===null)refuse(id,undefined,'sdk-owned timeout has no numeric budget');return hop.ms;}

// Exceptions are code-owned, bounded to the reviewed existing child/parent values, and never read from rendered input.
function admitsPreservedMargin(id,hop,table){
 const row=HOT_PATH_BUDGET_EXCEPTIONS.find(row=>row.hop===id&&row.rule==='nested-margin');
 return row?.parent===hop.parent&&hop.ms<=row.maxChildMs&&budget(table,hop.parent)>=row.minParentMs;
}

/** Validate the rendered table as well as locally derived tables; consumers must refuse before opening listeners. */
export function assertHotPathBudgets(table){
 if(!table||table.version!==HOT_PATH_BUDGET_VERSION||!table.roots||!table.hops)refuse('table',undefined,'invalid version or shape');
 for(const id of Object.keys(HOP))if(!Object.hasOwn(table.hops,id))refuse(id,undefined,'required hop missing');
 // The margin is a schema policy, never a configurable relaxation of containment.
 if(table.hops['budget.margin'].ms!==HOT_PATH_BUDGET_MARGIN_MS)refuse('budget.margin',undefined,'required containment margin');
 for(const id of ['turn','startup','shutdown','request','original']){const root=table.roots[id];if(!root||scalar(root.ms,id)<1)refuse(id,undefined,'missing positive root');}
 for(const [id,hop] of Object.entries(table.hops)){
  if(!hop||!['nested','serial','background','derived','library','independent'].includes(hop.kind))refuse(id,hop?.parent,'unknown kind');
  if(id==='temporal.connect'){
   if(hop.kind!=='library'||hop.ms!==null||hop.sdkOwned!==true||hop.configurable!==false||hop.owner!=='sdk-core'||hop.parent!==undefined||hop.boundedBy!==undefined||hop.unbounded!==undefined||typeof hop.reason!=='string'||!hop.reason.trim())refuse(id,undefined,'native connect timeout is opaque and not configurable');
  }else if(Array.isArray(hop.ms)){for(const ms of hop.ms)scalar(ms,id);}else scalar(hop.ms,id);
  if(hop.inherits&&hop.ms!==budget(table,hop.inherits))refuse(id,hop.inherits,'shared deadline must equal its owning bound');
  if(hop.kind==='independent'&&(Array.isArray(hop.ms)||hop.ms<1||typeof hop.owner!=='string'||!hop.owner.trim()||typeof hop.reason!=='string'||!hop.reason.trim()))refuse(id,hop.parent,'independent lifetime requires a positive duration, owner and reason');
  if(hop.kind==='derived'&&(typeof hop.reason!=='string'||!hop.reason.trim()))refuse(id,hop.parent,'derived metadata requires its bound or validation meaning');
  if(hop.unbounded&&(!hop.boundedBy||!valueAt(table,hop.boundedBy)||typeof hop.reason!=='string'||!hop.reason.trim()))refuse(id,hop.boundedBy,'unbounded entries require an owner and reason');
  if(hop.parent&&!valueAt(table,hop.parent))refuse(id,hop.parent,'unknown parent');
  // Rendered metadata cannot relabel a child or choose a larger parent to evade containment.
  if(HOP[id]&&(hop.kind!==HOP[id].kind||hop.parent!==HOP[id].parent))refuse(id,hop.parent,'canonical lifetime classification required');
  if(hop.kind==='nested'||hop.kind==='serial'&&hop.parent){
   if(!hop.parent||Array.isArray(hop.ms)||hop.ms>budget(table,hop.parent)-HOT_PATH_BUDGET_MARGIN_MS&&!admitsPreservedMargin(id,hop,table))refuse(id,hop.parent,'nested margin');
  }
  if(hop.kind==='serial'){
   if(!Array.isArray(hop.children)||!hop.children.length)refuse(id,hop.parent,'serial children required');
   for(const child of hop.children)if(budget(table,child)>hop.ms-HOT_PATH_BUDGET_MARGIN_MS)refuse(child,id,'serial child margin');
  }
  if(hop.kind==='background'){
   const period=typeof hop.period==='string'?budget(table,hop.period):hop.periodMs;
   const expiry=typeof hop.expiry==='string'?budget(table,hop.expiry):hop.expiryMs;
   if(!Number.isSafeInteger(period)||period<1||!Number.isSafeInteger(expiry)||expiry<2*period)refuse(id,hop.parent,'background expiry must cover two periods');
  }
 }
 return table;
}

export function hotPathBudgets({limits,runWindowMs,originalExpiresAtMs,nowMs=0,ownerRequestMs=OWNER_REQUEST_MAX_MS}={}){
 if(!Number.isSafeInteger(ownerRequestMs)||ownerRequestMs<1||ownerRequestMs>OWNER_REQUEST_MAX_MS)refuse('owner.request',undefined,'invalid owner request limit');
 if(!limits)refuse('limits',undefined,'root limits required');
 for(const name of ['startupMs','shutdownMs','requestMs'])if(!Number.isSafeInteger(limits[name])||limits[name]<1)refuse(name,undefined,'positive root required');
 if(!Number.isSafeInteger(runWindowMs)||runWindowMs<1)refuse('turn',undefined,'positive run window required');
 if(!Number.isSafeInteger(nowMs)||nowMs<0)refuse('original',undefined,'invalid read time');
 const original=originalExpiresAtMs??nowMs+runWindowMs;
 if(!Number.isSafeInteger(original)||original<1)refuse('original',undefined,'invalid original expiry');
 const inputs={limits,runWindowMs,originalExpiresAtMs:original,nowMs,ownerRequestMs};
 const roots={turn:{ms:runWindowMs},startup:{ms:limits.startupMs},shutdown:{ms:limits.shutdownMs},request:{ms:limits.requestMs},original:{ms:runWindowMs,expiresAtMs:original}};
 const hops=Object.fromEntries(Object.entries(HOP).map(([id,definition])=>[id,{...definition,ms:typeof definition.ms==='function'?definition.ms(inputs):definition.ms}]));
 for(const hop of Object.values(hops))if(hop.kind==='serial')hop.sumMs=hop.children.reduce((sum,id)=>sum+hops[id].ms,0);
 let startup;
 try{startup=runnerStartupBudget({requestMs:limits.requestMs,shutdownMs:limits.shutdownMs,originalExpiresAtMs:original});}
 catch{refuse('runner.native.router','runner.call.load','startup request allowance is too small');}
 return freeze(assertHotPathBudgets({version:HOT_PATH_BUDGET_VERSION,roots,hops,startup}));
}

/** Only stable effective values enter the digest: absolute original/stage timestamps never do. */
export function hotPathBudgetDigest(table){
 assertHotPathBudgets(table);
 const values=Object.fromEntries(Object.entries(table.hops).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,hop])=>[id,hop.ms]));
 return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}
