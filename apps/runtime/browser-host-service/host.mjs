/** Production start and CLI main for ONE provisioned browser-only host (the second purpose of the native host lifecycle).
 *
 * Everything the host trusts comes from the protected installed bundle the bootstrap program wrote (`installed.mjs`):
 * allocation, original run binding, live physical identity, dual TLS pairs, the Control endpoint and the reviewed image
 * layout. Startup order, each step owned and unwound on failure:
 *   1. root-owned generation root and run parent cgroups (hierarchy.mjs), then the lifecycle producer pins the root;
 *   2. the authenticated browser-purpose currentness client reads this run's canonical facts: the active browser policy
 *      and its digest are the only policy this host will ever serve;
 *   3. the run-bound egress proxy as its own process under the proxy uid in the run's `browser-proxy` cgroup leaf
 *      (denied until `browser-prepare` grants the policy; the supervisor decides every connection with the system
 *      resolver), confined by the host nft guard to public TCP 80/443, then the browser network compartment with its
 *      one route from the namespace-local relay port to that proxy;
 *   4. the per-browser and host-wide observers (the latter with the measured browser confinement verifier);
 *   5. the browser-only service composition (workspace, launcher, context, session facade, named operations, viewer)
 *      with the host-owned retirement, the Control facts as `current`, Control's hold as `hold`, and the fixed Control
 *      lifecycle route served on the same pinned listener.
 * Control ends the run over that route: `close` settles the host locally (session, context, launcher, egress, profile,
 * compartment) while the listener stays up to answer; `processes` proves the generation cgroup empty; Control then
 * destroys and reads back the instance. An operator stop (SIGTERM) runs the same local settlement and exits. */
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {installedBrowserHostConfig} from './installed.mjs';
import {composeBrowserOnlyHostService} from './composition.mjs';
import {createBrowserOnlyReadRun} from './read-run.mjs';
import {createBrowserHostRetirement} from './retirement.mjs';
import {assertBrowserHostFacts} from '../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
import {createHostCurrentnessClient} from '../../worker/conversation/host/control/client.mjs';
import {assertBrowserHostCurrent} from '../../worker/conversation/host/binding.mjs';
import {validateBrowserPolicy,PLAYWRIGHT_MCP_VERSION} from '../../worker/conversation/browser/policy.mjs';
import {startBrowserHostEgressService} from '../../worker/conversation/host/browser-egress-service.mjs';
import {systemResolver} from '../../worker/conversation/egress/bash-egress.mjs';
import {startProxyProcess} from '../../worker/conversation/egress/proxy-process.mjs';
import {installBrowserProxyGuard} from '../../worker/conversation/host/network/proxy-guard.mjs';
import {prepareNetworkCompartment} from '../../worker/conversation/host/network/confinement.mjs';
import {createNativeHostRelayPort} from '../../worker/conversation/host/network/host-launcher-adapter.mjs';
import {createNativeLocalRelayPort} from '../../worker/conversation/host/network/launcher-adapter.mjs';
import {startConfinedLocalRelay} from '../../worker/conversation/host/launcher/supervisor.mjs';
import {createBrowserProcessObserver} from '../../worker/conversation/host/process-observer.mjs';
import {createHostWideProcessObserver} from '../../worker/conversation/host/host-wide-process-observer.mjs';
import {createBrowserHostConfinementVerifier} from '../../worker/conversation/host/composition/browser-verifier.mjs';
import {createBrowserViewerRelay} from '../../worker/conversation/host/browser-viewer-relay.mjs';
import {browserPaths,disposeBrowserState} from '../../worker/conversation/browser/workspace.mjs';
import {prepareHostHierarchy,prepareRunParent,prepareRunLeaf,attachProcess,applyRunLimits,releaseOwnedHierarchy,realHierarchyPort} from '../native-processing-host/hierarchy.mjs';
import {openNativeLifecycle} from '../native-processing-host/lifecycle.mjs';
import {createLifecycleHandler,createControlPeerAuthenticator,readBoundedBody} from '../native-processing-host/lifecycle-http.mjs';
import {NATIVE_LIFECYCLE_BODY_BYTES} from '../native-processing-host/lifecycle-contract.mjs';

const fault=code=>Object.assign(new Error(code),{code});
const fail=code=>{throw fault(code);};

/** The pinned Playwright MCP server implementation next to the image's CLI: the same module the qualified native session
 * test drives, resolved from the fixed `cliPath` so no other installation can be selected. */
