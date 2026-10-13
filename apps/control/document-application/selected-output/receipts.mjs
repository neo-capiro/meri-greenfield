/** Current callback receipts correlate trusted native owners; callbacks are not model input. */
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators as v,validateShape as retrievalShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {same,hash,fail} from './preparation.mjs';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(x),digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x);
function fresh(r,started,now,life){if(!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now())fail('SELECTED_OUTPUT_CURRENT');life.limitDeadline(r.expiresAtMs);}
export function approvedReceipt(raw,{source,started,now,life,previous}){
 const r=data(own(raw,['sourcePinsSha256','outputBinding','scopes','policyRevision','allocationSha256','grantId','approvalReceiptId','projectionRecipe','deadlineMs','maxBytes','checkedAtMs','expiresAtMs']));
 validateShape('RunBinding',r.outputBinding);const a=source.sourcePins.sourceBinding,b=r.outputBinding;
 if(r.sourcePinsSha256!==hash(source.sourcePins)||r.projectionRecipe!=='original-selected-docx/1'||['tenantId','actorId','conversationId'].some(k=>a[k]!==b[k])||['runId','attemptId','workerId'].some(k=>a[k]===b[k])||!same(r.scopes,source.context.scopes)||r.scopes.some(s=>s.policyRevision!==r.policyRevision)||!digest(r.allocationSha256)||![r.grantId,r.approvalReceiptId].every(uuid)||!Number.isSafeInteger(r.deadlineMs)||r.deadlineMs<=now()||!Number.isSafeInteger(r.maxBytes)||r.maxBytes<1||r.maxBytes>1048576)fail('SELECTED_OUTPUT_APPROVAL');
 fresh(r,started,now,life);life.limitDeadline(r.deadlineMs);if(previous&&!same({...r,checkedAtMs:0,expiresAtMs:0},{...previous,checkedAtMs:0,expiresAtMs:0}))fail('SELECTED_OUTPUT_APPROVAL_CHANGED');return r;
}
export function checkOutputConfiguration(documentOptions,receipt,source){
 const options=own(documentOptions,['sessions','selectedClientId','artifactOptions','credential','now','limits'],['enabled']),o=options.artifactOptions,context=v.context(o.context),producer=o.producerContext;
 const allocation=data(JSON.parse(o.allocationJson));retrievalShape('SkillManifest',allocation.manifest);
 if(!same(context.binding,receipt.outputBinding)||!same(context.scopes,receipt.scopes)||!same(producer.context.binding,receipt.outputBinding)||producer.context.grantId!==receipt.grantId||producer.context.allocationSha256!==receipt.allocationSha256||producer.context.qualificationBinding.policyRevision!==receipt.policyRevision||!same(allocation.run,Object.fromEntries(Object.keys(allocation.run).map(k=>[k,receipt.outputBinding[k]])))||hash(allocation)!==receipt.allocationSha256||allocation.manifestSha256!==hash(allocation.manifest)||!same(allocation.budgets,allocation.manifest.budgets)||!allocation.manifest.allowedOperations.some(op=>same(op,{id:'create_word',version:'0.2.0'}))||
 allocation.manifestSha256===source.skill.pin.manifestSha256||receipt.deadlineMs>options.now()+allocation.budgets.maxRuntimeSeconds*1000||receipt.maxBytes>allocation.budgets.maxOutputBytes||receipt.deadlineMs>Date.parse(allocation.schedule.expiresAt)||receipt.deadlineMs>context.deadlineMs||receipt.maxBytes>context.maxBytes||options.selectedClientId!==source.sourcePins.selection.subject.entityIds[0]||o.sourceEnabled!==true||options.enabled!==true)fail('SELECTED_OUTPUT_ALLOCATION');
 return options;
}
export function sourceAccessReceipt(raw,{source,outputBinding,started,now,life}){
 const r=data(own(raw,['sourceBinding','outputBinding','sourcePinsSha256','evidenceSha256','scopes','policyRevision','accessReceiptId','checkedAtMs','expiresAtMs']));
 if(!same(r.sourceBinding,source.sourcePins.sourceBinding)||!same(r.outputBinding,outputBinding)||r.sourcePinsSha256!==hash(source.sourcePins)||r.evidenceSha256!==hash(source.context.evidence)||!same(r.scopes,source.context.scopes)||r.scopes.some(s=>s.policyRevision!==r.policyRevision)||!uuid(r.accessReceiptId))fail('SELECTED_OUTPUT_SOURCE_ACCESS');fresh(r,started,now,life);return r;
}
