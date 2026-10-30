/** Fresh logical run resources on an already retained physical browser host. Importing is inert.
 * The shared closures are supplied only by run.mjs; no wire value can manufacture a retained launcher. */
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {own,nativeSignal,data} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
import {assertHostRunBinding} from '../binding.mjs';
import {assertBrowserHandoff} from '../../../../../packages/runtime/browser-custody.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const required=(port,names)=>{if(names.some(name=>typeof port?.[name]!=='function'))fail('HOST_BOOTSTRAP_CONFIGURATION');};

/** Reserve one exact next run before any await. The physical launcher independently checks native retirement
 * and canonical handoff; this closure does not replace either authority check. */
export function successorPreparer(shared,previous,retained){
 let taken=false;
 return async raw=>{
  if(taken||!retained()||shared.signal.aborted)fail('HOST_BROWSER_ADOPTION_REFUSED');
  const q=own(raw,['binding','deadlineMs','capabilityPolicy','control','browser','bash'],['signal']);
  const binding=assertHostRunBinding(shared.allocation,data(q.binding)),policy=assertCapabilityPolicy(data(q.capabilityPolicy));
  nativeSignal(q.signal);
  if(!Number.isSafeInteger(q.deadlineMs)||q.deadlineMs<=shared.now()||q.deadlineMs>shared.deadlineMs||q.signal?.aborted||
   !same(q.control?.endpoint,shared.controlEndpoint)||!Number.isSafeInteger(q.control.maxFreshMs)||
   !Number.isSafeInteger(q.control.refreshEveryMs)||q.browser?.controls?.ownerInstanceId!==shared.browserHost.ownerInstanceId)
   fail('HOST_BOOTSTRAP_CONFIGURATION');
  required(q.browser.controls,['bind']);required(q.browser.approvals,['decide']);
  required(q.browser.artifacts,['ingest']);required(q.browser.receipts,['record']);
  if(typeof q.browser.hold!=='function')fail('HOST_BOOTSTRAP_CONFIGURATION');
  if(policy.bash){required(q.bash,['verifyOuterIsolation']);if(typeof shared.native.validateReadinessDescriptor!=='function')fail('HOST_BOOTSTRAP_CONFIGURATION');
   if(policy.sandboxNetworkDomains.length)required(q.bash.approvals,['decide']);}
  taken=true;
  try{return await prepare({shared,previous,q,binding,policy});}
  catch(error){try{await shared.settle({reason:'failed'});}catch(cleanup){
    throw Object.assign(new Error('HOST_BOOTSTRAP_UNKNOWN'),{code:'HOST_BOOTSTRAP_UNKNOWN',cause:new AggregateError([error,cleanup])});}
   throw error;}
 };
}

