/** Worker-host readiness for SDK-sandboxed Bash: scripted ports for every branch, the CLI contract, and one real
 * local run of the pinned SDK with no model request. Local results are not sandbox qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {checkSandboxReadiness,toBashSandboxAttestation,namespaceProbeArgs,READINESS_MODEL_ENV,MANAGED_SETTINGS_PATH} from '../sandbox-readiness/readiness.mjs';
import {main,parseArguments} from '../sandbox-readiness/cli.mjs';
import {buildBashSandboxSettings,SANDBOX_DENIED_ENV} from '../capabilities/bash-sandbox.mjs';
/** Scripted SDK: `mode` = 'ready' (initialisation completes), 'refused' (error result first) or 'hang'. */
function scriptedQuery(mode,seen){
 return args=>{seen.args=args;let closed=false,wake;const closedPromise=new Promise(r=>{wake=r;});
  (async()=>{for await(const m of args.prompt)seen.userMessages=(seen.userMessages??0)+1;})();
  return {initializationResult:()=>mode==='ready'?Promise.resolve({}):mode==='refused'?Promise.reject(Error('Claude Code returned an error result: Sandbox required but unavailable: sandbox is enabled but dependencies are missing')):new Promise(()=>{}),
   close(){closed=true;seen.closed=true;wake();},
   async *[Symbol.asyncIterator](){if(mode==='refused'){yield {type:'result',subtype:'error_during_execution',is_error:true,num_turns:0,total_cost_usd:0,errors:['sandbox required but unavailable: sandbox is enabled but dependencies are missing']};return;}await closedPromise;if(!closed)throw Error('unreachable');}};};
}
function ports({bwrap=true,socat=true,fresh=true,nested=true,managed=false,mode='ready',sdkVersion='0.3.295'}={}){
 const seen={probes:[],dirs:[],removed:[]};
 return {seen,ports:{findExecutable:name=>({bwrap:bwrap?'/usr/bin/bwrap':undefined,socat:socat?'/usr/bin/socat':undefined})[name],
  runProbe:async(command,args)=>{seen.probes.push([command,args]);return args.includes('--proc')?fresh:nested;},exists:path=>path===MANAGED_SETTINGS_PATH&&managed,
  makeTempDir:label=>{const d=`/tmp/readiness/${label}-${seen.dirs.length}`;seen.dirs.push(d);return d;},removeDir:d=>seen.removed.push(d),query:scriptedQuery(mode,seen),sdkVersion,nodePath:'/usr/local/bin/node',pathEnv:'/usr/bin'}};
}

test('a ready host runs the SDK startup with the exact product sandbox settings and never sends a user message',async()=>{
 const {ports:p,seen}=ports();const report=await checkSandboxReadiness(p,{deadlineMs:2000});
 assert.equal(report.ready,true);assert.deepEqual(report.sdkStartup,{status:'ready',reasonCode:null,userMessagesSent:0,modelTurns:0,costUsd:0,messagesObserved:0,resultsObserved:0,initialized:true,shutdown:'clean'});assert.equal(report.weakerNestedSandboxRequired,false);
 assert.match(report.scope,/^LOCAL_READINESS_ONLY/);assert.deepEqual(seen.probes,[['/usr/bin/bwrap',namespaceProbeArgs(true,'/usr/local/bin/node')]],'no second probe when a fresh /proc works');
 const o=seen.args.options,workspace=seen.dirs[0];
 assert.deepEqual(o.sandbox,buildBashSandboxSettings({cwd:workspace,domains:[],weakerNestedSandbox:false}));assert.equal(o.sandbox.failIfUnavailable,true);assert.deepEqual(o.settingSources,[]);assert.deepEqual(o.tools,['Bash']);
 assert.equal(o.env.ANTHROPIC_BASE_URL,'http://127.0.0.1:9');assert.equal(o.env.ANTHROPIC_AUTH_TOKEN,READINESS_MODEL_ENV.ANTHROPIC_AUTH_TOKEN);assert.equal(o.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB,'1');assert.ok(SANDBOX_DENIED_ENV.includes('ANTHROPIC_AUTH_TOKEN'));
 assert.equal(seen.userMessages,undefined,'the prompt stream never yields a message');assert.equal(seen.closed,true);assert.deepEqual(seen.removed.sort(),seen.dirs.sort(),'every temporary directory it created is removed');
 const a=toBashSandboxAttestation(report,{outerIsolationBoundary:false});assert.equal(a.available,true);assert.equal(a.weakerNestedSandbox,false);assert.match(a.readinessSha256,/^[0-9a-f]{64}$/u);
});

