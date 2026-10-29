/** Synthetic ports exercise the preparation owner's composition only: no bubblewrap, kernel sandbox or model runs. The
 * real host measurement is the readiness owner's (`readiness.mjs`) and is qualified on the deployed task. */
import test from 'node:test';import assert from 'node:assert/strict';
import {binding,clock} from '../browser/test/fixtures.mjs';
import {BASH_EGRESS_SCHEMA,bashEgressDomainsSha256} from '../egress/bash-egress.mjs';
import {createSdkCapabilities} from '../capabilities/index.mjs';
import {createHostSandboxReadiness,prepareAgentCoreBashRuntimeFacts} from './agentcore-bash-runtime-facts.mjs';
import {checkSandboxReadiness} from './readiness.mjs';

const deadline=clock()+60000;
const cwd=`/workspace/${binding.conversationId}`;
const protectedPaths={sdkConfigDirectory:`/run/meri/${binding.conversationId}/sdk-${binding.runId}`,sdkSecureStorageDirectory:`/run/meri/${binding.conversationId}/secure`};
function hostPorts({bwrap=true,socat=true,freshProc=true,closeFails=false}={}){
 const seen={made:0,removed:0,closed:0,queries:0,userMessages:0};
 const ports={findExecutable:name=>name==='bwrap'&&!bwrap||name==='socat'&&!socat?undefined:`/usr/bin/${name}`,
  runProbe:async(_command,args)=>freshProc||!args.includes('--proc'),exists:()=>false,
  makeTempDir:label=>{seen.made++;return `/tmp/meri-agentcore-${label}-${seen.made}`;},removeDir:()=>{seen.removed++;},
  query:args=>{seen.queries++;seen.sandboxSettings=args.options.sandbox;let release;const done=new Promise(resolve=>{release=resolve;});
   (async()=>{for await(const _ of args.prompt)seen.userMessages++;})();
   return {initializationResult:async()=>({}),close(){release();},async *[Symbol.asyncIterator](){await done;}};},
  sdkVersion:'0.3.295',nodePath:'/usr/local/bin/node',pathEnv:'/usr/bin',close(){seen.closed++;if(closeFails)throw Error('cleanup failed');}};
 return {seen,createReadinessPorts:async()=>ports};
}
function input(over={}){const probes=hostPorts();const readiness=createHostSandboxReadiness({createReadinessPorts:probes.createReadinessPorts}).read;
 return {probes,configuration:{binding,policy:{bash:true},expiresAtMs:deadline,now:clock,pathEnv:'/usr/bin',protectedPaths,readiness,...over}};}
const refuses=code=>e=>e?.code===code;

test('Bash off prepares no fact and measures no host',async()=>{
 const f=input({policy:{bash:false}});
 const prepared=await prepareAgentCoreBashRuntimeFacts(f.configuration);
 assert.deepEqual(prepared.runtimeFacts,{});assert.deepEqual(await prepared.close(),{closed:true});assert.equal(f.probes.seen.queries,0);
});

test('a clean measurement yields an honest sandbox fact for networkless Bash on this topology',async()=>{
 const f=input();const prepared=await prepareAgentCoreBashRuntimeFacts(f.configuration);
 const fact=prepared.runtimeFacts.bashSandbox;
 assert.equal(fact.available,true);assert.equal(fact.weakerNestedSandbox,false);
 // No outer per-conversation boundary is claimed on an AgentCore task.
 assert.equal(fact.outerIsolationBoundary,false);
 assert.match(fact.readinessSha256,/^[0-9a-f]{64}$/u);
 assert.equal(Object.hasOwn(prepared.runtimeFacts,'bashEgress'),false);
 assert.equal(Object.hasOwn(prepared.runtimeFacts,'bashApprovals'),false);
 assert.equal(prepared.topology,'agentcore-runtime-session');
 assert.deepEqual([f.probes.seen.queries,f.probes.seen.userMessages,f.probes.seen.closed,f.probes.seen.removed],[1,0,1,2]);
 const composed=createSdkCapabilities({bash:true},{runOwner:{async append(){}},binding,cwd,now:clock,newId:()=>binding.runId,sdkConfigDirectory:protectedPaths.sdkConfigDirectory,sdkSecureStorageDirectory:protectedPaths.sdkSecureStorageDirectory,...prepared.runtimeFacts});
 assert.equal(composed.bashAdmitted,true);assert.deepEqual(composed.options.tools,['Bash']);
 const sandbox=composed.options.sandbox;
 // The real boundary settings the product runs with, asserted rather than attested.
 assert.equal(sandbox.enableWeakerNestedSandbox,false);assert.equal(sandbox.allowUnsandboxedCommands,false);
 assert.equal(sandbox.failIfUnavailable,true);assert.deepEqual(sandbox.filesystem.allowWrite,[cwd]);
 assert.deepEqual(sandbox.filesystem.denyRead,[protectedPaths.sdkSecureStorageDirectory]);
 assert.deepEqual(sandbox.network.allowedDomains,[]);assert.equal(sandbox.autoAllowBashIfSandboxed,true);
 assert.equal(sandbox.credentials.files[0].path,`${protectedPaths.sdkConfigDirectory}/.credentials.json`);
 assert.equal(sandbox.credentials.files[0].mode,'deny');
 assert.ok(sandbox.credentials.envVars.some(entry=>entry.name==='ANTHROPIC_AUTH_TOKEN'&&entry.mode==='deny'));
 assert.deepEqual(composed.options.managedSettings.sandbox.enabled,true);
 assert.deepEqual(await prepared.close(),{closed:true});
});

