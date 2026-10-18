import test from 'node:test';
import assert from 'node:assert/strict';
import {HOST_ALLOCATION_SCHEMA} from '../binding.mjs';
import {createNetworkPlan} from './plan.mjs';
import {buildNetworkFirewalls,buildHostRelayDenyFirewall} from './firewall.mjs';
import {prepareNetworkCompartment} from './confinement.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:'tenant-a',conversationId:uuid(1),generation:1,
 hostId:uuid(2),imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:1792425600000};
const binding={tenantId:'tenant-a',actorId:'actor-a',conversationId:uuid(1),runId:uuid(3),attemptId:uuid(4),workerId:uuid(5),writerFence:1};
const browser=[{name:'browser-http',localPort:41001,targetPort:41001}];
const sdk=[{name:'model-proxy',localPort:42001,targetAddress:'10.0.1.4',targetPort:443},
 {name:'control',localPort:42002,targetAddress:'172.16.2.5',targetPort:443}];
const bash=[{name:'bash-http',localPort:41002,targetPort:41002},{name:'bash-socks',localPort:41003,targetPort:41003}];
const uid=24011,gid=24012,hostNs={namespaceDev:'5',namespaceIno:'55'};
const nftOutput=items=>JSON.stringify({nftables:[{metainfo:{version:'1.0',json_schema_version:1}},...items]});
const fault=code=>error=>error?.code===code;
function topology(p){return {
 nsLinks:JSON.stringify([{ifname:'lo',flags:['UP']},{ifname:p.toolVethName,flags:['UP'],linkinfo:{info_kind:'veth'}}]),
 nsAddresses:JSON.stringify([{ifname:p.toolVethName,addr_info:[{family:'inet',local:p.toolAddress,prefixlen:30}]}]),
 nsRoutes:JSON.stringify([{dst:p.subnet,dev:p.toolVethName,scope:'link'}]),
 hostLinks:JSON.stringify([{ifname:p.hostVethName,flags:['UP'],linkinfo:{info_kind:'veth'}}]),
 hostAddresses:JSON.stringify([{ifname:p.hostVethName,addr_info:[{family:'inet',local:p.hostAddress,prefixlen:30}]}]),
 hostRoutes:JSON.stringify([{dst:p.subnet,dev:p.hostVethName}]),
 allRoutes:JSON.stringify([{dst:p.subnet,dev:p.hostVethName},{dst:'default',dev:'eth0'}]),
 };}