test('missing dependencies, a managed-settings file, an SDK refusal, a hang or a version mismatch each make the host not ready',async()=>{
 for(const [opts,check] of [
  [{bwrap:false},r=>{assert.equal(r.dependencies.bwrap,false);assert.deepEqual(r.namespaces,{freshProc:false,withoutProc:false});}],
  [{socat:false},r=>assert.equal(r.dependencies.socat,false)],
  [{fresh:false,nested:false},r=>assert.deepEqual(r.namespaces,{freshProc:false,withoutProc:false})],
  [{managed:true},r=>assert.equal(r.managedSettingsTier,'present')],
  [{mode:'refused'},r=>assert.deepEqual(r.sdkStartup,{status:'refused',reasonCode:'SANDBOX_DEPENDENCIES_MISSING',userMessagesSent:0,modelTurns:0,costUsd:0,messagesObserved:1,resultsObserved:1,initialized:false,shutdown:'clean'})],
  [{mode:'hang'},r=>assert.equal(r.sdkStartup.status,'timeout')],
  [{sdkVersion:'0.3.296'},r=>assert.equal(r.sdkStartup.reasonCode,'SDK_VERSION_MISMATCH')]]){
  const {ports:p,seen}=ports(opts);const r=await checkSandboxReadiness(p,{deadlineMs:200});check(r);assert.equal(r.ready,false,JSON.stringify(opts));
  assert.equal(toBashSandboxAttestation(r,{outerIsolationBoundary:true}).available,false);assert.deepEqual(seen.removed.sort(),seen.dirs.sort());
 }
});

test('a host that only runs bubblewrap without a fresh /proc needs the weaker nested sandbox, admitted only with the outer boundary assertion',async()=>{
 const {ports:p,seen}=ports({fresh:false,nested:true});const r=await checkSandboxReadiness(p,{deadlineMs:2000});
 assert.equal(r.weakerNestedSandboxRequired,true);assert.equal(r.ready,true);assert.equal(seen.args.options.sandbox.enableWeakerNestedSandbox,true);assert.equal(Object.hasOwn(seen.args.options.managedSettings.sandbox,'enableWeakerNestedSandbox'),false);
 assert.deepEqual(seen.probes.map(([,args])=>args.includes('--proc')),[true,false]);
 const without=toBashSandboxAttestation(r,{outerIsolationBoundary:false});assert.equal(without.available,false);assert.equal(without.weakerNestedSandbox,false);
 const withBoundary=toBashSandboxAttestation(r,{outerIsolationBoundary:true});assert.deepEqual([withBoundary.available,withBoundary.weakerNestedSandbox,withBoundary.outerIsolationBoundary],[true,true,true]);
});

test('the CLI documents usage and exit codes and refuses bad arguments before allocating anything',async()=>{
 let out='',err='',created=0;const deps={createPorts:async()=>{created++;throw Error('never');},write:t=>{out+=t;},error:t=>{err+=t;}};
 assert.equal(await main(['--help'],deps),0);assert.match(out,/Exit: 0 ready/);
 for(const argv of [['--bogus'],['--timeout-ms','5'],['--sdk-config-directory','/a'],['--sdk-config-directory','rel','--sdk-secure-storage-directory','/b'],['--broker-socket-directory','/tmp/other'],['--outer-isolation-boundary','--outer-isolation-boundary']])assert.equal(await main(argv,deps),2,argv.join(' '));
 assert.equal(created,0);assert.match(err,/READINESS_ARGUMENTS/);
 assert.deepEqual(parseArguments(['--outer-isolation-boundary','--timeout-ms','5000','--sdk-config-directory','/c','--sdk-secure-storage-directory','/s']),{outerIsolationBoundary:true,protectedPaths:{sdkConfigDirectory:'/c',sdkSecureStorageDirectory:'/s'},deadlineMs:5000});
 assert.deepEqual(parseArguments(['--broker-socket-directory','/run/meri-launch']),{outerIsolationBoundary:false,protectedPaths:{brokerSocketDirectory:'/run/meri-launch'},deadlineMs:30000});
 assert.equal(await main([],deps),3,'a port failure is an incomplete check, never a ready verdict');
 let closed=0;const {ports:p}=ports();out='';assert.equal(await main(['--outer-isolation-boundary'],{...deps,createPorts:async()=>({...p,close:()=>{closed++;}})}),0);assert.equal(closed,1);assert.equal(JSON.parse(out).attestation.available,true);
});

test('real pinned SDK on this host: the sandbox startup gate is exercised with no model turn and the CLI process exits',{timeout:90000},async()=>{
 const {createHostPorts}=await import('../sandbox-readiness/host-probes.mjs');const p=await createHostPorts({pathEnv:process.env.PATH??''});
 try{const r=await checkSandboxReadiness(p,{deadlineMs:30000});
  assert.equal(r.sdk,'0.3.295');assert.equal(r.sdkStartup.userMessagesSent,0);assert.equal(r.sdkStartup.modelTurns,0);assert.ok(['ready','refused'].includes(r.sdkStartup.status),r.sdkStartup.status);
  // On a host without bubblewrap/socat (this development container) the SDK must refuse rather than run unsandboxed.
  if(!r.dependencies.bwrap||!r.dependencies.socat){assert.equal(r.sdkStartup.status,'refused');assert.equal(r.sdkStartup.reasonCode,'SANDBOX_DEPENDENCIES_MISSING');assert.equal(r.ready,false);}
  console.log(JSON.stringify({phase:'local-sandbox-readiness',dependencies:r.dependencies,namespaces:r.namespaces,sdkStartup:r.sdkStartup,ready:r.ready}));
 }finally{p.close();}
});
