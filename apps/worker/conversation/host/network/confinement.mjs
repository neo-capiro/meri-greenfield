/** Privileged D005 network setup for one exact run. Never call this from a tool process. This module changes only
 * the per-run Linux netns, veth and nft tables it creates; no VPC, IAM or cloud resource is touched. */
import {spawn} from 'node:child_process';
import {openSync,closeSync,fstatSync,statfsSync,readFileSync,constants as fsConstants,existsSync} from 'node:fs';
import {createNetworkPlan} from './plan.mjs';
import {buildNetworkFirewalls,buildHostRelayDenyFirewall,assertNetworkFirewallReadback,buildFirewallReplaceTransaction} from './firewall.mjs';

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
 if(![IP,NFT,SYSCTL,SS].includes(file)||!Array.isArray(args)||args.some(a=>typeof a!=='string'||a.includes('\0'))||typeof input!=='string'||input.length>65536||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)fail('HOST_NETWORK_COMMAND');
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
function procNamespaceIdentity(pid){
 let fd;try{fd=openSync(`/proc/${pid}/ns/net`,fsConstants.O_RDONLY|fsConstants.O_CLOEXEC);
  const stat=fstatSync(fd),fs=statfsSync(`/proc/self/fd/${fd}`);
  if(fs.type!==NSFS_MAGIC)fail('HOST_NETWORK_NAMESPACE_UNKNOWN');
  return Object.freeze({namespaceDev:String(stat.dev),namespaceIno:String(stat.ino)});
 }catch{fail('HOST_NETWORK_NAMESPACE_UNKNOWN');}
 finally{if(fd!==undefined)closeSync(fd);}
}
/** The separate native helper refuses execution unless its original host netns matches this identity and its
 * current netns. The trusted supervisor must itself be in the same namespace as PID 1. */
export function readOriginalHostNamespaceIdentity(){
 const init=procNamespaceIdentity(1),self=procNamespaceIdentity('self');
 if(init.namespaceDev!==self.namespaceDev||init.namespaceIno!==self.namespaceIno)fail('HOST_NETWORK_NAMESPACE_UNKNOWN');
 return init;
}
/** Production procfs readback of the exact unprivileged host-relay leader. A stable start time protects the PID
 * observation from reuse; cgroup events and native child ownership separately prove all descendants have exited. */
