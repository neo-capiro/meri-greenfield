/** Original selection uses the existing session admission and canonical run owner. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,assertWindow} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {describeSkillPlugin} from '../../../../packages/skills/plugin.mjs';
import {assertNativeConversationScope} from '../../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const fault=()=>Object.assign(Error('SKILL_ADMISSION_REFUSED'),{code:'SKILL_ADMISSION_REFUSED'}),fail=()=>{throw fault();};
export function createOriginalSkillAdmissionOwner(configuration){
 const c=own(configuration,['binding','loadConversation','readSelection','readCurrentContext','now'],['maxRequestMs']);
 const binding=data(c.binding),maxRequestMs=c.maxRequestMs??3000;validateShape('RunBinding',binding);
 if(['loadConversation','readSelection','readCurrentContext','now'].some(k=>typeof c[k]!=='function')||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail();
 function lifetime(signal,deadlineMs=c.now()+maxRequestMs){if(!Number.isSafeInteger(deadlineMs)||deadlineMs<=c.now())fail();return createOperationLifetime({deadlineMs:Math.min(deadlineMs,c.now()+maxRequestMs),now:c.now,signal,errorFactory:fault});}
 async function selectionReceipt({request,scopes,selectedClientId,life}){
  request=data(request);scopes=data(scopes);scopes.forEach(s=>validateShape('Scope',s));
  const selected=selectSkill(request.skill.skillId,request.skill.skillVersion);
  if(!same(request.skill,selected.pin)||!describeSkillPlugin({selection:selected.pin}).skills.some(s=>s.skillId===selected.pin.skillId&&s.skillVersion===selected.pin.skillVersion))fail();
  assertNativeConversationScope({binding,scopes,selectedClientId});assertWindow(request.window);
  if(!selected.manifest.windowBases.includes(request.window.basis))fail();
  let selection;
  if(selectedClientId===null){
   if(!selected.manifest.subjectKinds.some(kind=>kind==='portfolio'||kind==='personal'))fail();
   // General is the actor's admitted private conversation. This pins its context,
   // not a resolved portfolio roster; each native read still authorizes actual clients.
   selection={scopes,selectedClientId:null,window:request.window};
  }else{
   if(!selected.manifest.subjectKinds.includes('client'))fail();
   selection=data(own(await life.run(signal=>c.readSelection({binding,request,scopes,selectedClientId,signal})),['subject','window','mondayBoardIds']));
   assertSubject(selection.subject,binding);assertWindow(selection.window);
   if(selection.subject.kind!=='client'||selection.subject.entityType!=='client'||selection.subject.entityIds.length!==1||selection.subject.entityIds[0]!==selectedClientId||!same(selection.subject.scopes,scopes)||!same(selection.window,request.window)||!Array.isArray(selection.mondayBoardIds)||selection.mondayBoardIds.some(id=>typeof id!=='string'||!id)||new Set(selection.mondayBoardIds).size!==selection.mondayBoardIds.length)fail();
  }
  life.check();return {binding,skill:selected.pin,requestSha256:canonicalSha256(request),selectionSha256:canonicalSha256(selection),manifestSha256:selected.pin.manifestSha256,catalogSha256:selected.pin.catalogSha256,budgets:selected.manifest.budgets,policyRevision:scopes[0].policyRevision,checkedAtMs:c.now(),expiresAtMs:life.deadline()};
 }
 /** The conversation service supplies its already-authenticated scope/deadline and
  * rechecks that same session around persistence. No execution exists at this point. */
 async function admitSelection(value){
  const {signal,...raw}=own(value,['binding','request','scopes','selectedClientId','deadlineMs'],['signal']);nativeSignal(signal);const input=data(raw);if(!same(input.binding,binding))fail();const life=lifetime(signal,input.deadlineMs);
  try{return data({...await selectionReceipt({...input,life}),scopes:input.scopes,selectedClientId:input.selectedClientId});}catch{throw fault();}finally{life.close();}
 }
 /** Runtime checks use the authenticated execution's canonical run/context;
  * actual Core data access remains in the typed read gateway. */
 async function currentSkillRun(value){
  const {signal,...raw}=own(value,['binding','skill','requestSha256','selectionSha256'],['signal']);nativeSignal(signal);const input=data(raw);if(!same(input.binding,binding))fail();const life=lifetime(signal);
  try{
   const saved=data(await life.run(signal=>c.loadConversation({binding,signal})));if(!same(saved.run.binding,binding)||!['queued','starting','running'].includes(saved.run.state))fail();
   const started=c.now(),current=data(own(await life.run(signal=>c.readCurrentContext({binding,signal})),['binding','scopes','selectedClientId','checkedAtMs','expiresAtMs']));
   if(!same(current.binding,binding)||!same(current.scopes,saved.run.scopes)||!Number.isSafeInteger(current.checkedAtMs)||current.checkedAtMs<started||current.checkedAtMs>c.now()||!Number.isSafeInteger(current.expiresAtMs)||current.expiresAtMs<=c.now())fail();
   life.limitDeadline(current.expiresAtMs);const result=await selectionReceipt({request:saved.request,scopes:saved.run.scopes,selectedClientId:current.selectedClientId,life});
   if(!same(input,{binding,skill:result.skill,requestSha256:result.requestSha256,selectionSha256:result.selectionSha256}))fail();
   const after=data(await life.run(signal=>c.loadConversation({binding,signal})));if(!same(after.run.binding,saved.run.binding)||!same(after.run.scopes,saved.run.scopes)||!same(after.request,saved.request)||!['queued','starting','running'].includes(after.run.state))fail();
   life.check();return data({...result,checkedAtMs:c.now(),expiresAtMs:current.expiresAtMs});
  }catch{throw fault();}finally{life.close();}
 }
 return Object.freeze({admitSelection,currentSkillRun});
}
