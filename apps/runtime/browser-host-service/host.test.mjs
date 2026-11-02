/** The production browser host start over inert low-level ports: the hierarchy, lifecycle producer, egress, compartment,
 * cgroup/procfs readbacks and the currentness client are scripted at their seams; the composition, host-local teardown,
 * both observers, the confinement verifier, the lifecycle route handler, retirement and configuration are the real
 * owners. No socket, kernel, child process or TLS handshake runs here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {BROWSER_HOST_FACTS_SCHEMA} from '../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
import {NATIVE_LIFECYCLE_SCHEMA,NATIVE_LIFECYCLE_PATH} from '../../../packages/contracts/native-lifecycle.mjs';
import {createNetworkPlan} from '../../worker/conversation/host/network/plan.mjs';
import {hostWideCgroup} from '../../worker/conversation/host/host-wide-process-observer.mjs';
import {binding} from '../../worker/conversation/browser/test/fixtures.mjs';
import {makeInertHierarchyPort} from '../native-processing-host/test-hierarchy-port.mjs';
import {startBrowserHost} from './host.mjs';
import {allocation,hostIdentity,policy,policySha256,cwd,serviceFixture,TLS,PEER,FIXTURE_NOW_MS} from './fixture.mjs';

const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}];
const activeFacts={schema:BROWSER_HOST_FACTS_SCHEMA,binding,scopes,deadlineMs:FIXTURE_NOW_MS+60000,currentUntilMs:FIXTURE_NOW_MS+5000,phase:'active',
 admitted:{sdk:true,bash:false,browser:true},capabilityPolicy:{},capabilityPolicySha256:canonicalSha256({}),browserPolicy:policy,browserPolicySha256:policySha256};
const IDENTITIES={sdk:{uid:1001,gid:1001},browser:{uid:2002,gid:2002},hostRelay:{uid:3001,gid:3001},localRelay:{uid:3002,gid:3002},proxy:{uid:3003,gid:3003}};
const LIMITS={deadlineMaxMs:5000,maxFreshMs:1000,localSettleMs:5000,memoryBytes:2147483648,pidsMax:512,cpuQuotaUs:200000,periodUs:100000};
const config=Object.freeze({
 allocation,binding,hostIdentity,image:{digest:allocation.imageDigest},cwd,
 installation:{nodePath:'/usr/local/bin/node',cliPath:'/opt/meri/browser-host/node_modules/@playwright/mcp/cli.js',browsersPath:'/opt/meri/browsers',version:'0.0.83',egressProxy:'http://127.0.0.1:3128'},
 identities:IDENTITIES,
 paths:{helperPath:'/opt/meri/meri-host-launcher',hostRelayHelperPath:'/opt/meri/meri-host-relay-launcher',nodePath:'/usr/local/bin/node',
  cliPath:'/opt/meri/browser-host/node_modules/@playwright/mcp/cli.js',browsersPath:'/opt/meri/browsers',workspaceRoot:'/workspace'},
 network:{privateInterfaceName:'ens5',browserProxyPort:3128},limits:LIMITS,
 tls:{installed:true,peerSan:PEER.name,peerFingerprint:PEER.fingerprintSha256,maxPeerLifetimeMs:900000,peerNotAfterMs:FIXTURE_NOW_MS+600000,cleanupCeilingMs:FIXTURE_NOW_MS+700000},
 control:{address:'10.0.0.1',port:443,serverName:'control.meri-preview.internal',clientName:PEER.name,policySha256:'e'.repeat(64),serverFingerprintSha256:'c'.repeat(64)},
 listen:{address:'127.0.0.1',port:9444,serverName:TLS.serverName},
 installedTls:{tls:{serverKey:TLS.key,serverCert:TLS.cert,clientKey:Buffer.from('client-key'),clientCert:Buffer.from('client-cert'),ca:Buffer.from('ca'),controlCa:TLS.clientCa}},
});
const group=hostWideCgroup({allocation,binding,hostIdentity}),bSha=canonicalSha256(binding),LEADER=301;
const leaf=`${group.path}/${bSha}/browser`,relayLeaf=`${group.path}/${bSha}/host-relay-browser`;
const statLine=pid=>`${pid} (chrome) S ${Array.from({length:22},(_,i)=>i===19?'987654':'0').join(' ')}`;
const status=uid=>`Uid:\t${uid}\t${uid}\t${uid}\t${uid}\nGid:\t${uid}\t${uid}\t${uid}\t${uid}\n`+
 ['CapInh','CapPrm','CapEff','CapBnd','CapAmb'].map(name=>`${name}:\t0000000000000000\n`).join('')+'NoNewPrivs:\t1\n';
const mountinfo='1 0 0:1 / / rw - ext4 /dev/root rw\n2 1 0:2 / /sys/fs/cgroup ro,nosuid,nodev,noexec - tmpfs tmpfs ro\n';
const enoent=()=>Object.assign(Error('ENOENT'),{code:'ENOENT'});

/** One scripted Linux: the browser leader and the host relay live under the generation tree until the launcher closed. */
function kernel(events){
 const exited=()=>events.includes('launcher-close');
 const dirs=()=>({[group.path]:[bSha],[`${group.path}/${bSha}`]:['browser','host-relay-browser'],[leaf]:[],[relayLeaf]:[]});
 const procs=path=>exited()?'':path===leaf?`${LEADER}\n`:path===relayLeaf?'302\n':'';
 const limitFiles={[`${group.path}/${bSha}/memory.max`]:'2147483648\n',[`${group.path}/${bSha}/pids.max`]:'512\n',[`${group.path}/${bSha}/cpu.max`]:'200000 100000\n'};
  const files=()=>exited()?{'/proc/sys/kernel/random/boot_id':`${hostIdentity.bootId}\n`,...limitFiles}:{
  [`/proc/${LEADER}/stat`]:statLine(LEADER),[`/proc/${LEADER}/status`]:status(2002),[`/proc/${LEADER}/cgroup`]:`0::${leaf.slice('/sys/fs/cgroup'.length)}\n`,
  [`/proc/${LEADER}/mountinfo`]:mountinfo,'/proc/302/status':status(3001),'/proc/302/mountinfo':mountinfo,'/proc/sys/kernel/random/boot_id':`${hostIdentity.bootId}\n`,...limitFiles};
 const dirStat=(path,ino)=>({dev:1,ino,uid:0,mode:0o040755,isDirectory:()=>true,isSymbolicLink:()=>false});
 const confinementPorts={
  async readFile(path){
   if(path.endsWith('/cgroup.procs')){const d=path.slice(0,-'/cgroup.procs'.length);if(!(d in dirs()))throw enoent();return procs(d);}
   const f=files();if(!Object.hasOwn(f,path))throw enoent();return f[path];
  },
  async stat(path){
   if(path===`/proc/${LEADER}/ns/net`)return {dev:1,ino:2};if(path===`/proc/${LEADER}/ns/mnt`)return {dev:19,ino:20};if(path==='/proc/self/ns/mnt')return {dev:19,ino:21};
   if(path===group.path)return dirStat(path,2);if(path in dirs())return dirStat(path,7);throw enoent();
  },
  async readdir(path){if(!(path in dirs()))throw enoent();return ['cgroup.procs','cgroup.events',...dirs()[path]];},
 };
 const handle=(identity,path)=>({identity,async readEvents(){return `populated ${procs(path)===''&&(path!==group.path||exited())?0:1}\n`;},async close(){}});
 const cgroupPorts={async openGroup(path){return handle({dev:'1',ino:'3'},path);},async readLeaderCgroup(pid){return exited()?null:pid===LEADER?leaf.slice('/sys/fs/cgroup'.length):null;}};
 const hostCgroupPorts={async openGroup(path){return handle({dev:'1',ino:'2'},path);},async readLeaderCgroup(pid){return exited()?null:pid===LEADER?leaf.slice('/sys/fs/cgroup'.length):null;},async readBootId(){return hostIdentity.bootId;}};
 return {confinementPorts,cgroupPorts,hostCgroupPorts};
}

