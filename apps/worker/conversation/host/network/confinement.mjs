/** Privileged D005 network setup for one exact run. Never call this from a tool process. This module changes only
 * the per-run Linux netns, veth and nft tables it creates; no VPC, IAM or cloud resource is touched. */
import {spawn} from 'node:child_process';
import {openSync,closeSync,fstatSync,statfsSync,constants as fsConstants,existsSync} from 'node:fs';
import {createNetworkPlan} from './plan.mjs';
import {buildNetworkFirewalls,assertNetworkFirewallReadback,buildFirewallReplaceTransaction} from './firewall.mjs';
import {startPinnedRelay} from './relay.mjs';

const IP='/usr/sbin/ip',NFT='/usr/sbin/nft',SYSCTL='/usr/sbin/sysctl',SS='/usr/sbin/ss',NSFS_MAGIC=0x6e736673;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const parse=(s)=>{try{return JSON.parse(s);}catch{fail('HOST_NETWORK_READBACK_UNKNOWN');}};
const array=s=>{const value=parse(s);if(!Array.isArray(value))fail('HOST_NETWORK_READBACK_UNKNOWN');return value;};
const bounded=async(promise,ms)=>{
 let timer;try{return await Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),ms);})]);}
 finally{clearTimeout(timer);}
};

/** Minimal environment, exact binary paths, no shell, bounded output and deadline. The deployment image must pin
 * iproute2, nftables and procps. A timeout makes setup/cleanup UNKNOWN until independent readback. */
export function runLinuxNetworkCommand({file,args,input='',timeoutMs=5000}){
 if(![IP,NFT,SYSCTL].includes(file)||!Array.isArray(args)||args.some(a=>typeof a!=='string'||a.includes('\0'))||typeof input!=='string'||input.length>65536||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)fail('HOST_NETWORK_COMMAND');
 return new Promise((resolve,reject)=>{
  const child=spawn(file,args,{cwd:'/',env:{PATH:'/usr/sbin:/usr/bin:/sbin:/bin',LANG:'C',LC_ALL:'C'},stdio:['pipe','pipe','pipe'],shell:false});
  let stdout='',stderr='',done=false;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(result);};
  const timer=setTimeout(()=>{child.kill('SIGKILL');finish(Object.assign(new Error('HOST_NETWORK_COMMAND_TIMEOUT'),{code:'HOST_NETWORK_COMMAND_TIMEOUT'}));},timeoutMs);
  child.on('error',()=>finish(Object.assign(new Error('HOST_NETWORK_COMMAND_FAILED'),{code:'HOST_NETWORK_COMMAND_FAILED'})));
  child.stdin.on('error',()=>{}); // A failed child may close stdin before the bounded input is written.
  const collect=(chunk,which)=>{if(which==='out')stdout+=chunk;else stderr+=chunk;if(stdout.length+stderr.length>65536){child.kill('SIGKILL');finish(Object.assign(new Error('HOST_NETWORK_COMMAND_OUTPUT'),{code:'HOST_NETWORK_COMMAND_OUTPUT'}));}};
  child.stdout.on('data',c=>collect(c,'out'));child.stderr.on('data',c=>collect(c,'err'));
  child.on('close',code=>code===0?finish(null,Object.freeze({stdout,stderr})):finish(Object.assign(new Error('HOST_NETWORK_COMMAND_FAILED'),{code:'HOST_NETWORK_COMMAND_FAILED',exitCode:code})));
  child.stdin.end(input);
 });
}

function namespaceIdentity(path){
 let fd;try{fd=openSync(path,fsConstants.O_RDONLY|fsConstants.O_NOFOLLOW);
  const stat=fstatSync(fd),fs=statfsSync(`/proc/self/fd/${fd}`);
  if(fs.type!==NSFS_MAGIC||!stat.isFile()||stat.nlink!==1)fail('HOST_NETWORK_NAMESPACE_UNKNOWN');
  return Object.freeze({namespacePath:path,namespaceDev:String(stat.dev),namespaceIno:String(stat.ino)});
 }catch{fail('HOST_NETWORK_NAMESPACE_UNKNOWN');}
 finally{if(fd!==undefined)closeSync(fd);}
}

/** Strict route/address readback. nft drops all IPv6 and UDP; the tool namespace must additionally contain no
 * default route, no extra interface, one /30 veth address and no IPv6 route. */