test('a host that needs the weaker nested sandbox admits no Bash instead of claiming an outer boundary',async()=>{
 const f=input({readiness:createHostSandboxReadiness({createReadinessPorts:hostPorts({freshProc:false}).createReadinessPorts}).read});
 await assert.rejects(prepareAgentCoreBashRuntimeFacts(f.configuration),refuses('BASH_SANDBOX_UNAVAILABLE'));
});

test('missing bubblewrap or socat, failed cleanup and a failed probe all refuse without escaping a fact',async()=>{
 for(const [probes,code] of [[hostPorts({bwrap:false}),'BASH_SANDBOX_UNAVAILABLE'],[hostPorts({socat:false}),'BASH_SANDBOX_UNAVAILABLE'],[hostPorts({closeFails:true}),'BASH_READINESS_CLEANUP_UNKNOWN']]){
  const f=input({readiness:createHostSandboxReadiness({createReadinessPorts:probes.createReadinessPorts}).read});
  await assert.rejects(prepareAgentCoreBashRuntimeFacts(f.configuration),refuses(code));
  assert.equal(probes.seen.closed,1,'the readiness ports are always closed');
 }
 const broken=input({readiness:createHostSandboxReadiness({createReadinessPorts:async()=>{throw Error('no ports');}}).read});
 await assert.rejects(prepareAgentCoreBashRuntimeFacts(broken.configuration),refuses('BASH_READINESS_INCOMPLETE'));
});

test('the host is measured once per runtime session and reused by later runs',async()=>{
 const probes=hostPorts();const readiness=createHostSandboxReadiness({createReadinessPorts:probes.createReadinessPorts}).read;
 const first=await prepareAgentCoreBashRuntimeFacts({binding,policy:{bash:true},expiresAtMs:deadline,now:clock,pathEnv:'/usr/bin',protectedPaths,readiness});
 const second=await prepareAgentCoreBashRuntimeFacts({binding:{...binding,runId:'00000012-b0a1-4000-8000-0000000000ff'},policy:{bash:true},expiresAtMs:deadline,now:clock,pathEnv:'/usr/bin',protectedPaths,readiness});
 assert.equal(probes.seen.queries,1);
 assert.equal(first.runtimeFacts.bashSandbox.readinessSha256,second.runtimeFacts.bashSandbox.readinessSha256);
 await first.close();await second.close();
});

test('networked Bash refuses without an approval owner and never measures the host first',async()=>{
 const domains=['pypi.org'];
 const withoutApproval=input({policy:{bash:true,sandboxNetworkDomains:domains},hostCurrentnessSignal:new AbortController().signal});
 await assert.rejects(prepareAgentCoreBashRuntimeFacts(withoutApproval.configuration),refuses('BASH_HOST_CONFIGURATION'));
 assert.equal(withoutApproval.probes.seen.queries,0);
 const withoutSignal=input({policy:{bash:true,sandboxNetworkDomains:domains},approvals:{async decide(){}}});
 await assert.rejects(prepareAgentCoreBashRuntimeFacts(withoutSignal.configuration),refuses('BASH_HOST_CONFIGURATION'));
 assert.equal(withoutSignal.probes.seen.queries,0);
});

