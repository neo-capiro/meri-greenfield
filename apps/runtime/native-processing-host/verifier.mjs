/** ACTUAL native host custody verifier: protected bootstrap uses THIS, never an injected positive object. It binds the
 * authenticated peer, canonical native allocation/binding/identity, the saved upload custody projection and the EXISTING
 * saved-upload current authority. The returned authority port RE-CHECKS on every use (no cached grant), is bounded by the
 * operation deadline/lease/peer lifetime and refuses after cancellation. Nothing credential-like is serialized. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {assertNativeUploadCustody} from '../uploads/native-host-contract.mjs';
import {assertHostRunBinding,assertNativeProcessingAllocation,assertD005HostIdentity} from '../../worker/conversation/host/binding.mjs';
import {assertNativeHostCurrent} from '../../worker/conversation/host/binding.mjs';

const fault=code=>{throw Object.assign(new Error(code),{code});};
const faultOf=code=>Object.assign(new Error(code),{code});
const MAX_FRESH_MS=30000;
const CLEANUP_WINDOW_MS=5000;
const TIMEOUT=Symbol('timeout');
/** One bounded wait with its timer always cleared; `ok:false` carries the operation's own refusal. */
async function raceUntil(promise,at,now){
 let timer;
 const work=Promise.resolve(promise).then(value=>({ok:true,value}),error=>({ok:false,error}));
 const stop=new Promise(resolve=>{timer=setTimeout(()=>resolve(TIMEOUT),Math.max(1,at-now()));});
 try{
  const raced=await Promise.race([work,stop]);
  return raced===TIMEOUT?{ok:false,error:faultOf('NATIVE_PROCESSING_CANCELLED'),timedOut:true}:raced;
 }finally{clearTimeout(timer);}
}
/** Closures only count as established when the client actually exposes close and it settled non-negative. */
async function closeEstablished(client,at,now){
 if(typeof client?.close!=='function')return false;
 let closing;
 try{closing=Promise.resolve(client.close());}catch{return false;}
 closing.catch(()=>{});                       // own a late rejection even if we stop waiting
 const raced=await raceUntil(closing,at,now);
 if(raced.ok!==true)return false;
 // The canonical acknowledgement is EXACTLY {closed:true}; undefined, {}, numbers, strings and wrong types never count.
 const outcome=raced.value;
 return typeof outcome==='object'&&outcome!==null&&outcome.closed===true;
}
/** One absolute cleanup budget that begins when cleanup starts; a late arrival is closed under the SAME budget. */
async function settleCleanup(acquisition,now,closeClient){
 const cleanupAt=now()+CLEANUP_WINDOW_MS;
 const late=await raceUntil(acquisition,cleanupAt,now);
 if(late.ok===true)return closeClient(late.value,cleanupAt);
 if(late.ok===false&&late.timedOut!==true)return 'rejected';
 if(late.timedOut===true){
  // Owned continuation: an eventual client is closed exactly once and its rejection observed, with no new timer/window.
  acquisition.then(client=>{Promise.resolve().then(()=>client?.close?.()).catch(()=>{});}).catch(()=>{});
  return false;
 }
 return false;
}
export function createNativeProcessingVerifier({createClient,now=Date.now,peerMaxLifetimeMs=900000,
 maxFreshMs=MAX_FRESH_MS,policySha256}={}){
 if(typeof createClient!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxFreshMs)||
  maxFreshMs<1||maxFreshMs>MAX_FRESH_MS||typeof policySha256!=='string'||!/^[a-f0-9]{64}$/u.test(policySha256))
  fault('NATIVE_PROCESSING_VERIFIER_CONFIGURATION');
 return Object.freeze(async function verifyCustody({allocation,binding,hostIdentity,custody,request,peer,deadlineMs,signal}={}){
  if(signal?.aborted===true)fault('NATIVE_PROCESSING_CANCELLED');
  if(peer?.verified!==true)fault('NATIVE_INSPECTION_PEER');
  if(!Number.isSafeInteger(peer.notAfterMs)||peer.notAfterMs<=now())fault('NATIVE_INSPECTION_PEER');
  if(typeof peer.fingerprintSha256!=='string'||!/^[a-f0-9]{64}$/u.test(peer.fingerprintSha256))fault('NATIVE_INSPECTION_PEER');
  const native=assertNativeProcessingAllocation(allocation),bound=assertHostRunBinding(native,binding);
  const identity=assertD005HostIdentity(hostIdentity,bound,native);
  if(native.leaseDeadlineMs<=now())fault('NATIVE_PROCESSING_ALLOCATION_REFUSED');
  if(request.imageDigest!==native.imageDigest)fault('NATIVE_INSPECTION_CUSTODY_REFUSED');
  assertNativeUploadCustody(custody,{binding:bound,declaration:request.declaration});
  if(custody.owner.tenantId!==bound.tenantId||custody.owner.actorId!==bound.actorId||
   custody.owner.conversationId!==bound.conversationId)fault('NATIVE_INSPECTION_CUSTODY_REFUSED');
  if(custody.sha256!==request.declaration.sha256||custody.bytes!==request.declaration.bytes)
   fault('NATIVE_INSPECTION_CUSTODY_REFUSED');
  const started=now();
  const requested=Number.isSafeInteger(deadlineMs)?deadlineMs:started+maxFreshMs;
  const ceiling=Math.min(requested,native.leaseDeadlineMs,peer.notAfterMs,started+peerMaxLifetimeMs);
  if(ceiling<=started)fault('NATIVE_PROCESSING_CANCELLED');
  const check=async()=>{
   if(signal?.aborted===true)fault('NATIVE_PROCESSING_CANCELLED');
   const at=now();
   if(at>=ceiling||native.leaseDeadlineMs<=at||peer.notAfterMs<=at)fault('NATIVE_PROCESSING_CANCELLED');
  };
  // ONE actual authenticated native currentness read through a bounded client; the client is closed in `finally` and the
  // receipt is validated by the SAME canonical guard the native launcher uses.
  const freshRead=async until=>{
   await check();
   const started=now();
   if(until<=started)fault('NATIVE_PROCESSING_CANCELLED');
   const life=createOperationLifetime({deadlineMs:until,now,signal,errorFactory:()=>faultOf('NATIVE_PROCESSING_CANCELLED')});
   try{
    // Invocation happens AFTER the lifetime's pre-invocation check; the raw promise is kept for cleanup.
    const acquisition=(async()=>{life.check();return createClient({allocation:native,binding:bound,hostIdentity:identity});})();
    acquisition.catch(()=>{});
    const closeClient=(client,at)=>closeEstablished(client,at,now);
    // Normal work is bounded ONLY by the operation deadline (no 5 s cap on valid work).
    // Awaited under the SHARED lifetime so caller abort settles immediately; the raw promise is kept for late cleanup.
    let client;
    try{client=await life.run(()=>acquisition);}
    catch(error){
     const settled=await settleCleanup(acquisition,now,closeClient);
     if(settled==='rejected')throw faultOf('NATIVE_PROCESSING_VERIFIER_CONFIGURATION');
     if(settled!==true)throw faultOf('NATIVE_PROCESSING_CLEANUP_UNKNOWN');
     throw error;
    }
    if(typeof client?.readNativeCurrentness!=='function'){
     const established=await settleCleanup(Promise.resolve(client),now,closeClient);
     throw established?faultOf('NATIVE_PROCESSING_VERIFIER_CONFIGURATION')
      :faultOf('NATIVE_PROCESSING_CLEANUP_UNKNOWN');
    }
    const read=await raceUntil(life.run(()=>{
     life.check();
     return client.readNativeCurrentness({custody,declaration:request.declaration,policySha256,signal:life.signal,
      deadlineMs:until});
    }),until,now);
    const established=await settleCleanup(Promise.resolve(client),now,closeClient);
    if(!established)throw faultOf('NATIVE_PROCESSING_CLEANUP_UNKNOWN');
    if(read.ok!==true)throw read.error;
    await check();
    assertNativeHostCurrent({allocation:native,binding:bound,policySha256,current:read.value,nowMs:now(),maxFreshMs});
    return Object.freeze({allocation:native,binding:bound,policySha256,phase:read.value.phase,
     checkedAtMs:read.value.checkedAtMs,currentUntilMs:Math.min(until,read.value.currentUntilMs)});
   }finally{life.close();}
  };
  const initial=await freshRead(ceiling);
  const currentUntilMs=initial.currentUntilMs;
  if(currentUntilMs<=now())fault('NATIVE_INSPECTION_CUSTODY_REFUSED');
  // Every use is a FRESH authenticated read; nothing is cached and no checkedAtMs is synthesized.
  const readCurrent=Object.freeze(async function readCurrent(){
   const fresh=await freshRead(Math.min(ceiling,now()+maxFreshMs));
   if(fresh.currentUntilMs<=now())fault('NATIVE_INSPECTION_CUSTODY_REFUSED');
   return fresh;
  });
  return Object.freeze({authorized:true,allocation:native,binding:bound,hostIdentity:identity,
   currentness:Object.freeze({readCurrent,policySha256,maxFreshMs}),readCurrent,currentUntilMs,checkedAtMs:now(),policySha256,maxFreshMs,
   peerFingerprintSha256:peer.fingerprintSha256});
 });
}
