/** Trusted control composition; the injected SDK runtime remains the sole model loop. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertSelectedOutput} from '../../../../packages/contracts/selected-skills/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {createCommitmentsAuditCompiler} from '../../document-application/commitments-audit/compose.mjs';
import {createRelationshipBriefCompiler} from '../../document-application/relationship-brief/compose.mjs';
const hash=canonicalSha256,same=(a,b)=>hash(a)===hash(b),fail=code=>{throw Object.assign(Error(code),{code});};
export function createOriginalSelectedSkillExecution(configuration){
 const c=own(configuration,['admissionForBinding','gatewayForBinding','readSelection','readContext','runtimeFactory','publishForBinding','retention','now','defaultCongress'],['outputBridge','readBase','readRevisionBase','newId']);
 if(['admissionForBinding','gatewayForBinding','readSelection','readContext','runtimeFactory','publishForBinding','now'].some(k=>typeof c[k]!=='function')||typeof c.retention?.retain!=='function'||!Number.isSafeInteger(c.defaultCongress)||c.outputBridge!==undefined&&['deliver','read'].some(k=>typeof c.outputBridge[k]!=='function'))fail('SKILL_EXECUTION_CONFIGURATION');
 const records=new Map(),eventId=value=>{const h=hash(value);return h.slice(0,8)+'-'+h.slice(8,12)+'-8'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
 async function prepare(value){const args=own(value,['binding','versions','request','scopes'],['signal','continuation','sourceRequest']);nativeSignal(args.signal);const binding=data(args.binding),request=data(args.request),scopes=data(args.scopes);validateShape('RunBinding',binding);
  const life=createOperationLifetime({deadlineMs:c.now()+3000,now:c.now,signal:args.signal,errorFactory:code=>Object.assign(Error(code),{code})});
  try{const selection=data(await life.run(signal=>c.readSelection({binding,request,scopes,signal}))),at=c.now(),raw=await life.run(signal=>c.readContext({binding,request,scopes,selection,signal}));
   const current=data(own(raw,['context','checkedAtMs','expiresAtMs'])),context=v.context(current.context);
   if(!same(context.binding,binding)||!same(context.scopes,scopes)||context.evidence.length||context.assets.length||context.analysisAdmission||current.checkedAtMs<at||current.checkedAtMs>c.now()||current.expiresAtMs<=c.now()||context.deadlineMs>current.expiresAtMs)fail('SKILL_SOURCE_CONTEXT_REFUSED');
   const admission=c.admissionForBinding(binding),gateway=c.gatewayForBinding(binding);if(typeof admission?.currentSkillRun!=='function'||['readForSkill','execute'].some(k=>typeof gateway?.[k]!=='function'))fail('SKILL_EXECUTION_CONFIGURATION');
   const base=c.readRevisionBase?data(await life.run(signal=>c.readRevisionBase({binding,request,scopes,selection,signal}))):null;
   const compileArtifact=async call=>{if(!same(call.binding,binding)||!same(call.scopes,scopes)||!same(call.selection,selection)||!same(call.skill,request.skill))fail('SKILL_COMPILER_CONTEXT_REFUSED');
    const sourceContext=v.context({...context,deadlineMs:Math.min(context.deadlineMs,call.deadlineMs)}),compiler=request.skill.skillId==='quick_skill.commitments_audit'?createCommitmentsAuditCompiler:request.skill.skillId==='quick_skill.relationship_brief'?createRelationshipBriefCompiler:null;if(!compiler)fail('SKILL_NOT_CONNECTED');
    const prepared=await compiler({readSource:call.readSource,...(c.readBase?{readBase:c.readBase}:{}),now:c.now,defaultCongress:c.defaultCongress}).prepare(call.input,sourceContext,{selection,...(base?{base}:{}),signal:call.signal});
    if(records.size>=64&&!records.has(hash(prepared)))fail('SKILL_PREPARATION_LIMIT');records.set(hash(prepared),{prepared,binding,request,selection,reads:null,inputSha256:hash(call.input)});return prepared;
   };
   let runtime;const artifactOutput={async deliver(call){const record=records.get(call.preparationSha256);if(!record||record.prepared!==call.prepared||!same(call.binding,binding))fail('SKILL_PREPARATION_REFUSED');record.reads=data(call.reads);return c.outputBridge?c.outputBridge.deliver(call):{state:'awaiting-output-approval',sourceBinding:binding,skill:request.skill,requestSha256:hash(request),selectionSha256:hash(selection),inputSha256:record.inputSha256,preparationSha256:call.preparationSha256,artifactRequestSha256:hash(call.prepared.request),baseVersionId:call.prepared.baseVersionId,prepared:call.prepared};}};
   runtime=await life.run(signal=>c.runtimeFactory({...args,binding,request,scopes,selection,now:c.now,readForSkill:input=>gateway.readForSkill(input),currentSkillRun:input=>admission.currentSkillRun(input),gateway,compileArtifact,artifactOutput,signal:args.signal}));return runtime;
  }finally{life.close();}
 }
 async function prepareEvent(value){const {signal,...raw}=own(value,['binding','request','scopes','selectedClientId','output'],['signal']);nativeSignal(signal);const {binding,request,scopes,output}=raw,record=records.get(output?.preparationSha256);
  if(!record||!same(record.binding,binding)||!same(record.request,request)||!same(record.prepared.context.scopes,scopes)||raw.selectedClientId!==record.selection.subject.entityIds[0]||record.reads===null)fail('SKILL_OUTPUT_PUBLICATION_REFUSED');
  const accepted=assertSelectedOutput(output,{binding,request,selection:record.selection,inputSha256:record.inputSha256,prepared:record.prepared}),at=c.now();let type,eventData;
  const pending={state:'awaiting-output-approval',sourceBinding:binding,skill:request.skill,requestSha256:hash(request),selectionSha256:hash(record.selection),inputSha256:record.inputSha256,preparationSha256:hash(record.prepared),artifactRequestSha256:hash(record.prepared.request),baseVersionId:record.prepared.baseVersionId,prepared:record.prepared};
  await c.retention.retain({pending,request,reads:record.reads,signal});
  if(accepted.state==='awaiting-output-approval'){
   type='message.delta';eventData={messageId:eventId({binding,preparationSha256:accepted.preparationSha256,kind:'pending-message'}),text:'Research is ready. Editable document awaits an approved output run.'};
  }else{if(!c.outputBridge||accepted.lineage.readsSha256!==hash(record.reads))fail('SKILL_OUTPUT_PUBLICATION_REFUSED');
   const inspected=await c.outputBridge.read({sourcePrepared:record.prepared,versionId:accepted.artifact.version.versionId,intent:'inspect',signal});
   if(!same(inspected.version,accepted.artifact.version)||inspected.inspection.currentBytesVerified!==true||inspected.inspection.sha256!==accepted.artifact.version.object.sha256||inspected.inspection.bytes!==accepted.artifact.version.object.bytes)fail('SKILL_OUTPUT_PUBLICATION_REFUSED');
   type='artifact.available';eventData={artifactId:accepted.artifact.version.artifactId,versionId:accepted.artifact.version.versionId};
  }
  if(signal?.aborted)fail('CANCELLED');return {event:{eventId:eventId({binding,preparationSha256:accepted.preparationSha256,type,data:eventData}),createdAt:record.prepared.provenance.asOf,type,data:eventData},checkedAtMs:c.now(),expiresAtMs:Math.min(record.prepared.context.deadlineMs,at+3000)};
 }
 return Object.freeze({selectedSkills:Object.freeze({prepare,publish:args=>c.publishForBinding(args)}),publication:Object.freeze({prepareEvent}),close(){records.clear();}});
}