function harness({facts=activeFacts}={}){
 const f=serviceFixture();const events=f.events;
 const client={
  async readFacts({allocation:a,binding:b}){events.push('facts');assert.equal(a.hostMode,'browser-only');assert.deepEqual(b,binding);return {facts};},
  async readCurrent(){events.push('current');return {allocation,binding,policySha256,phase:'active',checkedAtMs:FIXTURE_NOW_MS,currentUntilMs:FIXTURE_NOW_MS+1000};},
  async holdBrowser(){events.push('hold');return {outcome:'APPLIED'};},
  async resolveBrowserWorkflow(){return {workflow:null};},async decideBrowserApproval(){return {permitted:false};},
  async recordBrowserReceipt(){return {recorded:true};},async recordBrowserDownloadReceipt(){return {recorded:true};},
  async ingest(){return {versionId:'synthetic'};},async reconcileBrowserDownload(){return null;},close(){events.push('client-close');return {closed:true};},
 };
 const plan=createNetworkPlan({allocation,binding,kind:'browser',routes:[{name:'browser-http',localPort:3128,targetAddress:'127.0.0.1',targetPort:4100}]});
 const proof={verified:true,kind:'browser',allocationSha256:plan.allocationSha256,bindingSha256:plan.bindingSha256,namespacePath:plan.namespacePath,namespaceDev:'1',namespaceIno:'2',localRelays:[]};
 const compartmentCalls=[];
 const ports={
  ...kernel(events),
  hierarchyPort:makeInertHierarchyPort({boot:hostIdentity.bootId}),
  lifecyclePorts:{async readBootId(){return hostIdentity.bootId;},async openGroup(){events.push('group-open');return {async readEvents(){return 'populated 0\nfrozen 0\n';},async close(){events.push('group-close');}};}},
  createClient(input){events.push('client');assert.equal(input.purpose,'browser');assert.equal(input.maxFreshMs,1000);assert.equal(input.tls.cert,config.installedTls.tls.clientCert);return client;},
  async startEgress(input){events.push('egress-start');assert.equal(input.maxFreshMs,1000);assert.equal(typeof input.resolve,'function');assert.equal(typeof input.startProxy,'function','the host supplies the separate proxy process');
   return {endpoint:'http://127.0.0.1:4100',pid:777,async grant(){return {granted:true};},async refresh(){},async revoke(){events.push('egress-revoke');return {revoked:true};},async close(){events.push('egress-close');return {closed:true};}};},
  async installProxyGuard(input){events.push('guard-install');assert.deepEqual([input.eniName,input.proxyUid,input.pid],['ens5',3003,777]);assert.equal(input.allocation.hostMode,'browser-only');
   return {guard:{tableName:'mp0'},readback:{verified:true},async close(){events.push('guard-close');return {closed:true};}};},
  async prepareCompartment(input){compartmentCalls.push(input);events.push('compartment');
   return {plan,get proof(){return proof;},async verify(){return proof;},async close(){events.push('compartment-close');return {closed:true};}};},
  upstream:{version:'0.0.83',createConnection(){}},
  prepareBrowserWorkspace:f.input.prepareBrowserWorkspace,readWorkspace:f.input.readWorkspace,
  dependencies:f.deps,
 };
 return {events,client,ports,compartmentCalls,f};
}
const lifecycleRequest=action=>({schema:NATIVE_LIFECYCLE_SCHEMA,action,
 allocation:{schema:'meri-conversation-host-allocation/1',tenantId:allocation.tenantId,conversationId:allocation.conversationId,generation:allocation.generation,hostId:allocation.hostId,imageDigest:allocation.imageDigest,leaseDeadlineMs:allocation.leaseDeadlineMs,hostMode:'browser-only'},
 binding,hostIdentity});
