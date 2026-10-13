/** Fresh host receipts correlate trusted owners, never decide their policy. */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {CommandError,data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export {data,own};
export const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export const refuse=()=>{throw new CommandError('ACCESS_DENIED');};
const stableKeys=['tenantId','actorId','conversationId','runId'];
export function createRequestCurrent({credential,deadlineMs,signal,ports,now,commandContext,maxBytes}){
 nativeSignal(signal);if(typeof credential!=='string'||!credential||!Number.isSafeInteger(deadlineMs))refuse();
 let cutoff=deadlineMs,identity,selected;
 const check=lifetime=>{const at=now();if(!Number.isSafeInteger(at)||at<0||at>=cutoff)throw new CommandError('DEADLINE');lifetime.check();if(lifetime.signal.aborted)throw new CommandError('CANCELLED');return at;};
 const clip=(ms,lifetime)=>{if(!Number.isSafeInteger(ms))refuse();cutoff=Math.min(cutoff,ms);lifetime.limitDeadline(cutoff);check(lifetime);};
 function receipt(raw,keys,started,lifetime){const r=data(raw);own(r,keys);if(Buffer.byteLength(JSON.stringify(r))>maxBytes)refuse();const at=check(lifetime);if(!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>at||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=at)refuse();clip(r.expiresAtMs,lifetime);return r;}
 async function fresh(lifetime){
  let started=check(lifetime);const authentication=receipt(await lifetime.run(s=>ports.authenticateSession({credential,signal:s,deadlineMs:cutoff})),['principal','sessionRevision','checkedAtMs','expiresAtMs'],started,lifetime);
  own(authentication.principal,['sessionId',...stableKeys]);if(Object.values(authentication.principal).some(v=>typeof v!=='string'||!v)||typeof authentication.sessionRevision!=='string'||!authentication.sessionRevision)refuse();
  const who=data({principal:authentication.principal,sessionRevision:authentication.sessionRevision});if(identity&&!same(who,identity))refuse();identity??=who;
  if(stableKeys.some(k=>who.principal[k]!==commandContext.binding[k]))refuse();
  started=check(lifetime);const current=receipt(await lifetime.run(s=>ports.readCurrentState({authentication,signal:s,deadlineMs:cutoff})),['authenticationSha256','binding','scopes','selectedClientId','checkedAtMs','expiresAtMs'],started,lifetime);
  if(current.authenticationSha256!==canonicalSha256(authentication))refuse();validateShape('RunBinding',current.binding);
  if(stableKeys.some(k=>current.binding[k]!==who.principal[k])||!Array.isArray(current.scopes)||!current.scopes.length||current.scopes.length>100)refuse();
  for(const scope of current.scopes){validateShape('Scope',scope);if(scope.tenantId!==who.principal.tenantId)refuse();}
  if(new Set(current.scopes.map(canonicalSha256)).size!==current.scopes.length||typeof current.selectedClientId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(current.selectedClientId))refuse();
  if(!current.scopes.some(s=>s.kind==='client'&&s.resourceId.toLowerCase()===current.selectedClientId)||commandContext.clientResolution?.clientId!==current.selectedClientId||commandContext.clientResolution?.reference!==current.selectedClientId)refuse();
  const selection=data({binding:current.binding,scopes:current.scopes,selectedClientId:current.selectedClientId});if(selected&&!same(selected,selection))refuse();selected??=selection;
  check(lifetime);return {authentication,current};
 }
 async function port(name,facts,lifetime,extra={}){
  const fields=name==='reserveLookup'?['lookupId','resultReference','requestId','deliveryJson','slots']:name==='issueExecution'?['execution','credential']:['credential'];
  const started=check(lifetime),out=receipt(await lifetime.run(s=>ports[name]({...facts,...extra,signal:s,deadlineMs:cutoff})),['authenticationSha256','binding',...fields,'checkedAtMs','expiresAtMs'],started,lifetime);
  if(out.authenticationSha256!==canonicalSha256(facts.authentication)||!same(out.binding,facts.current.binding))refuse();
  if(fields.includes('credential')&&(typeof out.credential!=='string'||!out.credential))refuse();return out;
 }
 async function run(callSignal,body){nativeSignal(callSignal);const lifetime=createOperationLifetime({deadlineMs:cutoff,now,signal:callSignal??signal,errorFactory:code=>new CommandError(code)});try{return await body(lifetime);}finally{lifetime.close();}}
 return {fresh,port,run,check,deadline:()=>cutoff};
}
