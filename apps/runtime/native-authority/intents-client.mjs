/** P-INT-9, runner side: the worker's `governedIntents` port (`apps/worker/conversation/intents/runtime.mjs`) over the private
 * task-authorized control routes served by `intents-http.mjs`. Mirrors `reads-client.mjs`: fixed https origin, the run's task
 * capability as Bearer, this run's binding in every body, bounded streamed responses, no redirects, no retries.
 *
 * Returns exactly `{readAvailability({signal}), prepare({operation,arguments,deliveryId,signal})}` (the worker port shape).
 * Failure codes are the intent mount's closed codes. A control answer carries its own code; a local transport loss, timeout or
 * malformed answer is UNAVAILABLE before `prepare` was sent and UNKNOWN after (a proposal or draft may exist; the worker never
 * repeats an UNKNOWN delivery, and the control journal replays the same delivery without a second preparation).
 *
 * Construction is inert: no request, timer or credential read. `enabled` defaults to false (every call UNAVAILABLE). */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {INTENT_AVAILABILITY_RUNNER_MS} from '../../../packages/runtime/runner-load-budget.mjs';
import catalog from '../../../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {INTENT_ROWS} from '../../worker/conversation/intents/catalog.mjs';
/* Shared wire protocol (this module imports only packages/*, so the runner image gains one file; intents-http.mjs reuses it). */
/** Closed transport failures and their statuses: the intent mount's codes plus RESOURCE_LIMIT for an over-limit body. */
export const RUNNER_INTENT_FAILURES=Object.freeze({UNAVAILABLE:503,ACCESS_DENIED:403,REFUSED:409,INVALID_ARGUMENTS:400,DEADLINE:408,CANCELLED:408,CONFLICT:409,UNKNOWN:502,RESOURCE_LIMIT:413});
export const RUNNER_INTENT_PATHS=Object.freeze({availability:'/v1/runner/intents/availability',prepare:'/v1/runner/intents/prepare'});
export const runnerIntentFault=code=>Object.assign(new Error(code),{code:Object.hasOwn(RUNNER_INTENT_FAILURES,code)?code:'UNAVAILABLE'});
/** The closed code an error carries as an own data property, or null. Never runs accessors or proxy traps. */
export const runnerIntentCode=error=>{const code=error!==null&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;return typeof code==='string'&&Object.hasOwn(RUNNER_INTENT_FAILURES,code)?code:null;};
// An availability snapshot can name at most every intent the worker catalog mounts: the client-scoped composition
// mounts all of them (General omits the attachment filing intent), so the bound is the catalog itself, not a literal.
const OPERATION=/^[a-z][a-z_]{0,62}$/u,DELIVERY=/^sdk:[a-f0-9]{64}$/u,MAX_OPERATIONS=INTENT_ROWS.length;
/** The canonical authority for an admissible intent operation version: the catalog owner's own resolver, so an exact
 * `id@version` is admitted only when it resolves to its registered descriptor and immutable schema. The retained 0.2
 * reference and the current 0.3 successor both pass; an unregistered version or unknown id still refuses. Neither a
 * version regex nor a copied version list decides here. */
const registered=operation=>{try{resolveOperationContract(operation);return true;}catch{return false;}};
/** Names the catalog itself publishes as deferred originals: declared capabilities with no operation contract at any
 * version. A port may honestly report one in its availability facts (it is not an operation, so it never becomes a
 * visible tool), and refusing the whole snapshot over it would withhold every intent the port does back. Derived from
 * the catalog's own `originals`/`disposition` data, so this is the same authority, not a copied list. */
