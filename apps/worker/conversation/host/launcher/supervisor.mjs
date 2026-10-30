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
import {playwrightHostCommand,validateBrowserInstallation,validateBrowserContextInstallation} from '../../browser/server.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity,assertHostCurrent,assertBrowserHostCurrent} from '../binding.mjs';
import {namespaceProbeArgs,READINESS_MODEL_ENV} from '../../sandbox-readiness/readiness.mjs';
import {createSdkChildQuiescenceObserver} from './sdk-quiescence.mjs';
import {createSdkChildHold} from './sdk-hold.mjs';
import {assertBrowserHandoff} from '../../../../../packages/runtime/browser-custody.mjs';

const HEX=/^[0-9a-f]{64}$/u;
const DECIMAL=/^(0|[1-9][0-9]*)$/u;
const NAME=/^[a-z0-9-]{1,63}$/u;
// Only a retired native launcher can transfer its live browser. Run metadata
// cannot manufacture this handle or cause another browser to be started.
const retainedBrowsers=new WeakMap();
const browserPinsFor=({policy,installation,paths})=>{const {launch,...physical}=installation;return canonicalSha256({policy,installation:physical,paths});};
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
 signal,readBrowserCurrent,retainedBrowser,spawnNative=spawn,now=Date.now,createSdkHold=createSdkChildHold,createSdkObserver=createSdkChildQuiescenceObserver,
 readSocketDirectory=stat,readyMs=5000,stopMs=5000}={}){
 const s=scope({allocation,binding,hostIdentity}),readers=authorities(rawAuthorities);
 if(s.allocation.hostMode!==undefined)fail('HOST_LAUNCH_CONFIGURATION');
 if(![helperPath,shimPath].every(absolute)||shimPath!=='/opt/meri/bin/meri-mcp-shim'||
  !uid(sdkUid)||!uid(sdkGid)||!uid(browserUid)||!uid(browserGid)||sdkUid===browserUid||sdkGid===browserGid||
  typeof validateSdkDescriptor!=='function'||typeof onSdkPrepared!=='function'||typeof onBrowserPrepared!=='function'||
  typeof sdkLaunchGate?.enter!=='function'||typeof sdkLaunchGate?.freeze!=='function'||
  !['conversation','readiness'].includes(sdkMode)||sdkMode==='readiness'&&(!absolute(probeCommand)||!absolute(probeNodePath))||
  typeof spawnNative!=='function'||typeof createSdkHold!=='function'||typeof createSdkObserver!=='function'||typeof readSocketDirectory!=='function'||typeof now!=='function'||!maxMs(readyMs)||!maxMs(stopMs))fail('HOST_LAUNCH_CONFIGURATION');
 nativeSignal(signal);if(signal?.aborted)fail('HOST_LAUNCH_CANCELLED');const life=new AbortController();
 const retained=retainedBrowser===undefined?undefined:retainedBrowsers.get(retainedBrowser);
 if(retainedBrowser!==undefined&&(!retained||retained.consumed||!retained.live()||
  canonicalSha256(retained.target)!==s.bindingSha256||canonicalSha256(retained.allocation)!==s.allocationSha256||
  canonicalSha256(retained.hostIdentity)!==canonicalSha256(s.hostIdentity)||sdkMode!=='conversation'))fail('HOST_BROWSER_ADOPTION_REFUSED');
 if(readBrowserCurrent!==undefined&&typeof readBrowserCurrent!=='function')fail('HOST_LAUNCH_CONFIGURATION');
 const check=async()=>{await checkAuthority(s,readers,life.signal,readyMs);if(retained)await retained.current(life.signal);};
 const sdkHold=sdkMode==='conversation'&&browserNetwork?createSdkHold({allocation:s.allocation,binding:s.binding,hostIdentity:s.hostIdentity,timeoutMs:readyMs}):null;
 let broker,browser=retained?.browser,sdk,sdkRelease,clientMade=false,brokerTaken=false,closed=false,closing,browserFailure,browserPins=retained?.pins,sdkRetiring=false,sdkRetirement,sdkObserver,retirementComplete=false,successor;
 if(retained)retained.consumed=true;
 const pendingChildren=new Set();
 const nonce=randomBytes(32).toString('hex'),socketPath=`/run/meri-launch/${s.bindingSha256}.sock`;
 const descriptor=Object.freeze({shimPath,socketPath,nonce});
 async function close(){if(closing)return closing;closed=true;life.abort();
  closing=(async()=>{const failures=[];
   if(successor&&typeof successor.close==='function')try{await successor.close();}catch(error){failures.push(error);}
   for(const child of new Set([broker,browser,sdk,...pendingChildren].filter(Boolean)))try{await stopChild(child,stopMs);}catch(error){failures.push(error);}
   try{await sdkObserver?.close();await sdkHold?.close();}catch(error){failures.push(error);}
   if(!failures.length&&sdkRelease){sdkRelease();sdkRelease=undefined;}
   if(broker)try{await unlink(socketPath);}catch(error){if(error?.code!=='ENOENT')failures.push(error);}
   if(failures.length)fail('HOST_LAUNCH_CLEANUP_UNKNOWN');return Object.freeze({closed:true,processAbsenceProven:false});})();
  return closing;}
 async function prepareSdkRetirement({signal}={}){
  nativeSignal(signal);if(closed||sdkRetiring||!sdk||!browser||sdkMode!=='conversation')fail('HOST_SDK_RETIREMENT_REFUSED');
  await check();signal?.throwIfAborted();
  sdkObserver=createSdkObserver({allocation:s.allocation,binding:s.binding,hostIdentity:s.hostIdentity,timeoutMs:stopMs});
  await sdkObserver.arm({sdkLeaderPid:sdk.pid});
  if(closed||sdk.exitCode!==null||sdk.signalCode!==null||signal?.aborted){await close();fail('HOST_SDK_RETIREMENT_REFUSED');}
  sdkRetiring=true;return Object.freeze({prepared:true});
 }
 async function retireSdk(){
  if(closed||!sdkRetiring||!sdkObserver)fail('HOST_SDK_RETIREMENT_REFUSED');
  return sdkRetirement??=Promise.resolve().then(async()=>{try{
   for(const child of [sdk,broker].filter(Boolean))await stopChild(child,stopMs);
   await sdkObserver.waitQuiescent({signal:life.signal});await sdkHold?.close();
   if(sdkRelease){sdkRelease();sdkRelease=undefined;}
   if(broker)try{await unlink(socketPath);}catch(error){if(error?.code!=='ENOENT')throw error;}
   retirementComplete=true;
   return Object.freeze({closed:true,sdkAbsent:true,browserRetained:true});
  }catch(error){await close();throw error;}});
 }
 const closeSdk=()=>sdkRetiring?retireSdk():close();
 async function prepareSuccessor(input){
  const q=own(input,['binding','sdkNetwork','authorities','validateSdkDescriptor','onSdkPrepared','sdkLaunchGate'],['signal']);
  const target=assertHostRunBinding(s.allocation,q.binding);
  if(closed||successor||!retirementComplete||!browser||!browserPins||typeof readBrowserCurrent!=='function')fail('HOST_BROWSER_ADOPTION_REFUSED');
  // Reserve before awaiting currentness. A competing request cannot create a
  // second broker/SDK owner for the same retained context.
  successor=true;
  const live=()=>!closed&&retirementComplete&&browser.exitCode===null&&browser.signalCode===null;
  const current=async signal=>{
   if(!live())fail('HOST_BROWSER_ADOPTION_REFUSED');
   const receipt=await within(inner=>readBrowserCurrent({signal:inner}),readyMs,signal);
   const handoff=assertBrowserHandoff(receipt?.browserHandoff,{targetBinding:target});
   if(canonicalSha256(handoff.custody.binding)!==s.bindingSha256||handoff.custody.hostId!==s.allocation.hostId||
    handoff.custody.generation!==s.allocation.generation||handoff.custody.expiresAtMs<=now()||!live())fail('HOST_BROWSER_ADOPTION_REFUSED');
   return handoff;
  };
  try{
   await current(q.signal);
   const token=Object.freeze({});retainedBrowsers.set(token,{target,allocation:s.allocation,hostIdentity:s.hostIdentity,browser,pins:browserPins,live,current,consumed:false});
   successor=createHostLauncher({allocation:s.allocation,binding:target,hostIdentity:s.hostIdentity,helperPath,shimPath,
    sdkNetwork:q.sdkNetwork,browserNetwork,authorities:q.authorities,sdkUid,sdkGid,browserUid,browserGid,
    validateSdkDescriptor:q.validateSdkDescriptor,onSdkPrepared:q.onSdkPrepared,onBrowserPrepared,sdkLaunchGate:q.sdkLaunchGate,
    signal:q.signal,readBrowserCurrent,retainedBrowser:token,spawnNative,now,createSdkHold,createSdkObserver,readSocketDirectory,readyMs,stopMs});
   return successor;
  }catch(error){await close();throw error;}
 }
 async function prepareBrowserContext({policy,installation,paths}){
  if(closed||browser||browserPins||sdkMode!=='conversation')fail('HOST_LAUNCH_REFUSED');
  const installed=validateBrowserInstallation({...installation,launch:descriptor},s.binding);
  const admitted=validateBrowserPolicy(policy),command=playwrightHostCommand(admitted,installed,paths);
  if(!absolute(command.args[0])||![paths.home,paths.profile,paths.output].every(absolute)||
   installed.egressProxy!==`http://127.0.0.1:${browserNetwork?.plan?.routes?.[0]?.localPort}`)fail('HOST_LAUNCH_CONFIGURATION');
  browserPins=browserPinsFor({policy:admitted,installation:installed,paths});
  try{
   browser=await preparedProcess({s,helperPath,kind:'browser',network:browserNetwork,command:command.command,args:command.args,
    cwd:paths.home,home:paths.home,browsersPath:installed.browsersPath,runUid:browserUid,runGid:browserGid,
    env:{},spawnNative,readyMs,signal:life.signal,onPrepared:onBrowserPrepared,check,
    onSpawn:child=>pendingChildren.add(child),onSettled:child=>pendingChildren.delete(child)});
   pendingChildren.delete(browser);
   return Object.freeze({installation:installed,readable:browser.stdout,writable:browser.stdin,close});
  }catch(error){try{await close();}catch{}throw error;}
 }
 async function prepareBrowserBroker({policy,installation,paths}){
  const installed=validateBrowserInstallation({...installation,launch:descriptor},s.binding);
  if(closed||brokerTaken||!browser||browser.exitCode!==null||browser.signalCode!==null||sdkMode!=='conversation'||
   browserPins!==browserPinsFor({policy:validateBrowserPolicy(policy),installation:installed,paths}))fail('HOST_LAUNCH_REFUSED');
  brokerTaken=true;
  await check();
  const directory=await readSocketDirectory('/run/meri-launch');
  if(directory.uid!==0||directory.gid!==sdkGid||(directory.mode&0o077)!==0o010)fail('HOST_LAUNCH_CONFIGURATION');
  const args=['broker',socketPath,String(sdkUid),String(sdkGid),nonce,shimPath,
   s.allocation.hostId,String(s.allocation.generation),s.bindingSha256];
  broker=spawnNative(helperPath,args,{env:{},stdio:['ignore','ignore','ignore','pipe','pipe','pipe','pipe'],windowsHide:true});
  if(!broker||!Number.isSafeInteger(broker.pid)||!broker.stdio?.[3]||!broker.stdio?.[4]||!broker.stdio?.[5]||!broker.stdio?.[6])fail('HOST_LAUNCH_UNKNOWN');
  const next=lineReader(broker.stdio[3]);
  try{if(await within(()=>next(),readyMs,life.signal)!=='L')fail('HOST_LAUNCH_UNKNOWN');}
  catch(error){await close();throw error;}
  browserFailure=(async()=>{
   try{if(await next()!=='A')fail('HOST_LAUNCH_UNKNOWN');
    await check();if(closed)fail('HOST_LAUNCH_CANCELLED');broker.stdio[4].end('G');
   }catch(error){if(sdkRetiring)return;life.abort();try{await stopChild(broker,stopMs);}catch{}throw error;}
  })();browserFailure.catch(()=>{});
  return Object.freeze({descriptor,installation:installed,modelTransport:Object.freeze({readable:broker.stdio[6],writable:broker.stdio[6]}),failure:browserFailure,close});
 }
 function createSdkProcessClient(){
  if(closed||sdk||clientMade)fail('HOST_LAUNCH_REFUSED');clientMade=true;
  const input=new PassThrough({highWaterMark:65536}),output=new PassThrough({highWaterMark:65536}),events=new EventEmitter();
  events.on('error',()=>{});let requested,started=false,ended=false;
  const facade=Object.freeze({stdin:input,stdout:output,get killed(){return closed||ended;},
   get exitCode(){return sdk?.exitCode??null;},get signalCode(){return sdk?.signalCode??null;},
   kill(){void closeSdk().catch(()=>{});return true;},on:(...args)=>events.on(...args),once:(...args)=>events.once(...args),off:(...args)=>events.off(...args)});
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
    r.signal?.addEventListener('abort',()=>{void closeSdk().catch(()=>{});},{once:true});
    return facade;
   },
   async startPreparedProcess(){
    if(!requested||started||closed)fail('HOST_LAUNCH_REFUSED');started=true;
    try{
     sdkRelease=sdkLaunchGate.enter();
     sdk=await preparedProcess({s,helperPath,kind:'sdk',network:sdkNetwork,command:requested.command,args:requested.args,
      cwd:requested.cwd,home:requested.env.HOME??requested.cwd,browsersPath:requested.cwd,runUid:sdkUid,runGid:sdkGid,
      env:requested.env,spawnNative,readyMs,signal:life.signal,onPrepared:async value=>{
       await onSdkPrepared(value);await sdkHold?.arm({sdkLeaderPid:value.sdkLeaderPid,signal:life.signal});
      },check,
      onNetwork:sdkMode==='conversation'?network=>assertSdkModelRoute(requested.env,network):()=>{},
      onSpawn:child=>pendingChildren.add(child),onSettled:child=>pendingChildren.delete(child)});
     pendingChildren.delete(sdk);
     // The broker does not accept a shim until this one SDK leader PID arrives over a supervisor-only pipe.
     // It requires the shim's kernel PPid to equal this leader, in addition to UID/cgroup/executable pins.
     if(broker){if(broker.exitCode!==null||broker.signalCode!==null||!broker.stdio?.[5])fail('HOST_LAUNCH_UNKNOWN');
      broker.stdio[5].end(`${sdk.pid}\n`);}
     input.pipe(sdk.stdin);sdk.stdout.pipe(output);sdk.stderr.resume();
     sdk.on('exit',(code,sig)=>{ended=true;output.end();if(sdkRelease){sdkRelease();sdkRelease=undefined;}
      events.emit('exit',code,sig);void closeSdk().catch(()=>{});});
     sdk.on('error',error=>events.emit('error',error));
     return Object.freeze({started:true,leaderPid:sdk.pid});
    }catch(error){await close();throw error;}
   },close:closeSdk,
  });
 }
 async function sdkPhysicalHold(frozen){
  if(closed||!sdkHold||!sdk||sdk.exitCode!==null||sdk.signalCode!==null)fail('HOST_SDK_HOLD_UNKNOWN');
  try{
   await check();
   const result=await sdkHold[frozen?'freeze':'thaw']({signal:life.signal});
   await check();if(closed)fail('HOST_SDK_HOLD_UNKNOWN');return result;
  }catch(error){try{await close();}catch{}throw error;}
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
 return Object.freeze({scope:s,descriptor,prepareSdkRetirement,retireSdk,prepareSuccessor,prepareBrowserContext,prepareBrowserBroker,createSdkProcessClient,runReadinessProbe,close,
  freezeSdk:()=>sdkPhysicalHold(true),thawSdk:()=>sdkPhysicalHold(false),
  get signal(){return life.signal;}});
}