test('an authorised networked run binds its egress fact and closes the proxy once',async()=>{
 const domains=['pypi.org'];let starts=0,closes=0,revoked=false;
 const currentness=new AbortController();
 const proxy={revoke(){revoked=true;return {revoked:true};},async close(){closes++;revoked=true;}};
 const startEgress=async({domains:d,expiresAtMs})=>{starts++;assert.deepEqual(d,domains);assert.equal(expiresAtMs,deadline);
  return {fact:{schema:BASH_EGRESS_SCHEMA,httpProxyPort:41001,socksProxyPort:41002,domainsSha256:bashEgressDomainsSha256(d)},proxy};};
 const approvals={async decide(){}};
 const f=input({policy:{bash:true,sandboxNetworkDomains:domains},approvals,hostCurrentnessSignal:currentness.signal,startEgress});
 const prepared=await prepareAgentCoreBashRuntimeFacts(f.configuration);
 assert.equal(starts,1);assert.equal(prepared.runtimeFacts.bashApprovals,approvals);
 assert.equal(prepared.runtimeFacts.bashEgress.domainsSha256,bashEgressDomainsSha256(domains));
 const composed=createSdkCapabilities({bash:true,sandboxNetworkDomains:domains},{runOwner:{async append(){}},binding,cwd,now:clock,newId:()=>binding.runId,sdkConfigDirectory:protectedPaths.sdkConfigDirectory,sdkSecureStorageDirectory:protectedPaths.sdkSecureStorageDirectory,...prepared.runtimeFacts});
 assert.equal(composed.bashAdmitted,true);assert.equal(composed.options.sandbox.autoAllowBashIfSandboxed,false);
 currentness.abort();assert.equal(revoked,true,'abort revokes synchronously');
 await prepared.close();await prepared.close();assert.equal(closes,1);
});

test('a malformed egress fact closes the started proxy and refuses',async()=>{
 const domains=['pypi.org'];let closes=0;
 const f=input({policy:{bash:true,sandboxNetworkDomains:domains},approvals:{async decide(){}},hostCurrentnessSignal:new AbortController().signal,
  startEgress:async()=>({fact:{schema:BASH_EGRESS_SCHEMA,httpProxyPort:41001,socksProxyPort:41002,domainsSha256:'0'.repeat(64)},
   proxy:{revoke(){return {revoked:true};},async close(){closes++;}}})});
 await assert.rejects(prepareAgentCoreBashRuntimeFacts(f.configuration),refuses('BASH_EGRESS_START_FAILED'));
 assert.equal(closes,1);
});

// --- readiness lifecycle: cancellation during the pending startup, owned settlement, failed shutdown -------------
/** Ports whose SDK startup stays pending until the test's abort closes it, then a clean one for a later run. */
function pendingThenReadyPorts(){
 const started=Promise.withResolvers(),second=Promise.withResolvers();
 const seen={queries:0,closed:0,removed:0,probeRuns:0};
 let release;
 const ports={findExecutable:name=>`/usr/bin/${name}`,runProbe:async()=>{seen.probeRuns++;return true;},exists:()=>false,
  makeTempDir:label=>`/tmp/meri-pending-${label}`,removeDir:()=>{seen.removed++;},
  query:()=>{seen.queries++;
   if(seen.queries===1){
    const done=new Promise(resolve=>{release=resolve;});
    const q={initializationResult:()=>new Promise(()=>{}), // never initialises on its own
     close(){release();},async *[Symbol.asyncIterator](){started.resolve();await done;}};
    return q;
   }
   const done=new Promise(resolve=>{release=resolve;});
   const q={initializationResult:async()=>({}),close(){release();},async *[Symbol.asyncIterator](){second.resolve();await done;}};
   return q;},
  sdkVersion:'0.3.295',nodePath:'/usr/local/bin/node',pathEnv:'/usr/bin',close(){seen.closed++;}};
 return {seen,started:started.promise,second:second.promise,createReadinessPorts:async()=>ports};
}

test('cancelling the run while readiness startup is pending stops it, settles its ports and refuses the run',async()=>{
 const probes=pendingThenReadyPorts(),readiness=createHostSandboxReadiness({createReadinessPorts:probes.createReadinessPorts});
 const run=new AbortController(),runStartedAt=clock();
 const pending=prepareAgentCoreBashRuntimeFacts({binding,policy:{bash:true},expiresAtMs:deadline,now:()=>runStartedAt,
  pathEnv:'/usr/bin',protectedPaths,readiness:readiness.read,signal:run.signal});
 await probes.started; // the real readiness startup is now pending
 run.abort(new Error('run cancelled'));
 const error=await pending.then(()=>assert.fail('a cancelled run must not receive Bash facts'),e=>e);
 assert.equal(error.code,'BASH_HOST_REVOKED');
 // The probe this run started has settled every resource it owned, before the rejection was observed above.
 assert.equal(probes.seen.queries,1);assert.equal(probes.seen.closed,1);assert.equal(probes.seen.removed,2);
 await readiness.settle();
 // Ordinary cancellation is ordinary: nothing owned is unknown, so settle resolves and the next run measures again.
 await assert.doesNotReject(readiness.settle());
 const next=new AbortController();
 const prepared=await prepareAgentCoreBashRuntimeFacts({binding,policy:{bash:true},expiresAtMs:deadline,now:clock,
  pathEnv:'/usr/bin',protectedPaths,readiness:readiness.read,signal:next.signal});
 await probes.second;
 assert.equal(probes.seen.queries,2);
 assert.equal(prepared.runtimeFacts.bashSandbox.available,true);
 await prepared.close();
});

