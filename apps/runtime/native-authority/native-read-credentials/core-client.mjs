/** CONTROL-only ordinary native principal/role observations. Fixed header-free identity/member boundary; no issuer. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {assertCorePrincipal,retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFault,nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {createCapiroApplicationAuthorityClient} from '../../../control/action-host/application-adapters/authority-http.mjs';
import {createConversationAuthorityReader} from './conversation-authority.mjs';
import {createClientReferenceReader} from './client-reference.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../../gateway/sources/json-response.mjs';
import {safeFailure} from '../../../gateway/dispatch/operation-result.mjs';
const same=(a,b)=>hash(a)===hash(b),SHA=/^[a-f0-9]{64}$/u,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const ROLES=new Set(['standard_user','user_admin','capiro_admin']);
const refuse=code=>{throw nativeReadFault(code);};
const failure=error=>nativeReadFault(nativeReadFailureCode(error)??(safeFailure(error).message==='INTERNAL_ERROR'?'UNAVAILABLE':safeFailure(error).message));
function clocks(v,{started,now}){const at=now();if(!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at)refuse('ACCESS_DENIED');}
export function assertNativeToolAuthority(raw,{started,now}){
 const v=data(own(raw,['principal','identityRevision','actorRole','membershipRevision','checkedAtMs','expiresAtMs'],['clientIds']));
 assertCorePrincipal(v.principal);clocks(v,{started,now});
 if(!SHA.test(v.identityRevision)||!SHA.test(v.membershipRevision)||!ROLES.has(v.actorRole))refuse('ACCESS_DENIED');
 // Optional only for older trusted fake ports. The real membership client below always carries this current roster.
 if(Object.hasOwn(v,'clientIds')&&(!Array.isArray(v.clientIds)||v.clientIds.length>4096||new Set(v.clientIds).size!==v.clientIds.length||v.clientIds.some(id=>typeof id!=='string'||!UUID.test(id))))refuse('ACCESS_DENIED');
 return v;
}
export function createNativeToolAuthorityClient(configuration={}){
 const c=own(configuration,[],['origin','fetchImpl','now','enabled','maxRequestMs']),now=c.now??Date.now,enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??3000;
 if(typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)refuse('CONFIGURATION');
 const origin=c.origin===undefined?undefined:retainedOrigin(c.origin);
 if(c.fetchImpl!==undefined&&(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)))refuse('CONFIGURATION');
 const available=Boolean(enabled&&origin&&c.fetchImpl),identity=available?createCapiroApplicationAuthorityClient({origin,fetchImpl:c.fetchImpl,now,enabled:true,limits:{maxRequestMs,maxResponseBytes:16384}}):null;
 async function readCurrent(raw){let life,acquired;try{
  if(!available)refuse('UNAVAILABLE');const v=own(raw,['credential','deadlineMs'],['signal']);nativeSignal(v.signal);
  if(typeof v.credential!=='string'||!/^\S{1,8192}$/u.test(v.credential)||!Number.isSafeInteger(v.deadlineMs))refuse('INVALID_ARGUMENTS');
  if(v.signal?.aborted)refuse('CANCELLED');const began=now(),cutoff=Math.min(v.deadlineMs,began+maxRequestMs);life=createOperationLifetime({now,deadlineMs:cutoff,signal:v.signal,errorFactory:nativeReadFault});
  async function identify(){const started=now(),r=data(await life.run(signal=>identity.readIdentity({credential:v.credential,deadlineMs:cutoff,signal})));own(r,['principal','identityRevision','checkedAtMs','expiresAtMs']);assertCorePrincipal(r.principal);clocks(r,{started,now});if(!SHA.test(r.identityRevision))refuse('ACCESS_DENIED');life.limitDeadline(r.expiresAtMs);return r;}
  const before=await identify(),memberStarted=now();
  acquired=await life.run(signal=>{const pending=Promise.resolve(c.fetchImpl(origin+'/api/clio/application-authority/membership',{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{authorization:'Bearer '+v.credential,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:'{}',signal}));pending.then(r=>{if(life.signal.aborted)try{cancelBody(responseBody(r));}catch{}},()=>{});return pending;});
  const m=data(await readJsonResponse(acquired,{lifetime:life,maxResponseBytes:131072}));own(m,['tenantId','actorId','status','role','permissions','clientIds','membershipRevision','checkedAtMs','expiresAtMs']);
  clocks(m,{started:memberStarted,now});life.limitDeadline(m.expiresAtMs);
  if(!same({tenantId:m.tenantId,actorId:m.actorId},before.principal)||m.status!=='active'||!ROLES.has(m.role)||!SHA.test(m.membershipRevision)||!Array.isArray(m.permissions)||m.permissions.length!==0||!Array.isArray(m.clientIds)||m.clientIds.length>4096||new Set(m.clientIds).size!==m.clientIds.length||m.clientIds.some(id=>typeof id!=='string'||!UUID.test(id)))refuse('ACCESS_DENIED');
  const after=await identify();if(!same(before.principal,after.principal)||before.identityRevision!==after.identityRevision)refuse('ACCESS_DENIED');life.check();
  // Core confirmed this equality ONLY for this fixed no-tenant/no-impersonation/no-cookie client.
  return assertNativeToolAuthority({principal:after.principal,identityRevision:after.identityRevision,actorRole:m.role,clientIds:m.clientIds,membershipRevision:m.membershipRevision,checkedAtMs:Math.min(before.checkedAtMs,m.checkedAtMs,after.checkedAtMs),expiresAtMs:Math.min(v.deadlineMs,before.expiresAtMs,m.expiresAtMs,after.expiresAtMs)},{started:began,now});
 }catch(error){throw failure(error);}finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}}
 const readConversation=createConversationAuthorityReader({available,authorityClient:identity,now,maxRequestMs});
 const readClientReference=createClientReferenceReader({available,origin,fetchImpl:c.fetchImpl,authorityClient:identity,now,maxRequestMs});
 return Object.freeze({available,origin,readCurrent,readConversation,readClientReference});
}
