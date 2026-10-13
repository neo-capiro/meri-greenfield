/** Original selection over the existing current conversation and durable allocation owners. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {allocation} from '../../../gateway/budget/tool-budget-binding.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),fail=()=>{throw Object.assign(Error('SKILL_ADMISSION_REFUSED'),{code:'SKILL_ADMISSION_REFUSED'});};
export function createOriginalSkillAdmissionOwner(configuration){
 const {binding:rawBinding,admittedRun,loadConversation,readSelection,now,maxRequestMs=3000}=own(configuration,['binding','admittedRun','loadConversation','readSelection','now'],['maxRequestMs']);
 const binding=data(rawBinding);validateShape('RunBinding',binding);
 if(typeof admittedRun?.currentAllocation!=='function'||typeof loadConversation!=='function'||typeof readSelection!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail();
 async function currentSkillRun(value){const {signal,...rawInput}=own(value,['binding','skill','requestSha256','selectionSha256'],['signal']);nativeSignal(signal);const input=data(rawInput);if(!same(input.binding,binding))fail();
  const life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal,errorFactory:()=>Object.assign(Error('SKILL_ADMISSION_REFUSED'),{code:'SKILL_ADMISSION_REFUSED'})});
  try{const started=now(),saved=await life.run(signal=>loadConversation({binding,signal})),selected=selectSkill(input.skill.skillId,input.skill.skillVersion);
   if(!same(saved.run.binding,binding)||!same(saved.request.skill,selected.pin)||!same(input.skill,selected.pin)||canonicalSha256(saved.request)!==input.requestSha256)fail();
   const selection=data(await life.run(signal=>readSelection({binding,request:saved.request,scopes:saved.run.scopes,signal})));if(canonicalSha256(selection)!==input.selectionSha256||!same(selection.window,saved.request.window)||!same(selection.subject.scopes,saved.run.scopes))fail();
   const raw=await life.run(signal=>admittedRun.currentAllocation(binding,{signal}));if(typeof raw!=='string'||Buffer.byteLength(raw)>131072)fail();const receipt=data(JSON.parse(raw));own(receipt,['binding','policyRevision','deadlineMs','checkedAtMs','allocation','allocationSha256']);
   const a=allocation(JSON.stringify(receipt.allocation));if(!same(receipt.binding,binding)||!same(a.manifest,selected.manifest)||a.manifestSha256!==selected.pin.manifestSha256||a.catalogSha256!==selected.pin.catalogSha256||!same(a.budgets,selected.manifest.budgets)||receipt.allocationSha256!==canonicalSha256(a)||saved.run.scopes.some(s=>s.policyRevision!==receipt.policyRevision)||!Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>now()||!Number.isSafeInteger(receipt.deadlineMs)||receipt.deadlineMs<=now())fail();life.limitDeadline(receipt.deadlineMs);
   const after=await life.run(signal=>loadConversation({binding,signal}));if(!same(after.run.binding,saved.run.binding)||!same(after.run.scopes,saved.run.scopes)||!same(after.request,saved.request))fail();
   life.check();return {binding,skill:selected.pin,requestSha256:input.requestSha256,selectionSha256:input.selectionSha256,manifestSha256:a.manifestSha256,catalogSha256:a.catalogSha256,budgets:a.budgets,allocationSha256:receipt.allocationSha256,policyRevision:receipt.policyRevision,checkedAtMs:now(),expiresAtMs:receipt.deadlineMs};
  }finally{life.close();}}
 return Object.freeze({currentSkillRun});
}