export function readHostRelayProcessIdentity(pid){
 if(!Number.isSafeInteger(pid)||pid<2)fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
 try{
  const raw=readFileSync(`/proc/${pid}/stat`,'utf8'),tail=raw.slice(raw.lastIndexOf(') ')+2).trim().split(/\s+/u);
  const status=readFileSync(`/proc/${pid}/status`,'utf8'),cgroup=readFileSync(`/proc/${pid}/cgroup`,'utf8');
  const ids=key=>{const line=status.match(new RegExp(`^${key}:\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*$`,'mu'));
   if(!line||new Set(line.slice(1)).size!==1)fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');return Number(line[1]);};
  const startTime=tail[19],ns=procNamespaceIdentity(pid);
  if(tail.length<20||tail[0]==='Z'||!/^[1-9][0-9]*$/u.test(startTime)||!/^0::\/meri\/hosts\/[0-9a-f-]+\/[0-9a-f]{64}\/host-relay-(?:sdk|browser)\n$/u.test(cgroup))
   fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
  const again=readFileSync(`/proc/${pid}/stat`,'utf8'),againTail=again.slice(again.lastIndexOf(') ')+2).trim().split(/\s+/u);
  if(againTail[19]!==startTime||againTail[0]==='Z')fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
  return Object.freeze({pid,uid:ids('Uid'),gid:ids('Gid'),cgroupPath:cgroup.slice(3).trim(),startTime,...ns});
 }catch{fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');}
}

/** `ss -H -ltnp` must show each pinned host-veth listener once, owned only by the native-launched leader, and
 * no additional listener owned by that leader. Missing PID data or a co-owner is UNKNOWN. */
export function assertHostRelayListenerReadback(output,plan,hostRelay){
 if(typeof output!=='string'||!plan||!Array.isArray(hostRelay?.routes)||!Number.isSafeInteger(hostRelay.pid)||hostRelay.pid<2)
  fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
 const lines=output.trim().split('\n').filter(Boolean),expected=hostRelay.routes.map(r=>`${plan.hostAddress}:${r.port}`),owned=[];
 for(const line of lines){const columns=line.trim().split(/\s+/u),pids=[...line.matchAll(/pid=(\d+)/gu)].map(m=>Number(m[1]));
  if(columns[0]!=='LISTEN'||columns.length<5)continue;
  if(pids.includes(hostRelay.pid)||expected.includes(columns[3])){
   if(pids.length!==1||pids[0]!==hostRelay.pid||!expected.includes(columns[3]))fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
   owned.push(columns[3]);
  }
 }
 if(owned.length!==expected.length||new Set(owned).size!==owned.length||expected.some(address=>!owned.includes(address)))
  fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
 return Object.freeze({verified:true,pid:hostRelay.pid,listeners:Object.freeze(owned)});
}

/** The SDK host relay may dial its two pinned private services only through the reviewed private ENI. nft OUTPUT
 * separately enforces the same oifname and exact target pair. This readback refuses policy-route drift. */
export function assertPrivateTargetRouteReadback(output,{address,interfaceName}){
 const routes=array(output);
 if(routes.length!==1||routes[0].dst!==address||routes[0].dev!==interfaceName||routes[0].type!==undefined&&routes[0].type!=='unicast')
  fail('HOST_NETWORK_PRIVATE_ROUTE_UNKNOWN');
 return Object.freeze({verified:true,address,interfaceName});
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
 * @param {{allocation:unknown,binding:unknown,kind:'browser'|'sdk',routes:unknown,execute?:typeof runLinuxNetworkCommand,startHostRelayProcess:(input:object)=>Promise<unknown>,hostRelayUid:number,hostRelayGid:number,privateInterfaceName?:string,startLocalRelayProcess:(input:object)=>Promise<unknown>,readNamespaceIdentity?:typeof namespaceIdentity,readHostNamespaceIdentity?:typeof readOriginalHostNamespaceIdentity,readHostRelayIdentity?:typeof readHostRelayProcessIdentity,namespaceExists?:typeof existsSync}} input */
export async function prepareNetworkCompartment({allocation,binding,kind,routes,execute=runLinuxNetworkCommand,startHostRelayProcess,
 hostRelayUid,hostRelayGid,privateInterfaceName,startLocalRelayProcess,readNamespaceIdentity=namespaceIdentity,
 readHostNamespaceIdentity=readOriginalHostNamespaceIdentity,readHostRelayIdentity=readHostRelayProcessIdentity,
 namespaceExists=existsSync,cleanupTimeoutMs=3000}){
 const plan=createNetworkPlan({allocation,binding,kind,routes});
 if(!['sdk','browser'].includes(kind)||typeof execute!=='function'||typeof startHostRelayProcess!=='function'||
  typeof startLocalRelayProcess!=='function'||typeof readNamespaceIdentity!=='function'||typeof readHostNamespaceIdentity!=='function'||
  typeof readHostRelayIdentity!=='function'||typeof namespaceExists!=='function'||!Number.isSafeInteger(hostRelayUid)||hostRelayUid<1000||hostRelayUid>65533||
  !Number.isSafeInteger(hostRelayGid)||hostRelayGid<1000||hostRelayGid>65533||!Number.isSafeInteger(cleanupTimeoutMs)||cleanupTimeoutMs<1||cleanupTimeoutMs>5000)
  fail('HOST_NETWORK_HOST_RELAY_REQUIRED');
 const run=(file,args,input)=>execute({file,args,...(input===undefined?{}:{input}),timeoutMs:5000});
 const ip=(...args)=>run(IP,args),nft=(...args)=>run(NFT,args);
 let nsCreated=false,vethCreated=false,hostTableCreated=false,toolTableCreated=false,closed=false,closing,lateCleanupUnknown=false,
  firewalls,identity,hostNamespace,hostRelay,hostRelayStartTime,localRelay,activePlan=plan,extending=false,extensionInFlight,latestProof;
 const hostDeny=buildHostRelayDenyFirewall(plan,hostRelayUid);
 const relayPorts=()=>hostRelay?.routes?.map(r=>r.port);
 const verifyHostRelay=async()=>{
  if(hostRelay?.verify()?.verified!==true||hostRelay.pid<2||hostRelay.uid!==hostRelayUid||hostRelay.gid!==hostRelayGid||
   hostRelay.cgroupPath!==plan.hostRelayCgroupPath||hostRelay.routes?.length!==activePlan.routes.length||
   hostRelay.routes.some((route,i)=>route.name!==activePlan.routes[i].name||!Number.isSafeInteger(route.port)||route.port<1024||route.port>65535)||
   new Set(relayPorts()).size!==relayPorts().length)fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
  const process=readHostRelayIdentity(hostRelay.pid);
  if(process.pid!==hostRelay.pid||process.uid!==hostRelayUid||process.gid!==hostRelayGid||
   process.cgroupPath!==plan.hostRelayCgroupPath||process.namespaceDev!==hostNamespace.namespaceDev||
   process.namespaceIno!==hostNamespace.namespaceIno||!process.startTime||
   hostRelayStartTime!==undefined&&process.startTime!==hostRelayStartTime)fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
  assertHostRelayListenerReadback((await run(SS,['-H','-ltnp'])).stdout,plan,hostRelay);
  const after=readHostRelayIdentity(hostRelay.pid);
  if(after.pid!==process.pid||after.startTime!==process.startTime||after.uid!==process.uid||after.gid!==process.gid||
   after.cgroupPath!==process.cgroupPath||after.namespaceDev!==process.namespaceDev||after.namespaceIno!==process.namespaceIno||
   hostRelay.verify()?.verified!==true)fail('HOST_NETWORK_HOST_RELAY_UNKNOWN');
  return process;
 };
 const cleanup=async(initialErrors=[])=>{
  const errors=[...initialErrors];if(lateCleanupUnknown)errors.push('late-relay');
  if(hostTableCreated)try{await run(NFT,['-j','-f','-'],JSON.stringify(buildFirewallReplaceTransaction(hostDeny.expectedHost)));}
   catch{errors.push('host-output-deny');}
  if(localRelay)try{const result=await bounded(localRelay.close(),cleanupTimeoutMs);if(result?.closed!==true)errors.push('local-relay');}catch{errors.push('local-relay');}
  if(hostRelay)try{const result=await bounded(hostRelay.close(),cleanupTimeoutMs);if(result?.closed!==true)errors.push('host-relay');}catch{errors.push('host-relay');}
  // Remove the link before the host firewall: even an orphaned namespace then has no host/public path.
  if(vethCreated)try{await ip('link','delete',plan.hostVethName);}catch{errors.push('veth');}
  if(nsCreated)try{await ip('netns','delete',plan.namespaceName);}catch{errors.push('namespace');}
  // Keep the UID-wide host OUTPUT deny if any relay/process/link cleanup is uncertain. Removing the table first
  // could give an orphaned host-relay process direct ENI egress even after this method returns UNKNOWN.
  if(!errors.length){try{
   const hostLinks=array((await ip('-j','link','show')).stdout);
   if(namespaceExists(plan.namespacePath)||hostLinks.some(x=>x.ifname===plan.hostVethName))errors.push('readback');
  }catch{errors.push('readback');}}
  if(!errors.length&&hostTableCreated)try{await nft('delete','table','inet',plan.hostTable);}catch{errors.push('host-firewall');}
  if(!errors.length)try{
   const tables=parse((await nft('-j','list','tables','inet')).stdout).nftables;
   if(!Array.isArray(tables)||tables.some(x=>x.table?.name===plan.hostTable))errors.push('readback');
  }catch{errors.push('readback');}
  if(errors.length)fail('HOST_NETWORK_CLEANUP_UNKNOWN');return Object.freeze({closed:true});
 };
 const close=(waitForExtension=true)=>{if(closing)return closing;closed=true;
  // Revoke synchronously, before waiting on an in-flight extension or a possibly stuck child.
  const errors=[];if(hostRelay)try{if(hostRelay.revoke()?.revoked!==true)errors.push('host-relay-revoke');}catch{errors.push('host-relay-revoke');}
  closing=(async()=>{
   if(waitForExtension&&extensionInFlight)try{await bounded(extensionInFlight.catch(()=>{}),cleanupTimeoutMs);}catch{errors.push('extension');}
   return cleanup(errors);
  })();return closing;};
 try{
  hostNamespace=readHostNamespaceIdentity();
  if(!/^\d+$/u.test(hostNamespace?.namespaceDev)||!/^\d+$/u.test(hostNamespace?.namespaceIno))fail('HOST_NETWORK_NAMESPACE_UNKNOWN');
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
  // No unprivileged process exists until the host INPUT and UID-wide OUTPUT deny table is installed and read back.
  await run(NFT,['-j','-f','-'],JSON.stringify(hostDeny.host));hostTableCreated=true;
  assertNetworkFirewallReadback((await nft('-j','list','table','inet',plan.hostTable)).stdout,hostDeny.expectedHost);
  hostRelay=await startHostRelayProcess({plan,hostNamespace});
  if(typeof hostRelay?.verify!=='function'||typeof hostRelay?.revoke!=='function'||typeof hostRelay?.close!=='function')
   fail('HOST_NETWORK_CLEANUP_UNKNOWN');
  hostRelayStartTime=(await verifyHostRelay()).startTime;
  firewalls=buildNetworkFirewalls(plan,relayPorts(),{relayUid:hostRelayUid,privateInterfaceName});
  await run(NFT,['-j','-f','-'],JSON.stringify(buildFirewallReplaceTransaction(firewalls.expectedHost)));
  await run(IP,['netns','exec',plan.namespaceName,NFT,'-j','-f','-'],JSON.stringify(firewalls.tool));toolTableCreated=true;
  const verifyNative=async()=>{
   if(closed||!identity||!firewalls||!toolTableCreated)fail('HOST_NETWORK_UNVERIFIED');
   const observed=readNamespaceIdentity(plan.namespacePath);
   if(observed.namespaceDev!==identity.namespaceDev||observed.namespaceIno!==identity.namespaceIno)fail('HOST_NETWORK_NAMESPACE_UNKNOWN');
   const hostRelayProcess=await verifyHostRelay();
   for(const route of activePlan.routes.filter(r=>r.targetAddress!=='127.0.0.1')){
    const output=await ip('-j','route','get',route.targetAddress,'uid',String(hostRelayUid));
    assertPrivateTargetRouteReadback(output.stdout,{address:route.targetAddress,interfaceName:privateInterfaceName});
   }
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
    hostRelay:Object.freeze({pid:hostRelayProcess.pid,uid:hostRelayProcess.uid,gid:hostRelayProcess.gid,
     cgroupPath:hostRelayProcess.cgroupPath,startTime:hostRelayProcess.startTime,namespaceDev:hostRelayProcess.namespaceDev,
     namespaceIno:hostRelayProcess.namespaceIno}),
    localRelays:Object.freeze(activePlan.routes.map((route,i)=>Object.freeze({name:route.name,localPort:route.localPort,hostAddress:plan.hostAddress,hostRelayPort:hostRelay.routes[i].port}))),verified:true});
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
    if(hostRelay?.revoke()?.revoked!==true)fail('HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN');
    const retired=await bounded(hostRelay.close(),cleanupTimeoutMs);
    if(retired?.closed!==true)fail('HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN');
    if(closed)fail('HOST_NETWORK_EXTENSION_REFUSED');
    hostRelay=undefined;hostRelayStartTime=undefined;
    // Preserve UID-wide deny during the replacement process's entire startup and listener proof.
    await run(NFT,['-j','-f','-'],JSON.stringify(buildFirewallReplaceTransaction(hostDeny.expectedHost)));
    if(closed)fail('HOST_NETWORK_EXTENSION_REFUSED');
    const replacement=await startHostRelayProcess({plan:next,hostNamespace});
    if(closed){try{if(replacement?.revoke?.()?.revoked!==true)lateCleanupUnknown=true;
     if((await bounded(replacement?.close?.(),cleanupTimeoutMs))?.closed!==true)lateCleanupUnknown=true;}catch{lateCleanupUnknown=true;}
     fail('HOST_NETWORK_EXTENSION_REFUSED');}
    hostRelay=replacement;activePlan=next;
    if(typeof hostRelay?.verify!=='function'||typeof hostRelay?.revoke!=='function'||typeof hostRelay?.close!=='function')
     fail('HOST_NETWORK_CLEANUP_UNKNOWN');
    hostRelayStartTime=(await verifyHostRelay()).startTime;
    const nextRules=buildNetworkFirewalls(next,relayPorts(),{relayUid:hostRelayUid,privateInterfaceName});
    await run(NFT,['-j','-f','-'],JSON.stringify(buildFirewallReplaceTransaction(nextRules.expectedHost)));
    if(closed)fail('HOST_NETWORK_EXTENSION_REFUSED');
    await run(IP,['netns','exec',plan.namespaceName,NFT,'-j','-f','-'],JSON.stringify(buildFirewallReplaceTransaction(nextRules.expectedTool)));
    if(closed)fail('HOST_NETWORK_EXTENSION_REFUSED');
    firewalls=nextRules;
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