export function assertNetworkTopologyReadback({plan,namespaceLinks,namespaceAddresses,namespaceRoutes,namespaceV6Routes,hostLinks,hostAddresses,hostRoutes,hostAllAddresses,hostAllRoutes}){
 const links=array(namespaceLinks),addresses=array(namespaceAddresses),routes=array(namespaceRoutes),v6=array(namespaceV6Routes),hlinks=array(hostLinks),haddr=array(hostAddresses),hroutes=array(hostRoutes),allAddresses=array(hostAllAddresses),allRoutes=array(hostAllRoutes);
 const hostAddressOwners=allAddresses.filter(x=>x.addr_info?.some(a=>a.family==='inet'&&a.local===plan.hostAddress));
 const subnetRoutes=allRoutes.filter(x=>x.dst===plan.subnet);
 if(links.length!==2||!links.some(x=>x.ifname==='lo')||!links.some(x=>x.ifname===plan.toolVethName&&x.linkinfo?.info_kind==='veth'&&x.flags?.includes('UP'))||
  addresses.length!==1||addresses[0].ifname!==plan.toolVethName||addresses[0].addr_info?.filter(x=>x.family==='inet').length!==1||
  addresses[0].addr_info.find(x=>x.family==='inet').local!==plan.toolAddress||addresses[0].addr_info.find(x=>x.family==='inet').prefixlen!==30||
  addresses[0].addr_info.some(x=>x.family==='inet6')||
  routes.length!==1||routes[0].dst!==plan.subnet||routes[0].dev!==plan.toolVethName||v6.length!==0||
  hlinks.length!==1||hlinks[0].ifname!==plan.hostVethName||hlinks[0].linkinfo?.info_kind!=='veth'||!hlinks[0].flags?.includes('UP')||
  haddr.length!==1||haddr[0].ifname!==plan.hostVethName||haddr[0].addr_info?.filter(x=>x.family==='inet').length!==1||
  haddr[0].addr_info.find(x=>x.family==='inet').local!==plan.hostAddress||haddr[0].addr_info.find(x=>x.family==='inet').prefixlen!==30||
  !hroutes.some(x=>x.dst===plan.subnet&&x.dev===plan.hostVethName)||
  hostAddressOwners.length!==1||hostAddressOwners[0].ifname!==plan.hostVethName||
  subnetRoutes.length!==1||subnetRoutes[0].dev!==plan.hostVethName)fail('HOST_NETWORK_TOPOLOGY_UNKNOWN');
 return Object.freeze({verified:true,namespace:plan.namespaceName,hostVeth:plan.hostVethName,toolVeth:plan.toolVethName});
}

/** `ss` is run by the trusted supervisor inside the pinned netns. The listener must be the native-launched local
 * relay process, not a stale or tool-owned socket that happens to occupy the configured port. */
export function assertLocalRelayListenerReadback(output,localRelays,pid){
 if(typeof output!=='string'||!Array.isArray(localRelays)||!Number.isSafeInteger(pid)||pid<2)fail('HOST_NETWORK_LOCAL_RELAY_UNKNOWN');
 const lines=output.trim().split('\n').filter(Boolean);
 for(const route of localRelays){
  const matches=lines.filter(line=>{
   const columns=line.trim().split(/\s+/u);
   return columns[0]==='LISTEN'&&columns[3]===`127.0.0.1:${route.localPort}`&&new RegExp(`(?:^|[,\\(])pid=${pid}(?:,|\\))`,'u').test(line);
  });
  if(matches.length!==1)fail('HOST_NETWORK_LOCAL_RELAY_UNKNOWN');
 }
 return Object.freeze({verified:true,pid,ports:Object.freeze(localRelays.map(r=>r.localPort))});
}

/** `startLocalRelayProcess` is the trusted native launcher's persistent, unprivileged helper port. It must join the
 * pinned namespace through the C pre-exec broker, hide credentials/cgroupfs and return an observed live-process
 * handle. A ready message alone is not verification; its `verify()` must read the actual loopback listeners there.
 * @param {{allocation:unknown,binding:unknown,kind:'browser'|'bash'|'sdk',routes:unknown,execute?:typeof runLinuxNetworkCommand,startRelay?:typeof startPinnedRelay,startLocalRelayProcess?:(input:object)=>Promise<unknown>,readNamespaceIdentity?:typeof namespaceIdentity,namespaceExists?:typeof existsSync}} input */
