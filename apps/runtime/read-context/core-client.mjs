/** CONTROL-only current principal, role and owned-resource observations; no credential issuer. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertCorePrincipal,retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFault,nativeReadFailureCode} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createCapiroApplicationAuthorityClient} from '../../control/action-host/application-adapters/authority-http.mjs';
import {createConversationAuthorityReader} from './conversation-authority.mjs';
import {createClientReferenceReader} from './client-reference.mjs';
import {createReadModeObservationReader} from './read-mode-observation.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
import {safeFailure} from '../../gateway/dispatch/operation-result.mjs';
const SHA=/^[a-f0-9]{64}$/u,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const ROLES=new Set(['standard_user','user_admin','capiro_admin']);
const refuse=code=>{throw nativeReadFault(code);};
const failure=error=>nativeReadFault(nativeReadFailureCode(error)??(safeFailure(error).message==='INTERNAL_ERROR'?'UNAVAILABLE':safeFailure(error).message));
function clocks(v,{started,now}){const at=now();if(!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at)refuse('ACCESS_DENIED');}
export function assertNativeToolAuthority(raw,{started,now}){
 const v=data(own(raw,['principal','identityRevision','actorRole','membershipRevision','checkedAtMs','expiresAtMs'],['clientIds']));
 assertCorePrincipal(v.principal);clocks(v,{started,now});
 if(!SHA.test(v.identityRevision)||!SHA.test(v.membershipRevision)||!ROLES.has(v.actorRole))refuse('ACCESS_DENIED');
 // Optional only for older trusted fake ports. The real current-context client below always carries this current roster.
 if(Object.hasOwn(v,'clientIds')&&(!Array.isArray(v.clientIds)||v.clientIds.length>4096||new Set(v.clientIds).size!==v.clientIds.length||v.clientIds.some(id=>typeof id!=='string'||!UUID.test(id))))refuse('ACCESS_DENIED');
 return v;
}
export function createNativeToolAuthorityClient(configuration={}){
 const c=own(configuration,[],['origin','fetchImpl','now','enabled','maxRequestMs','binding','selectedClientId']),now=c.now??Date.now,enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??3000;
 if(typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)refuse('CONFIGURATION');
 const origin=c.origin===undefined?undefined:retainedOrigin(c.origin);
 if(c.fetchImpl!==undefined&&(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)))refuse('CONFIGURATION');
 const available=Boolean(enabled&&origin&&c.fetchImpl&&c.binding&&Object.hasOwn(c,'selectedClientId')),identity=available?createCapiroApplicationAuthorityClient({origin,fetchImpl:c.fetchImpl,now,enabled:true,limits:{maxRequestMs,maxResponseBytes:16384}}):null;
 async function readCurrent(raw){let life;try{
  if(!available)refuse('UNAVAILABLE');const v=own(raw,['credential','deadlineMs'],['signal']);nativeSignal(v.signal);
  if(typeof v.credential!=='string'||!/^\S{1,8192}$/u.test(v.credential)||!Number.isSafeInteger(v.deadlineMs))refuse('INVALID_ARGUMENTS');
  const began=now(),cutoff=Math.min(v.deadlineMs,began+maxRequestMs);life=createOperationLifetime({now,deadlineMs:cutoff,signal:v.signal,errorFactory:nativeReadFault});
  const r=await life.run(signal=>identity.readCurrent({credential:v.credential,conversationId:c.binding.conversationId,clientId:c.selectedClientId,signal,deadlineMs:cutoff}));
  if(r.principal.tenantId!==c.binding.tenantId||r.principal.actorId!==c.binding.actorId||r.conversationId!==c.binding.conversationId||r.selectedClientId!==c.selectedClientId||
   !ROLES.has(r.role)||c.selectedClientId!==null&&!r.clientIds.includes(c.selectedClientId))refuse('ACCESS_DENIED');
  life.limitDeadline(r.expiresAtMs);life.check();
  return assertNativeToolAuthority({principal:r.principal,identityRevision:r.identityRevision,actorRole:r.role,clientIds:r.clientIds,membershipRevision:r.membershipRevision,
   checkedAtMs:r.checkedAtMs,expiresAtMs:Math.min(cutoff,r.expiresAtMs)},{started:began,now});
 }catch(error){if([401,403,409].includes(error?.status))refuse('ACCESS_DENIED');throw failure(error);}finally{life?.close();}}
 const resourceIdentity=identity?{readIdentity:identity.readIdentity,readContext:identity.readContext}:null;
 const readConversation=createConversationAuthorityReader({available,authorityClient:resourceIdentity,now,maxRequestMs});
 const readClientReference=createClientReferenceReader({available,origin,fetchImpl:c.fetchImpl,authorityClient:resourceIdentity,now,maxRequestMs});
 const readModeObservation=createReadModeObservationReader({available,origin,fetchImpl:c.fetchImpl,authorityClient:resourceIdentity,now,maxRequestMs});
 /** Ordinary actor-owned integration inventory, including disconnected stored mail.
  * These IDs select data; every mail read still rechecks the Core connection owner. */
 async function readMailboxes(raw){let life,acquired;try{
  if(!available)refuse('UNAVAILABLE');const v=own(raw,['credential','deadlineMs'],['signal']);nativeSignal(v.signal);
  if(typeof v.credential!=='string'||!/^\S{1,8192}$/u.test(v.credential)||!Number.isSafeInteger(v.deadlineMs))refuse('INVALID_ARGUMENTS');
  const cutoff=Math.min(v.deadlineMs,now()+maxRequestMs);
  life=createOperationLifetime({now,deadlineMs:cutoff,signal:v.signal,errorFactory:nativeReadFault});
  const response=await life.run(async signal=>{
   const result=await c.fetchImpl(new URL('/api/engagement/integrations',origin).href,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,
    headers:{authorization:`Bearer ${v.credential}`,accept:'application/json','accept-encoding':'identity'}});
   acquired=result;try{life.check();return result;}catch(error){try{cancelBody(responseBody(result));}catch{}throw error;}
  });
  const rows=await readJsonResponse(response,{lifetime:life,maxResponseBytes:1048576});
  if(!Array.isArray(rows)||rows.length>4096)refuse('RESOURCE_LIMIT');
  const result=[],seen=new Set();
  for(const row of rows){
   if(!row||typeof row!=='object'||Array.isArray(row)||!UUID.test(row.id)||seen.has(row.id)||
    row.tenantId!==c.binding.tenantId||row.createdByUserId!==c.binding.actorId||typeof row.provider!=='string')refuse('ACCESS_DENIED');
   seen.add(row.id);
   if(!['microsoft_365','google_workspace'].includes(row.provider))continue;
   if(!['needs_configuration','connected','error','disabled'].includes(row.status))refuse('INVALID_RESULT');
   result.push({id:row.id,provider:row.provider,status:row.status});
  }
  life.check();return result.sort((a,b)=>a.id.localeCompare(b.id));
 }catch(error){throw failure(error);}finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}}
 return Object.freeze({available,origin,readCurrent,readConversation,readClientReference,readModeObservation,readMailboxes});
}