const at=(events,name)=>events.indexOf(name);

test('start reads the active policy from Control, opens egress before the compartment route to it, arms both real observers through the measured verifier and starts the listener',async()=>{
 const h=harness();
 const host=await startBrowserHost({config,ports:h.ports,now:()=>FIXTURE_NOW_MS});
 assert.equal(host.started,true);assert.equal(host.policySha256,policySha256);assert.deepEqual(host.address,{address:'127.0.0.1',port:9443});
 const order=['client','group-open','facts','egress-start','guard-install','compartment','prepare-workspace','launcher-ctor','prepare','readback','go','viewer-start'].map(name=>at(h.events,name));
 const parent=h.ports.hierarchyPort.nodes.get(`/sys/fs/cgroup/meri/hosts/${allocation.hostId}-${allocation.generation}/${bSha}`);
 assert.deepEqual(parent.limits,{'memory.max':'2147483648','pids.max':'512','cpu.max':'200000 100000'},'finite run limits are applied to the run parent');
 assert.ok(order.every(i=>i>=0),JSON.stringify(h.events));assert.deepEqual([...order].sort((a,b)=>a-b),order,JSON.stringify(h.events));
 const compartment=h.compartmentCalls[0];
 assert.equal(h.compartmentCalls.length,1);assert.equal(compartment.kind,'browser');
 assert.deepEqual(compartment.routes,[{name:'browser-http',localPort:3128,targetAddress:'127.0.0.1',targetPort:4100}]);
 assert.equal(compartment.hostRelayUid,3001);assert.equal(compartment.privateInterfaceName,'ens5');
 assert.equal(typeof compartment.startHostRelayProcess,'function');assert.equal(typeof compartment.startLocalRelayProcess,'function');
 const closed=await host.close();
 assert.equal(closed.closed,true,JSON.stringify(closed.receipt));
 assert.deepEqual([closed.receipt.browserEgress,closed.receipt.processes,closed.receipt.browserState,closed.receipt.hostDestroy],['closed','exited','disposed','not-applicable']);
 assert.ok(at(h.events,'session-destroy')<at(h.events,'launcher-close')&&at(h.events,'launcher-close')<at(h.events,'egress-revoke')&&
  at(h.events,'egress-revoke')<at(h.events,'compartment-close')&&at(h.events,'compartment-close')<at(h.events,'guard-close')&&at(h.events,'guard-close')<at(h.events,'viewer-close')&&
  at(h.events,'viewer-close')<at(h.events,'group-close'),JSON.stringify(h.events));
 assert.equal(h.events.includes('physical-destroy'),false,'the instance is destroyed by Control, never by the host');
 assert.ok(h.events.includes('client-close'));
});