export async function prepareNetworkCompartment({allocation,binding,kind,routes,execute=runLinuxNetworkCommand,startRelay=startPinnedRelay,startLocalRelayProcess,readNamespaceIdentity=namespaceIdentity,namespaceExists=existsSync,cleanupTimeoutMs=3000}){
 const plan=createNetworkPlan({allocation,binding,kind,routes});
 if(typeof execute!=='function'||typeof startRelay!=='function'||typeof startLocalRelayProcess!=='function'||typeof readNamespaceIdentity!=='function'||typeof namespaceExists!=='function'||!Number.isSafeInteger(cleanupTimeoutMs)||cleanupTimeoutMs<1||cleanupTimeoutMs>5000)fail('HOST_NETWORK_LOCAL_RELAY_REQUIRED');
 const run=(file,args,input)=>execute({file,args,...(input===undefined?{}:{input}),timeoutMs:5000});
 const ip=(...args)=>run(IP,args),nft=(...args)=>run(NFT,args);
 let nsCreated=false,vethCreated=false,hostTableCreated=false,toolTableCreated=false,closed=false,closing,lateCleanupUnknown=false,firewalls,identity,localRelay,activePlan=plan,extending=false,extensionInFlight,latestProof;
 const relays=[];
 const cleanup=async(initialErrors=[])=>{
  const errors=[...initialErrors];if(lateCleanupUnknown)errors.push('late-relay');
  // Cut every host-side route immediately; a stuck local child must not hold network reachability open.
  for(const relay of relays)try{if(relay.revoke()?.revoked!==true)errors.push('relay-revoke');}catch{errors.push('relay-revoke');}
  if(localRelay)try{const result=await bounded(localRelay.close(),cleanupTimeoutMs);if(result?.closed!==true)errors.push('local-relay');}catch{errors.push('local-relay');}
  for(const relay of relays)try{await bounded(relay.close(),cleanupTimeoutMs);}catch{errors.push('relay');}
  // Remove the link before the host firewall: even an orphaned namespace then has no host/public path.
  if(vethCreated)try{await ip('link','delete',plan.hostVethName);}catch{errors.push('veth');}
  if(nsCreated)try{await ip('netns','delete',plan.namespaceName);}catch{errors.push('namespace');}
  if(hostTableCreated)try{await nft('delete','table','inet',plan.hostTable);}catch{errors.push('host-firewall');}
  // A successful namespace deletion destroys its nft table. A failed deletion is uncertain even if its table is gone.
  if(!errors.length){try{
   const hostLinks=array((await ip('-j','link','show')).stdout);
   const tables=parse((await nft('-j','list','tables','inet')).stdout).nftables;
   if(!Array.isArray(tables)||namespaceExists(plan.namespacePath)||hostLinks.some(x=>x.ifname===plan.hostVethName)||tables.some(x=>x.table?.name===plan.hostTable))errors.push('readback');
  }catch{errors.push('readback');}}
  if(errors.length)fail('HOST_NETWORK_CLEANUP_UNKNOWN');return Object.freeze({closed:true});
 };
 const close=(waitForExtension=true)=>{if(closing)return closing;closed=true;
  // Revoke synchronously, before waiting on an in-flight extension or a possibly stuck child.
  const errors=[];for(const relay of relays)try{if(relay.revoke()?.revoked!==true)errors.push('relay-revoke');}catch{errors.push('relay-revoke');}
  closing=(async()=>{
   if(waitForExtension&&extensionInFlight)try{await bounded(extensionInFlight.catch(()=>{}),cleanupTimeoutMs);}catch{errors.push('extension');}
   return cleanup(errors);
  })();return closing;};
 try{
  await ip('netns','add',plan.namespaceName);nsCreated=true;
  identity=readNamespaceIdentity(plan.namespacePath);
  await ip('link','add',plan.hostVethName,'type','veth','peer','name',plan.toolVethName);vethCreated=true;
  await ip('link','set',plan.toolVethName,'netns',plan.namespaceName);
  await ip('address','add',`${plan.hostAddress}/30`,'dev',plan.hostVethName);
  await ip('-n',plan.namespaceName,'address','add',`${plan.toolAddress}/30`,'dev',plan.toolVethName);
  await ip('link','set',plan.hostVethName,'up');
  await ip('-n',plan.namespaceName,'link','set',plan.toolVethName,'up');
  await ip('-n',plan.namespaceName,'link','set','lo','up');
  await ip('netns','exec',plan.namespaceName,SYSCTL,'-q','-w','net.ipv6.conf.all.disable_ipv6=1');
  for(const route of plan.routes){
   const relay=await startRelay({listenAddress:plan.hostAddress,listenPort:0,targetAddress:route.targetAddress,targetPort:route.targetPort});
   if(typeof relay?.close!=='function'||typeof relay?.revoke!=='function')fail('HOST_NETWORK_CLEANUP_UNKNOWN');
   relays.push(relay);
   if(typeof relay.verify!=='function'||relay.address!==plan.hostAddress||!Number.isSafeInteger(relay.port)||relay.port<1024||relay.port>65535)fail('HOST_NETWORK_RELAY_BINDING_UNKNOWN');
  }
  firewalls=buildNetworkFirewalls(plan,relays.map(r=>r.port));
  await run(NFT,['-j','-f','-'],JSON.stringify(firewalls.host));hostTableCreated=true;
  await run(IP,['netns','exec',plan.namespaceName,NFT,'-j','-f','-'],JSON.stringify(firewalls.tool));toolTableCreated=true;
  const verifyNative=async()=>{
   if(closed||!identity||!firewalls||!toolTableCreated)fail('HOST_NETWORK_UNVERIFIED');
   const observed=readNamespaceIdentity(plan.namespacePath);
   if(observed.namespaceDev!==identity.namespaceDev||observed.namespaceIno!==identity.namespaceIno)fail('HOST_NETWORK_NAMESPACE_UNKNOWN');
   for(const relay of relays)relay.verify();
   const [nsLinks,nsAddr,nsRoutes,nsV6,hostLinks,hostAddr,hostRoutes,hostAllAddresses,hostAllRoutes,hostNft,toolNft]=await Promise.all([
    ip('-d','-j','-n',plan.namespaceName,'link','show'),
    ip('-j','-n',plan.namespaceName,'address','show','dev',plan.toolVethName),
    ip('-j','-n',plan.namespaceName,'route','show','table','main'),
    ip('-j','-n',plan.namespaceName,'-6','route','show','table','main'),
    ip('-d','-j','link','show','dev',plan.hostVethName),
    ip('-j','address','show','dev',plan.hostVethName),
    ip('-j','route','show','dev',plan.hostVethName),
    ip('-j','address','show'),
    ip('-j','route','show','table','main'),
    nft('-j','list','table','inet',plan.hostTable),
    ip('netns','exec',plan.namespaceName,NFT,'-j','list','table','inet',plan.toolTable),
   ]);
   if(closed)fail('HOST_NETWORK_UNVERIFIED');
   assertNetworkTopologyReadback({plan,namespaceLinks:nsLinks.stdout,namespaceAddresses:nsAddr.stdout,namespaceRoutes:nsRoutes.stdout,namespaceV6Routes:nsV6.stdout,
    hostLinks:hostLinks.stdout,hostAddresses:hostAddr.stdout,hostRoutes:hostRoutes.stdout,hostAllAddresses:hostAllAddresses.stdout,hostAllRoutes:hostAllRoutes.stdout});
   assertNetworkFirewallReadback(hostNft.stdout,firewalls.expectedHost);
   assertNetworkFirewallReadback(toolNft.stdout,firewalls.expectedTool);
   return Object.freeze({...identity,kind:plan.kind,allocationSha256:plan.allocationSha256,bindingSha256:plan.bindingSha256,
    localRelays:Object.freeze(activePlan.routes.map((route,i)=>Object.freeze({name:route.name,localPort:route.localPort,hostAddress:plan.hostAddress,hostRelayPort:relays[i].port}))),verified:true});
  };
  const nativeProof=await verifyNative();
  localRelay=await startLocalRelayProcess({plan,proof:nativeProof});
  if(!Number.isSafeInteger(localRelay?.pid)||localRelay.pid<2||typeof localRelay?.close!=='function')fail('HOST_NETWORK_LOCAL_RELAY_UNKNOWN');
  const verifyListeners=async proof=>{
   const output=await ip('netns','exec',plan.namespaceName,SS,'-H','-ltnp');
   return assertLocalRelayListenerReadback(output.stdout,proof.localRelays,localRelay.pid);
  };
  const awaitListeners=async proof=>{const startDeadline=Date.now()+3000;let ready=false;
   while(Date.now()<startDeadline){try{await verifyListeners(proof);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,30));}}
   if(!ready)fail('HOST_NETWORK_LOCAL_RELAY_UNKNOWN');};
  await awaitListeners(nativeProof);
  const verify=async()=>{
   const proof=await verifyNative();await verifyListeners(proof);
   return proof;
  };
  latestProof=await verify();
  /** Extend only an idle SDK namespace after the confined no-model readiness child is positively absent. The
   * persistent 2-route relay exits before any firewall widening. Each nft batch atomically replaces rules within
   * existing run-owned chains; failed readback destroys the entire compartment. */
  const extendBashRoutes=({bashRoutes,readSdkQuiescent,now=Date.now}={})=>{
   if(plan.kind!=='sdk'||activePlan.routes.length!==2||extending||closed||typeof readSdkQuiescent!=='function'||typeof now!=='function')fail('HOST_NETWORK_EXTENSION_REFUSED');
   extending=true;
   const operation=(async()=>{try{
    const before=await verify();
    if(closed)fail('HOST_NETWORK_EXTENSION_REFUSED');
    const q=await bounded(readSdkQuiescent({allocation,binding,networkProof:before}),5000),at=now();
    if(closed)fail('HOST_NETWORK_EXTENSION_REFUSED');
    if(q?.schema!=='meri-d005-sdk-quiescent/1'||q.sdkChildEmpty!==true||q.allocationSha256!==plan.allocationSha256||q.bindingSha256!==plan.bindingSha256||
     q.namespaceDev!==before.namespaceDev||q.namespaceIno!==before.namespaceIno||!Number.isSafeInteger(at)||!Number.isSafeInteger(q.observedAtMs)||q.observedAtMs>at||q.observedAtMs<at-5000)fail('HOST_NETWORK_EXTENSION_REFUSED');
    const next=createNetworkPlan({allocation,binding,kind:'sdk',routes:[...activePlan.routes,...(Array.isArray(bashRoutes)?bashRoutes:[])]});
    if(next.namespaceName!==plan.namespaceName||next.hostVethName!==plan.hostVethName||next.toolVethName!==plan.toolVethName||next.hostAddress!==plan.hostAddress)fail('HOST_NETWORK_EXTENSION_REFUSED');
    const old=localRelay;
    const stopped=await bounded(old.close(),cleanupTimeoutMs);if(stopped?.closed!==true)fail('HOST_NETWORK_LOCAL_RELAY_UNKNOWN');
    if(closed)fail('HOST_NETWORK_EXTENSION_REFUSED');
    localRelay=undefined;
    for(const route of next.routes.slice(2)){
     if(closed)fail('HOST_NETWORK_EXTENSION_REFUSED');
     const relay=await startRelay({listenAddress:plan.hostAddress,listenPort:0,targetAddress:route.targetAddress,targetPort:route.targetPort});
     if(closed){try{if(relay?.revoke?.()?.revoked!==true)lateCleanupUnknown=true;
      if((await bounded(relay?.close?.(),cleanupTimeoutMs))?.closed!==true)lateCleanupUnknown=true;}catch{lateCleanupUnknown=true;}
      fail('HOST_NETWORK_EXTENSION_REFUSED');}
     if(typeof relay?.close!=='function'||typeof relay?.revoke!=='function')fail('HOST_NETWORK_CLEANUP_UNKNOWN');
     relays.push(relay);
     if(typeof relay.verify!=='function'||relay.address!==plan.hostAddress||!Number.isSafeInteger(relay.port)||relay.port<1024||relay.port>65535)fail('HOST_NETWORK_RELAY_BINDING_UNKNOWN');
    }
    const nextRules=buildNetworkFirewalls(next,relays.map(r=>r.port));
    await run(NFT,['-j','-f','-'],JSON.stringify(buildFirewallReplaceTransaction(nextRules.expectedHost)));
    if(closed)fail('HOST_NETWORK_EXTENSION_REFUSED');
    await run(IP,['netns','exec',plan.namespaceName,NFT,'-j','-f','-'],JSON.stringify(buildFirewallReplaceTransaction(nextRules.expectedTool)));
    if(closed)fail('HOST_NETWORK_EXTENSION_REFUSED');
    activePlan=next;firewalls=nextRules;
    const native=await verifyNative();
    if(closed)fail('HOST_NETWORK_EXTENSION_REFUSED');
    const nextLocalRelay=await startLocalRelayProcess({plan:next,proof:native});
    if(closed){try{if((await bounded(nextLocalRelay?.close?.(),cleanupTimeoutMs))?.closed!==true)lateCleanupUnknown=true;}catch{lateCleanupUnknown=true;}
     fail('HOST_NETWORK_EXTENSION_REFUSED');}
    localRelay=nextLocalRelay;
    if(!Number.isSafeInteger(localRelay?.pid)||localRelay.pid<2||typeof localRelay?.close!=='function')fail('HOST_NETWORK_LOCAL_RELAY_UNKNOWN');
    await awaitListeners(native);latestProof=await verify();return latestProof;
   }catch(error){if(!closed)try{await close(false);}catch{fail('HOST_NETWORK_CLEANUP_UNKNOWN');}throw error;}
   finally{extending=false;}})();
   extensionInFlight=operation;return operation;
  };
  return Object.freeze({get plan(){return activePlan;},get proof(){return latestProof;},verify,extendBashRoutes,close});
 }catch(error){try{await close();}catch{fail('HOST_NETWORK_CLEANUP_UNKNOWN');}throw error;}
}