function fixture(kind,{deferReplacement=false,lateCloseFails=false,stalledLocalClose=false,hostCloseFails=false,
 rejectHostStartAt=0,rejectHostStartCode='HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN'}={}){
 const routes=kind==='browser'?browser:sdk,p=createNetworkPlan({allocation,binding,kind,routes}),
  expanded=kind==='sdk'?createNetworkPlan({allocation,binding,kind,routes:[...sdk,...bash]}):undefined,
  initialPorts=kind==='browser'?[44000]:[44000,44001],expandedPorts=[44002,44003,44004,44005],
  deny=buildHostRelayDenyFirewall(p,uid),initial=buildNetworkFirewalls(p,initialPorts,{relayUid:uid,privateInterfaceName:'eth0'}),
  expandedRules=expanded&&buildNetworkFirewalls(expanded,expandedPorts,{relayUid:uid,privateInterfaceName:'eth0'}),t=topology(p);
 const events=[];let hostWrites=0,toolWrites=0,starts=0,localStarts=0,relay,lateRevokes=0,lateCloses=0,
  releaseReplacement,markReplacement;
 const replacementStarted=new Promise(resolve=>{markReplacement=resolve;});
 const makeProcess=(plan,ports,pid,late=false)=>({pid,uid,gid,cgroupPath:p.hostRelayCgroupPath,
  routes:plan.routes.map((route,i)=>({name:route.name,port:ports[i]})),verify(){return {verified:true};},
  revoke(){events.push(`revoke ${pid}`);if(late)lateRevokes++;return {revoked:true};},
  async close(){events.push(`close ${pid}`);if(late)lateCloses++;return {closed:late?!lateCloseFails:!hostCloseFails};}});
 const startHostRelayProcess=async({plan})=>{
  starts++;events.push(`host-start ${starts}`);const isLate=starts===2;
  if(starts===rejectHostStartAt)throw Object.assign(Error(rejectHostStartCode),{code:rejectHostStartCode});
  if(isLate&&deferReplacement){markReplacement();return new Promise(resolve=>{releaseReplacement=()=>{
   relay=makeProcess(plan,expandedPorts,322,true);resolve(relay);};});}
  relay=makeProcess(plan,isLate?expandedPorts:initialPorts,isLate?322:321,isLate);return relay;
 };
 const startLocalRelayProcess=async()=>{localStarts++;const pid=420+localStarts;events.push(`local-start ${pid}`);
  return {pid,close(){events.push(`local-close ${pid}`);return stalledLocalClose?new Promise(()=>{}):Promise.resolve({closed:true});}};};
 const execute=async({file,args,input})=>{
  const cmd=args.join(' ');events.push(`${file.split('/').at(-1)} ${cmd}`);
  if(file.endsWith('/ss'))return {stdout:relay?.routes.map(r=>
   `LISTEN 0 511 ${p.hostAddress}:${r.port} 0.0.0.0:* users:(("node",pid=${relay.pid},fd=18))`).join('\n')??''};
  if(cmd.includes('-j -f -')){assert.ok(JSON.parse(input).nftables.length>2);
   if(file.endsWith('/nft'))hostWrites++;else toolWrites++;return {stdout:''};}
  if(cmd.includes('list table inet')){
   if(file.endsWith('/nft'))return {stdout:nftOutput(hostWrites===1||hostWrites===3||hostWrites===5?deny.expectedHost:
    hostWrites>=4?expandedRules.expectedHost:initial.expectedHost)};
   return {stdout:nftOutput(toolWrites>=2?expandedRules.expectedTool:initial.expectedTool)};
  }
  if(cmd.includes('/usr/sbin/ss -H -ltnp')){
   const current=localStarts===1?p:expanded??p,pid=420+localStarts;
   return {stdout:current.routes.map(r=>`LISTEN 0 511 127.0.0.1:${r.localPort} 0.0.0.0:* users:(("node",pid=${pid},fd=18))`).join('\n')};
  }
  if(cmd==='-j link show')return {stdout:'[]'};
  if(cmd==='-j list tables inet')return {stdout:nftOutput([])};
  if(cmd==='-d -j -n '+p.namespaceName+' link show')return {stdout:t.nsLinks};
  if(cmd.includes('address show dev '+p.toolVethName))return {stdout:t.nsAddresses};
  if(cmd==='-j route show table main')return {stdout:t.allRoutes};
  if(cmd.includes('route get '))return {stdout:JSON.stringify([{dst:args[3],dev:'eth0'}])};
  if(cmd.includes('route show table main')&&cmd.includes('-6'))return {stdout:'[]'};
  if(cmd.includes('route show table main'))return {stdout:t.nsRoutes};
  if(cmd==='-d -j link show dev '+p.hostVethName)return {stdout:t.hostLinks};
  if(cmd.includes('address show dev '+p.hostVethName))return {stdout:t.hostAddresses};
  if(cmd.includes('route show dev '+p.hostVethName))return {stdout:t.hostRoutes};
  if(cmd==='-j address show')return {stdout:t.hostAddresses};
  return {stdout:''};
 };
 const options={allocation,binding,kind,routes,execute,startHostRelayProcess,startLocalRelayProcess,
  hostRelayUid:uid,hostRelayGid:gid,privateInterfaceName:'eth0',readHostNamespaceIdentity:()=>hostNs,
  readHostRelayIdentity:pid=>({pid,uid,gid,cgroupPath:p.hostRelayCgroupPath,startTime:String(pid),...hostNs}),
  readNamespaceIdentity:path=>({namespacePath:path,namespaceDev:'4',namespaceIno:'42'}),namespaceExists:()=>false,
  cleanupTimeoutMs:stalledLocalClose?20:100};
 return {p,expanded,events,options,replacementStarted,get releaseReplacement(){return releaseReplacement;},
  get starts(){return starts;},get localStarts(){return localStarts;},get lateRevokes(){return lateRevokes;},
  get lateCloses(){return lateCloses;}};
}

test('host OUTPUT deny and readback precede unprivileged host relay startup and tool readiness',async()=>{
 const f=fixture('browser'),network=await prepareNetworkCompartment(f.options);
 assert.equal(network.proof.hostRelay.uid,uid);assert.equal(network.proof.hostRelay.cgroupPath,f.p.hostRelayCgroupPath);
 assert.equal(network.proof.localRelays[0].hostRelayPort,44000);
 assert.ok(f.events.findIndex(x=>x==='nft -j -f -')<f.events.findIndex(x=>x==='host-start 1'));
 assert.ok(f.events.findIndex(x=>x.includes('list table inet '+f.p.hostTable))<f.events.findIndex(x=>x==='host-start 1'));
 assert.equal((await network.verify()).verified,true);
 assert.deepEqual(await network.close(),{closed:true});
 assert.ok(f.events.findIndex(x=>x.startsWith('revoke 321'))<f.events.findIndex(x=>x.startsWith('local-close')));
 assert.ok(f.events.findIndex(x=>x.includes('link delete'))<f.events.findIndex(x=>x.includes('delete table inet')));
});

