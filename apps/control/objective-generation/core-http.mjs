/**
 * Fixed initial Objective-generation Core transport. Core owns the original job,
 * native/Clerk delegation, typed request and current acceptance decision. This
 * adapter only carries a bounded reply; `unqualified-response` grants no authority.
 *
 * The injected credential owner must verify the original native/Clerk delegation
 * and issue an operation-, phase-, route-, method-, body- and source-bound bearer.
 * Its echoes are checked here before dispatch and again before reply release.
 * The second callback must revalidate the same issuer-minted token and current
 * delegation; it must not mint a fresh jti for that operation recheck.
 * No response decoder or product composition is enabled until Core publishes its
 * closed response contract. No ambient credential or Core route is discovered.
 */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {uuid,storageMethod} from '../../artifacts/storage/boundary.mjs';
import {jsonBody} from '../action-application/http.mjs';
import {ProductError} from '../product-access/errors.mjs';

const operation='objective.strategy.draft';
const routes=Object.freeze({
 admit:'/strategy-api/internal/objective-canonical/generation-admissions',
 publish:'/strategy-api/internal/objective-canonical/generation-requests',
 accept:'/strategy-api/internal/objective-canonical/generation-acceptances',
 // Core PR66: Nest POST 201 / GET 200, same generation-worker subject and body.
 complete:'/strategy-api/internal/objective-canonical/generation-completions',
});
const readRoutes=Object.freeze({
 'admission-read':routes.admit,
 'request-read':routes.publish,
 'completion-read':routes.complete,
});
const getters=Object.fromEntries(['status','headers','body','redirected'].map(key=>[key,Object.getOwnPropertyDescriptor(Response.prototype,key).get]));
const unavailable=()=>({kind:'unavailable'});
const fault=()=>new ProductError('OBJECTIVE_GENERATION_CORE_UNAVAILABLE');
const refuse=()=>{throw fault();};
const sha256Utf8=value=>createHash('sha256').update(value,'utf8').digest('hex');
function cancel(response){try{if(response&&!types.isProxy(response)&&response instanceof Response)Promise.resolve(getters.body.call(response)?.cancel()).catch(()=>{});}catch{}}

export function createCoreObjectiveGenerationTransport(configuration){
 let source,origin,fetchImpl,readCredential,enabled,now,maxRequestMs,maxFactBytes;
 try{
  const c=own(configuration,['source','origin','fetchImpl','authorization'],['enabled','now','maxRequestMs','maxFactBytes']);
  source=data(own(c.source,['generationJobId','binding']));uuid(source.generationJobId);validateShape('RunBinding',source.binding);
  const base=new URL(c.origin);
  if(typeof c.origin!=='string'||base.protocol!=='https:'||base.pathname!=='/'||base.username||base.password||base.search||base.hash||base.origin!==c.origin)refuse();
  origin=base.origin;fetchImpl=c.fetchImpl;readCredential=c.authorization===null?null:storageMethod(c.authorization,'readCredential');enabled=c.enabled??false;now=c.now??Date.now;maxRequestMs=c.maxRequestMs??3000;maxFactBytes=c.maxFactBytes??131072;
  if(typeof fetchImpl!=='function'||types.isProxy(fetchImpl)||typeof enabled!=='boolean'||typeof now!=='function'||types.isProxy(now)||
   !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxFactBytes)||maxFactBytes<1||maxFactBytes>1048576)refuse();
 }catch{refuse();}
 const sourceSha256=canonicalSha256(source),identity=data({schemaVersion:1,generationJobId:source.generationJobId}),body=JSON.stringify(identity),requestSha256=canonicalSha256(identity);
 // Transport configuration only. It is not generation admission/readiness.
 const available=()=>enabled&&readCredential!==null;

 async function send(phase,value){
  const v=own(value,['deadlineMs'],['signal']);nativeSignal(v.signal);
  if(!Number.isSafeInteger(v.deadlineMs))refuse();
  if(!available())return unavailable();
  const reading=Object.hasOwn(readRoutes,phase),route=reading?readRoutes[phase]+'/'+source.generationJobId:routes[phase],method=reading?'GET':'POST',bodySha256=sha256Utf8(reading?'':body);let life,response;
  try{
   if(route.includes('?')||route.includes('#'))refuse();
   const at=now();if(!Number.isSafeInteger(at)||at<0)refuse();
   let cutoff=Math.min(v.deadlineMs,at+maxRequestMs);
   life=createOperationLifetime({now,signal:v.signal,deadlineMs:cutoff,errorFactory:fault});
   async function credential(){
    const began=now();if(!Number.isSafeInteger(began)||began<0)refuse();
    const raw=await life.run(signal=>readCredential({operation,phase,method,route,source,sourceSha256,requestSha256,bodySha256,signal,deadlineMs:cutoff}));
    const a=data(own(raw,['credential','actorId','tenantId','generationJobId','operation','method','route','phase','sourceSha256','requestSha256','bodySha256','checkedAtMs','expiresAtMs']));
    const checked=now();if(!Number.isSafeInteger(checked)||checked<began)refuse();
    if(typeof a.credential!=='string'||!/^[A-Za-z0-9._~+/-]{1,8192}={0,2}$/u.test(a.credential)||a.actorId!==source.binding.actorId||a.tenantId!==source.binding.tenantId||
     a.generationJobId!==source.generationJobId||a.operation!==operation||a.method!==method||a.route!==route||a.phase!==phase||a.sourceSha256!==sourceSha256||a.requestSha256!==requestSha256||a.bodySha256!==bodySha256||
     !Number.isSafeInteger(a.checkedAtMs)||a.checkedAtMs<began||a.checkedAtMs>checked||!Number.isSafeInteger(a.expiresAtMs)||a.expiresAtMs<=checked)refuse();
    cutoff=Math.min(cutoff,a.expiresAtMs);life.limitDeadline(cutoff);return a.credential;
   }
   const secret=await credential();
   response=await life.run(signal=>{
    const pending=Promise.resolve(fetchImpl(origin+route,{method,redirect:'error',credentials:'omit',cache:'no-store',
     headers:{authorization:'Bearer '+secret,...(reading?{}:{'content-type':'application/json'}),accept:'application/json','accept-encoding':'identity'},
     ...(reading?{}:{body}),signal}));
    pending.then(r=>{if(life.signal.aborted)cancel(r);},()=>{});return pending;
   });life.check();
   if(!response||types.isProxy(response)||!(response instanceof Response)||getters.redirected.call(response))refuse();
   const status=getters.status.call(response);if(status!==(reading?200:201))return unavailable();
   const headers=getters.headers.call(response),header=key=>Headers.prototype.get.call(headers,key),length=header('content-length');
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding'))||
    length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maxFactBytes))refuse();
   const raw=await jsonBody({body:getters.body.call(response),length:length===null?null:Number(length)},maxFactBytes,life,life.check);
   if(await credential()!==secret)refuse();life.check();
   // Core's closed response decoder, still unallocated, must validate before any use.
   return data({kind:'unqualified-response',status,value:raw});
  }catch{return unavailable();}finally{cancel(response);life?.close();}
 }
 return Object.freeze({available,
  admit:value=>send('admit',value),publish:value=>send('publish',value),accept:value=>send('accept',value),
  readAdmission:value=>send('admission-read',value),readRequest:value=>send('request-read',value),
  complete:value=>send('complete',value),readCompletion:value=>send('completion-read',value),
 });
}
