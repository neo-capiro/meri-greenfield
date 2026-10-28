/** Prepares a document intent as an immutable draft version through the existing artifact write owner — the same
 * `createPostgresArtifactService(...).execute` the document application uses, bound by the trusted composition to its
 * current authority and artifact capability. The operation is the trusted one this preparer was composed for, bound
 * into the request it validates; only the formats the document application admits are accepted
 * (`format-admission.mjs`); filing or sharing the draft is a separate governed request.
 *
 * Revision: the immutable parent's retained evidence and asset references are preserved only through the trusted
 * owner composed here. A composition that cannot re-present them (`writes.preservation`) cannot serve a
 * source-backed or asset-bearing revision, and the write result is re-checked against the pinned retained evidence
 * after the write, so a port that silently drops provenance is never reported as a draft.
 *
 * The artifact owner never regenerates the same delivery: the intent delivery ID is its delivery ID, so a repeat is
 * the owner's own replay. Once the owner is called, any failure is `unknown` (a draft may exist). */
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {validateShape as validatePublicShape} from '../../../packages/contracts/validate.mjs';
import {admitDocumentDescriptor,admitsDocumentFormat} from '../document-application/format-admission.mjs';
import {intentFault} from './faults.mjs';
import {types} from 'node:util';
import {assertIntentArtifactDraft} from './artifact-draft-result.mjs';
import {assertDocumentRevisionSelection} from '../../../packages/contracts/document-revision.mjs';
import {admitDocumentRevisionSource} from './document-revision.mjs';
export const DOCUMENT_INTENT_OPERATIONS=Object.freeze(['create_word','create_excel','create_powerpoint']);
/** @param {{descriptor:object,writes:{execute:Function},binding:object}} configuration descriptor is the exact catalog projection the document application admits */
export function createDocumentIntentPreparer(configuration){
 const c=own(configuration,['descriptor','writes','binding'],['revision']),binding=data(c.binding);
 let admission,writes,revision=null;try{admission=admitDocumentDescriptor(c.descriptor);writes=own(c.writes,['execute'],['preservation']);validatePublicShape('RunBinding',binding);
  if(writes.preservation!==undefined&&(typeof writes.preservation!=='function'||types.isProxy(writes.preservation)))throw 0;
  if(c.revision!==undefined){const r=own(c.revision,['selection','read']);if(typeof r.read!=='function'||types.isProxy(r.read))throw 0;revision={selection:assertDocumentRevisionSelection(r.selection),read:r.read};}}
 catch{throw intentFault('INTENT_CONFIGURATION');}
 if(typeof writes.execute!=='function'||types.isProxy(writes.execute)||!DOCUMENT_INTENT_OPERATIONS.includes(admission.descriptor.operation.id))throw intentFault('INTENT_CONFIGURATION');
 const operation=admission.descriptor.operation;
 return Object.freeze({operation:Object.freeze({...operation}),owner:'document',binding,
  async prepare(value){
   let request,call;
   try{call=own(value,['arguments','deliveryId'],['signal']);nativeSignal(call.signal);
    // The tool's own `operation` already selects this capability, so the trusted selection is bound into the
    // canonical request instead of being demanded from the model, which cannot discover the repeated field from
    // the advertised `arguments`. A model-supplied operation that conflicts with it is still refused.
    const body=data(call.arguments);if(body.operation!==undefined&&body.operation!==operation.id)throw 0;
    request=artifactValidators.request({...body,operation:operation.id});if(!admitsDocumentFormat(admission,request.format))throw 0;}
   catch{throw intentFault('INVALID_ARGUMENTS','none');}
   const {deliveryId,signal}=call;if(signal?.aborted)throw intentFault('CANCELLED','none');
   let result,baseVersion=null,preserved=null;
   if(revision){let source;try{source=await revision.read({selection:revision.selection,signal});}catch(error){throw intentFault(['ACCESS_DENIED','CONFLICT','CANCELLED','DEADLINE'].includes(error?.code)?error.code:'UNAVAILABLE','none');}
    // Only a trusted owner that can re-present the immutable parent's retained evidence and asset
    // objects keeps the selection's provenance across a full replacement; the admission refuses a
    // source-backed or asset-bearing parent when no such owner is composed.
    const ownership=typeof writes.preservation==='function'?({retained})=>writes.preservation.call(c.writes,{retained,binding,request,signal}):null;
    const admitted=admitDocumentRevisionSource(source,{selection:revision.selection,binding,request,preservation:ownership});
    baseVersion=admitted.version;preserved=admitted.preserved;
    if(signal?.aborted)throw intentFault('CANCELLED','none');}
   try{result=data(await writes.execute.call(c.writes,{deliveryId,request,baseVersionId:baseVersion?.versionId??null,...(preserved===null?{}:{preserve:preserved})},signal));}
   catch{throw intentFault('UNKNOWN','unknown');}
   try{result=assertIntentArtifactDraft(result,{binding,request,baseVersion});
    // A port that re-presented nothing has not preserved the retained evidence; the draft exists, so the effect is unknown.
    if(preserved!==null&&artifactValidators.hash(result.version.evidence)!==preserved.evidenceSha256)throw 0;}
   catch{throw intentFault('INVALID_RESULT','unknown');}
   const version=result.version;
   if(signal?.aborted)throw intentFault('INVALID_RESULT','unknown');
   return {status:'draft',version};
  }});
}