/** Browser-only native entrypoint for the AgentCore transport. Reuses the same
 * pre-exec network/currentness/observer handshake; creates no SDK, broker,
 * provider route or credentials. Workspace, recursive absence and host teardown
 * stay with their existing owners. Closing this child is not an absence proof. */
export function createBrowserOnlyHostLauncher(raw){
 const c=own(raw,['allocation','binding','hostIdentity','helperPath','browserNetwork','authority','browserUid','browserGid','onBrowserPrepared'],
  ['signal','spawnNative','readyMs','stopMs','now']);
 const s=scope(c),authority=authorities([c.authority])[0],spawnNative=c.spawnNative??spawn,
  readyMs=c.readyMs??5000,stopMs=c.stopMs??5000,now=c.now??Date.now;
 if(s.allocation.hostMode!=='browser-only')fail('HOST_LAUNCH_CONFIGURATION');
 if(!absolute(c.helperPath)||!uid(c.browserUid)||!uid(c.browserGid)||typeof c.onBrowserPrepared!=='function'||
  typeof spawnNative!=='function'||typeof now!=='function'||!maxMs(readyMs)||!maxMs(stopMs))fail('HOST_LAUNCH_CONFIGURATION');
 nativeSignal(c.signal);if(c.signal?.aborted)fail('HOST_LAUNCH_CANCELLED');
 const owner=new AbortController(),pending=new Set();let browser,closed=false,taken=false,closing;
 const check=async()=>{
  if(closed||owner.signal.aborted||now()>=s.allocation.leaseDeadlineMs)fail('HOST_LAUNCH_EXPIRED');
  const receipt=await within(signal=>authority.readCurrent({allocation:s.allocation,binding:s.binding,policySha256:authority.policySha256,signal}),readyMs,owner.signal);
  assertBrowserHostCurrent({allocation:s.allocation,binding:s.binding,policySha256:authority.policySha256,current:receipt,nowMs:now(),maxFreshMs:authority.maxFreshMs});
  if(closed||owner.signal.aborted)fail('HOST_LAUNCH_CANCELLED');
 };
 const abort=()=>{void close().catch(()=>{});};
 function close(){
  if(closing)return closing;closed=true;owner.abort();c.signal?.removeEventListener('abort',abort);
  closing=(async()=>{
   const results=await Promise.allSettled([...new Set([browser,...pending].filter(Boolean))].map(child=>stopChild(child,stopMs)));
   if(results.some(result=>result.status==='rejected'))fail('HOST_LAUNCH_CLEANUP_UNKNOWN');
   return Object.freeze({closed:true,processAbsenceProven:false});
  })();return closing;
 }
 c.signal?.addEventListener('abort',abort,{once:true});
 return Object.freeze({get signal(){return owner.signal;},close,async prepareBrowserContext(input){
  if(closed||taken)fail('HOST_LAUNCH_REFUSED');taken=true;
  const q=own(input,['policy','installation','paths']),installed=validateBrowserContextInstallation(q.installation),policy=validateBrowserPolicy(q.policy),paths=q.paths;
  if(!policy.enabled||canonicalSha256(policy)!==authority.policySha256)fail('HOST_LAUNCH_CONFIGURATION');
  const command=playwrightHostCommand(policy,installed,paths);
  if(!absolute(command.args[0])||![paths.home,paths.profile,paths.output].every(absolute)||
   installed.egressProxy!==`http://127.0.0.1:${c.browserNetwork?.plan?.routes?.[0]?.localPort}`)fail('HOST_LAUNCH_CONFIGURATION');
  try{
   browser=await preparedProcess({s,helperPath:c.helperPath,kind:'browser',network:c.browserNetwork,
    command:command.command,args:command.args,cwd:paths.home,home:paths.home,browsersPath:installed.browsersPath,
    runUid:c.browserUid,runGid:c.browserGid,env:{},spawnNative,readyMs,signal:owner.signal,check,
    onPrepared:({leaderPid})=>c.onBrowserPrepared({leaderPid,kind:'browser'}),
    onSpawn:child=>pending.add(child),onSettled:child=>pending.delete(child)});
   pending.delete(browser);if(closed||owner.signal.aborted)fail('HOST_LAUNCH_CANCELLED');
   return Object.freeze({installation:installed,readable:browser.stdout,writable:browser.stdin,close});
  }catch(error){try{await close();}catch{fail('HOST_LAUNCH_CLEANUP_UNKNOWN');}throw error;}
 }});
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
