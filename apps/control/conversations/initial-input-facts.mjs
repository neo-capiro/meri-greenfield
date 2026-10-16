/** Original-input identity facts. Validation supplies no authority and never infers freshness from an absent run or a grant. */
import {bounded,own,hash,same,fail,uuid,validateShape} from './boundary.mjs';
import {receiveConversationRequest} from '../../../packages/contracts/dist/conversation-application.mjs';
import {assertConversationInputReceipt} from '../../../packages/contracts/conversation-input/validate.mjs';
const identityKeys=['binding','scopes','versions','selectedClientId','requestId','inputSha256','requestSha256'];
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
export function assertOriginalInputFacts(raw){
 const f=bounded(raw);own(f,[...identityKeys,'allocatedAtMs','expiresAtMs']);validateShape('RunBinding',f.binding);validateShape('RuntimeVersions',f.versions);uuid(f.requestId);uuid(f.selectedClientId);
 if(f.binding.writerFence!==1||!Array.isArray(f.scopes)||f.scopes.length<1||f.scopes.length>100||!integer(f.allocatedAtMs)||!integer(f.expiresAtMs)||f.expiresAtMs<=f.allocatedAtMs||!digest(f.inputSha256)||!digest(f.requestSha256))fail('INITIAL_INPUT_REFUSED');
 for(const scope of f.scopes){validateShape('Scope',scope);if(scope.tenantId!==f.binding.tenantId||scope.policyRevision!==f.scopes[0].policyRevision)fail('INITIAL_INPUT_REFUSED');}
 if(new Set(f.scopes.map(hash)).size!==f.scopes.length||!f.scopes.some(s=>s.kind==='client'&&s.resourceId===f.selectedClientId))fail('INITIAL_INPUT_REFUSED');return f;
}
/** Trusted service prepares the canonical StoredRequest once using allocatedAtMs; public validators own its input correlation. */
export async function prepareOriginalInputFacts({binding,scopes,versions,selectedClientId,input,request,allocatedAtMs,expiresAtMs}){
 const i=receiveConversationRequest('submit',new TextEncoder().encode(JSON.stringify(bounded(input)))),r=bounded(request);
 const f=assertOriginalInputFacts({binding,scopes,versions,selectedClientId,requestId:i.requestId,inputSha256:hash(i),requestSha256:hash(r),allocatedAtMs,expiresAtMs});
 const run={binding:f.binding,state:'queued',scopes:f.scopes,versions:f.versions,createdAt:new Date(f.allocatedAtMs).toISOString(),policyRevision:f.scopes[0].policyRevision};
 // This is semantic validation only, never an event, stored admission, dispatch or proof a run exists.
 await assertConversationInputReceipt({run,request:r,lastSequence:1,replayed:false},i);return f;
}
export function sameOriginalInputIdentity(left,right){return identityKeys.every(key=>same(left[key],right[key]));}
export function assertOriginalInputActive(facts,at){if(!integer(at)||at<facts.allocatedAtMs||at>=facts.expiresAtMs)fail('INITIAL_INPUT_EXPIRED');}
export function assertOriginalInputAcceptance(facts,{run,request,selectedClientId}){
 const f=assertOriginalInputFacts(facts);if(!same(f.binding,run.binding)||!same(f.scopes,run.scopes)||!same(f.versions,run.versions)||run.policyRevision!==f.scopes[0].policyRevision||selectedClientId!==f.selectedClientId||request.requestId!==f.requestId||hash(request)!==f.requestSha256)fail('INITIAL_INPUT_CONFLICT');return f;
}
/** Proposed additive wire envelope, kept internal until exact public source review. No bearer or prompt text is released. */
export function originalInputReceipt(facts,state,created){
 const allocation=assertOriginalInputFacts(facts);
 if(!['RESERVED','ACCEPTED'].includes(state)||typeof created!=='boolean'||created&&state!=='RESERVED')fail('INITIAL_INPUT_CORRUPT');return {allocation,state,created};
}