test('SDK extends the same namespace only after quiescence and restarts confined host relay under deny',async()=>{
 const f=fixture('sdk'),network=await prepareNetworkCompartment(f.options);
 try{
  const now=Date.now(),receipt={schema:'meri-d005-sdk-quiescent/1',sdkChildEmpty:true,
   allocationSha256:f.p.allocationSha256,bindingSha256:f.p.bindingSha256,namespaceDev:'4',namespaceIno:'42',observedAtMs:now};
  const proof=await network.extendBashRoutes({bashRoutes:bash,readSdkQuiescent:async()=>receipt,now:()=>now});
  assert.equal(proof.hostRelay.pid,322);assert.equal(proof.localRelays.length,4);
  assert.equal(f.events.filter(x=>x.includes('netns add')).length,1);
  assert.equal(f.events.filter(x=>x==='nft -j -f -').length,4,'initial deny, full guard, extension deny, new full guard');
  assert.equal(f.events.filter(x=>x.includes('route get')).length>=4,true);
 }finally{await network.close();}
});

test('concurrent close kills a late host relay and keeps failed cleanup UNKNOWN',async()=>{
 for(const lateCloseFails of [false,true]){
  const f=fixture('sdk',{deferReplacement:true,lateCloseFails}),network=await prepareNetworkCompartment(f.options);
  const now=Date.now(),receipt={schema:'meri-d005-sdk-quiescent/1',sdkChildEmpty:true,
   allocationSha256:f.p.allocationSha256,bindingSha256:f.p.bindingSha256,namespaceDev:'4',namespaceIno:'42',observedAtMs:now};
  const extension=network.extendBashRoutes({bashRoutes:bash,readSdkQuiescent:async()=>receipt,now:()=>now});
  await f.replacementStarted;
  const cleanup=network.close();assert.ok(f.events.some(x=>x.startsWith('revoke 321')));
  f.releaseReplacement();await assert.rejects(extension,fault('HOST_NETWORK_EXTENSION_REFUSED'));
  if(lateCloseFails)await assert.rejects(cleanup,fault('HOST_NETWORK_CLEANUP_UNKNOWN'));
  else assert.deepEqual(await cleanup,{closed:true});
  assert.ok(f.lateRevokes>=1);assert.equal(f.lateCloses,1);assert.equal(f.starts,2);
 }
});

test('stuck namespace-local child cannot delay host relay revoke or link teardown receipt',async()=>{
 const f=fixture('browser',{stalledLocalClose:true}),network=await prepareNetworkCompartment(f.options);
 const cleanup=network.close();assert.ok(f.events.some(x=>x.startsWith('revoke 321')));
 await assert.rejects(cleanup,fault('HOST_NETWORK_CLEANUP_UNKNOWN'));
 assert.ok(f.events.some(x=>x.includes('link delete')));
 assert.equal(f.events.some(x=>x.includes('delete table inet')),false,'retain host UID deny on uncertain cleanup');
});

test('uncertain host relay cgroup cleanup retains UID-wide OUTPUT deny table',async()=>{
 const f=fixture('browser',{hostCloseFails:true}),network=await prepareNetworkCompartment(f.options);
 await assert.rejects(network.close(),fault('HOST_NETWORK_CLEANUP_UNKNOWN'));
 assert.ok(f.events.some(x=>x==='nft -j -f -'),'deny replacement attempted');
 assert.equal(f.events.some(x=>x.includes('delete table inet')),false,'deny table must remain installed');
});

test('rejected initial host relay startup keeps UID-wide OUTPUT deny without a returned handle',async()=>{
 for(const rejectHostStartCode of ['HOST_NETWORK_HOST_RELAY_CLEANUP_UNKNOWN','HOST_NETWORK_HOST_RELAY_UNKNOWN']){
  const f=fixture('browser',{rejectHostStartAt:1,rejectHostStartCode});
  await assert.rejects(prepareNetworkCompartment(f.options),fault('HOST_NETWORK_CLEANUP_UNKNOWN'));
  assert.ok(f.events.findIndex(x=>x==='nft -j -f -')<f.events.findIndex(x=>x==='host-start 1'));
  assert.ok(f.events.some(x=>x.includes('link delete')),'network link teardown still runs');
  assert.equal(f.events.some(x=>x.includes('delete table inet')),false,'uncertain relay absence retains host deny');
 }
});

test('rejected Bash replacement keeps UID-wide OUTPUT deny after old relay closes',async()=>{
 const f=fixture('sdk',{rejectHostStartAt:2}),network=await prepareNetworkCompartment(f.options);
 const now=Date.now(),receipt={schema:'meri-d005-sdk-quiescent/1',sdkChildEmpty:true,
  allocationSha256:f.p.allocationSha256,bindingSha256:f.p.bindingSha256,namespaceDev:'4',namespaceIno:'42',observedAtMs:now};
 await assert.rejects(network.extendBashRoutes({bashRoutes:bash,readSdkQuiescent:async()=>receipt,now:()=>now}),
  fault('HOST_NETWORK_CLEANUP_UNKNOWN'));
 assert.ok(f.events.findIndex(x=>x==='close 321')<f.events.findIndex(x=>x==='host-start 2'));
 assert.ok(f.events.some(x=>x.includes('link delete')),'network link teardown still runs');
 assert.equal(f.events.some(x=>x.includes('delete table inet')),false,'uncertain replacement absence retains host deny');
});
