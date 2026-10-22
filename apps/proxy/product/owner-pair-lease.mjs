/** Process-local owner/proxy proof leases. The holder is the sole discovery caller.
 * AWS observations, never request fields, advance a generation. Import is inert. */
import {performance} from 'node:perf_hooks';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {currentTurnTelemetry} from '../../runtime/telemetry/turn-context.mjs';
import {health} from './owner-diagnostics.mjs';

export const PAIR_LEASE_TTL_MS=30000;
export const PAIR_RENEW_MS=10000;
export const PAIR_REPROOF_MS=30000;
export const PAIR_REPROOFS_PER_10_MIN=3;
export const CARRIER_RESETS_PER_MIN=3;
export const ADMISSION_LEASE_MS=10000;
export const PAIR_RENEWER_QUARANTINE_COOLDOWN_MS=30000;
const RENEW_JITTER_MS=1000,RETRY_MIN_MS=1000,REPROOF_WINDOW_MS=10*60000;
if(PAIR_LEASE_TTL_MS<2*PAIR_RENEW_MS)throw Error('PAIR_CONFIGURATION');
export function pairFailure(code='PAIR_UNAVAILABLE'){const error=Error(code);error.code=code;return error;}
const refuse=code=>{throw pairFailure(code);};
const identity=value=>JSON.stringify([value.taskArn,value.privateIpv4Address,value.networkInterfaceId,value.createdAtMs]);
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;

/** Explicit start/close; discovery factories borrow (and do not dispose) SDK clients.
 * Subscribers synchronously close all sockets/sessions before a replacement is installed.
 * A completed post-handshake proof is the only operation that admits that replacement. */
