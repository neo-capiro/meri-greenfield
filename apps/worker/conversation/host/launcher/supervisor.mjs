// @ts-check
/** Trusted D005 launch owner. Import is inert; creating a launcher performs no host mutation. The production caller
 * supplies independently authenticated currentness readers, network compartments and exact image-pinned paths. */
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {stat,unlink} from 'node:fs/promises';
import {posix} from 'node:path';
import {PassThrough} from 'node:stream';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {playwrightHostCommand,validateBrowserInstallation} from '../../browser/server.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity,assertHostCurrent} from '../binding.mjs';
import {namespaceProbeArgs,READINESS_MODEL_ENV} from '../../sandbox-readiness/readiness.mjs';

const HEX=/^[0-9a-f]{64}$/u;
const DECIMAL=/^(0|[1-9][0-9]*)$/u;
const NAME=/^[a-z0-9-]{1,63}$/u;
// The runner poststart owner writes this image-pinned CA. It must sign a model-proxy server certificate with
// IP SAN 127.0.0.1; the host/image qualification has to verify that certificate and the CA file contents.
const SDK_MODEL_CA_FILE='/run/meri/poststart/bootstrap/control-ca.pem';
const SDK_ENV=new Set(['PATH','HOME','CLAUDE_CONFIG_DIR','CLAUDE_SECURESTORAGE_CONFIG_DIR',
 'ANTHROPIC_BASE_URL','ANTHROPIC_AUTH_TOKEN','CLAUDE_CODE_SUBPROCESS_ENV_SCRUB','NODE_EXTRA_CA_CERTS',
 'CLAUDE_CODE_MAX_OUTPUT_TOKENS','MAX_THINKING_TOKENS','CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
 'LANG','LC_ALL','TMPDIR']);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const absolute=value=>typeof value==='string'&&value.length<=4095&&posix.isAbsolute(value)&&posix.resolve(value)===value&&!value.includes('\0');
