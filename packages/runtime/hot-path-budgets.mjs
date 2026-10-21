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
 'runner.session.store':fixed(RUNNER_SESSION_STORE_CALL_MS),
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
 'runner.task.bootstrap.poll':fixed(100), 'temporal.connect':library(10000,'startup','Connect default'),
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
const DERIVED_REASONS={
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
 "reads.snapshot":["reads.availability-snapshot","Before SDK"],
 "intents.snapshot":["intents.availability-snapshot","Before SDK"],
 "runtime.shutdown.watchdog": [
  "runtime.shutdown",
  "Shutdown grace"
 ],
 "conversation.http.request": [
  "conversation.http",
  "Request owner"
 ],
 "authority.gateway.request": [
  "gateway.dispatch",
  "Dispatch owner"
 ],
 "authority.gateway.cleanup": [
  "gateway.cleanup",
  "After dispatch"
 ],
 "conversation.retention.inventory": [
  "retention.inventory",
  "Discovery owner"
 ],
 "objective.lifecycle.poll": [
  "objective.lifecycle",
  "Durable poll"
 ],
 "objective.lifecycle.retry": [
  "objective.lifecycle",
  "Durable retry"
 ],
 "temporal.bootstrap.window": [
  "temporal.bootstrap",
  "Before service"
 ],
 "temporal.issuer.retirement": [
  "temporal.issuer.retirement",
  "After service"
 ],
 "retention.journal.request": [
  "retention.journal",
  "Journal owner"
 ],
 "retention.ledger.head": [
  "retention.ledger",
  "Storage owner"
 ],
 "retention.storage.request": [
  "retention.storage",
  "Storage owner"
 ],
 "native.pinned.transport": [
  "native.transport",
  "Request signal"
 ],
 "browser.action": [
  "browser.action",
  "Action owner"
 ],
 "browser.navigation": [
  "browser.navigation",
  "Navigation owner"
 ],
 "host.teardown.local": [
  "host.teardown.local",
  "After turn"
 ],
 "host.teardown.host": [
  "host.teardown.host",
  "After local stop"
 ],
 "objective.runtime.request": [
  "objective.runtime",
  "Result owner"
 ],
 "sandbox.deadline": [
  "sandbox.sdk-startup",
  "After probes"
 ],
 "sandbox.probe": [
  "sandbox.namespace-probe",
  "Before SDK"
 ],
 "sandbox.cleanup": [
  "sandbox.cleanup",
  "After SDK"
 ],
 "browser.cleanup.default": [
  "browser.cleanup",
  "After query"
 ],
 "browser.cleanup.settle": [
  "conversation.browser-cleanup",
  "Cleanup grace"
 ],
 "egress.idle": [
  "egress.connection",
  "Socket idle"
 ],
 "intents.availability": [
  "intents.availability",
  "Snapshot owner"
 ],
 "material.initialize.request": [
  "material.initialize",
  "Before runtime"
 ],
 "temporal.token.disabled.refresh": [
  "temporal.disabled-token",
  "Inert interval"
 ],
 "temporal.token.disabled.request": [
  "temporal.disabled-token",
  "Inert request"
 ],
 "native.gateway.read.request": [
  "native.gateway.read",
  "Request owner"
 ],
 "native.tls.exchange": [
  "native.tls.exchange",
  "TLS owner"
 ],
 "native.allocator.settle": [
  "native.allocator.containment",
  "After task stop"
 ],
 "native.read.observation": [
  "native.read.observation",
  "Read owner"
 ],
 "host.expiry.tick": [
  "host.expiry-observer",
  "Dynamic lease"
 ],
 "temporal.issuer.settlement": [
  "temporal.issuer.settlement",
  "After shutdown"
 ],
 "temporal.issuer.registration.cleanup": [
  "temporal.issuer.registration-cleanup",
  "After register"
 ],
 "temporal.issuer.http.close": [
  "temporal.issuer.http-close",
  "After requests"
 ],
 "runner.session.store": [
  "runner.session.store",
  "Load then append"
 ],
 "runner.startup.catchCleanup": [
  "runner.startup.catch-cleanup",
  "Before publish"
 ],
 "owner.startup.pair.watchdog": [
  "owner.startup",
  "Before turn"
 ],
 "owner.request": [
  "owner.https-request",
  "Request owner"
 ],
 "owner.shutdown.watchdog": [
  "owner.shutdown",
  "Shutdown grace"
 ],
 "owner.startup.pair.settle": [
  "owner.pair-attempt-settlement",
  "After request"
 ],
 "proxy.bootstrap": [
  "proxy.request-bootstrap",
  "Before request"
 ],
 "proxy.connection": [
  "proxy.connection",
  "Connection owner"
 ],
 "proxy.request.cleanup": [
  "proxy.request-cleanup",
  "After expiry"
 ],
 "proxy.owner.settle": [
  "proxy.owner-settlement",
  "After request"
 ],
 "native.independent.close": [
  "native.supervisor-close",
  "After task stop"
 ],
 "native.prepared.cleanup": [
  "native.prepared-cleanup",
  "After failure"
 ],
 "runtime.original.reconcile": [
  "original.reconcile",
  "After lost run"
 ],
 "activity.cleanup.attempt": [
  "activity.cleanup",
  "After activity"
 ],
 "runner.session.cleanup": [
  "runner.session-cleanup",
  "After run"
 ],
 "proxy.native.stop": [
  "proxy.native-stop",
  "After request"
 ],
 "proxy.resources.close": [
  "proxy.resources-close",
  "After request"
 ],
 "native.execution.cleanup": [
  "native.execution-cleanup",
  "After dispatch"
 ],
 "continuation.cleanup.ack": [
  "continuation.cleanup-ack",
  "Terminal cleanup"
 ]
};
function ownedHop(id,row){
 if(NESTED_PARENTS[id])return {...row,kind:'nested',parent:NESTED_PARENTS[id]};
 if(DERIVED_REASONS[id])return {...row,kind:'derived',reason:DERIVED_REASONS[id]};
 if(LIBRARY_OWNERS[id]){const [boundedBy,reason]=LIBRARY_OWNERS[id];return {...row,kind:'library',boundedBy,reason};}
 if(id.startsWith('workflow.'))return {...row,kind:'independent',owner:'temporal.workflow-policy',reason:'Durable policy'};
 if(INDEPENDENT_OWNERS[id]){const [owner,reason]=INDEPENDENT_OWNERS[id];return {...row,kind:'independent',owner,reason};}
 if(row.kind==='independent')throw Error('Unclassified budget owner: '+id);
 return row;
}
export const HOP=freeze(Object.fromEntries(Object.entries(HOP_DEFINITIONS).map(([id,row])=>[id,ownedHop(id,row)])));

