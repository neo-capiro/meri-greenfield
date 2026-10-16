/** Prepares a document intent as an immutable draft version through the existing artifact write owner — the same
 * `createPostgresArtifactService(...).execute` the document application uses, bound by the trusted composition to its
 * current authority and artifact capability. Only the formats the document application admits are accepted
 * (`format-admission.mjs`); filing or sharing the draft is a separate governed request.
 *
 * The artifact owner never regenerates the same delivery: the intent delivery ID is its delivery ID, so a repeat is
 * the owner's own replay. Once the owner is called, any failure is `unknown` (a draft may exist). */
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators,validateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {admitDocumentDescriptor,admitsDocumentFormat} from '../document-application/format-admission.mjs';
import {intentFault} from './faults.mjs';
export const DOCUMENT_INTENT_OPERATIONS=Object.freeze(['create_word','create_excel']);
/** @param {{descriptor:object,writes:{execute:Function},binding:object}} configuration descriptor is the exact catalog projection the document application admits */
export function createDocumentIntentPreparer(configuration){
 const c=own(configuration,['descriptor','writes','binding']),binding=data(c.binding);
 let admission;try{admission=admitDocumentDescriptor(c.descriptor);}catch{throw intentFault('INTENT_CONFIGURATION');}
 if(typeof c.writes?.execute!=='function')throw intentFault('INTENT_CONFIGURATION');
 const operation=admission.descriptor.operation;
 return Object.freeze({operation:Object.freeze({...operation}),owner:'document',binding,
  async prepare({arguments:raw,deliveryId,signal}){
   let request;
   try{request=artifactValidators.request(data(raw));if(request.operation!==operation.id||!admitsDocumentFormat(admission,request.format))throw 0;}
   catch{throw intentFault('INVALID_ARGUMENTS','none');}
   let result;
   try{result=data(await c.writes.execute({deliveryId,request,baseVersionId:null},signal));}
   catch{throw intentFault('UNKNOWN','unknown');}
   try{validateShape('ArtifactCreatedResult',result);}catch{throw intentFault('INVALID_RESULT','unknown');}
   const version=result.version;
   if(version.generationStatus!=='draft'||version.parentVersionId!==null||version.binding.tenantId!==binding.tenantId||version.binding.conversationId!==binding.conversationId||version.binding.actorId!==binding.actorId)throw intentFault('INVALID_RESULT','unknown');
   return {status:'draft',version};
  }});
}