test('a readiness report whose SDK shutdown failed refuses the run as cleanup-unknown, never as an unsupported host',async()=>{
 const genuine=await createHostSandboxReadiness({createReadinessPorts:hostPorts().createReadinessPorts}).read({pathEnv:'/usr/bin',protectedPaths});
 assert.equal(genuine.ready,true); // the same measurement is clean when it is not disturbed
 for(const reasonCode of ['SDK_CLOSE_FAILED','SDK_CLEANUP_TIMEOUT','SDK_SHUTDOWN_FAILED','READINESS_CLEANUP_FAILED']){
  const report={...genuine,sdkStartup:{...genuine.sdkStartup,status:'refused',reasonCode,shutdown:'failed'},ready:false};
  const f=input({readiness:async()=>report});
  const error=await prepareAgentCoreBashRuntimeFacts(f.configuration).then(()=>assert.fail(`a failed ${reasonCode} shutdown must refuse the run`),e=>e);
  assert.equal(error.code,'BASH_READINESS_CLEANUP_UNKNOWN',reasonCode);
 }
});

test('a returned abort-marked report refuses the run even when its verdict looks unavailable',async()=>{
 const f=input({readiness:async()=>({ready:false,aborted:true,sdkStartup:{status:'refused',reasonCode:'SDK_STARTUP_ABORTED',initialized:false,shutdown:'clean'}})});
 await assert.rejects(prepareAgentCoreBashRuntimeFacts(f.configuration),refuses('BASH_HOST_REVOKED'));
});

test('a stop that fails while the run is cancelling is cleanup-unknown, and settle still carries it to the runner',async()=>{
 const started=Promise.withResolvers();let closes=0;
 /** A pending SDK startup whose close throws: the consumer ends, but the child's stop itself is unverified. */
 const ports={findExecutable:name=>`/usr/bin/${name}`,runProbe:async()=>true,exists:()=>false,
  makeTempDir:label=>`/tmp/meri-stuck-${label}`,removeDir(){},
  query:()=>{let done;const held=new Promise(resolve=>{done=resolve;});
   return {initializationResult:()=>new Promise(()=>{}),close(){closes++;done();throw Error('close failed');},
    async *[Symbol.asyncIterator](){started.resolve();await held;}};},
  sdkVersion:'0.3.295',nodePath:'/usr/local/bin/node',pathEnv:'/usr/bin',close(){}};
 const readiness=createHostSandboxReadiness({createReadinessPorts:async()=>ports});
 const run=new AbortController(),startedAt=clock();
 const pending=prepareAgentCoreBashRuntimeFacts({binding,policy:{bash:true},expiresAtMs:deadline,now:()=>startedAt,
  pathEnv:'/usr/bin',protectedPaths,readiness:readiness.read,signal:run.signal});
 await started.promise;
 run.abort(new Error('run cancelled')); // cancelled while the SDK startup is pending, and the stop then fails
 const error=await pending.then(()=>assert.fail('a failed stop must refuse the run'),e=>e);
 assert.equal(error.code,'BASH_READINESS_CLEANUP_UNKNOWN','failed cleanup outranks the cancellation code');
 assert.notEqual(error.code,'BASH_SANDBOX_UNAVAILABLE','a failed stop is never ordinary host absence');
 assert.ok(closes>=1);
 // The existing runner cleanup catch (`try{await bashReadiness.settle()}catch{localCleanupFailed=true}`) receives it.
 await assert.rejects(readiness.settle(),refuses('BASH_READINESS_CLEANUP_UNKNOWN'));
 await assert.doesNotReject(readiness.settle()); // reported once, not repeated for the next run
});

test('cancellation while the first bubblewrap probe is pending prevents the second child probe',async()=>{
 const first=Promise.withResolvers(),seen={probes:0,queries:0};
 const ports={findExecutable:name=>`/usr/bin/${name}`,exists:()=>false,makeTempDir:label=>`/tmp/meri-probe-${label}`,removeDir(){},
  runProbe:async(_command,args)=>{seen.probes++;assert.equal(args.includes('--proc'),true,'the first probe is the fresh-/proc one');return first.promise;},
  query:()=>{seen.queries++;throw Error('no SDK child after cancellation');},
  sdkVersion:'0.3.295',nodePath:'/usr/local/bin/node',pathEnv:'/usr/bin'};
 const controller=new AbortController();
 const pending=checkSandboxReadiness(ports,{signal:controller.signal,deadlineMs:5000});
 controller.abort(new Error('run cancelled'));
 first.resolve(false); // the first probe comes back false only after the cancellation
 const report=await pending;
 assert.equal(seen.probes,1,'no second bubblewrap child is spawned after cancellation');
 assert.equal(seen.queries,0,'no SDK startup is started after cancellation');
 assert.equal(report.aborted,true);assert.equal(report.ready,false);
});


