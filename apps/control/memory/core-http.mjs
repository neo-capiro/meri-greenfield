/** Fixed-route JSON calls to Core (canonical memory, memory review and the proposer's own decisions). HTTPS origin only, no
 * redirects, ambient credentials, retries or initialization I/O. Credentials are short-lived facts from the trusted broker bound to
 * the exact tenant/actor/purpose: the member's own live native bearer and, for the receiving routes, the verified service identity.
 *
 * Receiver (capiro-backend #84 `0304b0ef`): the four receiving routes take the bearer AND `x-internal-service-secret`
 * (`ToolServiceSecretGuard`, same auth as `tools/*`) and pin HTTP 200. The decision routes are Core's existing standard-user routes
 * (`RolesGuard` only): the bearer alone identifies the deciding member, so the service secret is never sent there. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {cancelBody,readJsonResponse,responseBody} from '../../gateway/sources/json-response.mjs';
import {ProductError,asProductError,refuse} from '../product-access/errors.mjs';
import {UUID,closed,text} from '../product-access/shape.mjs';
/** W8 receiving routes (`MeriMemoryReceivingController`): bearer + verified service secret, HTTP 200 only. */
export const CORE_MEMORY_ROUTES=Object.freeze({
 submit:'/api/clio/memory/review/submit',status:'/api/clio/memory/review/status',target:'/api/clio/memory/read_target',findByKey:'/api/clio/memory/find_by_key'});
/** The proposer's own decision routes, by candidate kind (`{id}` is the Meri candidate id, which Core reuses as its candidate id):
 *  ownerDecision  additions: `MemoryController.decideOwnCandidate` (personal, own candidate only; 409 for a version candidate)
 *  versionApprove / versionReject  corrections: `MemoryVersionController` (`ImmutableMemoryVersionService`, 503 until
 *                  `MEMORY_GOVERNANCE_LIFECYCLE=enforce`). Bearer only. */
export const CORE_MEMORY_DECISION_ROUTES=Object.freeze({
 ownerDecision:'/api/memory/candidates/{id}/owner-decision',versionApprove:'/api/memory/version-candidates/{id}/approve',versionReject:'/api/memory/version-candidates/{id}/reject'});
const ROUTES=Object.freeze({...Object.fromEntries(Object.entries(CORE_MEMORY_ROUTES).map(([k,path])=>[k,{path,service:true}])),
 ...Object.fromEntries(Object.entries(CORE_MEMORY_DECISION_ROUTES).map(([k,path])=>[k,{path,service:false}]))});
const STATUS=Object.getOwnPropertyDescriptor(Response.prototype,'status').get;
const CODE=/^[A-Z][A-Z0-9_]{2,63}$/u;
export function createCoreMemoryTransport(options){
 const {origin,getCredentials,fetchImpl=globalThis.fetch,now,maxRequestMs=10000,maxResponseBytes=262144}=options??{};
 if(Object.keys(options??{}).some(k=>!['origin','getCredentials','fetchImpl','now','maxRequestMs','maxResponseBytes'].includes(k))||typeof origin!=='string'||typeof getCredentials!=='function'||
  typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||
  !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)throw new ProductError('PRODUCT_CONFIGURATION');
 let base;try{base=new URL(origin);}catch{throw new ProductError('PRODUCT_CONFIGURATION');}
 if(base.protocol!=='https:'||base.origin!==origin||base.username||base.password)throw new ProductError('PRODUCT_CONFIGURATION');
 /** POST `body` to the named route for `{tenantId,actorId}` (decision routes also take the candidate `id`); resolves to the parsed JSON
  * object or refuses with `failure`. `refused` maps an HTTP status Core answers DEFINITIVELY (it recorded nothing: 400 malformed, 403
  * refused, 404 unknown, 409 conflict) to a typed refusal; any unmapped status, a transport fault or a malformed body is `failure`
  * (uncertainty: Core's 503 lifecycle gate included, D016 #6). */
 async function call(route,{tenantId,actorId,id,body,signal,deadlineMs},failure,refused){
  const target=ROUTES[route];
  if(target===undefined||typeof failure!=='string'||!CODE.test(failure)||refused!==undefined&&(refused===null||typeof refused!=='object'||Object.entries(refused).some(([s,c])=>!/^[45][0-9]{2}$/u.test(s)||typeof c!=='string'||!CODE.test(c))))throw new ProductError('PRODUCT_CONFIGURATION');
  let path=target.path;
  if(path.includes('{id}')){if(typeof id!=='string'||!UUID.test(id))throw new ProductError('PRODUCT_CONFIGURATION');path=path.replace('{id}',id);}
  else if(id!==undefined)throw new ProductError('PRODUCT_CONFIGURATION');
  let lifetime,acquired;
  try{
   const cutoff=Math.min(Number.isSafeInteger(deadlineMs)?deadlineMs:Infinity,now()+maxRequestMs);
   lifetime=createOperationLifetime({deadlineMs:cutoff,now,signal,errorFactory:code=>new ProductError(code)});
   const c=closed(await lifetime.run(s=>getCredentials({tenantId,actorId,purpose:`memory.${route}`,signal:s,deadlineMs:cutoff})),['tenantId','actorId','bearerToken','serviceSecret','expiresAtMs'],[],failure);
   if(c.tenantId!==tenantId||c.actorId!==actorId||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now()||
    ![c.bearerToken,c.serviceSecret].every(x=>text(x,1,8192)&&/^[\x21-\x7e]+$/u.test(x))||c.bearerToken===c.serviceSecret)refuse(failure);
   lifetime.limitDeadline(c.expiresAtMs);
   const response=await lifetime.run(async s=>{
    const r=await fetchImpl(new URL(path,base).href,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:s,
     headers:{authorization:`Bearer ${c.bearerToken}`,...(target.service?{'x-internal-service-secret':c.serviceSecret}:{}),'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:JSON.stringify(body)});
    acquired=r;lifetime.check();return r;
   });
   responseBody(response);
   const definite=refused?.[String(STATUS.call(response))];
   if(definite!==undefined)refuse(definite);
   const value=await readJsonResponse(response,{lifetime,maxResponseBytes});lifetime.check();return value;
  }catch(error){throw asProductError(error,failure);}
  finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}lifetime?.close();}
 }
 return Object.freeze({call});
}
