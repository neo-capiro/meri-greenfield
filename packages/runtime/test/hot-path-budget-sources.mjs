/** Independent base-source extraction. No import of the new table is allowed here.
 * All source selectors name a constant/property; line numbers are deliberately absent. */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:https';
import {Agent} from 'node:http';

export async function extractBaseBudgetValues({root,base,dependenciesRoot=root}){
 const values={},sources={},files=new Map();
 const source=file=>{if(!files.has(file))files.set(file,execFileSync('git',['show',`${base}:${file}`],{cwd:root,encoding:'utf8'}));return files.get(file);};
 const put=(id,value,file,symbol)=>{if(Object.hasOwn(values,id))throw Error('Duplicate base hop '+id);values[id]=value;sources[id]={file,symbol};return value;};
 const number=(id,file,pattern,scale=1)=>{const found=pattern.exec(source(file));if(!found)throw Error('Base source anchor missing for '+id+': '+file+' '+pattern);return put(id,Number(found[1].replaceAll('_',''))*scale,file,String(pattern));};
 const constant=(id,file,symbol)=>number(id,file,new RegExp('\\b'+symbol+'\\s*=\\s*([0-9_e.]+)'));
 const alias=(id,other)=>put(id,values[other],sources[other].file,sources[other].symbol+' (same effective owner)');
 const computed=(id,value,file,symbol)=>{if(!source(file).includes(symbol))throw Error('Missing derivation '+file+' '+symbol);return put(id,value,file,symbol);};
 const runnerFile='packages/runtime/runner-load-budget.mjs';
 const runner=await import('data:text/javascript;base64,'+Buffer.from(source(runnerFile)).toString('base64'));
 const runnerNames={
  'budget.margin':'RUNNER_LOAD_CONTROL_MARGIN_MS','runner.call.load':'RUNNER_LOAD_MAX_MS','runner.call.publish':'RUNNER_LOAD_MAX_MS',
  'runner.replay.delays':'RUNNER_REPLAY_DELAYS_MS','runner.stage.load':'RUNNER_LOAD_STAGE_MAX_MS','runner.stage.runtime':'RUNNER_LOAD_MAX_MS',
  'runner.stage.setup':'RUNNER_LOAD_MAX_MS','runtime.preparation':'ACTIVITY_PREPARATION_MAX_MS','runner.native.router':'RUNNER_NATIVE_STARTUP_ROUTER_MS',
  'runner.native.receiver':'RUNNER_NATIVE_STARTUP_RECEIVER_MS','runner.session.store':'RUNNER_SESSION_STORE_CALL_MS',
  'control.capture':'CONTROL_CHECKPOINT_CAPTURE_MS','control.capture.channel':'CONTROL_CAPTURE_CHANNEL_MS','router.capture':'TASK_ROUTER_CAPTURE_MS',
  'runner.capture':'RUNNER_CAPTURE_MS','runner.startup.minShutdown':'RUNNER_STARTUP_MIN_SHUTDOWN_MS','runner.startup.shutdownSteps':'RUNNER_STARTUP_SHUTDOWN_STEPS',
  'runner.startup.settlement':'RUNNER_STARTUP_SETTLEMENT_MS','runner.startup.catchCleanup':'RUNNER_STARTUP_CATCH_CLEANUP_MS',
  'runner.startup.cleanup':'RUNNER_STARTUP_CLEANUP_MS','runner.startup.margin':'RUNNER_STARTUP_MARGIN_MS',
  'broker.poll.completionDefer':'CONTROL_CHECKPOINT_CAPTURE_MS','router.capture.selfStop':'TASK_ROUTER_CAPTURE_MS',
 };
 for(const [id,name]of Object.entries(runnerNames)){if(runner[name]===undefined)throw Error('Missing runner export '+name);put(id,runner[name],runnerFile,name);}
 for(const[operation,ms]of Object.entries(runner.RUNNER_SESSION_RPC_MS)){put('runner.session.'+operation,ms,runnerFile,'RUNNER_SESSION_RPC_MS.'+operation);put('control.session.'+operation,runner.controlSessionRpcMs(operation),runnerFile,'controlSessionRpcMs('+operation+')');}
 put('runner.replay.pause',runner.RUNNER_REPLAY_DELAYS_MS[0],runnerFile,'RUNNER_REPLAY_DELAYS_MS[0]');
 put('runner.stage.local',runner.runnerStartupBudget({requestMs:25000,shutdownMs:10000,originalExpiresAtMs:900000}).stages.local.maxMs,runnerFile,'runnerStartupBudget.stages.local');
 number('temporal.issuer.pg.connect.max','apps/runtime/temporal-issuer-cli.mjs',/connectionTimeoutMillis:Math.min\(c.issuer.startupTimeoutMs,(\d+)\)/);
 number('temporal.issuer.pg.idle','apps/runtime/temporal-issuer-cli.mjs',/idleTimeoutMillis:(\d+)/);
 number('native.remote.stdout.poll','apps/runtime/native-authority/remote-task-http.mjs',/setTimeout\(\(\)=>\{waiters.delete\(resolve\);resolve\(\);\},(\d+)\)/);
 const runtime='apps/runtime/',native=runtime+'native-authority/',conversation='apps/control/conversations/',worker='apps/worker/conversation/';
 for(const [id,file,pattern]of [
  ['native.client.request',runtime+'native-client.mjs',/maxRequestMs=(\d+)/],
  ['native.transport.request',native+'remote-task-boundary.mjs',/maxRequestMs:(\d+)/],
  ['native.independent.request',native+'independent-task.mjs',/maxRequestMs=c.maxRequestMs\?\?(\d+)/],
  ['native.independent.close',native+'independent-task.mjs',/maxRequestMs=c.maxRequestMs\?\?(\d+)/],
  ['native.launch.shutdown',native+'launch-configuration.mjs',/shutdownMs=c.shutdownMs\?\?(\d+)/],
  ['native.prepared.request',native+'prepared-kickoff.mjs',/maxRequestMs=c.maxRequestMs\?\?(\d+)/],
  ['native.prepared.wait',native+'prepared-kickoff.mjs',/maxWaitMs=c.maxWaitMs\?\?(\d+)/],
  ['native.prepared.poll',native+'prepared-kickoff.mjs',/pollMs=c.pollMs\?\?(\d+)/],
  ['native.prepared.cleanup',native+'prepared-kickoff.mjs',/cleanupMs=c.cleanupMs\?\?(\d+)/],
  ['native.session.registration',native+'session-registration.mjs',/maxRequestMs:l.maxRequestMs\?\?(\d+)/],
  ['native.session.owner',native+'session-owner.mjs',/maxRequestMs=(\d+)/],
  ['native.session.http',native+'session-http.mjs',/maxRequestMs=(\d+)/],
  ['runtime.original.reconcile',runtime+'original-stop.mjs',/timeoutMs=(\d+)/],
  ['runtime.objective.lifecycle',runtime+'objective-generation/lifecycle-activities.mjs',/maxRequestMs=(\d+)/],
  ['runtime.objective.owner',runtime+'objective-generation/run-owner.mjs',/maxRequestMs=(\d+)/],
  ['native.allocator.startup',native+'task-allocator.mjs',/startupMs=c.startupMs\?\?(\d+)/],
  ['native.release.request',native+'prepared-kickoff-http.mjs',/maxRequestMs:(\d+)/],
  ['native.replay.minAttempt',runtime+'native-client.mjs',/REPLAY_MIN_ATTEMPT_MS=(\d+)/],
  ['http.keepAlive',runtime+'http-server.mjs',/RUNTIME_KEEP_ALIVE_MS=(\d+)/],
  ['pg.control.idle',runtime+'control.mjs',/idleTimeoutMillis:(\d+)/],
  ['broker.native.request',runtime+'temporal-worker.mjs',/BROKER_NATIVE_MS=(\d+)/],
  ['broker.poll',runtime+'temporal-worker.mjs',/pollMs=(\d+)/],
  ['runner.terminal.attempt',worker+'activity.mjs',/TERMINAL_ATTEMPT_MS=(\d+)/],
  ['activity.cleanup.attempt',worker+'cleanup.mjs',/CLEANUP_ATTEMPT_MS=(\d+)/],
  ['activity.load',worker+'activity.mjs',/loadMaxMs=(\d+)/],
  ['activity.runtime',worker+'activity.mjs',/runtimeMaxMs=(\d+)/],
  ['activity.heartbeat',worker+'activity.mjs',/heartbeatTimer=setInterval\([\s\S]*?,(\d+)\)/],
  ['continuation.poll',worker+'continuation/activity-lifecycle.mjs',/pollMs=(\d+)/],
  ['continuation.cleanup.ack',worker+'continuation/activity-lifecycle.mjs',/deadlineMs:now\(\)\+(\d+)/],
  ['continuation.read.backoff.first',worker+'continuation/activity-lifecycle.mjs',/LIFECYCLE_READ_BACKOFF_MS=Object.freeze\(\{first:(\d+)/],
  ['continuation.read.backoff.max',worker+'continuation/activity-lifecycle.mjs',/LIFECYCLE_READ_BACKOFF_MS=Object.freeze\(\{first:\d+,max:(\d+)/],
  ['continuation.read.unavailable.limit',worker+'continuation/activity-lifecycle.mjs',/LIFECYCLE_READ_UNAVAILABLE_LIMIT=(\d+)/],
  ['conversation.events.poll',conversation+'events.mjs',/pollMs=(\d+)/],
  ['conversation.events.idleRecheck',conversation+'events.mjs',/idleRecheckMs=(\d+)/],
  ['conversation.events.subscription',conversation+'events.mjs',/maxSubscriptionMs=(\d+)/],
  ['continuation.journal.deadline',conversation+'lifecycle/journal.mjs',/deadlineMs=now\(\)\+(\d+)/],
  ['conversation.http.request',conversation+'http.mjs',/maxRequestMs=(\d+)/],
  ['runner.bootstrap.files.request',runtime+'runner-bootstrap-files.mjs',/maxRequestMs=(\d+)/],
  ['runner.poststart.bootstrap',runtime+'runner-poststart-bootstrap.mjs',/maxStartupMs=c.maxStartupMs\?\?(\d+)/],
  ['runner.poststart.step',runtime+'runner-poststart-bootstrap.mjs',/return Math.min\((\d+),left\)/],
  ['runner.poststart.pending.poll',runtime+'runner-poststart-bootstrap.mjs',/now\(\)\+(\d+)>=stopAt/],
  ['runner.poststart.challenge.ceiling',runtime+'runner-poststart-bootstrap.mjs',/c.expiresAtMs>now\(\)\+(\d+)/],
  ['runner.poststart.transport.request',runtime+'runner-poststart-transport.mjs',/maxRequestMs=c.maxRequestMs\?\?(\d+)/],
  ['runner.poststart.exchange.request',runtime+'runner-poststart-transport.mjs',/deadlineMs=(\d+)/],
  ['runner.poststart.metadata.read',runtime+'runner-poststart-transport.mjs',/maxBytes:65536,deadlineMs:(\d+)/],
  ['runner.task.bootstrap.poll',runtime+'task-bootstrap.mjs',/pollMs=(\d+)/],
  ['runner.session.cleanup',runtime+'sdk-session-runtime.mjs',/cleanupMs=(\d+)/],
 ])number(id,file,pattern);
 alias('native.client.startup','runner.call.load');
 const render='infra/product-preview/first-chat/render-material.mjs';
 const startup=number('_startup',render,/startupMs:(\d+)/),shutdown=number('_shutdown',render,/shutdownMs:(\d+)/),request=number('_request',render,/requestMs:(\d+)/);
 const rootDerived=[['runtime.startup',startup,render,'startupMs'],['runtime.request',request,render,'requestMs'],['http.request',request+1000,runtime+'http-server.mjs','configuration.limits.requestMs+1000'],['http.headers',request,runtime+'http-server.mjs','configuration.limits.requestMs'],['pg.control.connect',request,runtime+'control.mjs','connectionTimeoutMillis:configuration.limits.requestMs'],['pg.control.query',request,runtime+'control.mjs','query_timeout:configuration.limits.requestMs'],['worker.shutdown.grace',shutdown,runtime+'temporal-worker.mjs','shutdownGraceTime:configuration.limits.shutdownMs'],['worker.shutdown.force',shutdown+1000,runtime+'temporal-worker.mjs','shutdownForceTime:configuration.limits.shutdownMs+1000'],['runtime.shutdown.watchdog',shutdown+1000,runtime+'cli.mjs','c.limits.shutdownMs+1000']];
 for(const row of rootDerived)computed(...row);
 number("authority.current.request","apps/runtime/native-authority/current-authority-limits.mjs",new RegExp("CURRENT_AUTHORITY_LIMITS=Object.freeze\\(\\{maxRequestMs:(\\d+)"));
 number("authority.current.lease","apps/runtime/native-authority/current-authority-limits.mjs",new RegExp("maxLeaseMs:(\\d+)"));
 number("authority.current.proposal","apps/runtime/native-authority/current-authority-limits.mjs",new RegExp("proposalTtlMs:(\\d+)"));
 number("authority.gateway.request","apps/runtime/native-authority/current-authority-limits.mjs",new RegExp("GATEWAY_LIMITS_DEFAULTS=Object.freeze\\(\\{[^\\n]*maxRequestMs:(\\d+)"));
 number("authority.gateway.cleanup","apps/runtime/native-authority/current-authority-limits.mjs",new RegExp("GATEWAY_LIMITS_DEFAULTS=Object.freeze\\(\\{[^\\n]*maxCleanupMs:(\\d+)"));
 number("native.read.request","apps/runtime/native-authority/reads-http.mjs",new RegExp("config.maxExecuteMs:(\\d+)"));
 number("native.retained.source","apps/runtime/native-authority/retained-reads/source-transport.mjs",new RegExp("maxRequestMs=c.maxRequestMs\\?\\?(\\d+)"));
 number("native.continuation.request","apps/runtime/native-authority/continuation-authority.mjs",new RegExp("maxRequestMs:l.maxRequestMs\\?\\?(\\d+)"));
 number("native.continuation.authority","apps/runtime/native-authority/continuation-authority.mjs",new RegExp("authorityWindowMs:l.authorityWindowMs\\?\\?(\\d+)"));
 number("native.continuation.admission","apps/runtime/native-authority/continuation-authority.mjs",new RegExp("admissionWindowMs:l.admissionWindowMs\\?\\?(\\d+)"));
 number("native.execution.skew","apps/runtime/native-authority/execution-issuance.mjs",new RegExp("maxSkewMs:(\\d+)"));
 number("native.execution.request","apps/runtime/native-authority/execution-issuance.mjs",new RegExp("maxRequestMs:(\\d+)"));
 number("native.execution.cleanup","apps/runtime/native-authority/execution-composition.mjs",new RegExp("maxCleanupMs:(\\d+)"));
 number("native.intent.prepare","apps/runtime/native-authority/intents-http.mjs",new RegExp("maxPrepareMs:(\\d+)"));
 alias('runner.checkpoint.complete','runner.call.load');
 computed('temporal.control.connect',startup,runtime+'control.mjs','connectTimeout:configuration.limits.startupMs');
 // Schedule worker shares the control client's explicit connection configuration at the base.
 alias('temporal.schedule.connect','temporal.control.connect');
 number('runtime.runWindow.cap',render,/Math.min\(runtimeMs,(\d+)\)/);
 number('native.allocator.request',native+'task-allocator.mjs',/maxRequestMs=c.maxRequestMs\?\?(\d+)/);
 number('gateway.runAllocation.read',runtime+'control.mjs',/createRunAllocationBudgetReader\(\{[^\n]*Math.min\(configuration.limits.requestMs,(\d+)\)/);
 number('gateway.completion.admission','apps/gateway/budget/postgres-tool-budget.mjs',/limits:\{maxRequestMs:(\d+)/);
 number('gateway.document.vision','apps/gateway/budget/general-read-tariffs.mjs',/vision:Object.freeze\(\{[^\n]*timeoutMs:(\d+)/);
 number('gateway.generalRead.defaultRuntime','apps/gateway/budget/general-read-manifest.mjs',/GENERAL_READ_DEFAULT_RUN_BUDGETS=Object.freeze\(\{[^\n]*maxRuntimeSeconds:(\d+)/);

 number("conversation.window.slack","apps/control/conversations/service.mjs",new RegExp("WINDOW_END_SLACK_MS\\s*[:=]\\s*(\\d+)"));
 number("conversation.retention.inventory","apps/control/conversations/retention-inventory.mjs",new RegExp("MAX_DURATION_MS\\s*[:=]\\s*(\\d+)"));
 number("objective.lifecycle.poll","apps/control/objective-generation/lifecycle-driver.mjs",new RegExp("OBJECTIVE_GENERATION_POLL_MS\\s*[:=]\\s*(\\d+)"));
 number("objective.lifecycle.retry","apps/control/objective-generation/lifecycle-driver.mjs",new RegExp("OBJECTIVE_GENERATION_RETRY_MS\\s*[:=]\\s*(\\d+)"));
 number("schedule.request.max","apps/runtime/schedule-service-configuration.mjs",new RegExp("SCHEDULE_MAX_REQUEST_MS\\s*[:=]\\s*(\\d+)"));
 number("schedule.native.request","apps/runtime/schedule-service-configuration.mjs",new RegExp("SCHEDULE_NATIVE_MAX_REQUEST_MS\\s*[:=]\\s*(\\d+)"));
 number("temporal.bootstrap.window","apps/runtime/temporal-product-bootstrap.mjs",new RegExp("TEMPORAL_BOOTSTRAP_STARTUP_WINDOW_MS\\s*[:=]\\s*(\\d+)"));
 number("temporal.bootstrap.retry","apps/runtime/temporal-product-bootstrap.mjs",new RegExp("TEMPORAL_BOOTSTRAP_RETRY_INTERVAL_MS\\s*[:=]\\s*(\\d+)"));
 number("temporal.bootstrap.reserve","apps/runtime/temporal-product-bootstrap.mjs",new RegExp("TEMPORAL_BOOTSTRAP_STARTUP_RESERVE_MS\\s*[:=]\\s*(\\d+)"));
 number("temporal.issuer.retirement","apps/runtime/temporal-issuer-cli.mjs",new RegExp("MAX_RETIREMENT_MS\\s*[:=]\\s*(\\d+)"));
 number("retention.journal.request","apps/control/retention/postgres-journal.mjs",/maxRequestMs(?:=|:|:c.maxRequestMs\?\?)(\d+)/);
 number("retention.ledger.head","apps/control/retention/ledger.mjs",new RegExp("maxHeadMs\\s*[:=]\\s*(\\d+)"));
 number("retention.storage.request","apps/control/retention/storage-port.mjs",/maxRequestMs(?:=|:|:c.maxRequestMs\?\?)(\d+)/);
 number("native.pinned.transport","apps/runtime/pinned-native-transport.mjs",new RegExp("timeout\\s*[:=]\\s*(\\d+)"));
 number("browser.action","apps/worker/conversation/browser/policy.mjs",new RegExp("actionMs:(\\d+)"));
 number("browser.navigation","apps/worker/conversation/browser/policy.mjs",new RegExp("navigationMs:(\\d+)"));
 number("browser.takeover.settle","apps/worker/conversation/browser/session/fence.mjs",new RegExp("settleMarginMs:(\\d+)"));
 number("browser.takeover.hard","apps/worker/conversation/browser/session/fence.mjs",new RegExp("hardBoundMs:(\\d+)"));
 number("browser.takeover.idle","apps/worker/conversation/browser/session/fence.mjs",new RegExp("leaseIdleMs:(\\d+)"));
 number("host.currentness","apps/worker/conversation/host/binding.mjs",new RegExp("MAX_HOST_CURRENTNESS_MS=(\\d+)"));
 number("host.process.fresh","apps/worker/conversation/host/host-wide-process-observer.mjs",new RegExp("MAX_FRESH_MS=(\\d+)"));
 number("browser.process.exit","apps/worker/conversation/host/process-observer.mjs",new RegExp("PROCESS_EXIT_WAIT_MS=(\\d+)"));
 number("host.teardown.max","apps/worker/conversation/host/teardown.mjs",new RegExp("MAX_PHASE_MS=(\\d+)"));
 number("intents.snapshot","apps/worker/conversation/intents/runtime.mjs",new RegExp("SNAPSHOT_MS=(\\d+)"));
 number("reads.snapshot","apps/worker/conversation/reads/runtime.mjs",new RegExp("SNAPSHOT_MS=(\\d+)"));
 number("sandbox.observe","apps/worker/conversation/sandbox-readiness/readiness.mjs",new RegExp("OBSERVE_MS=(\\d+)"));
 number("sandbox.cleanup","apps/worker/conversation/sandbox-readiness/readiness.mjs",new RegExp("CLEANUP_MS=(\\d+)"));
 number("browser.cleanup.default","apps/worker/conversation/browser/lifecycle.mjs",new RegExp("default:(\\d+)"));
 number("browser.cleanup.max","apps/worker/conversation/browser/lifecycle.mjs",new RegExp("max:(\\d+)"));
 number("egress.admit","apps/worker/conversation/egress/proxy-server.mjs",new RegExp("admitMs:(\\d+)"));
 number("egress.idle","apps/worker/conversation/egress/proxy-server.mjs",new RegExp("idleMs:(\\d+)"));
 number("egress.connect","apps/worker/conversation/egress/proxy-server.mjs",new RegExp("connectMs:(\\d+)"));
 number("host.process.timeout","apps/worker/conversation/host/host-wide-process-observer.mjs",new RegExp("timeoutMs=(\\d+)"));
 number("host.process.arm","apps/worker/conversation/host/host-wide-process-observer.mjs",new RegExp("armTimeoutMs=(\\d+)"));
 number("host.process.poll","apps/worker/conversation/host/host-wide-process-observer.mjs",new RegExp("pollMs=(\\d+)"));
 number("browser.process.poll","apps/worker/conversation/host/process-observer.mjs",new RegExp("pollMs=(\\d+)"));
 number("host.teardown.local","apps/worker/conversation/host/teardown.mjs",new RegExp("localCleanupMs=(\\d+)"));
 number("host.teardown.host","apps/worker/conversation/host/teardown.mjs",new RegExp("hostCleanupMs=(\\d+)"));
 number("objective.runtime.request","apps/worker/conversation/objective-generation/runtime.mjs",new RegExp("maxRequestMs=(\\d+)"));
 number("sandbox.deadline","apps/worker/conversation/sandbox-readiness/readiness.mjs",new RegExp("deadlineMs=(\\d+)"));
 number("sandbox.probe","apps/worker/conversation/sandbox-readiness/host-probes.mjs",new RegExp("timeout:(\\d+)"));
 computed('browser.cleanup.settle',values['browser.cleanup.max']+1000,'apps/worker/conversation/cleanup.mjs','BROWSER_CLEANUP_MS.max+1000');
 number('temporal.issuer.challenge','apps/runtime/temporal-issuer/bootstrap-owner.mjs',/challengeLifetimeMs=(\d+)/);
 number('temporal.issuer.certificate','apps/runtime/temporal-issuer/bootstrap-owner.mjs',/certificateLifetimeMs=(\d+)/);
 const server=createServer();
 put('temporal.issuer.http.headers',server.headersTimeout,'node:https','Node '+process.versions.node+' createServer().headersTimeout');
 put('temporal.issuer.http.request',server.requestTimeout,'node:https','Node '+process.versions.node+' createServer().requestTimeout');
 put('temporal.issuer.http.keepAlive',server.keepAliveTimeout,'node:https','Node '+process.versions.node+' createServer().keepAliveTimeout');
 const agent=new Agent();put('native.tls.socket',agent.options.timeout??0,'node:http','Node '+process.versions.node+' Agent.options.timeout unset');agent.destroy();
 number('reads.runtime.max','apps/worker/conversation/reads/budget.mjs',/READ_TIMEOUT_MS=Object.freeze\(\{min:\d+,max:(\d+)/);
 number('intents.runtime.max','apps/worker/conversation/intents/server.mjs',/INTENT_TIMEOUT_MS=Object.freeze\(\{min:\d+,max:(\d+)/);
 number("intents.availability","apps/control/intents/mount.mjs",new RegExp("AVAILABILITY_MS\\s*[:=]\\s*(\\d+)"));
 number("withdrawal.propagation","apps/control/withdrawal/generations.mjs",new RegExp("propagationMs\\s*[:=]\\s*(\\d+)"));
 number("withdrawal.staleness","apps/control/withdrawal/generations.mjs",new RegExp("stalenessMs\\s*[:=]\\s*(\\d+)"));
 number("artifact.download.ttl","apps/runtime/artifacts/download-gate.mjs",new RegExp("DEFAULT_LINK_TTL_MS\\s*[:=]\\s*(\\d+)"));
 number("material.initialize.request","apps/runtime/material-init.mjs",/maxRequestMs(?:=|:|:c.maxRequestMs\?\?)(\d+)/);
 number("temporal.issuer.registration.query","apps/runtime/temporal-issuer/service-task-registration-pg.mjs",new RegExp("query_timeout\\s*[:=]\\s*(\\d+)"));
 number("temporal.token.disabled.refresh","apps/runtime/temporal-product-token-writer.mjs",/refreshMs:c.authorization\?\.refreshMs\?\?(\d+)/);
 number("temporal.token.disabled.request","apps/runtime/temporal-product-token-writer.mjs",/maxRequestMs(?:=|:|:c.maxRequestMs\?\?)(\d+)/);
 number("native.gateway.read.request","apps/runtime/native-runner-gateway.mjs",/route.execute\?reads.maxExecuteMs:(\d+)/);
 number("native.process.poll","apps/runtime/native-authority/process-lifetime.mjs",new RegExp("setTimeout\\(poll,(\\d+)\\)"));
 number("native.process.leaseTick","apps/runtime/native-authority/process-lifetime.mjs",new RegExp("Math.min\\((\\d+),expiresAtMs-current\\)"));
 number("native.tls.challenge","apps/runtime/native-authority/runner-tls-client.mjs",new RegExp("Math.min\\((\\d+), candidate.expiresAtMs"));
 number("native.tls.exchange","apps/runtime/native-authority/runner-tls-client.mjs",new RegExp("Math.min\\((\\d+), expiresAtMs"));
 number("native.allocator.settle","apps/runtime/native-authority/task-allocator.mjs",new RegExp("CONTAINMENT_SETTLE_MS=(\\d+)"));
 number("native.allocator.poll","apps/runtime/native-authority/task-allocator.mjs",new RegExp("CONTAINMENT_POLL_MS=(\\d+)"));
 number("native.allocator.startupPoll","apps/runtime/native-authority/task-allocator.mjs",new RegExp("setTimeout\\(resolve,(\\d+)\\)"));
 number("native.poststart.challenge","apps/runtime/native-authority/runner-poststart-authority.mjs",new RegExp("now\\(\\)\\+(\\d+)"));
 number("native.routine.receipt","apps/runtime/native-authority/routines-core-client.mjs",new RegExp("ROUTINE_RECEIPT_MAX_MS=(\\d+)"));
 number("native.read.observation","apps/runtime/native-authority/native-read-credentials/read-mode-observation.mjs",new RegExp("READ_MODE_MAX_REQUEST_MS=(\\d+)"));
 number('host.expiry.tick','apps/worker/conversation/host/bash-runtime-facts.mjs',/Math.min\(left,(\d+)\)/);
 number("temporal.issuer.settlement","apps/runtime/temporal-issuer/entrypoint.mjs",new RegExp("setTimeout\\(\\(\\)=>resolve\\(\\{settled:false\\}\\),(\\d+)"));
 number("temporal.issuer.registration.cleanup","apps/runtime/temporal-issuer/service-task-registration-pg.mjs",new RegExp("setTimeout\\(\\(\\)=>reject\\(unavailable\\(\\)\\),(\\d+)"));
 number("temporal.issuer.http.close","apps/runtime/temporal-issuer/service.mjs",new RegExp("setTimeout\\(\\(\\)=>resolve\\(false\\),(\\d+)"));
 number("memory.request.max","apps/control/memory/protocol.mjs",/maxRequestMs:(\d+)/);
 number("settings.tenant.request.max","apps/control/settings/tenant-application/protocol.mjs",/maxRequestMs:(\d+)/);
 number("settings.user.request.max","apps/control/settings/user-application/protocol.mjs",/maxRequestMs:(\d+)/);
 number("native.intent.availability","apps/runtime/native-authority/intents-client.mjs",new RegExp("RUNNER_INTENT_AVAILABILITY_MS=(\\d+)"),1);
 number("native.read.reference","apps/runtime/native-authority/native-read-credentials/client-reference.mjs",new RegExp("CLIENT_REFERENCE_MAX_REQUEST_MS=(\\d+)"),1);
 number("native.delegation.request","apps/runtime/native-authority/read-delegation/contract.mjs",new RegExp("maxRequestMs:(\\d+)"),1);
 number("native.delegation.attended","apps/runtime/native-authority/read-delegation/contract.mjs",new RegExp("attendedMaxMs:(\\d+)\\*MINUTE"),60000);
 number("native.delegation.occurrence","apps/runtime/native-authority/read-delegation/contract.mjs",new RegExp("occurrenceMaxMs:(\\d+)\\*MINUTE"),60000);
 number("native.delegation.consent","apps/runtime/native-authority/read-delegation/contract.mjs",new RegExp("consentMaxMs:(\\d+)\\*DAY"),86400000);
 number("native.delegation.token","apps/runtime/native-authority/read-delegation/contract.mjs",new RegExp("MINUTE=(\\d+)"),1);
 number('artifact.authority.request','apps/runtime/artifacts/core-authority-client.mjs',/maxRequestMs\?\?(\d+)/);
 number('owner.request.cap','apps/proxy/product/service-pair-discovery.mjs',/OWNER_MAX_REQUEST_MS=(\d+)/);
 computed('core.request',request,'apps/runtime/prepared-candidate.mjs','configuration.limits.requestMs');
 number('native.retained.credential','apps/runtime/native-authority/retained-reads/credential-broker.mjs',/started\+(\d+)/);
 const proxy='apps/proxy/product/';
 number('proxy.diagnostics.burst',proxy+'refusal_diagnostics.py',/burst=(\d+)/);
 number('proxy.diagnostics.window',proxy+'refusal_diagnostics.py',/window=([\d.]+)/,1000);
 for(const[id,file,pattern,scale=1]of[
  ['owner.startup.pair.window',proxy+'owner-entrypoint.mjs',/PRODUCT_OWNER_PAIR_STARTUP_WINDOW_MS=(\d+)/],
  ['owner.startup.pair.retry',proxy+'owner-entrypoint.mjs',/PRODUCT_OWNER_PAIR_RETRY_INTERVAL_MS=(\d+)/],
  ['owner.startup.pair.settle',proxy+'owner-entrypoint.mjs',/PAIR_ATTEMPT_SETTLE_MS=(\d+)/],
  ['owner.request',proxy+'service-pair-discovery.mjs',/OWNER_MAX_REQUEST_MS=(\d+)/],
  ['pg.owner.idle',proxy+'owner-entrypoint.mjs',/idleTimeoutMillis:(\d+)/],
  ['owner.diagnostics.burst',proxy+'owner-diagnostics.mjs',/burst=(\d+)/],
  ['owner.diagnostics.window',proxy+'owner-diagnostics.mjs',/windowMs=(\d+)/],
  ['owner.idle.keepAlive',proxy+'owner-https.mjs',/keepAliveTimeout:(\d+)/],
  ['owner.idle.initialDelay',proxy+'owner-https.mjs',/keepAliveInitialDelay:(\d+)/],
  ['proxy.exchange.max',proxy+'budgets.py',/MAX_OWNER_EXCHANGE_MS = (\d+)/],
  ['proxy.exchange.min',proxy+'budgets.py',/MIN_OWNER_EXCHANGE_MS = (\d+)/],
  ['proxy.exchange.carrier',proxy+'budgets.py',/OWNER_CARRIER_WAIT_MS = (\d+)/],
  ['proxy.pair.fetch',proxy+'service_pair_discovery.py',/max_request_ms=(\d+)/],
  ['proxy.pair.lease',proxy+'service_pair_discovery.py',/max_lease_ms=(\d+)/],
  ['proxy.boto.connect',proxy+'main.py',/connect_timeout=(\d+)/,1000],
  ['proxy.boto.read',proxy+'main.py',/read_timeout=(\d+)/,1000],
  ['proxy.boto.attempts',proxy+'main.py',/"total_max_attempts": (\d+)/],
  ['proxy.request.poll','apps/proxy/qualification/runtime/lifetime.py',/poll_seconds: float = ([\d.]+)/,1000],
  ['proxy.connection',proxy+'uvicorn_tls_protocol.py',/max_connection_seconds=([\d.]+)/,1000],
  ['proxy.native.start',proxy+'main.py',/resources, seconds=([\d.]+)/,1000],
  ['proxy.native.stop',proxy+'main.py',/asyncio.wait\(\{operation\}, timeout=([\d.]+)\)/,1000],
  ['proxy.resources.close',proxy+'main.py',/asyncio.wait\(work, timeout=([\d.]+)\)/,1000],
  ['proxy.owner.settle',proxy+'owner_admission.py',/future.result\(timeout=[^\n]+?\+ ([\d.]+)\)/,1000],
  ['proxy.startup.pair.window',proxy+'main.py',/_PAIR_STARTUP_WINDOW_SECONDS = ([\d.]+)/,1000],
  ['proxy.startup.pair.retry',proxy+'main.py',/_PAIR_RETRY_INTERVAL_SECONDS = ([\d.]+)/,1000],
 ])number(id,file,pattern,scale);
 computed('owner.startup.pair.watchdog',values['owner.startup.pair.window']+20000,proxy+'owner-entrypoint.mjs','PRODUCT_OWNER_PAIR_STARTUP_WINDOW_MS+20000');
 for(const id of ['pg.owner.connect','pg.owner.query'])alias(id,'owner.request');
 computed('owner.shutdown.watchdog',values['owner.request']+1000,proxy+'owner-entrypoint.mjs','c.limits.maxRequestMs+1000');
 computed('proxy.request.check',values['proxy.exchange.carrier']+values['proxy.exchange.max']+1000,proxy+'budgets.py','(OWNER_CARRIER_WAIT_MS + MAX_OWNER_EXCHANGE_MS) / 1000 + 1');
 alias('proxy.request.cleanup','proxy.request.check');
 computed('proxy.bootstrap',25000+values['proxy.exchange.carrier'],proxy+'budgets.py','25.0 + OWNER_CARRIER_WAIT_MS / 1000');
 const durations={
  'workflow.conversation.startToClose':['workflow.ts','startToCloseTimeout'], 'workflow.conversation.heartbeat':['workflow.ts','heartbeatTimeout'],
  'workflow.recovery.startToClose':['recovery-workflow.ts','startToCloseTimeout'],'workflow.recovery.scheduleToClose':['recovery-workflow.ts','scheduleToCloseTimeout'],
  'workflow.recovery.retry.initial':['recovery-workflow.ts','initialInterval'],'workflow.recovery.retry.maximum':['recovery-workflow.ts','maximumInterval'],
  'workflow.objective.startToClose':['objective-generation-workflow.ts','startToCloseTimeout'],'workflow.schedule.startToClose':['scheduled-dispatch-workflow.ts','startToCloseTimeout'],
  'workflow.schedule.settle':['scheduled-dispatch-workflow.ts','settleAfterUnknown'],
 };
 const workflow={};for(const[id,[file,key]]of Object.entries(durations)){const full=conversation+file,match=new RegExp(key+"[:=]'([0-9]+) (second|minute)s?'").exec(source(full));if(!match)throw Error('Workflow anchor missing '+id);put(id,Number(match[1])*(match[2]==='minute'?60000:1000),full,key);workflow[id]=match[0].split("'")[1];}
 // Installed package evidence is selected explicitly. The emitted file records content hashes for review.
 const libraryFiles={};
 const libNumber=(id,file,pattern,scale=1)=>{const text=readFileSync(join(dependenciesRoot,file),'utf8'),m=pattern.exec(text);if(!m)throw Error('Installed library anchor missing '+id+' '+pattern);libraryFiles[file]=createHash('sha256').update(text).digest('hex');return put(id,Number(m[1].replaceAll('_',''))*scale,file,String(pattern));};
 libNumber('fetch.connect','packages/ui-stream/node_modules/undici/lib/core/connect.js',/timeout == null \? (\d+e?\d*)/);
 libNumber('fetch.headers','packages/ui-stream/node_modules/undici/lib/dispatcher/client.js',/headersTimeout : (\d+e\d+)/);
 libNumber('fetch.body','packages/ui-stream/node_modules/undici/lib/dispatcher/client.js',/bodyTimeout : (\d+e\d+)/);
 libNumber('temporal.connect','apps/runtime/node_modules/@temporalio/client/lib/connection.js',/connectTimeoutMs:[^\n]+\?\? ([\d_]+)/);
 const temporalConnection='apps/runtime/node_modules/@temporalio/client/lib/connection.js',temporalRetry='apps/runtime/node_modules/@temporalio/client/lib/grpc-retry.js';
 libNumber('temporal.keepAlive.period',temporalConnection,/'grpc.keepalive_time_ms': ([\d_]+)/);
 libNumber('temporal.keepAlive.timeout',temporalConnection,/'grpc.keepalive_timeout_ms': ([\d_]+)/);
 libNumber('temporal.retry.attempts',temporalRetry,/maxAttempts: maxAttempts \?\? (\d+)/);
 libNumber('temporal.retry.initial',temporalRetry,/return (100);/);
 libNumber('temporal.retry.resourceExhausted',temporalRetry,/RESOURCE_EXHAUSTED\) \{\s*return (\d+)/);
 libNumber('temporal.retry.max',temporalRetry,/maxIntervalMs\(\) \{\s*return ([\d_]+)/);
 libNumber('aws.issuer.attempts','apps/runtime/node_modules/@smithy/core/dist-es/submodules/retry/util-retry/config.js',/DEFAULT_MAX_ATTEMPTS = (\d+)/);
 const sdkFile='apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs';
 libNumber('sdk.load',sdkFile,/loadTimeoutMs\?\?(\d+)/);
 const sdk=readFileSync(join(dependenciesRoot,sdkFile),'utf8');
 const runEnd=/this\.runEndCeilingMs=([a-zA-Z_$][\w$]*)/.exec(sdk);
 if(!runEnd)throw Error('Pinned SDK runEndCeilingMs assignment missing');
 const constructor=sdk.slice(sdk.lastIndexOf('constructor(',runEnd.index),runEnd.index);
 const ceiling=new RegExp('\\b'+runEnd[1]+'=([a-zA-Z_$][\\w$]*)').exec(constructor);
 if(!ceiling)throw Error('Pinned SDK runEndCeilingMs default anchor missing');
 libNumber('sdk.runEnd',sdkFile,new RegExp('(?:var|let|const) '+ceiling[1]+'=(\\d+)'));
 const retryName=/backoffMs:([a-zA-Z_$][\w$]*)=([a-zA-Z_$][\w$]*)/.exec(sdk)?.[2];
 const retry=retryName&&new RegExp('(?:var|let|const) '+retryName+'=(\\[[0-9,]+\\])').exec(sdk);
 if(!retry||!sdk.includes('this.backoffMs.length+1'))throw Error('Pinned SDK append retry derivation missing');
 put('sdk.append.retryDelays',JSON.parse(retry[1]),sdkFile,'backoffMs default '+retryName);
 put('sdk.append.retryAttempts',values['sdk.append.retryDelays'].length+1,sdkFile,'sendWithRetry this.backoffMs.length+1');
 const smithy='apps/runtime/node_modules/@smithy/node-http-handler/dist-cjs/index.js';
 libNumber('aws.connection',smithy,/setConnectionTimeout = \(request, reject, timeoutInMs = (\d+)/);
 libNumber('aws.request',smithy,/setRequestTimeout = \(req, reject, timeoutInMs = (\d+)/);
 const uvicorn=execFileSync(process.env.P1_PYTHON??'python3',['-c','import inspect,uvicorn.config;print(inspect.getsource(uvicorn.config))'],{encoding:'utf8'});
 const keepAlive=/timeout_keep_alive: int = (\d+)/.exec(uvicorn);
 if(!keepAlive||!uvicorn.includes('timeout_graceful_shutdown: int | None = None'))throw Error('Uvicorn defaults changed');
 put('proxy.uvicorn.keepAlive',Number(keepAlive[1])*1000,'python:uvicorn/config.py','Config.timeout_keep_alive');
 put('proxy.uvicorn.shutdown',0,'python:uvicorn/config.py','Config.timeout_graceful_shutdown=None');
 libraryFiles['python:uvicorn/config.py']=createHash('sha256').update(uvicorn).digest('hex');
 if(/API_TIMEOUT_MS|apiTimeoutMs/.test(source('apps/worker/conversation/options.mjs')))throw Error('Pinned CLI API timeout is no longer unset');
 const defaults=[
  ['sdk.api',0,'@anthropic-ai/claude-agent-sdk','CLI API timeout unset; pinned options unchanged'],
 ];
 for(const row of defaults)put(...row);
 number('aws.attempts',runtime+'control.mjs',/maxAttempts:(\d+)/);
 for(const role of ['control','owner'])for(const key of ['statement','lock','idleInTransaction']){
  const pgKey={statement:'statement_timeout',lock:'lock_timeout',idleInTransaction:'idle_in_transaction_session_timeout'}[key],file='node_modules/pg/lib/defaults.js',text=readFileSync(join(dependenciesRoot,file),'utf8');
  if(!new RegExp(pgKey+': false').test(text))throw Error('pg default changed '+pgKey);put('pg.'+role+'.'+key,0,file,pgKey+': false');libraryFiles[file]=createHash('sha256').update(text).digest('hex');
 }
 for(const id of ['_startup','_shutdown','_request']){delete values[id];delete sources[id];}
 return {baseCommit:execFileSync('git',['rev-parse',base],{cwd:root,encoding:'utf8'}).trim(),inputs:{limits:{startupMs:startup,shutdownMs:shutdown,requestMs:request},runWindowMs:900000},values:Object.fromEntries(Object.entries(values).sort()),sources:Object.fromEntries(Object.entries(sources).sort()),workflow,libraryFiles};
}
