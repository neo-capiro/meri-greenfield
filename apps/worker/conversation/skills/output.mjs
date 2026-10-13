/** Literal task-result compilation; artifact governance remains in its separately approved owner. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators as v,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertSelectedOutput} from '../../../../packages/contracts/selected-skills/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const fault=code=>Object.assign(Error(code),{code}),same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function createSelectedSkillOutput({selected,binding,request,scopes,selection,readSource,current,compileArtifact,artifactOutput,receipts,life}) {
 if(typeof compileArtifact!=='function'||artifactOutput!==undefined&&typeof artifactOutput.deliver!=='function')throw fault('SKILL_OUTPUT_CONFIGURATION');
 let attempted,completion;
 return Object.freeze({finish(raw){
  const result=data(raw);if(result.type!=='result'||result.subtype!=='success'||result.is_error!==false||result.structured_output===undefined)throw fault('SKILL_LITERAL_OUTPUT_REQUIRED');
  const input=data(result.structured_output);if(!same(input.skill,selected.pin)||Buffer.byteLength(JSON.stringify(input))>selected.manifest.budgets.maxOutputBytes)throw fault('SKILL_OUTPUT_PIN_REFUSED');
  const sha=canonicalSha256(input);if(attempted!==undefined){if(attempted!==sha)throw fault('SKILL_OUTPUT_REPLAY_REFUSED');return completion;}
  attempted=sha;completion=(async()=>{
   await current();life.check();const prepared=await life.run(signal=>compileArtifact({skill:selected.pin,input,readSource,selection,binding,scopes,deadlineMs:life.deadlineMs,signal}));
   const spec=v.request(prepared.request),context=v.context(prepared.context);
   if(spec.operation!=='create_word'||spec.format!=='docx'||!same(context.binding,binding)||!same(context.scopes,scopes)||!same(prepared.provenance.skill,selected.pin)||
    !same(prepared.provenance.selection,selection)||prepared.provenance.inputSha256!==sha)throw fault('SKILL_COMPILED_OUTPUT_REFUSED');
   const base=prepared.baseVersionId??null;if(base!==null&&typeof base!=='string')throw fault('SKILL_COMPILED_OUTPUT_REFUSED');
   await current();life.check();
   const preparationSha256=canonicalSha256(prepared),pending=Object.freeze({state:'awaiting-output-approval',sourceBinding:binding,skill:selected.pin,requestSha256:canonicalSha256(request),selectionSha256:canonicalSha256(selection),inputSha256:sha,preparationSha256,artifactRequestSha256:canonicalSha256(spec),baseVersionId:base,prepared});
   if(artifactOutput===undefined)return pending;
   // Prepared identity is retained for the existing compiler admission WeakMap.
   // This port must own a separately approved output grant and immutable lineage;
   // it may not replace this source context or widen its read-only manifest.
   const delivered=await life.run(signal=>artifactOutput.deliver({prepared,binding,requestSha256:canonicalSha256(request),selectionSha256:canonicalSha256(selection),inputSha256:sha,preparationSha256,reads:receipts(),signal}));
   if(canonicalSha256(prepared)!==preparationSha256)throw fault('SKILL_PREPARATION_SUBSTITUTION');
   const correlated=assertSelectedOutput(delivered,{binding,request,selection,inputSha256:sha,prepared});
   if(correlated.state==='awaiting-output-approval'){life.check();return correlated;}
   const artifact=correlated.artifact,projection=correlated.projection;validateShape('ArtifactCreatedResult',artifact);const version=v.version(artifact.version),inspection=v.inspection(artifact.inspection);
   if(!same(version.binding,projection.context.binding)||!same(version.scopes,projection.context.scopes)||!same(version.evidence,projection.context.evidence)||version.parentVersionId!==projection.baseVersionId||version.mimeType!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||inspection.format!=='docx'||inspection.sha256!==version.object.sha256||inspection.bytes!==version.object.bytes||artifact.execution.requestSha256!==canonicalSha256(projection))throw fault('SKILL_ARTIFACT_RESULT_REFUSED');
   // The bridge rechecks current approved output and retained source access.
   // A completed historical research writer is not the output access owner.
   life.check();return correlated;
  })();return completion;
 }});
}