async function prepare({shared:s,previous,q,binding:b,policy}){
 const {allocation:a,hostIdentity:i,native,network,cwd,paths,components:c,now}=s;
 const owner=new AbortController(),clients=[],monitors=[];
 let sdkClient,bashClient,sdkMonitor,bashMonitor,sdkNetwork,launcher,broker,observer,readinessObserver,readinessLauncher,bashFacts;
 let retired=false,retiring=false,retained=false,closed=false,closing,processTaken=false,adopted=false,pending=0;
 const parentAbort=()=>owner.abort();
 const onAbort=()=>{if(!closed&&!retained)s.revoke();};
 const onMonitorAbort=()=>{if(!closed&&!retired)s.revoke();};
 q.signal?.addEventListener('abort',parentAbort,{once:true});s.signal.addEventListener('abort',parentAbort,{once:true});
 if(q.signal?.aborted||s.signal.aborted)parentAbort();
 owner.signal.addEventListener('abort',onAbort,{once:true});
 const signals=()=>AbortSignal.any([owner.signal,...monitors.map(m=>m.signal)]);
 const check=()=>{if(closed||signals().aborted)fail('HOST_BOOTSTRAP_REVOKED');};
 const acquire=async create=>{pending++;try{const value=await create();
  if(closed||owner.signal.aborted){try{await value?.close();}catch{fail('HOST_BOOTSTRAP_CLEANUP_UNKNOWN');}fail('HOST_BOOTSTRAP_REVOKED');}
  return value;
 }finally{pending--;}};
 const cut=()=>{for(const resource of [sdkNetwork,bashFacts])try{Promise.resolve(resource?.close()).catch(()=>{});}catch{}};
 const close=()=>closing??=(async()=>{closed=true;owner.abort();cut();
  const results=await Promise.allSettled([launcher,broker,readinessLauncher,sdkNetwork,bashFacts].filter(Boolean).map(x=>x.close()));
  const observations=await Promise.allSettled([observer,readinessObserver].filter(Boolean).map(x=>x.close()));
  for(const monitor of monitors)monitor.close();for(const client of clients)client.close();
  q.signal?.removeEventListener('abort',parentAbort);s.signal.removeEventListener('abort',parentAbort);
  if(pending||results.some(r=>r.status==='rejected'||r.value?.closed!==true)||observations.some(r=>r.status==='rejected'))fail('HOST_BOOTSTRAP_CLEANUP_UNKNOWN');
  return Object.freeze({closed:true});})();
 s.register({close,cut});
 const targetCurrent=async signal=>{
  if(closed||owner.signal.aborted)fail('HOST_BOOTSTRAP_REVOKED');
  const receipt=await s.current({signal}),handoff=assertBrowserHandoff(receipt?.browserHandoff,{targetBinding:b});
  if(handoff.custody.expiresAtMs<q.deadlineMs||handoff.custody.policySha256!==s.browserDigest)fail('HOST_BROWSER_ADOPTION_REFUSED');
  return handoff;
 };
 const currentLogical=()=>{if(!s.isLogical(b))fail('BROWSER_CUSTODY_REFUSED');};
 await targetCurrent(owner.signal);await s.readBrowserPolicy({binding:structuredClone(b),signal:owner.signal});check();
 const client=purpose=>{const value=c.createClient({allocation:a,binding:b,hostIdentity:i,purpose,
  endpoint:q.control.endpoint,tls:q.control.tls,maxFreshMs:q.control.maxFreshMs,timeoutMs:q.control.timeoutMs,now});
  required(value,['readCurrent','close']);clients.push(value);return value;};
 const monitor=async readCurrent=>{const value=await acquire(()=>c.startMonitor({allocation:a,binding:b,capabilityPolicy:policy,
  readCurrent,now,maxFreshMs:q.control.maxFreshMs,refreshEveryMs:q.control.refreshEveryMs,signal:owner.signal}));
  monitors.push(value);value.signal.addEventListener('abort',onMonitorAbort,{once:true});return value;};
 sdkClient=client('sdk');sdkMonitor=await monitor(sdkClient.readCurrent);
 if(policy.bash){bashClient=client('bash');bashMonitor=await monitor(bashClient.readCurrent);}check();
 const localRelay=c.createLocalRelayPort({allocation:a,binding:b,hostIdentity:i,helperPath:native.helperPath,
  nodePath:native.nodePath,cwd,relayUid:native.relay.sdk.uid,relayGid:native.relay.sdk.gid,toolUid:native.sdk.uid,
  startConfinedLocalRelay:c.startLocalRelay,authorize:()=>sdkMonitor.refresh(),signal:signals()});
 const hostRelay=c.createHostRelayPort({allocation:a,binding:b,hostIdentity:i,helperPath:native.hostRelayHelperPath,
  nodePath:native.nodePath,uid:native.hostRelay.sdk.uid,gid:native.hostRelay.sdk.gid,
  forbiddenUids:s.identities.filter(person=>person!==native.hostRelay.sdk).map(person=>person.uid),
  forbiddenGids:s.identities.filter(person=>person!==native.hostRelay.sdk).map(person=>person.gid),
  authorize:()=>sdkMonitor.refresh(),signal:signals()});
 sdkNetwork=await acquire(()=>c.prepareNetwork({allocation:a,binding:b,kind:'sdk',routes:network.sdkRoutes,
  hostRelayUid:native.hostRelay.sdk.uid,hostRelayGid:native.hostRelay.sdk.gid,
  privateInterfaceName:network.privateInterfaceName,startHostRelayProcess:hostRelay,startLocalRelayProcess:localRelay}));check();
 observer=c.createHostObserver({allocation:a,binding:b,hostIdentity:i,profile:paths.profile,verifyConfinement:native.verifyConfinement});
 const gate=c.createSdkLaunchGate(),authorities=[{policySha256:sdkMonitor.policySha256,readCurrent:sdkClient.readCurrent,maxFreshMs:q.control.maxFreshMs},
  ...(bashMonitor?[{policySha256:bashMonitor.policySha256,readCurrent:bashClient.readCurrent,maxFreshMs:q.control.maxFreshMs}]:[])];
 launcher=await acquire(()=>previous.prepareSuccessor({binding:b,sdkNetwork,authorities,validateSdkDescriptor:s.validateSdkDescriptor,
  onSdkPrepared:({sdkLeaderPid})=>observer.arm({sdkLeaderPid}),sdkLaunchGate:gate,signal:owner.signal}));check();
 broker=await acquire(()=>launcher.prepareBrowserBroker({policy:s.browserPolicy,installation:s.installation,paths}));
 broker.failure?.catch(()=>{if(!retiring&&!closed)s.revoke();});check();
 if(policy.bash){
  readinessObserver=c.createSdkQuiescenceObserver({allocation:a,binding:b,hostIdentity:i});
  const verifyOuterIsolation=async request=>{const proof=await q.bash.verifyOuterIsolation(request);
   if(!same(proof?.allocation,a)||!same(proof?.hostIdentity,i))fail('HOST_BASH_HOST_MISMATCH');return proof;};
  const createReadinessPorts=({pathEnv})=>acquire(()=>c.createConfinedReadinessPorts({pathEnv,sdkUid:native.sdk.uid,sdkGid:native.sdk.gid,
   makeLauncher:({probeCommand,probeNodePath})=>{
    if(readinessLauncher)fail('HOST_READINESS_REUSED');
    readinessLauncher=c.createLauncher({allocation:a,binding:b,hostIdentity:i,helperPath:native.helperPath,shimPath:native.shimPath,
     sdkNetwork,authorities,sdkUid:native.sdk.uid,sdkGid:native.sdk.gid,browserUid:native.browser.uid,browserGid:native.browser.gid,
     sdkLaunchGate:gate,sdkMode:'readiness',probeCommand,probeNodePath,validateSdkDescriptor:native.validateReadinessDescriptor,
     onSdkPrepared:({sdkLeaderPid})=>readinessObserver.arm({sdkLeaderPid}),onBrowserPrepared:()=>fail('HOST_BROWSER_NOT_ADMITTED'),signal:owner.signal});
    return readinessLauncher;
   }}));
  bashFacts=await acquire(()=>c.prepareBash({binding:b,policy,verifyOuterIsolation,createReadinessPorts,approvals:q.bash.approvals,
   expiresAtMs:q.deadlineMs,now,protectedPaths:{...data(q.bash.protectedPaths??{}),brokerSocketDirectory:'/run/meri-launch'},
   hostCurrentnessSignal:signals(),signal:signals()}));
  if(!same(bashFacts?.allocation,a)||!same(bashFacts?.hostIdentity,i))fail('HOST_BASH_HOST_MISMATCH');check();
  if(policy.sandboxNetworkDomains.length){const ports=bashFacts.runtimeFacts?.bashEgress;
   if(!ports||typeof sdkNetwork.extendBashRoutes!=='function')fail('HOST_BASH_RELAY_UNAVAILABLE');
   const frozen=gate.freeze();try{
    const readSdkQuiescent=c.createSdkQuiescenceReader({observer:readinessObserver,allocation:a,binding:b,
     networkProof:sdkNetwork.proof,assertLaunchFrozen:frozen.assertFrozen,now});
    await sdkNetwork.extendBashRoutes({bashRoutes:[{name:'bash-http',localPort:ports.httpProxyPort,targetPort:ports.httpProxyPort},
     {name:'bash-socks',localPort:ports.socksProxyPort,targetPort:ports.socksProxyPort}],readSdkQuiescent,now});
    await sdkNetwork.verify();
   }finally{frozen.release();}
  }else await readinessObserver.waitQuiescent({signal:signals()});
 }
 const retirement={async prepare(input){const receipt=await launcher.prepareSdkRetirement(input);retiring=true;return receipt;},async wait({signal}){
  const receipt=await launcher.retireSdk();if(receipt?.sdkAbsent!==true)fail('HOST_SDK_RETIREMENT_REFUSED');signal?.throwIfAborted();
  retired=true;for(const value of monitors)value.close();
  if((await sdkNetwork.close())?.closed!==true)fail('HOST_BOOTSTRAP_CLEANUP_UNKNOWN');
  if(bashFacts&&(await bashFacts.close())?.closed!==true)fail('HOST_BOOTSTRAP_CLEANUP_UNKNOWN');
 },async retain({signal}){await s.current({signal});if(!retired)fail('HOST_SDK_RETIREMENT_REFUSED');signal?.throwIfAborted();
  retained=true;q.signal?.removeEventListener('abort',parentAbort);}};
 const egress={endpoint:s.egress.endpoint,async grant(request,{signal}={}){
  if(adopted)currentLogical();const handoff=await targetCurrent(signal);
  if(request.policySha256!==s.browserDigest||request.expiresAtMs>handoff.custody.expiresAtMs)fail('HOST_GRANT_REFUSED');
  await s.egress.refresh({signal});return Object.freeze({granted:true,policySha256:s.browserDigest});
 },async revoke(request,options){currentLogical();return s.egress.revokePhysical(options);}};
 const processes={waitForExit(request,options){currentLogical();return s.processes.waitForExit({...request,binding:s.physicalBinding},options);}};
 const sessions={async open(){fail('HOST_BROWSER_ADOPTION_REFUSED');},async adopt(request){
  if(adopted)fail('HOST_BROWSER_ADOPTION_REFUSED');await targetCurrent(request.signal);
  const handle=await s.browserHost.adopt(request,{installation:broker.installation,modelTransport:broker.modelTransport,
   controls:q.browser.controls,retirement,hold:q.browser.hold});
  adopted=true;s.setLogical(b);return handle;
 }};
 const browserPort=c.createBrowserPort({binding:b,cwd,installation:broker.installation,policy:s.readBrowserPolicy,sessions,
  egress,processes,approvals:q.browser.approvals,artifacts:q.browser.artifacts,receipts:q.browser.receipts,sourceScopes:q.browser.sourceScopes});
 check();
 return Object.freeze({allocation:a,binding:b,hostIdentity:i,browserPort,browserHost:s.browserHost,
  sdkIdentity:Object.freeze({uid:native.sdk.uid,gid:native.sdk.gid}),
  bashRuntimeFacts:bashFacts?.runtimeFacts??Object.freeze({}),browserInstallation:broker.installation,
  processClientFactory(){if(processTaken)fail('HOST_SDK_QUERY_REUSED');check();
   if(!adopted)fail('HOST_BROWSER_ADOPTION_REFUSED');processTaken=true;return launcher.createSdkProcessClient();},
  prepareSuccessor:successorPreparer(s,launcher,()=>retained),settle:s.settle});
}