export async function createOwnerPairLease({pins,createDiscovery,now=Date.now,monotonicNow=()=>performance.now(),
 maxLeaseMs=PAIR_LEASE_TTL_MS,maxRequestMs,enabled=true,schedule=setTimeout,unschedule=clearTimeout,
 random=Math.random,telemetry=currentTurnTelemetry(),writeDiagnostic=line=>process.stderr.write(line)}){
 if(typeof createDiscovery!=='function'||typeof now!=='function'||typeof monotonicNow!=='function'||
    !Number.isSafeInteger(maxLeaseMs)||maxLeaseMs<2*PAIR_RENEW_MS||maxLeaseMs>PAIR_LEASE_TTL_MS||
    !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||typeof enabled!=='boolean'||
    ![schedule,unschedule,random,writeDiagnostic].every(value=>typeof value==='function'))refuse();
 const configuration=data(pins),listeners=new Set(),seenPartners=new Set(),reproofs=[];
 let discovery=await createDiscovery(),lease=null,ownIdentity=null,partnerIdentity=null,generation=0,closed=false,retired=false,
  reprovingAt=null,quarantineUntil=null,timer=null,running=false,tail=Promise.resolve(),pending=0;
 const stop=new AbortController();
 function clocks(){const wall=now(),mono=monotonicNow();if(!Number.isSafeInteger(wall)||wall<0||!finite(mono))refuse();return {wall,mono};}
 function alive(){const {wall}=clocks();if(!enabled||closed)refuse();if(retired)refuse('PAIR_DRIFT');if(wall>=configuration.expiresAtMs)refuse();}
 function notify(reason,previous){
  for(const listener of listeners){try{listener(reason,previous);}catch{retire();refuse('PAIR_DRIFT');}}
 }
 function retire(){
  if(retired||closed)return;
  retired=true;const old=lease;lease=null;reprovingAt=null;
  if(timer!==null){unschedule(timer);timer=null;}
  stop.abort(pairFailure('PAIR_DRIFT'));
  // A broken subscriber must never prevent the remaining resources closing.
  for(const listener of listeners)try{listener('retired',old);}catch{}
  health('pair','retired','PAIR_DRIFT',telemetry);
 }
 function valid(value=lease){
  alive();const {wall,mono}=clocks();
  if(!value||value.generation!==generation||!lease||value.generation!==lease.generation||
     mono>=lease.expiresAtMonoMs||wall>=lease.expiresAtMs)refuse();
  return lease;
 }
 function install(pair,proofStartedAtMonoMs){
  alive();const {wall,mono}=clocks();
  if(!pair||!pair.owner||!pair.proxy||!Number.isSafeInteger(pair.checkedAtMs)||
     pair.checkedAtMs>wall||!Number.isSafeInteger(pair.expiresAtMs)||pair.expiresAtMs<=wall)refuse();
  if(ownIdentity!==null){
   if(identity(pair.owner)!==ownIdentity){retire();refuse('PAIR_DRIFT');}
   if(identity(pair.proxy)!==identity(partnerIdentity)){
    if(pair.proxy.createdAtMs<partnerIdentity.createdAtMs||seenPartners.has(pair.proxy.taskArn)){
     retire();refuse('PAIR_DRIFT');
    }
    while(reproofs.length&&reproofs[0]<=mono-REPROOF_WINDOW_MS)reproofs.shift();
    if(reproofs.length>=PAIR_REPROOFS_PER_10_MIN){retire();refuse('PAIR_DRIFT');}
    reproofs.push(mono);
    const old=lease;lease=null;reprovingAt=mono;
    notify('replacement',old); // Old generation is unusable before any callback runs.
    alive();generation++;
   }
  }else if(generation===0)generation=1;
  // Map the observed absolute expiry once; a wall-clock rollback cannot extend this TTL.
  const ttl=Math.min(maxLeaseMs,pair.expiresAtMs-wall,configuration.expiresAtMs-wall);
  if(ttl<=0)refuse();
  ownIdentity??=identity(pair.owner);partnerIdentity=data(pair.proxy);seenPartners.add(pair.proxy.taskArn);
  lease=data({schemaVersion:1,deploymentRevision:configuration.deploymentRevision,
   ownerTaskArn:pair.owner.taskArn,proxyTaskArn:pair.proxy.taskArn,
   ownerPrivateIpv4Address:pair.owner.privateIpv4Address,proxyPrivateIpv4Address:pair.proxy.privateIpv4Address,
   ownerCertSha256:configuration.ownerCertSha256,proxyCertSha256:configuration.proxyCertSha256,
   owner:pair.owner,proxy:pair.proxy,generation,proofStartedAtMonoMs,
   checkedAtMs:pair.checkedAtMs,expiresAtMs:Math.min(pair.expiresAtMs,configuration.expiresAtMs),
   checkedAtMonoMs:mono,expiresAtMonoMs:mono+ttl});
  return lease;
 }
 async function discover(request,life){
  alive();life.check();const {mono}=clocks();
  if(quarantineUntil!==null){
   if(mono<quarantineUntil)refuse();
   discovery=await life.run(()=>createDiscovery());quarantineUntil=null;
  }
  const proofStartedAtMonoMs=monotonicNow();
  try{
   const pair=await discovery.read({deadlineMs:request.deadlineMs,signal:life.signal});
   life.check();return install(pair,proofStartedAtMonoMs);
  }catch(error){
   if(discovery.available===false&&quarantineUntil===null)quarantineUntil=monotonicNow()+PAIR_RENEWER_QUARANTINE_COOLDOWN_MS;
   // Startup retains its existing bounded pair wait: no established identity exists yet.
   if(error?.code==='PAIR_DRIFT'&&generation>0){retire();throw error;}
   throw error?.code==='PAIR_DRIFT'?error:pairFailure();
  }
 }
 async function read(raw){
  const request=own(raw,['deadlineMs'],['signal']);nativeSignal(request.signal);alive();
  const life=createOperationLifetime({now,deadlineMs:request.deadlineMs,signal:request.signal,errorFactory:()=>pairFailure()});
  const abort=()=>life.close();stop.signal.addEventListener('abort',abort,{once:true});
  const before=tail;pending++;
  // Queue ownership is retained even when an individual waiter times out. Its callback
  // observes its closed lifetime and cannot start a late discovery.
  const work=before.then(()=>{life.check();return discover(request,life);});
  tail=work.catch(()=>{});
  try{return await life.run(()=>work);}
  catch(error){if(retired)throw pairFailure('PAIR_DRIFT');throw error;}
  finally{pending--;stop.signal.removeEventListener('abort',abort);life.close();}
 }
 async function ensure(raw){
  const request=own(raw,['deadlineMs'],['signal']);nativeSignal(request.signal);
  if(request.signal?.aborted||!Number.isSafeInteger(request.deadlineMs)||request.deadlineMs<=now())refuse();
  try{return valid();}catch(error){if(error.code==='PAIR_DRIFT')throw error;return read(request);}
 }
 async function proveConnection(raw){
  const r=own(raw,['generation','localAddress','remoteAddress','handshakeAtMonoMs','deadlineMs'],['signal']);
  if(!finite(r.handshakeAtMonoMs)||r.handshakeAtMonoMs>monotonicNow())refuse();
  const before=valid();
  if(r.generation!==before.generation||r.localAddress!==before.ownerPrivateIpv4Address||r.remoteAddress!==before.proxyPrivateIpv4Address)refuse();
  const result=await read({deadlineMs:r.deadlineMs,signal:r.signal});
  if(result.generation!==before.generation||identity(result.owner)!==identity(before.owner)||identity(result.proxy)!==identity(before.proxy)||
     result.proofStartedAtMonoMs<r.handshakeAtMonoMs)refuse();
  valid(result);
  if(reprovingAt!==null){reprovingAt=null;health('pair','reproven','PAIR_REPROVEN',telemetry);
   try{writeDiagnostic('PRODUCT_OWNER_PAIR_REPROVEN\n');}catch{}}
  return result;
 }
 function available(){try{alive();return true;}catch{return false;}}
 function ready(){try{alive();if(reprovingAt!==null)return monotonicNow()-reprovingAt<PAIR_REPROOF_MS;valid();return true;}catch{return false;}}
 function scheduleNext(delay){
  if(!running||closed||retired||now()>=configuration.expiresAtMs)return;
  timer=schedule(()=>{timer=null;void renew();},delay);timer?.unref?.();
 }
 const jitter=()=>Math.max(-1,Math.min(1,2*random()-1))*RENEW_JITTER_MS;
 async function renew(){
  let unavailable=false;const begun=monotonicNow();
  try{
   const run=()=>read({deadlineMs:Math.min(configuration.expiresAtMs,now()+maxRequestMs)});
   await (telemetry?.background?telemetry.background(run):run());
  }catch{unavailable=true;}
  // Start-to-start period, with no overlapping discovery and at least a 1s retry delay.
  scheduleNext(unavailable?Math.max(RETRY_MIN_MS,RETRY_MIN_MS+jitter()):Math.max(RETRY_MIN_MS,PAIR_RENEW_MS+jitter()-(monotonicNow()-begun)));
 }
 return Object.freeze({
  get available(){return available();},get retired(){return retired;},get ready(){return ready();},
  get generation(){return generation;},get reproving(){return reprovingAt!==null;},
  get quarantined(){return quarantineUntil!==null;},get pending(){return pending;},
  nowMono:monotonicNow,current:()=>valid(),read,ensure,proveConnection,
  assertConnection(binding){const current=valid(binding);if(reprovingAt!==null)refuse('PAIR_REPROVING');return current;},
  subscribe(listener){if(typeof listener!=='function')refuse();listeners.add(listener);return ()=>listeners.delete(listener);},
  start(){alive();if(!running){running=true;scheduleNext(PAIR_RENEW_MS+jitter());}},
  retire,
  async close(){if(closed)return;closed=true;running=false;if(timer!==null)unschedule(timer);timer=null;
   const old=lease;lease=null;stop.abort(pairFailure());for(const listener of listeners)try{listener('closed',old);}catch{}
   await tail;listeners.clear();},
 });
}
