/** Correlation only: the configured install/admission owners establish actual provenance. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
const fault=()=>{throw Object.assign(Error('SKILL_CURRENT_RECEIPT_REFUSED'),{code:'SKILL_CURRENT_RECEIPT_REFUSED'});};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x),uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(x);
function pins(r,input,started,now,life){if(!same(r.binding,input.binding)||!same(r.skill,input.skill)||r.requestSha256!==input.requestSha256||r.selectionSha256!==input.selectionSha256||
 !Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now())fault();life.limitDeadline(r.expiresAtMs);}
export function assertSkillInstallation(raw,{input,selected,started,now,life,previous}) {
 const r=data(own(raw,['binding','skill','requestSha256','selectionSha256','baseCatalogSha256','installationId','executionCatalogSha256','operations','checkedAtMs','expiresAtMs']));pins(r,input,started,now,life);
 if(r.baseCatalogSha256!==selected.pin.catalogSha256||!uuid(r.installationId)||!digest(r.executionCatalogSha256)||!Array.isArray(r.operations)||r.operations.length>selected.manifest.allowedOperations.length)fault();
 const seen=new Set();for(const value of r.operations){const op=own(value,['operation','descriptorSha256','handlerSourceSha256','qualificationReceiptId']),key=canonicalSha256(op.operation);
  if(seen.has(key)||!selected.manifest.allowedOperations.some(ref=>same(ref,op.operation))||op.descriptorSha256!==canonicalSha256(resolveOperationContract(op.operation).descriptor)||!digest(op.handlerSourceSha256)||!uuid(op.qualificationReceiptId))fault();seen.add(key);}
 if(previous&&!same({...r,checkedAtMs:0,expiresAtMs:0},{...previous,checkedAtMs:0,expiresAtMs:0}))fault();return r;
}
export function assertSkillRun(raw,{input,selected,scopes,started,now,life,previous}) {
 const r=data(own(raw,['binding','skill','requestSha256','selectionSha256','manifestSha256','catalogSha256','budgets','allocationSha256','policyRevision','checkedAtMs','expiresAtMs']));pins(r,input,started,now,life);
 if(r.manifestSha256!==selected.pin.manifestSha256||r.catalogSha256!==selected.pin.catalogSha256||!same(r.budgets,selected.manifest.budgets)||!digest(r.allocationSha256)||scopes.some(s=>s.policyRevision!==r.policyRevision))fault();
 if(previous&&!same({...r,checkedAtMs:0,expiresAtMs:0},{...previous,checkedAtMs:0,expiresAtMs:0}))fault();return r;
}
