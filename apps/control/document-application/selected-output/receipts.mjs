/** Current callback receipts correlate trusted native owners; callbacks are not model input. */
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {configuration} from '../current.mjs';
import {same,hash,fail} from './preparation.mjs';
/** Core's existing decision is the durable approval identity; no bridge receipt is minted. */
export function selectedApprovalDecision(raw,{binding,policyRevision,now}){
 const decision=data(raw);validateShape('ApprovalDecision',decision);
 if(decision.decision!=='approved'||!same(decision.approver,{tenantId:binding.tenantId,actorId:binding.actorId})||decision.policyRevision!==policyRevision||Date.parse(decision.decidedAt)>now()||Date.parse(decision.expiresAt)<=now()||Date.parse(decision.expiresAt)<=Date.parse(decision.decidedAt))fail('SELECTED_OUTPUT_APPROVAL');
 return decision;
}
function fresh(r,started,now,life){if(!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now())fail('SELECTED_OUTPUT_CURRENT');life.limitDeadline(r.expiresAtMs);}
export function approvedReceipt(raw,{source,started,now,life,previous}){
 const r=data(own(raw,['sourcePinsSha256','outputBinding','scopes','policyRevision','approvalDecision','projectionRecipe','deadlineMs','maxBytes','checkedAtMs','expiresAtMs']));
 validateShape('RunBinding',r.outputBinding);const a=source.sourcePins.sourceBinding,b=r.outputBinding;
 selectedApprovalDecision(r.approvalDecision,{binding:a,policyRevision:r.policyRevision,now});life.limitDeadline(Date.parse(r.approvalDecision.expiresAt));
 if(r.sourcePinsSha256!==hash(source.sourcePins)||r.projectionRecipe!=='original-selected-docx/1'||['tenantId','actorId','conversationId'].some(k=>a[k]!==b[k])||(a.runId===b.runId?!same(a,b):['attemptId','workerId'].some(k=>a[k]===b[k]))||!same(r.scopes,source.context.scopes)||r.scopes.some(s=>s.policyRevision!==r.policyRevision)||!Number.isSafeInteger(r.deadlineMs)||r.deadlineMs<=now()||!Number.isSafeInteger(r.maxBytes)||r.maxBytes<1||r.maxBytes>1048576)fail('SELECTED_OUTPUT_APPROVAL');
 fresh(r,started,now,life);life.limitDeadline(r.deadlineMs);if(previous&&!same({...r,checkedAtMs:0,expiresAtMs:0},{...previous,checkedAtMs:0,expiresAtMs:0}))fail('SELECTED_OUTPUT_APPROVAL_CHANGED');return r;
}
export function checkOutputConfiguration(documentOptions,receipt,source){
 const options=own(documentOptions,['sessions','selectedClientId','artifactOptions','now','limits'],['enabled','admitPdf','previewOptions','nativeFiles']),context=v.context(options.artifactOptions.context);
 configuration(options);
 if(!same(context.binding,receipt.outputBinding)||!same(context.scopes,receipt.scopes)||receipt.deadlineMs>context.deadlineMs||receipt.maxBytes>context.maxBytes||options.selectedClientId!==source.sourcePins.selection.subject.entityIds[0]||options.enabled!==true)fail('SELECTED_OUTPUT_CONTEXT');
 return options;
}
export function sourceAccessReceipt(raw,{source,outputBinding,started,now,life}){
 const r=data(own(raw,['sourceBinding','outputBinding','sourcePinsSha256','evidenceSha256','scopes','policyRevision','checkedAtMs','expiresAtMs']));
 if(!same(r.sourceBinding,source.sourcePins.sourceBinding)||!same(r.outputBinding,outputBinding)||r.sourcePinsSha256!==hash(source.sourcePins)||r.evidenceSha256!==hash(source.context.evidence)||!same(r.scopes,source.context.scopes)||r.scopes.some(s=>s.policyRevision!==r.policyRevision))fail('SELECTED_OUTPUT_SOURCE_ACCESS');fresh(r,started,now,life);return r;
}
