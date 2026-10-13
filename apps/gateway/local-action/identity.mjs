/** Explicit process-local synthetic identity, never a native JWT or production policy issuer. */
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {types} from 'node:util';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract,validateShape as privateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData} from '../sources/source-admission.mjs';
import {deny} from '../dispatch/operation-result.mjs';
const owners=new WeakSet(),operation=Object.freeze({id:'actions.query',version:'0.2.0'});
const descriptor=resolveOperationContract(operation).descriptor;
const digest=x=>createHash('sha256').update(x).digest('hex');
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
export function assertLocalActionIdentity(value){if(!owners.has(value))deny('GATEWAY_CONFIGURATION');return value;}
export function createLocalActionIdentity(options){
 const c=ownFields(options,['mode','binding','clientId','policyRevision','deadlineMs','budgets','grants','sourceEnabled','now'],['newId']);
 if(c.mode!=='synthetic-local'||typeof c.now!=='function'||(c.newId!==undefined&&typeof c.newId!=='function'))deny('GATEWAY_CONFIGURATION');
 const now=c.now,newId=c.newId??randomUUID,initial=frozenData({binding:c.binding,clientId:c.clientId,policyRevision:c.policyRevision,deadlineMs:c.deadlineMs,budgets:c.budgets,grants:c.grants,sourceEnabled:c.sourceEnabled});
 let state={...initial,clientAllowed:true},closed=false;
 const tokens=new Map(),ids=new Map();
 const scope=()=>({tenantId:state.binding.tenantId,kind:'client',resourceId:state.clientId,policyRevision:state.policyRevision});
 function active(signal){const stamp=now();if(signal!==undefined){if(types.isProxy(signal))deny('INVALID_ARGUMENTS');try{if(aborted.call(signal))deny('CANCELLED');}catch(error){if(error?.message==='CANCELLED')throw error;deny('INVALID_ARGUMENTS');}}
  if(closed||!Number.isSafeInteger(stamp)||stamp<0||stamp>=state.deadlineMs)deny('ACCESS_DENIED');return stamp;}
 function configuration(s){validateShape('RunBinding',s.binding);validateShape('Budgets',s.budgets);
  if(typeof s.clientId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(s.clientId)||typeof s.policyRevision!=='string'||!/^([0-9a-f]{64})$/u.test(s.policyRevision)||!Number.isSafeInteger(s.deadlineMs)||typeof s.sourceEnabled!=='boolean'||!Array.isArray(s.grants)||s.grants.some(g=>!descriptor.requiredGrants.includes(g))||new Set(s.grants).size!==s.grants.length)deny('GATEWAY_CONFIGURATION');}
 configuration(state);active();
 function current(record,signal){const stamp=active(signal);if(!record||record.revoked||Date.parse(record.claims.expiresAt)<=stamp||Date.parse(record.claims.issuedAt)>stamp||!same(record.claims.binding,state.binding)||record.claims.policyRevision!==state.policyRevision)deny('ACCESS_DENIED');return stamp;}
 function issued(claims,signal){const value=frozenData(claims),record=ids.get(value.capabilityId);current(record,signal);if(!same(value,record.claims))deny('ACCESS_DENIED');return record;}
 function subject(decisionId){return {kind:'client',entityType:'client',entityIds:[state.clientId],tenantId:state.binding.tenantId,actorId:state.binding.actorId,authorizationDecisionId:decisionId,policyRevision:state.policyRevision,scopes:[scope()],rosterVersionId:null};}
 function issueCredential(options){const {ttlMs}=ownFields(options,['ttlMs']);const stamp=active();if(!Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>60000)deny('INVALID_ARGUMENTS');
  for(const [key,r]of tokens)if(r.revoked||Date.parse(r.claims.expiresAt)<=stamp){tokens.delete(key);ids.delete(r.claims.capabilityId);}
  if(tokens.size>=128)deny('RESOURCE_LIMIT');
  const capabilityId=newId();active();
  const claims=frozenData({capabilityId,issuer:'meri-synthetic-local-action',audience:'meri-gateway',binding:state.binding,actions:['tool.read'],scopes:[scope()],issuedAt:new Date(stamp).toISOString(),expiresAt:new Date(Math.min(stamp+ttlMs,state.deadlineMs)).toISOString(),policyRevision:state.policyRevision,budgets:state.budgets});
  validateShape('CapabilityClaims',claims);if(ids.has(capabilityId))deny('GATEWAY_CONFIGURATION');
  const credential=`local_action_${randomBytes(32).toString('base64url')}`,capabilitySha256=digest(credential),record={claims,revoked:false};
  active();tokens.set(capabilitySha256,record);ids.set(capabilityId,record);return frozenData({credential,claims,capabilitySha256});
 }
 const authorityPorts=Object.freeze({
  async verifyCapability(credential,options){const {signal}=ownFields(options,[],['signal']);if(typeof credential!=='string'||!/^local_action_[A-Za-z0-9_-]{43}$/u.test(credential))deny('ACCESS_DENIED');const record=tokens.get(digest(credential));current(record,signal);return JSON.stringify(record.claims);},
  async currentRun(binding,options){const {signal}=ownFields(options,[],['signal']);const value=frozenData(binding),stamp=active(signal);if(!same(value,state.binding))deny('ACCESS_DENIED');return JSON.stringify({binding:state.binding,policyRevision:state.policyRevision,deadlineMs:state.deadlineMs,checkedAtMs:stamp});},
  async authorizeBusiness(call){const {claims,operation:requested,requiredGrants,input,signal}=ownFields(call,['claims','operation','requiredGrants','input'],['signal']);issued(claims,signal);
   const selected=frozenData(input);privateShape('ActionItemsCompleteNormalized',selected);
   if(!same(frozenData(requested),operation)||!same(frozenData(requiredGrants),descriptor.requiredGrants)||selected.mode!=='client_scoped'||selected.selection.clientId!==state.clientId||!state.clientAllowed||descriptor.requiredGrants.some(g=>!state.grants.includes(g)))deny('ACCESS_DENIED');
   const decisionId=newId(),stamp=active(signal),s=subject(decisionId);assertSubject(s,state.binding);
   const decision={decisionId,actor:{tenantId:state.binding.tenantId,actorId:state.binding.actorId},operation:'actions.query@0.2.0',scopes:s.scopes,policyRevision:state.policyRevision,evaluatedAt:new Date(stamp).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_LOCAL_CURRENT_STATE'};
   validateShape('AuthorizationDecision',decision);issued(claims,signal);return JSON.stringify({decision,subject:s,grants:state.grants});},
  async authorizeSources(call){const {claims,subject:value,sourceRequirements,signal}=ownFields(call,['claims','subject','sourceRequirements'],['signal']);issued(claims,signal);const s=frozenData(value);assertSubject(s,state.binding);
   if(!same(s,subject(s.authorizationDecisionId))||!same(frozenData(sourceRequirements),descriptor.sourceRequirements)||!state.sourceEnabled||!state.clientAllowed||descriptor.requiredGrants.some(g=>!state.grants.includes(g)))deny('ACCESS_DENIED');
   const stamp=active(signal);return JSON.stringify({sourceIds:descriptor.sourceRequirements.map(x=>x.sourceId),enabled:true,policyRevision:state.policyRevision,checkedAtMs:stamp});}
 });
 const owner=Object.freeze({issueCredential,authorityPorts,
  revoke(credential){if(typeof credential!=='string')deny('INVALID_ARGUMENTS');const record=tokens.get(digest(credential));if(record)record.revoked=true;},
  updatePolicy(value){active();const next=frozenData(ownFields(value,['expectedRevision','revision','clientAllowed','sourceEnabled','grants']));if(next.expectedRevision!==state.policyRevision||typeof next.clientAllowed!=='boolean')deny('ACCESS_DENIED');const proposed={...state,policyRevision:next.revision,clientAllowed:next.clientAllowed,sourceEnabled:next.sourceEnabled,grants:next.grants};configuration(proposed);state=proposed;},
  replaceRun(value){active();const next=frozenData(ownFields(value,['expectedBinding','binding','policyRevision','deadlineMs']));if(!same(next.expectedBinding,state.binding)||['tenantId','actorId','conversationId','runId'].some(k=>next.binding[k]!==state.binding[k])||next.binding.writerFence!==state.binding.writerFence+1||next.binding.attemptId===state.binding.attemptId||next.binding.workerId===state.binding.workerId||next.deadlineMs>state.deadlineMs)deny('ACCESS_DENIED');const proposed={...state,binding:next.binding,policyRevision:next.policyRevision,deadlineMs:next.deadlineMs};configuration(proposed);if(proposed.deadlineMs<=active())deny('ACCESS_DENIED');state=proposed;},
  status(){return frozenData({mode:'synthetic-local',closed,binding:state.binding,clientId:state.clientId,policyRevision:state.policyRevision,deadlineMs:state.deadlineMs,scopes:[scope()],clientAllowed:state.clientAllowed,sourceEnabled:state.sourceEnabled,grants:state.grants,issuedCredentials:tokens.size});},
  close(){closed=true;tokens.clear();ids.clear();}
 });owners.add(owner);return owner;
}
