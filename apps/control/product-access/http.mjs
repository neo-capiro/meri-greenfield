/** Fetch mount for membership-gated product surfaces (memory, settings, tasks). Thin: bounded JSON transport, a fresh membership
 * admission per request, the route's domain call, then a membership recheck before any result is released. No listener,
 * CORS policy, ambient configuration or credential is created here. */
import {types} from 'node:util';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody,response} from '../action-application/http.mjs';
import {ProductError,productFailure,refuse} from './errors.mjs';
const getters=Object.fromEntries(['url','method','headers','signal','body'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
/** Transport and membership statuses shared by every product route; routes add their own domain codes. */
export const PRODUCT_ERROR_STATUSES=Object.freeze({INVALID_REQUEST:400,UNAUTHENTICATED:401,ACCESS_DENIED:403,MEMBERSHIP_REVOKED:403,NOT_FOUND:404,
 METHOD_NOT_ALLOWED:405,DEADLINE:408,MEMBERSHIP_CHANGED:409,REQUEST_TOO_LARGE:413,UNSUPPORTED_MEDIA_TYPE:415,CANCELLED:499,PRODUCT_UNAVAILABLE:502});
const ROUTE=/^\/api\/(?:[a-z][a-z-]{0,31}\/){1,3}[a-z][a-z-]{0,31}$/u;
/** `routes` maps an exact path to `{handle({principal,body,signal,deadlineMs}), errors?:{CODE:status}, effect?:boolean}`. A route with
 * `effect:true` reports UNKNOWN when an invoked route has an indeterminate outcome, and RESULT_NOT_RELEASED when its returned
 * result is withheld. Starting a route is not proof of an effect or of physical cancellation; callers must reconcile by identity. */
export function createProductApplication(options){
 const {gate,routes,now=Date.now,limits}=options??{};
 if(!gate||['admit','recheck'].some(k=>typeof gate[k]!=='function')||typeof now!=='function'||!routes||typeof routes!=='object')throw new ProductError('PRODUCT_CONFIGURATION');
 const {maxRequestMs,maxRequestBytes,maxResponseBytes}=limits??{};
 if(!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxRequestBytes)||maxRequestBytes<1||maxRequestBytes>1048576||!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)throw new ProductError('PRODUCT_CONFIGURATION');
 const table=new Map();
 for(const [path,route] of Object.entries(routes)){
  if(!ROUTE.test(path)||typeof route?.handle!=='function'||table.has(path))throw new ProductError('PRODUCT_CONFIGURATION');
  const errors=Object.freeze({...route.errors});
  if(Object.entries(errors).some(([code,status])=>!/^[A-Z][A-Z0-9_]{2,63}$/u.test(code)||Object.hasOwn(PRODUCT_ERROR_STATUSES,code)||!Number.isSafeInteger(status)||status<400||status>599))throw new ProductError('PRODUCT_CONFIGURATION');
  if(route.effect!==undefined&&typeof route.effect!=='boolean')throw new ProductError('PRODUCT_CONFIGURATION');
  table.set(path,Object.freeze({handle:route.handle,errors,effect:route.effect===true}));
 }
 const failure=(error,route)=>{
  const owned=productFailure(error);let code=owned?.code??'PRODUCT_UNAVAILABLE';
  let status=PRODUCT_ERROR_STATUSES[code]??route?.errors[code];
  if(status===undefined){code='PRODUCT_UNAVAILABLE';status=502;}
  return response({error:{code,...(owned?.outcome?{outcome:owned.outcome}:{}),...(owned?.field&&status!==502?{field:owned.field}:{})}},status);
 };
 return Object.freeze({paths:Object.freeze([...table.keys()]),async handle(request){
  let lifetime,route,started=false,handled=false;
  try{
   if(!request||types.isProxy(request)||!(request instanceof Request))refuse('INVALID_REQUEST');
   let info;try{info=Object.fromEntries(Object.entries(getters).map(([k,g])=>[k,g.call(request)]));}catch{refuse('INVALID_REQUEST');}
   const header=k=>Headers.prototype.get.call(info.headers,k),url=new URL(info.url);
   route=table.get(url.pathname);if(!route||url.search||url.hash)refuse('NOT_FOUND');
   if(info.method!=='POST')refuse('METHOD_NOT_ALLOWED');
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding')!==null)refuse('UNSUPPORTED_MEDIA_TYPE');
   const auth=header('authorization');if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9._~+/-]{1,8192}={0,2}$/u.test(auth))refuse('UNAUTHENTICATED');
   const length=header('content-length');if(length!==null&&!/^(0|[1-9][0-9]{0,15})$/u.test(length))refuse('INVALID_REQUEST');
   const deadlineMs=now()+maxRequestMs;
   lifetime=createOperationLifetime({deadlineMs,now,signal:info.signal,errorFactory:code=>new ProductError(code)});
   let body;try{body=await jsonBody({body:info.body,length:length===null?null:Number(length)},maxRequestBytes,lifetime,()=>lifetime.check());}
   catch(error){if(productFailure(error))throw error;refuse(String(error?.message)==='REQUEST_TOO_LARGE'?'REQUEST_TOO_LARGE':'INVALID_REQUEST');}
   const {principal,expiresAtMs}=await lifetime.run(signal=>gate.admit({credential:auth.slice(7),signal,deadlineMs}));
   const accessDeadline=Math.min(deadlineMs,expiresAtMs);lifetime.limitDeadline(accessDeadline);
   // The native bearer stays in this request closure. Domain owners receive only a bounded recheck callback, never the token.
   const recheckMembership=()=>lifetime.run(signal=>gate.recheck({principal,credential:auth.slice(7),signal,deadlineMs:accessDeadline}));
   const result=await lifetime.run(async signal=>{started=true;const result=await route.handle({principal,body,signal,deadlineMs:accessDeadline,recheckMembership});handled=true;return result;});
   // Stored data and effects are released only to a member who is still active at the admitted revision.
   await recheckMembership();
   const text=JSON.stringify(result);if(Buffer.byteLength(text)>maxResponseBytes)refuse('PRODUCT_UNAVAILABLE');
   lifetime.check();return response(result,200);
  }catch(error){
   const owned=productFailure(error);
   if(started&&route.effect){
    if(handled)return failure(new ProductError(owned?.code??'PRODUCT_UNAVAILABLE',owned?.outcome??'RESULT_NOT_RELEASED'),route);
    // The lifetime races the handler; its rejection does not settle a pending COMMIT or Core submission. Mark start inside the
    // callback, after run()'s cancellation check, so pre-dispatch refusals remain ordinary failures. Preserve domain-owned outcomes.
    if(owned?.outcome)return failure(error,route);
    if(lifetime.signal.aborted||!owned)return failure(new ProductError(owned?.code??'PRODUCT_UNAVAILABLE','UNKNOWN'),route);
   }
   return failure(error,route);
  }finally{lifetime?.close();}
 }});
}