const uid=value=>Number.isSafeInteger(value)&&value>=1000&&value<=65533;
const maxMs=value=>Number.isSafeInteger(value)&&value>=100&&value<=10000;
function exactEnv(value,mode){
 let v;try{v=data(value);if(!v||typeof v!=='object'||Array.isArray(v))fail('HOST_LAUNCH_ENV_REFUSED');}catch{fail('HOST_LAUNCH_ENV_REFUSED');}
 for(const [name,entry] of Object.entries(v))if(!SDK_ENV.has(name)||typeof entry!=='string'||entry.length>8192||entry.includes('\0'))fail('HOST_LAUNCH_ENV_REFUSED');
 for(const key of mode==='readiness'?['CLAUDE_CONFIG_DIR','ANTHROPIC_BASE_URL','ANTHROPIC_AUTH_TOKEN']:
  ['CLAUDE_CONFIG_DIR','CLAUDE_SECURESTORAGE_CONFIG_DIR','ANTHROPIC_BASE_URL','ANTHROPIC_AUTH_TOKEN'])
  if(typeof v[key]!=='string'||!v[key])fail('HOST_LAUNCH_ENV_REFUSED');
 if(![v.CLAUDE_CONFIG_DIR,...(v.CLAUDE_SECURESTORAGE_CONFIG_DIR===undefined?[]:[v.CLAUDE_SECURESTORAGE_CONFIG_DIR])].every(absolute)||
  v.HOME!==undefined&&!absolute(v.HOME))fail('HOST_LAUNCH_ENV_REFUSED');
 let model;try{model=new URL(v.ANTHROPIC_BASE_URL);}catch{fail('HOST_LAUNCH_ENV_REFUSED');}
 if(mode==='readiness'){
  if(v.ANTHROPIC_BASE_URL!==READINESS_MODEL_ENV.ANTHROPIC_BASE_URL||
   v.ANTHROPIC_AUTH_TOKEN!==READINESS_MODEL_ENV.ANTHROPIC_AUTH_TOKEN||
   v.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC!=='1')fail('HOST_LAUNCH_ENV_REFUSED');
 }else if(model.protocol!=='https:'||model.username||model.password||model.search||model.hash||model.pathname!=='/'||
  Object.hasOwn(v,'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'))fail('HOST_LAUNCH_ENV_REFUSED');
 return Object.freeze({...v});
}
function scope(input){
 const allocation=assertHostAllocation(input.allocation),binding=assertHostRunBinding(allocation,input.binding);
 const hostIdentity=assertD005HostIdentity(input.hostIdentity,binding,allocation);
 if(Date.now()>=allocation.leaseDeadlineMs)fail('HOST_LAUNCH_EXPIRED');
 return Object.freeze({allocation,binding,hostIdentity,bindingSha256:canonicalSha256(binding),allocationSha256:canonicalSha256(allocation)});
}
async function within(task,ms,signal){
 if(signal?.aborted)fail('HOST_LAUNCH_CANCELLED');
 const deadline=AbortSignal.timeout(ms),combined=signal?AbortSignal.any([signal,deadline]):deadline;
 let rejectAbort;
 const refused=new Promise((_,reject)=>{rejectAbort=()=>reject(Object.assign(new Error('HOST_LAUNCH_UNKNOWN'),{code:'HOST_LAUNCH_UNKNOWN'}));combined.addEventListener('abort',rejectAbort,{once:true});});
 try{return await Promise.race([Promise.resolve().then(()=>task(combined)),refused]);}
 finally{combined.removeEventListener('abort',rejectAbort);}
}
function lineReader(stream){
 const lines=[],waiters=[];let buffer='',closed=false;
 const settle=error=>{closed=true;while(waiters.length)waiters.shift().reject(error);};
 stream.on('data',chunk=>{
  if(closed)return;buffer+=chunk.toString('utf8');if(buffer.length>256){settle(Error('HOST_LAUNCH_PROTOCOL'));return;}
  for(let end=buffer.indexOf('\n');end!==-1;end=buffer.indexOf('\n')){
   const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
   if(waiters.length)waiters.shift().resolve(line);else lines.push(line);
   if(lines.length>3){settle(Error('HOST_LAUNCH_PROTOCOL'));return;}
  }
 });
 stream.on('end',()=>settle(Error('HOST_LAUNCH_CLOSED')));
 stream.on('error',error=>settle(error));
 return ()=>lines.length?Promise.resolve(lines.shift()):closed?Promise.reject(Error('HOST_LAUNCH_CLOSED')):
  new Promise((resolve,reject)=>waiters.push({resolve,reject}));
}
async function stopChild(child,ms){
 if(!child)return {stopped:true};
 if(child.exitCode!==null||child.signalCode!==null)return {stopped:true};
 const exited=new Promise(resolve=>child.once('exit',()=>resolve(true)));
 try{child.kill('SIGKILL');}catch{}
 let timer;const done=await Promise.race([exited,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),ms);})]);
 clearTimeout(timer);
 if(!done)fail('HOST_LAUNCH_CLEANUP_UNKNOWN');return {stopped:true};
}
function nativeSpec(s,{kind,network,command,args,cwd,home,browsersPath,uid:runUid,gid:runGid}){
 if(!['sdk','browser','relay-sdk','relay-browser'].includes(kind)||!uid(runUid)||!uid(runGid)||
  ![command,cwd,home,browsersPath].every(absolute)||!Array.isArray(args)||args.length>100||
  args.some(value=>typeof value!=='string'||value.length>8192||value.includes('\0'))||
  !NAME.test(network.namespace)||!DECIMAL.test(network.namespaceDev)||!DECIMAL.test(network.namespaceIno))fail('HOST_LAUNCH_CONFIGURATION');
 return [s.allocation.hostId,String(s.allocation.generation),s.bindingSha256,kind,network.namespace,
  network.namespaceDev,network.namespaceIno,String(runUid),String(runGid),cwd,home,browsersPath,command,...args];
}
async function verifiedNetwork(s,network,kind,signal,ms){
 if(!network||typeof network.verify!=='function'||!network.plan||network.plan.kind!==kind)fail('HOST_LAUNCH_NETWORK_REFUSED');
 const p=await within(()=>network.verify(),ms,signal);
 if(p?.verified!==true||p.kind!==kind||p.allocationSha256!==s.allocationSha256||p.bindingSha256!==s.bindingSha256||
  p.namespacePath!==`/run/netns/${network.plan.namespaceName}`||!NAME.test(network.plan.namespaceName)||
  !DECIMAL.test(p.namespaceDev)||!DECIMAL.test(p.namespaceIno)||
  (network.proof&&(p.namespaceDev!==network.proof.namespaceDev||p.namespaceIno!==network.proof.namespaceIno)))fail('HOST_LAUNCH_NETWORK_REFUSED');
 if(!Array.isArray(p.localRelays)||p.localRelays.length!==network.plan.routes.length||
  network.plan.routes.some(route=>p.localRelays.filter(local=>local?.name===route.name&&local.localPort===route.localPort).length!==1))
  fail('HOST_LAUNCH_NETWORK_REFUSED');
 return Object.freeze({namespace:network.plan.namespaceName,namespaceDev:p.namespaceDev,namespaceIno:p.namespaceIno,
  localRelays:Object.freeze(p.localRelays.map(local=>Object.freeze({name:local.name,localPort:local.localPort,
   hostAddress:local.hostAddress,hostRelayPort:local.hostRelayPort})))});
}
function assertSdkModelRoute(environment,network){
 const models=network.localRelays.filter(route=>route.name==='model-proxy');
 if(models.length!==1||!Number.isSafeInteger(models[0].localPort)||models[0].localPort<1024||models[0].localPort>65535||
  environment.ANTHROPIC_BASE_URL!==`https://127.0.0.1:${models[0].localPort}/`||
  environment.NODE_EXTRA_CA_CERTS!==SDK_MODEL_CA_FILE)fail('HOST_LAUNCH_MODEL_ROUTE_REFUSED');
}
function authorities(input){
 if(!Array.isArray(input)||input.length<1||input.length>3)fail('HOST_LAUNCH_CONFIGURATION');
 const result=input.map(entry=>{let a;try{a=own(entry,['policySha256','readCurrent','maxFreshMs']);}catch{fail('HOST_LAUNCH_CONFIGURATION');}
  if(!HEX.test(a.policySha256)||typeof a.readCurrent!=='function'||!Number.isSafeInteger(a.maxFreshMs)||a.maxFreshMs<1||a.maxFreshMs>30000)fail('HOST_LAUNCH_CONFIGURATION');
  return Object.freeze(a);});
 return Object.freeze(result);
}
async function checkAuthority(s,readers,signal,ms){
 if(Date.now()>=s.allocation.leaseDeadlineMs)fail('HOST_LAUNCH_EXPIRED');
 for(const authority of readers){
  const receipt=await within(inner=>authority.readCurrent({allocation:structuredClone(s.allocation),binding:structuredClone(s.binding),
   policySha256:authority.policySha256,signal:inner}),ms,signal);
  assertHostCurrent({allocation:s.allocation,binding:s.binding,policySha256:authority.policySha256,
   current:receipt,nowMs:Date.now(),maxFreshMs:authority.maxFreshMs});
 }
}
async function preparedProcess({s,helperPath,kind,network,command,args,cwd,home,browsersPath,runUid,runGid,env,
 spawnNative,readyMs,signal,onPrepared,check,onNetwork=()=>{},onSpawn=()=>{},onSettled=()=>{}}){
 const pin=await verifiedNetwork(s,network,kind==='relay-sdk'?'sdk':kind==='relay-browser'?'browser':kind,signal,readyMs);
 onNetwork(pin);
 await check();
 const child=spawnNative(helperPath,['run',...nativeSpec(s,{kind,network:pin,command,args,cwd,home,browsersPath,uid:runUid,gid:runGid})],
  {env,stdio:['pipe','pipe','pipe','pipe','pipe'],windowsHide:true});
 if(!child||!Number.isSafeInteger(child.pid)||child.pid<2||!child.stdio?.[3]||!child.stdio?.[4])fail('HOST_LAUNCH_UNKNOWN');
 onSpawn(child);
 const next=lineReader(child.stdio[3]);
 try{
  if(await within(()=>next(),readyMs,signal)!=='R')fail('HOST_LAUNCH_UNKNOWN');
  await within(()=>onPrepared({leaderPid:child.pid,sdkLeaderPid:child.pid,kind}),readyMs,signal);
  const again=await verifiedNetwork(s,network,kind==='relay-sdk'?'sdk':kind==='relay-browser'?'browser':kind,signal,readyMs);
  if(canonicalSha256(again)!==canonicalSha256(pin))fail('HOST_LAUNCH_NETWORK_REFUSED');
  onNetwork(again);
  await check();if(signal?.aborted)fail('HOST_LAUNCH_CANCELLED');
  child.stdio[4].end('G');
  return child;
 }catch(error){try{await stopChild(child,readyMs);onSettled(child);}catch{fail('HOST_LAUNCH_CLEANUP_UNKNOWN');}throw error;}
}