export const WORKFLOW_BUDGETS=freeze(Object.fromEntries(Object.entries(HOP).filter(([id])=>id.startsWith('workflow.')).map(([id,row])=>[id,row.duration])));

const exception=(hop,rule,removedBy,reason)=>({hop,rule,removedBy,reason,recordedAt:'2026-10-21'});
export const HOT_PATH_BUDGET_EXCEPTIONS=freeze([
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
export function fixedHotPathBudget(id){const hop=HOP[id];if(!hop||typeof hop.ms==='function')refuse(id,undefined,'fixed preconfiguration hop required');return hop.ms;}
export function budget(table,id){const hop=valueAt(table,id);if(!hop)refuse(id,undefined,'unknown hop');return hop.ms;}

/** Validate the rendered table as well as locally derived tables; consumers must refuse before opening listeners. */
export function assertHotPathBudgets(table){
 if(!table||table.version!==HOT_PATH_BUDGET_VERSION||!table.roots||!table.hops)refuse('table',undefined,'invalid version or shape');
 for(const id of Object.keys(HOP))if(!Object.hasOwn(table.hops,id))refuse(id,undefined,'required hop missing');
 // The margin is a schema policy, never a configurable relaxation of containment.
 if(table.hops['budget.margin'].ms!==HOT_PATH_BUDGET_MARGIN_MS)refuse('budget.margin',undefined,'required containment margin');
 for(const id of ['turn','startup','shutdown','request','original']){const root=table.roots[id];if(!root||scalar(root.ms,id)<1)refuse(id,undefined,'missing positive root');}
 for(const [id,hop] of Object.entries(table.hops)){
  if(!hop||!['nested','serial','background','derived','library','independent'].includes(hop.kind))refuse(id,hop?.parent,'unknown kind');
  if(Array.isArray(hop.ms)){for(const ms of hop.ms)scalar(ms,id);}else scalar(hop.ms,id);
  if(hop.inherits&&hop.ms!==budget(table,hop.inherits))refuse(id,hop.inherits,'shared deadline must equal its owning bound');
  if(hop.kind==='independent'&&(Array.isArray(hop.ms)||hop.ms<1||typeof hop.owner!=='string'||!hop.owner.trim()||typeof hop.reason!=='string'||!hop.reason.trim()))refuse(id,hop.parent,'independent lifetime requires a positive duration, owner and reason');
  if(hop.kind==='derived'&&(typeof hop.reason!=='string'||!hop.reason.trim()))refuse(id,hop.parent,'derived metadata requires its bound or validation meaning');
  if(hop.unbounded&&(!hop.boundedBy||!valueAt(table,hop.boundedBy)||typeof hop.reason!=='string'||!hop.reason.trim()))refuse(id,hop.boundedBy,'unbounded entries require an owner and reason');
  if(hop.parent&&!valueAt(table,hop.parent))refuse(id,hop.parent,'unknown parent');
  if(hop.kind==='nested'){
   if(!hop.parent||Array.isArray(hop.ms)||hop.ms>budget(table,hop.parent)-HOT_PATH_BUDGET_MARGIN_MS)refuse(id,hop.parent,'nested margin');
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
