/** Canonical gateway authority and dispatch over scripted per-tenant authority ports and one synthetic catalog entry.
 * Credentials are opaque strings the scripted verifier maps to a tenant's claims; nothing here is a production adapter. */
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {normalizeFederalMarketInput,validateFederalMarketShape} from '../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCurrentToolAuthority} from '../../apps/gateway/authorization/current-tool-authority.mjs';
import {createToolDispatch} from '../../apps/gateway/dispatch/tool-dispatch.mjs';
import {exactKeys} from '../../apps/gateway/dispatch/operation-result.mjs';
import {syntheticId} from './conversation-application.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const operation=Object.freeze({id:'search_federal_contract_awards',version:'0.2.0'});
export const limits=Object.freeze({maxRequestBytes:65536,maxResponseBytes:65536,maxRequestMs:2000,maxCleanupMs:100});
/** Scripted gateway facts for one tenant principal. Claims are what a trusted capability verifier would return; never model-supplied. */
export function gatewayPrincipal(principal,{tag,ttlMs=10000,now}){
 const {binding,tenantId,actorId}=principal,policyRevision=principal.scopes[0].policyRevision,scope={tenantId,kind:'tenant',resourceId:tenantId,policyRevision};
 const claims=()=>({capabilityId:syntheticId(tag,901),issuer:'scripted-issuer',audience:'meri-gateway',binding:structuredClone(binding),actions:['tool.read','command.execute'],scopes:[scope],issuedAt:new Date(now()-1000).toISOString(),expiresAt:new Date(now()+ttlMs).toISOString(),policyRevision,budgets:{maxTurns:5,maxRuntimeSeconds:10,maxCostMicrousd:100,maxOutputBytes:65536}});
 const subject=()=>({kind:'personal',entityType:'user',entityIds:[actorId],tenantId,actorId,authorizationDecisionId:syntheticId(tag,902),policyRevision,scopes:[scope],rosterVersionId:null});
 return Object.freeze({credential:`scripted-capability:${tenantId}:${binding.conversationId}`,binding,scope,claims,subject,policyRevision,ttlMs});
}
export function createScriptedGatewayDispatch({principals,now=Date.now,capabilityAction='tool.read'}){
 if(!Array.isArray(principals)||!principals.length)fail('TARGET_PRINCIPALS');
 const byCredential=new Map(principals.map(p=>[p.credential,p]));const calls=[];
 const ports={
  async verifyCapability(credential){calls.push('capability');const p=byCredential.get(credential);if(!p)throw Error('scripted capability refused');return JSON.stringify(p.claims());},
  async currentRun(binding){calls.push('run');const p=[...byCredential.values()].find(p=>canonicalSha256(p.binding)===canonicalSha256(binding));if(!p)throw Error('scripted run unknown');return JSON.stringify({binding:structuredClone(p.binding),policyRevision:p.policyRevision,deadlineMs:now()+p.ttlMs,checkedAtMs:now()});},
  async authorizeBusiness({claims,operation:op,requiredGrants}){calls.push('policy');const p=[...byCredential.values()].find(p=>p.binding.tenantId===claims.binding.tenantId&&p.binding.conversationId===claims.binding.conversationId);if(!p)throw Error('scripted policy unknown');
   return JSON.stringify({decision:{decisionId:syntheticId('0bad',902),actor:{tenantId:p.binding.tenantId,actorId:p.binding.actorId},operation:`${op.id}@${op.version}`,scopes:[p.scope],policyRevision:p.policyRevision,evaluatedAt:new Date(now()).toISOString(),decision:'allowed',reasonCode:'SCRIPTED_FIXTURE'},subject:{...p.subject(),authorizationDecisionId:syntheticId('0bad',902)},grants:[...requiredGrants]});},
  async authorizeSources({claims,sourceRequirements}){calls.push('sources');const p=[...byCredential.values()].find(p=>p.binding.tenantId===claims.binding.tenantId);if(!p)throw Error('scripted sources unknown');
   return JSON.stringify({sourceIds:[...new Set(sourceRequirements.map(s=>s.sourceId))],enabled:true,policyRevision:p.policyRevision,checkedAtMs:now()});}};
 const authority=createCurrentToolAuthority({ports,now,maxFactBytes:65536,capabilityAction});
 const descriptor={operation,requiredGrants:['scripted.read'],sourceRequirements:[{sourceId:'scripted-source',authority:'authoritative',purpose:'enumeration'}]};
 const contract={normalizeInput(args){const r=normalizeFederalMarketInput(operation.id,args);return {request:args,input:r.query,metadata:r,argumentsSha256:canonicalSha256(r.query)};},
  assertOutput(value){exactKeys(value,['binding','subject','data'],'INVALID_RESULT');return validateFederalMarketShape('SearchFederalContractAwardsOutput',value.data);}};
 const page=()=>({items:[],total:0,page:1,pageSize:10,source:'scripted',asOf:new Date(now()).toISOString(),generatedAt:new Date(now()).toISOString(),hasMore:false,nextPage:null,paginationLimitReached:false,tool:operation.id});
 /** The honest handler answers with the lineage of the authority it was dispatched under. */
 const ownHandler=async({authority:a})=>JSON.stringify({binding:a.binding,subject:a.subject,data:page()});
 const budget={async reserve({reservationId}){calls.push('reserve');return JSON.stringify({reservationId,decision:'reserved'});},async settle({reservationId}){calls.push('settle');return JSON.stringify({reservationId,decision:'settled'});},async markUncertain(){calls.push('uncertain');}};
 let ids=100;const dispatchWith=handler=>createToolDispatch({catalog:{entry:()=>({descriptor,contract,async execute(call){calls.push('handler');return handler(call);}}),discoverable:()=>[]},authority,budget,limits,now,newId:()=>syntheticId('d15b',ids++),sourceEnabled:true});
 const dispatch=dispatchWith(ownHandler);
 return Object.freeze({authority,calls,descriptor,page,execute:(requestJson,credential,signal)=>dispatch.execute(requestJson,credential,signal),
  executeWith:(handler,requestJson,credential,signal)=>dispatchWith(handler).execute(requestJson,credential,signal)});
}