const declaredOriginals=new Set(catalog.originals.filter(o=>o.disposition==='deferred').map(o=>o.id));
const admissible=operation=>registered(operation)||declaredOriginals.has(operation.id);
/** Shared closed request admission (also used by the runner client before dispatch). */
export function runnerIntentRequest(route,value){
 let v;try{v=data(own(value,route==='availability'?['binding']:['binding','operation','arguments','deliveryId']));validateShape('RunBinding',v.binding);}catch{throw runnerIntentFault('INVALID_ARGUMENTS');}
 if(route==='prepare'){
  try{own(v.operation,['id','version']);}catch{throw runnerIntentFault('INVALID_ARGUMENTS');}
  if(typeof v.operation.id!=='string'||!OPERATION.test(v.operation.id)||!registered(v.operation)||typeof v.deliveryId!=='string'||!DELIVERY.test(v.deliveryId)||
   v.arguments===null||typeof v.arguments!=='object'||Array.isArray(v.arguments))throw runnerIntentFault('INVALID_ARGUMENTS');
 }
 return v;
}
/** The availability facts a mount may release: this run's binding, closed operations, an unexpired window. Anything else refuses. */
export function runnerIntentAvailability(raw,binding,at){
 try{
  const s=data(own(raw,['binding','operations','checkedAtMs','expiresAtMs']));
  if(hash(s.binding)!==hash(binding)||!Array.isArray(s.operations)||s.operations.length>MAX_OPERATIONS||!Number.isSafeInteger(s.checkedAtMs)||!Number.isSafeInteger(s.expiresAtMs)||s.checkedAtMs>at||s.expiresAtMs<=at)throw 0;
  for(const o of s.operations){own(o,['id','version']);if(typeof o.id!=='string'||!OPERATION.test(o.id)||!admissible(o))throw 0;}
  return s;
 }catch{throw runnerIntentFault('UNAVAILABLE');}
}
const get=Object.fromEntries(['status','headers','body','redirected','url'].map(k=>[k,Object.getOwnPropertyDescriptor(Response.prototype,k).get]));
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
/** A control-reported failure, kept apart from local transport failures. */
class ControlAnswer extends Error{constructor(code){super(code);this.code=code;}}
export function createRunnerIntentsClient(configuration){
 const c=own(configuration,['origin','credential','binding','fetchImpl'],['enabled','now','limits']),now=c.now??Date.now,enabled=c.enabled??false;let binding,origin;
 const limits=c.limits===undefined?{maxRequestBytes:65536,maxResponseBytes:262144,maxPrepareMs:30000}:own(c.limits,['maxRequestBytes','maxResponseBytes','maxPrepareMs']);
 try{const u=new URL(c.origin);if(u.protocol!=='https:'||u.pathname!=='/'||u.username||u.password||u.search||u.hash||u.origin!==c.origin)throw 0;origin=u.origin;}catch{throw runnerIntentFault('UNAVAILABLE');}
 try{binding=data(c.binding);validateShape('RunBinding',binding);}catch{throw runnerIntentFault('UNAVAILABLE');}
 if(typeof c.credential!=='string'||!/^\S{1,8192}$/u.test(c.credential)||typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)||typeof now!=='function'||typeof enabled!=='boolean'||
  !integer(limits.maxRequestBytes,1,1048576)||!integer(limits.maxResponseBytes,1,2097152)||!integer(limits.maxPrepareMs,1000,60000))throw runnerIntentFault('UNAVAILABLE');
 const fetchImpl=c.fetchImpl,credential=c.credential;
 async function call(route,fields,signal){
  if(!enabled)throw runnerIntentFault('UNAVAILABLE');nativeSignal(signal);
  const request=runnerIntentRequest(route,{binding,...fields}),body=JSON.stringify(request),url=origin+'/v1/runner/intents/'+route;
  if(Buffer.byteLength(body,'utf8')>limits.maxRequestBytes)throw runnerIntentFault('RESOURCE_LIMIT');
  // Availability keeps the shared runner bound (one control margin above control's own), so control answers before this client gives up.
  const life=createOperationLifetime({now,deadlineMs:now()+(route==='prepare'?limits.maxPrepareMs:INTENT_AVAILABILITY_RUNNER_MS),signal,errorFactory:runnerIntentFault});let response,reader,dispatched=false;
  try{
   dispatched=true;response=await life.run(signal=>{const pending=Promise.resolve(fetchImpl(url,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body,signal}));pending.then(r=>{if(life.signal.aborted)try{get.body.call(r)?.cancel().catch(()=>{});}catch{}},()=>{});return pending;});
   if(types.isProxy(response)||!(response instanceof Response)||get.redirected.call(response))throw 0;const responseUrl=get.url.call(response);if(responseUrl&&responseUrl!==url)throw 0;
   const headers=get.headers.call(response),header=k=>Headers.prototype.get.call(headers,k),stream=get.body.call(response);
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding'))||!stream)throw 0;
   const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>limits.maxResponseBytes))throw 0;
   reader=stream.getReader();let bytes=0;const chunks=[];
   while(true){const part=await life.run(()=>reader.read());if(part.done)break;if(!(part.value instanceof Uint8Array))throw 0;bytes+=part.value.byteLength;if(bytes>limits.maxResponseBytes)throw 0;chunks.push(part.value);}
   if(length!==null&&bytes!==Number(length))throw 0;
   const raw=data(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))));
   if(get.status.call(response)!==200){own(raw,['error']);own(raw.error,['code']);const code=raw.error.code;
    if(typeof code!=='string'||!Object.hasOwn(RUNNER_INTENT_FAILURES,code)||RUNNER_INTENT_FAILURES[code]!==get.status.call(response))throw 0;throw new ControlAnswer(code);}
   life.check();return raw;
  }catch(error){
   // `layer` names where the closed failure was decided (control's answer or this client's own bound/transport); the worker's
   // availability diagnostic prints it, so a DEADLINE is attributable to the hop that reached its bound.
   if(error instanceof ControlAnswer)throw Object.assign(runnerIntentFault(error.code),{layer:'control'});
   // Nothing reached control's mount, or control's answer was lost or malformed after a prepare was sent.
   const code=runnerIntentCode(error);
   throw Object.assign(runnerIntentFault(route==='prepare'&&dispatched?'UNKNOWN':code==='DEADLINE'||code==='CANCELLED'?code:'UNAVAILABLE'),{layer:'runner'});
  }
  finally{try{if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}else if(response&&!types.isProxy(response)&&response instanceof Response)void get.body.call(response)?.cancel().catch(()=>{});}catch{}life.close();}
 }
 return Object.freeze({
  async readAvailability(value={}){let signal;try{({signal}=own(value,[],['signal']));}catch{throw runnerIntentFault('INVALID_ARGUMENTS');}const raw=await call('availability',{},signal);return runnerIntentAvailability(raw,binding,now());},
  async prepare(value){let signal,fields;try{({signal,...fields}=own(value,['operation','arguments','deliveryId'],['signal']));}catch{throw runnerIntentFault('INVALID_ARGUMENTS');}
   const raw=await call('prepare',fields,signal);if(raw===null||typeof raw!=='object'||Array.isArray(raw))throw runnerIntentFault('UNKNOWN');return raw;},
 });
}