function pinnedUpstream(cliPath){
 const require=createRequire(cliPath);
 if(require('./package.json').version!==PLAYWRIGHT_MCP_VERSION)fail('BROWSER_HOST_INSTALLATION_REFUSED');
 const {tools}=require('playwright-core/lib/coreBundle.js');
 if(typeof tools?.createConnection!=='function')fail('BROWSER_HOST_INSTALLATION_REFUSED');
 return Object.freeze({version:PLAYWRIGHT_MCP_VERSION,createConnection:tools.createConnection});
}

export async function startBrowserHost({config,ports={},now=Date.now}={}){
 const c=config??installedBrowserHostConfig({now});
 const {allocation,binding,hostIdentity,identities,paths,network,limits,installation,cwd}=c;
 const tls=c.installedTls.tls,maxFreshMs=Math.min(limits.maxFreshMs,30000),hierarchyPort=ports.hierarchyPort??realHierarchyPort;
 const spawn=ports.spawnNative===undefined?{}:{spawnNative:ports.spawnNative};
 const profile=browserPaths(cwd).profile;
 const client=(ports.createClient??createHostCurrentnessClient)({allocation,binding,hostIdentity,purpose:'browser',
  endpoint:{address:c.control.address,port:c.control.port,serverName:c.control.serverName,serverFingerprintSha256:c.control.serverFingerprintSha256},
  tls:{cert:tls.clientCert,key:tls.clientKey,ca:tls.controlCa},maxFreshMs,timeoutMs:Math.min(5000,maxFreshMs),now});
 const facts=async(signal,requested=binding)=>{
  const answer=await client.readFacts({allocation:structuredClone(allocation),binding:structuredClone(requested),signal});
  return assertBrowserHostFacts(answer?.facts,{binding:requested});
 };
 // Every acquired owner is released in reverse order when a later startup step refuses.
 const owned=[];
 const unwind=async()=>{for(const release of owned.reverse()){try{await release();}catch{}}};
 try{
  // 1. Root-owned hierarchy, then the lifecycle producer pins the generation root (boot id checked before and after).
  const physical={allocation:{...allocation,instanceId:hostIdentity.instanceId,bootId:hostIdentity.bootId},hostIdentity,binding,image:c.image};
  const hierarchy=await prepareHostHierarchy({config:physical,port:hierarchyPort,supervisorPid:globalThis.process?.pid,now});
  if(hierarchy.unavailable===true)fail('BROWSER_HOST_HIERARCHY_UNAVAILABLE');
  owned.push(()=>releaseOwnedHierarchy({record:hierarchy,port:hierarchyPort}));
  const runParent=await prepareRunParent({config:physical,binding,port:hierarchyPort,now,deadlineMs:now()+limits.deadlineMaxMs});
  owned.push(()=>releaseOwnedHierarchy({record:runParent,port:hierarchyPort}));
  // Finite memory, pid and cpu limits for every process of the run (browser, relays, proxy), read back from the kernel.
  const runLimits={memoryBytes:limits.memoryBytes,pidsMax:limits.pidsMax,cpuQuotaUs:limits.cpuQuotaUs,periodUs:limits.periodUs};
  await applyRunLimits({path:runParent.path,limits:runLimits,port:hierarchyPort});
  const leaves=[];
  let quiesce=null;
  const lifecycle=await openNativeLifecycle({config:physical,quiesce:input=>quiesce===null?Object.freeze({closed:false}):quiesce(input),
   ...(ports.lifecyclePorts===undefined?{}:{ports:ports.lifecyclePorts}),now,deadlineMs:now()+limits.deadlineMaxMs});
  owned.push(()=>lifecycle.dispose());
  // 2. The run's canonical facts: an active browser policy, or no host at all.
  const initial=await facts();
  if(initial.phase!=='active'||initial.browserPolicy===undefined)fail('BROWSER_HOST_POLICY_UNAVAILABLE');
  const policy=validateBrowserPolicy(initial.browserPolicy),policySha256=initial.browserPolicySha256,deadlineMs=initial.deadlineMs;
  if(!policy.enabled)fail('BROWSER_HOST_POLICY_UNAVAILABLE');
  const authority=Object.freeze({policySha256,maxFreshMs,readCurrent:input=>client.readCurrent(input)});
  const authorize=async({signal}={})=>{
   const receipt=await client.readCurrent({allocation:structuredClone(allocation),binding:structuredClone(binding),policySha256,signal});
   assertBrowserHostCurrent({allocation,binding,policySha256,current:receipt,nowMs:now(),maxFreshMs});
  };
  // 3. Egress proxy first (its port is the compartment's route target): a separate process under the proxy uid, placed in
  //    the run's browser-proxy leaf before it listens, then pinned by the host nft guard; then the browser network compartment.
  const startProxy=input=>startProxyProcess({...input,nodePath:paths.nodePath,uid:identities.proxy.uid,gid:identities.proxy.gid,...(ports.spawnNative===undefined?{}:{spawnNode:ports.spawnNative}),
   place:async pid=>{
    const leaf=await prepareRunLeaf({config:physical,binding,name:'browser-proxy',port:hierarchyPort});
    leaves.push(leaf);await attachProcess({path:leaf.path,pid,port:hierarchyPort});
   }});
  const browser=await (ports.startEgress??startBrowserHostEgressService)({allocation,binding,readCurrent:authority.readCurrent,resolve:systemResolver,
   now,maxFreshMs,refreshEveryMs:Math.max(1,Math.floor(maxFreshMs/2)),startProxy});
  owned.push(()=>browser.close());
  if(!Number.isSafeInteger(browser.pid))fail('BROWSER_HOST_PROXY_UNCONFINED');
  const guard=await (ports.installProxyGuard??installBrowserProxyGuard)({allocation,binding,eniName:network.privateInterfaceName,proxyUid:identities.proxy.uid,pid:browser.pid,
   ...(ports.execute===undefined?{}:{execute:ports.execute})});
  owned.push(()=>guard.close());
  const proxyPort=Number(new URL(browser.endpoint).port);
  const browserNetwork=await (ports.prepareCompartment??prepareNetworkCompartment)({allocation,binding,kind:'browser',
   routes:[{name:'browser-http',localPort:network.browserProxyPort,targetAddress:'127.0.0.1',targetPort:proxyPort}],
   startHostRelayProcess:createNativeHostRelayPort({allocation,binding,hostIdentity,helperPath:paths.hostRelayHelperPath,nodePath:paths.nodePath,
    uid:identities.hostRelay.uid,gid:identities.hostRelay.gid,forbiddenUids:[identities.sdk.uid,identities.browser.uid,identities.localRelay.uid,identities.proxy.uid],
    forbiddenGids:[identities.sdk.gid,identities.browser.gid,identities.localRelay.gid,identities.proxy.gid],authorize,...spawn}),
   hostRelayUid:identities.hostRelay.uid,hostRelayGid:identities.hostRelay.gid,privateInterfaceName:network.privateInterfaceName,
   startLocalRelayProcess:createNativeLocalRelayPort({allocation,binding,hostIdentity,helperPath:paths.helperPath,nodePath:paths.nodePath,cwd:'/',
    relayUid:identities.localRelay.uid,relayGid:identities.localRelay.gid,toolUid:identities.browser.uid,
    startConfinedLocalRelay:input=>startConfinedLocalRelay({...input,...spawn}),authorize}),
   ...(ports.execute===undefined?{}:{execute:ports.execute})});
  owned.push(()=>browserNetwork.close());
  // 4. Observers: the per-browser leaf and the host-wide generation tree with the measured browser confinement verifier.
  const sessionProcesses=createBrowserProcessObserver({allocation,binding,profile,...(ports.cgroupPorts===undefined?{}:{ports:ports.cgroupPorts})});
  const verifier=createBrowserHostConfinementVerifier({allocation,binding,hostIdentity,browserNetwork,browserUid:identities.browser.uid,browserGid:identities.browser.gid,
   confinedUids:[identities.browser.uid,identities.hostRelay.uid,identities.localRelay.uid,identities.proxy.uid],expectedLimits:runLimits,
   ...(ports.confinementPorts===undefined?{}:{ports:ports.confinementPorts}),now});
  const processes=createHostWideProcessObserver({allocation,binding,hostIdentity,profile,verifyConfinement:verifier.verifyConfinement,
   ...(ports.hostCgroupPorts===undefined?{}:{ports:ports.hostCgroupPorts}),now});
  // 5. The service composition over Control-backed ports and the lifecycle route on its listener.
  const ownerInstanceId=randomUUID();
  const controls=createBrowserViewerRelay({ownerInstanceId,binding,expiresAtMs:Math.min(deadlineMs,allocation.leaseDeadlineMs),now});
  const retirement=createBrowserHostRetirement({allocation,binding,client,now});
  const reads=createBrowserOnlyReadRun({allocation,binding,cwd,browserClient:client,installation,browser,processes});
  const route={handler:null};
  const service=composeBrowserOnlyHostService({
   allocation,binding,hostIdentity,cwd,deadlineMs,policy,installation,upstream:ports.upstream??pinnedUpstream(paths.cliPath),
   controls,current:({binding:requested,signal})=>facts(signal,requested),siteWorkflows:reads.siteWorkflows,
   hold:({binding:requested,signal})=>client.holdBrowser({binding:requested,signal}),retirement,
   dispose:({paths:state,signal})=>disposeBrowserState(state,{signal}),
   browserClient:client,maxFreshMs,workspaceOwnership:{sdkUid:identities.sdk.uid,sdkGid:identities.sdk.gid,browserUid:identities.browser.uid,browserGid:identities.browser.gid},
   sessionProcesses,processes,browser,browserNetwork,authority,helperPath:paths.helperPath,browserUid:identities.browser.uid,browserGid:identities.browser.gid,
   readRun:reads.readRun,
   viewer:{bind:{address:c.listen.address,port:c.listen.port},tls:{serverName:c.listen.serverName,cert:tls.serverCert,key:tls.serverKey,clientCa:tls.controlCa},
    peer:{name:c.tls.peerSan,fingerprintSha256:c.tls.peerFingerprint},requestMs:Math.min(limits.deadlineMaxMs,30000)},
   lifecycle:(req,res)=>route.handler(req,res),localSettleMs:limits.localSettleMs,now,...spawn,
   ...(ports.prepareBrowserWorkspace===undefined?{}:{prepareBrowserWorkspace:ports.prepareBrowserWorkspace}),
   ...(ports.readWorkspace===undefined?{}:{readWorkspace:ports.readWorkspace}),
  },ports.dependencies??{});
  // Control's close: settle everything but the listener (the teardown closes the proxy process), then retire the
  // compartment, the proxy guard and the proxy leaf so the generation tree empties.
  const settleLocal=async reason=>{
   let receipt;
   try{receipt=await service.destroy({reason,retainListener:true});}
   catch(error){receipt=error?.receipt??Object.freeze({status:'UNKNOWN'});}
   let compartment=false;try{compartment=(await browserNetwork.close())?.closed===true;}catch{compartment=false;}
   let guarded=false;try{guarded=(await guard.close())?.closed===true;}catch{guarded=false;}
   let released=true;for(const leaf of leaves.splice(0)){const result=await releaseOwnedHierarchy({record:leaf,port:hierarchyPort}).catch(()=>({unknown:['leaf']}));if(result.unknown.length)released=false;}
   return Object.freeze({closed:receipt.status==='VERIFIED'&&compartment&&guarded&&released,
    browserEgress:receipt.browserEgress==='closed'?'closed':'unknown',browserState:receipt.browserState==='disposed'?'disposed':'unknown',receipt});
  };
  quiesce=()=>settleLocal('conversation-end');
  route.handler=createLifecycleHandler({
   authenticate:createControlPeerAuthenticator({peerSan:c.tls.peerSan,peerFingerprint:c.tls.peerFingerprint,maxPeerLifetimeMs:c.tls.maxPeerLifetimeMs,peerNotAfterMs:c.tls.peerNotAfterMs,now}),
   readBody:readBoundedBody,lifecycle,config:physical,now,maxRequestMs:Math.min(limits.deadlineMaxMs,30000),
   bodyBytes:NATIVE_LIFECYCLE_BODY_BYTES,peerNotAfterMs:Math.min(c.tls.peerNotAfterMs,c.tls.cleanupCeilingMs)});
  const started=await service.start();
  // From here the composition owns its resources; the host handle settles them on an operator stop.
  owned.length=0;
  let closing=null;
  const close=()=>closing??=(async()=>{
   const local=await settleLocal('revoked');
   const listener=await service.closeListener().catch(()=>Object.freeze({closed:false}));
   const disposed=await lifecycle.dispose();
   const released=[];for(const record of [runParent,hierarchy])released.push(await releaseOwnedHierarchy({record,port:hierarchyPort}));
   client.close?.();
   return Object.freeze({closed:local.closed&&listener.closed===true&&disposed.closed===true&&released.every(r=>r.unknown.length===0),receipt:local.receipt});
  })();
  return Object.freeze({started:true,address:started.address,ownerInstanceId:started.ownerInstanceId,policySha256,deadlineMs,service,lifecycle,close});
 }catch(error){
  await unwind();client.close?.();
  throw error;
 }
}

/** Executable entry on the host: one start, bounded operator stop, no private byte on stdout. */
export async function main({onStarted}={}){
 let host;
 try{host=await startBrowserHost();}
 catch(error){globalThis.process.stderr.write(`${typeof error?.code==='string'?error.code:'BROWSER_HOST_START_FAILED'}\n`);globalThis.process.exitCode=3;return null;}
 let stopping=false;
 const stop=async()=>{
  if(stopping)return;stopping=true;
  let result=null;try{result=await host.close();}catch{}
  globalThis.process.exit(result?.closed===true?0:1);   // an unknown local settlement is a nonzero exit
 };
 globalThis.process.once('SIGTERM',stop);globalThis.process.once('SIGINT',stop);
 globalThis.process.stdout.write(`${JSON.stringify({event:'browser-host.started',address:host.address})}\n`);
 onStarted?.(host);
 return host;
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){main().catch(()=>{process.exitCode=3;});}
