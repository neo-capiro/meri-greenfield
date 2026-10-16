/** Fixed-route JSON calls to Core (canonical memory and memory review). HTTPS origin only, no redirects, ambient credentials, retries
 * or initialization I/O. Credentials are short-lived facts from the trusted broker bound to the exact tenant/actor/purpose. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {cancelBody,readJsonResponse,responseBody} from '../../gateway/sources/json-response.mjs';
import {ProductError,asProductError,refuse} from '../product-access/errors.mjs';
import {closed,text} from '../product-access/shape.mjs';
export const CORE_MEMORY_ROUTES=Object.freeze({
 submit:'/clio/memory/review/submit',status:'/clio/memory/review/status',target:'/clio/memory/read_target',findByKey:'/clio/memory/find_by_key'});
export function createCoreMemoryTransport(options){
 const {origin,getCredentials,fetchImpl=globalThis.fetch,now,maxRequestMs=10000,maxResponseBytes=262144}=options??{};
 if(Object.keys(options??{}).some(k=>!['origin','getCredentials','fetchImpl','now','maxRequestMs','maxResponseBytes'].includes(k))||typeof origin!=='string'||typeof getCredentials!=='function'||
  typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||
  !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)throw new ProductError('PRODUCT_CONFIGURATION');
 let base;try{base=new URL(origin);}catch{throw new ProductError('PRODUCT_CONFIGURATION');}
 if(base.protocol!=='https:'||base.origin!==origin||base.username||base.password)throw new ProductError('PRODUCT_CONFIGURATION');
 /** POST `body` to the named route for `{tenantId,actorId}`; resolves to the parsed JSON object or refuses with `failure`. */
 async function call(route,{tenantId,actorId,body,signal,deadlineMs},failure){
  if(!Object.hasOwn(CORE_MEMORY_ROUTES,route))throw new ProductError('PRODUCT_CONFIGURATION');
  let lifetime,acquired;
  try{
   const cutoff=Math.min(Number.isSafeInteger(deadlineMs)?deadlineMs:Infinity,now()+maxRequestMs);
   lifetime=createOperationLifetime({deadlineMs:cutoff,now,signal,errorFactory:code=>new ProductError(code)});
   const c=closed(await lifetime.run(s=>getCredentials({tenantId,actorId,purpose:`memory.${route}`,signal:s,deadlineMs:cutoff})),['tenantId','actorId','bearerToken','serviceSecret','expiresAtMs'],[],failure);
   if(c.tenantId!==tenantId||c.actorId!==actorId||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now()||
    ![c.bearerToken,c.serviceSecret].every(x=>text(x,1,8192)&&/^[\x21-\x7e]+$/u.test(x)))refuse(failure);
   lifetime.limitDeadline(c.expiresAtMs);
   const response=await lifetime.run(async s=>{
    const r=await fetchImpl(new URL(CORE_MEMORY_ROUTES[route],base).href,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:s,
     headers:{authorization:`Bearer ${c.bearerToken}`,'x-internal-service-secret':c.serviceSecret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:JSON.stringify(body)});
    acquired=r;lifetime.check();return r;
   });
   const value=await readJsonResponse(response,{lifetime,maxResponseBytes});lifetime.check();return value;
  }catch(error){throw asProductError(error,failure);}
  finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}lifetime?.close();}
 }
 return Object.freeze({call});
}
