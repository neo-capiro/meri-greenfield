/** Canonical gateway authority and dispatch over scripted per-tenant authority ports and one synthetic catalog entry.
 * Credentials are opaque strings the scripted verifier maps to a tenant's claims; nothing here is a production adapter. */
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {normalizeFederalMarketInput,validateFederalMarketShape} from '../../packages/contracts/retrieval-0.2/validate.mjs';
import {createToolDispatch} from '../../apps/gateway/dispatch/tool-dispatch.mjs';
import {exactKeys} from '../../apps/gateway/dispatch/operation-result.mjs';
import {createExecutionBinding} from '../../apps/control/conversations/execution-boundary.mjs';
import {versions} from '../../apps/control/conversations/test/store-fixture.mjs';
import {syntheticId} from './conversation-application.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const operation=Object.freeze({id:'search_federal_contract_awards',version:'0.2.0'});
export const limits=Object.freeze({maxRequestBytes:65536,maxResponseBytes:65536,maxRequestMs:2000,maxCleanupMs:100});
/** Scripted gateway facts for one tenant principal. Claims are what a trusted capability verifier would return; never model-supplied. */
export function gatewayPrincipal(principal,{tag,ttlMs=60000,now}){
 const {binding,tenantId,actorId}=principal,policyRevision=principal.scopes[0].policyRevision,scope={tenantId,kind:'tenant',resourceId:tenantId,policyRevision},runDeadlineMs=now()+ttlMs;
 const claims=()=>({capabilityId:syntheticId(tag,901),issuer:'scripted-issuer',audience:'meri-gateway',binding:structuredClone(binding),actions:['tool.read','command.execute'],scopes:[scope],issuedAt:new Date(now()-1000).toISOString(),expiresAt:new Date(now()+ttlMs).toISOString(),policyRevision,budgets:{maxTurns:5,maxRuntimeSeconds:10,maxCostMicrousd:100,maxOutputBytes:65536}});
 const subject=()=>({kind:'personal',entityType:'user',entityIds:[actorId],tenantId,actorId,authorizationDecisionId:syntheticId(tag,902),policyRevision,scopes:[scope],rosterVersionId:null});
 return Object.freeze({credential:`scripted-capability:${tenantId}:${binding.conversationId}`,binding,scope,claims,subject,policyRevision,ttlMs,runDeadlineMs});
}
/** Build a frozen identity object from a gateway principal using canonical execution binding.
 * runtimeSessionId must be >=33 chars; synthetic tag padded to satisfy the pattern. */
function principalIdentity(p,now){
 const expiresAtMs=p.runDeadlineMs,runtimeSessionId=`synthetic-gateway-session-${p.binding.conversationId}`;
 const {versions:_ignored,...execution}=createExecutionBinding({binding:structuredClone(p.binding),versions,plan:{synthetic:true},expiresAtMs,runtimeSessionId});
 const executionSha256=canonicalSha256(execution);
 /** ResolvedSubject omits authorizationDecisionId; contextFor passes this to assertReadContext. */
 const {authorizationDecisionId:_omit,...resolvedSubject}=p.subject();
 return Object.freeze({execution,executionSha256,scopes:structuredClone([p.scope]),policyRevision:p.policyRevision,resolvedSubject:Object.freeze(resolvedSubject)});
}
export function createScriptedGatewayDispatch({principals,now=Date.now}){
 if(!Array.isArray(principals)||!principals.length)fail('TARGET_PRINCIPALS');
 const byCredential=new Map(principals.map(p=>[p.credential,p]));const calls=[];
 const descriptor={operation,requiredGrants:['scripted.read'],sourceRequirements:[{sourceId:'federal_market',authority:'authoritative',purpose:'enumeration'}],sideEffect:'none',approvalBoundary:'none'};
 const contract={normalizeInput(args){const r=normalizeFederalMarketInput(operation.id,args);return {request:args,input:r.query,metadata:r,argumentsSha256:canonicalSha256(r.query)};},
  assertOutput(value){exactKeys(value,['binding','subject','data'],'INVALID_RESULT');return validateFederalMarketShape('SearchFederalContractAwardsOutput',value.data);}};
 const page=()=>({items:[],total:0,page:1,pageSize:10,source:'scripted',asOf:new Date(now()).toISOString(),generatedAt:new Date(now()).toISOString(),hasMore:false,nextPage:null,paginationLimitReached:false,tool:operation.id});
 /** The honest handler answers with the lineage of the authority it was dispatched under. */
 const ownHandler=async({authority:a})=>JSON.stringify({binding:a.binding,subject:a.subject,data:page()});
 let ids=100;
 /** Build a createToolDispatch instance for a single known principal; current/contextFor derive from that principal. */
 function dispatchFor(p,handler){
  const identity=principalIdentity(p,now);
  const current=async()=>{calls.push('current');return structuredClone(identity);};
  const contextFor=async({entry})=>{calls.push('context');
   return {binding:structuredClone(p.binding),subject:structuredClone(identity.resolvedSubject),executionSha256:identity.executionSha256,policyRevision:p.policyRevision,
    scopes:structuredClone([p.scope]),sourceIds:[...new Set(entry.descriptor.sourceRequirements.map(s=>s.sourceId))],
    deadlineMs:identity.execution.expiresAtMs,maxOutputBytes:65536};};
  return createToolDispatch({catalog:{entry:()=>({descriptor,contract,async execute(call){calls.push('handler');return handler(call);}}),discoverable:()=>[]},
   current,contextFor,limits,now,newId:()=>syntheticId('d15b',ids++),sourceEnabled:true});
 }
 /** execute(requestJson, credential, signal) keeps the existing caller interface; dispatch is created per credential. */
 const execute=async(requestJson,credential,signal)=>{const p=byCredential.get(credential);if(!p)fail('ACCESS_DENIED');return dispatchFor(p,ownHandler).execute(requestJson,signal);};
 const executeWith=async(handler,requestJson,credential,signal)=>{const p=byCredential.get(credential);if(!p)fail('ACCESS_DENIED');return dispatchFor(p,handler).execute(requestJson,signal);};
 return Object.freeze({calls,descriptor,page,execute,executeWith});
}
