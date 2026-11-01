/** `propose_office_edit`: read the exact selected Office version as an addressable outline (a management-style
 * read, no journal row), or prepare a bounded proposal against it for the signed-in user to apply. Preparation
 * applies the operations to the retained bytes in memory and pins the result digest, so a refusal happens here,
 * before any proposal exists, and Apply can only ever reproduce exactly what was reviewed. The trusted
 * composition supplies the one document read (current authority, exact bytes, current head); the model never
 * chooses the document. */
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {officeEditValidators as validators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {OFFICE_EDIT_ACTION} from '../../../packages/contracts/retrieval-0.2/office-edit-action-validation.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {officeOutline,applyOfficeOperations,OFFICE_EDIT_UNIT_CODES} from '../../artifacts/office-units/index.mjs';
import {inspectOfficeEdit} from '../../artifacts/edit-sessions/inspect-office.mjs';
import {intentFault} from './faults.mjs';
/** A v4-shaped identity derived from the delivery: a retried delivery reuses it instead of minting a second proposal. */
export function officeProposalId(binding,deliveryId){
 const h=createHash('sha256').update('meri-office-proposal:'+hash({binding,deliveryId})).digest('hex'),c=h.slice(0,32).split('');
 c[12]='4';c[16]=((parseInt(c[16],16)&0x3)|0x8).toString(16);const x=c.join('');
 return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`;
}
export function createOfficeEditPreparer({binding,scopes,selectedClientId,document,now,deadlineMs,currentRights,policyRevision}){
 if(typeof document?.read!=='function'||typeof currentRights!=='function'||typeof now!=='function'||!Number.isSafeInteger(deadlineMs))throw intentFault('INTENT_CONFIGURATION');
 const check=async(signal,effect)=>{const r=await currentRights({signal,policyRevision});if(hash(r.scopes)!==hash(scopes)||r.expiresAtMs<=now())throw intentFault('ACCESS_DENIED',effect);return r;};
 /** The exact selected version through the trusted read; its identity is re-checked against what the read claims. */
 async function source(signal){
  const s=own(await document.read({signal}),['document','bytes','headVersionId']),doc=validators.document(s.document);
  if(!Buffer.isBuffer(s.bytes)||typeof s.headVersionId!=='string')throw intentFault('UNAVAILABLE','none');
  return {document:doc,bytes:s.bytes,headVersionId:s.headVersionId};
 }
 return Object.freeze({binding,owner:'office',operation:{id:OFFICE_EDIT_ACTION,version:'0.2.0'},
  async read({arguments:request,signal}){
   if(!validators.isRead(request))throw intentFault('INVALID_ARGUMENTS','none');
   const before=await check(signal,'none'),observedAt=now(),{document:doc,bytes}=await source(signal);
   let outline;try{outline=officeOutline(bytes,doc.format);}catch{throw intentFault('UNAVAILABLE','none');}
   const after=await check(signal,'none');
   return validators.readResult({status:'read',operation:OFFICE_EDIT_ACTION,binding,scopes,document:doc,outline,
    observedAt:new Date(observedAt).toISOString(),expiresAt:new Date(Math.min(deadlineMs,before.expiresAtMs,after.expiresAtMs)).toISOString()});
  },
  async prepare(raw){
   const {arguments:request,deliveryId,signal}=own(raw,['arguments','deliveryId'],['signal']);
   let input;try{input=validators.normalizeInput(request);}catch{throw intentFault('INVALID_ARGUMENTS','none');}
   if(input.action!=='propose')throw intentFault('INVALID_ARGUMENTS','none');
   // Nothing below has an effect: every refusal settles FAILED with its exact code and replays.
   const rights=await check(signal,'none'),{document:doc,bytes,headVersionId}=await source(signal);
   if(headVersionId!==doc.versionId)throw intentFault('CONFLICT','none');
   let out;
   try{out=applyOfficeOperations(bytes,doc.format,input.operations);inspectOfficeEdit(out,doc.format);}
   catch(error){throw Object.assign(intentFault(OFFICE_EDIT_UNIT_CODES.includes(error?.code)?'REFUSED':'INVALID_ARGUMENTS','none'),{detail:error?.code,unit:error?.unit});}
   const createdAt=now(),expiresAt=Math.min(deadlineMs,rights.expiresAtMs);
   const bound={kind:'office_edit',operation:OFFICE_EDIT_ACTION,proposalId:officeProposalId(binding,deliveryId),binding,scopes,context:{conversationId:binding.conversationId,selectedClientId},
    document:doc,summary:input.summary,operations:input.operations,result:{sha256:createHash('sha256').update(out).digest('hex'),bytes:out.length},
    createdAt:new Date(createdAt).toISOString(),expiresAt:new Date(expiresAt).toISOString(),requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId}};
   const proposal={...bound,commandSha256:hash(bound)};
   validators.assertProposal(proposal);if(expiresAt<=now())throw intentFault('DEADLINE','none');
   return data({status:'approval_required',proposal});
  }});
}
