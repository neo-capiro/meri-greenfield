/** Admit the actual original compiler object before any output projection. */
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {admitPreparedRelationshipBrief} from '../relationship-brief/compose.mjs';
import {admitPreparedCommitmentsAudit} from '../commitments-audit/compose.mjs';
export const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),hash=canonicalSha256;
export const fail=code=>{throw Object.assign(Error(code),{code});};
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x);
export function sourcePreparation(value,retainedSource){
 const {prepared:p,signal,...raw}=own(value,['prepared','binding','requestSha256','selectionSha256','inputSha256','reads'],['preparationSha256','signal']);nativeSignal(signal);const call={...data(raw),prepared:p,...(signal?{signal}:{})};
 const fields=own(p,['request','context','baseVersionId','provenance'],['ledger','tracking','unresolved','reads','quotes','coverage','issues','receipts']),provenance=data(fields.provenance);
 const context=v.context(fields.context),request=v.request(fields.request),skill=selectSkill(provenance.skill.skillId,provenance.skill.skillVersion);
 const admit=skill.pin.skillId==='quick_skill.commitments_audit'?admitPreparedCommitmentsAudit:skill.pin.skillId==='quick_skill.relationship_brief'?admitPreparedRelationshipBrief:null;
 if(!admit)fail('SELECTED_OUTPUT_SOURCE');let guard;try{guard=admit(p,context);}catch(error){if(typeof retainedSource?.admit!=='function')throw error;guard=retainedSource.admit(p,context);}
 if(typeof guard!=='function')fail('SELECTED_OUTPUT_SOURCE');guard({request,context,baseVersionId:p.baseVersionId});
 validateShape('RunBinding',call.binding);
 if(!same(call.binding,context.binding)||!same(p.provenance.skill,skill.pin)||call.selectionSha256!==hash(p.provenance.selection)||call.inputSha256!==p.provenance.inputSha256||
 ![call.requestSha256,call.selectionSha256,call.inputSha256].every(digest)||request.operation!=='create_word'||request.format!=='docx'||!Array.isArray(call.reads)||call.reads.length>24||
 call.preparationSha256!==undefined&&call.preparationSha256!==hash(p))fail('SELECTED_OUTPUT_SOURCE');
 const sourcePins=data({sourceBinding:call.binding,skill:skill.pin,selection:p.provenance.selection,window:p.provenance.selection.window,requestSha256:call.requestSha256,selectionSha256:call.selectionSha256,inputSha256:call.inputSha256,
  readsSha256:hash(call.reads),compilerReadsSha256:p.provenance.readsSha256,preparationSha256:hash(p),sourceArtifactRequestSha256:hash(request),sourceContextSha256:hash(context),baseVersionId:p.baseVersionId});
 return {call,prepared:p,context,request,skill,sourcePins};
}
export function pending(source){const p=source.sourcePins;return Object.freeze({state:'awaiting-output-approval',sourceBinding:p.sourceBinding,skill:p.skill,requestSha256:p.requestSha256,selectionSha256:p.selectionSha256,inputSha256:p.inputSha256,preparationSha256:p.preparationSha256,artifactRequestSha256:p.sourceArtifactRequestSha256,baseVersionId:p.baseVersionId,prepared:source.prepared});}
