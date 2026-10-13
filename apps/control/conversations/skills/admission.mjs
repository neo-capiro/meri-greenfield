/** Original selection over the existing opaque session and durable allocation owners. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,assertWindow} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertSkillInstallation,assertSkillRun} from '../../../../packages/contracts/selected-skills/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {allocation} from '../../../gateway/budget/tool-budget-binding.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const fault=()=>Object.assign(Error('SKILL_ADMISSION_REFUSED'),{code:'SKILL_ADMISSION_REFUSED'}),fail=()=>{throw fault();};
export function createOriginalSkillAdmissionOwner(configuration){
 const c=own(configuration,['binding','admittedRun','loadConversation','readSelection','readCurrentContext','readForSkill','now'],['maxRequestMs']);
 const binding=data(c.binding),runOwner=own(c.admittedRun,['currentAllocation'],['currentRun']),maxRequestMs=c.maxRequestMs??3000;
 validateShape('RunBinding',binding);
 if(typeof runOwner.currentAllocation!=='function'||['loadConversation','readSelection','readCurrentContext','readForSkill','now'].some(k=>typeof c[k]!=='function')||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail();
 function lifetime(signal){return createOperationLifetime({deadlineMs:c.now()+maxRequestMs,now:c.now,signal,errorFactory:fault});}
 async function freshContext(life,expected){
  const started=c.now(),r=data(own(await life.run(signal=>c.readCurrentContext({binding,signal})),['binding','scopes','selectedClientId','checkedAtMs','expiresAtMs']));
  if(!same(r.binding,binding)||!same(r.scopes,expected.scopes)||r.selectedClientId!==expected.selectedClientId||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>c.now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=c.now())fail();
  life.limitDeadline(r.expiresAtMs);return r;
 }
 function selectionShape(raw,request,scopes,selectedClientId){
  const s=data(own(raw,['subject','window','mondayBoardIds']));assertSubject(s.subject,binding);assertWindow(s.window);
  if(s.subject.kind!=='client'||s.subject.entityType!=='client'||s.subject.entityIds.length!==1||s.subject.entityIds[0]!==selectedClientId||!same(s.subject.scopes,scopes)||!same(s.window,request.window)||!Array.isArray(s.mondayBoardIds)||s.mondayBoardIds.some(id=>typeof id!=='string'||!id)||new Set(s.mondayBoardIds).size!==s.mondayBoardIds.length)fail();return s;
 }
 async function check({request,scopes,selectedClientId,life,expectedInput}){
  request=data(request);scopes=data(scopes);scopes.forEach(s=>validateShape('Scope',s));
  const selected=selectSkill(request.skill.skillId,request.skill.skillVersion);
  if(!same(request.skill,selected.pin)||!['quick_skill.relationship_brief','quick_skill.commitments_audit'].includes(selected.pin.skillId)||!scopes.length||scopes.some(s=>s.tenantId!==binding.tenantId)||new Set(scopes.map(s=>s.policyRevision)).size!==1||typeof selectedClientId!=='string'||!selectedClientId)fail();
  const beforeContext=await freshContext(life,{scopes,selectedClientId});
  const readSelection=async()=>selectionShape(await life.run(signal=>c.readSelection({binding,request,scopes,selectedClientId,signal})),request,scopes,selectedClientId);
  const selection=await readSelection(),input={binding,skill:selected.pin,requestSha256:canonicalSha256(request),selectionSha256:canonicalSha256(selection)};
  if(expectedInput&&!same(input,expectedInput))fail();
  let started=c.now();const install=assertSkillInstallation(await life.run(signal=>c.readForSkill({...input,signal})),{input,selected,started,now:c.now,life});
  started=c.now();const raw=await life.run(signal=>runOwner.currentAllocation.call(c.admittedRun,binding,{signal}));
  if(typeof raw!=='string'||Buffer.byteLength(raw)>131072)fail();
  const native=data(own(JSON.parse(raw),['binding','policyRevision','deadlineMs','checkedAtMs','allocation','allocationSha256'])),a=allocation(JSON.stringify(native.allocation));
  if(!same(native.binding,binding)||!same(a.run,Object.fromEntries(Object.keys(a.run).map(k=>[k,binding[k]])))||!same(a.manifest,selected.manifest)||native.allocationSha256!==canonicalSha256(a)||scopes.some(s=>s.policyRevision!==native.policyRevision))fail();
  const run=assertSkillRun({binding,skill:selected.pin,requestSha256:input.requestSha256,selectionSha256:input.selectionSha256,manifestSha256:a.manifestSha256,catalogSha256:a.catalogSha256,budgets:a.budgets,allocationSha256:native.allocationSha256,policyRevision:native.policyRevision,checkedAtMs:native.checkedAtMs,expiresAtMs:native.deadlineMs},{input,selected,scopes,started,now:c.now,life});
  if(!same(selection,await readSelection()))fail();
  started=c.now();assertSkillInstallation(await life.run(signal=>c.readForSkill({...input,signal})),{input,selected,started,now:c.now,life,previous:install});
  const afterContext=await freshContext(life,{scopes,selectedClientId});life.check();return {run:{...run,checkedAtMs:c.now(),expiresAtMs:Math.min(run.expiresAtMs,install.expiresAtMs,beforeContext.expiresAtMs,afterContext.expiresAtMs)},install,selectedClientId,scopes};
 }
 async function admitSelection(value){
  const {signal,...raw}=own(value,['binding','request','scopes','selectedClientId'],['signal']);nativeSignal(signal);const input=data(raw);if(!same(input.binding,binding))fail();const life=lifetime(signal);
  try{const {run,install,scopes,selectedClientId}=await check({...input,life});return data({...run,scopes,selectedClientId,installationId:install.installationId,executionCatalogSha256:install.executionCatalogSha256,checkedAtMs:c.now(),expiresAtMs:Math.min(run.expiresAtMs,install.expiresAtMs)});}catch{throw fault();}finally{life.close();}
 }
 async function currentSkillRun(value){
  const {signal,...raw}=own(value,['binding','skill','requestSha256','selectionSha256'],['signal']);nativeSignal(signal);const input=data(raw);if(!same(input.binding,binding))fail();const life=lifetime(signal);
  try{const saved=data(await life.run(signal=>c.loadConversation({binding,signal})));if(!same(saved.run.binding,binding))fail();
   const current=data(await life.run(signal=>c.readCurrentContext({binding,signal}))),result=await check({request:saved.request,scopes:saved.run.scopes,selectedClientId:current.selectedClientId,life,expectedInput:input});
   const after=data(await life.run(signal=>c.loadConversation({binding,signal})));if(!same(after.run.binding,saved.run.binding)||!same(after.run.scopes,saved.run.scopes)||!same(after.request,saved.request))fail();life.check();return result.run;
  }catch{throw fault();}finally{life.close();}
 }
 return Object.freeze({admitSelection,currentSkillRun});
}