test('Control\'s lifecycle close settles the host behind a live listener and reports what it settled; processes then proves the empty generation tree',async()=>{
 const h=harness();
 const host=await startBrowserHost({config,ports:h.ports,now:()=>FIXTURE_NOW_MS});
 const answer=await host.lifecycle.close(lifecycleRequest('close'),{deadlineMs:FIXTURE_NOW_MS+5000});
 assert.equal(answer.status,'closed');assert.equal(answer.browserEgress,'closed');assert.equal(answer.browserState,'disposed');
 assert.ok(h.events.includes('compartment-close'));assert.equal(h.events.includes('viewer-close'),false,'the listener answers before it retires');
 const absence=await host.lifecycle.processes(lifecycleRequest('processes'),{deadlineMs:FIXTURE_NOW_MS+5000});
 assert.equal(absence.scope,'browser-host-descendants');assert.equal(absence.exited,true);
 await assert.rejects(host.lifecycle.observe(lifecycleRequest('observe'),{deadlineMs:FIXTURE_NOW_MS+5000}),{code:'NATIVE_LIFECYCLE_REFUSED'});
 const closed=await host.close();
 assert.equal(closed.closed,true,JSON.stringify(closed.receipt));
 assert.equal(h.events.filter(e=>e==='egress-close').length,1,'the operator stop reuses the settled receipt');
 assert.equal(h.events.filter(e=>e==='viewer-close').length,1);
});

test('the lifecycle route is served through the real handler with the protected Control peer pins',async()=>{
 const h=harness();let served;
 h.ports.dependencies={...h.f.deps,viewer:input=>{served=input;return h.f.deps.viewer(input);}};
 const host=await startBrowserHost({config,ports:h.ports,now:()=>FIXTURE_NOW_MS});
 assert.equal(typeof served.lifecycle,'function');
 // An unauthenticated socket is refused by the handler itself, before any body or producer work.
 const req=Object.assign(new EventEmitter(),{method:'POST',url:NATIVE_LIFECYCLE_PATH,socket:{encrypted:false},headers:{},complete:true});
 const sent=[];const res=Object.assign(new EventEmitter(),{headersSent:false,writableEnded:false,writeHead(code){sent.push(code);this.headersSent=true;},end(){this.writableEnded=true;}});
 await served.lifecycle(req,res);
 assert.deepEqual(sent,[401]);
 await host.close();
});

test('an egress proxy without a pid cannot be guarded and refuses the host before the compartment exists',async()=>{
 const h=harness();
 h.ports.startEgress=async()=>({endpoint:'http://127.0.0.1:4100',async close(){h.events.push('egress-close');return {closed:true};}});
 await assert.rejects(startBrowserHost({config,ports:h.ports,now:()=>FIXTURE_NOW_MS}),{code:'BROWSER_HOST_PROXY_UNCONFINED'});
 assert.equal(h.events.includes('compartment'),false);assert.ok(h.events.includes('egress-close'));
});

test('a run without an active browser policy refuses before any egress or compartment exists and releases what it acquired',async()=>{
 const held={schema:BROWSER_HOST_FACTS_SCHEMA,binding,scopes,deadlineMs:FIXTURE_NOW_MS+60000,currentUntilMs:FIXTURE_NOW_MS+5000,phase:'browser-held',admitted:{sdk:false,bash:false,browser:true}};
 const h=harness({facts:held});
 await assert.rejects(startBrowserHost({config,ports:h.ports,now:()=>FIXTURE_NOW_MS}),{code:'BROWSER_HOST_POLICY_UNAVAILABLE'});
 assert.equal(h.events.includes('egress-start'),false);assert.equal(h.events.includes('compartment'),false);
 assert.ok(h.events.includes('group-close'),'the lifecycle producer released its pinned root');assert.ok(h.events.includes('client-close'));
 assert.equal(h.ports.hierarchyPort.nodes.has(`/sys/fs/cgroup/meri/hosts/${allocation.hostId}-${allocation.generation}`),false,'the created generation root was removed');
});