/** One host allocation. The SDK process client plugs into the existing createPreparedRunnerQuery, so it launches
 * exactly the descriptor captured from the *single* Claude Agent SDK query. */
export function createHostLauncher({allocation,binding,hostIdentity,helperPath,shimPath,
 sdkNetwork,browserNetwork,authorities:rawAuthorities,sdkUid,sdkGid,browserUid,browserGid,
 validateSdkDescriptor,onSdkPrepared,onBrowserPrepared,sdkLaunchGate,sdkMode='conversation',probeCommand,probeNodePath,
 signal,spawnNative=spawn,now=Date.now,
 readSocketDirectory=stat,readyMs=5000,stopMs=5000}={}){
 const s=scope({allocation,binding,hostIdentity}),readers=authorities(rawAuthorities);
 if(![helperPath,shimPath].every(absolute)||shimPath!=='/opt/meri/bin/meri-mcp-shim'||
  !uid(sdkUid)||!uid(sdkGid)||!uid(browserUid)||!uid(browserGid)||sdkUid===browserUid||sdkGid===browserGid||
  typeof validateSdkDescriptor!=='function'||typeof onSdkPrepared!=='function'||typeof onBrowserPrepared!=='function'||
  typeof sdkLaunchGate?.enter!=='function'||typeof sdkLaunchGate?.freeze!=='function'||
  !['conversation','readiness'].includes(sdkMode)||sdkMode==='readiness'&&(!absolute(probeCommand)||!absolute(probeNodePath))||
  typeof spawnNative!=='function'||typeof readSocketDirectory!=='function'||typeof now!=='function'||!maxMs(readyMs)||!maxMs(stopMs))fail('HOST_LAUNCH_CONFIGURATION');
 nativeSignal(signal);if(signal?.aborted)fail('HOST_LAUNCH_CANCELLED');const life=new AbortController();
 const check=()=>checkAuthority(s,readers,life.signal,readyMs);
 let broker,sdk,sdkRelease,clientMade=false,closed=false,closing,browserFailure;
 const pendingChildren=new Set();
 const nonce=randomBytes(32).toString('hex'),socketPath=`/run/meri-launch/${s.bindingSha256}.sock`;
 const descriptor=Object.freeze({shimPath,socketPath,nonce});
 async function close(){if(closing)return closing;closed=true;life.abort();
  closing=(async()=>{const failures=[];
   for(const child of new Set([broker,sdk,...pendingChildren].filter(Boolean)))try{await stopChild(child,stopMs);}catch(error){failures.push(error);}
   if(!failures.length&&sdkRelease){sdkRelease();sdkRelease=undefined;}
   if(broker)try{await unlink(socketPath);}catch(error){if(error?.code!=='ENOENT')failures.push(error);}
   if(failures.length)fail('HOST_LAUNCH_CLEANUP_UNKNOWN');return Object.freeze({closed:true,processAbsenceProven:false});})();
  return closing;}
 async function prepareBrowserBroker({policy,installation,paths}){
  if(closed||broker||sdkMode!=='conversation')fail('HOST_LAUNCH_REFUSED');
  const installed=validateBrowserInstallation({...installation,launch:descriptor},s.binding);
  const command=playwrightHostCommand(validateBrowserPolicy(policy),installed,paths);
  if(!absolute(command.command)||!Array.isArray(command.args)||![paths.home,paths.profile,paths.output].every(absolute)||
   installed.egressProxy!==`http://127.0.0.1:${browserNetwork?.plan?.routes?.[0]?.localPort}`)fail('HOST_LAUNCH_CONFIGURATION');
  const network=await verifiedNetwork(s,browserNetwork,'browser',life.signal,readyMs);
  await check();
  const directory=await readSocketDirectory('/run/meri-launch');
  if(directory.uid!==0||directory.gid!==sdkGid||(directory.mode&0o077)!==0o010)fail('HOST_LAUNCH_CONFIGURATION');
  const args=['broker',socketPath,String(sdkUid),String(sdkGid),nonce,shimPath,
   ...nativeSpec(s,{kind:'browser',network,command:command.command,args:command.args,cwd:paths.home,
    home:command.env.HOME,browsersPath:command.env.PLAYWRIGHT_BROWSERS_PATH,uid:browserUid,gid:browserGid})];
  broker=spawnNative(helperPath,args,{env:{},stdio:['ignore','ignore','ignore','pipe','pipe','pipe'],windowsHide:true});
  if(!broker||!Number.isSafeInteger(broker.pid)||!broker.stdio?.[3]||!broker.stdio?.[4]||!broker.stdio?.[5])fail('HOST_LAUNCH_UNKNOWN');
  const next=lineReader(broker.stdio[3]);
  try{if(await within(()=>next(),readyMs,life.signal)!=='L')fail('HOST_LAUNCH_UNKNOWN');}
  catch(error){await close();throw error;}
  browserFailure=(async()=>{
   try{const line=await next(),match=/^R ([1-9][0-9]*)$/u.exec(line);
    if(!match)fail('HOST_LAUNCH_UNKNOWN');const leaderPid=Number(match[1]);
    await within(()=>onBrowserPrepared({leaderPid,kind:'browser'}),readyMs,life.signal);
    const again=await verifiedNetwork(s,browserNetwork,'browser',life.signal,readyMs);
    if(canonicalSha256(again)!==canonicalSha256(network))fail('HOST_LAUNCH_NETWORK_REFUSED');
    await check();if(closed)fail('HOST_LAUNCH_CANCELLED');broker.stdio[4].end('G');
   }catch(error){life.abort();try{await stopChild(broker,stopMs);}catch{}throw error;}
  })();browserFailure.catch(()=>{});
  return Object.freeze({descriptor,installation:installed,failure:browserFailure,close});
 }
 function createSdkProcessClient(){
  if(closed||sdk||clientMade)fail('HOST_LAUNCH_REFUSED');clientMade=true;
  const input=new PassThrough({highWaterMark:65536}),output=new PassThrough({highWaterMark:65536}),events=new EventEmitter();
  events.on('error',()=>{});let requested,started=false,ended=false;
  const facade=Object.freeze({stdin:input,stdout:output,get killed(){return closed||ended;},
   get exitCode(){return sdk?.exitCode??null;},get signalCode(){return sdk?.signalCode??null;},
   kill(){void close().catch(()=>{});return true;},on:(...args)=>events.on(...args),once:(...args)=>events.once(...args),off:(...args)=>events.off(...args)});
  return Object.freeze({
   spawnClaudeCodeProcess(value){
    if(requested||closed)fail('HOST_LAUNCH_REFUSED');
    const r=own(value,['command','args','cwd','env'],['signal']);nativeSignal(r.signal);
    if(r.signal?.aborted)fail('HOST_LAUNCH_CANCELLED');
    const inert=data({command:r.command,args:r.args,cwd:r.cwd,env:r.env});
    const admitted=validateSdkDescriptor(inert);
    if(canonicalSha256(admitted)!==canonicalSha256(inert))fail('HOST_LAUNCH_DESCRIPTOR_REFUSED');
    if(!absolute(r.command)||!absolute(r.cwd)||!Array.isArray(r.args)||r.args.some(x=>typeof x!=='string'||x.length>8192))fail('HOST_LAUNCH_DESCRIPTOR_REFUSED');
    requested=Object.freeze({command:r.command,args:Object.freeze([...r.args]),cwd:r.cwd,env:exactEnv(r.env,sdkMode)});
    r.signal?.addEventListener('abort',()=>{void close().catch(()=>{});},{once:true});
    return facade;
   },
   async startPreparedProcess(){
    if(!requested||started||closed)fail('HOST_LAUNCH_REFUSED');started=true;
    try{
     sdkRelease=sdkLaunchGate.enter();
     sdk=await preparedProcess({s,helperPath,kind:'sdk',network:sdkNetwork,command:requested.command,args:requested.args,
      cwd:requested.cwd,home:requested.env.HOME??requested.cwd,browsersPath:requested.cwd,runUid:sdkUid,runGid:sdkGid,
      env:requested.env,spawnNative,readyMs,signal:life.signal,onPrepared:onSdkPrepared,check,
      onNetwork:sdkMode==='conversation'?network=>assertSdkModelRoute(requested.env,network):()=>{},
      onSpawn:child=>pendingChildren.add(child),onSettled:child=>pendingChildren.delete(child)});
     pendingChildren.delete(sdk);
     // The broker does not accept a shim until this one SDK leader PID arrives over a supervisor-only pipe.
     // It requires the shim's kernel PPid to equal this leader, in addition to UID/cgroup/executable pins.
     if(broker){if(broker.exitCode!==null||broker.signalCode!==null||!broker.stdio?.[5])fail('HOST_LAUNCH_UNKNOWN');
      broker.stdio[5].end(`${sdk.pid}\n`);}
     input.pipe(sdk.stdin);sdk.stdout.pipe(output);sdk.stderr.resume();
     sdk.on('exit',(code,sig)=>{ended=true;output.end();if(sdkRelease){sdkRelease();sdkRelease=undefined;}
      events.emit('exit',code,sig);void close().catch(()=>{});});
     sdk.on('error',error=>events.emit('error',error));
     return Object.freeze({started:true,leaderPid:sdk.pid});
    }catch(error){await close();throw error;}
   },close,
  });
 }
 async function runReadinessProbe(command,args){
  if(sdkMode!=='readiness'||closed||command!==probeCommand||!Array.isArray(args)||
   ![true,false].some(fresh=>canonicalSha256(args)===canonicalSha256(namespaceProbeArgs(fresh,probeNodePath))))
   fail('HOST_LAUNCH_PROBE_REFUSED');
  const release=sdkLaunchGate.enter();let child,known=false;
  try{
   child=await preparedProcess({s,helperPath,kind:'sdk',network:sdkNetwork,command,args,cwd:'/tmp',home:'/tmp',
    browsersPath:'/tmp',runUid:sdkUid,runGid:sdkGid,env:{},spawnNative,readyMs,signal:life.signal,
    onPrepared:async()=>{},check});
   child.stdout.resume();child.stderr.resume();child.stdin.end();
   const status=await within(()=>new Promise(resolve=>{
    if(child.exitCode!==null||child.signalCode!==null)resolve({code:child.exitCode,signal:child.signalCode});
    else child.once('exit',(code,signal)=>resolve({code,signal}));}),10000,life.signal);
   known=true;return status.code===0&&status.signal===null;
  }catch{return false;}
  finally{
   if(!known)await stopChild(child,stopMs);
   release();
  }
 }
 signal?.addEventListener('abort',()=>{life.abort();void close().catch(()=>{});},{once:true});
 return Object.freeze({scope:s,descriptor,prepareBrowserBroker,createSdkProcessClient,runReadinessProbe,close,
  get signal(){return life.signal;}});
}

