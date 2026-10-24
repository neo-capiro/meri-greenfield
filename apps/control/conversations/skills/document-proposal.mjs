/** A selected compiler result enters the existing immutable approval metadata and intent journal.
 * Claim precedes metadata creation; an uncertain delivery is never prepared a second time. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertDocumentDraftProposal} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {createCommandApprovalMetadataOwner} from '../../commands/approval-metadata/owner.mjs';
import {sourcePreparation} from '../../document-application/selected-output/preparation.mjs';

const operation=Object.freeze({id:'create_word',version:'0.2.0'}),same=(a,b)=>hash(a)===hash(b);
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createSelectedDocumentProposals(configuration){
 const c=own(configuration,['journal','metadataStore','readCurrent','now'],['maxRequestMs']);
 if(typeof c.readCurrent!=='function'||typeof c.now!=='function'||!Number.isSafeInteger(c.maxRequestMs??3000)||(c.maxRequestMs??3000)<1||(c.maxRequestMs??3000)>30000)fail('SELECTED_PROPOSAL_CONFIGURATION');
 const journal=own(c.journal,['begin','settle']);for(const name of ['begin','settle'])if(typeof journal[name]!=='function')fail('SELECTED_PROPOSAL_CONFIGURATION');
 own(c.metadataStore,['insert','read']);
 async function prepare(value){
  const args=own(value,['prepared','binding','request','selection','reads'],['signal','credential']);nativeSignal(args.signal);
  const source=sourcePreparation({prepared:args.prepared,binding:args.binding,requestSha256:hash(args.request),selectionSha256:hash(args.selection),inputSha256:args.prepared.provenance.inputSha256,reads:args.reads});
  if(!same(args.request.skill,source.skill.pin)||!same(args.selection,source.prepared.provenance.selection))fail('SELECTED_PROPOSAL_SOURCE');
  const context={binding:source.context.binding,scopes:source.context.scopes},request={preparationSha256:hash(source.prepared),artifactRequestSha256:hash(source.request),sourceContextSha256:hash(source.context),baseVersionId:source.prepared.baseVersionId,title:source.request.title,format:'docx'};
  const deliveryId='sdk:'+hash({kind:'selected-document-proposal/1',binding:context.binding,requestSha256:hash(args.request),preparationSha256:request.preparationSha256});
  const record={operation,argumentsSha256:hash({request,context})},life=createOperationLifetime({deadlineMs:c.now()+(c.maxRequestMs??3000),now:c.now,signal:args.signal,errorFactory:code=>Object.assign(Error(code),{code})});
  let proposalExpiresAt,claimed=false,attempted=false;
  async function current(){
   const started=c.now(),r=data(own(await life.run(signal=>c.readCurrent({binding:context.binding,signal,credential:args.credential})),['binding','scopes','checkedAtMs','expiresAtMs']));
   if(!same(r.binding,context.binding)||!same(r.scopes,context.scopes)||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>c.now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=c.now())fail('SELECTED_PROPOSAL_CURRENT');
   proposalExpiresAt??=new Date(r.expiresAtMs).toISOString();if(Date.parse(proposalExpiresAt)>r.expiresAtMs)fail('SELECTED_PROPOSAL_CURRENT');life.limitDeadline(r.expiresAtMs);return r;
  }
  function checked(proposal){
   const p=data(proposal);assertDocumentDraftProposal(p,context);
   if(!same(p.command.arguments,request)||p.command.action!=='document.draft'||Date.parse(p.expiresAt)<=c.now())fail('SELECTED_PROPOSAL_REPLAY');return p;
  }
  try{
   await current();const claim=await life.run(signal=>journal.begin.call(c.journal,{binding:context.binding,deliveryId,record,signal}));
   if(claim.replayed){const result=own(claim.result,['status','proposal']);if(result.status!=='approval_required'||!claim.release||!same(claim.release.binding,context.binding)||!same(claim.release.scopes,context.scopes))fail('SELECTED_PROPOSAL_REPLAY');const p=checked(result.proposal);await current();life.check();return p;}
   if(claim.claimed!==true)fail('UNKNOWN');claimed=true;
   const owner=createCommandApprovalMetadataOwner({store:c.metadataStore,commandContext:context,now:c.now,maxRequestMs:c.maxRequestMs??3000,
    async preparePolicy({selectionSha256}){const r=await current();return {authorized:true,selectionSha256,...context,requiredApprover:{tenantId:context.binding.tenantId,actorId:context.binding.actorId},proposalExpiresAt,checkedAtMs:r.checkedAtMs,expiresAtMs:r.expiresAtMs};}},'document.draft');
   const input={arguments:request,attachments:[]};attempted=true;
   const metadata=await life.run(signal=>owner.prepare({operation,action:'document.draft',binding:context.binding,request,input,inputSha256:hash(input),deadlineMs:c.now()+(c.maxRequestMs??3000),signal}));
   const command={contractVersion:'0.2.0',commandId:metadata.commandId,binding:context.binding,action:'document.draft',arguments:request,attachments:[],scopes:context.scopes,idempotencyKey:metadata.idempotencyKey};
   const proposal=checked({proposalId:metadata.proposalId,command,commandSha256:hash(command),createdAt:metadata.createdAt,expiresAt:metadata.expiresAt,requiredApprover:metadata.requiredApprover});
   await current();await life.run(signal=>journal.settle.call(c.journal,{binding:context.binding,deliveryId,record,state:'PREPARED',outcome:{result:{status:'approval_required',proposal},release:{...context,expiresAtMs:Date.parse(proposal.expiresAt)}},signal}));life.check();return proposal;
  }catch(error){
   // A failed acknowledgement may have committed. Never redispatch a claimed delivery.
   if(claimed)await journal.settle.call(c.journal,{binding:context.binding,deliveryId,record,state:'UNKNOWN',outcome:null,signal:undefined}).catch(()=>{});
   if(attempted)fail('UNKNOWN');throw error;
  }finally{life.close();}
 }
 return Object.freeze({prepare});
}
