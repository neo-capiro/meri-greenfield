// @ts-check
/** Trusted guest bootstrap for one D005 run. The only conversation SDK process is the descriptor captured by
 * createPreparedRunnerQuery through the returned one-use processClientFactory. Importing this module is inert.
 * The browser activation record remains authoritative; preparing a denied proxy/broker never opens that gate. */
import {posix} from 'node:path';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {data,nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';
import {activationOpen} from '../../browser/activation.mjs';
import {browserPaths} from '../../browser/workspace.mjs';
import {createHostCurrentnessClient} from '../control/client.mjs';
import {startHostRunCurrentnessMonitor} from '../run-currentness-monitor.mjs';
import {startBrowserHostEgressService} from '../browser-egress-service.mjs';
import {prepareHostBashRuntimeFacts} from '../bash-runtime-facts.mjs';
import {prepareNetworkCompartment} from '../network/confinement.mjs';
import {createNetworkPlan} from '../network/plan.mjs';
import {createBrowserProcessObserver} from '../process-observer.mjs';
import {readBrowserWorkspaceIsolation,BROWSER_WORKSPACE_READBACK_SCHEMA} from '../browser-workspace/readback.mjs';
import {createHostWideProcessObserver} from '../host-wide-process-observer.mjs';
import {createHostLauncher,startConfinedLocalRelay} from '../launcher/supervisor.mjs';
import {createConfinedReadinessPorts} from '../launcher/readiness-ports.mjs';
import {createNativeLocalRelayPort} from '../network/launcher-adapter.mjs';
import {createSdkLaunchGate,createSdkChildQuiescenceObserver,createSdkQuiescenceReader} from '../launcher/sdk-quiescence.mjs';
import {createBrowserHostRuntimePort} from '../browser-runtime-port.mjs';
import {createConversationHostTeardown} from '../teardown.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity} from '../binding.mjs';

const fault=(code,cause)=>Object.assign(new Error(code),{code,...(cause?{cause}:{})});
const fail=code=>{throw fault(code);};
const DEFAULT_COMPONENTS=Object.freeze({createClient:createHostCurrentnessClient,startMonitor:startHostRunCurrentnessMonitor,
 startBrowserEgress:startBrowserHostEgressService,prepareBash:prepareHostBashRuntimeFacts,
 prepareNetwork:prepareNetworkCompartment,createBrowserObserver:createBrowserProcessObserver,
 createHostObserver:createHostWideProcessObserver,createLauncher:createHostLauncher,
 createLocalRelayPort:createNativeLocalRelayPort,
 createConfinedReadinessPorts,
 createSdkLaunchGate,createSdkQuiescenceObserver:createSdkChildQuiescenceObserver,
 createSdkQuiescenceReader,
 startLocalRelay:startConfinedLocalRelay,createBrowserPort:createBrowserHostRuntimePort,
 createTeardown:createConversationHostTeardown});
const stopped=signal=>{if(signal?.aborted)fail('HOST_BOOTSTRAP_REVOKED');};
const exactWorkspace=(cwd,conversationId)=>typeof cwd==='string'&&posix.isAbsolute(cwd)&&
 posix.resolve(cwd)===cwd&&!cwd.includes('\0')&&cwd.endsWith(`/${conversationId}`);
const required=(value,names)=>{if(!value||typeof value!=='object'||names.some(name=>typeof value[name]!=='function'))fail('HOST_BOOTSTRAP_CONFIGURATION');};
const relayRoutes=ports=>Object.freeze([{name:'bash-http',localPort:ports.httpProxyPort,targetPort:ports.httpProxyPort},
 {name:'bash-socks',localPort:ports.socksProxyPort,targetPort:ports.socksProxyPort}]);
/** The native broker waits at preexec READY until this exact readback and process-observer arm both complete. */
export async function armBrowserAfterWorkspaceReadback({allocation,binding,hostIdentity,cwd,paths,
 browserUid,browserGid,sdkUid,sdkGid,leaderPid,browserObserver,
 readWorkspace=readBrowserWorkspaceIsolation,now=Date.now}){
 if(typeof readWorkspace!=='function'||typeof browserObserver?.arm!=='function'||typeof now!=='function')
  fail('HOST_BROWSER_WORKSPACE_UNPROVEN');
 const receipt=await readWorkspace({allocation,binding,hostIdentity,cwd,paths,
  browserUid,browserGid,sdkUid,sdkGid,leaderPid});
 let observed;try{observed=data(receipt);}catch{fail('HOST_BROWSER_WORKSPACE_UNPROVEN');}
 const at=now();
 if(observed?.schema!==BROWSER_WORKSPACE_READBACK_SCHEMA||
  observed.allocationSha256!==canonicalSha256(allocation)||
  observed.bindingSha256!==canonicalSha256(binding)||
  observed.hostIdentitySha256!==canonicalSha256(hostIdentity)||
  observed.cwd!==cwd||observed.profile!==paths.profile||observed.output!==paths.output||
  observed.home!==paths.home||observed.browserUid!==browserUid||
  observed.browserGid!==browserGid||observed.sdkUid!==sdkUid||observed.sdkGid!==sdkGid||
  observed.leaderPid!==leaderPid||typeof observed.browserMountNamespace!=='string'||
  !/^mnt:\[[1-9][0-9]*\]$/u.test(observed.browserMountNamespace)||
  !/^[1-9][0-9]*$/u.test(observed.browserStartTicks)||
  !/^[1-9][0-9]*$/u.test(observed.overlayMountId)||
  !/^[1-9][0-9]*$/u.test(observed.stateMountId)||
  observed.overlayMountId===observed.stateMountId||
  !/^[1-9][0-9]*$/u.test(observed.originalCwdInode)||
  !/^[1-9][0-9]*$/u.test(observed.stateInode)||
  !Number.isSafeInteger(observed.observedAtMs)||observed.observedAtMs>at||
  observed.observedAtMs<at-1000)fail('HOST_BROWSER_WORKSPACE_UNPROVEN');
 return browserObserver.arm({leaderPid});
}

/** `verifyOuterIsolation` and a pinned readiness descriptor validator are mandatory for Bash. The native adapter
 * runs the real no-model SDK startup and namespace probes in the confined SDK compartment. The control endpoint/TLS
 * material, policy reader and cloud
 * destroy/readback ports are supplied only by their canonical owners. `components` is a focused-test seam, not an
 * authorization API. Every resource created here is closed or left explicitly UNKNOWN before return/rejection. */
export async function prepareGuestHostRun({allocation,binding,hostIdentity,cwd,deadlineMs,capabilityPolicy,
 readBrowserPolicy,control,model,browser,bash,native,network,host,now=Date.now,signal,
 components=DEFAULT_COMPONENTS}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding),i=assertD005HostIdentity(hostIdentity,b,a);
 let policy;try{policy=assertCapabilityPolicy(capabilityPolicy);}catch{fail('HOST_BOOTSTRAP_CONFIGURATION');}
 try{nativeSignal(signal);}catch{fail('HOST_BOOTSTRAP_CONFIGURATION');}
 if(typeof now!=='function'||!exactWorkspace(cwd,b.conversationId)||!Number.isSafeInteger(deadlineMs)||
  deadlineMs<=now()||deadlineMs>a.leaseDeadlineMs||typeof readBrowserPolicy!=='function'||
  !control||!model||!browser||!native||!network||!host||!components||
  !Number.isSafeInteger(control.maxFreshMs)||!Number.isSafeInteger(control.refreshEveryMs)||
  typeof native.validateSdkDescriptor!=='function'||typeof native.nodePath!=='string'||
  !posix.isAbsolute(native.nodePath)||posix.resolve(native.nodePath)!==native.nodePath||
  typeof native.verifyConfinement!=='function'||
  !Array.isArray(network.sdkRoutes)||network.sdkRoutes.length!==2)fail('HOST_BOOTSTRAP_CONFIGURATION');
 let sdkRoutePlan;try{sdkRoutePlan=createNetworkPlan({allocation:a,binding:b,kind:'sdk',routes:network.sdkRoutes});}
 catch{fail('HOST_BOOTSTRAP_CONFIGURATION');}
 const [modelRoute,controlRoute]=sdkRoutePlan.routes;
 if(controlRoute.targetAddress!==control.endpoint?.address||controlRoute.targetPort!==control.endpoint?.port||
  modelRoute.targetAddress!==model.endpoint?.address||modelRoute.targetPort!==model.endpoint?.port||
  typeof model.localCaPath!=='string'||!posix.isAbsolute(model.localCaPath)||
  posix.resolve(model.localCaPath)!==model.localCaPath)fail('HOST_BOOTSTRAP_CONFIGURATION');
 const identity=person=>Number.isSafeInteger(person?.uid)&&person.uid>=1000&&person.uid<=65533&&
  Number.isSafeInteger(person?.gid)&&person.gid>=1000&&person.gid<=65533;
 if(!identity(native.sdk)||!identity(native.browser)||!identity(native.relay?.sdk)||!identity(native.relay?.browser)||
  new Set([native.sdk.uid,native.browser.uid,native.relay.sdk.uid,native.relay.browser.uid]).size!==4||
  new Set([native.sdk.gid,native.browser.gid,native.relay.sdk.gid,native.relay.browser.gid]).size!==4)
  fail('HOST_BOOTSTRAP_CONFIGURATION');
 required(host,['destroy','observeAbsent']);
 if(policy.bash){required(bash,['verifyOuterIsolation']);
  if(typeof native.validateReadinessDescriptor!=='function')fail('HOST_BOOTSTRAP_CONFIGURATION');
  if(policy.sandboxNetworkDomains.length)required(bash.approvals,['decide']);}
 required(components,['createClient','startMonitor','startBrowserEgress','prepareBash','prepareNetwork',
  'createBrowserObserver','createHostObserver','createLauncher','createLocalRelayPort','createSdkLaunchGate',
  'createSdkQuiescenceObserver','createSdkQuiescenceReader','createConfinedReadinessPorts',
  'startLocalRelay','createBrowserPort','createTeardown']);
 stopped(signal);
 const owner=new AbortController(),paths=browserPaths(cwd);
 const parentAbort=()=>owner.abort(fault('HOST_BOOTSTRAP_REVOKED'));
 signal?.addEventListener('abort',parentAbort,{once:true});if(signal?.aborted)parentAbort();
 let sdkClient,bashClient,browserClient,sdkMonitor,bashMonitor,browserEgress,browserObserver,hostObserver,
  sdkNetwork,browserNetwork,launcher,readinessLauncher,broker,bashFacts,teardown,browserPort,settlement,stopping,
  sdkLaunchGate,readinessObserver;
 let browserGrantAttempted=false,bootstrapped=false,processClientTaken=false,settling=false;
 let browserActive=false;
 const clients=[];
 const closeClients=()=>{for(const client of clients)try{client.close();}catch{}};
 const allSignals=()=>AbortSignal.any([owner.signal,sdkMonitor?.signal,bashMonitor?.signal].filter(Boolean));
 const emergencyCut=()=>{
  // These close methods revoke host relays/proxy tunnels synchronously before their first await. A monitor loss
  // must cut reachability even while teardown waits for separate process and physical absence readbacks.
  for(const resource of [sdkNetwork,browserNetwork,browserEgress,bashFacts])
   if(resource)try{Promise.resolve(resource.close()).catch(()=>{});}catch{}
 };
 owner.signal.addEventListener('abort',()=>{emergencyCut();
  if(bootstrapped&&!settling)void settle({reason:'revoked'}).catch(()=>{});},{once:true});
 const revokeBrowser=async()=>{
  if(!browserEgress)return Object.freeze({revoked:true});
  if(browserGrantAttempted)return browserEgress.revoke({binding:b,policySha256:browserDigest});
  const receipt=await browserEgress.close();if(receipt?.closed!==true)fail('HOST_BOOTSTRAP_CLEANUP_UNKNOWN');
  return Object.freeze({revoked:true});
 };
 const revokeBash=async()=>{if(!bashFacts)return Object.freeze({revoked:true});
  const receipt=await bashFacts.close();if(receipt?.closed!==true)fail('HOST_BOOTSTRAP_CLEANUP_UNKNOWN');
  return Object.freeze({revoked:true});};
 const stopLocal=()=>stopping??=(async()=>{
  // A close failure never prevents the other owned resources from being retired. Relay processes live below the
  // host-wide cgroup, so both networks must close before teardown checks recursive populated=0.
  const resources=[launcher,readinessLauncher,broker,browserNetwork,sdkNetwork,browserEgress,bashFacts];
  const results=await Promise.allSettled(resources.filter(Boolean).map(resource=>resource.close()));
  const observers=await Promise.allSettled([browserObserver,readinessObserver].filter(Boolean).map(resource=>resource.close()));
  if(results.some(result=>result.status==='rejected'||result.value?.closed!==true)||
   observers.some(result=>result.status==='rejected'))fail('HOST_BOOTSTRAP_CLEANUP_UNKNOWN');
  return Object.freeze({closed:true});
 })();
 let browserDigest='0'.repeat(64);
 const processPort=Object.freeze({waitForExit(request,options){if(!hostObserver)fail('HOST_PROCESS_OBSERVATION_UNKNOWN');
  return hostObserver.waitForExit(request,options);}});
 const cleanupPorts=Object.freeze({
  browser:Object.freeze({revoke:revokeBrowser,async close(){return stopLocal();}}),
  bash:Object.freeze({revoke:revokeBash,async close(){return stopLocal();}}),
  processes:processPort,host,
 });
 teardown=components.createTeardown({allocation:a,binding:b,hostIdentity:i,cwd,
  browserPolicySha256:browserDigest,ports:cleanupPorts,now});
 const settle=({reason='failed'}={})=>{if(settlement)return settlement;settling=true;
  settlement=(async()=>{
  owner.abort(fault('HOST_BOOTSTRAP_REVOKED'));
  let result,problem;
  try{if(!teardown)fail('HOST_BOOTSTRAP_CLEANUP_UNKNOWN');result=await teardown.settle({reason});}
  catch(error){problem=error;}
  try{await stopLocal();}catch(error){problem??=error;}
  try{await hostObserver?.close();}catch(error){problem??=error;}
  sdkMonitor?.close();bashMonitor?.close();closeClients();signal?.removeEventListener('abort',parentAbort);
  if(problem)throw problem;return result;
  })();return settlement;};
 try{
  // Read canonical policy before allocating local resources; pin the command and future fragment to one digest.
  const first=validateBrowserPolicy(data(await readBrowserPolicy({binding:structuredClone(b),signal:owner.signal})));
  browserDigest=canonicalSha256(first);stopped(owner.signal);
  // This hard source gate is intentionally not injectable: no runtime argument can activate browser.
  browserActive=first.enabled&&activationOpen();
  if(browserActive){
   if(typeof browser.resolve!=='function')fail('HOST_BOOTSTRAP_CONFIGURATION');
   required(browser.approvals,['decide']);required(browser.artifacts,['ingest']);
   required(browser.receipts,['record']);
  }
  const pinnedBrowserPolicy=async request=>{
   const current=validateBrowserPolicy(data(await readBrowserPolicy(request)));
   if(canonicalSha256(current)!==browserDigest)fail('HOST_BROWSER_POLICY_CHANGED');return current;
  };
  teardown=components.createTeardown({allocation:a,binding:b,hostIdentity:i,cwd,browserPolicySha256:browserDigest,
   ports:cleanupPorts,now});
  const client=purpose=>{const value=components.createClient({allocation:a,binding:b,hostIdentity:i,purpose,
   endpoint:control.endpoint,tls:control.tls,maxFreshMs:control.maxFreshMs,timeoutMs:control.timeoutMs,now});
   required(value,['readCurrent','close']);clients.push(value);return value;};
  sdkClient=client('sdk');if(policy.bash)bashClient=client('bash');
  if(browserActive)browserClient=client('browser');
  const monitorInput={allocation:a,binding:b,capabilityPolicy:policy,now,maxFreshMs:control.maxFreshMs,
   refreshEveryMs:control.refreshEveryMs,signal:owner.signal};
  sdkMonitor=await components.startMonitor({...monitorInput,readCurrent:sdkClient.readCurrent});
  sdkMonitor.signal.addEventListener('abort',()=>owner.abort(fault('HOST_BOOTSTRAP_REVOKED')),{once:true});
  if(policy.bash)bashMonitor=await components.startMonitor({...monitorInput,readCurrent:bashClient.readCurrent});
  bashMonitor?.signal.addEventListener('abort',()=>owner.abort(fault('HOST_BOOTSTRAP_REVOKED')),{once:true});
  stopped(allSignals());
  if(browserActive){browserEgress=await components.startBrowserEgress({allocation:a,binding:b,
   readCurrent:browserClient.readCurrent,resolve:browser.resolve,now,
   maxFreshMs:control.maxFreshMs,refreshEveryMs:control.refreshEveryMs});stopped(allSignals());}
  const installation=browserActive?{...data(browser.installation),egressProxy:browserEgress.endpoint}:undefined;
  const proxyPort=browserActive?Number(new URL(browserEgress.endpoint).port):undefined;
  const localRelay=kind=>components.createLocalRelayPort({allocation:a,binding:b,hostIdentity:i,
   helperPath:native.helperPath,nodePath:native.nodePath,cwd,relayUid:native.relay[kind].uid,
   relayGid:native.relay[kind].gid,toolUid:native[kind].uid,
   startConfinedLocalRelay:components.startLocalRelay,authorize:async()=>sdkMonitor.refresh(),signal:allSignals()});
  // The SDK compartment starts with model/control only. Its Bash proxy routes are added after confined readiness.
  sdkNetwork=await components.prepareNetwork({allocation:a,binding:b,kind:'sdk',routes:network.sdkRoutes,
   startLocalRelayProcess:localRelay('sdk')});
  stopped(allSignals());
  if(browserActive){browserNetwork=await components.prepareNetwork({allocation:a,binding:b,kind:'browser',
   routes:[{name:'browser-http',localPort:proxyPort,targetPort:proxyPort}],
   startLocalRelayProcess:localRelay('browser')});stopped(allSignals());
   browserObserver=components.createBrowserObserver({allocation:a,binding:b,profile:paths.profile});}
  hostObserver=components.createHostObserver({allocation:a,binding:b,hostIdentity:i,profile:paths.profile,
   verifyConfinement:native.verifyConfinement});
  sdkLaunchGate=components.createSdkLaunchGate();
  const launcherBase={allocation:a,binding:b,hostIdentity:i,helperPath:native.helperPath,
   shimPath:native.shimPath,sdkNetwork,browserNetwork,
   authorities:[{policySha256:sdkMonitor.policySha256,readCurrent:sdkClient.readCurrent,maxFreshMs:control.maxFreshMs},
    ...(bashMonitor?[{policySha256:bashMonitor.policySha256,readCurrent:bashClient.readCurrent,
     maxFreshMs:control.maxFreshMs}]:[])],
   sdkUid:native.sdk.uid,sdkGid:native.sdk.gid,browserUid:native.browser.uid,browserGid:native.browser.gid,
   sdkLaunchGate,onBrowserPrepared:({leaderPid})=>{if(!browserObserver)fail('HOST_BROWSER_NOT_ADMITTED');
    return armBrowserAfterWorkspaceReadback({allocation:a,binding:b,hostIdentity:i,cwd,paths,
     browserUid:native.browser.uid,browserGid:native.browser.gid,
     sdkUid:native.sdk.uid,sdkGid:native.sdk.gid,leaderPid,browserObserver});},signal:allSignals()};
  const validatePinnedSdkDescriptor=descriptor=>{
   const admitted=native.validateSdkDescriptor(descriptor);
   if(canonicalSha256(admitted)!==canonicalSha256(descriptor))fail('HOST_MODEL_DESCRIPTOR_REFUSED');
   let url;try{url=new URL(admitted.env.ANTHROPIC_BASE_URL);}catch{fail('HOST_MODEL_DESCRIPTOR_REFUSED');}
   if(url.protocol!=='https:'||url.hostname!=='127.0.0.1'||Number(url.port)!==modelRoute.localPort||
    url.pathname!=='/'||url.search||url.hash||url.username||url.password||
    admitted.env.NODE_EXTRA_CA_CERTS!==model.localCaPath)fail('HOST_MODEL_DESCRIPTOR_REFUSED');
   return admitted;
  };
  launcher=components.createLauncher({...launcherBase,sdkMode:'conversation',
   validateSdkDescriptor:validatePinnedSdkDescriptor,
   onSdkPrepared:({sdkLeaderPid})=>hostObserver.arm({sdkLeaderPid})});
  if(browserActive){broker=await launcher.prepareBrowserBroker({policy:first,installation,paths});
   broker.failure?.catch(()=>{owner.abort(fault('HOST_BROWSER_BROKER_UNKNOWN'));
    if(bootstrapped)void settle({reason:'failed'}).catch(()=>{});});}
  stopped(allSignals());
  if(policy.bash){
   readinessObserver=components.createSdkQuiescenceObserver({allocation:a,binding:b,hostIdentity:i});
   // The readiness adapter uses a separate sdkMode:'readiness' native launcher for the two bubblewrap probes and
   // the real SDK startup. It shares the launch gate and SDK namespace, but never creates a conversation query.
   const verifyPinnedOuterIsolation=async request=>{
    const proof=await bash.verifyOuterIsolation(request);
    if(canonicalSha256(proof?.allocation)!==canonicalSha256(a)||
     canonicalSha256(proof?.hostIdentity)!==canonicalSha256(i))fail('HOST_BASH_HOST_MISMATCH');
    return proof;
   };
   const createReadinessPorts=({pathEnv})=>components.createConfinedReadinessPorts({pathEnv,
    sdkUid:native.sdk.uid,sdkGid:native.sdk.gid,
    makeLauncher:({probeCommand,probeNodePath})=>{
     if(readinessLauncher)fail('HOST_READINESS_REUSED');
     readinessLauncher=components.createLauncher({...launcherBase,sdkMode:'readiness',probeCommand,probeNodePath,
      validateSdkDescriptor:native.validateReadinessDescriptor,
      onSdkPrepared:({sdkLeaderPid})=>readinessObserver.arm({sdkLeaderPid})});
     return readinessLauncher;
    }});
   bashFacts=await components.prepareBash({binding:b,policy,verifyOuterIsolation:verifyPinnedOuterIsolation,
    createReadinessPorts,approvals:bash.approvals,expiresAtMs:deadlineMs,now,
    protectedPaths:{...data(bash.protectedPaths??{}),brokerSocketDirectory:'/run/meri-launch'},
    hostCurrentnessSignal:allSignals(),signal:allSignals()});
   if(canonicalSha256(bashFacts?.allocation)!==canonicalSha256(a)||
    canonicalSha256(bashFacts?.hostIdentity)!==canonicalSha256(i))fail('HOST_BASH_HOST_MISMATCH');
   stopped(allSignals());
   if(policy.sandboxNetworkDomains.length){
    const ports=bashFacts.runtimeFacts?.bashEgress;
    if(!ports||typeof sdkNetwork.extendBashRoutes!=='function')fail('HOST_BASH_RELAY_UNAVAILABLE');
    const frozen=sdkLaunchGate.freeze();
    try{const readSdkQuiescent=components.createSdkQuiescenceReader({observer:readinessObserver,
      allocation:a,binding:b,networkProof:sdkNetwork.proof,assertLaunchFrozen:frozen.assertFrozen,now});
     await sdkNetwork.extendBashRoutes({bashRoutes:relayRoutes(ports),readSdkQuiescent,now});
     await sdkNetwork.verify();}
    catch(error){throw fault('HOST_BASH_RELAY_UNAVAILABLE',error);}
    finally{frozen.release();}
   }else await readinessObserver.waitQuiescent({signal:allSignals()});
  }
  if(browserActive){const egressPort=Object.freeze({endpoint:browserEgress.endpoint,
    async grant(grant,options){browserGrantAttempted=true;return browserEgress.grant(grant,options);},
    revoke:request=>browserEgress.revoke(request)});
   browserPort=components.createBrowserPort({binding:b,cwd,installation:broker.installation,policy:pinnedBrowserPolicy,
    egress:egressPort,processes:browserObserver,approvals:browser.approvals,artifacts:browser.artifacts,
    receipts:browser.receipts,sourceScopes:browser.sourceScopes});}
  const processClientFactory=()=>{if(processClientTaken)fail('HOST_SDK_QUERY_REUSED');
   stopped(allSignals());processClientTaken=true;return launcher.createSdkProcessClient();};
  stopped(allSignals());
  bootstrapped=true;
  // The activity's existing createPreparedRunnerQuery must consume this factory once. Nothing here calls SDK query.
  return Object.freeze({allocation:a,binding:b,hostIdentity:i,browserPort,
   bashRuntimeFacts:bashFacts?.runtimeFacts??Object.freeze({}),processClientFactory,
   browserInstallation:broker?.installation,settle});
 }catch(error){
  if(!teardown){owner.abort();try{await stopLocal();}catch{}closeClients();signal?.removeEventListener('abort',parentAbort);
   throw fault('HOST_BOOTSTRAP_UNKNOWN',error);}
  try{await settle({reason:'failed'});}catch(cleanup){throw fault('HOST_BOOTSTRAP_UNKNOWN',new AggregateError([error,cleanup]));}
  throw error;
 }
}