/** Standalone port needed while the network owner is preparing its namespace-local loopback relay. The network
 * owner supplies the fixed entrypoint and verifies the actual listener by PID before treating the handle as ready. */
export async function startConfinedLocalRelay({allocation,binding,hostIdentity,helperPath,networkProof,kind,
 command,args,cwd,uid:runUid,gid:runGid,authorize,signal,spawnNative=spawn,readyMs=5000,stopMs=5000}={}){
 const s=scope({allocation,binding,hostIdentity});
 if(!['sdk','browser'].includes(kind)||!absolute(helperPath)||!absolute(command)||!absolute(cwd)||
  typeof authorize!=='function'||!uid(runUid)||!uid(runGid)||!maxMs(readyMs)||!maxMs(stopMs))fail('HOST_LAUNCH_CONFIGURATION');
 nativeSignal(signal);
 if(networkProof?.verified!==true||networkProof.kind!==kind||networkProof.allocationSha256!==s.allocationSha256||
  networkProof.bindingSha256!==s.bindingSha256||!/^\/run\/netns\/[a-z0-9-]{1,63}$/u.test(networkProof.namespacePath))fail('HOST_LAUNCH_NETWORK_REFUSED');
 const network={namespace:networkProof.namespacePath.split('/').at(-1),namespaceDev:networkProof.namespaceDev,namespaceIno:networkProof.namespaceIno};
 await within(()=>authorize({allocation:s.allocation,binding:s.binding,signal}),readyMs,signal);
 const child=spawnNative(helperPath,['run',...nativeSpec(s,{kind:`relay-${kind}`,network,command,args,cwd,home:cwd,browsersPath:cwd,uid:runUid,gid:runGid})],
  {env:{},stdio:['ignore','ignore','ignore','pipe','pipe'],windowsHide:true});
 if(!child||!Number.isSafeInteger(child.pid)||!child.stdio?.[3]||!child.stdio?.[4])fail('HOST_LAUNCH_UNKNOWN');
 try{
  if(await within(()=>lineReader(child.stdio[3])(),readyMs,signal)!=='R')fail('HOST_LAUNCH_UNKNOWN');
  await within(()=>authorize({allocation:s.allocation,binding:s.binding,signal}),readyMs,signal);
  if(signal?.aborted)fail('HOST_LAUNCH_CANCELLED');child.stdio[4].end('G');
  return Object.freeze({pid:child.pid,async close(){await stopChild(child,stopMs);return Object.freeze({closed:true});}});
 }catch(error){await stopChild(child,stopMs);throw error;}
}
